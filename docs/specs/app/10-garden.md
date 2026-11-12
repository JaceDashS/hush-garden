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
  volume, noise (white, pink or brown) with its level, up to two oscillators and one equalizer.
- There is no hearing distance setting. A louder speaker is heard farther away: its reach grows evenly from 2 tiles at volume 0 to 11 tiles at full volume.
- A speaker is loudest next to it and fades smoothly to silence at its reach.
- Speakers in range are heard together. The mix is turned down as a whole only when it would be louder than one speaker at full volume.
- A speaker to the left on screen sounds from the left, and likewise for the right.
- Low sound helps masking, so the default sound carries a low tone: oscillator A starts as a 55 Hz sine. There is no separate bass control.
- Sound never starts before the player presses a button.

## Oscillators

- A speaker has at most two oscillators, named OSC A and OSC B. The player adds and removes them.
- Each oscillator is a panel in the manner of synthesiser panels: a display that draws its wave, four picture buttons that choose the wave (sine, triangle, square, sawtooth; pictures, not words), and two knobs: frequency (20 Hz to 8 kHz) and level.
- A knob is turned by dragging up or right to raise and down or left to lower.
- A sound saved while speakers still had a bass drone keeps its low tone: the drone becomes a sine oscillator of the same loudness in front of the others, and anything beyond two oscillators is dropped.

## Sound Shadows

- Every speaker always shows its sound on the ground as concentric sound waves: rings that keep spreading from the speaker and fade out at the speaker's reach, over a faint fill of the area it is heard in. No mode has to be switched on to see it.
- The waves have the colour of the noise: brown for brown noise, pink for pink noise, white for white noise.
- A louder speaker is heard further away, so its waves spread wider, and they are brighter. A silent speaker sends none.
- Where waves overlap, their colours blend.
- A held speaker's shadow moves with the character.

## Equalizer

- The equalizer and the low and high filters are one control: a single curve with three points, in the style of graphical parametric equalizers. A new speaker starts with a low boost, a bell and a high boost.
- Every point can be switched to any of five filter kinds: bell, low cut, low boost (low shelf), high boost (high shelf) and high cut. Every kind has a Q.
- The curve is drawn on a graph of frequency (20 Hz to 20 kHz, by octave) against gain. Each point is numbered on the curve. Dragging a point sideways changes its frequency and dragging it up or down changes its gain. A cut point only moves sideways.
- Selecting a point shows its filter kind as choices and its Q on a knob.
- With a mouse the grab cursor shows only over a point that can be grabbed.
- A spectrum analyser is drawn behind the curve: the live spectrum of the held speaker after its equalizer, or of the whole mix when that speaker is out of hearing range.
- The selected point's number, kind, frequency and gain are shown under the graph.

## Handling Speakers

- There is no edit mode and no edit button in the top bar. A speaker is handled with the character's hands.
- Lift: when the character stands within 1.6 tiles of a speaker and its hands are free, a "lift" button appears beside that speaker. Pressing it lifts the speaker overhead.
- While holding, the character walks as usual with both arms up, and the speaker's sound and shadow move with it. Two buttons appear beside the character: "put down" and "edit".
- While a speaker is lifted or put down, its sound and its waves move along the ground with it, by how far it has moved sideways toward or away from the character; raising it overhead does not move them.
- Lifting starts on the speaker exactly where it stands and putting down ends exactly where it will stand, so neither moment jumps. The speaker keeps its full size while held and while moving. Put down plays the lift animation backwards and places the speaker one step in front of the character.
- Edit opens the sound controls. A speaker can be edited only while it is held; putting it down or discarding it closes the controls.
- Make: the top left button "make a speaker" plays the character's making animation; when it ends, a new speaker with the default sound is in the character's hands.
- Discard: while holding, the top left button becomes "discard speaker". It plays the character's discarding animation; when it ends, the speaker is gone.
- Each of the ten characters has its own making animation and its own discarding animation, twenty in all. For example the chick lays an egg that hatches into a speaker and pecks a speaker to crumbs; the penguin slides away on its belly and comes back pushing one, and slaps one away over the ice.
- The character cannot walk or start another action while an animation plays.
- In the public garden only players who may edit see these buttons. Other players see the result (a speaker appearing, moving or disappearing), not the holding or the animations.

## Speaker Controls On A Phone

- Every speaker control works with a thumb on a phone as well as with a mouse.
- The controls are three tabs so each fits a phone screen: Sound (volume, noise), Oscillators, Equalizer.
- While a slider, a knob or an equalizer point is dragged, the page does not scroll.

## Top Bar And Settings

- Top left: the speaker button (make, or discard while holding), for players who may edit.
- Top centre: the garden name, the number of visitors in the public garden, and the number of speakers heard.
- Top right: a settings icon.
- Escape opens the settings and closes them, or any other open panel, again (web and desktop).
- Settings hold everything else: sound on and off, master volume, character, language, character name, nearby chat cue, presets (private garden), account (public garden) and leaving the garden.

## Languages

- The screens are in Korean, English, Japanese or Chinese (simplified). The player chooses in settings; the choice is kept on the device.
- Until the player chooses, the device language is used, or English when the device uses another language.

## Private Garden

- Works with no network, no login and no location consent.
- The player makes, carries, tunes and discards speakers (at most 24).
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
- Speakers can be made, moved, tuned and discarded only by an administrator or an account or role granted the edit permission. Others do not see the speaker buttons.

## Nearby Chat

- A message appears as a speech bubble above the sender for 6 seconds, to players within 10 tiles.
- A nearby message must be noticeable without breaking the masking, so no notification sound is played. The default cue keeps volume and bass and briefly darkens the tone of the noise (about 0.3 s with 0.05 s fades), deeper when the sender is closer and leaning toward the sender's side. On phones a light vibration accompanies it.
- Settings offer two alternatives: a short volume dip, or no cue.

## Platforms

- One codebase builds the web app (hosted on Vercel), the Android app and the Windows desktop app. The iPhone app is configured but not built yet.
- In the phone apps sound keeps playing while the app is in the background or the screen is off, with play and pause on the lock screen. A phone browser tab may be paused by the system; background play needs the app.

## Example

- Input: A player in the private garden stands 2 tiles from a brown noise speaker at volume 0.7, then walks 10 tiles away.
- Steps: The reach is `2 + 9 × 0.7 = 8.3` tiles. Loudness follows `volume × (1 - distance / reach)²`.
- Result: About 40% loudness at 2 tiles, silence beyond 8.3 tiles; the brown shadow on the ground ends there too.

## Desktop Chat Focus
- Desktop web chat focuses when available and after sending. Enter sends without losing focus. Phones retain manual focus.
- Example: Input an authenticated PC player; steps send nearby chat; expected result the empty chat field stays ready for the next message.
- Design: [Desktop Chat Focus](../../design/app/10-garden.md#desktop-chat-focus).

## Account Character Name Restore
- Public garden entry after login restores the account nickname instead of the device nickname. Explicit online name changes persist on the server. Private gardens and guests retain device settings.
- Example: Input a second device with an old name. Steps: Log in and enter the public garden. Expected result: The saved account nickname appears.
- Design: [Account Character Name Restore](../../design/app/10-garden.md#account-character-name-restore).
