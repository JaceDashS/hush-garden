/**
 * Platform notices for Hush Garden: GET <API_ORIGIN>/notices?app=<APP_ID> (docs/api/20-application-apis.md of the
 * platform). A notice is a title shown from publication until an administrator ends it. Any failure, a non-200
 * answer, broken JSON or an unknown schema means "no notices"; it never blocks the garden.
 */
import { useEffect, useState } from "react";
import { API_ORIGIN, APP_ID } from "../config";

export interface Notice {
  id: string;
  title: string;
}

/** Notices from an answer of /notices; anything malformed is dropped. */
export function parseNotices(value: unknown): Notice[] {
  const v = value as { schemaVersion?: unknown; announcements?: unknown };
  if (!v || typeof v !== "object" || v.schemaVersion !== 1 || !Array.isArray(v.announcements)) return [];
  return v.announcements
    .filter((item): item is { id: unknown; title: unknown } => !!item && typeof item === "object")
    .map((item) => ({ id: String(item.id ?? ""), title: typeof item.title === "string" ? item.title.trim() : "" }))
    .filter((item) => item.id && item.title);
}

/** Longer than the edge's five second origin deadline, as the platform asks. */
const TIMEOUT_MS = 10_000;

export async function fetchNotices(fetcher: typeof fetch = fetch): Promise<Notice[]> {
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timer = setTimeout(() => controller?.abort(), TIMEOUT_MS);
  try {
    const response = await fetcher(`${API_ORIGIN}/notices?app=${APP_ID}`, { credentials: "omit", signal: controller?.signal });
    if (!response.ok) return [];
    return parseNotices(await response.json());
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/** Notices already shown in this app run; each is shown once per run. */
const shown = new Set<string>();
let queue: Notice[] = [];
const listeners = new Set<(queue: Notice[]) => void>();
const publish = () => {
  for (const listener of listeners) listener(queue);
};

/** Adds notices to the toast queue, skipping those already shown in this run (unless `again`). */
export function showNotices(notices: Notice[], again = false): void {
  const fresh = notices.filter((notice) => (again || !shown.has(notice.id)) && !queue.some((item) => item.id === notice.id));
  if (!fresh.length) return;
  for (const notice of fresh) shown.add(notice.id);
  queue = [...queue, ...fresh];
  publish();
}

/** The notices waiting to be shown, the first one on screen. */
export const noticeQueue = (): readonly Notice[] => queue;

/** Removes the notice on screen; the next one in the queue follows. */
export function dismissNotice(id: string): void {
  queue = queue.filter((item) => item.id !== id);
  publish();
}

/** Fetches the notices and queues the new ones. */
export async function loadNotices(again = false): Promise<void> {
  showNotices(await fetchNotices(), again);
}

/** The notice to show now, or null. */
export function useCurrentNotice(): Notice | null {
  const [current, setCurrent] = useState<Notice[]>(queue);
  useEffect(() => {
    listeners.add(setCurrent);
    setCurrent(queue);
    return () => {
      listeners.delete(setCurrent);
    };
  }, []);
  return current[0] ?? null;
}
