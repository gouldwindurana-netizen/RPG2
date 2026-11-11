# Leveling, equipment, drops, and regional sets

Original balance baseline for [Avel](world-and-bestiary.md). See [online research and probability analysis](balance-research.md). The numbers are editable planning values, not a claim that full-campaign combat playtesting is complete.

## Design principles

Locations choose authored encounters, and each enemy definition provides fixed statistics. Returning with a stronger party makes early routes easier. New colors represent distinct named ranks, not monsters secretly following the party's level.

This campaign uses a level-50 cap, a finale around levels 30–34, optional challenges around 36–42, deterministic class growth, and cumulative EXP. Victory EXP is shared with fallen heroes so temporary knockouts do not leave a character permanently behind.

## Leveling and the main-route budget

- Start all four heroes at level 1. Every victorious encounter grants its listed **XP_each** to each hero, including fallen heroes. Never divide XP_each a second time. Retreat and defeat grant none.
- Build levels from cumulative thresholds, allowing a large reward to cross several levels. No XP is removed for outleveling a region; its fixed low rewards become less useful naturally.
- Thresholds follow `round(10 × (L−1)² + 1.5 × (L−1)³)`, stored as an explicit 50-entry table in `data/progression.json` to remove cross-language rounding ambiguity. The shipped table is authoritative.
- Each class has fixed HP, strength, magic, and accuracy growth. No random bad level-ups. Mara grows durable, Tavin gains physical accuracy quickly, Iona supports through magic, and Soren emphasizes spell power.
- Damage, armor, and multi-hit attacks remain distinct. Base attack hit count is capped at four; Haste may double it to eight, not grant extra command turns. Actual hit checks, elemental damage, and turn execution still need the battle runtime.
- Level gains do not fully restore HP or refill spent charges. When implementing resource changes, add only the increase in maximum capacity to current values, then clamp; never repeatedly refill an old tier. Camps and inns remain the main recovery points.

The budget below describes expected main-path battles, not compulsory grinding counters or XP awarded for talking to a quest NPC. Optional quests and hunts contribute no assumed XP to these targets. A standard ordinary formation contains two enemy reward shares; other formations must declare their own total XP.

| Region | Intended party band | Ordinary battle budget | XP_each per standard battle | Main bosses' combined XP_each | Cumulative exit XP / level |
| --- | --- | ---: | ---: | ---: | --- |
| R01 Reedbank / Merewatch | 1–5 | 6 | 28 | 88 | 256 / 5 |
| R02 Salt Road / Dunmere | 5–10 | 12 | 110 | 328 | 1,904 / 10 |
| R03 Alder Fen | 10–16 | 15 | 300 | 908 | 7,312 / 16 |
| R04 Orchard Highroad | 16–22 | 18 | 530 | 1,450 | 18,302 / 22 |
| R05 Crown Road | 22–28 | 20 | 800 | 2,512 | 36,814 / 28 |
| R06 Veyr | 28–34 | 24 | 1,000 | 3,982 | 64,796 / 34 |

The R06 boss total comprises Night Choir 950, Vale's armor 1,232, and Heart Bell 1,800. The Choir is one encounter reward, not three copies of that reward. Vale's armor and the engine are separate reward records; their presentation can remain a continuous finale.

Players can arrive below or above these bands through avoidance or exploration. Do not raise a boss's statistics to cancel earned progress. Test a lower-level route with normal equipment before adding any forced encounter count.

### Spell tiers

Iona and Soren use eight separate tier pools, unlocked at levels **1, 5, 9, 13, 17, 21, 26, and 31**. A newly unlocked pool has a maximum of two casts; it gains one maximum cast per four later levels, capped at nine. This gives access to the highest tier before the intended finale. Learning spells and owning charges remain different restrictions.

Mara and Tavin do not receive full caster pools simply because they level up. Any later hybrid class design needs a separate permission table. The first playable only needs tiers one and two.

## Enemy strength and recolors

Each of the 24 templates compiles into three separate fixed definitions:

| Rank | Authored level | Palette and additional cues | Placement |
| --- | --- | --- | --- |
| Base | Template level | Native color; ordinary name; one pip. | Normal regional formations. |
| Ashen | Template +3 | Cool slate, pale stripe; `Ashen` prefix; two pips. | Marked survey areas or explicitly authored later formations. |
| Crested | Template +6 | Deep violet, raised crest; `Crested` prefix; three pips. | Clearly marked optional dens or deliberate late encounters. |

