from proxytrace.settings import Settings


def test_postgres_url_is_normalized_for_asyncpg_and_neon_sslmode() -> None:
    settings = Settings(
        database_url="postgresql://user:pass@example.neon.tech/proxytrace?sslmode=require"
    )

    assert settings.async_database_url == (
        "postgresql+asyncpg://user:pass@example.neon.tech/proxytrace?ssl=require"
    )


def test_default_gemini_model_is_flash_lite() -> None:
    settings = Settings(database_url="postgresql://user:pass@example.neon.tech/proxytrace")

    assert settings.gemini_model == "gemini-3.1-flash-lite"
