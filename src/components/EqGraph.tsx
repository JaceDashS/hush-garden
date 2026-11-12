/**
 * Graphical equalizer: one curve with three draggable points over a live spectrum. Drag a handle left and right
 * for frequency and up and down for gain; a cut handle only moves sideways. The selected point can be switched to
 * another filter kind and its Q is turned with a knob.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, View } from "react-native";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";
import { BAND_INDEXES, BAND_TYPES, EQ_LIMITS, dbToY, equalizerResponse, graphFrequencies, handleOf, hzToX, isCut, moveBand, setBandType, updateBand, xToHz, yToDb, type BandType, type Equalizer } from "../domain/equalizer";
import type { TextKey } from "../domain/text";
import { useT } from "../i18n";
import { Chips, Knob, NO_TOUCH_SCROLL, T, colors, useDragLock } from "../ui";

const HEIGHT = 180;
const POINTS = 96;
const GRAB_PIXELS = 36;
const SPECTRUM_MS = 80;
/** Spectrum levels between these dB values fill the graph from bottom to top. */
const SPECTRUM_DB = [-100, -10] as const;

const TYPE_LABELS: Record<BandType, TextKey> = { bell: "eq.type.bell", lowcut: "eq.type.lowcut", lowshelf: "eq.type.lowshelf", highshelf: "eq.type.highshelf", highcut: "eq.type.highcut" };
const BAND_COLORS = ["#e9728f", "#5fb893", "#6fa8dc"] as const;
const GRID_HZ = [50, 100, 200, 500, 1000, 2000, 5000, 10000];
const GRID_DB = [12, 0, -12, -24];

const hz = (value: number) => (value >= 1000 ? (value / 1000).toFixed(value >= 10000 ? 0 : 1) + " kHz" : Math.round(value) + " Hz");
const db = (value: number) => (value > 0 ? "+" : "") + value.toFixed(1) + " dB";

export interface Spectrum {
  db: Float32Array;
  maxHz: number;
}

/** Builds the filled spectrum outline for a graph of the given size. */
function spectrumPath(spectrum: Spectrum, frequencies: readonly number[], width: number): string {
  const bins = spectrum.db.length;
  let path = `M0 ${HEIGHT}`;
  frequencies.forEach((frequency, index) => {
    const bin = Math.min(bins - 1, Math.max(0, Math.round((frequency / spectrum.maxHz) * bins)));
    const level = Math.max(0, Math.min(1, (spectrum.db[bin] - SPECTRUM_DB[0]) / (SPECTRUM_DB[1] - SPECTRUM_DB[0])));
    path += ` L${((index / (frequencies.length - 1)) * width).toFixed(1)} ${(HEIGHT - level * HEIGHT).toFixed(1)}`;
  });
  return path + ` L${width} ${HEIGHT} Z`;
}

/**
 * `readSpectrum` returns the current analyser data, or null while no sound plays; it is polled a few times a second.
 */
