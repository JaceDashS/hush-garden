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

## Radius
- Definition: How far a speaker is heard, in tiles. Loudness reaches zero at the radius.
- Code: `SpeakerSound.radius`, `gainAt()`

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
- Definition: Where a character's feet, arms, body and ears sit in one picture: standing, a walking frame, or arms up while carrying.
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

## Carrying
- Definition: Moving a speaker by having the character walk to it, lift it overhead, walk, and put it down.
- Code: `carryId`, `putDown()`, `CarriedSpeaker`
