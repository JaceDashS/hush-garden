/** Android: picks a PNG with the system document picker and reads it as base64. Null when the player cancels. */
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";

export async function pickPng(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: "image/png", copyToCacheDirectory: true, multiple: false });
  if (result.canceled || !result.assets?.length) return null;
  return new File(result.assets[0].uri).base64();
}
