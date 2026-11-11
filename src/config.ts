/** Build-time settings. Expo inlines EXPO_PUBLIC_* values into the web and native bundles. */
const trim = (value: string | undefined, fallback: string) => (value?.trim() || fallback).replace(/\/+$/, "");

/** Login and public garden API origin. The session cookie lives only on this origin. */
export const API_ORIGIN = trim(process.env.EXPO_PUBLIC_HG_API_ORIGIN, "https://api.jace-s.com");
/** Main site used for the "main page" link. */
export const SITE_ORIGIN = trim(process.env.EXPO_PUBLIC_HG_SITE_ORIGIN, "https://jace-s.com");
