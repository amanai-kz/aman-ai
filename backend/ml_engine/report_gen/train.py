"""LoRA fine-tuning loop for the report generator (SCRUM-23, §7.1 Stage C).

Drives :class:`ml_engine.report_gen.ReportGenerator` on (volume -> report)
pairs: the visual prefix + the LoRA-adapted causal LM are trained with the
causal-LM loss; the base LLM and the image encoder are frozen. Versions the
trained adapter + projector in the registry.

Model licensing: the production target is ``meta-llama/Llama-3.2-3B-Instruct``,
which is **gated** (needs an HF token + accepted licence) — the same
licensing-gate theme as the training data (decision D10). This loop is verified
end-to-end with a small open model (override ``--llm``); swap ``--llm`` to the
Llama checkpoint once the token/licence is in place. Pairs are synthetic
placeholders; real fine-tuning uses report-paired studies.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import torch

from ..encoder.encoder import EncoderConfig, MRIEncoder3D
from ..encoder.train import SyntheticMRIVolumes
from .generator import ReportGenerator, ReportGenConfig


_REPORT_TEMPLATES = [
    "Findings: no acute intracranial abnormality. Impression: normal study.",
    "Findings: small acute infarct in the left frontal lobe. Impression: acute ischaemia.",
    "Findings: intracranial haemorrhage with surrounding oedema. Impression: urgent review.",
    "Findings: mass effect with midline shift. Impression: space-occupying lesion.",
]


def run_report_training(
    cfg: EncoderConfig,
    rg_cfg: ReportGenConfig | None = None,
    *,
    llm_name: str | None = None,
    steps: int = 30,
    batch_size: int = 2,
    lr: float = 1e-4,
    device: str = "cpu",
    max_len: int = 48,
    log_every: int = 5,
    out_dir: str | Path = "checkpoints",
    name: str = "mr-report-gen",
    version: str = "0.1.0",
    register: bool = False,
    code_commit: str = "",
    seed: int = 0,
) -> dict[str, Any]:
    torch.manual_seed(seed)
    dev = torch.device(device if (device != "cuda" or torch.cuda.is_available()) else "cpu")
    rg_cfg = rg_cfg or ReportGenConfig()
    if llm_name:
        rg_cfg.llm_name = llm_name

    encoder = MRIEncoder3D(cfg)
    model = ReportGenerator(encoder, rg_cfg).attach_llm().to(dev)
    encoder.requires_grad_(False)        # freeze image encoder; train projector + LoRA

    tok = model.tokenizer
    if tok.pad_token is None:
        tok.pad_token = tok.eos_token

    vols = SyntheticMRIVolumes(cfg, length=max(batch_size * 8, 16), seed=seed)

    def make_batch(step: int):
        idx = [(step * batch_size + i) % len(vols) for i in range(batch_size)]
        vol = torch.stack([vols[i] for i in idx]).to(dev)
        texts = [_REPORT_TEMPLATES[i % len(_REPORT_TEMPLATES)] for i in idx]
        enc = tok(texts, return_tensors="pt", padding="max_length",
                  truncation=True, max_length=max_len)
        input_ids = enc["input_ids"].to(dev)
        attn = enc["attention_mask"].to(dev)
        labels = input_ids.clone()
        labels[attn == 0] = -100
        return vol, input_ids, attn, labels

    trainable = [p for p in model.parameters() if p.requires_grad]
    opt = torch.optim.AdamW(trainable, lr=lr)

    model.train()
    first_loss = last_loss = float("nan")
    for step in range(steps):
        vol, input_ids, attn, labels = make_batch(step)
        loss = model.training_step(vol, input_ids, attn, labels)
        opt.zero_grad(set_to_none=True)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(trainable, 1.0)
        opt.step()
        last_loss = float(loss.detach().cpu())
        if step == 0:
            first_loss = last_loss
        if step % log_every == 0 or step == steps - 1:
            print(json.dumps({"step": step, "lm_loss": last_loss}), flush=True)

    out_dir = Path(out_dir)
    ckpt_dir = Path(out_dir) / f"{name}-{version}"
    ckpt_dir.mkdir(parents=True, exist_ok=True)
    torch.save(model.projector.state_dict(), ckpt_dir / "projector.pt")
    model.llm.save_pretrained(ckpt_dir / "lora_adapter")     # peft adapter only
    n_trainable = sum(p.numel() for p in trainable)

    summary: dict[str, Any] = {
        "name": name, "version": version, "device": str(dev),
        "llm": rg_cfg.llm_name, "steps": steps, "first_loss": first_loss,
        "final_loss": last_loss, "trainable_params": n_trainable,
        "checkpoint": str(ckpt_dir),
    }
    if register:
        from ..registry import ModelRegistry
        reg = ModelRegistry()
        card = reg.register(
            name=name, version=version, stage="report_gen",
            artifact_uri=str(ckpt_dir.resolve()), code_commit=code_commit,
            config={"llm": rg_cfg.llm_name, "lora_r": rg_cfg.lora_r,
                    "n_visual_tokens": rg_cfg.n_visual_tokens,
                    "final_loss": last_loss, "data": "synthetic"},
        )
        summary["registered"] = card.model_id
    print(json.dumps({"summary": summary}, default=str), flush=True)
    return summary


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="ml_engine.report_gen.train",
                                 description="LoRA fine-tune the report generator (SCRUM-23)")
    ap.add_argument("--llm", default=None, help="HF model id (default: config Llama-3.2-3B; gated)")
    ap.add_argument("--steps", type=int, default=30)
    ap.add_argument("--batch-size", type=int, default=2, dest="batch_size")
    ap.add_argument("--img-size", type=int, default=64, dest="img_size")
    ap.add_argument("--patch-size", type=int, default=16, dest="patch_size")
    ap.add_argument("--embed-dim", type=int, default=384, dest="embed_dim")
    ap.add_argument("--depth", type=int, default=6)
    ap.add_argument("--heads", type=int, default=6)
    ap.add_argument("--lr", type=float, default=1e-4)
    ap.add_argument("--device", default="cuda")
    ap.add_argument("--out", default="checkpoints", dest="out_dir")
    ap.add_argument("--name", default="mr-report-gen")
    ap.add_argument("--version", default="0.1.0")
    ap.add_argument("--register", action="store_true")
    ap.add_argument("--commit", default="", dest="code_commit")
    ap.add_argument("--seed", type=int, default=0)
    a = ap.parse_args(argv)
    cfg = EncoderConfig(img_size=(a.img_size,) * 3, patch_size=(a.patch_size,) * 3,
                        embed_dim=a.embed_dim, depth=a.depth, num_heads=a.heads)
    run_report_training(
        cfg, llm_name=a.llm, steps=a.steps, batch_size=a.batch_size, lr=a.lr,
        device=a.device, out_dir=a.out_dir, name=a.name, version=a.version,
        register=a.register, code_commit=a.code_commit, seed=a.seed,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
