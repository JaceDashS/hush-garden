# Garden Scenarios

- Design: [Garden Design](../../../design/app/10-garden.md)

Automated tests: `tests/domain.test.ts` and `tests/client.test.ts` (`npm test`). "Browser check" means a manual run of the web build on 2026-11-11 against a local API.

## Walk Up
- Input: position (10, 10), Up held for 0.1 s.
- Steps: `keysToInput()` → `step()`.
- Result: screen y decreases, screen x unchanged.
- Test: `domain.test.ts` → "moves up the screen when up is pressed". Browser check: arrow keys and WASD moved the character.

## Stay Inside The Garden
- Input: D held for 40 seconds from (10, 10).
- Result: the position stays within the garden.
- Test: "moves right on screen when D is pressed and stays inside the garden".

## Joystick
- Input: a drag of 2 px; a drag of 300 px with a 50 px stick.
- Result: no movement inside the dead zone; full speed, never more, at the edge.
- Test: "stands still without input and inside the joystick dead zone", "joystick input never exceeds full speed". Browser check: pressing on the garden showed the joystick and dragging walked.

## Louder When Closer
- Input: a speaker with radius 8 heard from 0, 2, 6, 8 and 20 tiles.
- Result: 1 at the speaker, falling with distance, 0 at 8 and beyond.
- Test: "a speaker is loudest next to it and silent at its radius". Browser check: the audible speaker count dropped from 3 to 2 after walking away.

## Two Speakers Blend
- Input: listener between two speakers in range and one out of range.
- Result: both in-range speakers have gain; the third is silent.
- Test: "two speakers in range are both heard".

## Mix Does Not Exceed One Speaker
- Input: three full-volume speakers at the listener's position.
- Result: total power at most one full speaker.
- Test: "overlapping speakers never exceed one full speaker".

## Speaker On The Right Sounds Right
- Input: a speaker to the right on screen.
- Result: positive balance.
- Test: "a speaker to the right on screen pans right".

## Sound Values Are Clamped
- Input: volume 9, radius -1, an unknown noise colour, five oscillators, high cut below low cut; and `null`.
- Result: values inside their ranges, three oscillators, high cut at least the low cut; `null` gives the default sound.
- Test: "sound values are clamped and broken input falls back to defaults".

## Edit Speakers
- Input: add at (3, 4), put down at (99, -5), rename with spaces, change volume, remove; then add 27 speakers.
- Result: the position is clamped, the name trimmed, the volume stored, the list empty after removal; never more than 24.
- Test: "speakers can be added, moved, edited and removed", "a full garden refuses another speaker". Browser check: selecting a speaker opened its controls; volume, noise colour and an added oscillator changed at once.

## Presets
- Input: add a speaker, save "Night" twice, apply a built-in preset, apply "Night", delete it, reset.
- Result: one "Night" preset; applying restores its layout; reset equals the first-run garden.
- Test: "user presets are saved, applied, deleted and reset".

## Broken Stored Data
- Input: stored garden `"nonsense"`; speakers with an empty id; a preset without an id; settings with wrong types.
- Result: the initial garden; only valid speakers kept; default settings.
- Test: "broken stored gardens fall back to the initial garden", `client.test.ts` → "settings fall back to defaults and keep valid values".

## Chat Cue Depth And Side
- Input: a talker 1 tile away, 9 tiles away and 11 tiles away; a talker on the right and on the left.
- Result: deeper when closer, none beyond 10 tiles; the pan sign matches the side.
- Test: "chat cue is deeper when closer and absent out of range", "chat cue points to the side the talker is on".

## Chat Message Cleaning
- Input: `"  hi\n there  "`, spaces only, a number, 500 characters.
- Result: `"hi there"`, null, null, 200 characters.
- Test: "chat messages are trimmed, limited and never empty".

## Socket Messages Are Validated
- Input: invalid JSON, an unknown type, a chat with a numeric text, a hello with one broken player and one broken speaker.
- Result: dropped, dropped, dropped, and a hello with only the valid player and speaker.
- Test: `client.test.ts` → "server messages are validated and unknown ones are dropped", "socket address uses wss for an https API origin and escapes the ticket".

## Coordinates Are Rounded
- Input: 37.566535 and -126.97796.
- Result: 37.57 and -126.98.
- Test: "coordinates are rounded to about one kilometre before leaving the device".

## Noise Loops
- Input: one second of each noise colour from a fixed random source.
- Result: all samples within ±1, none silent; brown noise ends where it starts.
- Test: "noise loops stay within range and brown noise loops without a jump".

## Enter The Public Garden As A Guest
- Input: public garden chosen, consent agreed, device location unavailable.
- Result: the garden opens with the place above the character, a visitor count, and a "log in to chat" button instead of the chat box.
- Test: Browser check only (place `Local` against a local API).

## Log In And Chat
- Input: login with an administrator account, a second visitor nearby sends a message, then the player sends one.
- Result: the chat box and the edit button appear; the other visitor's bubble shows with the place `Seoul, South Korea`; both messages are in the server log.
- Test: Browser check only.

