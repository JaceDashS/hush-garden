import * as Location from "expo-location";
import { roundCoordinate } from "./coordinates";

const TIMEOUT_MS = 8000;

/**
 * Asks for the device location after the user agreed on the consent card. Returns rounded coordinates, or null
 * when permission is denied, the device has no position, or it takes too long; the server then uses the IP region.
 */
export async function requestCoordinates(): Promise<{ latitude: number; longitude: number } | null> {
  try {
    // The whole exchange is limited, because an unanswered permission prompt would otherwise block entering.
    const position = await Promise.race([
      (async () => {
        const permission = await Location.requestForegroundPermissionsAsync();
        return permission.granted ? Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }) : null;
      })(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS)),
    ]);
    if (!position) return null;
    const { latitude, longitude } = position.coords;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return { latitude: roundCoordinate(latitude), longitude: roundCoordinate(longitude) };
  } catch {
    return null;
  }
}
