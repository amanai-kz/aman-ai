"""Surface-level NLG metrics for report text (SCRUM-26, §7.3).

Pure-Python BLEU, ROUGE-L, METEOR (lite) and CIDEr — no heavy deps, so the
harness runs anywhere. BERTScore is optional: if ``bert_score`` is installed it
is used, otherwise the metric is reported as ``nan`` (gates treat missing
metrics as "not measured"). NLG metrics are *tracked, not a sole gate* (§7.3) —
clinical-efficacy metrics decide promotion.
"""
from __future__ import annotations

import math
from collections import Counter
from typing import Iterable, Sequence


def _tokens(text: str) -> list[str]:
    return text.lower().split()


def _ngrams(tokens: Sequence[str], n: int) -> Counter:
    return Counter(tuple(tokens[i:i + n]) for i in range(len(tokens) - n + 1))


# ---- BLEU ------------------------------------------------------------------
def corpus_bleu(hypotheses: Sequence[str], references: Sequence[str], max_n: int = 4) -> float:
    """Corpus-level BLEU-``max_n`` with brevity penalty (single reference each)."""
    if not hypotheses:
        return float("nan")
    clipped = [0] * max_n
    totals = [0] * max_n
    hyp_len = ref_len = 0
    for hyp, ref in zip(hypotheses, references):
        h, r = _tokens(hyp), _tokens(ref)
        hyp_len += len(h)
        ref_len += len(r)
        for n in range(1, max_n + 1):
            h_ng = _ngrams(h, n)
            r_ng = _ngrams(r, n)
            overlap = sum(min(c, r_ng[g]) for g, c in h_ng.items())
            clipped[n - 1] += overlap
            totals[n - 1] += max(sum(h_ng.values()), 0)
    precisions = []
    for c, t in zip(clipped, totals):
        precisions.append((c / t) if t > 0 else 0.0)
    if min(precisions) <= 0:
        # smooth to avoid log(0) collapsing the whole score
        precisions = [p if p > 0 else 1e-9 for p in precisions]
    geo_mean = math.exp(sum(math.log(p) for p in precisions) / max_n)
    bp = 1.0 if hyp_len > ref_len else math.exp(1 - ref_len / hyp_len) if hyp_len > 0 else 0.0
    return bp * geo_mean


# ---- ROUGE-L ---------------------------------------------------------------
def _lcs(a: Sequence[str], b: Sequence[str]) -> int:
    if not a or not b:
        return 0
    prev = [0] * (len(b) + 1)
    for x in a:
        cur = [0]
        for j, y in enumerate(b, 1):
            cur.append(prev[j - 1] + 1 if x == y else max(prev[j], cur[-1]))
        prev = cur
    return prev[-1]


def rouge_l(hypotheses: Sequence[str], references: Sequence[str], beta: float = 1.2) -> float:
    """Average sentence-level ROUGE-L F-measure."""
    scores = []
    for hyp, ref in zip(hypotheses, references):
        h, r = _tokens(hyp), _tokens(ref)
        if not h or not r:
            scores.append(0.0)
            continue
        lcs = _lcs(h, r)
        prec = lcs / len(h)
        rec = lcs / len(r)
        if prec + rec == 0:
            scores.append(0.0)
        else:
            scores.append(((1 + beta**2) * prec * rec) / (rec + beta**2 * prec))
    return sum(scores) / len(scores) if scores else float("nan")


# ---- METEOR (lite) ---------------------------------------------------------
def meteor_lite(hypotheses: Sequence[str], references: Sequence[str],
                alpha: float = 0.9, gamma: float = 0.5) -> float:
    """Simplified METEOR: unigram P/R harmonic mean with a fragmentation penalty.

    Omits WordNet synonym/stem matching (kept dependency-free); good enough for
    relative tracking, not a clinical gate.
    """
    scores = []
    for hyp, ref in zip(hypotheses, references):
        h, r = _tokens(hyp), _tokens(ref)
        if not h or not r:
            scores.append(0.0)
            continue
        hc, rc = Counter(h), Counter(r)
        matches = sum(min(c, rc[w]) for w, c in hc.items())
        if matches == 0:
            scores.append(0.0)
            continue
        prec = matches / len(h)
        rec = matches / len(r)
        fmean = (prec * rec) / (alpha * prec + (1 - alpha) * rec)
        # chunk penalty approximated by number of matched-word runs
        chunks = max(1, matches // 2)
        penalty = gamma * (chunks / matches) ** 3
        scores.append(fmean * (1 - penalty))
    return sum(scores) / len(scores) if scores else float("nan")


# ---- CIDEr -----------------------------------------------------------------
def cider(hypotheses: Sequence[str], references: Sequence[str], max_n: int = 4) -> float:
    """CIDEr-D-style tf-idf n-gram cosine similarity averaged over n=1..max_n."""
    if not hypotheses:
        return float("nan")
    # document frequency over references
    doc_freq: list[Counter] = [Counter() for _ in range(max_n)]
    ref_ngrams_all = []
    for ref in references:
        r = _tokens(ref)
        per_n = []
        for n in range(1, max_n + 1):
            ng = _ngrams(r, n)
            per_n.append(ng)
            for g in ng:
                doc_freq[n - 1][g] += 1
        ref_ngrams_all.append(per_n)
    num_docs = max(len(references), 1)
    log_num = math.log(num_docs)

    def tfidf(ng: Counter, n: int) -> dict:
        out = {}
        total = sum(ng.values()) or 1
        for g, c in ng.items():
            df = doc_freq[n - 1].get(g, 0)
            idf = log_num - math.log(max(df, 1))
            out[g] = (c / total) * idf
        return out

    def cosine(a: dict, b: dict) -> float:
        if not a or not b:
            return 0.0
        dot = sum(a[g] * b.get(g, 0.0) for g in a)
        na = math.sqrt(sum(v * v for v in a.values()))
        nb = math.sqrt(sum(v * v for v in b.values()))
        return dot / (na * nb) if na > 0 and nb > 0 else 0.0

    scores = []
    for hyp, ref_per_n in zip(hypotheses, ref_ngrams_all):
        h = _tokens(hyp)
        per_n_scores = []
        for n in range(1, max_n + 1):
            hv = tfidf(_ngrams(h, n), n)
            rv = tfidf(ref_per_n[n - 1], n)
            per_n_scores.append(cosine(hv, rv))
        scores.append(sum(per_n_scores) / max_n)
    return sum(scores) / len(scores) if scores else float("nan")


# ---- BERTScore (optional) --------------------------------------------------
def bert_score(hypotheses: Sequence[str], references: Sequence[str]) -> float:
    """BERTScore F1 if ``bert_score`` is installed, else ``nan``."""
    try:
        from bert_score import score as _bs  # type: ignore
    except Exception:
        return float("nan")
    _, _, f1 = _bs(list(hypotheses), list(references), lang="en", rescale_with_baseline=True)
    return float(f1.mean().item())


def all_nlg_metrics(hypotheses: Sequence[str], references: Sequence[str]) -> dict[str, float]:
    return {
        "report.bleu": corpus_bleu(hypotheses, references),
        "report.rouge_l": rouge_l(hypotheses, references),
        "report.meteor": meteor_lite(hypotheses, references),
        "report.cider": cider(hypotheses, references),
        "report.bertscore": bert_score(hypotheses, references),
    }
