# Shops and town life

The current update builds on the polished visual game archived in `settlement-baseline.html`. It retains the growth build, regional rare encounters, original story, MP and jobs, equipment ownership and compatible saved journeys.

## Walk-in stores

The existing weapon and skill buildings in Reedbank, Dunmere, the Fen settlement, Orchard, Crown Road and Veyr now have twelve safe interiors. Walk onto a building's door, approach the merchant at the counter, and interact to buy equipment or learn skills. The south door returns beside that same building. Outdoor item counters remain outdoor services.

Merchants keep their original IDs, shop categories, regional stock, prices and quantity controls. No new exterior world sites are added. Old saves that were already showing a shop menu still load. Inside stores, local prompts explain the counter and return door; shop rooms do not provide an inn or resting service.

## Optional citizen movement

Under **System → Town citizens**, choose **Wander** or **Stay still**. Ordinary citizens can take short walks around their home positions. Merchants and important quest keepers remain at their posts. Citizens stop near the party, and movement pauses during conversations, menus, path following, battles and results.

Moving characters use the same positions for drawing, collision, pathing and interaction. Their movements use a separate random sequence and do not consume the combat RNG, steps, supplies or rewards. The setting persists. Positions are temporary and safely reinitialized on map entry or reload, avoiding the party's position and important entrances.

## Presentation

Rounded foliage, softer path and bank transitions, warm light and curved title hills reduce the rigid appearance while retaining crisp character art. The party menu keeps its eight destinations and original portraits, with visible current HP/MP, clearer commands and a responsive layout.

## Reproduction and checks

`tools/build_settlement.py` applies `settlement_shops.py`, `settlement_npcs.py`, `settlement_soften.py` and `settlement_menu.py`. It preserves the archived visual work and checks that encounter creation, combat rewards and base hero-stat code remain unchanged. Earlier assemblers must not overwrite this build.

Current verification includes paired travel for all twelve shops, actual purchases and skill learning, legacy save import, movement safety and pause behavior, equipment ownership, desktop/mobile menus and browser screenshots. Final build hashes, logs and bounded coverage are recorded in `settlement-manifest.json`. These checks do not represent a complete campaign or economy balance playthrough.
