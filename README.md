# Hush Garden

A cute quarter-view garden where speakers play masking noise. Walk closer to a speaker and its noise grows louder; use it with earphones to block out a room.

- Private garden: works offline. Place speakers, shape their sound (noise, bass, oscillators, EQ, filters), save presets.
- Public garden: one shared garden. Enter with location consent, see others with their city above their head, and chat nearby after logging in.
- One Expo (React Native) codebase for the web app, the Android app and a Windows desktop app.

## Quick Start

```bash
npm ci
npm run web
```

## Documentation

Start at [docs/00-index.md](docs/00-index.md).

- [Garden spec](docs/specs/app/10-garden.md) — what the game does
- [Architecture](docs/architecture/10-overview.md) — modules and platforms
- [Development](docs/guides/10-development.md) — commands and settings
- [Builds and release](docs/guides/20-builds-and-release.md) — Vercel, Android, Windows

The server side is part of the jace-s platform API.

## License

MIT. Place names on the server come from GeoNames data (CC BY 4.0) through the `all-the-cities` package.
