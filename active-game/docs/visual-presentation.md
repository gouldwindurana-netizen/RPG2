# Visual presentation

This presentation pass starts from the completed growth build archived in `visual-baseline.html`. Its gameplay data, combat engine, growth, regional rare encounters, reward rules and save validation must remain byte-identical through the `var De` boundary. The visual assembler checks that invariant before writing the game.

## Direction

The game keeps its original pixel-art world and blue-and-silver party-RPG windows. Deep indigo surfaces, silver edges and restrained bell-gold accents establish selection and hierarchy. HP and MP retain distinct, readable colors. Decorative work belongs on title and menu surfaces, leaving exploration and battle space clear.

World scenery uses original, locally generated pixel art: regional ground colors, clustered foliage, architectural details and baked light. Battle scenery uses layered outdoor silhouettes or dungeon stonework with restrained pools of light, grounded actors and clear enemy readouts. Rendering changes must preserve map semantics, actor cells and target interaction.

Menus keep their existing verbs and controls. Item recovery previews, equipment-copy counts, job choices, regional set tracking and current HP/MP remain visible. Desktop and mobile share the same visual language; mobile controls must stay reachable and movement controls must remain hidden through battles and results.

## Reproduction and verification

`tools/build_visual.py` applies `visual_world.py`, `visual_battle.py` and `visual_ui.py` to the immutable visual baseline. It syntax-checks embedded scripts, checks unchanged gameplay bytes and records module hashes in `visual-manifest.json`. Earlier generators reproduce earlier archives and must not overwrite this build.

Core and renderer checks verify existing behavior. Browser scenarios exercise title and creation, exploration, varied battle formations, inventory and shop actions, menu navigation, responsive layouts and reduced motion. Screenshots provide the visual evidence. These bounded checks do not represent a complete campaign playthrough or hardware performance benchmark.

All new artwork is generated locally inside the standalone game. No external font, paid provider asset or remote image service is required. Existing third-party notices remain intact.
