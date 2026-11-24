# Current editable game

`The_Road_Beyond_the_Bells.html` is the current standalone game, built on the user's modified uploads. Use this file for play and future changes. It includes the difficulty-build merge, polish fixes, equipment and travel corrections, town services, optional stories, and deeper dungeons. The separate `/workspace/RPG2` source tree is not its source of truth.

The normal preview in `/workspace/RPG2` now serves this exact file at its existing root URL on port 5173. Its `npm run build` syntax-checks and copies these bytes into `dist/index.html` and `demo/index.html`; it does not rebuild the older TypeScript game. The preview keeps the same origin and save key. The preceding preview outputs are backed up in `preview-before-expansion/`.

## Current expansion

- All four Reedbank buildings are enterable. Shop openings match their actual thresholds, two resident homes have connected paths, and the starting town uses the same western exit and inward arrival as the other cities. Existing journeys and merchant services are preserved. See `docs/aligned-entrances.md`.
- Current reproduction is `tools/build_entrances.py` from immutable `entrances-baseline.html`; `entrances-manifest.json` records the tested output. Earlier assemblers reproduce their archived stages and must not overwrite newer work.

- A new camp-at-dusk opening screen previews the actual journey and party, with clear Continue/New Adventure actions and persistent How to Play guidance. The crescent moon uses a transparent sky cutout.
- The party menu is now a travel ledger: compact ruled HP/MP roster, current story/shop objective, unchanged destinations and a clear return action. See `docs/camp-and-ledger-menus.md`.

- Twelve weapon/skill shop buildings now have safe walk-in rooms and indoor merchants, with paired exits beside the same building. Outdoor item counters, original stock, prices and saved journeys remain.
- System → Town citizens offers Wander or Stay still. Ordinary citizens take bounded walks, pause nearby and during menus/dialogue/battles, and use authoritative positions for interaction. Important quest keepers and merchants stay put.
- Softer foliage, banks, paths, light and title hills reduce hard block-like shapes while character pixels stay crisp. The main party menu shows HP and MP for all four travelers with clear commands and conditions. See `docs/shops-and-town-life.md`.

- Refreshed presentation: a watchlight title/creator treatment, consistent blue-and-silver menus, detailed regional terrain and buildings, quieter contextual town labels, and richer battle scenery with framed enemy readouts and grounded shadows. Shop headings include a reachable close button. See `docs/visual-presentation.md`.

- The selected growth upload is now the baseline. Usage-based stat growth, regional skill distribution, family drops and discovered-family notes are retained.
- Each region has a repeatable rare foe with a seeded 5% chance in dangerous encounters. Victories give one regional set piece, missing pieces first, then balanced copies for other party members. Mission-linked stationary rare markers are removed.
- Encounter creation and automatic reward IDs are repaired. The blue-and-silver interface has responsive canvas sizing, readable objectives, battle commands and shop information. See `docs/regional-rares-and-growth.md`.

