/**
 * Synthesises what the listener hears. Each speaker in range is a voice (noise and oscillator tones through an
 * EQ and filters); voices are summed on a bus. A nature source plays its recording through a NaturePlayer in the
 * place of the noise, once the sound files are on the device (setSoundFiles()); before that it is not heard at
 * all, oscillators included. A chat cue briefly swaps part of the bus for a darker copy leaning
 * toward the talker, so loudness and bass stay and only the brightness moves. A limiter after the master rounds
 * off any peak that would clip.
 *
 * The same code runs in the browser (Web Audio) and in the native app (react-native-audio-api).
 */
import { AudioContext, type AnalyserNode, type AudioBuffer, type AudioBufferSourceNode, type AudioNode, type BiquadFilterNode, type GainNode, type OscillatorNode, type StereoPannerNode } from "react-native-audio-api";
import { CUE_TIMING, type Cue, type CueMode } from "../domain/chat";
import { bandCoefficients, type EqBand } from "../domain/equalizer";
import { baseLevel, isMono, isSynth, loudnessOf, mixFor, reachOf, type NoiseColor, type Speaker, type SpeakerSound } from "../domain/sound";
import { distance, type Point } from "../domain/world";
import { LIMIT_RANGE, limiterCurve } from "./limiter";
import { SoundLibrary, type SoundFiles } from "./library";
import { NaturePlayer } from "./naturePlayer";
import { fillNoise, loopOffset } from "./noise";

const NOISE_SECONDS = 6;
/** Gain changes glide with this time constant so walking never clicks. */
const GLIDE = 0.08;
/** A voice is built slightly before its speaker becomes audible and kept slightly after. */
const WAKE_MARGIN = 1.5;
const CUE_CUTOFF = 420;
/** An equalizer point fades from its old filter to its new one in this time constant, so dragging does not click. */
const BAND_FADE = 0.006;
/** Seconds between two filter swaps of one equalizer point; changes in between are applied together. */
const BAND_SWAP = 0.03;

/**
 * One equalizer point. Its filter coefficients cannot glide, so a change builds a new filter beside the old one
 * and crossfades between the two.
 */
interface BandSlot {
  input: GainNode;
  output: GainNode;
  current: { filter: ReturnType<AudioContext["createIIRFilter"]>; gain: GainNode } | null;
  key: string;
  wanted: EqBand | null;
  lastSwap: number;
  timer: ReturnType<typeof setTimeout> | null;
}

interface Voice {
  /** Changes when nodes must be rebuilt: the noise colour or nature source, or the oscillator waves. */
  shape: string;
  /** Changes when any value changed. */
  key: string;
  sources: (AudioBufferSourceNode | OscillatorNode)[];
  nodes: { disconnect(): void }[];
  /** Volume of the noise (synthesiser) or of the recording (nature source). */
  baseGain: GainNode;
  /** Sums the base source and oscillators, and downmixes to 1 channel when the speaker is mono. */
  sum: GainNode;
  /** Plays a nature source's recording into baseGain. */
  player: NaturePlayer | null;
  tones: { oscillator: OscillatorNode; gain: GainNode }[];
  bands: BandSlot[];
  /** The end of the equalizer chain: what this speaker sounds like before distance and pan. */
  shaped: AudioNode;
  /** Created on first use by spectrum(): shows this speaker alone, after its equalizer. */
  analyser?: AnalyserNode;
  level: GainNode;
  pan: StereoPannerNode;
}

const waves = (sound: SpeakerSound) => sound.oscillators.map((o) => o.wave).join(",");

export class GardenAudio {
  private context: AudioContext | null = null;
  private buffers = new Map<NoiseColor, AudioBuffer>();
  private voices = new Map<string, Voice>();
  private speakers: Speaker[] = [];
  private library: SoundLibrary | null = null;
  private listener: Point = { x: 0, y: 0 };
  private bus!: GainNode;
  private dry!: GainNode;
  private wet!: GainNode;
  private wetPan!: StereoPannerNode;
  private master!: GainNode;
  private volume = 0.8;
  private mono = false;
  private mixAnalyser: AnalyserNode | null = null;
  private spectrumData: Float32Array | null = null;

  /** True once start() has run. Sound can only start from a user gesture in browsers. */
  get running(): boolean {
    return this.context?.state === "running";
  }

