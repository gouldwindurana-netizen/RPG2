# Project direction

## Current preview and delivery

The user-selected playable baseline is `/workspace/active-game/The_Road_Beyond_the_Bells.html`; read `/workspace/active-game/AGENTS.md` before changing it. The default dev preview serves that HTML directly at the existing root URL and port 5173. `npm run build` syntax-checks and copies it unchanged into `dist/index.html` and `demo/index.html`; `npm run preview` serves the built copy. When the selected workspace file is absent, the resolver uses the committed `active-game/The_Road_Beyond_the_Bells.html`, then the packaged demo. The committed `active-game/` snapshot contains current patch tools and tests; generated browser traces and caches are excluded. Preserve the common save key and avoid an iframe or origin change.

The old TypeScript source, data, and source tests remain in this checkout for reference. Do not regenerate them over the selected uploaded game or claim their tests verify the current standalone game. Current regression tests are in `/workspace/active-game/tests/`. Source integration requires deliberate porting. Do not push or publish unless requested.

The selected game now also contains the deeper-dungeon update: 33 floors across six expeditions, stable count/size battle formations, a vertical party, location-specific battle scenery, floor/route planning, and reduced future rewards. Its current reproduction path is `/workspace/active-game/tools/build_depth.py`; do not replay older generators over it. Preserve saved progress and keep the packaged demo in sync after further edits.

Keep the established classic party-RPG direction consistent when adding features:

- Build around a traversable tile-based overworld connecting safe towns and dangerous dungeons. Exploration should lead to fixed regional monster formations, treasure, conversations, and new travel routes.
- Activate travel by walking onto entrances and exits, with safe approach returns and no random encounter on the crossing step. Preserve overworld return positions through shop/inn visits and reloads. Town services should have clear doors and upfront lodging prices.
- Keep exploration focused on the playfield with compact status and contextual prompts; use local maps for exits, services, and treasure counts.
- Use whole-party command selection followed by turn-based resolution. Menus wait for the player; animation speed does not change combat outcomes.
- Keep the four-person party readable, with distinct customizable jobs, MP-based skills, equipment choices, and visible EXP progression.
- Use compact blue menu windows with silver borders, clear selection cursors, and white text. Preserve the playfield and support keyboard and touch input.
- Use original characters, names, stories, artwork, and sounds. Keep private comparison research outside the published repository and retain required third-party license notices.
- Preserve compatible saved progress when extending the world. Never erase a journey merely because the player opens or cancels character creation.
- Keep simulation rules outside Phaser rendering. Use the existing checkout and stack.
- Verify relevant engine, browser, and content checks. Distinguish implemented gameplay from future design documents, and refresh the standalone build when delivering a playable change.


The current standalone game starts from the user's November 19 growth upload. Preserve usage-based growth, regional skill-store distribution, MP/jobs and compatible saves. Regional rare foes are repeatable dangerous encounters with a seeded 5% chance and guaranteed missing-first regional set drops; the 18 regional set items support owned copies for multiple travelers. Stationary mission-linked rares are removed. Current reproduction is `active-game/tools/build_growth.py`; read that directory's current instructions. Refresh the committed snapshot from the authoritative workspace game when synchronizing further cloud edits, never the reverse. Do not push/publish without a new request.


Current follow-up includes the visual pass, twelve walk-in building shops, optional town-citizen wandering, softer artwork and the main party menu. The selected external HTML remains authoritative. Current reproduction is `active-game/tools/build_settlement.py` (baseline `settlement-baseline.html`); earlier generators must not overwrite it. Preserve paired shop travel, original merchant services, compatible saves, independent safe NPC motion and current HP/MP presentation. Tests and bounded browser receipts are under `active-game/tests/`. Do not push or publish unless requested.


The newest menu layer uses `active-game/tools/build_camp_menu.py` from `camp-menu-baseline.html`. It preserves all gameplay/save code while applying `camp_title` and `camp_ledger`. Keep the camp title fixed/scrollable, the moon cutout transparent, actual journey previews truthful and How to Play keyboard-accessible. Travel ledger retains the menu key/eight accessible destinations, HP/MP/conditions and existing close handlers. Current menu browser checks use `tests/camp-menu-playwright.config.mjs`. Earlier assemblers reproduce earlier snapshots; no push/publish without a new request.

The newest entrance layer uses `active-game/tools/build_entrances.py` from `entrances-baseline.html`. Read the active-game instructions for its four enterable starting buildings, twelve aligned shop thresholds, paired local returns, six consistent western town exits and narrowly scoped legacy-position normalization. Preserve connected house paths, resident-only homes, original merchant services, ten canonical world sites and earned progress. Current travel browser checks use `tests/entrances-playwright.config.mjs`; older assemblers must not overwrite this layer. Sync from the authoritative workspace game and push/publish only when requested.