export function EqGraph({ eq, onChange, readSpectrum }: { eq: Equalizer; onChange: (eq: Equalizer) => void; readSpectrum: () => Spectrum | null }) {
  const t = useT();
  const lock = useDragLock();
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState(1);
  const [spectrum, setSpectrum] = useState("");
  const frequencies = useMemo(() => graphFrequencies(POINTS), []);
  const root = useRef<React.ComponentRef<typeof View>>(null);
  const origin = useRef({ x: 0, y: 0 });
  const latest = useRef({ eq, width, onChange, readSpectrum, lock });
  latest.current = { eq, width, onChange, readSpectrum, lock };
  const dragging = useRef<number | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      const state = latest.current;
      const data = state.width > 0 ? state.readSpectrum() : null;
      setSpectrum(data ? spectrumPath(data, frequencies, state.width) : "");
    }, SPECTRUM_MS);
    return () => clearInterval(timer);
  }, [frequencies]);

  const responder = useMemo(() => {
    const local = (pageX: number, pageY: number) => ({ x: pageX - origin.current.x, y: pageY - origin.current.y });
    const drag = (pageX: number, pageY: number) => {
      const state = latest.current;
      const band = dragging.current;
      if (band === null || state.width <= 0) return;
      const at = local(pageX, pageY);
      state.onChange(moveBand(state.eq, band, xToHz(at.x / state.width), yToDb(at.y / HEIGHT)));
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => {
        const { pageX, pageY } = event.nativeEvent;
        latest.current.lock(true);
        root.current?.measureInWindow((x, y) => {
          origin.current = { x, y };
          const state = latest.current;
          const at = local(pageX, pageY);
          let best: number | null = null;
          let bestGap = GRAB_PIXELS;
          for (const band of BAND_INDEXES) {
            const handle = handleOf(state.eq, band);
            const gap = Math.hypot(hzToX(handle.hz) * state.width - at.x, dbToY(handle.db) * HEIGHT - at.y);
            if (gap < bestGap) {
              bestGap = gap;
              best = band;
            }
          }
          dragging.current = best;
          if (best !== null) setSelected(best);
        });
      },
      onPanResponderMove: (event) => drag(event.nativeEvent.pageX, event.nativeEvent.pageY),
      onPanResponderRelease: () => {
        dragging.current = null;
        latest.current.lock(false);
      },
      onPanResponderTerminate: () => {
        dragging.current = null;
        latest.current.lock(false);
      },
    });
  }, []);

  const curve = useMemo(() => {
    if (width <= 0) return "";
    return equalizerResponse(eq, frequencies)
      .map((gain, index) => `${index === 0 ? "M" : "L"}${((index / (POINTS - 1)) * width).toFixed(1)} ${(dbToY(gain) * HEIGHT).toFixed(1)}`)
      .join(" ");
  }, [eq, frequencies, width]);

  const handle = handleOf(eq, selected);
  const band = eq.bands[selected];
  const cut = isCut(band.type);
  return (
    <View style={{ gap: 6 }}>
      <View
        ref={root}
        testID="eq-graph"
        accessibilityLabel={t("eq.graph")}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        style={[{ height: HEIGHT, borderRadius: 14, overflow: "hidden", backgroundColor: "#3d3632" }, NO_TOUCH_SCROLL]}
        {...responder.panHandlers}
      >
        {width > 0 && (
          <Svg width={width} height={HEIGHT} pointerEvents="none">
            {GRID_HZ.map((value) => (
              <Line key={"x" + value} x1={hzToX(value) * width} x2={hzToX(value) * width} y1={0} y2={HEIGHT} stroke="rgba(255,250,242,0.10)" strokeWidth={1} />
            ))}
            {GRID_DB.map((value) => (
              <Line key={"y" + value} x1={0} x2={width} y1={dbToY(value) * HEIGHT} y2={dbToY(value) * HEIGHT} stroke={value === 0 ? "rgba(255,250,242,0.35)" : "rgba(255,250,242,0.10)"} strokeWidth={1} />
            ))}
            {[100, 1000, 10000].map((value) => (
              <SvgText key={"t" + value} x={hzToX(value) * width + 3} y={HEIGHT - 4} fontSize={9} fill="rgba(255,250,242,0.55)">{value >= 1000 ? value / 1000 + "k" : String(value)}</SvgText>
            ))}
            {!!spectrum && <Path d={spectrum} fill="rgba(143,214,180,0.28)" stroke="rgba(143,214,180,0.6)" strokeWidth={1} />}
            <Path d={curve} fill="none" stroke={colors.butter} strokeWidth={2.5} strokeLinejoin="round" />
            {BAND_INDEXES.map((band, index) => {
              const at = handleOf(eq, band);
              const active = band === selected;
              return (
                <React.Fragment key={index}>
                  <Circle cx={hzToX(at.hz) * width} cy={dbToY(at.db) * HEIGHT} r={active ? 13 : 11} fill={BAND_COLORS[band]} stroke={colors.white} strokeWidth={active ? 3 : 1.5} />
                  <SvgText x={hzToX(at.hz) * width} y={dbToY(at.db) * HEIGHT + 3.5} fontSize={10} fontWeight="700" fill={colors.white} textAnchor="middle">{String(index + 1)}</SvgText>
                </React.Fragment>
              );
            })}
          </Svg>
        )}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <T size={12.5} weight="800">{t("eq.point", { n: selected + 1 }) + " · " + t(TYPE_LABELS[band.type])}</T>
        <T size={12.5} weight="700" tone="muted">{hz(handle.hz) + (cut ? "" : " · " + db(handle.db))}</T>
      </View>
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <View style={{ flex: 1, minWidth: 0 }} testID="eq-type">
          <Chips label={t("eq.type")} value={band.type} options={BAND_TYPES.map((type) => ({ value: type, label: t(TYPE_LABELS[type]) }))} onChange={(type) => onChange(setBandType(eq, selected, type))} />
        </View>
        <Knob label={t("eq.q")} log value={band.q} min={EQ_LIMITS.q[0]} max={EQ_LIMITS.q[1]} format={(value) => value.toFixed(2)} color={BAND_COLORS[selected]} onChange={(q) => onChange(updateBand(eq, selected, { q }))} testID="eq-q" />
      </View>
      <T size={11.5} tone="muted">{t("eq.help")}</T>
    </View>
  );
}
