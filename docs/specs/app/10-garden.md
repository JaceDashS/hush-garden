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

## Characters

- The player chooses one of ten characters on the title screen: bunny, cat, bear, frog, chick, fox, penguin, pig, panda and mouse. The choice is kept on the device.
- Every character has a walking animation: while it moves, its feet step in turn, its body bobs, its arms swing and its ears sway. It stands still when it stops. No character is a single fixed picture.
- Other players are drawn with the character they chose, facing the way they move and walking while they move.

## Character Name

- A name is shown above every character, with the place under it in the public garden.
- The player can change the name in settings at any time, also while in the public garden.
- A name is 1 to 16 characters. An empty name means the account name, or "Guest" without a login.
- Names that could pass for staff or for the service are refused, also when written with spaces, symbols or look-alike digits: for example admin, administrator, moderator, staff, official, system, support, owner, operator, developer, GM, 관리자, 운영자, 매니저, 공식, and the service names.
- The server decides. A refused name at entry falls back to the account name instead of blocking the visit.

## Speakers And Sound

- There is one kind of speaker. Every speaker has the same controls:
  volume, hearing radius, noise (white, pink or brown) with its level, a bass drone (frequency and level), up to three oscillators (wave, frequency, level) and one equalizer.
- A speaker is loudest next to it and fades smoothly to silence at its radius.
- Speakers in range are heard together. The mix is turned down as a whole only when it would be louder than one speaker at full volume.
- A speaker to the left on screen sounds from the left, and likewise for the right.
- A bass drone under the noise is part of the default sound, because low sound helps masking.
- Sound never starts before the player presses a button.

## Equalizer

- The equalizer and the low and high filters are one control: a single curve with five bands, in the style of graphical parametric equalizers. From left to right: low cut, low shelf, bell, high shelf, high cut.
- The curve is drawn on a graph of frequency (20 Hz to 20 kHz, by octave) against gain. Each band is a numbered point on the curve. Dragging a point sideways changes its frequency and dragging it up or down changes its gain. The two cut points only move sideways. The bell has a width (Q) control.
- The high cut never goes below the low cut.
- A spectrum analyser is drawn behind the curve: the live spectrum of the selected speaker after its equalizer, or of the whole mix when that speaker is out of hearing range.
- The selected band's name, frequency and gain are shown under the graph.

## Carrying A Speaker

- A speaker is moved by carrying it, not by pointing at a spot. With a speaker selected in edit mode, "carry" makes the character walk to the speaker, lift it overhead and hold it with both arms up.
- While carrying, the character walks as usual and the speaker's sound moves with it.
- "Put down here" places the speaker one step in front of the character.
- Walking by hand while the character is on its way cancels the pick-up. Closing the editor or leaving edit mode puts the speaker down.
- In the public garden other players see the speaker at its new place when it is put down.

## Private Garden

- Works with no network, no login and no location consent.
- The player places, carries, tunes and removes speakers (at most 24).
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

## Desktop Chat Focus
- Desktop web chat focuses when available and after sending. Enter sends without losing focus. Phones retain manual focus.
- Example: Input an authenticated PC player; steps send nearby chat; expected result the empty chat field stays ready for the next message.
- Design: [Desktop Chat Focus](../../design/app/10-garden.md#desktop-chat-focus).

## Account Character Name Restore
- Public garden entry after login restores the account nickname instead of the device nickname. Explicit online name changes persist on the server. Private gardens and guests retain device settings.
- Example: Input a second device with an old name. Steps: Log in and enter the public garden. Expected result: The saved account nickname appears.
- Design: [Account Character Name Restore](../../design/app/10-garden.md#account-character-name-restore).
