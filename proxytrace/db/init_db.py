"""Bootstrap helper for local / dev environments.

This module does NOT create or alter tables.  Schema management is
owned exclusively by Alembic (``alembic upgrade head``).

Run this **after** Alembic has applied migrations to seed the default
tool contracts that the proxy needs on first startup::

    alembic upgrade head
    python -m proxytrace.db.init_db
"""
from __future__ import annotations

import asyncio

from proxytrace.contracts.registry import ensure_default_contracts
from proxytrace.db.session import SessionLocal


async def main() -> None:
    async with SessionLocal() as session:
        await ensure_default_contracts(session)
        await session.commit()
    print("ProxyTrace default tool contracts are ready.")


if __name__ == "__main__":
    asyncio.run(main())
