"""Gemma 4 E4B 오디오 분류 성능 체크 스크립트.

Gemma 4 E4B (오디오 네이티브 지원)를 transformers로 로컬 실행하여
사운드 라이브러리 파일의 분류/묘사 품질을 확인합니다.

핵심:
  - 실제 오디오 바이트를 모델에 전송
  - 파일명은 보조 힌트로만 제공
  - 폴더 구조는 Ground Truth로 사용하지 않음

환경:
  - NVIDIA 4070 (8GB VRAM) → 4-bit 양자화 필수
  - HuggingFace 토큰 필요 (게이트 모델)

사전 준비:
  1. huggingface-cli login 또는 .env에 HF_TOKEN 설정
  2. https://huggingface.co/google/gemma-4-E4B-it 에서 라이선스 동의
  3. pip install bitsandbytes  (4-bit 양자화)

사용법:
  conda activate audio-poc
  $env:PYTHONIOENCODING="utf-8"
  python test_gemma4_eval.py
"""

import json
import os
import re
import sys
import time
import types
import csv
from pathlib import Path

import torch
from dotenv import load_dotenv

load_dotenv()

# ── 설정 ────────────────────────────────────────────────────
MODEL_ID = os.getenv("CAPTION_MODEL", "google/gemma-4-E4B-it")
HF_TOKEN = os.getenv("HF_TOKEN", "")
USE_4BIT = os.getenv("USE_4BIT", "true").lower() == "true"
FORCE_SINGLE_GPU = os.getenv("FORCE_SINGLE_GPU", "true").lower() == "true"
SOUND_LIB_ROOT = os.getenv(
    "SOUND_LIBRARY_ROOT",
    r"C:\Users\SSAFY\Desktop\sound_data_zip\sound_library\test",
).strip('"')
OUTPUT_JSON_PATH = os.getenv("OUTPUT_JSON_PATH", "").strip('"').replace("\\", "/")
FILTERED_CSV_PATH = os.getenv("FILTERED_CSV_PATH", "").strip('"').replace("\\", "/")
MAX_FILE_SIZE_MB = 50
MAX_NEW_TOKENS = int(os.getenv("MAX_NEW_TOKENS", "192"))
SAMPLE_COUNT = int(os.getenv("SAMPLE_COUNT", "10"))

SUPPORTED_EXT = {".wav", ".mp3", ".ogg", ".flac", ".aif"}

SYSTEM_PROMPT = """\
You are an expert sound librarian and audio engineer.
Listen to this audio file carefully and analyze what you actually HEAR.

The filename is provided only as a minor hint — your analysis must be based
primarily on the audio content itself.

Based on what you HEAR, produce a JSON with these fields:

1. primary_class: One of: foley, sfx, ambience, cinematic, music, dialogue_vo
2. class_confidence: 0.0 ~ 1.0
3. short_caption_en: A compact English description for retrieval/search.
4. long_caption_en: A detailed English description of the sound.
5. tags_structured: JSON object with:
   - object: physical objects heard or implied (list)
   - action: actions producing the sound (list)
   - material: materials involved (list)
   - texture: acoustic texture descriptors (list)
   - environment: recording environment hints (list)
   - temporal: temporal pattern (list)
   - editorial_role: editorial use (list)
   - realism: "realistic" or "designed" (string)

RULES:
- Output ONLY valid JSON. No markdown, no explanation.
- Be specific — describe what you actually HEAR, not what you guess from the filename.
- All tag values: lowercase, underscore_separated.
"""


def _record_key(record: dict) -> str:
    return f"{record.get('folder_path', '')}/{record.get('filename', '')}".replace("\\", "/")


def load_existing_results(output_path: Path) -> list[dict]:
    if not output_path.exists():
        return []
    try:
        data = json.loads(output_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        print(f"  WARNING: Existing output JSON is invalid and will be ignored: {output_path}")
        return []
    if not isinstance(data, list):
        print(f"  WARNING: Existing output JSON is not a list and will be ignored: {output_path}")
        return []
    return data


def save_results(output_path: Path, results: list[dict]):
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(results, indent=2, ensure_ascii=False), encoding="utf-8")


