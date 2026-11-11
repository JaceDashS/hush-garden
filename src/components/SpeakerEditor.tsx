/** Sound controls of one speaker. Every speaker has the same controls; there is only one kind of speaker. */
import React from "react";
import { ScrollView, View } from "react-native";
import { LIMITS, MAX_OSCILLATORS, type NoiseColor, type Speaker, type SpeakerSound, type Wave } from "../domain/sound";
import { EqGraph, type Spectrum } from "./EqGraph";
import { Btn, Chips, Input, Slider, T, colors } from "../ui";

const NOISES: { value: NoiseColor; label: string }[] = [
  { value: "white", label: "화이트" },
  { value: "pink", label: "핑크" },
  { value: "brown", label: "브라운" },
];
const WAVES: { value: Wave; label: string }[] = [
  { value: "sine", label: "사인" },
  { value: "triangle", label: "삼각" },
  { value: "square", label: "사각" },
  { value: "sawtooth", label: "톱니" },
];

const percent = (value: number) => Math.round(value * 100) + "%";
const hz = (value: number) => (value >= 1000 ? (value / 1000).toFixed(1) + " kHz" : Math.round(value) + " Hz");

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6, paddingTop: 10, borderTopWidth: 2, borderTopColor: colors.track }}>
      <T size={14} weight="800">{title}</T>
      {children}
    </View>
  );
}

/**
 * `onChange` receives the whole edited speaker. `carry` tells what the carry button does next: the character
 * walks over ("approaching"), holds the speaker ("carrying"), or neither. `readSpectrum` feeds the analyser.
 */
export function SpeakerEditor({ speaker, carry, onChange, onCarry, onDelete, onClose, readSpectrum }: { speaker: Speaker; carry: "idle" | "approaching" | "carrying"; onChange: (speaker: Speaker) => void; onCarry: () => void; onDelete: () => void; onClose: () => void; readSpectrum: () => Spectrum | null }) {
  const sound = speaker.sound;
  const set = (patch: Partial<SpeakerSound>) => onChange({ ...speaker, sound: { ...sound, ...patch } });
  const setOscillator = (index: number, patch: Partial<SpeakerSound["oscillators"][number]>) => set({ oscillators: sound.oscillators.map((item, i) => (i === index ? { ...item, ...patch } : item)) });
  return (
    <ScrollView testID="speaker-editor" style={{ flex: 1 }} contentContainerStyle={{ padding: 14, gap: 10 }} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Input label="스피커 이름" value={speaker.name} maxLength={24} onChangeText={(name) => onChange({ ...speaker, name })} testID="speaker-name" />
        </View>
        <Btn small title="닫기" onPress={onClose} />
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Btn small variant={carry === "idle" ? "plain" : "mint"} title={carry === "carrying" ? "여기에 내려놓기" : carry === "approaching" ? "가지러 가는 중…" : "들고 옮기기"} onPress={onCarry} testID="speaker-carry" />
        <Btn small variant="danger" title="삭제" onPress={onDelete} testID="speaker-delete" />
      </View>
      <Slider label="음량" value={sound.volume} min={0} max={1} format={percent} onChange={(volume) => set({ volume })} testID="speaker-volume" />
      <Slider label="들리는 거리" value={sound.radius} min={LIMITS.radius[0]} max={LIMITS.radius[1]} format={(v) => v.toFixed(1) + "칸"} onChange={(radius) => set({ radius })} />

      <Section title="노이즈">
        <Chips label="노이즈 종류" value={sound.noise.color} options={NOISES} onChange={(color) => set({ noise: { ...sound.noise, color } })} />
        <Slider label="노이즈 크기" value={sound.noise.level} min={0} max={1} format={percent} onChange={(level) => set({ noise: { ...sound.noise, level } })} />
      </Section>

      <Section title="저음">
        <Slider label="저음 주파수" value={sound.bass.frequency} min={LIMITS.bassFrequency[0]} max={LIMITS.bassFrequency[1]} format={hz} onChange={(frequency) => set({ bass: { ...sound.bass, frequency } })} />
        <Slider label="저음 크기" value={sound.bass.level} min={0} max={1} format={percent} onChange={(level) => set({ bass: { ...sound.bass, level } })} />
      </Section>

      <Section title="오실레이터">
        {sound.oscillators.map((oscillator, index) => (
          <View key={index} style={{ gap: 4, padding: 8, borderRadius: 14, backgroundColor: colors.white, borderWidth: 2, borderColor: colors.track }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <T size={12.5} weight="700" tone="muted">{"오실레이터 " + (index + 1)}</T>
              <Btn small title="빼기" onPress={() => set({ oscillators: sound.oscillators.filter((_, i) => i !== index) })} />
            </View>
            <Chips label="파형" value={oscillator.wave} options={WAVES} onChange={(wave) => setOscillator(index, { wave })} />
            <Slider label="주파수" log value={oscillator.frequency} min={LIMITS.oscillatorFrequency[0]} max={LIMITS.oscillatorFrequency[1]} format={hz} onChange={(frequency) => setOscillator(index, { frequency })} />
            <Slider label="크기" value={oscillator.level} min={0} max={1} format={percent} onChange={(level) => setOscillator(index, { level })} />
          </View>
        ))}
        {sound.oscillators.length < MAX_OSCILLATORS && (
          <Btn small title="오실레이터 추가" onPress={() => set({ oscillators: [...sound.oscillators, { wave: "sine", frequency: 220, level: 0.2 }] })} testID="oscillator-add" />
        )}
      </Section>

      <Section title="이퀄라이저">
        <EqGraph eq={sound.eq} onChange={(eq) => set({ eq })} readSpectrum={readSpectrum} />
      </Section>
    </ScrollView>
  );
}
