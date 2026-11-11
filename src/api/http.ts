import { ApiError } from "./types";

/** Rejects anything but an absolute API path like `/auth/session`, so callers cannot redirect requests elsewhere. */
export function apiUrl(origin: string, path: string): string {
  if (!/^\/[a-z]/.test(path) || path.includes("//") || path.includes("..")) throw new Error("Invalid API path");
  return origin + path;
}

/** Reads a JSON response and turns a non-2xx status into an ApiError carrying the server's error code. */
export async function readResponse<T>(response: Response): Promise<T> {
  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(response.status, (payload as { error?: string } | null)?.error ?? "HTTP_" + response.status);
  return payload as T;
}
