from __future__ import annotations

import boto3

from settings import (
    AWS_ACCESS_KEY_ID,
    AWS_REGION,
    AWS_S3_BUCKET,
    AWS_S3_PREFIXES,
    AWS_SECRET_ACCESS_KEY,
)


def main() -> None:
    print(f"AWS_S3_BUCKET={AWS_S3_BUCKET or '<empty>'}")
    print(f"AWS_REGION={AWS_REGION or '<empty>'}")
    print(f"AWS_S3_PREFIXES={AWS_S3_PREFIXES or ['<root>']}")
    print(f"AWS_ACCESS_KEY_ID={'<set>' if AWS_ACCESS_KEY_ID else '<empty>'}")
    print(f"AWS_SECRET_ACCESS_KEY={'<set>' if AWS_SECRET_ACCESS_KEY else '<empty>'}")

    if not AWS_S3_BUCKET:
        print("AWS_S3_BUCKET is empty.")
        return

    client = boto3.client(
        "s3",
        region_name=AWS_REGION,
        aws_access_key_id=AWS_ACCESS_KEY_ID or None,
        aws_secret_access_key=AWS_SECRET_ACCESS_KEY or None,
    )

    print("\nChecking bucket access...")
    client.head_bucket(Bucket=AWS_S3_BUCKET)
    print("head_bucket: ok")

    prefixes = AWS_S3_PREFIXES or [""]
    for prefix in prefixes:
        print(f"\nPrefix: {prefix or '<root>'}")
        page = client.list_objects_v2(
            Bucket=AWS_S3_BUCKET,
            Prefix=prefix,
            MaxKeys=10,
        )
        print(f"KeyCount={page.get('KeyCount', 0)}")
        for item in page.get("Contents", []):
            print(f"  {item['Key']} ({item.get('Size', 0)} bytes)")

    print("\nRoot prefix overview:")
    page = client.list_objects_v2(
        Bucket=AWS_S3_BUCKET,
        Delimiter="/",
        MaxKeys=50,
    )
    print(f"Root KeyCount={page.get('KeyCount', 0)}")
    for item in page.get("CommonPrefixes", []):
        print(f"  prefix {item['Prefix']}")
    for item in page.get("Contents", [])[:10]:
        print(f"  object {item['Key']} ({item.get('Size', 0)} bytes)")


if __name__ == "__main__":
    main()

