/** OS desktop/web background notifications for nearby chat (Windows/macOS via Tauri plugin or Web Notification API). */
import { Platform } from "react-native";

function isDesktopApp(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function isWindowBackground(): boolean {
  if (typeof document === "undefined") return false;
  return document.hidden || !document.hasFocus();
}

export function isOsNotificationSupported(): boolean {
  if (Platform.OS !== "web" || typeof globalThis === "undefined") return false;
  return isDesktopApp() || "Notification" in globalThis;
}

export async function requestOsNotificationPermission(): Promise<boolean> {
  if (!isOsNotificationSupported()) return false;
  if (isDesktopApp()) {
    try {
      const mod = await import("@tauri-apps/plugin-notification");
      let granted = await mod.isPermissionGranted();
      if (!granted) {
        const result = await mod.requestPermission();
        granted = result === "granted";
      }
      return granted;
    } catch {
      // Fall back to standard Web Notification API if plugin call is unavailable.
    }
  }
  const NotificationApi = (globalThis as { Notification?: typeof Notification }).Notification;
  if (!NotificationApi) return false;
  if (NotificationApi.permission === "granted") return true;
  if (NotificationApi.permission === "denied") return false;
  try {
    return (await NotificationApi.requestPermission()) === "granted";
  } catch {
    return false;
  }
}

export async function sendNearbyChatNotification(senderName: string, text: string): Promise<void> {
  if (!isOsNotificationSupported() || !isWindowBackground()) return;
  const title = senderName ? `${senderName} — Hush Garden` : "Hush Garden";
  if (isDesktopApp()) {
    try {
      const mod = await import("@tauri-apps/plugin-notification");
      if (await mod.isPermissionGranted()) {
        mod.sendNotification({ title, body: text });
        return;
      }
    } catch {
      // Fall back to Web Notification API below.
    }
  }
  const NotificationApi = (globalThis as { Notification?: typeof Notification }).Notification;
  if (NotificationApi && NotificationApi.permission === "granted") {
    try {
      new NotificationApi(title, { body: text });
    } catch { /* ignore browsers requiring service-worker notifications */ }
  }
}
