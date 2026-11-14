/**
 * Platform notices for Hush Garden: GET <API_ORIGIN>/notices?app=<APP_ID> (docs/api/20-application-apis.md of the
 * platform). A notice is a title shown from publication until an administrator ends it. Any failure, a non-200
 * answer, broken JSON or an unknown schema means "no notices"; it never blocks the garden. Notices are shown as
 * toasts (src/toasts.ts).
 */
import { API_ORIGIN, APP_ID } from "../config";
import { NOTICE_SECONDS, showToast } from "../toasts";

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

/** Queues notices as toasts, skipping those already shown in this run (unless `again`). */
export function showNotices(notices: Notice[], again = false): void {
  for (const notice of notices) {
    if (!again && shown.has(notice.id)) continue;
    shown.add(notice.id);
    showToast({ id: "notice-" + notice.id, text: notice.title, kind: "notice", seconds: NOTICE_SECONDS });
  }
}

/** Fetches the notices and queues the new ones. */
export async function loadNotices(again = false): Promise<void> {
  showNotices(await fetchNotices(), again);
}
