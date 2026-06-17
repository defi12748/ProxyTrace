from __future__ import annotations

import contextvars
import importlib
import inspect
import os
from typing import Any

import httpx

from proxytrace.settings import get_settings


_run_id: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "proxytrace_run_id", default=None
)
_system_prompt: contextvars.ContextVar[str] = contextvars.ContextVar(
    "proxytrace_system_prompt", default=""
)
_snapshot: contextvars.ContextVar[dict[str, Any] | None] = contextvars.ContextVar(
    "proxytrace_snapshot", default=None
)

_original_client: Any = None
_installed = False


def set_trace_context(
    *,
    run_id: str,
    system_prompt: str = "",
    snapshot: dict[str, Any] | None = None,
) -> None:
    _run_id.set(run_id)
    _system_prompt.set(system_prompt)
    _snapshot.set(snapshot)


def clear_trace_context() -> None:
    _run_id.set(None)
    _system_prompt.set("")
    _snapshot.set(None)


def is_installed() -> bool:
    return _installed


def install(*, api_base_url: str | None = None, run_id: str | None = None) -> bool:
    """Patch google.genai.Client so generate_content calls are captured automatically."""
    global _installed, _original_client
    if _installed:
        return False

    genai = importlib.import_module("google.genai")
    _original_client = genai.Client

    class ProxyTraceGeminiClient:
        def __init__(self, *args: Any, **kwargs: Any) -> None:
            self._proxytrace_client = _original_client(*args, **kwargs)
            self.models = _ModelsProxy(
                self._proxytrace_client.models,
                api_base_url=api_base_url,
                run_id=run_id,
            )
            aio = getattr(self._proxytrace_client, "aio", None)
            self.aio = _AioProxy(aio, api_base_url=api_base_url, run_id=run_id)

        def __getattr__(self, name: str) -> Any:
            return getattr(self._proxytrace_client, name)

    genai.Client = ProxyTraceGeminiClient
    _installed = True
    return True


def uninstall_for_tests() -> None:
    global _installed, _original_client
    if not _installed:
        return
    genai = importlib.import_module("google.genai")
    genai.Client = _original_client
    _original_client = None
    _installed = False
    clear_trace_context()


class _AioProxy:
    def __init__(
        self,
        aio_client: Any,
        *,
        api_base_url: str | None,
        run_id: str | None,
    ) -> None:
        self._aio_client = aio_client
        self.models = _ModelsProxy(
            getattr(aio_client, "models", None),
            api_base_url=api_base_url,
            run_id=run_id,
        )

    def __getattr__(self, name: str) -> Any:
        return getattr(self._aio_client, name)


class _ModelsProxy:
    def __init__(
        self,
        models: Any,
        *,
        api_base_url: str | None,
        run_id: str | None,
    ) -> None:
        self._models = models
        self._api_base_url = api_base_url
        self._run_id = run_id

    def generate_content(self, *args: Any, **kwargs: Any) -> Any:
        request = _extract_request(args, kwargs)
        result = self._models.generate_content(*args, **kwargs)
        if inspect.isawaitable(result):
            return self._record_async_result(result, request)
        _record_gemini_call(
            request=request,
            response=result,
            api_base_url=self._api_base_url,
            run_id=self._run_id,
        )
        return result

    async def _record_async_result(self, awaitable: Any, request: dict[str, Any]) -> Any:
        response = await awaitable
        _record_gemini_call(
            request=request,
            response=response,
            api_base_url=self._api_base_url,
            run_id=self._run_id,
        )
        return response

    def __getattr__(self, name: str) -> Any:
        return getattr(self._models, name)


def _extract_request(args: tuple[Any, ...], kwargs: dict[str, Any]) -> dict[str, Any]:
    model = kwargs.get("model")
    contents = kwargs.get("contents")
    config = kwargs.get("config")
    if model is None and args:
        model = args[0]
    if contents is None and len(args) > 1:
        contents = args[1]
    return {
        "model": model,
        "contents": contents,
        "config": config,
    }


def _record_gemini_call(
    *,
    request: dict[str, Any],
    response: Any,
    api_base_url: str | None,
    run_id: str | None,
) -> None:
    resolved_run_id = run_id or _run_id.get() or os.getenv("PROXYTRACE_RUN_ID")
    if not resolved_run_id:
        return

    settings = get_settings()
    base_url = (api_base_url or settings.proxytrace_api_url).rstrip("/")
    payload = {
        "run_id": resolved_run_id,
        "model": str(request.get("model") or settings.gemini_model),
        "system_prompt": _extract_system_prompt(request.get("config")),
        "messages": _contents_to_messages(request.get("contents")),
        "response": _serialize(response),
        "token_usage": _extract_usage(response),
        "snapshot": _snapshot.get()
        or {
            "provider": "gemini",
            "request": _serialize(request),
        },
    }
    try:
        with httpx.Client(timeout=10) as client:
            result = client.post(f"{base_url}/llm/capture", json=payload)
            result.raise_for_status()
    except httpx.HTTPError:
        return


def _extract_system_prompt(config: Any) -> str:
    context_prompt = _system_prompt.get()
    if context_prompt:
        return context_prompt
    if config is None:
        return ""
    if isinstance(config, dict):
        value = config.get("system_instruction") or config.get("system_prompt")
        return "" if value is None else str(value)
    value = getattr(config, "system_instruction", None)
    return "" if value is None else str(value)


def _contents_to_messages(contents: Any) -> list[dict[str, Any]]:
    if contents is None:
        return []
    if isinstance(contents, list):
        return [{"role": "user", "content": _serialize(item)} for item in contents]
    return [{"role": "user", "content": _serialize(contents)}]


def _extract_usage(response: Any) -> dict[str, Any]:
    usage = getattr(response, "usage_metadata", None)
    if usage is None and isinstance(response, dict):
        usage = response.get("usage_metadata")
    return _serialize(usage) if usage is not None else {}


def _serialize(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, dict):
        return {str(key): _serialize(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_serialize(item) for item in value]
    if hasattr(value, "to_json_dict"):
        return _serialize(value.to_json_dict())
    if hasattr(value, "model_dump"):
        return _serialize(value.model_dump(mode="json"))
    if hasattr(value, "dict"):
        return _serialize(value.dict())
    text = getattr(value, "text", None)
    if text is not None:
        return {"text": text}
    return str(value)
