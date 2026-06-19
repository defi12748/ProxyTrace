from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from proxytrace.proxy.frontend import mount_frontend


def test_mount_frontend_serves_index_and_public_assets(tmp_path) -> None:
    dist = tmp_path / "dist"
    assets = dist / "assets"
    assets.mkdir(parents=True)
    (dist / "index.html").write_text("<div id='root'></div>", encoding="utf-8")
    (dist / "vectors-logo.jfif").write_bytes(b"image")
    (assets / "index.js").write_text("console.log('ok')", encoding="utf-8")

    app = FastAPI()

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    assert mount_frontend(app, dist) is True
    client = TestClient(app)

    assert client.get("/health").json() == {"status": "ok"}
    assert client.get("/").text == "<div id='root'></div>"
    assert client.get("/vectors-logo.jfif").content == b"image"
    assert client.get("/assets/index.js").text == "console.log('ok')"
    assert client.get("/deep/app/route").text == "<div id='root'></div>"
    assert client.get("/missing.png").status_code == 404


def test_mount_frontend_skips_when_build_output_is_missing(tmp_path) -> None:
    app = FastAPI()

    assert mount_frontend(app, tmp_path / "dist") is False
