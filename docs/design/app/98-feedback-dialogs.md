# Feedback Dialog Design

- Input: Feedback button activation, draft text, current session, optional guest password and motion preference.
- Output: An in app composer, a public comment confirmation or a retryable error.
- Code: src/components/FeedbackDialog.tsx, src/components/Panels.tsx, src/screens/Game.tsx, src/api/client.ts.

SettingsCard receives the existing HushClient from Game. FeedbackDialog opens a React Native Modal above settings with a fade. Account submissions omit the guest password; guest submissions require it. sourceAppId is 12. All four interface languages are retained.

- Spec: [Feedback Dialogs](../../specs/app/98-feedback-dialogs.md)
- Architecture: [Overview](../../architecture/10-overview.md)
- Scenarios: [Feedback Dialogs](../../testing/scenarios/app/98-feedback-dialogs.md)

## Example

- Input: A visitor opens Feedback with reduced motion disabled.
- Steps: Display the animated composer, enter a draft, receive a failed API response and retry explicitly.
- Expected result: The draft remains available for retry and clears only on success.

```mermaid
flowchart LR
    A["Feedback button"] --> B["In app composer"]
    B --> C["Existing session transport"]
    C --> D["Public comments API"]
    D --> E["Confirmation or retryable error"]
```

## Keyboard Interaction

Escape dismisses only the feedback composer when idle and is ignored during submission. Web feedback overlays trap Tab focus, restore the trigger on close and lock background scrolling; Hush Garden uses the existing React Native modal and captures Escape before the garden settings handler.

## Field Hints

The guest edit password and feedback content use their localized text as placeholders inside the fields. The separate content caption is omitted. Both fields retain accessibility labels when their placeholders disappear during typing.
