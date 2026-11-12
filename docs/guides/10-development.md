# Development

## Setup

- Node 24. `npm ci` in the repository root.
- Inside the jace-s platform checkout this repository is `services/hush-garden`, and the platform `npm run setup` installs it too.

## Commands

| Command | What it does |
| --- | --- |
| `npm run web` | Expo web dev server |
| `npm run typecheck` | TypeScript check |
| `npm test` | Rule and client tests with Node |
| `npm run export:web` | Static web build in `dist/` |
| `npm run build:android` | Release APK in `dist-android/` (needs JDK 21 and the Android SDK) |
| `npm run desktop:dev`, `npm run desktop:build` | Tauri desktop app (needs Rust) |
| `node scripts/make-icon.mjs` | Redraws `assets/icon.png`; run `npx tauri icon assets/icon.png` afterwards for the desktop icons |

## Settings

Build-time values, inlined by Expo:

| Variable | Default | Meaning |
| --- | --- | --- |
| `EXPO_PUBLIC_HG_API_ORIGIN` | `https://api.jace-s.com` | Account and public garden API |
| `EXPO_PUBLIC_HG_SITE_ORIGIN` | `https://jace-s.com` | Main site |

## Trying The Public Garden Locally

The private garden needs nothing. For the public garden run the platform API locally and point the web build at it:

1. Start `services/api` of the platform in development mode on some port, with its own throwaway database. Development mode accepts any page origin.
2. Start the web dev server with `EXPO_PUBLIC_HG_API_ORIGIN=http://localhost:<port>`.
3. Open the page, choose the public garden and agree on the consent card. A local address is named `Local`.

A second visitor can be any WebSocket client: `POST /hush-garden/enter` with `{"consent": true}`, then connect to `/hush-garden/socket?ticket=...` and send `{"t":"move","x":12,"y":12}`.

## Where To Change Things

- A rule (movement, loudness, limits, presets, chat range): `src/domain/`, with a test in `tests/domain.test.ts`.
- A sound limit: change `LIMITS` in `src/domain/sound.ts` and the same limit in the platform `services/api/src/services/hushGarden/rules.ts`; the server value is the one enforced.
- Art: `src/game/sprites.tsx`.
- Text: every screen text is a key in `src/domain/text.ts` with a Korean, an English and a Japanese entry; screens read it with `useT()` from `src/i18n.tsx`. A new text needs all three entries, which a test checks.

## Example

- Input: The oscillator frequency limit should grow from 8 kHz to 12 kHz.
- Steps: Change `LIMITS.oscillatorFrequency` here and the oscillator clamp in the platform rules → update both specs, the API sound fields and the clamp tests → release the server before the client.
- Result: An editor can set 12 kHz and the server stores it.