- All six jobs have usable MP skills. The catalogue contains 24 existing magic skills and 16 new martial techniques. Skill Shops teach abilities for the selected traveler's current job. Attack and Guard remain free.
- Choose companion jobs during character creation, or open Party → Jobs at a safe shelter to preview and apply a job for any of the four travelers. Learned abilities stay with their owner. Changing jobs preserves current HP/MP within the new caps, returns incompatible gear to the pack and uses only free compatible owned replacements.
- Equipment shops compare offers with a selected traveler's current gear, with slot and usable-gear filters. Inventory views show live HP/MP, condition and exact capped recovery previews before using supplies. All/Equipment/Supplies views and reliable keyboard focus make long packs easier to use.
- Battle tactics show current HP and announced intent, with weaknesses/resistances revealed only for the exact regional enemy rank already recorded in the bestiary. Shared battle supplies show owned, reserved and available counts; cure/revival choices disable invalid targets.
- Track one accepted commission from the Wayfarer Journal to see compact progress and return directions beside the exploration objective. Delivery clears the goal. Current-floor maps show copied evidence, opened caches, cross-locks and return lifts from actual saved discoveries.
- Six town notice boards offer 18 optional commissions: patrols, evidence surveys and return-route work. Accept locally, track progress in the Wayfarer Journal, then return for a modest once-only supply/gold reward. Existing copied records and opened lifts count. No EXP is granted by commissions.
- The Wayfarer Journal also records monsters actually defeated, with rank, region, weaknesses and resistances, plus six replayable party conversations unlocked through the story. Conversations require a safe shelter and do not restore resources. See `docs/wayfarer-journal.md`.
- The user's difficulty build is merged: Easy, Normal, Hard and Hell; physical attack types and family weaknesses; Lumen, Umbra, Radiance and Nightfall; spell growth from successful battle casts; stronger stats on all 18 regional set pieces; and the uploaded creation defaults and gender controls. Mode, learned spells and per-traveler practice persist. See `docs/difficulty-and-polish.md` for exact factors and boundaries.
- Ward equipment now supplies effective magic defense against magical pulses. Shops show customized hero names and every gained/lost stat. Field supplies avoid no-effect consumption; owned meals and MP teas work with capped recovery. Keyboard battle targets and spells scroll into view, and Quick/Clear keep the command cursor.
- Enemy layouts are authored for initial groups of one through eight, retaining nine-small compatibility. Small, large, and mixed groups have separate space budgets. Four heroes stand in a stable right-side column; defeated actors leave their slots in place.
- Dedicated battle scenes follow the encounter location: outdoor terrain, six dungeon identities, and deeper chamber variants. Exploration maps return after combat. New interior floors also retain their dungeon's exploration palette and walls.
- Six dungeon expeditions now contain 3, 4, 5, 6, 7, and 8 floors: 33 floors in total, including 27 new interiors. Branches contain limited supplies and evidence; saved return lifts support resupply. Later floors add one cross-lock, then two ordered cross-locks. The upward retreat remains available. See `docs/dungeon-expeditions.md`.
- Area and world map tabs show the current floor, stairs, return lifts, and ten exterior destinations. Map and Journal preparation notes show actual HP, remedies, and remaining MP alongside regional advice.
- Regional encounter tables support up to nine small enemies, four large enemies, or two large enemies with six small enemies. Most road groups contain two to four foes. Larger groups appear deeper in a region, with lighter individual swarm enemies and clearly numbered targets. Enemies retain fixed regional strength rather than scaling to the party's level.
- Future ordinary fights give 50% of the preceding EXP and 65% of the gold. Boss/rare budgets retain 65% EXP and 75% gold, reduced once before allocation. Victory shares defeated-enemy EXP among survivors and pays pooled gold once. Previously earned resources, prices, and level thresholds are unchanged. See `docs/depth-economy.md` for measured preparation and grinding evidence.
- Six settlements have separate Item, Weapon, and Skill Shops. Equipment shops include armor and accessories with category filters. Quantity purchases and spare-copy selling remain available. Skills are learned per traveler, subject to job, regional stock, and gold; learning does not refill MP.
- Three optional stories follow a lost courier's parcel, relief supplies, and family records. The journal tracks their progress. Rewards are modest and paid once; the existing main story and its permanent consequences remain intact.
- Four bridge, pass, and gate crossings now cross their actual map feature in either direction. The two ferry banks remain a paired service. The southern Reedbank road reaches a courier waystone, and settlement service courts are safe from encounters.
- Battle formations fit the enemy playfield with readable labels and health bars. Exploration touch controls hide through battle and its results, then return for travel.

## Compatibility and ownership

The original equipment slots, status screens, appearance options, per-hero EXP, quantity controls, art, notices, and save key remain present. Version-four saves, including the uploaded growth records, remain supported; existing version 1, 2, and 3 saves import without a reset. Older saves inherit the job-eligible spells already unlocked by each traveler's earned level; new journeys start with a small job-specific spellbook.

