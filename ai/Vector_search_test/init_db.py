from __future__ import annotations

from pathlib import Path

from db import get_conn


def main() -> None:
    schema_path = Path(__file__).with_name("schema.sql")
    sql = schema_path.read_text(encoding="utf-8")

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
        conn.commit()

    print("schema initialized")


if __name__ == "__main__":
    main()

