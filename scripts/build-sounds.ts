/**
 * Builds the nature sound files the platform server hands out, from the source recordings in sound-sources/
 * (named <recording id>.<ext>, kept locally and never pushed). Needs ffmpeg and ffprobe on PATH.
 *
 *   npx tsx scripts/build-sounds.ts            build everything into dist-sounds/
 *   npx tsx scripts/build-sounds.ts fs-757276  rebuild one recording
 *   npx tsx scripts/build-sounds.ts --manifest-only  only rewrite manifest.json
 *
 * Long recordings: the middle 10 minutes, brought to one loudness, 128 kbps stereo MP3, cut into 1 minute chunks
 * so a phone only decodes the part it plays. The heartbeat: single beats cut at their onsets, as short WAV files
 * the app plays at its tempo. dist-sounds/manifest.json lists every file with its size and a version; file names carry
 * a hash of their content.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { RECORDINGS, hasTempo } from "../src/domain/recordings";
import { NATURE_SOURCES, type NatureSource } from "../src/domain/sound";

const ROOT = join(import.meta.dirname, "..");
const SOURCES = join(ROOT, "sound-sources");
const OUT = join(ROOT, "dist-sounds");
/** Length kept from each long recording, and the chunk length, in seconds. */
const KEEP = 600;
const CHUNK = 60;
/** Integrated loudness every long recording is brought to, in LUFS, and its true peak ceiling in dBTP. */
const LOUDNESS = -20;
const PEAK = -2;
/** Heartbeat: how many beats to keep, and the length of one beat (short enough for 120 BPM). */
const BEATS = 8;
const BEAT_SECONDS = 0.48;

const run = (cmd: string, args: string[]) => execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 26 });
const durationOf = (file: string) => Number(run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).trim());

function sourceFile(id: string): string {
  const name = readdirSync(SOURCES).find((file) => file.startsWith(id + "."));
  if (!name) throw new Error(`missing source recording ${id} in sound-sources/`);
  return join(SOURCES, name);
}

/** First loudnorm pass, measuring what the second, linear pass needs. ffmpeg prints it as JSON on stderr. */
function loudnormStats(file: string, start: number): Record<string, string> {
  const result = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-ss", String(start), "-t", String(KEEP), "-i", file, "-af", `loudnorm=I=${LOUDNESS}:TP=${PEAK}:LRA=11:print_format=json`, "-f", "null", "-"], { encoding: "utf8", maxBuffer: 1 << 26 });
  const text = result.stderr;
  const json = text.slice(text.lastIndexOf("{"), text.lastIndexOf("}") + 1);
  return JSON.parse(json);
}

function buildLong(id: string) {
  const file = sourceFile(id);
  const length = durationOf(file);
  if (length < KEEP) throw new Error(`${id} is ${length.toFixed(0)} s, shorter than ${KEEP} s`);
  const start = Math.floor((length - KEEP) / 2);
  const stats = loudnormStats(file, start);
  const filter = `loudnorm=I=${LOUDNESS}:TP=${PEAK}:LRA=11:measured_I=${stats.input_i}:measured_TP=${stats.input_tp}:measured_LRA=${stats.input_lra}:measured_thresh=${stats.input_thresh}:offset=${stats.target_offset}:linear=true`;
  const dir = join(OUT, id);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-ss", String(start), "-t", String(KEEP), "-i", file, "-af", filter, "-ar", "44100", "-ac", "2", "-c:a", "libmp3lame", "-b:a", "128k", "-f", "segment", "-segment_time", String(CHUNK), "-reset_timestamps", "1", join(dir, "%02d.mp3")]);
  dropShortTail(dir);
  return { start, loudness: Number(stats.input_i) };
}

/** The segmenter can leave a last chunk of a few frames; a chunk much shorter than CHUNK is removed. */
function dropShortTail(dir: string) {
  const names = readdirSync(dir).filter((name) => name.endsWith(".mp3")).sort();
  const last = names.at(-1);
  if (!last) return;
  let seconds = 0;
  try {
    seconds = durationOf(join(dir, last));
  } catch {
    // too short for ffprobe to find two frames
  }
  if (seconds < CHUNK * 0.9) rmSync(join(dir, last));
}

/** Loudness envelope of a mono 4 kHz decode, in 10 ms steps. */
function envelope(file: string, from: number, seconds: number): number[] {
  const raw = execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-ss", String(from), "-t", String(seconds), "-i", file, "-ac", "1", "-ar", "4000", "-f", "f32le", "-"], { maxBuffer: 1 << 28 });
  const samples = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
  const step = 40;
  const env: number[] = [];
  for (let i = 0; i + step <= samples.length; i += step) {
    let sum = 0;
    for (let j = i; j < i + step; j++) sum += samples[j] * samples[j];
    env.push(Math.sqrt(sum / step));
  }
  return env;
}

