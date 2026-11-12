# The Road Beyond the Bells

An original four-person party RPG set in Avel. The playable build now uses the user's selected, modified standalone game, including the latest encounter, shop, story, equipment, and route changes. Create a hero, explore a connected world, and follow the campaign from Merewatch to the last bell in Veyr.

In this workspace, `/workspace/active-game/The_Road_Beyond_the_Bells.html` is authoritative. The normal Vite preview serves its bytes directly on port 5173, preserving the existing origin and save key. The older TypeScript source remains available for reference; it is not regenerated over the selected game. Outside this workspace, the preview uses the packaged `demo/index.html` copy.

## Play

Requires Node.js 22.12+ (the cloud environment uses Node 24):

```bash
npm ci
npm run dev
```

Vite serves the game on port **5173**. Use `npm ci --cache /tmp/rpg2-npm-cache` if the default cache is not writable. Work in the existing checkout.

```bash
npm run build
```

The build checks the embedded JavaScript syntax and copies the selected game exactly into **`dist/index.html`** and [demo/index.html](demo/index.html). It preserves scripts, styles, data, original artwork, and third-party notices. Download it for offline play, or serve it with `npm run preview`. Some managed browsers restrict direct file navigation. Use `npm run build` for this packaging workflow; direct source bundling is not the current delivery path.

Choose **New adventure**, name the lead hero, select one of six jobs, and customize appearance. The eight-scene introduction meets Tavin, Iona, and Soren. **Continue** resumes an existing journey. New creation offers she/her or he/him; compatible older profiles retain their saved identity.

Walk with **WASD / arrows**, click a destination, or use the touch pad. Hold **Shift** to run. Press **E / Space** to interact. **Escape** opens the party menu; **M** opens the area map, with a tab for the world map. Menus support keyboard and pointer input.

Implemented gameplay includes:

- A scrolling overworld connecting ten canonical local destinations across six regions. Walk onto towns and dungeon entrances to travel, then return beside the matching world site. Four physical bridge/pass/gate crossings replace duplicated portal pairs; two ferry banks remain a paired service. Later routes keep their story conditions.
- The original main story through Orren’s rescue, Neri’s release, the shelter trials, regional tower handovers, Veyr’s evacuation preparations, and the Heart Bell. The story concludes without restoring burned memories.
- Four-person turn planning, Guard, elemental weaknesses, telegraphed attacks, consumables, retreat, repeat commands, and adjustable battle playback. Walking encounters are the default; visible patrols and encounters off are settings.
- Six lead jobs with real stats, traits, equipment permissions, and spell access. Fixed regional enemies and stronger color variants replace automatic scaling to the party.
- Fixed regional formations with up to nine small enemies, four large enemies, or two large plus six small enemies. Ordinary road groups usually contain two to four foes. Defeated enemies contribute EXP shared among survivors and gold paid once to the party.
- Separate Item, Weapon, and Magic Shops in six settlements. Equipment shops include armor and accessories. Magic is learned per traveler with job and tier requirements; older compatible saves keep their unlocked spells. Learning does not refill charges.
- Shared equipment across five slots, explicit owned/equipped/available copy counts, quantity buying, spare-copy selling, and Optimize. Four owned copies can equip four compatible travelers. Regional equipment and rare stronger enemy colors remain present.
- Blue menu windows for Items / Equipment, Magic, Status, Area Map, World Map, Journal, and System. Healing and recovery spells work outside battle. Mobile movement controls hide throughout battle/results and return for exploration.
- Three optional journal-tracked stories about a courier, relief supplies, and family records, with modest once-only rewards. The main story's permanent outcomes are preserved.
- Version-three local saves, migration from earlier expeditions, safe-shelter recovery, and stable exploration checkpoints. Interrupted battles return to their preceding checkpoint. Save restrictions are labeled; session-only play remains possible.

See [the playable campaign](docs/playable-campaign.md) for scope, progression, and limitations, [character creation](docs/character-creation.md), and [the continuing gameplay direction](docs/gameplay-direction.md). The twelve detailed side quests, full refurbishment system, branching dialogue, and advanced combat models in the design documents are not all implemented.

## Campaign and editable content

- [Story and main quests](docs/story.md)
- [Twelve side-quest designs](docs/side-quests.md)
- [World and bestiary](docs/world-and-bestiary.md)
- [Progression, equipment, and rare drops](docs/progression-and-loot.md)
- [Balance research](docs/balance-research.md)
- [Combat design](docs/combat-design.md)

`data/` and `src/` retain the older source implementation and its tests. Current edits belong in the selected standalone game and its hash-checked patch workflow under `/workspace/active-game`; consult that directory's `AGENTS.md`. Porting the selected modifications back into TypeScript would be a separate integration task. [AGENTS.md](AGENTS.md) records the project direction for future additions.

## Validate

`npm run build` verifies and packages the current standalone game. Current engine, equipment, travel, spell-learning, story, and formation checks live in `/workspace/active-game/tests/`; the expansion browser suite supports `GAME_URL=http://127.0.0.1:5173/` to check the normal preview. The `npm test`, `npm run test:browser`, and Python catalog tools in this checkout still target the older source implementation and do not certify the selected uploaded game.

Playwright uses `/usr/bin/chromium` when available, or `CHROMIUM_PATH`. Otherwise install a browser with `npx playwright install chromium`. Tests cover engine progression and save rules, real browser input, combat, menus, mobile layout, and the standalone export. Browser screenshots and traces go under `test-results/`.

The Python tools are standard-library content models. Their planning budgets and full catalog differ from the condensed browser campaign’s encounter tuning; they are not a browser battle simulator. Automated routes provide regression evidence, while broad job, seed, strategy, and pacing balance still benefits from human playtesting.
