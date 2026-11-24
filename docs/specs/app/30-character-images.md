# Character Images

- Design: [Character Images Design](../../design/app/30-character-images.md)
- Scenarios: [Character Image Scenarios](../../testing/test-cases/app/30-character-images.md)
- Server rules (permission, review, limits, image map format): the jace-s platform, `docs/specs/hush-garden/20-character-images.md`

Besides the ten drawn characters, a player may appear as a character of their own, drawn from an image map that an AI chat made for them and an administrator approved.

## Making One With An AI

- Settings → Custom characters has "Copy prompt". The prompt is in the app's language.
- Pasted into an AI chat that can run code, the prompt makes the AI first ask what character the player wants (what it is, colours, mood, and how it makes and discards a speaker). When the player answers, the AI draws the image map with code to the exact format and gives a PNG file to download, and offers changes.
- The format: one 1024 × 768 PNG, 8 × 6 frames of 128 × 128, transparent, facing right, feet on the bottom centre point. Rows: standing (1 frame), walking (4), lifting a speaker (6, ending overhead), walking while holding it (4), making a speaker (8), discarding one (8). No speaker is drawn.

## Custom Characters

- Shown to a logged-in player in the settings. It lists up to five characters with a still picture, the name and the state: waiting for review, approved (with who approved it) or rejected (with the reason, if any).
- An approved character has "Use"; the one in use shows "In use". Choosing a drawn character in a character picker stops using it.
- Every character has "Delete", after a confirmation.
- A player with the upload permission sees a name field and "Upload image". The picked file must be a 1024 × 768 PNG; the server checks it again. The new character waits for review. At five characters the upload is hidden.
- A player without the permission sees that uploading needs an administrator's approval of the account.
- A character in use that is no longer approved (deleted, or never was) is dropped and the drawn character is used.

## In The Garden

- The player's own character is drawn from its image: standing, walking, holding a speaker overhead, lifting and putting down, making and discarding, facing either way. The speaker, its sound and its shadow behave as with drawn characters.
- Other players' image characters download when they appear. Until the image has loaded, the player is shown as one of the ten drawn characters, always the same one for that character, with a loading mark above the name. A failed download keeps the drawn character and is tried again after 30 seconds.
- A loaded image is shown at once the next time, also after leaving and entering again.
- When a character is deleted while in use, everyone sees that player's drawn character from then on.
- The private garden uses the same character.

## Example

- Input: Mina copies the prompt, asks for "a mochi rice cake that bounces", uploads the PNG as "Mochi"; an administrator approves it.
- Steps: Mina presses Use on Mochi and enters the public garden. Jun is already there.
- Result: Jun sees a drawn fox with a spinning mark above Mina's name for a moment, then Mochi walking. When Mina makes a speaker, Mochi plays its making row and the speaker appears in its hands.
