/* ============================================================
   ProxyTrace v2 — API Client
   (Identical to frontend/src/api.ts — preserved, not rewritten)
   ============================================================ */

import type { JsonObject } from "./types";

export class ProxyTraceApi {
  constructor(private readonly baseUrl: string) {}

  async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`${response.status} ${response.statusText}: ${text}`);
    }
    return (await response.json()) as T;
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>(path);
  }

  post<T>(path: string, body?: JsonObject): Promise<T> {
    return this.request<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }
}

/* ---- Utilities (preserved verbatim) ---- */

export function compactId(id?: string | null): string {
  if (!id) return "none";
  return id.length <= 10 ? id : `${id.slice(0, 8)}…${id.slice(-4)}`;
}

export function formatDate(value?: string | null): string {
  if (!value) return "pending";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function asRecord(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

export const DEFAULT_API_BASE =
  (import.meta.env.VITE_PROXYTRACE_API_URL as string | undefined) ||
  (import.meta.env.DEV ? "http://127.0.0.1:8000" : "");

export function getInitialApiBase(): string {
  const saved =
    localStorage.getItem("proxytrace_api_base") || DEFAULT_API_BASE;
  if (saved === "") return "";
  const legacyHost = ["local", "host"].join("");
  try {
    const parsed = new URL(saved);
    if (parsed.hostname === legacyHost) {
      parsed.hostname = "127.0.0.1";
    }
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return DEFAULT_API_BASE;
  }
}
