# Loot and enemy-variant balance research

Research date: 10 November 2026. This supports Avel's original equipment and encounter design. The chosen values are analytical starting points for playtesting.

## Sources actually inspected

There is no general web-search connector in this session. Public GitHub source and documentation reads worked. A direct request to a Blizzard developer article was rejected by the network proxy with `403 CONNECT`; its contents were not used. The following accessible sources were read at pinned revisions. They establish concrete design patterns, not evidence that their particular balance will work unchanged in our turn-based RPG.

1. **Cataclysm: Dark Days Ahead item-spawn documentation** distinguishes a collection, where entries roll independently, from a distribution, where exactly one entry is selected by relative weights. It also explicitly states that a 100% collection entry always appears [S1]. This is useful when specifying whether an enemy drops a required reward *and* ordinary supplies, or one item selected from a pool.
2. **Flare's loot implementation** processes fixed rewards separately from random loot. Its source documentation warns that `fixed` is different from a random entry with a chance of 100: another random entry can replace the latter [S2]. A guaranteed rare-enemy reward should therefore be an explicit guarantee, not an accidentally competing weighted entry.
3. **W3C's Understanding Use of Color** recommends communicating meaning through shape or text as well as color [S3]. Apply that principle to stronger enemy variants: palette changes can communicate rank, while a different name, rank symbol, and silhouette detail communicate the same fact independently. This is an interface-design reference, not a claim that the game has passed an accessibility audit.

## Why two layers of rarity are expensive

Suppose a special enemy appears in 2% of eligible battles, and then has a 10% chance to drop the particular desired item. The effective probability is:

`p = 0.02 × 0.10 = 0.002`, or **0.2% per eligible battle**.

Under independent attempts with constant probability, the expected wait for one success is `1/p`. The probability of at least one success after `n` battles is `1 - (1-p)^n`.

| Example | Mean wait | Median wait | Battles for at least 95% chance |
| --- | ---: | ---: | ---: |
| 2% appearance × 10% desired drop | 500 | 347 | 1,497 |
| 2% appearance × guaranteed desired reward | 50 | 35 | 149 |

These are mathematical examples calculated for this design, not published drop rates from another game. They assume the player wins each qualifying battle. At one minute per battle, even the second approach averages roughly 50 minutes for one item. Walking, healing, losses, and unwanted duplicate pieces can add more time.

An average alone also hides the unlucky tail. A player completing a short story region should not be expected to wait hundreds of encounters for its signature equipment.

## Recommended structure for regional sets

Keep the rare creature exciting while making equipment completion predictable:

- Give each region a small named collection with fixed properties. Avoid another roll for item quality, stat ranges, sockets, or class suitability.
- A successful regional rare hunt guarantees a choice from the collection. Filter or clearly identify already-owned pieces; collection progress must remember previously acquired items even if sold or unequipped.
- Separate ordinary supply drops from the guaranteed collection reward. Do not place both in one competing weighted table.
- Add a disclosed regional hunt or token route that bounds bad luck. A completion reward from the ordinary region route can supply part of the collection, leaving hunting as optional completion rather than a progression requirement.
- Preserve rare-drop eligibility on a return visit. A player who outlevels a region should not lose access to its collection. Fixed enemy EXP naturally makes that visit less efficient for leveling than advancing.
- Keep shop, chest, boss, and quest gear viable. Regional collections should favor a situation or playstyle, not provide a universal damage multiplier required by the next story boss.

Small two-piece synergies are easier to mix with existing character equipment than large all-or-nothing bonuses. A third piece can offer an alternative combination or an additional modest convenience. Strong effects should have a clear limit: a first-round benefit, a resistance, or one trigger per battle. Do not let a set refund unlimited spell charges, multiply every hit without a cap, or pay for its own consumables indefinitely.

## Chosen collection policy and its probability model

The chosen design uses three unique pieces per region: headwear, mantle, and charm. An exploration cache grants one piece choice, and the regional main boss grants a one-time stamp redeemable for another. Both are guaranteed opportunities, not extra random rolls. One rare victory then completes the collection for a player who takes those other routes.

Natural rare opportunities roll at 2% after eligible regional victories. After 12 eligible wins since the last rare victory, a disclosed tracked lair becomes available; the player chooses when to attempt it. The target persists until defeated and guarantees one unowned piece choice. The following model measures qualifying wins until the opportunity becomes available, not a forced encounter or a battle victory: `T = min(geometric(0.02), 12)`.

`E[T] = (1 - 0.98^12) / 0.02 ≈ 10.764 encounters`.

About **80.07%** of opportunities would arrive through the cap rather than natural luck. That is primarily a tracking system, so present it as one: the field guide reveals tracks and unlocks a hunt. Do not advertise those protected appearances as unmodified 2% random encounters.

For a player collecting all three pieces through hunts alone, the model bounds availability at 36 qualifying wins and averages about 32.29, plus three successful hunt battles. Exploration and the boss stamp reduce the required hunts to one. Completion does not allow further copies of unique pieces: later victories yield modest supplies. These are original proposed balance rules.

A counter should advance on completed eligible encounters, not every enemy in a swarm or each summoned add. Decide whether fleeing, losing, changing subareas, and reloading preserve progress. A safe default preserves earned tracking progress across camp visits, uses a saved regional counter, and clears a hunt only after its reward is committed. Never silently expire progress when the player goes to recover.

## Stronger palette variants

Reuse an enemy family while changing both presentation and tactics. A later plated beetle can have a darker carapace, a ridged outline, an explicit rank label, and a defensive move that its earlier cousin lacks. Its stats and rewards belong to its fixed region entry. Its color must not secretly recolor itself just because the party gained a level.

Avoid assuming the same palette always means the same element: a stronger crimson construct can still use physical attacks. Show actual weaknesses separately in the field guide. Do not use hue alone for strength, rarity, targetability, or resistance information [S3].

## What remains to validate

The sources demonstrate reward-table semantics and redundant visual communication. They do not prove that a 12-encounter cap, a particular set bonus, or a chosen enemy HP value is enjoyable. Validate encounter length, ordinary-route readiness, collection completion time, duplicate behavior, and interactions with multi-hit attacks and limited spell charges. Analytical checks can expose impossible goals and extreme waits; full combat balance still requires playable battle and expedition tests.

## Bibliography

[S1]: https://github.com/CleverRaven/Cataclysm-DDA/blob/51c589bf94f1d70b95d698d96a943ebe7875313f/doc/JSON/ITEM_SPAWN.md#L21
[S2]: https://github.com/flareteam/flare-engine/blob/f9a17a266293a897a1d7eae2d54408b0de39af27/src/LootManager.cpp#L757
[S3]: https://github.com/w3c/wcag/blob/c9ea04d4f3702e92249997c11fd678777f9c03ae/understanding/20/use-of-color.html#L9

- [Cataclysm: Dark Days Ahead: Collection or Distribution][S1].
- [Flare: fixed reward versus random loot entry][S2].
- [W3C: Understanding Use of Color][S3].
