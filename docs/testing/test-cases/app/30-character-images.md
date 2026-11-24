# Character Image Scenarios

- Design: [Character Images Design](../../../design/app/30-character-images.md)

Automated tests: `tests/domain.test.ts` and `tests/client.test.ts` (`npm test`).

## Frame Choice
- Input: standing; walking frame 3; holding while walking frame 1; making at 0.5 progress; discarding at 0.99; lifting at 0 and at 1; putting down at 0.
- Steps: `sheetFrame()`.
- Result: (row 0, col 0); (1, 2); (3, 1); (4, 4); (5, 7); (2, 0) and (2, 5); (2, 5).
- Test: `domain.test.ts` → "image map frames".

## Stand-In Character
- Input: the same id twice, and many different ids.
- Steps: `fallbackKind()`.
- Result: the same drawn character for the same id; every result is one of the ten.
- Test: `domain.test.ts` → "image character stand-in".

## Prompt
- Input: every app language.
- Steps: `characterPrompt()`.
- Result: each prompt names 1024 × 768, 128, the six rows with their frame counts and the foot point, and asks for a description before drawing.
- Test: `domain.test.ts` → "character prompt".

## Players With Image Characters
- Input: a `join` with `custom: "3f2c…"`; a `look` for that id with `custom: null`; a `join` with `custom: "../x"`.
- Steps: `parseServerMessage()`.
- Result: the player carries the id, then none; the bad id is dropped.
- Test: `client.test.ts` → "image characters on the socket".

## API Calls
- Input: `myCharacters()`, `uploadCharacter("Mochi", "iVBOR…")`, `deleteCharacter("3f2c…")`, `enter()` with a custom character.
- Result: the paths and bodies of the platform API; enter sends `customCharacter`.
- Test: `client.test.ts` → "character API calls".

## Browser Check
- Upload a generated sheet as a granted account, approve it in the admin page, use it, walk, lift, make and discard a speaker, and watch it from a second browser: the stand-in with the loading mark shows first, then the image.
- Done on 2026-11-15 with the web build against a local API and the local web admin: upload, the wrong-size refusal, approval with the motion preview, use, the stand-in with the loading mark (image delayed on purpose), walking, making, holding and discarding, and an administrator deletion while in use (the watcher saw the drawn character at once and the owner's setting was dropped).
