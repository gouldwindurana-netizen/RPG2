# Aligned entrances and town exits

This correction starts from the completed camp-menu game archived in `entrances-baseline.html`. It fixes the relationship between visible openings, walkable thresholds and destination records without changing combat or earned resources.

## Starting-area buildings

All four Reedbank buildings have real paired entrances. The existing weapon and skill shops retain their original merchants and services. The other two tents lead to quiet shelter rooms with resident conversations; they add no quest rewards, supplies or recovery service.

Entrance triggers sit in the actual bottom row of each façade, with clear customer approaches directly below. Shop thresholds in the other settlements use the same rule. Rendering uses explicit entrance metadata so the visible opening, clickable tile and paired return agree, without a second wooden door floating in front of the building.

## Consistent western exit

Reedbank now follows the other towns: leave along the western road, and arrive just inside facing toward town. A real boardwalk crosses the starting river and joins the existing path. The old isolated eastern gate is removed.

The original overworld destination and saved field approach remain unchanged. There are still ten canonical exterior world sites; local building doors do not duplicate them. Existing story gates, arrival pauses and crossing encounter protection remain.

## Saved journeys

Existing town and indoor saves remain valid. If an old Reedbank player or checkpoint lies on one of the exact former grass tiles now occupied by a corrected façade, move only that position to the matching safe doorway approach before normal validation. Do not reset gold, EXP, equipment, jobs, growth, learned skills, difficulty, quests or discoveries. Unrelated invalid save data still follows the existing validator.

## Reproduction and checks

`tools/build_entrances.py` applies `entrances_world.py` and `entrances_render.py` to the immutable baseline, syntax-checks the game and verifies unchanged encounter/reward and base-stat code. `entrances-manifest.json` records hashes and final validation.

Tests exercise actual paths through all four starting buildings, the twelve existing shops, six town exits, paired returns, saved positions, and keyboard/pointer/touch behavior. Desktop/mobile screenshots check that the drawn thresholds match the real entrance cells. This is bounded travel and save-compatibility QA, not a full campaign playthrough.
