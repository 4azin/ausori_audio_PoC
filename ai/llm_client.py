"""Gemini 호출 가시성 래퍼.

사용법:
    from llm_client import generate_content, get_tracker

    response = generate_content(
        client, model=GEMINI_MODEL, contents=contents,
        stage="foley", scene_id=3,
    )

    # job 종료 시
    tracker = get_tracker()
    print(tracker.summary())
    tracker.reset()

- `response.usage_metadata` 를 파싱해 호출별/누적 토큰·지연·비용을 기록한다.
- 호출별로 JSONL 한 줄을 stdout 과 (옵션) 파일에 기록한다.
- 스레드 안전한 단일 전역 tracker 를 제공한다.
"""

from __future__ import annotations

import json
import os
import threading
import time
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any


# ---------------------------------------------------------------------------
# 가격표 (USD / 1M tokens). 필요 시 조정.
#   ref: https://ai.google.dev/gemini-api/docs/pricing
# ---------------------------------------------------------------------------
PRICING: dict[str, dict[str, float]] = {
    "gemini-3-flash-preview":  {"input": 0.30, "output": 2.50, "cached": 0.075},
    "gemini-3.1-pro-preview":  {"input": 2.00, "output": 12.00, "cached": 0.50},
    "gemini-2.5-flash":        {"input": 0.30, "output": 2.50, "cached": 0.075},
    "gemini-2.5-pro":          {"input": 1.25, "output": 10.00, "cached": 0.31},
}


def _price_for(model: str) -> dict[str, float]:
    """정확 매칭 → prefix 매칭 순으로 가격 탐색. 없으면 0."""
    if model in PRICING:
        return PRICING[model]
    for key, val in PRICING.items():
        if model.startswith(key) or key.startswith(model):
            return val
    return {"input": 0.0, "output": 0.0, "cached": 0.0}


# ---------------------------------------------------------------------------
# 기록 단위
# ---------------------------------------------------------------------------

@dataclass
class CallRecord:
    stage: str
    model: str
    prompt_tokens: int
    output_tokens: int
    cached_tokens: int
    total_tokens: int
    latency_sec: float
    cost_usd: float
    scene_id: int | None = None
    extra: dict[str, Any] = field(default_factory=dict)


@dataclass
class UsageTracker:
    records: list[CallRecord] = field(default_factory=list)
    _lock: threading.Lock = field(default_factory=threading.Lock)

    def add(self, rec: CallRecord) -> None:
        with self._lock:
            self.records.append(rec)

    def reset(self) -> None:
        with self._lock:
            self.records.clear()

    def totals(self) -> dict[str, Any]:
        with self._lock:
            recs = list(self.records)
        by_stage: dict[str, dict[str, float]] = {}
        for r in recs:
            s = by_stage.setdefault(
                r.stage,
                {"calls": 0, "prompt": 0, "output": 0, "cached": 0,
                 "total": 0, "latency_sec": 0.0, "cost_usd": 0.0},
            )
            s["calls"] += 1
            s["prompt"] += r.prompt_tokens
            s["output"] += r.output_tokens
            s["cached"] += r.cached_tokens
            s["total"] += r.total_tokens
            s["latency_sec"] += r.latency_sec
            s["cost_usd"] += r.cost_usd

        agg = {
            "calls": len(recs),
            "prompt": sum(r.prompt_tokens for r in recs),
            "output": sum(r.output_tokens for r in recs),
            "cached": sum(r.cached_tokens for r in recs),
            "total": sum(r.total_tokens for r in recs),
            "latency_sec": sum(r.latency_sec for r in recs),
            "cost_usd": sum(r.cost_usd for r in recs),
        }
        return {"overall": agg, "by_stage": by_stage}

    def summary(self) -> str:
        t = self.totals()
        o = t["overall"]
        lines = [
            "=== LLM Usage Summary ===",
            f"calls={o['calls']}  prompt={o['prompt']}  output={o['output']}  "
            f"cached={o['cached']}  total={o['total']}  "
            f"latency={o['latency_sec']:.1f}s  cost=${o['cost_usd']:.4f}",
            "--- by stage ---",
        ]
        for stage, s in t["by_stage"].items():
            lines.append(
                f"  {stage:20s} calls={s['calls']}  prompt={s['prompt']}  "
                f"output={s['output']}  total={s['total']}  "
                f"latency={s['latency_sec']:.1f}s  cost=${s['cost_usd']:.4f}"
            )
        return "\n".join(lines)


_tracker = UsageTracker()


def get_tracker() -> UsageTracker:
    return _tracker


# ---------------------------------------------------------------------------
# 로그 싱크
# ---------------------------------------------------------------------------

_LOG_PATH = os.getenv("LLM_USAGE_LOG")
_log_lock = threading.Lock()


def _emit(record: CallRecord) -> None:
    payload = {"ts": time.time(), **asdict(record)}
    line = json.dumps(payload, ensure_ascii=False)
    print(f"[llm] {line}")
    if _LOG_PATH:
        with _log_lock:
            Path(_LOG_PATH).parent.mkdir(parents=True, exist_ok=True)
            with open(_LOG_PATH, "a", encoding="utf-8") as f:
                f.write(line + "\n")


# ---------------------------------------------------------------------------
# 래퍼 호출
# ---------------------------------------------------------------------------

def generate_content(
    client,
    *,
    model: str,
    contents,
    stage: str,
    scene_id: int | None = None,
    **kwargs,
):
    """`client.models.generate_content` 대체 래퍼.

    원 응답 객체를 그대로 돌려주되, usage_metadata 를 파싱해 기록한다.
    """
    t0 = time.perf_counter()
    response = client.models.generate_content(model=model, contents=contents, **kwargs)
    latency = time.perf_counter() - t0

    um = getattr(response, "usage_metadata", None)
    prompt = int(getattr(um, "prompt_token_count", 0) or 0) if um else 0
    output = int(getattr(um, "candidates_token_count", 0) or 0) if um else 0
    cached = int(getattr(um, "cached_content_token_count", 0) or 0) if um else 0
    total = int(getattr(um, "total_token_count", 0) or 0) if um else (prompt + output)

    price = _price_for(model)
    billable_prompt = max(prompt - cached, 0)
    cost = (
        billable_prompt * price["input"]
        + cached * price["cached"]
        + output * price["output"]
    ) / 1_000_000

    rec = CallRecord(
        stage=stage,
        model=model,
        prompt_tokens=prompt,
        output_tokens=output,
        cached_tokens=cached,
        total_tokens=total,
        latency_sec=latency,
        cost_usd=cost,
        scene_id=scene_id,
    )
    _tracker.add(rec)
    _emit(rec)
    return response
