# Project direction

## Current preview and delivery

The user-selected playable baseline is `/workspace/active-game/The_Road_Beyond_the_Bells.html`; read `/workspace/active-game/AGENTS.md` before changing it. The default dev preview serves that HTML directly at the existing root URL and port 5173. `npm run build` syntax-checks and copies it unchanged into `dist/index.html` and `demo/index.html`; `npm run preview` serves the built copy. When the selected workspace file is absent, the resolver uses the packaged demo. Preserve the common save key and avoid an iframe or origin change.

The old TypeScript source, data, and source tests remain in this checkout for reference. Do not regenerate them over the selected uploaded game or claim their tests verify the current standalone game. Current regression tests are in `/workspace/active-game/tests/`. Source integration requires deliberate porting. Do not push or publish unless requested.

Keep the established classic party-RPG direction consistent when adding features:

- Build around a traversable tile-based overworld connecting safe towns and dangerous dungeons. Exploration should lead to fixed regional monster formations, treasure, conversations, and new travel routes.
- Activate travel by walking onto entrances and exits, with safe approach returns and no random encounter on the crossing step. Preserve overworld return positions through shop/inn visits and reloads. Town services should have clear doors and upfront lodging prices.
- Keep exploration focused on the playfield with compact status and contextual prompts; use local maps for exits, services, and treasure counts.
- Use whole-party command selection followed by turn-based resolution. Menus wait for the player; animation speed does not change combat outcomes.
- Keep the four-person party readable, with distinct jobs, limited spell-tier charges, equipment choices, and visible EXP progression.
- Use compact blue menu windows with silver borders, clear selection cursors, and white text. Preserve the playfield and support keyboard and touch input.
- Use original characters, names, stories, artwork, and sounds. Keep private comparison research outside the published repository and retain required third-party license notices.
- Preserve compatible saved progress when extending the world. Never erase a journey merely because the player opens or cancels character creation.
- Keep simulation rules outside Phaser rendering. Use the existing checkout and stack.
- Verify relevant engine, browser, and content checks. Distinguish implemented gameplay from future design documents, and refresh the standalone build when delivering a playable change.
