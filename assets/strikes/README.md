# Conquest Strike sound overrides

Drop a short `.mp3` here named after a **sound archetype** and the game plays it
instead of the synthesized version — no code changes needed. If a file is
missing, the game silently uses the built-in synth.

Currently wired to look for real files (see `FC_STRIKE_MP3` in `simulator.html`):

- `wolf.mp3` — wolves, foxes, wild dogs (Turkey, Mongolia, Algeria, Philippines…)
- `eagle.mp3` — eagles, hawks, owls (Nigeria, Germany, USA, Tunisia…)
- `falcon.mp3` — falcons (Saudi Arabia, Qatar, Pakistan, Morocco…)

You can add any of the other 13 archetypes the same way, then add the entry to
`FC_STRIKE_MP3` in `simulator.html`:

`roar, drums, warhorn, bull, dragon, elephant, ocean, rooster, crane, bell, thunder, anthem, horse`

## Where to get free, licensable clips

Use **CC0 / royalty-free** sources so the app stays clean for the Play Store:

- **Pixabay Sound Effects** — https://pixabay.com/sound-effects/search/wolf/ (no attribution required). Swap `wolf` for `eagle`, `falcon`, etc.
- **Freesound.org** — https://freesound.org/ — filter licence to **Creative Commons 0**.

## Tips

- Keep clips **short and punchy** (~1–2 s). The strike is a quick hit, not an ambience.
- Trim silence at the start so it fires exactly when the strike lands.
- Normalize volume; the game plays these at 0.8 gain.
- MP3 keeps the app small; ~30–60 kB per clip is plenty at this length.
