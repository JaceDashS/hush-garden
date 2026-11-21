/**
 * A character drawn from its image map. Until the image has loaded the scene shows a drawn stand-in with a
 * loading mark; the image itself is cached by the browser or the native image cache.
 */
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, View } from "react-native";
import Svg, { Circle, Ellipse, Path } from "react-native-svg";
import { API_ORIGIN } from "../config";
import type { ActionName } from "../domain/actions";
import { WALK_FRAME_MS, nextWalkFrame } from "../domain/characters";
import { SHEET, fallbackKind, sheetFrame, sheetUrl } from "../domain/imageCharacters";
import { colors } from "../ui";
import { CHARACTER_FEET, CHARACTER_SIZE, Character } from "./characters";

/** Frames are drawn at half size: 64 px, a little larger than the 56 × 64 drawn characters. */
const SCALE = 0.5;
const FRAME = SHEET.frame * SCALE;
/** Where the frame window sits so that its foot point lands on the drawn characters' feet. */
const WINDOW = { left: CHARACTER_FEET.x - SHEET.foot.x * SCALE, top: CHARACTER_FEET.y - SHEET.foot.y * SCALE };
const RETRY_MS = 30_000;

/** Ids whose image has loaded in this session, so a character met again is drawn at once. */
const loadedSheets = new Set<string>();

/**
 * Whether the image of `id` has loaded, and an invisible element that loads it. A failed load is tried again
 * after 30 seconds.
 */
export function useSheet(id: string | undefined): { ready: boolean; loader: React.ReactNode } {
  const [ready, setReady] = useState(() => !!id && loadedSheets.has(id));
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setReady(!!id && loadedSheets.has(id));
    setFailed(false);
  }, [id]);
  useEffect(() => {
    if (!failed) return;
    const timer = setTimeout(() => {
      setFailed(false);
      setAttempt((value) => value + 1);
    }, RETRY_MS);
    return () => clearTimeout(timer);
  }, [failed]);
  if (!id || ready) return { ready, loader: null };
  const loader = failed ? null : (
    <Image
      key={id + ":" + attempt}
      source={{ uri: sheetUrl(API_ORIGIN, id) }}
      style={{ position: "absolute", width: 2, height: 2, opacity: 0 }}
      onLoad={() => {
        loadedSheets.add(id);
        setReady(true);
      }}
      onError={() => setFailed(true)}
    />
  );
  return { ready, loader };
}

/** The loading mark shown above an image character's name until its image has loaded. */
export function SheetLoading() {
  return (
    <View pointerEvents="none" testID="character-loading" style={{ backgroundColor: "rgba(255,250,242,0.92)", borderRadius: 12, padding: 3 }}>
      <ActivityIndicator size="small" color={colors.ink} />
    </View>
  );
}

/** The ground shadow under a character, as the drawn characters have it. */
function Shadow() {
  return (
    <Svg width={CHARACTER_SIZE.width} height={CHARACTER_SIZE.height} viewBox="0 0 56 64" pointerEvents="none" style={{ position: "absolute", left: 0, top: 0 }}>
      <Ellipse cx={CHARACTER_FEET.x} cy={CHARACTER_FEET.y} rx={17} ry={4.5} fill="rgba(74,64,56,0.18)" />
    </Svg>
  );
}

/** One frame of the image map, facing right or (mirrored) left, with its feet on the drawn characters' feet. */
export function SheetFrame({ id, row, column, facing = 1 }: { id: string; row: number; column: number; facing?: 1 | -1 }) {
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: WINDOW.left, top: WINDOW.top, width: FRAME, height: FRAME, overflow: "hidden", transform: [{ scaleX: facing }] }}>
      <Image source={{ uri: sheetUrl(API_ORIGIN, id) }} style={{ position: "absolute", left: -column * FRAME, top: -row * FRAME, width: SHEET.width * SCALE, height: SHEET.height * SCALE }} />
    </View>
  );
}

/** Crisp earmuff badge placed at the top corner of custom sprite characters so artwork is never obscured. */
function CustomEarmuffBadge() {
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        right: -4,
        top: 0,
        width: 24,
        height: 20,
        borderRadius: 10,
        backgroundColor: "rgba(255,250,242,0.95)",
        borderWidth: 1.5,
        borderColor: "#4a4038",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Svg width={18} height={16} viewBox="0 0 18 16">
        <Path d="M3.5 10 C3.5 4, 14.5 4, 14.5 10" stroke="#4a4038" strokeWidth={2.2} fill="none" strokeLinecap="round" />
        <Path d="M3.5 10 C3.5 4, 14.5 4, 14.5 10" stroke="#e9728f" strokeWidth={1.2} fill="none" strokeLinecap="round" />
        <Ellipse cx={3.5} cy={10.5} rx={2.2} ry={3} fill="#ff9eb5" stroke="#4a4038" strokeWidth={1.2} />
        <Ellipse cx={14.5} cy={10.5} rx={2.2} ry={3} fill="#ff9eb5" stroke="#4a4038" strokeWidth={1.2} />
        <Circle cx={3} cy={9.6} r={0.6} fill="#ffffff" />
        <Circle cx={14} cy={9.6} r={0.6} fill="#ffffff" />
      </Svg>
    </View>
  );
}

/**
 * An image character in the scene. It walks with its own timer like the drawn characters; `action` is the
 * action being played and how far it is. `sheet` comes from `useSheet(id)` of the caller, which also shows the
 * loading mark; until the image is ready the drawn stand-in for its id is shown.
 */
export function ImageCharacter({ id, sheet, facing = 1, walking = false, carrying = false, muted = false, action }: { id: string; sheet: { ready: boolean; loader: React.ReactNode }; facing?: 1 | -1; walking?: boolean; carrying?: boolean; muted?: boolean; action?: { name: ActionName; progress: number } }) {
  const [frame, setFrame] = useState(0);
  const { ready, loader } = sheet;
  useEffect(() => {
    if (!walking) return;
    setFrame(0);
    const timer = setInterval(() => setFrame(nextWalkFrame), WALK_FRAME_MS);
    return () => clearInterval(timer);
  }, [walking]);
  if (!ready) {
    return (
      <View style={{ width: CHARACTER_SIZE.width, height: CHARACTER_SIZE.height }}>
        <Character kind={fallbackKind(id)} facing={facing} walking={walking} carrying={carrying || action?.name === "lift"} muted={muted} />
        {loader}
      </View>
    );
  }
  const { row, column } = sheetFrame({ walking, carrying, frame, action });
  return (
    <View style={{ width: CHARACTER_SIZE.width, height: CHARACTER_SIZE.height }}>
      <Shadow />
      <SheetFrame id={id} row={row} column={column} facing={facing} />
      {muted && <CustomEarmuffBadge />}
    </View>
  );
}
