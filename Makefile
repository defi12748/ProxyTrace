# ProxyTrace – local dev convenience targets
# Requires: Python 3.11+, a virtual environment at .venv/, and DATABASE_URL in .env

.PHONY: install migrate seed dev test test-postgres lint

install:
	python -m venv .venv
	.venv/Scripts/pip install -e ".[dev]"

migrate:
	.venv/Scripts/alembic upgrade head

# Seed default tool contracts after running migrations
seed:
	.venv/Scripts/python -m proxytrace.db.init_db

# Full local bootstrap: migrate then seed
bootstrap: migrate seed

dev:
	.venv/Scripts/uvicorn proxytrace.proxy.main:app --reload

test:
	.venv/Scripts/pytest tests/ -v

test-postgres:
	powershell -ExecutionPolicy Bypass -File scripts/test-with-postgres.ps1

# Show pending migrations without applying them
migrate-check:
	.venv/Scripts/alembic current
	.venv/Scripts/alembic history --verbose

# Roll back the last applied migration
downgrade:
	.venv/Scripts/alembic downgrade -1
