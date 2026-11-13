# Account Login
- Offer login from the public garden chat and the existing Settings account section. Walking, listening and the private garden remain available without an account.
- Keep password login. Web uses its current Google browser button; Android shows the official Google button in the same login card above the password fields.
- Explicit account selection must precede native token exchange. Cancellation and a dismissed login card must not exchange late credentials. Retrying obtains a fresh nonce.
- Disabled Google configuration hides the Google button. Native login succeeds only after session credentials have been saved.
- Design: [Account Login](../../design/app/20-account-login.md).

## Example
- Input: A guest Android player chooses the chat login action.
- Steps: Open the login card, choose Google, cancel once, then retry and select an account.
- Expected result: Cancellation leaves the garden and login usable. Retry uses a fresh nonce, saves the existing jace-s session and follows the normal public garden re-entry flow.
