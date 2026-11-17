/** Android floating bubble overlay bridge; safe no-op on web and iOS. */
import { DeviceEventEmitter, NativeModules, Platform } from "react-native";

interface FloatingBubbleNative {
  canDrawOverlays(): Promise<boolean>;
  requestOverlayPermission(): void;
  show(playing: boolean): Promise<boolean>;
  hide(): void;
  setPlaying(playing: boolean): void;
  isShowing(): Promise<boolean>;
}

const native = (Platform.OS === "android" ? NativeModules.FloatingBubble : null) as FloatingBubbleNative | null;

export function isFloatingBubbleSupported(): boolean {
  return Platform.OS === "android" && !!native;
}

export async function canDrawBubbleOverlay(): Promise<boolean> {
  if (!native) return false;
  return native.canDrawOverlays();
}

export function requestBubbleOverlayPermission(): void {
  native?.requestOverlayPermission();
}

export async function showFloatingBubble(playing: boolean): Promise<boolean> {
  if (!native) return false;
  return native.show(playing);
}

export function hideFloatingBubble(): void {
  native?.hide();
}

export function syncFloatingBubblePlaying(playing: boolean): void {
  native?.setPlaying(playing);
}

export async function isFloatingBubbleShowing(): Promise<boolean> {
  if (!native) return false;
  return native.isShowing();
}

export function onFloatingBubbleEvents(onToggle: () => void, onClosed: () => void): () => void {
  if (!native) return () => undefined;
  const subToggle = DeviceEventEmitter.addListener("floatingBubbleToggle", onToggle);
  const subClosed = DeviceEventEmitter.addListener("floatingBubbleClosed", onClosed);
  return () => {
    subToggle.remove();
    subClosed.remove();
  };
}
