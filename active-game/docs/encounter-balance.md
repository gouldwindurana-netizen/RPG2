# Encounter sizes and reward tuning

This document records the preceding encounter expansion. Its payout values and pacing routes are historical. The current deeper-dungeon build applies the reduced future rewards and measured routes in `depth-economy.md`, with floor-gated formations and preparation described in `dungeon-expeditions.md`.

The browser campaign uses fixed regional formations. Enemy levels do not increase with the party. The presentation limits are nine small enemies, four large enemies, or two large and six small enemies. These are ceilings rather than the typical group size.

Each region has weighted authored rows. Ordinary road groups are usually two to four enemies. Larger swarms and guard groups are restricted to the region's dangerous/deep area. The opening region withholds its widest groups until the opening story handoff, and withholds intermediate swarms until two authored encounters have been cleared. Rare stronger colors are explicit regional rows: an Ashen pair has weight four; regions three onward also have a Crested leader row with weight one. Their enemy levels and rewards remain fixed.

## Contributions and resource pressure

Every spawned enemy has its own party-total EXP and gold contribution. The values depend on its region, role, size, and named rank. Victory sums only defeated enemies, divides EXP by the living heroes with integer rounding, and adds gold once to shared funds. Fallen heroes do not gain EXP. Fleeing and defeat pay nothing. Boss and rare encounter totals remain authored values; multi-voice bosses divide that budget across their units so adding voices cannot multiply the payout.

The original condensed campaign's two-enemy benchmark remains the reference: 28, 165, 563, 1193, 2000, and 3000 EXP per hero across the six regions, and 70, 230, 480, 900, 1500, and 2300 pooled gold. A full regular enemy's contribution starts around half of that two-enemy budget. Role, size, and rank then adjust it. Light swarmlings have 45% of their original template HP, 43% attack, a lower status chance, and roughly 34% of an ordinary unit's reward contribution. The nine-unit opening swarm therefore yields about 42 EXP to each of four survivors rather than nine times a normal fight. This lets area magic answer a wide weak group without making every nine-enemy encounter an oversized economy reward.

Ordinary small units use 65% template HP and 72% attack; large ordinary units use 90% HP and attack. These are fixed encounter-unit definitions rather than hidden party-level scaling. Ashen/Crested units keep their existing higher named rank stats and corresponding reward multipliers.

## Automated pacing evidence

The actual bundled engine passes sixteen encounter regression tests. Focused accounting fixtures check group limits, distinct IDs, role/size/rank contributions, survivor-only EXP, pooled gold, stable authored boss totals, repeat-payout protection, and no rewards on escape or defeat.

A fresh Warden party with only its normal starter resources cleared the six opening formations and Brass Bailiff. It earned level five and 261 EXP, kept all four travelers alive, and finished with 608 gold after buying three Potions. Ordinary groups took one or two rounds; the boss took seven. Recovery used the normal free Reedbank shelter. Six further actual opening routes, one for each selectable lead job, also kept every traveler alive through the boss using earned resources and normal recovery.

The same earned-level party then visited the actual new weapon and magic merchants. It bought Spark, Frost, Storm Wave and Renew with earned gold, bought all four regional weapons and body armors over the course of training, and paid for Dunmere inn stays. The test strategy reserves 40 gold before an equipment purchase so buying gear cannot consume its last lodging money. With the tested seed, the first second-region encounter rolled the rare four-guard row; five training encounters reached level nine/1492 EXP. The Toll Collector then took eleven rounds, all four survived, and the party retained 580 gold. This is a deterministic regression route, not an estimate of the average encounter count.

Fifteen separate combat fixtures test nine small enemies, four large enemies, and the mixed eight-enemy group in regions two through six. They use declared level 9/15/21/27/33 parties derived from real class rules and ordinary regional shop equipment. The allowed unlocked spells represent a prepared purchased spellbook. These probes took one to four rounds and retained all four survivors. They test the upper regional preparation bands; they do not claim a full earned-level campaign playthrough or that a newly arrived under-equipped party will beat every rare formation.

Human playtesting should still assess encounter frequency, spell-charge spending, rare-group difficulty at low regional levels, and whether repeated shopping decisions feel satisfying. Automated seeds and declared loadouts establish useful bounds, not universal strategy balance.
