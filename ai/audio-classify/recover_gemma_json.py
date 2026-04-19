import argparse
import json
import re
from pathlib import Path


DEFAULT_INPUT = r"C:\Users\SSAFY\Desktop\sound_data_zip\sound_library\result\gemma4_foley_eval.json"
DEFAULT_OUTPUT = r"C:\Users\SSAFY\Desktop\sound_data_zip\sound_library\result\gemma4_foley_eval_recovered.json"

TAG_KEYS = [
    "object",
    "action",
    "material",
    "texture",
    "environment",
    "temporal",
    "editorial_role",
]


def strip_code_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        return "\n".join(lines).strip()
    return text


def extract_json_prefix(text: str) -> str:
    start = text.find("{")
    if start == -1:
        return text.strip()

    depth_curly = 0
    depth_square = 0
    in_string = False
    escape = False
    last_balanced_end = -1

    for index, char in enumerate(text[start:], start=start):
        if escape:
            escape = False
            continue
        if char == "\\":
            escape = True
            continue
        if char == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if char == "{":
            depth_curly += 1
        elif char == "}":
            depth_curly -= 1
        elif char == "[":
            depth_square += 1
        elif char == "]":
            depth_square -= 1

        if depth_curly == 0 and depth_square == 0:
            last_balanced_end = index + 1

    if last_balanced_end != -1:
        return text[start:last_balanced_end].strip()
    return text[start:].strip()


def parse_json_lenient(text: str):
    cleaned = extract_json_prefix(strip_code_fences(text))
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return None


def extract_string_field(text: str, key: str):
    pattern = rf'"{re.escape(key)}"\s*:\s*"((?:\\.|[^"\\])*)'
    match = re.search(pattern, text, re.DOTALL)
    if not match:
        return None
    value = match.group(1)
    return bytes(value, "utf-8").decode("unicode_escape")


def extract_float_field(text: str, key: str):
    pattern = rf'"{re.escape(key)}"\s*:\s*([0-9]+(?:\.[0-9]+)?)'
    match = re.search(pattern, text)
    if not match:
        return None
    return float(match.group(1))


def extract_list_field(text: str, key: str):
    pattern = rf'"{re.escape(key)}"\s*:\s*\[(.*?)\]'
    match = re.search(pattern, text, re.DOTALL)
    if not match:
        return None
    items = re.findall(r'"((?:\\.|[^"\\])*)"', match.group(1))
    values = []
    for item in items:
        try:
            values.append(bytes(item, "utf-8").decode("unicode_escape"))
        except UnicodeDecodeError:
            values.append(item)
    return values


def extract_realism_field(text: str):
    return extract_string_field(text, "realism")


def recover_tags(text: str):
    tags = {}
    for key in TAG_KEYS:
        values = extract_list_field(text, key)
        if values:
            tags[key] = values
    realism = extract_realism_field(text)
    if realism:
        tags["realism"] = realism
    return tags


def recover_record(record: dict):
    raw = record.get("raw_response") or record.get("long_caption_en") or record.get("short_caption_en") or ""
    raw = strip_code_fences(raw)
    parsed = parse_json_lenient(raw)

    if isinstance(parsed, dict):
        recovered = dict(record)
        recovered.update(parsed)
        recovered["recovery_status"] = "parsed_json"
        recovered["parse_error"] = False
        return recovered

    recovered = dict(record)
    recovered_fields = {}

    primary_class = extract_string_field(raw, "primary_class")
    if primary_class:
        recovered_fields["primary_class"] = primary_class

    class_confidence = extract_float_field(raw, "class_confidence")
    if class_confidence is not None:
        recovered_fields["class_confidence"] = class_confidence

    short_caption = extract_string_field(raw, "short_caption_en")
    if short_caption:
        recovered_fields["short_caption_en"] = short_caption

    long_caption = extract_string_field(raw, "long_caption_en")
    if long_caption:
        recovered_fields["long_caption_en"] = long_caption

    tags = recover_tags(raw)
    if tags:
        recovered_fields["tags_structured"] = tags

    if recovered_fields:
        recovered.update(recovered_fields)
        recovered["recovery_status"] = "partial_fields"
        recovered["parse_error"] = False
        return recovered

    recovered["recovery_status"] = "unrecovered"
    return recovered


def main():
    parser = argparse.ArgumentParser(description="Recover truncated Gemma JSON outputs.")
    parser.add_argument("--input", default=DEFAULT_INPUT, help="Input JSON file path")
    parser.add_argument("--output", default=DEFAULT_OUTPUT, help="Recovered JSON file path")
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)

    records = json.loads(input_path.read_text(encoding="utf-8"))

    recovered_records = []
    parsed_json = 0
    partial_fields = 0
    unrecovered = 0

    for record in records:
        if record.get("error"):
            updated = dict(record)
            updated["recovery_status"] = "skipped_error"
        elif record.get("parse_error"):
            updated = recover_record(record)
        else:
            updated = dict(record)
            updated["recovery_status"] = "already_valid"

        status = updated.get("recovery_status")
        if status == "parsed_json":
            parsed_json += 1
        elif status == "partial_fields":
            partial_fields += 1
        elif status == "unrecovered":
            unrecovered += 1

        recovered_records.append(updated)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(recovered_records, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Input:              {input_path}")
    print(f"Output:             {output_path}")
    print(f"Total records:      {len(records)}")
    print(f"Recovered as JSON:  {parsed_json}")
    print(f"Recovered partial:  {partial_fields}")
    print(f"Still unrecovered:  {unrecovered}")


if __name__ == "__main__":
    main()