def load_existing_filtered_rows(csv_path: Path) -> list[dict]:
    if not csv_path.exists():
        return []
    with csv_path.open("r", encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def save_filtered_rows(csv_path: Path, rows: list[dict]):
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = ["file_path", "filename", "folder_path", "extension", "file_size_mb", "reason"]
    with csv_path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def _extract_string_field(text: str, key: str):
    match = re.search(rf'"{re.escape(key)}"\s*:\s*"((?:\\.|[^"\\])*)', text, re.DOTALL)
    if not match:
        return None
    value = match.group(1)
    try:
        return bytes(value, "utf-8").decode("unicode_escape")
    except UnicodeDecodeError:
        return value


def _extract_float_field(text: str, key: str):
    match = re.search(rf'"{re.escape(key)}"\s*:\s*([0-9]+(?:\.[0-9]+)?)', text)
    if not match:
        return None
    return float(match.group(1))


def _extract_list_field(text: str, key: str):
    match = re.search(rf'"{re.escape(key)}"\s*:\s*\[(.*?)\]', text, re.DOTALL)
    if not match:
        return None
    values = re.findall(r'"((?:\\.|[^"\\])*)"', match.group(1))
    parsed = []
    for value in values:
        try:
            parsed.append(bytes(value, "utf-8").decode("unicode_escape"))
        except UnicodeDecodeError:
            parsed.append(value)
    return parsed


def _recover_partial_json(raw: str) -> dict:
    recovered = {}

    primary_class = _extract_string_field(raw, "primary_class")
    if primary_class:
        recovered["primary_class"] = primary_class

    class_confidence = _extract_float_field(raw, "class_confidence")
    if class_confidence is not None:
        recovered["class_confidence"] = class_confidence

    short_caption = _extract_string_field(raw, "short_caption_en")
    if short_caption:
        recovered["short_caption_en"] = short_caption

    long_caption = _extract_string_field(raw, "long_caption_en")
    if long_caption:
        recovered["long_caption_en"] = long_caption

    tags = {}
    for key in ["object", "action", "material", "texture", "environment", "temporal", "editorial_role"]:
        values = _extract_list_field(raw, key)
        if values:
            tags[key] = values
    realism = _extract_string_field(raw, "realism")
    if realism:
        tags["realism"] = realism
    if tags:
        recovered["tags_structured"] = tags

    return recovered


def patch_gemma4_audio_quantization_bug():
    """Work around Gemma4 audio path using torch.finfo on quantized integer weights."""
    try:
        from transformers.models.gemma4.modeling_gemma4 import (
            Gemma4AudioFeedForward,
            Gemma4AudioLayer,
            Gemma4AudioLightConv1d,
        )
    except Exception:
        return

    if getattr(Gemma4AudioFeedForward.forward, "_audio_poc_patched", False):
        return

    def patched_ffn_forward(self, hidden_states: torch.Tensor) -> torch.Tensor:
        weight_dtype = self.ffw_layer_1.linear.weight.dtype
        clip_dtype = weight_dtype if torch.is_floating_point(self.ffw_layer_1.linear.weight) else hidden_states.dtype
        gradient_clipping = min(self.gradient_clipping, torch.finfo(clip_dtype).max)

        residual = hidden_states
        hidden_states = torch.clamp(hidden_states, -gradient_clipping, gradient_clipping)
        hidden_states = self.pre_layer_norm(hidden_states)

        hidden_states = self.ffw_layer_1(hidden_states)
        hidden_states = self.act_fn(hidden_states)
        hidden_states = self.ffw_layer_2(hidden_states)

        hidden_states = torch.clamp(hidden_states, -gradient_clipping, gradient_clipping)
        hidden_states = self.post_layer_norm(hidden_states)
        hidden_states *= self.post_layer_scale
        hidden_states += residual
        return hidden_states

    def patched_lconv_forward(self, hidden_states: torch.Tensor) -> torch.Tensor:
        residual = hidden_states

        hidden_states = self.pre_layer_norm(hidden_states)
        hidden_states = self.linear_start(hidden_states)
        hidden_states = torch.nn.functional.glu(hidden_states, dim=-1)
        hidden_states = self.depthwise_conv1d(hidden_states.transpose(1, 2)).transpose(1, 2)

        weight = self.linear_start.linear.weight
        clip_dtype = weight.dtype if torch.is_floating_point(weight) else hidden_states.dtype
        gradient_clipping = min(self.gradient_clipping, torch.finfo(clip_dtype).max)
        hidden_states = torch.clamp(hidden_states, -gradient_clipping, gradient_clipping)
        hidden_states = self.conv_norm(hidden_states)

        hidden_states = self.act_fn(hidden_states)
        hidden_states = self.linear_end(hidden_states)
        hidden_states += residual
        return hidden_states

    def patched_layer_forward(
        self,
        hidden_states: torch.Tensor,
        attention_mask: torch.BoolTensor | None,
        position_embeddings: torch.Tensor,
        **kwargs,
    ) -> torch.Tensor:
        norm_weight = self.norm_pre_attn.weight
        clip_dtype = norm_weight.dtype if torch.is_floating_point(norm_weight) else hidden_states.dtype
        gradient_clipping = min(self.gradient_clipping, torch.finfo(clip_dtype).max)

        hidden_states = self.feed_forward1(hidden_states)
        residual = hidden_states

        hidden_states = torch.clamp(hidden_states, -gradient_clipping, gradient_clipping)
        hidden_states = self.norm_pre_attn(hidden_states)

        hidden_states, _ = self.self_attn(
            hidden_states=hidden_states,
            position_embeddings=position_embeddings,
            attention_mask=attention_mask,
        )

        hidden_states = torch.clamp(hidden_states, -gradient_clipping, gradient_clipping)
        hidden_states = self.norm_post_attn(hidden_states)
        hidden_states += residual

        hidden_states = self.lconv1d(hidden_states)
        hidden_states = self.feed_forward2(hidden_states)

        hidden_states = torch.clamp(hidden_states, -gradient_clipping, gradient_clipping)
        hidden_states = self.norm_out(hidden_states)
        return hidden_states

    patched_ffn_forward._audio_poc_patched = True
    patched_lconv_forward._audio_poc_patched = True
    patched_layer_forward._audio_poc_patched = True
    Gemma4AudioFeedForward.forward = patched_ffn_forward
    Gemma4AudioLightConv1d.forward = patched_lconv_forward
    Gemma4AudioLayer.forward = patched_layer_forward


def patch_loaded_gemma4_audio_modules(model):
    """Patch instantiated Gemma4 audio FFN modules in case class patching was bypassed."""
    def patched_ffn_forward(self, hidden_states: torch.Tensor) -> torch.Tensor:
        weight = self.ffw_layer_1.linear.weight
        clip_dtype = weight.dtype if torch.is_floating_point(weight) else hidden_states.dtype
        gradient_clipping = min(self.gradient_clipping, torch.finfo(clip_dtype).max)

        residual = hidden_states
        hidden_states = torch.clamp(hidden_states, -gradient_clipping, gradient_clipping)
        hidden_states = self.pre_layer_norm(hidden_states)

        hidden_states = self.ffw_layer_1(hidden_states)
        hidden_states = self.act_fn(hidden_states)
        hidden_states = self.ffw_layer_2(hidden_states)

        hidden_states = torch.clamp(hidden_states, -gradient_clipping, gradient_clipping)
        hidden_states = self.post_layer_norm(hidden_states)
        hidden_states *= self.post_layer_scale
        hidden_states += residual
        return hidden_states

    def patched_lconv_forward(self, hidden_states: torch.Tensor) -> torch.Tensor:
        residual = hidden_states

        hidden_states = self.pre_layer_norm(hidden_states)
        hidden_states = self.linear_start(hidden_states)
        hidden_states = torch.nn.functional.glu(hidden_states, dim=-1)
        hidden_states = self.depthwise_conv1d(hidden_states.transpose(1, 2)).transpose(1, 2)

        weight = self.linear_start.linear.weight
        clip_dtype = weight.dtype if torch.is_floating_point(weight) else hidden_states.dtype
        gradient_clipping = min(self.gradient_clipping, torch.finfo(clip_dtype).max)
        hidden_states = torch.clamp(hidden_states, -gradient_clipping, gradient_clipping)
        hidden_states = self.conv_norm(hidden_states)

        hidden_states = self.act_fn(hidden_states)
        hidden_states = self.linear_end(hidden_states)
        hidden_states += residual
        return hidden_states

    def patched_layer_forward(
        self,
        hidden_states: torch.Tensor,
        attention_mask: torch.BoolTensor | None,
        position_embeddings: torch.Tensor,
        **kwargs,
    ) -> torch.Tensor:
        norm_weight = self.norm_pre_attn.weight
        clip_dtype = norm_weight.dtype if torch.is_floating_point(norm_weight) else hidden_states.dtype
        gradient_clipping = min(self.gradient_clipping, torch.finfo(clip_dtype).max)

        hidden_states = self.feed_forward1(hidden_states)
        residual = hidden_states

        hidden_states = torch.clamp(hidden_states, -gradient_clipping, gradient_clipping)
        hidden_states = self.norm_pre_attn(hidden_states)

        hidden_states, _ = self.self_attn(
            hidden_states=hidden_states,
            position_embeddings=position_embeddings,
            attention_mask=attention_mask,
        )

        hidden_states = torch.clamp(hidden_states, -gradient_clipping, gradient_clipping)
        hidden_states = self.norm_post_attn(hidden_states)
        hidden_states += residual

        hidden_states = self.lconv1d(hidden_states)
        hidden_states = self.feed_forward2(hidden_states)

        hidden_states = torch.clamp(hidden_states, -gradient_clipping, gradient_clipping)
        hidden_states = self.norm_out(hidden_states)
        return hidden_states

    patched_counts = {"ffn": 0, "lconv": 0, "layer": 0}
    for module in model.modules():
        if module.__class__.__name__ == "Gemma4AudioFeedForward":
            module.forward = types.MethodType(patched_ffn_forward, module)
            patched_counts["ffn"] += 1
        elif module.__class__.__name__ == "Gemma4AudioLightConv1d":
            module.forward = types.MethodType(patched_lconv_forward, module)
            patched_counts["lconv"] += 1
        elif module.__class__.__name__ == "Gemma4AudioLayer":
            module.forward = types.MethodType(patched_layer_forward, module)
            patched_counts["layer"] += 1

    total_patched = sum(patched_counts.values())
    if total_patched:
        print(
            "  Patched Gemma4 audio modules for 4-bit compatibility "
            f"(ffn={patched_counts['ffn']}, lconv={patched_counts['lconv']}, layer={patched_counts['layer']})"
        )


# ── 파일 수집 ───────────────────────────────────────────────
def collect_diverse_samples(root: str, count: int = 10) -> tuple[list[dict], list[dict], dict]:
    root_path = Path(root)
    all_files = []
    filtered_out = []
    stats = {
        "total_files_seen": 0,
        "supported_files": 0,
        "filtered_unsupported_extension": 0,
        "filtered_too_large": 0,
    }
    for audio_file in root_path.rglob("*"):
        if not audio_file.is_file():
            continue
        stats["total_files_seen"] += 1
        size_mb = audio_file.stat().st_size / 1024 / 1024
        rel = audio_file.relative_to(root_path)
        base_info = {
            "file_path": str(audio_file),
            "filename": audio_file.name,
            "file_size_mb": round(size_mb, 2),
            "folder_path": str(rel.parent),
            "extension": audio_file.suffix.lower(),
        }
        if audio_file.suffix.lower() not in SUPPORTED_EXT:
            stats["filtered_unsupported_extension"] += 1
            filtered_out.append({
                **base_info,
                "reason": "unsupported_extension",
            })
            continue
        if size_mb > MAX_FILE_SIZE_MB:
            stats["filtered_too_large"] += 1
            filtered_out.append({
                **base_info,
                "reason": f"file_too_large>{MAX_FILE_SIZE_MB}MB",
            })
            continue
        stats["supported_files"] += 1
        all_files.append(base_info)

    if count <= 0 or len(all_files) <= count:
        return all_files, filtered_out, stats

    by_major = {}
    for f in all_files:
        parts = f["folder_path"].replace("\\", "/").split("/")
        major = parts[0] if parts else "root"
        by_major.setdefault(major, []).append(f)

    selected = []
    per_major = max(1, count // max(len(by_major), 1))
    for major, files in sorted(by_major.items()):
        step = max(1, len(files) // per_major)
        for i in range(0, len(files), step):
            if len(selected) >= count:
                break
            selected.append(files[i])
        if len(selected) >= count:
            break
    return selected[:count], filtered_out, stats


# ── 모델 로드 ──────────────────────────────────────────────
def load_model():
    from transformers import AutoProcessor, AutoModelForMultimodalLM

    patch_gemma4_audio_quantization_bug()

    print(f"  Model:  {MODEL_ID}")
    print(f"  4-bit:  {USE_4BIT}")
    print(f"  Force single GPU: {FORCE_SINGLE_GPU}")
    print(f"  Max new tokens: {MAX_NEW_TOKENS}")
    print(f"  GPU:    {torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU'}")
    print(f"  VRAM:   {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB" if torch.cuda.is_available() else "")

    token = HF_TOKEN if HF_TOKEN else None

    processor = AutoProcessor.from_pretrained(MODEL_ID, token=token)

    if USE_4BIT and torch.cuda.is_available():
        from transformers import BitsAndBytesConfig

        device_map = {"": 0} if FORCE_SINGLE_GPU else "auto"
        bnb_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_compute_dtype=torch.bfloat16,
            bnb_4bit_use_double_quant=True,
            bnb_4bit_quant_type="nf4",
        )
        model = AutoModelForMultimodalLM.from_pretrained(
            MODEL_ID,
            quantization_config=bnb_config,
            torch_dtype=torch.bfloat16,
            device_map=device_map,
            token=token,
        )
        print(f"  Loaded with 4-bit quantization (NF4), device_map={device_map}")
    else:
        dtype = torch.bfloat16 if torch.cuda.is_available() else torch.float32
        model = AutoModelForMultimodalLM.from_pretrained(
            MODEL_ID,
            torch_dtype=dtype,
            device_map="auto" if torch.cuda.is_available() else None,
            token=token,
        )
        if not torch.cuda.is_available():
            model = model.to("cpu")
        print(f"  Loaded in {dtype}")

    patch_loaded_gemma4_audio_modules(model)

    return processor, model


def _infer_model_device_and_dtype(model) -> tuple[torch.device, torch.dtype]:
    """Pick a practical execution device and floating-point dtype for inputs."""
    if torch.cuda.is_available():
        hf_device_map = getattr(model, "hf_device_map", None) or {}
        for mapped in hf_device_map.values():
            if isinstance(mapped, int):
                return torch.device(f"cuda:{mapped}"), torch.bfloat16
            if isinstance(mapped, str) and mapped.startswith("cuda"):
                return torch.device(mapped), torch.bfloat16
        return torch.device("cuda:0"), torch.bfloat16

    for param in model.parameters():
        return param.device, param.dtype

    device = getattr(model, "device", torch.device("cpu"))
    dtype = getattr(model, "dtype", torch.float32)
    if not isinstance(device, torch.device):
        device = torch.device(device)
    return device, dtype


def _move_inputs_to_model(inputs, device: torch.device, float_dtype: torch.dtype):
    """Move tensors to the model device while preserving non-floating dtypes."""
    moved = {}
    for key, value in inputs.items():
        if not hasattr(value, "to"):
            moved[key] = value
            continue

        if value.is_floating_point():
            moved[key] = value.to(device=device, dtype=float_dtype)
        else:
            moved[key] = value.to(device=device)
    return moved


# ── 분류 실행 ──────────────────────────────────────────────
def classify_audio(processor, model, audio_path: str, filename: str) -> dict:
    print("  Preparing multimodal inputs...")
    messages = [
        {
            "role": "system",
            "content": [{"type": "text", "text": SYSTEM_PROMPT}],
        },
        {
            "role": "user",
            "content": [
                {"type": "audio", "url": audio_path},
                {"type": "text", "text": f"[Filename hint: {filename}]\n\nAnalyze this audio and output JSON:"},
            ],
        },
    ]

    inputs = processor.apply_chat_template(
        messages,
        tokenize=True,
        return_dict=True,
        return_tensors="pt",
        add_generation_prompt=True,
    )

    # Keep integer tensors intact and only cast actual floating-point features.
    model_device, model_dtype = _infer_model_device_and_dtype(model)
    inputs = _move_inputs_to_model(inputs, model_device, model_dtype)

    input_len = inputs["input_ids"].shape[-1]
    print(f"  Input prepared on {model_device} with model dtype {model_dtype}")
    print(f"  Starting generation (max_new_tokens={MAX_NEW_TOKENS})...")

    with torch.no_grad():
        output = model.generate(
            **inputs,
            max_new_tokens=MAX_NEW_TOKENS,
            do_sample=False,
        )

    print("  Decoding response...")

    raw = processor.decode(output[0][input_len:], skip_special_tokens=True).strip()

    # JSON 파싱 — markdown fence 제거
    if raw.startswith("```"):
        lines = raw.split("\n")
        json_lines = []
        inside = False
        for line in lines:
            stripped = line.strip()
            if stripped.startswith("```") and not inside:
                inside = True
                continue
            elif stripped == "```" and inside:
                break
            elif inside:
                json_lines.append(line)
        raw = "\n".join(json_lines) if json_lines else raw

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        recovered = _recover_partial_json(raw)
        fallback = {
            "primary_class": "unknown",
            "class_confidence": 0.0,
            "short_caption_en": raw[:200],
            "long_caption_en": raw,
            "tags_structured": {},
            "parse_error": True,
            "raw_response": raw[:500],
        }
        fallback.update(recovered)
        return fallback


# ── 메인 ───────────────────────────────────────────────────
def main():
    output_path = Path(OUTPUT_JSON_PATH) if OUTPUT_JSON_PATH else Path(__file__).parent / "eval_gemma4_e4b.json"
    filtered_csv_path = Path(FILTERED_CSV_PATH) if FILTERED_CSV_PATH else output_path.with_name(f"{output_path.stem}_filtered.csv")

    print("=" * 80)
    print("  Gemma 4 E4B — Audio Classification Evaluation")
    print("  Audio bytes -> Local Model (4-bit) -> Classification + Description")
    print("=" * 80)

    # 1. 샘플 수집
    print(f"\n[Step 1] Collecting audio samples from {SOUND_LIB_ROOT}")
    samples, filtered_out, scan_stats = collect_diverse_samples(SOUND_LIB_ROOT, count=SAMPLE_COUNT)
    if SAMPLE_COUNT <= 0:
        print("  Sample mode: all supported files")
    else:
        print(f"  Sample mode: up to {SAMPLE_COUNT} files")
    print(f"  Collected {len(samples)} samples:")
    for s in samples:
        print(f"    {s['filename']:<55} ({s['file_size_mb']:>5.2f} MB)")
    if not samples:
        print("  No supported audio files were found. Check SOUND_LIBRARY_ROOT and file filters.")

    existing_filtered = load_existing_filtered_rows(filtered_csv_path)
    filtered_by_key = {(row.get("file_path", ""), row.get("reason", "")): row for row in existing_filtered}
    for row in filtered_out:
        filtered_by_key[(row.get("file_path", ""), row.get("reason", ""))] = row
    merged_filtered = list(filtered_by_key.values())
    save_filtered_rows(filtered_csv_path, merged_filtered)
    print(f"  Filtered out: {len(filtered_out)} files this scan")
    print(f"  Filter log:   {filtered_csv_path}")

    existing_results = load_existing_results(output_path)
    existing_by_key = {_record_key(r): r for r in existing_results}
    pending_samples = [s for s in samples if _record_key(s) not in existing_by_key]
    results = list(existing_results)

    if existing_results:
        print(f"  Resume mode: loaded {len(existing_results)} existing results from {output_path}")
        print(f"  Remaining:   {len(pending_samples)} files")

    print("  Scan summary:")
    print(f"    Total files seen:        {scan_stats['total_files_seen']}")
    print(f"    Supported + size match:  {scan_stats['supported_files']}")
    print(f"    Filtered unsupported:    {scan_stats['filtered_unsupported_extension']}")
    print(f"    Filtered too large:      {scan_stats['filtered_too_large']}")
    print(f"    Already processed:       {len(existing_results)}")
    print(f"    Will process now:        {len(pending_samples)}")

    # 2. 모델 로드
    print(f"\n[Step 2] Loading model...")
    start_load = time.time()
    processor, model = load_model()
    load_time = time.time() - start_load
    print(f"  Load time: {load_time:.1f}s")

    # 3. 분류 실행
    print(f"\n[Step 3] Running audio classification...")
    if not pending_samples:
        print("  Nothing to do. All collected files already have saved results.")

    for i, sample in enumerate(pending_samples, 1):
        print(f"\n  --- [{i}/{len(pending_samples)}] {sample['filename']} ({sample['file_size_mb']}MB) ---")
        print(f"  Folder: {sample['folder_path']}")

        try:
            start = time.time()
            result = classify_audio(processor, model, sample["file_path"], sample["filename"])
            elapsed = time.time() - start

            cls = result.get("primary_class", "N/A")
            conf = result.get("class_confidence", "?")
            short = result.get("short_caption_en", "N/A")
            long_cap = result.get("long_caption_en", "N/A")
            tags = result.get("tags_structured", {})

            print(f"  Class:       {cls} (conf: {conf})")
            print(f"  Short:       {short}")
            print(f"  Long:        {str(long_cap)[:120]}...")
            print(f"  Object:      {tags.get('object', [])}")
            print(f"  Action:      {tags.get('action', [])}")
            print(f"  Material:    {tags.get('material', [])}")
            print(f"  Texture:     {tags.get('texture', [])}")
            print(f"  Environment: {tags.get('environment', [])}")
            print(f"  Temporal:    {tags.get('temporal', [])}")
            print(f"  Realism:     {tags.get('realism', 'N/A')}")
            print(f"  Time:        {elapsed:.1f}s")

            if result.get("parse_error"):
                print(f"  WARNING:     JSON parse failed")
                print(f"  Raw:         {result.get('raw_response', '')[:200]}")

            results.append({
                "filename": sample["filename"],
                "folder_path": sample["folder_path"],
                "file_path": sample["file_path"],
                "model": MODEL_ID,
                "elapsed_s": round(elapsed, 1),
                **result,
            })

        except Exception as e:
            import traceback
            print(f"  ERROR: {str(e)[:300]}")
            traceback.print_exc()
            results.append({
                "filename": sample["filename"],
                "folder_path": sample["folder_path"],
                "file_path": sample["file_path"],
                "model": MODEL_ID,
                "error": str(e)[:300],
            })

        save_results(output_path, results)
        print(f"  Saved progress: {len(results)} records -> {output_path}")

        # VRAM 사용량 표시
        if torch.cuda.is_available():
            mem = torch.cuda.memory_allocated() / 1e9
            peak = torch.cuda.max_memory_allocated() / 1e9
            print(f"  VRAM:        {mem:.1f} GB (peak: {peak:.1f} GB)")

    # 4. 요약
    valid = [r for r in results if "error" not in r]
    errors = [r for r in results if "error" in r]
    parse_errors = [r for r in valid if r.get("parse_error")]

    print(f"\n{'=' * 80}")
    print(f"  EVALUATION SUMMARY — {MODEL_ID}")
    print(f"{'=' * 80}")
    print(f"  Total:             {len(results)}")
    print(f"  Successful:        {len(valid)}")
    print(f"  Errors:            {len(errors)}")
    print(f"  JSON parse errors: {len(parse_errors)}")
    print(f"  Filtered this run: {len(filtered_out)}")
    print(f"  Filter log CSV:    {filtered_csv_path}")

    if valid:
        avg_time = sum(r["elapsed_s"] for r in valid) / len(valid)
        avg_conf = sum(r.get("class_confidence", 0) or 0 for r in valid) / len(valid)
        class_dist = {}
        for r in valid:
            c = r.get("primary_class", "unknown")
            class_dist[c] = class_dist.get(c, 0) + 1

        print(f"  Avg time:          {avg_time:.1f}s/file")
        print(f"  Avg confidence:    {avg_conf:.2f}")
        print(f"  Class dist:        {class_dist}")

        print(f"\n  {'#':<3} {'File':<45} {'Class':<10} {'Conf':>5} {'Time':>5}  Short Caption")
        print(f"  {'-'*3} {'-'*45} {'-'*10} {'-'*5} {'-'*5}  {'-'*40}")
        for j, r in enumerate(valid, 1):
            cap = str(r.get("short_caption_en", ""))[:40]
            print(f"  {j:<3} {r['filename']:<45} {r.get('primary_class','?'):<10} "
                  f"{r.get('class_confidence',0):>5.2f} {r['elapsed_s']:>5.1f}  {cap}")

    # JSON 저장
    save_results(output_path, results)
    print(f"\n  Results saved: {output_path}")


if __name__ == "__main__":
    main()
