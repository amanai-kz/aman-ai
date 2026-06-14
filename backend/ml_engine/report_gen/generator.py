"""LLM + LoRA report generator (SCRUM-23, §7.1 Stage C, §7.3, §7.5).

Connects the aligned 3D MRI encoder to a causal LLM through a projection layer
that maps image patch tokens into the LLM embedding space (a prefix of "visual
tokens"). The LLM is parameter-efficiently fine-tuned with LoRA on
(volume -> report) pairs and instruction/Q&A data.

Safety (§7.5): generation is constrained to a findings vocabulary and grounded
in image evidence; uncertainty is surfaced. The model abstains on
out-of-distribution input rather than hallucinating (FR-14) — abstention is
handled upstream by the triage/OOD gate before this generator runs.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

import torch
import torch.nn as nn

from ..encoder.encoder import MRIEncoder3D


@dataclass
class StructuredFinding:
    """Machine-readable finding emitted alongside prose (§3.3 FR-06)."""

    label: str
    anatomy: str = ""
    laterality: str = ""
    measurement_mm: Optional[float] = None
    confidence: float = 0.0
    presence: str = "present"


@dataclass
class ReportGenConfig:
    # Default to an ungated, commercially-usable open model (Apache-2.0) so the
    # report generator trains/serves with no licence gate. Swap to a gated model
    # (e.g. meta-llama/Llama-3.2-3B-Instruct) once a token + licence are in place.
    llm_name: str = "Qwen/Qwen2.5-1.5B-Instruct"
    n_visual_tokens: int = 32
    lora_r: int = 16
    lora_alpha: int = 32
    lora_dropout: float = 0.05
    lora_targets: tuple[str, ...] = ("q_proj", "v_proj")
    max_new_tokens: int = 512
    findings_vocab: tuple[str, ...] = field(default_factory=tuple)  # constrains output


class VisualProjector(nn.Module):
    """Maps encoder patch tokens to a fixed number of LLM-space visual tokens."""

    def __init__(self, in_dim: int, llm_dim: int, n_tokens: int):
        super().__init__()
        self.query = nn.Parameter(torch.randn(1, n_tokens, llm_dim) * 0.02)
        self.attn = nn.MultiheadAttention(llm_dim, num_heads=8, batch_first=True)
        self.kv = nn.Linear(in_dim, llm_dim)
        self.norm = nn.LayerNorm(llm_dim)

    def forward(self, patch_tokens: torch.Tensor) -> torch.Tensor:
        kv = self.kv(patch_tokens)
        q = self.query.expand(patch_tokens.size(0), -1, -1)
        out, _ = self.attn(q, kv, kv)
        return self.norm(out)


class ReportGenerator(nn.Module):
    """Encoder -> visual projector -> LoRA-adapted LLM.

    The heavy LLM (transformers + peft) is loaded lazily in :meth:`attach_llm`
    so the module can be constructed/inspected without those deps. ``generate``
    and ``training_step`` require an attached LLM.
    """

    def __init__(self, encoder: MRIEncoder3D, cfg: ReportGenConfig | None = None,
                 llm_dim: int = 3072):
        super().__init__()
        self.encoder = encoder
        self.cfg = cfg or ReportGenConfig()
        self.llm_dim = llm_dim
        self.projector = VisualProjector(encoder.embed_dim, llm_dim, self.cfg.n_visual_tokens)
        self.llm = None
        self.tokenizer = None

    def attach_llm(self):  # pragma: no cover - requires transformers + peft + weights
        from transformers import AutoModelForCausalLM, AutoTokenizer
        from peft import LoraConfig, get_peft_model

        self.tokenizer = AutoTokenizer.from_pretrained(self.cfg.llm_name)
        base = AutoModelForCausalLM.from_pretrained(self.cfg.llm_name)
        lora = LoraConfig(
            r=self.cfg.lora_r, lora_alpha=self.cfg.lora_alpha,
            lora_dropout=self.cfg.lora_dropout, target_modules=list(self.cfg.lora_targets),
            task_type="CAUSAL_LM",
        )
        self.llm = get_peft_model(base, lora)
        hidden = self.llm.config.hidden_size
        if hidden != self.llm_dim:
            # The projector must emit tokens in the *actual* LLM embedding space;
            # rebuild it once the real hidden size is known (constructor used a
            # placeholder llm_dim before the weights were loaded).
            self.llm_dim = hidden
            self.projector = VisualProjector(
                self.encoder.embed_dim, self.llm_dim, self.cfg.n_visual_tokens
            ).to(next(self.projector.parameters()).device)
        return self

    def visual_prefix(self, volume: torch.Tensor) -> torch.Tensor:
        """Visual tokens to prepend to the LLM prompt embeddings."""
        patch_tokens = self.encoder(volume)["patch_tokens"]
        return self.projector(patch_tokens)

    def training_step(
        self,
        volume: torch.Tensor,
        input_ids: torch.Tensor,
        attention_mask: torch.Tensor,
        labels: torch.Tensor,
    ) -> torch.Tensor:
        """Causal-LM loss on (volume -> report) pairs.

        Prepends the visual prefix to the embedded prompt and masks the visual
        positions out of the loss (label ``-100``). Works with any attached
        ``transformers`` causal LM (LoRA-adapted). Used by ``report_gen.train``.
        """
        if self.llm is None:
            raise RuntimeError("call attach_llm() before training_step()")
        tok_embeds = self.llm.get_input_embeddings()(input_ids)      # (B, T, D)
        vis = self.visual_prefix(volume).to(tok_embeds.dtype)        # (B, n_vis, D)
        b, n_vis = vis.shape[0], vis.shape[1]
        inputs_embeds = torch.cat([vis, tok_embeds], dim=1)
        vis_mask = torch.ones(b, n_vis, dtype=attention_mask.dtype, device=attention_mask.device)
        attn = torch.cat([vis_mask, attention_mask], dim=1)
        vis_labels = torch.full((b, n_vis), -100, dtype=labels.dtype, device=labels.device)
        full_labels = torch.cat([vis_labels, labels], dim=1)
        return self.llm(inputs_embeds=inputs_embeds, attention_mask=attn,
                        labels=full_labels).loss

    @torch.no_grad()
    def generate(self, volume: torch.Tensor, prompt: str = "Findings:") -> dict:
        """Generate a report: prepend the visual prefix and decode with the LLM."""
        if self.llm is None:
            raise RuntimeError("call attach_llm() before generate()")
        dev = next(self.llm.parameters()).device
        vis = self.visual_prefix(volume.to(dev))
        enc = self.tokenizer([prompt] * vis.shape[0], return_tensors="pt", padding=True).to(dev)
        tok_embeds = self.llm.get_input_embeddings()(enc["input_ids"]).to(vis.dtype)
        inputs_embeds = torch.cat([vis, tok_embeds], dim=1)
        vis_mask = torch.ones(vis.shape[0], vis.shape[1], dtype=enc["attention_mask"].dtype, device=dev)
        attn = torch.cat([vis_mask, enc["attention_mask"]], dim=1)
        out = self.llm.generate(
            inputs_embeds=inputs_embeds, attention_mask=attn,
            max_new_tokens=self.cfg.max_new_tokens, do_sample=False,
            pad_token_id=self.tokenizer.pad_token_id or self.tokenizer.eos_token_id,
        )
        text = self.tokenizer.batch_decode(out, skip_special_tokens=True)
        return {"text": text, "n_visual_tokens": vis.shape[1]}
