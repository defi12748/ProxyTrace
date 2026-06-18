import asyncio
from proxytrace.db.models import Base
from proxytrace.settings import get_settings
from sqlalchemy.ext.asyncio import create_async_engine

async def main():
    engine = create_async_engine(get_settings().async_database_url)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.execute(org_sqlalchemy_text("DROP TABLE IF EXISTS alembic_version CASCADE"))
    await engine.dispose()
    print("Tables dropped.")

if __name__ == "__main__":
    from sqlalchemy import text as org_sqlalchemy_text
    asyncio.run(main())
