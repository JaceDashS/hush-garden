/** Sound controls of one speaker. Every speaker has the same controls; there is only one kind of speaker. */
import React from "react";
import { ScrollView, View } from "react-native";
import { LIMITS, MAX_OSCILLATORS, type NoiseColor, type Speaker, type SpeakerSound, type Wave } from "../domain/sound";
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
const db = (value: number) => (value > 0 ? "+" : "") + value.toFixed(1) + " dB";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6, paddingTop: 10, borderTopWidth: 2, borderTopColor: colors.track }}>
      <T size={14} weight="800">{title}</T>
      {children}
    </View>
  );
}

/**
 * `onChange` receives the whole edited speaker. `moving` is true while the next tap on the ground moves it.
 */
export function SpeakerEditor({ speaker, moving, onChange, onMove, onDelete, onClose }: { speaker: Speaker; moving: boolean; onChange: (speaker: Speaker) => void; onMove: () => void; onDelete: () => void; onClose: () => void }) {
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
        <Btn small variant={moving ? "mint" : "plain"} title={moving ? "옮길 곳을 누르세요" : "위치 옮기기"} onPress={onMove} testID="speaker-move" />
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

      <Section title="EQ">
        <Slider label="낮은 음 (200 Hz 아래)" value={sound.eq.low} min={LIMITS.eqGain[0]} max={LIMITS.eqGain[1]} format={db} onChange={(low) => set({ eq: { ...sound.eq, low } })} />
        <Slider label="중간 음 위치" log value={sound.eq.mid.frequency} min={LIMITS.midFrequency[0]} max={LIMITS.midFrequency[1]} format={hz} onChange={(frequency) => set({ eq: { ...sound.eq, mid: { ...sound.eq.mid, frequency } } })} />
        <Slider label="중간 음 세기" value={sound.eq.mid.gain} min={LIMITS.eqGain[0]} max={LIMITS.eqGain[1]} format={db} onChange={(gain) => set({ eq: { ...sound.eq, mid: { ...sound.eq.mid, gain } } })} />
        <Slider label="중간 음 폭 (Q)" log value={sound.eq.mid.q} min={LIMITS.midQ[0]} max={LIMITS.midQ[1]} format={(v) => v.toFixed(2)} onChange={(q) => set({ eq: { ...sound.eq, mid: { ...sound.eq.mid, q } } })} />
        <Slider label="높은 음 (4 kHz 위)" value={sound.eq.high} min={LIMITS.eqGain[0]} max={LIMITS.eqGain[1]} format={db} onChange={(high) => set({ eq: { ...sound.eq, high } })} />
      </Section>

      <Section title="필터">
        <Slider label="이 아래 소리 자르기" log value={sound.filter.highpass} min={LIMITS.highpass[0]} max={LIMITS.highpass[1]} format={hz} onChange={(highpass) => set({ filter: { highpass, lowpass: Math.max(highpass, sound.filter.lowpass) } })} />
        <Slider label="이 위 소리 자르기" log value={sound.filter.lowpass} min={LIMITS.lowpass[0]} max={LIMITS.lowpass[1]} format={hz} onChange={(lowpass) => set({ filter: { highpass: Math.min(sound.filter.highpass, lowpass), lowpass } })} />
      </Section>
    </ScrollView>
  );
}
