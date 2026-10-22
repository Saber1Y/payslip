export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function api<T>(path: string, init?: { method?: "GET" | "POST"; body?: unknown; signal?: AbortSignal }): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: init?.method ?? "GET",
      headers: init?.body === undefined ? undefined : { "content-type": "application/json" },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      signal: init?.signal,
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(0, "NETWORK", "Can't reach Payslip. Check your connection and try again.");
  }
  const body = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const err = (body as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiError(response.status, err?.code ?? "HTTP_ERROR", err?.message ?? `Request failed (${response.status})`);
  }
  return body as T;
}
