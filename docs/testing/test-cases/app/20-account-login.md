# Account Login Scenarios
- Design: [Account Login](../../../design/app/20-account-login.md).

## Native Session
- Input: A fresh nonce and valid native credential exchange with session and csrf cookies.
- Steps: Challenge, exchange, then logout.
- Expected result: User is set only after the encrypted store is populated; logout uses saved CSRF and clears storage.
- Test: tests/client.test.ts native Google exchange and missing-session cases.

## Cancel And Retry
- Input: A cancelled selection followed by retry, and separately a late selection after dismissal.
- Steps: Cancel, retry, dismiss while selection is pending.
- Expected result: Cancellation and dismissed results never exchange credentials. Retry obtains a fresh nonce and disables automatic account selection.
- Test: tests/client.test.ts cancellation and stale-result case.

## Disabled Configuration
- Input: Server disables Google sign in.
- Steps: Attempt native Google orchestration.
- Expected result: No picker, challenge or credential exchange.
- Test: tests/client.test.ts disabled configuration case.

## Platform Separation
- Input: Web and Android product exports.
- Steps: Build both bundles.
- Expected result: Web keeps its browser Google button; Android includes its native button and native exchange.
- Verification 2026-11-13: TypeScript, 53 product tests, Expo web export and Android Hermes bundle export passed. Android APK compilation and real account selection have not been verified.