For example, Mud Reedback is level 1, Ashen Mud Reedback is 4, and Crested Mud Reedback is 7. Their rank is relative to that entry: a late base Crown Sentinel can be stronger than an early Crested creature. Rare status uses a separate diamond marker and named entry; it is not another universal color rank. Weaknesses have their own icons and bestiary text.

`tools/rules.py` derives fixed starting stats from level and role. Its ordinary HP envelope is `(22 + 16L + 1.2L²) × role factor`. Rare HP uses ×2.5, boss HP ×5. These are initial content budgets, not a damage simulator. A multi-part boss such as Night Choir shares its encounter HP/reward budget among parts; do not multiply a compiled encounter envelope by three at runtime.

Recolor variants need a readable extension of their family's established move. The data records telegraphs and counters; the battle implementation must enforce a full preparation window before major attacks. Color never grants an unexplained extra action. Stat growth is already accounted for by the authored level, so avoid adding a second enormous rank multiplier.

## Equipment slots and the regional set idea

Use five equipment slots: **weapon, body, head, mantle, charm**. Weapons and body armor preserve class identity. Regional collections use the three supporting slots, so a set never forces a healer to equip a sword or a Warden to abandon heavy armor.

Each region has one three-piece collection. Every piece has fixed statistics equivalent to its same-tier ordinary slot. Two pieces activate a small bonus; the third adds another modest effect. Count pieces on the **same wearer**, not across the party. One unique piece exists per save, so the player cannot clone a resistance set onto all four heroes.

| Region / collection | Named rare | Two pieces | Additional effect at three pieces |
| --- | --- | --- | --- |
| R01 Reedwatch | Silver Reedback, level 7 | A shield worth 5% max HP absorbs the first incoming damage, once per battle. | +10 percentage points poison resistance. |
| R02 Wayfarer | Coinveil Jackal, level 12 | +10 points silence resistance. | The same once-per-battle 5% HP shield. |
| R03 Fenkeeper | Moonlace Widow, level 18 | +15 points poison resistance. | 10% less frost damage. |
| R04 Orchard Vigil | Amberglass Hart, level 24 | +10 points sleep resistance. | +10 points poison resistance. |
| R05 Roadward Oath | Ivory Bellwarden, level 30 | 3% less physical damage. | +10 points silence resistance. |
| R06 Open Hand | Starless Cantor, level 36 | 3% less magical damage. | The same once-per-battle 5% HP shield. |

Status-resistance points subtract from the final infliction chance and clamp at zero. They are not damage resistance. Apply set-specific caps of 15 status-resistance points, 10% elemental resistance, 3% physical or magic reduction, and one 5% HP shield per wearer. The barrier is one pool consumed by incoming damage, not a new shield for every strike of a multi-hit attack. Changing equipment cannot retrigger it within the battle.

An unlocked regional artisan can refurbish a piece to a reached shop tier for 125% of the ordinary target-slot price. This replaces its base statistics with the target-tier equivalent and preserves the same set ID and bonuses. Refurbishment is fixed, paid, and optional; it is not automatic item scaling or another rare-material chase. Unique pieces cannot be sold or discarded; unused ones remain in shared storage.

Ordinary shop and guaranteed chest gear must clear the story. The sets are situational builds and collecting goals, not a mandatory full-party damage multiplier. Boss rewards and earlier companion keepsakes remain useful alternatives.

## How rare drops work

Avoid multiplying rare appearance by another rare equipment roll. A successful rare encounter **always** awards a choice of one unowned piece from its regional collection. There are no random stat ranges, unwanted class rolls, duplicate unique pieces, or separate quality rolls.

There are three routes to each collection:

1. One optional regional exploration cache gives one piece choice.
2. The regional main-boss clearance grants one stamp, redeemable for one piece choice. R06 awards its single stamp after the Heart Bell, not one per phase.
3. Each successful regional rare hunt gives another unowned piece choice.

Taking the cache and stamp leaves one rare victory to finish the set. Players can instead collect all pieces through repeated hunts. If a cache or stamp is used after completion, it yields a modest supply bundle; do not consume a unique reward opportunity without delivering anything.

Suggested cache sites: Merewatch's inspection lockbox, Dunmere's public depot strongbox, the granary's dry shelf, the orchard rest-house cupboard, the Crown Road depot's returned-equipment chest, and Veyr's intake maintenance locker. None requires completing a companion quest. If an area closes for the evacuation, move its unopened reward to the receiving shelter's quartermaster.

### Very rare sightings, bounded tracking