  /** Creates the audio graph on first use and resumes playback. Call from a tap or key press. */
  async start(): Promise<void> {
    if (!this.context) {
      const context = new AudioContext();
      this.context = context;
      this.bus = context.createGain();
      this.dry = context.createGain();
      this.wet = context.createGain();
      this.wet.gain.value = 0;
      const dark: BiquadFilterNode = context.createBiquadFilter();
      dark.type = "lowpass";
      dark.frequency.value = CUE_CUTOFF;
      this.wetPan = context.createStereoPanner();
      this.master = context.createGain();
      this.master.gain.value = this.volume;
      this.bus.connect(this.dry);
      this.dry.connect(this.master);
      this.bus.connect(dark);
      dark.connect(this.wet);
      this.wet.connect(this.wetPan);
      this.wetPan.connect(this.master);
      // The shaper only accepts -1 to 1, so the signal is scaled down into it and the curve scales it back.
      const intoLimiter = context.createGain();
      intoLimiter.gain.value = 1 / LIMIT_RANGE;
      const limiter = context.createWaveShaper();
      limiter.curve = limiterCurve();
      limiter.oversample = "4x";
      this.master.connect(intoLimiter);
      intoLimiter.connect(limiter);
      limiter.connect(context.destination);
      this.applyMono();
    }
    if (this.context.state !== "running") await this.context.resume();
    this.refresh();
  }

  /** Pauses all sound and keeps the graph for a quick resume. */
  async pause(): Promise<void> {
    if (this.context?.state === "running") await this.context.suspend();
  }

  /** Frees every node. The engine can be started again afterwards. */
  async dispose(): Promise<void> {
    for (const id of [...this.voices.keys()]) this.drop(id);
    const context = this.context;
    this.context = null;
    this.buffers.clear();
    this.mixAnalyser = null;
    await context?.close();
  }

  /**
   * Replaces the speaker layout. A voice is rebuilt only when its sound settings changed. A speaker that makes
   * no sound yet (a nature source before its recording is here) is left out and does not turn the mix down.
   */
  setSpeakers(speakers: readonly Speaker[]): void {
    this.speakers = [...speakers];
    this.refresh();
  }

  /** The nature sound files on the device, or null while they are not all there. Nature voices are rebuilt. */
  setSoundFiles(files: SoundFiles | null): void {
    this.library = files ? new SoundLibrary(files) : null;
    this.refresh();
  }

  /** Whether a nature source's recording can play now. */
  private hasRecording(sound: SpeakerSound): boolean {
    return !isSynth(sound) && !!this.library?.has(sound.recording);
  }

  /** The synthesiser always; a nature source only once its recording is on the device (oscillators included). */
  private playable(sound: SpeakerSound): boolean {
    return isSynth(sound) || this.hasRecording(sound);
  }

  /** Changes when the nodes must be rebuilt: noise colour or recording (and whether it is here), oscillator waves. */
  private shapeOf(sound: SpeakerSound): string {
    return (isSynth(sound) ? sound.noise.color : sound.source + ":" + sound.recording + ":" + this.hasRecording(sound)) + "|" + waves(sound);
  }

  /** Moves the listener; speaker levels and balance follow. */
  setListener(point: Point): void {
    this.listener = point;
    this.refresh();
  }

