from __future__ import annotations

from typing import Any

from google import genai

from proxytrace.llm_adapter import gemini_patch


class FakeResponse:
    text = "route to PLATFORM"
    usage_metadata = {"prompt_token_count": 3, "candidates_token_count": 4}


class FakeModels:
    def generate_content(self, *args: Any, **kwargs: Any) -> FakeResponse:
        return FakeResponse()


class FakeAio:
    models = FakeModels()


class FakeClient:
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        self.models = FakeModels()
        self.aio = FakeAio()


def test_gemini_patch_wraps_generate_content_and_posts_capture(monkeypatch) -> None:
    posted: list[dict[str, Any]] = []

    class FakeHttpxClient:
        def __init__(self, *args: Any, **kwargs: Any) -> None:
            pass

        def __enter__(self) -> "FakeHttpxClient":
            return self

        def __exit__(self, *args: Any) -> None:
            pass

        def post(self, url: str, json: dict[str, Any]):
            posted.append({"url": url, "json": json})

            class FakePostResponse:
                def raise_for_status(self) -> None:
                    pass

            return FakePostResponse()

    monkeypatch.setattr(genai, "Client", FakeClient)
    monkeypatch.setattr(gemini_patch.httpx, "Client", FakeHttpxClient)

    try:
        assert gemini_patch.install(api_base_url="http://proxytrace.test") is True
        gemini_patch.set_trace_context(
            run_id="run-123",
            system_prompt="route tickets safely",
            snapshot={"ticket": "DEMO-1"},
        )

        client = genai.Client(api_key="fake")
        response = client.models.generate_content(
            model="gemini-3.1-flash-lite",
            contents="Classify DEMO-1",
        )

        assert response.text == "route to PLATFORM"
        assert posted[0]["url"] == "http://proxytrace.test/llm/capture"
        assert posted[0]["json"]["run_id"] == "run-123"
        assert posted[0]["json"]["model"] == "gemini-3.1-flash-lite"
        assert posted[0]["json"]["system_prompt"] == "route tickets safely"
        assert posted[0]["json"]["messages"] == [
            {"role": "user", "content": "Classify DEMO-1"}
        ]
        assert posted[0]["json"]["response"] == {"text": "route to PLATFORM"}
    finally:
        gemini_patch.uninstall_for_tests()