Equipment inventory counts include worn copies. Every wearer reserves one owned copy, and changing gear releases it. Manual equip, Optimize, selling, and save validation use the same rule across all five slots. Four owned charms can therefore equip four compatible travelers; the eighteen regional set pieces support additional copies while other unique items still permit only one wearer.

The overworld remains the connection between ten authored local destinations. Each local exit returns beside its matching world site, and the atlas uses the same place registry. Story conditions still guard progression. Walking, click, and touch entry retain the arrival pause that prevents accidental immediate returns.

## Reproducible files

`baseline.html` is the untouched upload. `travel-baseline.html` archives the equipment-fixed game, `expansion-baseline.html` archives the game before the encounter/shop expansion, and `depth-baseline.html` archives the game before the deeper-dungeon update. Keep all four unchanged.

`polish-baseline.html` archives the dungeon update; `difficulty-upload.html` preserves the exact uploaded difficulty build. `engagement-baseline.html` archives their completed merge and polish, `journey-baseline.html` archives the engagement update, and `jobs-baseline.html` archives the completed planning/exploration tools. `tools/build_jobs.py` reproduces that preceding jobs update: six modules add the skill catalogue, MP/jobs core, combat, menus, inventory/shop polish and current-job artwork. `jobs-manifest.json` records hashes and checks. The assembler refuses to overwrite an unrecognized later edit. Older generators reproduce earlier snapshots; do not replay them over the current game. Port later changes deliberately before rebuilding. Do not rebuild from the separate source project or push/publish without the user's instruction.

`growth-baseline.html` is the unchanged growth upload, and `growth-previous.html` preserves the preceding completed game. The growth update is reproduced by `tools/build_growth.py`, applying `growth_stability.py`, `growth_rares.py`, then `growth_presentation.py`. `growth-manifest.json` records the baseline, modules, final bytes and validation.

`visual-baseline.html` archives the completed growth build. The presentation-only reproduction path is `tools/build_visual.py`, applying `visual_world.py`, `visual_battle.py` and `visual_ui.py`. It verifies the entire gameplay/data prefix is unchanged before writing the game. `visual-manifest.json` records its module hashes, final bytes and verification.

`settlement-baseline.html` archives that complete visual candidate. That town-life update is reproduced by `tools/build_settlement.py`, applying shops, NPC movement, softer artwork and the preceding party menu. `settlement-manifest.json` records final bytes, module hashes and checks; it supersedes earlier assemblers for current follow-up work.

`camp-menu-baseline.html` archives the completed town-life game. Current menu reproduction is `tools/build_camp_menu.py`, applying `camp_title.py` and `camp_ledger.py`. It verifies unchanged gameplay/data bytes and syntax before writing. `camp-menu-manifest.json` records the final menu build and validation.

## Validation

Current checks include the original progression/equipment coverage adapted to MP, plus dedicated job, migration, skill, recovery-feedback and inventory/shop tests. Final counts, browser evidence and delivery hashes are recorded in `camp-menu-manifest.json`. Earlier manifests describe their preceding snapshots. See `docs/jobs-skills-and-mp.md` for the new model and `docs/planning-and-exploration.md` for the prior tools.

Opening combat probes use all six lead jobs with earned resources. A separate Warden route actually walks all three opening floors, opens a return lift, retreats for recovery and shopping, and returns to defeat the boss. Its depleted MP demonstrates a reason to regroup; the sampled seed did not need curatives. The second region has an earned-level training/shopping route. Later combat and browser fixtures use declared preparation and access conditions; none claims a complete campaign playthrough or universal late-dungeon balance.

Direct file navigation is blocked by this cloud browser's policy. Standalone behavior was checked by serving the unchanged HTML bytes while blocking all other requests. Independent source review found no blocking issue. Qodo and the Advisor launcher were unavailable in this environment, so no result from either is claimed.
