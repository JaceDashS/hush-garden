# Builds And Release

Development happens on `dev`. `main` changes only by merging `dev`. Releases are built from this repository; the platform only pins the revision it was integrated with.

## Web On Vercel

- `vercel.json` builds with `npm run export:web`, serves `dist/` and deploys only the `main` branch.
- One-time setup by the owner: import the repository in Vercel, add the domain `hush-garden.jace-s.com`, and add a Cloudflare DNS record for that name pointing at Vercel (the wildcard record of jace-s.com would otherwise send it to the on-premises gateway).
- Server side, one time: add `https://hush-garden.jace-s.com` to `ALLOWED_ORIGINS` of the platform API and to the authorized JavaScript origins of the Google client.
- Release: merge `dev` into `main` and push.

## Android

- Workflow `Android` (manual run, or pushing a tag starting with `v`) builds a release APK and uploads it as the artifact `hush-garden-android`.
- Locally: `npm run build:android`. The script recreates `android/` with Expo prebuild on every run.
- The APK is signed with the debug key that Expo prebuild generates. A store release needs a real signing key first.

## Windows

- Workflow `Windows desktop` (manual run, or pushing a tag starting with `v`) builds the NSIS installer with Tauri and uploads it as the artifact `hush-garden-windows`.
- Locally: install Rust, then `npm run desktop:build`. The installer is in `src-tauri/target/release/bundle/nsis/`.
- The installer is not code signed; Windows SmartScreen warns on first run.

## iPhone

- `app.config.js` has the bundle identifier, the location text and background audio. A build needs a Mac or EAS and an Apple developer account. Not done yet.

## Checks Before A Release

- `npm run typecheck`, `npm test`, `npm run export:web` (the `Product checks` workflow runs them on `main`, `dev` and pull requests).
- If the server contract changed, the platform API must be deployed first; released apps keep calling the old contract.

## Example

- Input: A new built-in preset is ready on `dev`.
- Steps: Checks pass → merge `dev` into `main` → Vercel deploys the web app → run the Android and Windows workflows from the new commit for the apps.
- Result: The web app shows the preset at once; app users get it with the next installed build.
