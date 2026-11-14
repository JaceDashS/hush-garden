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
- Input: a point with reach 8 heard from 0, 2, 6, 8 and 20 tiles.
- Result: 1 at the point, falling with distance, 0 at 8 and beyond.
- Test: "a speaker is loudest next to it and silent at its radius". Browser check: the audible speaker count dropped from 3 to 2 after walking away.

## Louder Reaches Farther
- Input: speakers whose only part is noise at volume 0, 0.3, 0.4, 0.5, 0.9 and 1; a listener 9 tiles away; a silent speaker at the listener's position; a speaker with noise at 0.2 and an oscillator at 0.9.
- Steps: `loudnessOf()` → the loudest part; `reachOf()` → `2 + 9 × loudness`; `loudnessAt()` → loudness times the distance share.
- Result: reach 2 tiles at volume 0 and 11 at volume 1; the noise 0.2 plus oscillator 0.9 speaker reaches 10.1 tiles; the full-volume speaker is heard at 9 tiles and the 0.4 one is not; a silent speaker is never counted as heard.
- Test: "a louder speaker is heard farther away and a silent one is not heard", "the loudest part decides the reach, and older sounds keep how they sounded". Browser check 2026-11-14: a new speaker's editor showed "reaches 8.3 tiles" with noise volume 70%.

## Two Speakers Blend
- Input: listener between two speakers in range and one out of range.
- Result: both in-range speakers have gain; the third is silent.
- Test: "two speakers in range are both heard".

## Mix Does Not Exceed One Speaker
- Input: three speakers with noise at full volume at the listener's position; one quiet speaker alone.
- Result: total power at most one full speaker; the quiet speaker alone is not turned up (its distance gain stays 1).
- Test: "overlapping speakers never exceed one full speaker".

## Speaker On The Right Sounds Right
- Input: a speaker to the right on screen.
- Result: positive balance.
- Test: "a speaker to the right on screen pans right".

## Sound Values Are Clamped
- Input: noise volume 2, a stored radius, an unknown noise colour, five oscillators, high cut below low cut; and `null`.
- Result: values inside their ranges (noise volume 1), no radius and no overall volume, two oscillators, high cut at least the low cut; `null` gives the default sound.
- Test: "sound values are clamped and broken input falls back to defaults".

## Default Low End
- Input: the default sound; a sound with an explicit empty oscillator list.
- Result: one oscillator, a sine at or below 80 Hz with a level above zero, and no bass field; the empty list stays empty.
- Test: "the default sound gets its low end from oscillator A and holds at most two oscillators".

## Stored Bass Drone
- Input: a stored sound with `bass: {frequency: 60, level: 0.3}` and two oscillators; a drone at level 0; a drone at level 1.
- Steps: `normalizeSound()` turns the drone into a sine oscillator at `level × 0.5 / 0.3` in front and keeps two.
- Result: sine 60 Hz at level 0.5 followed by the first stored oscillator; no oscillator for level 0; level capped at 1; normalising the result again changes nothing.
- Test: "a stored bass drone becomes a sine oscillator of the same loudness". Browser check 2026-11-12: the speakers seeded on the local server with a drone were served with one oscillator each.

## Edit Speakers
- Input: add at (3, 4), put down at (99, -5), rename with spaces, change the noise volume, remove; then add 27 speakers.
- Result: the position is clamped, the name trimmed, the noise volume stored, the list empty after removal; never more than 24.
- Test: "speakers can be added, moved, edited and removed", "a full garden refuses another speaker".

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

## Same Sound Does Not Crackle
- Input: two speakers with the same pink noise sound; the listener stands between them, so both voices are built in the same refresh.
- Steps: each voice starts the shared pink loop at its own random point (`loopOffset()`) → the two noises are unrelated → they add in power, which the mix normalisation expects.
- Result: no clipping and no metallic comb sound. Before the change both voices started at the same sample, summed to about 1.41 and clipped.
- Test: "voices of one noise colour start at different points of the loop". Not yet checked by ear.

