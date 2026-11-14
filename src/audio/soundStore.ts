/**
 * Phone storage for the nature sound patch: files in the app's document folder (kept until the app is removed).
 * The player decodes them straight from their path. The web uses soundStore.web.ts.
 */
import { Directory, File, Paths } from "expo-file-system";
import type { SoundManifest } from "./library";
import type { SoundStore } from "./patch";

const folder = () => new Directory(Paths.document, "hush-sounds");
/** One flat folder: "fs-757276/03.mp3" is stored as "fs-757276__03.mp3". */
const fileFor = (path: string) => new File(folder(), path.replace(/\//g, "__"));
const nameToPath = (name: string) => name.replace(/__/g, "/");

export function createSoundStore(): SoundStore {
  const ensure = () => {
    const dir = folder();
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    return dir;
  };
  return {
    async has(path, bytes) {
      const file = fileFor(path);
      return file.exists && file.size === bytes;
    },
    async download(url, path) {
      ensure();
      await File.downloadFileAsync(url, fileFor(path), { idempotent: true });
    },
    async source(path) {
      return fileFor(path).uri;
    },
    async prune(keep) {
      for (const item of ensure().list()) {
        if (item instanceof File && item.name !== "manifest.json" && !keep.has(nameToPath(item.name))) item.delete();
      }
    },
    async clear() {
      const dir = folder();
      if (dir.exists) dir.delete();
    },
    async readManifest() {
      const file = new File(folder(), "manifest.json");
      return file.exists ? JSON.parse(await file.text()) : null;
    },
    async writeManifest(manifest: SoundManifest) {
      ensure();
      const file = new File(folder(), "manifest.json");
      if (!file.exists) file.create();
      file.write(JSON.stringify(manifest));
    },
  };
}
