# Jobs, skills and mana

Every job now has an MP pool and usable skills. **Skills** replaces the former Magic command, and town **Skill Shops** teach both techniques and magic for the selected traveler's current job. The catalogue has 40 unique abilities: all 24 earlier magic abilities plus 16 martial techniques. Basic Attack and Guard cost nothing.

## Job choices

Choose Tavin, Iona and Soren's jobs on the appearance/party step of new-game creation. The lead hero keeps the existing job-selection step. During a journey, open **Menu → Jobs** at a safe shelter, select a traveler and job, review HP/MP, stats and equipment, then choose **Apply**.

| Job | Level-one MP | MP gained per level | Skills |
| --- | ---: | ---: | --- |
| Warden | 12 | 2 | Shield Bash, Rally, Guardian Strike, Iron Cyclone |
| Striker | 12 | 2 | Power Strike, Sweeping Kick, Twin Fang, Driving Finish |
| Scout | 14 | 2 | Quickshot, Scatter Volley, Precision Strike, Horizon Shot |
| Spellblade | 16 | 3 | Arc Slash, Runic Sweep, Warding Circle, Runebreaker, plus Mend/Ember |
| Mender | 20 | 4 | Its 14 compatible recovery/light/dark magic abilities |
| Arcanist | 18 | 5 | Its 14 compatible elemental/light/dark magic abilities |

The four techniques in each martial/hybrid job unlock at levels1/5/9/17 and cost3/5/7/10MP. Spellblade's Warding Circle costs7MP. Rally and Warding Circle protect living allies for the remaining round without restoring resources. Offensive techniques use the job's physical type, existing hit count, skill practice, weaknesses/resistances and the described armor penetration. Group techniques spend MP and gain practice once per use.

Each job begins with its basic ability; Spellblade also starts with Mend and Ember. Further training costs gold at the Skill Shop. Learned abilities remain with their individual owner when jobs change and become usable again upon returning to a compatible job. A new job never grants its advanced abilities automatically.

Switching jobs does not restore HP/MP or revive anyone. Current values are capped if the new maximum is smaller; returning to a larger pool does not undo that loss. Conditions, level, EXP and ability practice stay intact. Incompatible equipment remains owned in the shared pack. The game equips a free compatible owned replacement when available, and leaves a slot empty when none exists. It never takes gear worn by another traveler or creates free equipment.

## MP use and recovery

Magic retains its earlier powers, schools and level requirements. Base MP costs by old tier are4/8/12/16/22/28/34/40, with explicit costs on individual abilities such as Shelter5, Cleanse6, Kindle10, Haven20 and Sanctuary26. The menus show each actual cost. Techniques work while silenced; magic is blocked. Sleep and falling still prevent actions.

Planning reserves an action without spending MP. Execution rechecks job, learning, level, conditions, MP and targets. A valid group skill spends once. Invalid recovery targets retain MP. Normal shelter/inn recovery and defeat recovery restore the party's MP. Level growth adds only newly gained capacity; changing equipment or learning a skill does not refill it.

Spark Tea restores20MP and Deep Tea60MP, up to the target's maximum. Both can be used on a living traveler in the field or through a normal battle item action. A full MP pool keeps the item. Spark Tea is stocked from the third region at450G; Deep Tea remains a finite commission/expedition supply. Shop quantity controls retain their earlier99-copy cap.

## Equipment selection and supplies

At a Weapon Shop, select the traveler to compare, filter by equipment slot and optionally show only usable gear. Offers name the currently worn item, list base-stat gains and losses, mark mixed changes as trade-offs and show owned/equipped/available copy counts. Purchases still add to the shared pack; they do not silently change equipment. Buy1/5/10/Max and spare-copy sales keep their existing rules.

The inventory has **All**, **Equipment** and **Supplies** views. Character tabs and the selected recipient summary show current HP/MP and conditions. Recovery items preview the actual before/after value and any unused recovery before consumption—for example, a60HP Potion at43/100HP previews100/100 with57HP recovered and3 unused. Full-health potions and inapplicable remedies are disabled. After use, the current resource summary updates and retains a keyboard focus target.

Battle recovery feedback now reports actual restored HP/MP, including caps and healing modifiers. Condition cures show a cure result. A mana tea no longer produces a misleading MISS, and a full-health first party member is not used for another ally's healing number.

## Saves and testing

The pre-update game is archived as `jobs-baseline.html`. Version1–3 charge saves import into version4, retaining their journey and converting remaining weighted charge capacity proportionally into MP. Fully depleted caster reserves stay depleted; earlier martial jobs receive their new MP resource. Learned magic, equipment copies, difficulty, practice, gold, EXP, story outcomes, commissions, bestiary, tracking and camp history remain.

Version4 stores the four selected jobs and MP and validates earned skill history. Nullable equipment slots are supported. Legacy charge arrays may exist as migration metadata; active play uses MP.

Engine, compatibility, combat, feedback, inventory and browser evidence is recorded with exact hashes in `jobs-manifest.json`. Automated earned-resource opening/second-region probes and prepared late-region formations remain useful bounds; they do not establish every four-job combination or full-campaign Hard/Hell balance. Longer player playtesting remains necessary for that tuning.