- After a qualifying regional victory, there is a **2%** natural opportunity to discover the named rare's tracks or a visible optional encounter. This does not force another immediate fight.
- After **12 qualifying wins** since the last claimed rare victory, reveal a guaranteed tracked lair. The guide shows progress, for example `Tracks 8/12`. A tracked encounter is an explicit hunt system, not advertised as a naturally frequent 2% spawn.
- Save progress separately for each region. Leaving, camping, outleveling the area, fleeing a hunt, or losing to it does not erase the earned opportunity. A ready target stays available until its victory reward is claimed.
- A normal encounter counts once, regardless of enemies or summons. Losses, empty fights, rare fights, and reset tutorial encounters do not advance tracking. Ordinary repeatable regional encounters remain eligible on return visits; players never become too high-level to collect an early set.
- The reward claim and progress reset must be saved together with inventory. Reloading restores the same state and RNG; it must not silently reroll a pending reward. The reference state model round-trips through JSON, but integration with an actual game save/RNG remains future work.
- Once the set is complete, later rare victories yield a modest normal supply bundle, not more unique pieces or outsized EXP. Rare XP is only 1.5 times a standard regional battle's XP_each.

R01 hunts open after the camp's safe relocation. R06's hunt opens after the campaign; its early tracking can be banked. Other hunts open after local clearance during supported-shelter downtime. A hunt never holds the story's evacuation hostage.

With the cache and stamp, the remaining hunt opportunity is available within at most 12 qualifying wins; the player must still beat the rare. Collecting purely through hunts takes at most 36 such wins plus three successful rare fights. Counters already earned during normal regional play count toward those bounds. This is an acquisition bound, not a claim about minutes of play or battle success rates.

## Ordinary drops, consumables, and economy

An ordinary victory has a proposed 20% chance to give exactly one small supply from a weighted pool: Potion 50%, Antitoxin 25%, Soothing Draught 25%. These weights are explicit in the data. The guaranteed set reward uses a separate reward channel; ordinary supplies cannot replace it. The catalog includes potions, poison/sleep/silence cures, revival salt, packed meals, escape smoke, survey chalk, and two limited charge-restoration teas. A completed-set claim returns the reward tag `supply_bundle`, which resolves through the bundle map in `progression.json` to one Potion; it is not an undefined inventory item.

There are no repeatable ordinary drops restoring high-tier spell charges. Spark Tea restores one spent tier-one or tier-two charge and appears in shops from R03 at a substantial price. Deep Tea restores one tier-one through tier-four charge and comes from scarce fixed sources. Neither exceeds the caster's maximum; neither turns a set into an infinite casting loop.

All four heroes begin with their common R01 loadout, five shared Potions, three Antitoxins, and one Revival Salt. The first region's listed prices are replacement values, not a demand to purchase starter equipment. Each later regional budget supplies baseline income for its four weapons and body pieces, with additional allowance for recovery and small supporting slots. Gold is party-wide, unlike XP_each. Optional side-quest supplies supplement that allowance. No price assumes selling unique sets or defeating rare enemies before a story boss. The audit checks the gross gear envelope; actual healing expenditure, inn prices, and encounter avoidance need playtesting before asserting that the recovery allowance is sufficient.

## Files and what is actually verified

- `data/world.json`: connected regions, ordinary templates, rare creatures, bosses, levels, tells, weaknesses, and counters.
- `data/items.json`: 105 named items, including 18 unique pieces across six regional sets, five companion equipment sidegrades, and four keepsakes/appearances. Mara's buckler pairs with a shortblade as one defensive weapon loadout; it does not create an unsupported sixth slot.
- `data/progression.json`: explicit XP thresholds, class growth, spell tiers, budget targets, rank presentation, and loot policy.
- `tools/rules.py`: executable stat expansion and saved rare-collection state transitions.
- `tools/audit_balance.py`: cross-reference checks, fixed-stat export, XP/gear budget checks, and probability calculations.
- `tests/test_rules.py`: behavioral checks including bad-luck limits, duplicate protection, invalid-claim rollback, and save round-trips.

These content checks establish internal consistency, not that every campaign fight is fun or winnable. The [browser campaign](playable-campaign.md) now implements all six regions, eight spell tiers, regional equipment effects, and tracking. Its condensed encounter rewards differ from this longer design model. Advanced AI and exhaustive campaign-wide balance remain future work. Continue testing ordinary shop loadouts, lower-level arrivals, long expeditions, status combinations, and expanded spell interactions before calling the full combat system balanced.
