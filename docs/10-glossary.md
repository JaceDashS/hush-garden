# Glossary

## Garden
- Definition: The 24 by 24 tile play area drawn in quarter view.
- Code: `GARDEN_SIZE`, `src/domain/world.ts`
- Avoid: "map", "room", "world" in documents and UI text.

## Private Garden
- Definition: The garden kept on the device. Works offline; the player edits it freely.
- Code: `MyGarden`, `src/domain/garden.ts`, `src/storage.ts`; mode `"mine"` in `src/screens/Game.tsx`
- UI text: 내 정원

## Public Garden
- Definition: The one garden shared by everyone, owned by the server. Needs location consent to enter.
- Code: mode `"public"`, `HushClient.enter()`, `GardenSocket`
- UI text: 모두의 정원

## Speaker
- Definition: The single kind of sound source: a position, a name and one sound. There are no speaker types.
- Code: `Speaker`, `SpeakerSound` in `src/domain/sound.ts`

## Voice
- Definition: The audio nodes that play one speaker while the listener is near it.
- Code: `Voice` in `src/audio/engine.ts`

## Reach
- Definition: How far a speaker is heard, in tiles. It follows from the volume (2 tiles when silent up to 11 at full volume); there is no setting for it.
- Code: `reachOf()`, `REACH`, `loudnessAt()`
- Avoid: "radius", "range" for a speaker (the former radius setting no longer exists).

## Sound Shadow
- Definition: The soft round shadow a speaker casts on the ground in its noise colour, darker when louder and fading out at its reach.
- Code: `SoundShadow`, `shadowStrength()`, `shadowSize()`

## Oscillator
- Definition: One synthesised tone of a speaker: a wave, a frequency and a level. A speaker has at most two, shown as the panels OSC A and OSC B.
- Code: `Oscillator`, `MAX_OSCILLATORS`, `OscillatorPanel`
- Avoid: "bass", "drone" (the low end is an oscillator now).

## Preset
- Definition: A saved speaker layout with sounds. Built-in presets ship with the app; own presets are saved by the player.
- Code: `Preset`, `BUILT_IN_PRESETS`, `savePreset()`

## Place
- Definition: The city-level name shown above a character in the public garden, such as `Seoul, South Korea`.
- Code: `Entry.place`, `RemotePlayer.place`
- Avoid: "location" for the shown text; location means the device position used to find it.

## Ticket
- Definition: The one-use value from entering the public garden that opens the garden socket.
- Code: `Entry.ticket`, `socketUrl()`

## Chat Cue
- Definition: The brief change in the listener's sound when someone nearby chats. Modes: tone (default), dip, off.
- Code: `Cue`, `CueMode`, `cueFor()`, `GardenAudio.cue()`

## Guest
- Definition: A visitor in the public garden without a login. Can walk and listen but not chat.
- Code: `Entry.user === null`

## Character
- Definition: The animal the player walks as. One of ten kinds, each with a walking animation.
- Code: `CharacterKind`, `CHARACTER_KINDS`, `Character`

## Character Name
- Definition: The name shown above a character. Chosen by the player; staff-like names are refused.
- Code: `Settings.name`, `Entry.name`, `checkName()`
- Avoid: "nickname", "username" (the account name is a different thing).

## Pose
- Definition: Where a character's feet, arms, body and ears sit in one picture: standing, a walking frame, or arms up while holding.
- Code: `Pose`, `poseFor()`

## Equalizer
- Definition: The single five-band curve of a speaker: low cut, low shelf, bell, high shelf, high cut. It replaces the earlier separate EQ and filters.
- Code: `Equalizer`, `equalizerResponse()`, `EqGraph`

## Band
- Definition: One of the five parts of the equalizer, shown as a numbered point on the graph.
- Code: `BandId`, `moveBand()`

## Spectrum Analyser
- Definition: The live picture of how loud each frequency is, drawn behind the equalizer curve.
- Code: `GardenAudio.spectrum()`

## Holding
- Definition: Having a speaker in the character's hands, overhead. A speaker is lifted or made into the hands and leaves them by being put down or discarded. Only a held speaker can be edited.
- Code: `carryId`, `lift()`, `putDown()`, `CARRY`
- UI text: 들기, 내려놓기, 편집
- Avoid: "edit mode", "select" (they no longer exist).

## Action
- Definition: A short animation of a character handling a speaker: making, discarding or lifting. Making and discarding are different for every character.
- Code: `ActionName`, `actionAt()`, `Keyframe`

## Stance
- Definition: How a character's whole body is displaced during an action: hop, shift, lean and squash, on top of its pose.
- Code: `Stance`, `NEUTRAL`

## Prop
- Definition: What a character handles during an action and how it looks at that moment: usually the speaker, sometimes an egg, a ball of yarn or a leaf.
- Code: `PropState`, `PropForm`, `PropView`

## Marker
- Definition: A pressable button placed in the garden beside a speaker or the character.
- Code: `Marker` in `src/game/Scene.tsx`
