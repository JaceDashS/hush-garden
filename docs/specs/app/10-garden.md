# Garden

- Design: [Garden Design](../../design/app/10-garden.md)
- Scenarios: [Garden Scenarios](../../testing/scenarios/app/10-garden.md)

## Purpose

Hush Garden masks surrounding noise. The player walks a small quarter-view garden; each speaker plays noise that gets louder as the player comes closer. It is used with earphones to block out a room.

## Walking

- The garden is a 24 by 24 tile square drawn in quarter view with cute pastel vector art.
- The character moves up, down, left and right on screen, and diagonally when two directions are held.
- Keyboard: arrow keys or WASD. Touch or mouse: pressing anywhere on the garden shows a joystick at that point; dragging moves the character; releasing hides it.
- The character cannot leave the garden. The camera follows the character.

## Speakers And Sound

- There is one kind of speaker. Every speaker has the same controls:
  volume, hearing radius, noise (white, pink or brown) with its level, a bass drone (frequency and level), up to three oscillators (wave, frequency, level), a three-band EQ (low shelf, movable mid band, high shelf) and high-pass and low-pass filters.
- A speaker is loudest next to it and fades smoothly to silence at its radius.
- Speakers in range are heard together. The mix is turned down as a whole only when it would be louder than one speaker at full volume.
- A speaker to the left on screen sounds from the left, and likewise for the right.
- A bass drone under the noise is part of the default sound, because low sound helps masking.
- Sound never starts before the player presses a button.

## Private Garden

- Works with no network, no login and no location consent.
- The player places, moves, tunes and removes speakers (at most 24).
- Built-in presets give ready layouts; the first one is the starting garden.
- The player saves the current layout as an own preset (at most 20; the same name replaces), applies and deletes presets.
- Reset returns the garden and the own presets to the first-run state after a confirmation.
- Everything is kept on the device only.

## Public Garden

- One garden shared by everyone, served by the jace-s API.
- Entering needs location consent. The consent card says what is used and that chat is recorded.
- With device location permission the place is the city nearest to the device; otherwise it is estimated from the internet address. Coordinates are rounded to about 1 km before they leave the device. Coordinates and the internet address are never shown.
- The city-level place is shown above every character.
- Guests can walk and listen. Chat needs a jace-s account login.
- Speakers can be placed and tuned only by an administrator or an account or role granted the edit permission. Others do not see the edit controls.
- Consent can be withdrawn in settings, which leaves the public garden.

## Nearby Chat

- A message appears as a speech bubble above the sender for 6 seconds, to players within 10 tiles.
- A nearby message must be noticeable without breaking the masking, so no notification sound is played. The default cue keeps volume and bass and briefly darkens the tone of the noise (about 0.3 s with 0.05 s fades), deeper when the sender is closer and leaning toward the sender's side. On phones a light vibration accompanies it.
- Settings offer two alternatives: a short volume dip, or no cue.

## Platforms

- One codebase builds the web app (hosted on Vercel), the Android app and the Windows desktop app. The iPhone app is configured but not built yet.
- In the phone apps sound keeps playing while the app is in the background or the screen is off, with play and pause on the lock screen. A phone browser tab may be paused by the system; background play needs the app.

## Example

- Input: A player in the private garden stands 2 tiles from a brown noise speaker with radius 8, then walks 10 tiles away.
- Steps: Loudness follows `(1 - distance / radius)²`.
- Result: About 56% loudness at 2 tiles, silence beyond 8 tiles.
