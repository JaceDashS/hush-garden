/**
 * A random id for this app on this device, sent when entering the public garden. When the app comes back after
 * being killed without closing its connection, the server uses it to remove the character left behind at once.
 * In a browser it is kept per tab (it survives a reload), so two tabs are two visitors. It identifies nothing else.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const KEY = "hush-garden.device-id.v1";
const PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

function randomId(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const bytes = new Uint8Array(32);
  const crypto = (globalThis as { crypto?: { getRandomValues?: (array: Uint8Array) => Uint8Array } }).crypto;
  if (crypto?.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (byte) => alphabet[byte % 64]).join("");
}

let cached: string | null = null;

export async function getDeviceId(): Promise<string> {
  if (cached) return cached;
  let id: string | null = null;
  try {
    if (Platform.OS === "web") id = globalThis.sessionStorage?.getItem(KEY) ?? null;
    else id = await AsyncStorage.getItem(KEY);
  } catch {
    id = null;
  }
  if (!id || !PATTERN.test(id)) {
    id = randomId();
    try {
      if (Platform.OS === "web") globalThis.sessionStorage?.setItem(KEY, id);
      else await AsyncStorage.setItem(KEY, id);
    } catch {
      // Without storage the id lasts for this run only.
    }
  }
  cached = id;
  return id;
}