  /** Master volume, 0 to 1. */
  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.context) this.master.gain.setTargetAtTime(this.volume, this.context.currentTime, GLIDE);
  }

  /** Downmixes all master audio to mono when true, or restores stereo when false. */
  setMono(mono: boolean): void {
    this.mono = mono;
    if (this.context) this.applyMono();
  }

  private applyMono(): void {
    if (!this.context) return;
    this.master.channelCount = this.mono ? 1 : 2;
    this.master.channelCountMode = this.mono ? "explicit" : "max";
  }

  /** Plays the hint that someone nearby spoke. */
  cue(cue: Cue, mode: CueMode): void {
    const context = this.context;
    if (!context || mode === "off" || context.state !== "running") return;
    const now = context.currentTime;
    const { fade, hold } = CUE_TIMING;
    const end = now + fade + hold + fade;
    if (mode === "dip") {
      const low = this.volume * (1 - cue.depth * 0.7);
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setValueAtTime(this.volume, now);
      this.master.gain.linearRampToValueAtTime(low, now + fade);
      this.master.gain.setValueAtTime(low, now + fade + hold);
      this.master.gain.linearRampToValueAtTime(this.volume, end);
      return;
    }
    this.wetPan.pan.setValueAtTime(cue.pan * 0.7, now);
    for (const [param, from, to] of [[this.dry.gain, 1, 1 - cue.depth], [this.wet.gain, 0, cue.depth * 1.4]] as const) {
      param.cancelScheduledValues(now);
      param.setValueAtTime(from, now);
      param.linearRampToValueAtTime(to, now + fade);
      param.setValueAtTime(to, now + fade + hold);
      param.linearRampToValueAtTime(from, end);
    }
  }

  /**
   * Current spectrum for the analyser display: dB values per frequency bin, with the frequency of the last bin.
   * With a speaker id whose voice is playing it shows that speaker alone after its equalizer; otherwise the
   * whole mix. Returns null while no sound is running.
   */
  spectrum(speakerId?: string | null): { db: Float32Array; maxHz: number } | null {
    const context = this.context;
    if (!context || context.state !== "running") return null;
    const voice = speakerId ? this.voices.get(speakerId) : undefined;
    let analyser: AnalyserNode;
    if (voice) {
      if (!voice.analyser) {
        voice.analyser = this.makeAnalyser(context);
        voice.shaped.connect(voice.analyser);
        voice.nodes.push(voice.analyser);
      }
      analyser = voice.analyser;
    } else {
      if (!this.mixAnalyser) {
        this.mixAnalyser = this.makeAnalyser(context);
        this.bus.connect(this.mixAnalyser);
      }
      analyser = this.mixAnalyser;
    }
    if (!this.spectrumData || this.spectrumData.length !== analyser.frequencyBinCount) this.spectrumData = new Float32Array(analyser.frequencyBinCount);
    analyser.getFloatFrequencyData(this.spectrumData);
    return { db: this.spectrumData, maxHz: context.sampleRate / 2 };
  }

  private makeAnalyser(context: AudioContext): AnalyserNode {
    const analyser = context.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.8;
    return analyser;
  }

  private refresh(): void {
    const context = this.context;
    if (!context) return;
    const wanted = new Set<string>();
    const speakers = this.speakers.filter((speaker) => this.playable(speaker.sound));
    const levels = mixFor(this.listener, speakers);
    speakers.forEach((speaker, index) => {
      const awake = distance(this.listener, speaker) < reachOf(speaker.sound) + WAKE_MARGIN && loudnessOf(speaker.sound) > 0;
      if (!awake) return;
      wanted.add(speaker.id);
      const key = JSON.stringify(speaker.sound);
      let voice = this.voices.get(speaker.id);
      if (voice && voice.shape !== this.shapeOf(speaker.sound)) {
        this.drop(speaker.id);
        voice = undefined;
      }
      if (!voice) {
        voice = this.build(context, speaker);
        this.voices.set(speaker.id, voice);
      }
      if (voice.key !== key) {
        voice.key = key;
        this.tune(context, voice, speaker.sound);
      }
      voice.level.gain.setTargetAtTime(levels[index].gain, context.currentTime, GLIDE);
      voice.pan.pan.setTargetAtTime(levels[index].pan, context.currentTime, GLIDE);
    });
    for (const id of [...this.voices.keys()]) if (!wanted.has(id)) this.drop(id);
  }

  private noise(context: AudioContext, color: NoiseColor): AudioBuffer {
    let buffer = this.buffers.get(color);
    if (!buffer) {
      buffer = context.createBuffer(1, Math.floor(context.sampleRate * NOISE_SECONDS), context.sampleRate);
      fillNoise(color, buffer.getChannelData(0));
      this.buffers.set(color, buffer);
    }
    return buffer;
  }

  /** Creates the nodes of one speaker, silent; tune() then sets every value. */
  private build(context: AudioContext, speaker: Speaker): Voice {
    const { sound } = speaker;
    const sources: Voice["sources"] = [];
    const nodes: Voice["nodes"] = [];
    const sum = context.createGain();
    const feed = (source: AudioBufferSourceNode | OscillatorNode) => {
      const gain = context.createGain();
      gain.gain.value = 0;
      source.connect(gain);
      gain.connect(sum);
      sources.push(source);
      nodes.push(source, gain);
      return gain;
    };
    // The noise of the synthesiser, or the recording of a nature source, through one gain: the Sound tab volume.
    const baseGain = context.createGain();
    baseGain.gain.value = 0;
    baseGain.connect(sum);
    nodes.push(baseGain);
    const noise = isSynth(sound) ? context.createBufferSource() : null;
    if (noise && isSynth(sound)) {
      noise.buffer = this.noise(context, sound.noise.color);
      noise.loop = true;
      noise.connect(baseGain);
      sources.push(noise);
      nodes.push(noise);
    }
    const player = !isSynth(sound) && this.library && this.hasRecording(sound) ? new NaturePlayer(context, this.library, sound.recording, baseGain, sound.tempo ?? null) : null;
    const tones = sound.oscillators.map((item) => {
      const oscillator = context.createOscillator();
      oscillator.type = item.wave;
      return { oscillator, gain: feed(oscillator) };
    });
    const bands: BandSlot[] = sound.eq.bands.map(() => ({ input: context.createGain(), output: context.createGain(), current: null, key: "", wanted: null, lastSwap: -1, timer: null }));
    const level = context.createGain();
    // A new voice starts silent and glides in.
    level.gain.value = 0;
    const pan = context.createStereoPanner();
    let tail: AudioNode = sum;
    for (const band of bands) {
      tail.connect(band.input);
      tail = band.output;
    }
    tail.connect(level);
    level.connect(pan);
    pan.connect(this.bus);
    nodes.push(sum, ...bands.flatMap((band) => [band.input, band.output]), level, pan);
    const at = context.currentTime;
    noise?.start(at, loopOffset(NOISE_SECONDS));
    for (const tone of tones) tone.oscillator.start(at);
    player?.start();
    return { shape: this.shapeOf(sound), key: "", sources, nodes, baseGain, sum, player, tones, bands, shaped: tail, level, pan };
  }

  /** Applies sound values to an existing voice. Values glide, so dragging a slider is heard without clicks. */
  private tune(context: AudioContext, voice: Voice, sound: SpeakerSound): void {
    const now = context.currentTime;
    const set = (param: { setTargetAtTime(value: number, start: number, constant: number): unknown }, value: number) => param.setTargetAtTime(value, now, GLIDE / 2);
    const mono = isMono(sound);
    voice.sum.channelCount = mono ? 1 : 2;
    voice.sum.channelCountMode = mono ? "explicit" : "max";
    voice.sum.channelInterpretation = "speakers";
    voice.level.channelCount = 2;
    voice.level.channelCountMode = mono && !isSynth(sound) ? "explicit" : "max";
    voice.level.channelInterpretation = "speakers";
    set(voice.baseGain.gain, baseLevel(sound));
    if (!isSynth(sound) && sound.tempo != null) voice.player?.setTempo(sound.tempo);
    voice.tones.forEach((tone, index) => {
      set(tone.oscillator.frequency, sound.oscillators[index].frequency);
      set(tone.gain.gain, sound.oscillators[index].level * 0.3);
    });
    voice.bands.forEach((slot, index) => this.tuneBand(context, slot, sound.eq.bands[index]));
  }

  /** Puts a band's new filter in place, at most once every BAND_SWAP seconds. */
  private tuneBand(context: AudioContext, slot: BandSlot, band: EqBand): void {
    const key = JSON.stringify(band);
    if (key === slot.key && !slot.timer) return;
    slot.wanted = band;
    if (slot.timer) return;
    const wait = slot.lastSwap + BAND_SWAP - context.currentTime;
    if (wait > 0) {
      slot.timer = setTimeout(() => {
        slot.timer = null;
        if (this.context === context && slot.wanted) this.swapBand(context, slot, slot.wanted);
      }, wait * 1000);
      return;
    }
    this.swapBand(context, slot, band);
  }

  private swapBand(context: AudioContext, slot: BandSlot, band: EqBand): void {
    const key = JSON.stringify(band);
    if (key === slot.key) return;
    slot.key = key;
    slot.lastSwap = context.currentTime;
    const { b, a } = bandCoefficients(band, context.sampleRate);
    const filter = context.createIIRFilter(b, a);
    const gain = context.createGain();
    const now = context.currentTime;
    const old = slot.current;
    gain.gain.value = old ? 0 : 1;
    slot.input.connect(filter);
    filter.connect(gain);
    gain.connect(slot.output);
    slot.current = { filter, gain };
    if (!old) return;
    gain.gain.setTargetAtTime(1, now, BAND_FADE);
    old.gain.gain.setTargetAtTime(0, now, BAND_FADE);
    setTimeout(() => {
      for (const node of [old.filter, old.gain]) {
        try { node.disconnect(); } catch { /* already disconnected */ }
      }
    }, BAND_FADE * 10 * 1000);
  }

  private drop(id: string): void {
    const voice = this.voices.get(id);
    if (!voice) return;
    this.voices.delete(id);
    voice.player?.stop();
    for (const slot of voice.bands) {
      if (slot.timer) clearTimeout(slot.timer);
      slot.timer = null;
      if (slot.current) voice.nodes.push(slot.current.filter, slot.current.gain);
    }
    for (const source of voice.sources) {
      try { source.stop(); } catch { /* already stopped */ }
    }
    for (const node of voice.nodes) {
      try { node.disconnect(); } catch { /* already disconnected */ }
    }
  }
}
