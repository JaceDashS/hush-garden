/** Browser storage for the nature sound patch: the Cache API, which keeps large files across visits. */
import type { SoundManifest } from "./library";
import type { SoundStore } from "./patch";

const CACHE = "hush-garden-sounds";
/** Cache keys are made-up URLs so they do not depend on where the files were downloaded from. */
const key = (path: string) => "https://sounds.hush-garden.local/" + path;
const MANIFEST = key("manifest.json");

export function createSoundStore(): SoundStore {
  const open = () => caches.open(CACHE);
  return {
    async has(path, bytes) {
      const hit = await (await open()).match(key(path));
      if (!hit) return false;
      const length = Number(hit.headers.get("content-length") ?? "-1");
      return length < 0 || length === bytes;
    },
    async download(url, path) {
      const response = await fetch(url);
      if (!response.ok) throw new Error("HTTP " + response.status + " for " + path);
      const body = await response.arrayBuffer();
      const headers = { "content-type": response.headers.get("content-type") ?? "application/octet-stream", "content-length": String(body.byteLength) };
      await (await open()).put(key(path), new Response(body, { headers }));
    },
    async source(path) {
      const hit = await (await open()).match(key(path));
      if (!hit) throw new Error("not stored: " + path);
      return hit.arrayBuffer();
    },
    async prune(keep) {
      const cache = await open();
      for (const request of await cache.keys()) {
        const path = request.url.replace(key(""), "");
        if (request.url !== MANIFEST && !keep.has(path)) await cache.delete(request);
      }
    },
    async readManifest() {
      const hit = await (await open()).match(MANIFEST);
      return hit ? hit.json() : null;
    },
    async writeManifest(manifest: SoundManifest) {
      await (await open()).put(MANIFEST, new Response(JSON.stringify(manifest), { headers: { "content-type": "application/json" } }));
    },
  };
}
