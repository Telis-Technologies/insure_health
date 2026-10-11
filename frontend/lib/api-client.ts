/** Shared REST boundary for the frontend. No local-success or mock fallback. */
export class ApiUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiUnavailableError";
  }
}

export class ApiRequestError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(status: number, message: string, payload?: unknown) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.payload = payload;
  }
}

function apiUrl(path: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (!baseUrl) {
    throw new ApiUnavailableError("The shared health claims API is not configured.");
  }
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

/** Make a typed request; callers must handle unavailable, denied and conflict states. */
export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      ...init,
      headers: { Accept: "application/json", ...init?.headers },
    });
  } catch (error) {
    if (error instanceof ApiUnavailableError) throw error;
    throw new ApiUnavailableError("The health claims API could not be reached.");
  }

  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? await response.json().catch(() => undefined)
    : await response.text().catch(() => undefined);

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload !== null && "message" in payload && typeof payload.message === "string"
        ? payload.message
        : `The health claims API returned ${response.status}.`;
    throw new ApiRequestError(response.status, message, payload);
  }

  return payload as T;
}
