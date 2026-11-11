# First Watch — original opening baseline

Historical record of the two-map opening build. The current implementation has expanded beyond this slice; see [the playable campaign](playable-campaign.md) for current features and limits.

The opening expedition is playable. Begin at the title screen, create and name a lead hero, and meet the party in the eight-scene prologue. At Reedbank, speak to Bessa, enter Merewatch, fight the authored encounter formations, choose equipment from the inspection cache, defeat the Brass Bailiff, and bring Orren back to Bessa. The campfire restores the party and the quartermaster sells supplies. Completing the short lantern task grants one extra Potion.

The six ordinary victories award 28 EXP each and the boss awards 88, reaching 256 EXP and level five for the party. These authored formations can appear through walking encounters (the default), as visible patrols, or be disabled for ordinary exploration. Bosses remain available. Players can retreat to camp between fights. Progress is not gated behind defeating every patrol. The boss announces its heavy rounds, giving Guard a purpose.

The ordinary enemy roster includes an Ashen Hound with a stronger slate-colored form. The demonstration uses original procedural artwork, not copied game sprites. It is deliberately compact: two maps and one main boss, not six unfinished regions.

The inspection cache, boss reward, and optional post-ending rare each grant a choice of an unowned Reedwatch piece. A unique piece can be equipped on only one traveler. Two pieces give a first-hit shield once per battle; three reduce poison infliction. The Silver Reedback is an explicitly guaranteed demo hunt after the ending so collection can be tested without farming. It is not an implementation of the proposed natural rare-sighting and 12-win tracking rules.

The browser simulation reads the existing content and progression data. `src/characters.ts` defines jobs, profile validation, and the opening scenes; `src/new-game.ts` builds the creation UI, and `src/appearance.ts` supplies matching portrait and sprite pixels. Demo-specific encounter formations, boss tuning, and spells live in `src/engine.ts`; the full content catalog contains many later-game designs that the demo does not expose. `src/contracts.ts` defines the state/input boundary, `src/renderer.ts` and `src/art.ts` own Phaser presentation, and `src/main.ts` owns the DOM interface. No combat rule is decided by an animation callback.

Saves retain stable progress and pending reward choices without granting the same unique piece twice. An interrupted battle restarts from the last exploration checkpoint; turn-by-turn battle resume is not part of this baseline. Save availability is displayed honestly. Starting a new expedition asks for confirmation.

`npm run build` creates a single self-contained HTML file. `npm test`, Playwright browser checks, and the existing Python content checks cover different layers. Automated starter-gear checks establish that the intended route can be cleared; they do not establish all strategies, seeds, and equipment combinations are balanced.

Further work can build on this slice: adjust the movement and battle feel from player feedback, improve the art and sound, then add the next connected region. The full campaign documents remain the content direction.

The lead traveler can now be named and customized. All six jobs have real equipment/spell permissions and traits. Version-two saves preserve the profile and prologue progress, while version-one saves retain their existing journey. The canonical story outline uses Mara as its default Warden; the demo uses the chosen name and a job-specific opening background. See [character creation](character-creation.md).
