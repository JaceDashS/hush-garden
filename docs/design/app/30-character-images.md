# Character Images Design

- Spec: [Character Images](../../specs/app/30-character-images.md)
- All scenarios: [Character Image Scenarios](../../testing/scenarios/app/30-character-images.md)
- Server: the jace-s platform, `docs/design/hush-garden/20-character-images.md`; API `docs/api/apps/hush-garden/30-characters.md`

## Image Map

- Code: `src/domain/imageCharacters.ts` → `SHEET`, `SHEET_ROWS`, `sheetFrame()`, `fallbackKind()`, `sheetUrl()`, `isCharacterId()`.
- `sheetFrame({ walking, carrying, action, progress, frame })` picks `{ row, column }`: an action uses its row at `floor(progress × frames)` (put down runs the lift row backwards), otherwise holding uses row 4 and walking row 2 with the walking frame, and standing is row 1, column 1.
- `fallbackKind(id)` hashes the character id onto the ten drawn characters, so the stand-in is the same on every device.

## Drawing

- Code: `src/game/imageCharacter.tsx` → `ImageCharacter`, `SheetFrame`, `SheetLoading`, `useSheet()`; `src/game/Scene.tsx` → `ActorView`.
- A frame is a 64 × 64 window (half size) with `overflow: hidden` over an `Image` of the whole sheet at 512 × 384, moved by the frame's offset and mirrored with `scaleX: -1` when facing left. The window is placed so the frame's foot point (64, 120) lands on `CHARACTER_FEET`, so speakers, shadows and labels line up as for drawn characters.
- `useSheet(id)` keeps a module-level map of ids whose image has loaded (`onLoad`). Until then the scene draws `Character` of `fallbackKind(id)`, mounts the sheet invisibly to load it, and `ActorView` shows `SheetLoading` (an `ActivityIndicator`) above the name label, where chat bubbles go. `ActorView` owns the `useSheet()` state and passes it down. On `onError` it waits 30 seconds and mounts it again with a new key. The browser and the native image cache keep the file; the server marks it immutable.

## Actions

- Code: `src/domain/actions.ts` → `ActionKind` (`CharacterKind | "image"`), `actionKindOf()`.
- Image characters use the shared lift and their own `image` entries in `CREATE` and `DISCARD`: the body does not move (the image does), the speaker appears in the hands with a sparkle at the end of making and is gone with a puff at the start of discarding. Durations are 1200 ms for both, so the 8 frames run at 150 ms.

## Settings And API

- Code: `src/settings.ts` → `customCharacter` (an id or empty); `src/api/client.ts` → `myCharacters()`, `uploadCharacter()`, `deleteCharacter()`; `src/components/MyCharacters.tsx` (the "Custom characters" group passed to `SettingsCard` as `custom`), `src/components/pickPng.ts` and `pickPng.web.ts`; `src/domain/characterPrompt.ts` → `characterPrompt(language)`.
- Entering sends `customCharacter` with the drawn `character`. The server keeps it only for the owner's approved character; the entry response does not say which, so the list from `myCharacters()` drops a stale id from the settings.
- Upload reads the file as base64: on the web and in the desktop app through a file input and `FileReader`, on Android through `expo-document-picker` and `expo-file-system`. The PNG size is read from its header before sending (`readPngSize()`).
- "Copy prompt" uses `expo-clipboard` (on the web it falls back to `navigator.clipboard`).

## Socket

- Code: `src/api/socket.ts` → `toPlayer()` reads `custom`; `look` messages replace a player's `character` and `custom`. For the player's own id the settings drop `customCharacter`.