## Edit A Public Speaker
- Input: an administrator presses "place speaker" in the public garden.
- Result: the speaker appears and is stored by the server.
- Test: Browser check only.

## Ten Characters
- Input: the character list; the values "panda", "dragon" and nothing.
- Result: ten different ids, each with a name; "panda" stays, the others become "bunny".
- Test: `domain.test.ts` → "there are ten characters, each with a name, and unknown ones fall back to the first". Browser check 2026-11-12: the picker shows the characters and choosing the fox changed the title picture and the character in the garden.

## Walking Animation
- Input: the four walking frames, frame 4, and a standing character.
- Result: four different pictures; the left foot lifts on the first step and the right on the second with the body raised; frame 4 equals frame 0; standing is the still pose.
- Test: "a walking character cycles through different pictures and a standing one keeps still".

## Equalizer Curve
- Input: a flat equalizer; one with low shelf +9 dB, bell -12 dB (Q 2) and high shelf +6 dB; one with cuts at 500 Hz and 2 kHz.
- Result: 0 dB in the middle of the flat one with the far ends cut; about +9, +4.5, -12 and +6 dB at 40 Hz, 200 Hz, 1 kHz and 12 kHz; -3 dB at each cut frequency.
- Test: "a flat equalizer changes nothing in the middle and cuts the far ends", "each band shapes its own part of the curve".

## Dragging Equalizer Bands
- Input: the bell dragged far beyond the graph, the low shelf far below it, the high cut to 300 Hz and then the low cut to 1.5 kHz.
- Result: every value stays inside its limits and the low cut never passes the high cut.
- Test: "dragging a band keeps every value in range and the cuts in order", "graph positions convert both ways and stay on the graph". Browser check 2026-11-12: dragging the bell up and the high cut left redrew the curve and the readout showed 5.9 kHz.

## Spectrum Analyser
- Input: a selected speaker playing white noise with a bass drone and a 9 kHz high cut.
- Result: the shadow behind the curve shows a bump at the bass frequency and falls off above the high cut; it changes when a band is dragged.
- Test: Browser check 2026-11-12 only.

## Old Sound Format
- Input: `{low: 3, mid: {...}, high: -3}` with a separate filter `{highpass: 80, lowpass: 7000}`.
- Result: the same values in the five-band model.
- Test: "the first sound format with separate filters is still read".

## Carry A Speaker
- Input: a selected speaker a few tiles away; carry pressed; walk right; put down pressed.
- Result: the character walks to the speaker, holds it overhead with its arms up while its feet keep stepping, and the speaker ends next to the character at the new place.
- Test: "a carrying character keeps its arms up while its feet keep stepping", "a picked up speaker rises from the ground to overhead". Browser check 2026-11-12: the stored position changed from (14, 17) to about (17.8, 12.4) only after putting down.

## Character Name Rules
- Input: "  Mina   Kim ", spaces only, a number, 17 characters, 16 Korean characters; "Admin", "ADM1N", "a d m i n", "the_moderator", "관리자", "운 영 자", "GM", "jace-s", "Hush Garden", "@dmin", "0wner"; "Gmail fan", "Modest", "Devon", "정원사", "ねこ", "Robot", "Guest".
- Result: "Mina Kim"; empty; empty; too long; accepted; every staff-like name refused; every ordinary name accepted.
- Test: "character names are cleaned and limited", "names that look like staff or the service are refused, ordinary words are not". Browser check 2026-11-12: "Adm1n" showed the refusal text and was not stored; "Momo" was stored and shown.

## Not Yet Verified
- Name change and other players' characters in the public garden were not checked in a browser after these features were added (the server rules are tested in the platform repository).
- Sound and chat cue by ear on real earphones (the signal was measured in the browser: running context, non-zero level, strongest below 200 Hz).
- Android: installation, background playback with the screen off, lock screen buttons, vibration, device location.
- Windows desktop app: login through the HTTP plugin, location prompt, offline start.
- iPhone: no build.

## Desktop Chat Focus
- Input: Authenticated public garden on desktop web with a fine hover pointer, and separately on a touch-primary phone or native mobile.
- Steps: Open chat, type a message, submit with Enter or Send.
- Expected result: Desktop chat focuses on appearance and after either submission. Enter keeps focus. Mobile does not auto-focus on appearance and retains existing submit behavior.
- Design: [Desktop Chat Focus](../../../design/app/10-garden.md#desktop-chat-focus).
- Verification: TypeScript check passed. Physical mobile and authenticated production interaction not run.

## Account Character Name Restore
- Input: A signed-in public garden entry with characterName Momo and cached name Old.
- Steps: Apply the entry response; change the name online; reconnect on another device.
- Expected result: Momo replaces the local name; successful rename is saved; save failure is shown. Guests and private offline mode do not fetch an account profile.
- Design: [Account Character Name Restore](../../../design/app/10-garden.md#account-character-name-restore).
