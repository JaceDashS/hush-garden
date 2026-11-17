/**
 * Sound controls of the speaker the character holds. The Sound tab chooses what the speaker plays: the
 * synthesiser, or a nature source, which has only a volume and no other tabs. The synthesiser's controls are
 * split into three tabs so each fits a phone screen, and the page does not scroll while a
 * slider, a knob or an equalizer point is being dragged. All three tabs are kept laid out, so switching shows a
 * tab at once and fully drawn, and the editor itself appears only once it is ready.
 */
import React, { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { LIMITS, MAX_OSCILLATORS, NATURE_SOURCES, NOISE_COLORS, WAVES, baseLevel, defaultOscillator, isMono, isSynth, lookOf, reachOf, withMono, withSource, type Oscillator, type NatureSound, type NatureSource, type SoundSource, type Speaker, type SpeakerSound, type SynthSound } from "../domain/sound";
import { SHADOW_TINT, SourceArt, WavePicture } from "../game/sprites";
import { useT } from "../i18n";
import { Btn, Chips, DragLockContext, HIDDEN_READY, IconBtn, Input, Knob, Prepared, Slider, T, Tabs, colors } from "../ui";
import { DEFAULT_TEMPO, RECORDINGS, TEMPO, hasTempo } from "../domain/recordings";
import { EqGraph, type Spectrum } from "./EqGraph";

type Tab = "sound" | "osc" | "eq";
const CHANNELS = ["stereo", "mono"] as const;

/** Panel names and colours in the order of the stored oscillators. */
const PANELS = [
  { name: "OSC A", color: "#5fb893", glow: "#8fd6b4" },
  { name: "OSC B", color: "#e9728f", glow: "#ff9eb5" },
] as const;

const DISPLAY = "#3d3632";
/** The shown tab is in the flow; the others are laid out on top of it, invisible, ready to be switched to. */
const pane = (shown: boolean) => (shown ? { gap: 10 } : { gap: 10, position: "absolute" as const, left: 12, right: 12, top: 12, ...HIDDEN_READY });
const percent = (value: number) => Math.round(value * 100) + "%";
const hz = (value: number) => (value >= 1000 ? (value / 1000).toFixed(2) + " kHz" : Math.round(value) + " Hz");

/**
 * One oscillator in the manner of a synthesiser panel: a display that draws the wave, picture buttons to choose
 * the wave, and knobs for frequency and level. The wave in the display grows taller with the level.
 */
function OscillatorPanel({ index, oscillator, onChange, onRemove }: { index: number; oscillator: Oscillator; onChange: (patch: Partial<Oscillator>) => void; onRemove: () => void }) {
  const t = useT();
  const [width, setWidth] = useState(0);
  const panel = PANELS[index];
  const height = 26 + 34 * Math.max(0.12, oscillator.level);
  return (
    <View testID={"oscillator-" + index} style={{ borderRadius: 16, backgroundColor: colors.white, borderWidth: 2, borderColor: colors.track, padding: 8, gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ backgroundColor: panel.color, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 2 }}>
          <T size={12.5} weight="800" tone="white">{panel.name}</T>
        </View>
        <IconBtn size={32} label={t("osc.remove", { name: panel.name })} onPress={onRemove} testID={"oscillator-remove-" + index}>
          <Svg width={14} height={14} viewBox="0 0 14 14" pointerEvents="none">
            <Path d="M2 2 L12 12 M12 2 L2 12" stroke={colors.ink} strokeWidth={2.5} strokeLinecap="round" />
          </Svg>
        </IconBtn>
      </View>
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <View style={{ flex: 1, gap: 6, minWidth: 0 }}>
          <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={{ height: 64, borderRadius: 10, backgroundColor: DISPLAY, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            {width > 0 && <WavePicture wave={oscillator.wave} width={width} height={height} color={panel.glow} cycles={2} />}
          </View>
          <View accessibilityRole="radiogroup" accessibilityLabel={t("osc.wave")} style={{ flexDirection: "row", gap: 4 }}>
            {WAVES.map((wave) => {
              const selected = wave === oscillator.wave;
              return (
                <Pressable key={wave} accessibilityRole="radio" accessibilityLabel={t(("wave." + wave) as "wave.sine")} accessibilityState={{ selected }} testID={"wave-" + index + "-" + wave} onPress={() => onChange({ wave })} style={{ flex: 1, height: 40, borderRadius: 10, borderWidth: 2, borderColor: selected ? panel.color : colors.panelEdge, backgroundColor: selected ? "#eef8f2" : colors.white, alignItems: "center", justifyContent: "center" }}>
                  <WavePicture wave={wave} width={30} height={22} color={selected ? colors.ink : colors.muted} strokeWidth={2.2} />
                </Pressable>
              );
            })}
          </View>
        </View>
        <Knob label={t("osc.frequency")} log value={oscillator.frequency} min={LIMITS.oscillatorFrequency[0]} max={LIMITS.oscillatorFrequency[1]} format={hz} color={panel.color} scrollStep={Math.max(1, Math.round(oscillator.frequency * 0.02))} onChange={(frequency) => onChange({ frequency })} testID={"oscillator-frequency-" + index} />
        <Knob label={t("osc.level")} value={oscillator.level} min={0} max={1} format={percent} color={panel.color} onChange={(level) => onChange({ level })} testID={"oscillator-level-" + index} />
      </View>
    </View>
  );
}

/** The pictures to choose what a speaker plays: the synthesiser speaker and each nature source. */
/** `locked` keeps nature sources from being chosen while their recordings are still downloading. */
function SourcePicker({ value, onChange, locked }: { value: SoundSource; onChange: (source: SoundSource) => void; locked: boolean }) {
  const t = useT();
  const sources: SoundSource[] = ["synth", ...NATURE_SOURCES];
  return (
    <View style={{ gap: 6 }}>
      <T size={12.5} tone="muted" weight="700">{t("source.label") + " · " + t(("source." + value) as "source.synth")}</T>
      <View accessibilityRole="radiogroup" style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {sources.map((source) => {
          const selected = source === value;
          const disabled = locked && source !== "synth" && !selected;
          return (
            <Pressable key={source} accessibilityRole="radio" accessibilityLabel={t(("source." + source) as "source.synth")} accessibilityState={{ selected, disabled }} disabled={disabled} testID={"source-" + source} onPress={() => onChange(source)} style={{ opacity: disabled ? 0.35 : 1, width: 50, height: 56, borderRadius: 12, borderWidth: 2, borderColor: selected ? colors.mintDeep : colors.panelEdge, backgroundColor: selected ? colors.mint : colors.white, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              <View pointerEvents="none" style={{ width: 60, height: 76, transform: [{ scale: 0.62 }] }}>
                <SourceArt look={source === "synth" ? "brown" : source} shadow={false} still />
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** `onChange` receives the whole edited speaker. `readSpectrum` feeds the analyser behind the equalizer curve. */
export function SpeakerEditor({ speaker, onChange, onClose, readSpectrum, natureLock = null }: { speaker: Speaker; onChange: (speaker: Speaker) => void; onClose: () => void; readSpectrum: () => Spectrum | null; natureLock?: "loading" | "failed" | "declined" | null }) {
  const natureReady = natureLock === null;
  const t = useT();
  const [tab, setTab] = useState<Tab>("sound");
  const [dragging, setDragging] = useState(false);
  const sound = speaker.sound;
  const synth = isSynth(sound) ? sound : null;
  const shown: Tab = tab;
  // Oscillators and equalizer belong to every source; the Sound tab volume is the noise's or the recording's.
  const set = (patch: Partial<Pick<SpeakerSound, "oscillators" | "eq">>) => onChange({ ...speaker, sound: { ...sound, ...patch } });
  const setNoise = (patch: Partial<SynthSound["noise"]>) => synth && onChange({ ...speaker, sound: { ...synth, noise: { ...synth.noise, ...patch } } });
  const setBaseLevel = (level: number) => (isSynth(sound) ? setNoise({ level }) : onChange({ ...speaker, sound: { ...sound, level } }));
  const setNature = (patch: Partial<Pick<NatureSound, "recording" | "tempo">>) => !isSynth(sound) && onChange({ ...speaker, sound: { ...sound, ...patch } });
  const recordings = synth ? [] : RECORDINGS[sound.source as NatureSource];
  const setOscillator = (index: number, patch: Partial<Oscillator>) => set({ oscillators: sound.oscillators.map((item, i) => (i === index ? { ...item, ...patch } : item)) });
  const next = sound.oscillators.length;
  return (
    <DragLockContext.Provider value={setDragging}>
      <Prepared style={{ flex: 1 }}>
      <View testID="speaker-editor" style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: 12, paddingTop: 10, gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Input label={t("editor.name")} value={speaker.name} maxLength={24} onChangeText={(name) => onChange({ ...speaker, name })} testID="speaker-name" />
            </View>
            <Btn small title={t("common.close")} onPress={onClose} testID="editor-close" />
          </View>
          <Tabs value={tab} onChange={setTab} options={[{ value: "sound", label: t("tab.sound") }, { value: "osc", label: t("tab.osc") }, { value: "eq", label: t("tab.eq") }]} />
        </View>
        <ScrollView style={{ flex: 1 }} scrollEnabled={!dragging} contentContainerStyle={{ padding: 12, gap: 10 }} keyboardShouldPersistTaps="handled">
          <View style={pane(shown === "sound")} pointerEvents={shown === "sound" ? "auto" : "none"}>
              <SourcePicker value={sound.source} locked={!natureReady} onChange={(source) => onChange({ ...speaker, sound: withSource(sound, source) })} />
              {!natureReady && <T size={12} tone="muted">{t(natureLock === "failed" ? "patch.lockedFailed" : natureLock === "declined" ? "patch.lockedDeclined" : "patch.locked")}</T>}
              {/* Where the synthesiser chooses its noise colour, a nature source chooses its recording, and the heartbeat its tempo. */}
              {(synth || recordings.length > 1) && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 6, borderTopWidth: 2, borderTopColor: colors.track }}>
                  <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: SHADOW_TINT[lookOf(sound)], borderWidth: 2, borderColor: colors.ink }} />
                  {synth ? (
                    <Chips label={t("noise.kind")} value={synth.noise.color} options={NOISE_COLORS.map((color) => ({ value: color, label: t(("noise." + color) as "noise.white") }))} onChange={(color) => setNoise({ color })} />
                  ) : (
                    <Chips label={t("source.recording")} value={(sound as NatureSound).recording} options={recordings.map((item, index) => ({ value: item.id, label: t("source.recordingN", { n: index + 1 }) }))} onChange={(recording) => setNature({ recording })} />
                  )}
                </View>
              )}
              {!isSynth(sound) && hasTempo(sound.source) && (
                <Slider label={t("source.tempo")} value={sound.tempo ?? DEFAULT_TEMPO} min={TEMPO[0]} max={TEMPO[1]} format={(v) => Math.round(v) + " BPM"} onChange={(tempo) => setNature({ tempo: Math.round(tempo) })} testID="heartbeat-tempo" />
              )}
              <Slider label={t(synth ? "noise.level" : "source.level")} value={baseLevel(sound)} min={0} max={1} format={percent} onChange={setBaseLevel} testID="base-level" />
              <T size={12} tone="muted">{t("editor.reach", { n: reachOf(sound).toFixed(1) })}</T>
              <View style={{ gap: 6, paddingTop: 6, borderTopWidth: 2, borderTopColor: colors.track }}>
                <T size={12.5} tone="muted" weight="700">{t("channel.label")}</T>
                <Chips
                  label={t("channel.label")}
                  value={isMono(sound) ? "mono" : "stereo"}
                  options={CHANNELS.map((channel) => ({ value: channel, label: t(("channel." + channel) as "channel.stereo") }))}
                  onChange={(channel) => onChange({ ...speaker, sound: withMono(sound, channel === "mono") })}
                  testID="speaker-channel"
                />
                <T size={12} tone="muted">{t("channel.help")}</T>
              </View>
          </View>
          <View style={pane(shown === "osc")} pointerEvents={shown === "osc" ? "auto" : "none"}>
              {sound.oscillators.length === 0 && <T size={12.5} tone="muted">{t("osc.empty")}</T>}
              {sound.oscillators.map((oscillator, index) => (
                <OscillatorPanel key={index} index={index} oscillator={oscillator} onChange={(patch) => setOscillator(index, patch)} onRemove={() => set({ oscillators: sound.oscillators.filter((_, i) => i !== index) })} />
              ))}
              {next < MAX_OSCILLATORS && <Btn small title={t("osc.add", { name: PANELS[next].name })} onPress={() => set({ oscillators: [...sound.oscillators, defaultOscillator(next)] })} testID="oscillator-add" />}
          </View>
          <View style={pane(shown === "eq")} pointerEvents={shown === "eq" ? "auto" : "none"}>
            <EqGraph eq={sound.eq} active={shown === "eq"} onChange={(eq) => set({ eq })} readSpectrum={readSpectrum} />
          </View>
        </ScrollView>
      </View>
      </Prepared>
    </DragLockContext.Provider>
  );
}
