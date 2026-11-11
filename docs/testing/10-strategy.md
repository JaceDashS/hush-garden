# Test Strategy

## Automated

- Rules in `src/domain/` and pure helpers (`src/audio/noise.ts`, `src/api/socket.ts`, `src/settings.ts`, `src/coordinates.ts`) are tested with the Node test runner: `npm test` runs `tests/*.test.ts` through tsx.
- Tests import only modules that do not import React Native. Keep new rules in such modules so they stay testable.
- `npm run typecheck` and `npm run export:web` complete the checks; the `Product checks` workflow runs all three.
- Server rules (consent, permission, chat range and limits) are tested in the platform repository.

## By Hand

- Screens, drawing, input and sound are checked in a browser against a local API. The sound signal can be measured by connecting an analyser to the output in the page.
- Phone features (background playback, lock screen buttons, vibration, device location) need a real device.
- Record a manual check in the scenario document with its date.

## Test Data

- Tests build their own speakers and messages; nothing is read from files.
- Local login checks use accounts created in a throwaway local database, never a real account.

## Example

- Input: A new rule "chat range is 12 tiles".
- Steps: Change `CHAT_RANGE` → update the range assertions in `tests/domain.test.ts` and the scenario "Chat Cue Depth And Side" → run `npm test`.
- Result: The range tests pass with the new value and the documents match.
