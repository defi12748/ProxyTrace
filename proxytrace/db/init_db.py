from __future__ import annotations

import asyncio

from proxytrace.contracts.registry import ensure_default_contracts
from proxytrace.db.session import SessionLocal, init_models


async def main() -> None:
    await init_models()
    async with SessionLocal() as session:
        await ensure_default_contracts(session)
        await session.commit()
    print("ProxyTrace database schema and default tool contracts are ready.")


if __name__ == "__main__":
    asyncio.run(main())

