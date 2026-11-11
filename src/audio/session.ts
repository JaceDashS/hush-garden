/**
 * Keeps sound playing while the phone app is in the background. iOS needs the playback audio session category;
 * Android needs the media notification, which runs the foreground service declared by the audio plugin in
 * app.config.js. In the browser these calls do nothing, and a backgrounded browser tab may be paused by the OS.
 */
import { Platform } from "react-native";
import { AudioManager, PlaybackNotificationManager } from "react-native-audio-api";

let configured = false;

/** Call once before the first sound. */
export function configureSession(): void {
  if (configured || Platform.OS === "web") return;
  configured = true;
  AudioManager.setSystemOptions({ ios: { category: "playback", mode: "default", options: [] } });
  AudioManager.observeAudioInterruptions(true);
}

/** Shows or updates the lock screen and notification entry. `onToggle` runs when the user presses play or pause there. */
export async function showPlayback(playing: boolean, place: string): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    if (Platform.OS === "android") await AudioManager.requestNotificationPermissions();
    await AudioManager.setAudioSessionActivity(true);
    await PlaybackNotificationManager.show({ title: "Hush Garden", artist: place, state: playing ? "playing" : "paused" });
  } catch {
    // Without the notification the sound still plays in the foreground.
  }
}

export async function hidePlayback(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await PlaybackNotificationManager.hide();
  } catch {
    // Nothing to hide.
  }
}

/** Subscribes to the play and pause buttons of the notification. Returns an unsubscribe function. */
export function onPlaybackButtons(onPlay: () => void, onPause: () => void): () => void {
  if (Platform.OS === "web") return () => undefined;
  const subscriptions = [
    PlaybackNotificationManager.addEventListener("playbackNotificationPlay", onPlay),
    PlaybackNotificationManager.addEventListener("playbackNotificationPause", onPause),
  ];
  return () => subscriptions.forEach((subscription) => subscription?.remove());
}
