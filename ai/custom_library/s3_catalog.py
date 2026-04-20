from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from pathlib import PurePosixPath

import boto3

from settings import (
    AWS_ACCESS_KEY_ID,
    AWS_REGION,
    AWS_S3_BUCKET,
    AWS_S3_PREFIXES,
    AWS_SECRET_ACCESS_KEY,
)


@dataclass(frozen=True)
class S3AudioObject:
    bucket: str
    key: str
    filename: str
    size: int | None = None


def _client():
    if not AWS_S3_BUCKET:
        raise RuntimeError("AWS_S3_BUCKET is required to build the S3 audio catalog")
    return boto3.client(
        "s3",
        region_name=AWS_REGION,
        aws_access_key_id=AWS_ACCESS_KEY_ID or None,
        aws_secret_access_key=AWS_SECRET_ACCESS_KEY or None,
    )


def iter_audio_objects() -> list[S3AudioObject]:
    client = _client()
    prefixes = AWS_S3_PREFIXES or [""]
    objects: list[S3AudioObject] = []

    for prefix in prefixes:
        paginator = client.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=AWS_S3_BUCKET, Prefix=prefix):
            for item in page.get("Contents", []):
                key = item["Key"]
                filename = PurePosixPath(key).name
                if not filename:
                    continue
                objects.append(
                    S3AudioObject(
                        bucket=AWS_S3_BUCKET,
                        key=key,
                        filename=filename,
                        size=item.get("Size"),
                    )
                )
    return objects


def build_s3_filename_index() -> dict[str, list[S3AudioObject]]:
    index: dict[str, list[S3AudioObject]] = defaultdict(list)
    for obj in iter_audio_objects():
        index[obj.filename.lower()].append(obj)
    return {filename: sorted(items, key=lambda item: item.key) for filename, items in index.items()}

