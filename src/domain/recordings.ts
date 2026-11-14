/**
 * The recordings each nature source can play, chosen by the user from Freesound, and how they are credited.
 * A sound stores the id of its recording; ids are the Freesound sound ids, so they stay the same when the list
 * changes. The first recording of a source is its default. The platform server keeps the same ids in
 * services/api/src/services/hushGarden/rules.ts.
 */
import type { NatureSource } from "./sound";

export interface Recording {
  id: string;
  title: string;
  author: string;
  /** CC0 needs no credit; CC BY 4.0 must be credited in the app. */
  license: "CC0" | "CC BY 4.0";
  page: string;
}

export const RECORDINGS: Record<NatureSource, readonly Recording[]> = {
  rain: [
    { id: "fs-757276", title: "Gentle Rain on Leaves with Soft Wind and Suburban Ambience", author: "Garuda1982", license: "CC0", page: "https://freesound.org/people/Garuda1982/sounds/757276/" },
    { id: "fs-369547", title: "Rain and Thunder Ambience Tübingen", author: "Sheyvan", license: "CC0", page: "https://freesound.org/people/Sheyvan/sounds/369547/" },
    { id: "fs-737691", title: "Ambience, Heavy rain, Thunder 02", author: "LiangXuan", license: "CC0", page: "https://freesound.org/people/LiangXuan/sounds/737691/" },
  ],
  stream: [
    { id: "fs-517145", title: "Franklin Park Stream, Mid day, Spring, Sunny.mp3", author: "kilduffm", license: "CC0", page: "https://freesound.org/people/kilduffm/sounds/517145/" },
    { id: "fs-185987", title: "Little stream & whooshing wind", author: "morosopher", license: "CC0", page: "https://freesound.org/people/morosopher/sounds/185987/" },
    { id: "fs-730828", title: "stream", author: "alenym7", license: "CC0", page: "https://freesound.org/people/alenym7/sounds/730828/" },
  ],
  waterfall: [
    { id: "fs-693486", title: "WATRFall_Small Waterfall_GILLE_GRAZ_ZoomH3_AFormat.wav", author: "JakobGille", license: "CC0", page: "https://freesound.org/people/JakobGille/sounds/693486/" },
    { id: "fs-135927", title: "Waterfalls2.aif", author: "cybergenic", license: "CC0", page: "https://freesound.org/people/cybergenic/sounds/135927/" },
    { id: "fs-660266", title: "Waterfalls", author: "samlodor", license: "CC0", page: "https://freesound.org/people/samlodor/sounds/660266/" },
  ],
  reeds: [
    { id: "fs-665640", title: "Wind in grass, recording close to the ground, with gust of wind, bird and insect singing, cars passing sometimes, a plane far away recorded in Tallgrass Prairie in Oklahoma", author: "felix.blume", license: "CC0", page: "https://freesound.org/people/felix.blume/sounds/665640/" },
    { id: "fs-808211", title: "River with Reeds in Wind", author: "The_25_Times", license: "CC0", page: "https://freesound.org/people/The_25_Times/sounds/808211/" },
    { id: "fs-737579", title: "Seaside Docks_Birds, reed, wind", author: "cribbler", license: "CC0", page: "https://freesound.org/people/cribbler/sounds/737579/" },
  ],
  airplane: [
    { id: "fs-457065", title: "AIRPLANE_JET_FLYING.wav", author: "keng-wai-chane-chick-te", license: "CC0", page: "https://freesound.org/people/keng-wai-chane-chick-te/sounds/457065/" },
  ],
  campfire: [
    { id: "fs-501417", title: "Aachen_Burning Fireplace Crackling Fire Sounds.wav", author: "visionear", license: "CC0", page: "https://freesound.org/people/visionear/sounds/501417/" },
    { id: "fs-410917", title: "Relaxing fire sounds", author: "arczi19", license: "CC0", page: "https://freesound.org/people/arczi19/sounds/410917/" },
    { id: "fs-528079", title: "small to big fire.wav", author: "bruno.auzet", license: "CC0", page: "https://freesound.org/people/bruno.auzet/sounds/528079/" },
  ],
  waves: [
    { id: "fs-362300", title: "2016-10-11-DR-05-Ocean Waves-EDITED.wav", author: "kingsrow", license: "CC0", page: "https://freesound.org/people/kingsrow/sounds/362300/" },
    { id: "fs-635404", title: "Tampa Ocean Waves.wav", author: "hotemogf", license: "CC0", page: "https://freesound.org/people/hotemogf/sounds/635404/" },
    { id: "fs-868990", title: "Waves and Strong Wind at Night - Rémire-Montjoly, French Guiana", author: "felix.blume", license: "CC0", page: "https://freesound.org/people/felix.blume/sounds/868990/" },
  ],
  cafe: [
    { id: "fs-190941", title: "Restaurant Sounds (Sunny Point Cafe)", author: "Hitrison", license: "CC0", page: "https://freesound.org/people/Hitrison/sounds/190941/" },
    { id: "fs-732984", title: "Cafe Ambience", author: "bittermelonheart", license: "CC0", page: "https://freesound.org/people/bittermelonheart/sounds/732984/" },
  ],
  train: [
    { id: "fs-569165", title: "Subway Train Ambience, Brooklyn to Manhattan", author: "gravity_proof", license: "CC0", page: "https://freesound.org/people/gravity_proof/sounds/569165/" },
    { id: "fs-838070", title: "Tricity Train Ride", author: "one_moment", license: "CC0", page: "https://freesound.org/people/one_moment/sounds/838070/" },
    { id: "fs-525057", title: "trainride inside recording", author: "gecop", license: "CC0", page: "https://freesound.org/people/gecop/sounds/525057/" },
  ],
  heartbeat: [
    { id: "fs-266531", title: "Heartbeat", author: "acertingart", license: "CC BY 4.0", page: "https://freesound.org/people/acertingart/sounds/266531/" },
  ],
};

/** Tempo range and default of the heartbeat, in beats per minute. */
export const TEMPO = [40, 120] as const;
export const DEFAULT_TEMPO = 60;

/** The sources whose recording is not crossfaded but played beat by beat at a tempo. */
export const hasTempo = (source: NatureSource): boolean => source === "heartbeat";
export const defaultRecording = (source: NatureSource): string => RECORDINGS[source][0].id;
export const recordingOf = (source: NatureSource, id: unknown): string => (RECORDINGS[source].some((item) => item.id === id) ? (id as string) : defaultRecording(source));
