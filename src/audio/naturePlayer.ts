/**
 * Plays one nature recording into a node: the crossfaded chain of random sections planned by bed.ts, or for the
 * heartbeat single beats at its tempo. It schedules a little ahead on the audio clock and decodes chunks as it
 * needs them; a section whose chunk arrives late starts late rather than out of time.
 */
import type { AudioBufferSourceNode, AudioContext, AudioNode, GainNode } from "react-native-audio-api";
import { fadeCurve, nextBeat, nextLayers, type Layer } from "./bed";
import type { SoundLibrary } from "./library";

/** How far ahead layers are planned, in seconds: room to decode a chunk before it is due. */
const PLAN_AHEAD = 15;
/** How far ahead beats are scheduled, in seconds. */
const BEAT_AHEAD = 1.5;
const TICK_MS = 1000;

interface Playing {
  source: AudioBufferSourceNode;
  gain: GainNode | null;
  end: number;
}

export class NaturePlayer {
  private timer: ReturnType<typeof setInterval> | null = null;
  private playing: Playing[] = [];
  private previous: Layer | null = null;
  /** Audio time of the plan's zero. */
  private origin = 0;
  private nextBeatAt = 0;
  private stopped = false;

  constructor(
    private context: AudioContext,
    private library: SoundLibrary,
    private recording: string,
    private output: AudioNode,
    private tempo: number | null,
    private random: () => number = Math.random,
  ) {}

  start(): void {
    this.origin = this.context.currentTime + 0.1;
    this.nextBeatAt = this.origin;
    this.tick();
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  /** Heartbeat only: the next beats follow the new tempo. */
  setTempo(tempo: number): void {
    this.tempo = tempo;
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    for (const item of this.playing) {
      try { item.source.stop(); } catch { /* already stopped */ }
      try { item.source.disconnect(); } catch { /* already disconnected */ }
      try { item.gain?.disconnect(); } catch { /* already disconnected */ }
    }
    this.playing = [];
  }

  private tick(): void {
    if (this.stopped) return;
    const now = this.context.currentTime;
    this.playing = this.playing.filter((item) => {
      if (item.end > now) return true;
      try { item.source.disconnect(); } catch { /* already disconnected */ }
      try { item.gain?.disconnect(); } catch { /* already disconnected */ }
      return false;
    });
    if (this.tempo != null) return this.scheduleBeats(now);
    const chunks = this.library.chunkCount(this.recording);
    if (!chunks) return;
    // Plan until the next chained layer would start beyond the horizon.
    const due = () => (this.previous ? this.previous.start + this.previous.length - this.previous.fadeOut : 0);
    while (this.origin + due() < now + PLAN_AHEAD) {
      const layers = nextLayers(this.previous, chunks, this.random);
      for (const layer of layers) this.scheduleLayer(layer);
      this.previous = layers[0];
    }
  }

  private scheduleLayer(layer: Layer): void {
    const when = this.origin + layer.start;
    this.library.chunk(this.context, this.recording, layer.chunk).then(
      (buffer) => {
        if (this.stopped) return;
        const late = Math.max(0, this.context.currentTime + 0.05 - when);
        if (late >= layer.length - layer.fadeOut) return; // too late to be worth starting
        const at = when + late;
        const source = this.context.createBufferSource();
        source.buffer = buffer;
        const gain = this.context.createGain();
        gain.gain.value = 0;
        source.connect(gain);
        gain.connect(this.output);
        const fadeIn = Math.max(0.05, layer.fadeIn - late);
        gain.gain.setValueCurveAtTime(fadeCurve(layer.peak, true), at, fadeIn);
        gain.gain.setValueCurveAtTime(fadeCurve(layer.peak, false), when + layer.length - layer.fadeOut, layer.fadeOut);
        source.start(at, layer.offset + late, layer.length - late);
        this.playing.push({ source, gain, end: when + layer.length + 0.1 });
      },
      () => undefined, // a chunk that cannot be read leaves a quieter moment; the chain goes on
    );
  }

  private scheduleBeats(now: number): void {
    const tempo = this.tempo ?? 60;
    if (this.nextBeatAt < now) this.nextBeatAt = now + 0.05;
    const horizon = now + BEAT_AHEAD;
    const due: number[] = [];
    while (this.nextBeatAt < horizon) {
      due.push(this.nextBeatAt);
      this.nextBeatAt = nextBeat(this.nextBeatAt, tempo, this.random);
    }
    if (!due.length) return;
    this.library.beatBuffers(this.context, this.recording).then(
      (beats) => {
        if (this.stopped || !beats.length) return;
        for (const at of due) {
          if (at < this.context.currentTime) continue;
          const source = this.context.createBufferSource();
          source.buffer = beats[Math.floor(this.random() * beats.length)];
          source.connect(this.output);
          source.start(at);
          this.playing.push({ source, gain: null, end: at + (source.buffer?.duration ?? 1) + 0.1 });
        }
      },
      () => undefined,
    );
  }
}
