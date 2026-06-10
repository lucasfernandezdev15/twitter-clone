const TOKEN_KEY = "twitterly_token";

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(status: number, data: unknown, message?: string) {
    super(message ?? "API request failed");
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

function getErrorMessage(data: unknown): string {
  if (!data || typeof data !== "object") {
    return "Ocurrió un error inesperado";
  }

  const record = data as Record<string, unknown>;

  if (typeof record.error === "string") {
    return record.error;
  }

  if (record.error && typeof record.error === "object") {
    const fieldErrors = Object.values(record.error as Record<string, string[]>)
      .flat()
      .filter(Boolean);

    if (fieldErrors.length > 0) {
      return fieldErrors[0];
    }
  }

  return "Ocurrió un error inesperado";
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers);

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const token =
    typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;

  try {
    response = await fetch(path, {
      ...options,
      headers,
    });
  } catch {
    throw new ApiError(0, null, "Error de red. Verificá tu conexión.");
  }

  let data: unknown = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new ApiError(response.status, data, getErrorMessage(data));
  }

  return data as T;
}