## Peaks Are Rounded Off
- Input: two speakers with the same 55 Hz sine oscillator in phase, plus a chat cue, so the mix reaches about 1.4 for a moment.
- Steps: master → gain 1/4 → limiter curve → `softClip(1.4)`.
- Result: output about 0.99, below 1, so nothing is cut; sound up to 0.7 passes unchanged.
- Test: "the limiter leaves quiet sound alone and keeps peaks below one". Not yet checked by ear.

## Enter The Public Garden As A Guest
- Input: public garden chosen, consent agreed, device location unavailable.
- Result: the garden opens with the place above the character, a visitor count, and a "log in to chat" button instead of the chat box.
- Test: Browser check only (place `Local` against a local API).

## Log In And Chat
- Input: login with an administrator account, a second visitor nearby sends a message, then the player sends one.
- Result: the chat box and the make a speaker button appear; the other visitor's bubble shows with the place `Seoul, South Korea`; both messages are in the server log.
- Test: Browser check only.

## Edit A Public Speaker
- Input: an administrator in the public garden makes a speaker, edits it while holding it, puts it down, lifts it again and discards it.
- Result: the server stores the new speaker with source, noise, oscillators and equalizer only; after discarding, the server list is back to what it was.
- Test: Browser check 2026-11-12 against a local API: four speakers before, five after making, four after discarding; no stored sound had a radius or a bass field. A guest saw no speaker button.

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

## Boost Does Not Lower The Rest
- Input: the default speaker with its low shelf raised by 6 dB.
- Steps: the equalizer chain plays the curve as drawn → nothing after it scales the speaker down → distance gain and pan as before.
- Result: the low end is 6 dB louder and the middle and highs keep their level. Before the change a trim gain lowered the whole speaker by the highest boost, so the low end stayed and everything else dropped by 6 dB. A peak past full scale is rounded by the limiter.
- Test: none; the engine runs only with a real audio context. Not yet checked by ear.

## Dragging Equalizer Bands
- Input: the bell dragged far beyond the graph, the low shelf far below it, the high cut to 300 Hz and then the low cut to 1.5 kHz.
- Result: every value stays inside its limits and the low cut never passes the high cut.
- Test: "dragging a band keeps every value in range and the cuts in order", "graph positions convert both ways and stay on the graph". Browser check 2026-11-12: dragging the bell up and the high cut left redrew the curve and the readout showed 5.9 kHz.

## Spectrum Analyser
- Input: a held speaker playing brown noise with oscillator A at 55 Hz.
- Result: the shadow behind the curve is highest at the low end and falls toward the high end; it changes when a band is dragged.
- Test: Browser check 2026-11-12 only.

## Old Sound Format
- Input: `{low: 3, mid: {...}, high: -3}` with a separate filter `{highpass: 80, lowpass: 7000}`.
- Result: the same values in the five-band model.
- Test: "the first sound format with separate filters is still read".

## Lift Carry And Put Down
- Input: the character walks next to a speaker; lift pressed; walk; put down pressed.
- Result: a lift button appears beside the speaker only within 1.6 tiles and only with free hands; after lifting, the speaker is overhead with the arms up while the feet keep stepping, and put down and edit buttons appear beside the character; after putting down the speaker stands one step in front and the lift button is back.
- Test: "a carrying character keeps its arms up while its feet keep stepping", "a lifted speaker rises from the ground in front to overhead". Browser check 2026-11-12 at phone size: lift button beside the speaker, then put down and edit under the character.

