import boto3

from config import (
    AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY,
    AWS_REGION,
    AWS_S3_BUCKET,
)

_s3 = boto3.client(
    "s3",
    region_name=AWS_REGION,
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
)


def download(s3_key: str, local_path: str) -> str:
    """S3에서 파일 다운로드."""
    _s3.download_file(AWS_S3_BUCKET, s3_key, local_path)
    return local_path


def upload(local_path: str, s3_key: str, content_type: str = "application/json") -> str:
    """S3에 파일 업로드."""
    _s3.upload_file(local_path, AWS_S3_BUCKET, s3_key, ExtraArgs={"ContentType": content_type})
    return s3_key
