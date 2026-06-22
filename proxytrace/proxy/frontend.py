from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from starlette.responses import FileResponse


def _is_relative_to(path: Path, parent: Path) -> bool:
    try:
        path.relative_to(parent)
    except ValueError:
        return False
    return True


def mount_frontend(app: FastAPI, dist_dir: Path) -> bool:
    """Serve the built Vite app when the configured dist directory is present."""
    dist_dir = dist_dir.resolve()
    index_path = dist_dir / "index.html"
    if not index_path.is_file():
        return False

    assets_dir = dist_dir / "assets"
    if assets_dir.is_dir():
        app.mount(
            "/assets",
            StaticFiles(directory=assets_dir),
            name="frontend-assets",
        )

    @app.get("/", include_in_schema=False)
    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_frontend(full_path: str = "") -> FileResponse:
        requested_path = (dist_dir / full_path).resolve()
        if (
            full_path
            and _is_relative_to(requested_path, dist_dir)
            and requested_path.is_file()
        ):
            return FileResponse(requested_path)

        if Path(full_path).suffix:
            raise HTTPException(status_code=404, detail="Static file not found")

        return FileResponse(index_path)

    return True
