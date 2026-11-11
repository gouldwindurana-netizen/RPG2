# Playable campaign

The browser build now connects the original main story across Avel. This is a compact campaign baseline: the outline’s events are adapted into playable conversations, travel gates, dungeons, and boss encounters. The prose documents retain more scene detail and optional quest designs than the runtime.

| Region | Places | Main progress |
| --- | --- | --- |
| Reedbank, Lv 1–5 | Reedbank Shelter, Merewatch Bellworks | Rescue Orren, retire the feeding frame, prepare Bessa’s convoy |
| Salt Road, Lv 5–10 | Dunmere Market, Impounding Tollhouse | Copy Leth’s records, defeat the Toll Collector, free Neri |
| Alder Fen, Lv 10–16 | Fen Village, Flooded Granary | Secure supplies and witness the failed shelter trial |
| Orchard, Lv 16–22 | Orchard Highroad | Clear the Hart and establish the second refuge |
| Crown Road, Lv 22–28 | Crown Road Handover | Stop the Gate-Censer and complete Halden’s tower handovers |
| Veyr, Lv 28–34 | Refuge Quarter, Last Service Passage | Account for the crew, prepare the evacuation, face the Choir, Vale, and Heart Bell |

A large tile overworld connects the local maps. Crossing routes opens through story progress; the map menu shows geography rather than providing teleport buttons. Conversations establish why a route opens. Civilians need food, shelter, and trained ward crews before feeding chambers are retired. Orren and Neri’s lost memories do not return. Vale is pulled free of his broken armor. The fog remains after the final bell; the ending is a beginning of shared rebuilding.

Ordinary monster levels belong to regions. The player can return to earlier areas, recover, buy equipment, and train before tackling a stronger route. Named color variants communicate additional strength. Towns are safe. Walking encounters repeat on dangerous roads and in dungeons; authored visible patrols remain available through settings.

The opening retains its short authored progression and starter spells. Later regions use condensed battle rewards so a small number of repeated encounters can support the next boss rather than requiring the design model’s longer encounter budgets. The EXP threshold table and job stat growth remain in `data/progression.json`; the runtime encounter rewards are explicit in `src/engine.ts`. Spell charges have eight independent tiers. Recovery, healing, and revival work in the field; defensive round spells remain battle actions.

Every region has an exploration cache, boss set reward, and rare hunt. A hunt unlocks after regional progress; later eligible victories have a 2% sighting chance and complete tracks by twelve wins. Tracking survives rest and save/reload. Rare rewards prioritize missing unique pieces. Set bonuses count equipment on one wearer, and each unique piece has only one wearer at a time. The original opening Silver Reedback is still a guaranteed showcase after Bessa’s convoy departs.

Briar Widow and the postgame Unlit Colossus provide optional boss encounters. The full twelve side-quest narratives, refurbishment, job promotion, free respec, and branching story choices remain future work. The camp lantern task is implemented; an optional boss encounter does not imply its entire designed side quest is playable.

Compatible version-one and version-two saves migrate to version three. A completed opening expedition continues after the Reedbank handoff rather than treating it as the whole campaign’s ending. The lead profile, equipment, resources, and collection remain. An interrupted battle resumes from its last exploration checkpoint, and defeat returns to the most recently visited safe shelter.

Validation separates the headless campaign route (simulation, story gates, equipment, ordinary leveling, and final completion) from browser journeys (actual movement, menus, encounters, camera, and persistence). Passing those checks does not establish every job, seed, or strategy is balanced.