## Nature Sources Have Oscillators And Equalizer
- Design: [Nature Sources](../../../design/app/10-garden.md#nature-sources)
- Input: stored sounds `{source: "waterfall", level: 0.4, noise: {...}, oscillators: []}`, `{source: "rain", level: 7}`, `{source: "train"}`, a cafe with three oscillators (one at 99999 Hz), a low shelf of +6 dB and a bass drone, `{source: "dragon", level: 0.5}`, an old sound without a source, and `{source: "rain", volume: 0.4}` saved before part volumes.
- Steps: `normalizeSound()` on each.
- Result: the waterfall keeps recording volume 0.4 with no oscillators and a flat equalizer; rain gets 1; the train 0.7 with no oscillator; the old rain gets recording volume 0.4; the cafe keeps two oscillators (the first at 8000 Hz) and its +6 dB shelf, has no noise and ignores the drone; the unknown source and the old sound are synthesiser sounds.
- Test: "a nature source has oscillators and an equalizer but no noise and no default oscillator".

## Choose A Nature Source
- Input: a held synthesiser speaker (OSC A a 55 Hz sine) with white noise at volume 0.35 and a +3 dB low shelf.
- Steps: choose the waterfall → add OSC A at 80 Hz → choose rain → choose the synthesiser.
- Result: waterfall with recording volume 0.35, no oscillators and the +3 dB shelf → rain keeps the 80 Hz oscillator and the shelf → the synthesiser keeps them, with brown noise at volume 0.35. In the browser all three tabs stay for a nature source, the noise controls give way to the note about the recording, the oscillator added to the waterfall shows in its own spectrum, the held speaker turns into the chosen object, and putting it down leaves that object on the ground with its own waves.
- Test: "choosing a source keeps the Sound tab volume and the equalizer; a nature source starts without oscillators". Browser check in Chrome 2026-11-14.

## Ten Nature Objects
- Input: a stored private garden with one of each nature source at recording volume 0.25.
- Steps: enter the private garden and look at the objects over time.
- Result: each source is drawn as its own object with its own movement, in its own wave colour; without oscillators no audio plays for them; no errors.
- Test: Browser check in Chrome 2026-11-14 (screenshots of all of them; thunder and wind chime were removed the same day).

## Nature Recording Chain
- Design: [Nature Recording Playback](../../../design/app/10-garden.md#nature-recording-playback)
- Input: an hour of layers planned for a 10-chunk recording from a fixed random source.
- Steps: `nextLayers()` repeatedly; sum the squared `layerGain()` of the chained layers every 0.37 s.
- Result: every section stays inside its chunk, chained layers are 20 to 45 s, the chained power is 1 at every moment after the first fade-in, at least 8 different chunks are used, and between 15 % and 45 % of the layers get a quieter extra layer.
- Test: "a nature recording plays as a chain of random sections that never leaves a gap". Browser check in Chrome 2026-11-14: choosing a stream started a 35 s section of a 60 s chunk.

## Heartbeat At A Tempo
- Input: 200 beats at 60 BPM; one beat at 120 BPM with no wander.
- Steps: `nextBeat()`.
- Result: every spacing is within ±3 % of 1 s and 200 beats take about 200 s; at 120 BPM the next beat is 0.5 s later.
- Test: "heartbeat beats follow the tempo with a little wander". Browser check in Chrome 2026-11-14: beats started about 1 s apart.

## Nature Sound Patch
- Design: [Nature Sound Patch](../../../design/app/10-garden.md#nature-sound-patch)
- Input: a manifest of three files with one already stored and an old file; then offline with a complete earlier download; offline with nothing; a server that fails every download.
- Steps: `runPatch()` with an in-memory store.
- Result: only the two missing files are downloaded, progress starts at the stored file's size and only grows, it ends ready with 600 of 600 bytes, the old file is removed and the manifest saved; offline with an earlier download it is ready without downloading; offline with nothing and with failing downloads it ends failed and saves no manifest.
- Test: "the sound patch downloads what is missing, reports progress and removes old files", "the sound patch works offline from a complete earlier download and fails without one", "a failed download leaves nature sources unavailable". Browser check in Chrome 2026-11-14: 231 MB from a local server in 2.4 s with the status counting up; with the sound files blocked the status said the download failed and the nature pictures were disabled.

## Asked Before Downloading
- Design: [Nature Sound Patch](../../../design/app/10-garden.md#nature-sound-patch)
- Input: a device missing 500 of 600 bytes that declines; one that has everything; in the browser a fresh profile entering three times.
- Steps: `runPatch()` with an `ask` that answers no, then with everything stored; in Chrome: enter → Later → enter again → tick "Don't ask again" → Later → enter again → settings → Download nature sounds.
- Result: asked once with 500 bytes, nothing downloaded, phases checking → asking → declined; nothing asked when nothing is missing. In the browser the question (231 MB) appears, Later keeps the garden working without nature sources, it is asked again, after the tick it is not asked, and the settings button downloads: the status pill turns into a gauge and back.
- Test: "the sound patch asks before downloading and does nothing when declined". Browser check in Chrome 2026-11-14.

## Test Garden Only In Development
- Design: [Test Garden And Developer Options](../../../design/app/10-garden.md#test-garden-and-developer-options)
- Input: the dev server; the exported web build.
- Steps: open the first screen in both; in the dev server enter the test garden and use each developer option; then open the private garden's settings.
- Result: the dev server shows "Test garden", the export does not; the alert shows and closes with OK; the temporary notice slides down as a toast and closes on a tap; the private garden has no developer options.
- Test: Browser check in Chrome 2026-11-14.

## Notices As Toasts
- Design: [Platform Notices](../../../design/app/10-garden.md#platform-notices)
- Input: `{schemaVersion: 1, announcements: [{id: 7, title: " Maintenance tonight "}, {id: "x"}, null, {title: "no id"}]}`, schema 2, a 503, a network error; two notices queued, one queued twice, one queued again after it was shown.
- Steps: `parseNotices()`, `fetchNotices()`, `showNotices()`, `dismissNotice()`.
- Result: only `{id: "7", title: "Maintenance tonight"}` is kept; schema 2, the 503 and the error give no notices; the queue holds each notice once, the next follows a dismissed one, a shown notice is not queued again unless asked.
- Test: "platform notices are read defensively", "each notice is queued once per app run unless asked again".

## Recordings And Heartbeat Tempo
- Design: [Nature Sources](../../../design/app/10-garden.md#nature-sources)
- Input: a stream with its second recording; a stream naming a rain recording; a heartbeat without tempo, with 300 and with 71.6; a stored `thunder` and a stored `windchime`; the editor with a stream and then a heartbeat.
- Steps: `normalizeSound()`, `withSource()`; in the browser choose the stream, then Recording 2, then the heartbeat.
- Result: the second recording stays; the rain recording falls back to the stream's first; the heartbeat gets 60, 120 and 72 BPM; thunder becomes rain with `fs-737691`; the wind chime becomes a synthesiser sound. In the editor the stream shows Recording 1 to 3 where the noise colours were, the heartbeat shows a tempo slider instead, and an old stored thunder speaker appears as rain.
- Test: "a nature source plays one of its recordings, and the heartbeat has a tempo". Browser check in Chrome 2026-11-14.

## Edit Only While Holding
- Input: a speaker on the ground; then the same speaker held.
- Result: no way to open the sound controls for a speaker on the ground; while held, edit opens the three tabs; putting down or discarding closes them.
- Test: Browser check 2026-11-12.

## Make A Speaker
- Input: make a speaker pressed with free hands, for each of the ten characters; and with 24 speakers in the garden.
- Result: the character plays its own making animation for 1 to 2 seconds without walking; at the end a default speaker is overhead with the arms up and the body back to normal; the top left button reads discard. With 24 speakers nothing is made and a notice says the garden holds 24.
- Test: "making a speaker ends with it held overhead, for every character", "an action glides between keyframes and shows its effects only briefly". Browser check 2026-11-12 in slow motion: fox, penguin, chick, panda, bunny, cat, bear, frog and pig.

## Discard A Speaker
- Input: discard pressed while holding, for each of the ten characters.
- Result: the character plays its own discarding animation starting from the held speaker; at the end nothing is in its hands, the speaker is gone from the garden and the count of speakers heard drops.
- Test: "discarding starts from the held speaker and ends with nothing, for every character". Browser check 2026-11-12 in slow motion: fox, penguin, chick, panda, bunny, cat, bear, frog and pig.

## Twenty Different Animations
- Input: the keyframes of making and of discarding for the ten characters.
- Result: no two characters share a making list or a discarding list; keyframe times only increase.
- Test: "every character makes and discards a speaker in its own way".

## Sound Shadows
- Input: the starting private garden with a brown, a pink and a white speaker; a speaker made and carried.
- Result: each speaker has a soft shadow in its noise colour without pressing anything; shadows fade outward and blend where they overlap; the held speaker's shadow follows the character.
- Test: Browser check 2026-11-12.

## Sound Waves At An Uneven Pace
- Input: the starting private garden, three speakers shown at the same moment.
- Steps: each `SoundShadow` waits `firstRippleDelay()` before its first ring, then `nextRippleInterval()` before each next one.
- Result: the speakers start at different moments and the gaps between rings vary between 0.6 and 1.4 s, differently for each speaker; no speaker pulses at a fixed period.
- Test: "speakers send their sound waves at an uneven pace". Browser check in Chrome 2026-11-14: first rings at 0.35, 0.45 and 0.9 s, gaps between 0.6 and 1.15 s.

## Oscillator Panels
- Input: the oscillator tab of a new speaker; add pressed; the square wave picture pressed on OSC A; the OSC A level knob dragged up 57 px; the OSC B frequency knob dragged right 50 px.
- Result: OSC A at 55 Hz and 55%; OSC B appears at 165 Hz and 20% and the add button goes away; the display of OSC A shows a square wave; the level reads 82%; the frequency of OSC B reads 676 Hz.
- Test: "wave pictures stay in range and differ by wave". Browser check 2026-11-12 at 375 by 812.

## Top Bar And Settings
- Input: the garden at phone size; the gear pressed.
- Result: speaker button left, status centre, sound button and gear right; settings show master volume, language, character name, chat cue, presets and leave the garden.
- Test: Browser check 2026-11-12; sound button and settings without the on and off button checked in Chrome 2026-11-14.

## Sound Button And M Key
- Input: the private garden on a desktop browser with sound on; then a phone-size touch browser.
- Steps: hover the sound button → the button itself grows to the left (its container from 44 to 212 px within about 0.2 s, the slider uncovered from the right inside it) and a hint "Turn sound off" with an M key below → click it → the picture shows a cross and the hint reads "Turn sound on" → drag the slider to about 30 % → move the mouse away → press M twice → on the phone, tap the button.
- Result: sound turns off and on with each click or M; the slider sets the master volume (the settings show the same 29 %); the slider folds back and the hint closes after leaving; on the phone the tap turns sound off and no slider appears.
- Test: Browser check in Chrome 2026-11-14 (desktop 1100 × 700 and touch 390 × 760); the growing container checked again the same day (44 → 212 px).

## Languages
- Input: every text key in Korean, English and Japanese; device locales `ja-JP`, `ko_KR`, `fr-FR` and none; Korean chosen in settings while the screens were English.
- Result: every key has a non-empty text with the same `{name}` parts in all three languages; the locales give Japanese, Korean, English and English; the open settings card and the top bar switched to Korean at once.
- Test: "every text exists in every language and fills in its values", "the language follows the device and unknown values fall back", "settings fall back to defaults and keep valid values". Browser check 2026-11-12.

## Character Name Rules
- Input: "  Mina   Kim ", spaces only, a number, 17 characters, 16 Korean characters; "Admin", "ADM1N", "a d m i n", "the_moderator", "관리자", "운 영 자", "GM", "jace-s", "Hush Garden", "@dmin", "0wner"; "Gmail fan", "Modest", "Devon", "정원사", "ねこ", "Robot", "Guest".
- Result: "Mina Kim"; empty; empty; too long; accepted; every staff-like name refused; every ordinary name accepted.
- Test: "character names are cleaned and limited", "names that look like staff or the service are refused, ordinary words are not". Browser check 2026-11-12: "Adm1n" showed the refusal text and was not stored; "Momo" was stored and shown.

## Not Yet Verified
- Name change and other players' characters in the public garden were not checked in a browser after these features were added (the server rules are tested in the platform repository).
- The mouse's two animations were not watched in a browser; the other nine characters were sampled at one to five moments each in slow motion, not watched at full speed.
- Knobs, sliders and the equalizer were dragged with a mouse at phone size, not with a finger on a phone. Japanese screens were not looked at.
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
