# Planning the next round and the next expedition

## Battle tactics

During battle planning, choose **Battle tactics** beside the round controls. The window shows each enemy's current HP, announced intent and whether it has fallen, plus each hero's physical attack type.

Weaknesses and resistances appear only after a victory against that exact regional enemy and strength rank has added its bestiary entry. An Ashen or Crested variant does not inherit discovery from the base enemy. Boss/rare aliases and the Choir's shared entry use the same identity rules as the bestiary. Unrecorded enemies show a discovery hint.

Reading or closing the window spends no action, item or charge and does not change RNG. It does not disclose hidden attack/defense or promise a damage amount. Normal close controls and Escape return to planning; the panel cannot stay open after planning ends.

The battle supply list now distinguishes **owned**, **reserved** and **available** items. Other heroes' queued item uses reserve copies. Editing the current hero's plan releases that hero's existing reservation for the availability calculation. Invalid cure and revival targets are disabled. Healing can still be planned for a healthy ally in anticipation of an enemy hit; redundant healing retains the item under the existing engine rules.

## One tracked commission

After accepting work at a board, open **Menu → Wayfarer Journal** and select **Track commission** on its card. One accepted, unfinished commission can be followed at a time. A compact line beside the exploration objective shows its progress and next step, including the correct return town when it is ready.

**View commission** opens the relevant journal region and focuses its card. **Stop tracking** clears the line. Delivering the tracked commission clears it automatically. Tracking persists through reloads, changes no rewards or progression, and cannot accept or deliver work remotely. It remains hidden during combat and results.

## On this floor

The dungeon area map includes a small **On this floor** checklist. It counts only discoveries authored on that floor: copied records, opened caches, opened cross-locks and opened return lifts. Counts update from the actual saved flags, including the original opening lockbox flag. Floors without a particular discovery type omit that row.

These are optional exploration notes. They do not claim that the guardian or main objective is complete. Towns and the overworld do not show dungeon checklists, and opening the map does not change resources, move the party or reveal another floor's map.

## Compatibility and evidence

The prior engagement build is archived as `journey-baseline.html`. Three hash-guarded patch modules reproduce this update. Only optional commission-tracking data is added to the save model; missing or invalid references become null. Existing difficulty, 24-spell catalog, spell practice, equipment copies, earned resources, story outcomes and earlier journal progress remain intact.

Twenty-one new helper/core checks cover discovered notes, reservation/target consistency, save-compatible tracking and actual floor interactions. Together with prior coverage, 306 checks pass. The browser suite uses actual interface actions and identifies its later-state fixtures explicitly. Exact hashes, final browser counts and screenshot evidence are recorded in `journey-manifest.json`.

The new tools do not retune combat or the campaign economy. Prepared fixtures and measured routes are not a full campaign playthrough; longer Hard/Hell balance testing remains separate.
