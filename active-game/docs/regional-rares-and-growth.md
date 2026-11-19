# Regional rare foes and the growth build

This update starts from the user's uploaded **The Road Beyond the Bells (growth build).html**. `growth-baseline.html` retains that upload unchanged; `growth-previous.html` retains the preceding completed game. Earlier patch generators must not overwrite the uploaded growth mechanics.

## Repeatable rare encounters

Each of the six regions has its own authored rare foe and three-piece equipment set. Rare foes appear through dangerous encounters rather than as optional markers revealed after missions. Safe settlements, entrance crossings and story bosses keep their existing encounter rules.

An eligible ordinary encounter has a seeded **5%** chance to become that region's rare encounter. This is approximately one in twenty encounters over a large sample, not a guarantee every twentieth fight. Fixed regional strength and the uploaded difficulty setting still apply. A rare encounter is an optional challenge: fleeing does not earn equipment or consume a permanent opportunity.

Defeating the rare foe awards **one** piece from its region's set. The selection favors currently missing pieces until the set is complete. Further victories can award additional copies for other travelers. Only the eighteen regional set pieces become repeatable; other unique-item rules remain. All equipment still uses owned/equipped/available copy accounting, job compatibility and normal set bonuses.

Existing sets, earlier rare victories, quest outcomes, gold, EXP and discoveries remain valid. Old readiness and clear flags do not make a regional rare permanently disappear. Story boss and equipment-cache rewards preserve the growth upload's automatic item-award behavior.

## Preserved uploaded changes

- Usage-based growth adds bounded HP, MP, strength, defense, magic and accuracy bonuses when a character levels. Existing growth records persist.
- Skill access follows the uploaded regional shop distribution rather than the preceding level-gated store model. Learned history, current-job compatibility and MP costs still apply.
- Enemy-family recovery drops and victory-earned family notes remain.
- The compact exploration layout, MP-based skills, four customizable jobs, inventory recovery previews, difficulty choices and the main story remain.

## Encounter and presentation fixes

Encounter creation uses the authored rare catalogue rather than an undefined helper. Automatic equipment rewards resolve catalogue item IDs before accessing item fields, and the known accidental invalid reward key is repaired when loading an affected save. Fixes preserve the underlying growth and reward intent.

The interface keeps the blue-and-silver party-RPG style and original artwork. Canvas sizing, compact objectives, battle command panels and shop information are designed for desktop and mobile, with the playfield kept clear.

## Verification

Run the current core and rendering checks from `active-game`:

```sh
node --test tests/*core.test.cjs tests/*renderer.test.cjs
```

The growth browser suite exercises encounter entry, command resolution, return to exploration, regional rare rewards and responsive presentation. Its fixtures establish bounded save states; they are not a complete campaign or an exhaustive economy balance playthrough. Final validation receipts and build hashes are recorded in `growth-manifest.json`.