function buildBeats(id: string) {
  const file = sourceFile(id);
  const from = Math.floor(durationOf(file) / 2) - 30;
  const env = envelope(file, from, 60);
  const max = Math.max(...env);
  const onsets: { at: number; peak: number }[] = [];
  let armed = true;
  for (let i = 0; i < env.length; i++) {
    if (armed && env[i] > 0.4 * max) {
      const peak = Math.max(...env.slice(i, i + 15));
      onsets.push({ at: from + i * 0.01, peak });
      armed = false;
    }
    if (env[i] < 0.15 * max) armed = true;
  }
  // Keep beats whose strength is close to the typical one and that are not cut short by the next beat.
  const sorted = [...onsets].map((o) => o.peak).sort((a, b) => a - b);
  const typical = sorted[Math.floor(sorted.length / 2)];
  const chosen = onsets.filter((o, i) => Math.abs(o.peak - typical) < 0.15 * typical && (onsets[i + 1]?.at ?? Infinity) - o.at > BEAT_SECONDS + 0.05).slice(0, BEATS);
  if (chosen.length < 3) throw new Error(`only ${chosen.length} clean beats found in ${id}`);
  const dir = join(OUT, id);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  chosen.forEach((beat, index) => {
    const start = Math.max(0, beat.at - 0.03);
    const fadeOut = BEAT_SECONDS - 0.06;
    run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-ss", start.toFixed(3), "-t", String(BEAT_SECONDS), "-i", file, "-af", `afade=t=in:d=0.005,afade=t=out:st=${fadeOut}:d=0.06,loudnorm=I=-16:TP=-3:LRA=7`, "-ar", "44100", "-ac", "2", "-c:a", "pcm_s16le", join(dir, `beat-${index}.wav`)]);
  });
  return { beats: chosen.length, from };
}

interface ManifestFile {
  path: string;
  bytes: number;
}

function main() {
  if (!existsSync(SOURCES)) throw new Error("sound-sources/ is missing; it holds the source recordings and is not in git");
  mkdirSync(OUT, { recursive: true });
  const only = process.argv[2];
  const recordings: { id: string; source: NatureSource; kind: "chunks" | "beats" }[] = [];
  for (const source of NATURE_SOURCES) for (const item of RECORDINGS[source]) recordings.push({ id: item.id, source, kind: hasTempo(source) ? "beats" : "chunks" });
  for (const item of recordings) {
    if (only && item.id !== only) continue; // also skips everything for --manifest-only
    const started = Date.now();
    const info = item.kind === "beats" ? buildBeats(item.id) : buildLong(item.id);
    console.log(item.source.padEnd(10), item.id, JSON.stringify(info), ((Date.now() - started) / 1000).toFixed(1) + " s");
  }
  // The manifest always describes everything in dist-sounds/, so a partial rebuild keeps it complete.
  const hash = createHash("sha256");
  const entries = recordings.map((item) => {
    const dir = join(OUT, item.id);
    if (!existsSync(dir)) throw new Error(`${item.id} has not been built yet`);
    if (item.kind === "chunks") dropShortTail(dir);
    const files: ManifestFile[] = readdirSync(dir)
      .sort()
      .map((name) => {
        // Each file carries a short hash of its content in its name ("03.1a2b3c4d.mp3"), so a rebuilt file gets a
        // new name: devices download it again and the server can cache every file for good.
        const content = readFileSync(join(dir, name));
        const [, stem, ext] = /^(.+?)(?:\.[0-9a-f]{8})?\.(mp3|wav)$/.exec(name) ?? [];
        if (!stem) throw new Error("unexpected file " + name);
        const named = `${stem}.${createHash("sha256").update(content).digest("hex").slice(0, 8)}.${ext}`;
        if (named !== name) renameSync(join(dir, name), join(dir, named));
        const path = `${item.id}/${named}`;
        hash.update(path).update(content);
        return { path, bytes: content.byteLength };
      });
    return { id: item.id, source: item.source, kind: item.kind, ...(item.kind === "chunks" ? { chunkSeconds: CHUNK } : null), files };
  });
  const totalBytes = entries.reduce((sum, entry) => sum + entry.files.reduce((s, f) => s + f.bytes, 0), 0);
  const manifest = { version: hash.digest("hex").slice(0, 12), totalBytes, recordings: entries };
  writeFileSync(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 1) + "\n");
  console.log("manifest", manifest.version, (totalBytes / 1e6).toFixed(1) + " MB", entries.length, "recordings");
}

main();
