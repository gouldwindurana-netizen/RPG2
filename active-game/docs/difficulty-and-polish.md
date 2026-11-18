# Difficulty build merge and fixes

The exact uploaded difficulty HTML is archived as `difficulty-upload.html` (SHA256 `cbb83307ef4e82b2c57f3416457d3633b4789b2a674b022ed7792f21fd147487`). Its 38 edits merge into the current game; its older maps/rendering do not replace the 33-floor dungeon update. The upload receipt reconstructs the user's file byte for byte from `depth-baseline.html` before applying edits to the polished game.

## Preserved user changes

| Mode | Enemy HP | Enemy attack | Enemy defense |
| --- | ---: | ---: | ---: |
| Easy | ×1 | ×1 | ×1 |
| Normal | ×1.35 | ×1.25 | ×1.15 |
| Hard | ×1.8 | ×1.6 | ×1.3 |
| Hell | ×2.6 | ×2.2 | ×1.6 |

Choose a mode during creation or cycle it in Items / Equipment between encounters. Scaling applies once when enemies are generated, with the uploaded rounding. Rewards remain the current slower budgets in every mode. Old saves default to Easy to retain their previous enemy strength. No party-level scaling was added.

The 18 regional set pieces retain every uploaded stat. Attack types follow the uploaded job map: Warden/Spellblade slash, Striker/Scout pierce, Mender/Arcanist blunt. Family weaknesses and resistances are preserved, with weakness taking precedence. The combat log explains physical weakness/resistance hits.

Lumen and Umbra are tier-one single-target light/dark spells; Radiance and Nightfall are tier-three group spells. Menders and Arcanists can learn them through the existing Magic Shops. New heroes retain starter spells; buying and tier unlock rules still apply. Existing explicit spellbooks are not rewritten.

Successful battle casting grants one practice use per traveler and spell, including group spells. Level is `min(16, floor((1 + sqrt(1 + 4*uses))/2))`; the uploaded power multiplier is `1 + 0.1*(level-1)`. Growth gained by a cast applies to that cast. Damage scales fully; recovery scales its authored power component as in the upload. Field spells retain battle-only practice behavior. Spell menus display current level and battle casts. Invalid, silenced or charge-less casts gain none.

Creation retains the uploaded Saitama/he defaults, Hana/female default switch, appearance adjustments and Male/Female controls. Custom names and older identities survive imports.

## Verified bug fixes

- Equipment magic defense was displayed but ineffective. It now derives from worn items and reduces Wisp/Cantor magical pulses alongside existing defense. Physical damage, guard, shields and set-resistance order remain intact.
- Full-health field potions no longer disappear without effect. A redundant battle heal retains its item; planning can still anticipate damage. Owned Packed Meals restore 30% HP outside battle. Spark/Deep Tea restore exactly one spent charge in an explicitly selected permitted tier. No shops or drops were added for these supplies.
- Shop comparisons include lost stats, use customized names and mark mixed gains/losses as a trade-off. Purchases reject invalid quantities before changing gold or inventory. Owned/equipped/available counts keep their existing five-slot rule.
- Keyboard navigation scrolls focused targets and spells into view. Quick planning focuses Resolve; Clear plan returns to Attack.
- Optional practice import accepts only known heroes/spells and integer counters from 0 to one billion. Malformed counters are discarded while the rest of a valid save remains usable. Difficulty changes are restricted to exploration so an active battle cannot disagree with its chosen mode.
- Practiced revival is capped at maximum HP. Rebirth therefore cannot grant above-maximum health as its spell level grows; weaker Revive still gains its uploaded recovery growth.

## Validation boundaries

The merged game passes 258 engine/UI/renderer checks, including 14 dedicated merge checks. They compare all uploaded set stats, difficulty factors and new spell definitions; exercise mastery and save migration; and retain all prior equipment/travel/dungeon/reward coverage. Browser evidence and exact delivered hashes are recorded in `polish-manifest.json` after final checks.

Earned opening expeditions still complete on the default mode with the uploaded physical affinities. The second-region shopping probe now reserves its inn fund before buying more spells. These measured routes and declared later-level fixtures do not establish whole-campaign balance for all four modes; Hard/Hell still need longer player playtesting.
