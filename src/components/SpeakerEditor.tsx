/**
 * Sound controls of the speaker the character holds. Every speaker has the same controls; there is only one kind.
 * The controls are split into three tabs so each fits a phone screen, and the page does not scroll while a
 * slider, a knob or an equalizer point is being dragged.
 */
import React, { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { LIMITS, MAX_OSCILLATORS, NOISE_COLORS, WAVES, defaultOscillator, reachOf, type Oscillator, type Speaker, type SpeakerSound } from "../domain/sound";
import { SHADOW_TINT, WavePicture } from "../game/sprites";
import { useT } from "../i18n";
import { Btn, Chips, DragLockContext, IconBtn, Input, Knob, Slider, T, Tabs, colors } from "../ui";
import { EqGraph, type Spectrum } from "./EqGraph";

type Tab = "sound" | "osc" | "eq";

/** Panel names and colours in the order of the stored oscillators. */
const PANELS = [
  { name: "OSC A", color: "#5fb893", glow: "#8fd6b4" },
  { name: "OSC B", color: "#e9728f", glow: "#ff9eb5" },
] as const;

const DISPLAY = "#3d3632";
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
        <Knob label={t("osc.frequency")} log value={oscillator.frequency} min={LIMITS.oscillatorFrequency[0]} max={LIMITS.oscillatorFrequency[1]} format={hz} color={panel.color} onChange={(frequency) => onChange({ frequency })} testID={"oscillator-frequency-" + index} />
        <Knob label={t("osc.level")} value={oscillator.level} min={0} max={1} format={percent} color={panel.color} onChange={(level) => onChange({ level })} testID={"oscillator-level-" + index} />
      </View>
    </View>
  );
}

/** `onChange` receives the whole edited speaker. `readSpectrum` feeds the analyser behind the equalizer curve. */
export function SpeakerEditor({ speaker, onChange, onClose, readSpectrum }: { speaker: Speaker; onChange: (speaker: Speaker) => void; onClose: () => void; readSpectrum: () => Spectrum | null }) {
  const t = useT();
  const [tab, setTab] = useState<Tab>("sound");
  const [dragging, setDragging] = useState(false);
  const sound = speaker.sound;
  const set = (patch: Partial<SpeakerSound>) => onChange({ ...speaker, sound: { ...sound, ...patch } });
  const setOscillator = (index: number, patch: Partial<Oscillator>) => set({ oscillators: sound.oscillators.map((item, i) => (i === index ? { ...item, ...patch } : item)) });
  const next = sound.oscillators.length;
  return (
    <DragLockContext.Provider value={setDragging}>
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
          {tab === "sound" && (
            <>
              <Slider label={t("editor.volume")} value={sound.volume} min={0} max={1} format={percent} onChange={(volume) => set({ volume })} testID="speaker-volume" />
              <T size={12} tone="muted">{t("editor.reach", { n: reachOf(sound).toFixed(1) })}</T>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 6, borderTopWidth: 2, borderTopColor: colors.track }}>
                <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: SHADOW_TINT[sound.noise.color], borderWidth: 2, borderColor: colors.ink }} />
                <Chips label={t("noise.kind")} value={sound.noise.color} options={NOISE_COLORS.map((color) => ({ value: color, label: t(("noise." + color) as "noise.white") }))} onChange={(color) => set({ noise: { ...sound.noise, color } })} />
              </View>
              <Slider label={t("noise.level")} value={sound.noise.level} min={0} max={1} format={percent} onChange={(level) => set({ noise: { ...sound.noise, level } })} testID="noise-level" />
            </>
          )}
          {tab === "osc" && (
            <>
              {sound.oscillators.length === 0 && <T size={12.5} tone="muted">{t("osc.empty")}</T>}
              {sound.oscillators.map((oscillator, index) => (
                <OscillatorPanel key={index} index={index} oscillator={oscillator} onChange={(patch) => setOscillator(index, patch)} onRemove={() => set({ oscillators: sound.oscillators.filter((_, i) => i !== index) })} />
              ))}
              {next < MAX_OSCILLATORS && <Btn small title={t("osc.add", { name: PANELS[next].name })} onPress={() => set({ oscillators: [...sound.oscillators, defaultOscillator(next)] })} testID="oscillator-add" />}
            </>
          )}
          {tab === "eq" && <EqGraph eq={sound.eq} onChange={(eq) => set({ eq })} readSpectrum={readSpectrum} />}
        </ScrollView>
      </View>
    </DragLockContext.Provider>
  );
}
