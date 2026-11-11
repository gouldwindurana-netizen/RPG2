# Original RPG combat brief

Status: campaign design baseline. See [the playable campaign](playable-campaign.md) for the current six-region implementation and its limits.

Story proposal: [The Road Beyond the Bells](story.md), built around this party and the first expedition.

Expanded content: [Avel's world and bestiary](world-and-bestiary.md), [progression and equipment rules](progression-and-loot.md), and [online balance research](balance-research.md). These specify fixed regional levels, stronger named recolors, and optional regional equipment collections. The browser campaign adapts these designs with explicit condensed encounter tuning.

## Direction

Build an original 2D party RPG around four heroes, whole-party command planning, sequential action resolution, and tiered spell charges. Keep battles readable and brisk, while making the cost of the next encounter matter.

The combat emphasizes party planning, clear roles, and resource decisions across an expedition. The rules below describe the intended campaign, with the playable slice documented separately.

## First playable scope

A complete short expedition is a better first target than a large empty world:

1. Begin at a small camp with four predefined heroes and a shared inventory.
2. Traverse one compact original dungeon with several encounter formations.
3. Win ordinary battles, collect gold and EXP, and manage persistent HP, charges, and supplies.
4. Defeat a boss with a recognizable attack pattern.
5. Return to camp, recover, buy an upgrade, and start another expedition.

Target the first expedition at roughly 10–15 minutes; this is a tuning goal, not a measured result. Full character creation, promotion, a large overworld, crafting, and multiple story chapters can follow after the battle loop works.

## Original party

These original heroes anchor the opening expedition.

| Hero | Role | Useful decision |
| --- | --- | --- |
| Mara, the Warden | Armored weapon specialist. | Strike a dangerous target or guard against incoming damage. |
| Tavin, the Striker | Accurate physical specialist with multi-hit attacks. | Finish a weakened foe or concentrate on an exposed enemy. |
| Iona, the Mender | Healing, recovery, and protective magic. | Restore HP now or prevent a larger incoming loss. |
| Soren, the Arcanist | Elemental damage and control magic. | Spend charges to exploit an opening or conserve them. |

A later party builder can introduce agile and hybrid roles. Avoid building six incomplete classes before testing four complementary ones.

## Round contract

`Encounter → Plan party → Commit → Resolve actions → Round effects → Check outcome`

- Plan one action for each eligible living hero. Show who is currently choosing and which choices are already queued.
- Allow previous commands to be edited until commitment.
- Reserve shared consumables during planning so two heroes cannot promise the last potion.
- Validate actor status and targets again when each queued action executes.
- Apply one authoritative state change per action; animations display the result rather than deciding it.
- Check victory or defeat after actions and after round-end effects. Stop the queue when combat ends.
- Keep command input inactive during resolution, apart from supported presentation controls.

## Commands

| Command | Proposed behavior |
| --- | --- |
| Attack | Select one enemy; accuracy and hit count produce a multi-hit physical action. |
| Magic | Select a learned spell and legal target; spend one charge from the spell's tier when it executes. |
| Items | Select a shared consumable and legal target; consume it only when the item action executes. |
| Guard | Reduce incoming physical damage for the round, beginning immediately when the round commits. This is our deliberate addition. |
| Flee | Confirm a party-wide escape attempt. Restricted boss encounters explain why escape is unavailable. |

For the first playable, Flee replaces the party's planned actions for that round. On failure, enemies act. This keeps the party escape interface clear.

## Initiative and fairness

Proposed provisional rule: give each eligible actor one action per round and shuffle the actors uniformly using the battle's seeded random generator. This creates uncertain healing timing without hidden speed advantages.

Keep the initiative rule isolated so future tuning does not affect presentation code. Until then, Agility should affect explicitly documented properties such as evasion, not promise an unimplemented speed advantage. Do not display a guaranteed upcoming timeline if the game deliberately hides the order.

Haste should increase hits within the target's attack action, with a defined cap and duration. It should not silently add extra command turns.

## Targeting and interrupted actions

- If a queued single-target offensive action loses its enemy target, redirect it to a valid living enemy. Apply this policy consistently to physical and magical attacks.
- If no valid enemy remains, end the battle before spending further resources.
- A healing action never jumps to a different ally. If the chosen ally has become invalid, cancel without cost and explain why.
- Revival only accepts a fallen ally. If that ally was already revived, cancel without cost.
- If a caster becomes silenced before acting, cancel the cast without spending a charge. There is no hidden fallback attack.
- A dead or incapacitated actor loses the queued action without spending the reserved resource. Release any reservation.
- Healing a full-health valid target is allowed and consumes the resource; show current HP clearly during planning.

These rules should be covered by tests because their edge cases determine whether the player trusts the command system.

## Magic and attrition

- Model eight independent spell-tier charge pools. The first playable only needs tiers one and two populated.
- Separate learned spells from remaining casts. The initial loadout can be predefined; later progression can use an explicit per-tier learning limit.
- Include single-target healing, party healing, two damage elements, a multi-target damage spell, a protective buff, a hit-multiplier buff, and a status recovery action.
- Persist HP, charges, inventory, gold, and EXP across encounters.
- Camp recovery restores HP and charges. Do not refill every battle automatically.
- Use simple documented elemental rules for the prototype.
- Place consumables so poor planning is recoverable without making conservation irrelevant.

Exact spell costs, charge growth, damage constants, and enemy HP need implementation-time tuning against several consecutive fights. Research alone cannot establish those values.

## Status and enemy design

For each status, specify infliction, immunity, turn timing, duration, removal, and persistence. Begin with poison, sleep, and silence, plus the ordinary fallen state. Add paralysis, confusion, and petrification after the basic state transitions are reliable.

Normal enemies should teach different answers: a low-HP swarm rewards area magic; an armored enemy rewards magical damage; a fragile caster rewards prioritization; a poison enemy tests recovery supplies. The boss should announce a dangerous move, giving the player a reason to guard or prepare protection.

Apply status rules consistently, and make buffs and debuffs behave as described.

## Battle interface

Show heroes with names, HP values, visible status icons, and charges reachable from the spell menu. Each spell needs its tier, effect, target scope, and remaining casts. Unavailable actions should explain the reason.

Highlight the acting unit and selected target. Display multi-hit results and a short readable combat log. Support keyboard confirmation/cancellation and pointer input, with clear focus and adequate text contrast. Animation speed and reduced motion are presentation controls; they must not change battle outcomes.

Use original locations, enemy designs, portraits, spell effects, music, and interface artwork. All game artwork is original.

## Acceptance checks for the eventual prototype

- A complete party round can be planned, edited, committed, resolved, and repeated.
- The last shared potion cannot be allocated twice, and canceled actions do not consume it.
- A target dying, an actor falling, or silence arriving mid-round follows the documented policy.
- Victory, defeat, and escape each end the queue exactly once and award only appropriate rewards.
- Charges and HP persist through consecutive battles and recover through the camp flow.
- A seeded simulation can reproduce a reported battle independently of animation speed.
- Keyboard and pointer play both complete an ordinary battle and the boss fight.
- A full short expedition demonstrates that elemental choices, healing timing, and conservation matter.

This document records campaign requirements. The [playable campaign](playable-campaign.md) identifies implemented systems and validation separately from remaining design requirements.
