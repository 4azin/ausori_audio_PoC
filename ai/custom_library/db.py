from __future__ import annotations

from contextlib import contextmanager

import psycopg

from settings import DATABASE_URL


@contextmanager
def get_conn():
    conn = psycopg.connect(DATABASE_URL)
    try:
        yield conn
    finally:
        conn.close()

