/**
 * Everything the app tells the player appears as one kind of toast that slides down from the top (Toast.tsx):
 * platform notices and the app's own short messages. This is the one queue they share.
 *
 * The toast on screen is the first passing one (a message or a notice); a lasting one (the connection is lost)
 * shows when nothing passing is waiting, and comes back after a passing one is gone.
 */
import { useEffect, useState } from "react";

export interface Toast {
  id: string;
  text: string;
  /** "notice" comes from the platform and carries a label; "message" is the app's own short message. */
  kind: "notice" | "message";
  /** Seconds on screen; null stays until it is dismissed by id. */
  seconds: number | null;
}

/** Seconds a platform notice and a short message stay. */
export const NOTICE_SECONDS = 7;
export const MESSAGE_SECONDS = 3.5;

let queue: Toast[] = [];
const listeners = new Set<(current: Toast | null) => void>();

/** The toast to show now: the first passing one, else the first lasting one. */
export const currentToast = (): Toast | null => queue.find((toast) => toast.seconds != null) ?? queue[0] ?? null;
/** Every toast waiting, in order. */
export const toastQueue = (): readonly Toast[] => queue;

function publish() {
  const current = currentToast();
  for (const listener of listeners) listener(current);
}

/** Adds a toast, or replaces the text of the one with the same id. */
export function showToast(toast: Toast): void {
  const at = queue.findIndex((item) => item.id === toast.id);
  queue = at < 0 ? [...queue, toast] : queue.map((item, index) => (index === at ? toast : item));
  publish();
}

export function dismissToast(id: string): void {
  if (!queue.some((item) => item.id === id)) return;
  queue = queue.filter((item) => item.id !== id);
  publish();
}

let counter = 0;
/** A short message of the app (a refused action, a failure), shown for MESSAGE_SECONDS. */
export function showMessage(text: string): void {
  showToast({ id: "message-" + ++counter, text, kind: "message", seconds: MESSAGE_SECONDS });
}

export function useCurrentToast(): Toast | null {
  const [current, setCurrent] = useState(currentToast);
  useEffect(() => {
    listeners.add(setCurrent);
    setCurrent(currentToast());
    return () => {
      listeners.delete(setCurrent);
    };
  }, []);
  return current;
}
