/** Device storage for the private garden and settings. Works offline; nothing here is sent to the server. */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { normalizeMyGarden, type MyGarden } from "./domain/garden";
import { normalizeSettings, type Settings } from "./settings";

const GARDEN_KEY = "hush-garden.my-garden.v1";
const SETTINGS_KEY = "hush-garden.settings.v1";

async function read(key: string): Promise<unknown> {
  try {
    const text = await AsyncStorage.getItem(key);
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

async function write(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be full or blocked (private browsing). The garden still works for this visit.
  }
}

export const loadGarden = async (): Promise<MyGarden> => normalizeMyGarden(await read(GARDEN_KEY));
export const saveGarden = (garden: MyGarden): Promise<void> => write(GARDEN_KEY, garden);
export const loadSettings = async (): Promise<Settings> => normalizeSettings(await read(SETTINGS_KEY));
export const saveSettings = (settings: Settings): Promise<void> => write(SETTINGS_KEY, settings);
