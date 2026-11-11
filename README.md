# The Road Beyond the Bells

An original four-person party RPG set in Avel, built with Phaser, TypeScript, and Vite. Create a hero, explore a connected world, and follow the campaign from the rescue at Merewatch to the last bell in Veyr.

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

The build produces **`dist/index.html`** and [demo/index.html](demo/index.html), a self-contained HTML game with scripts, styles, data, original artwork, and third-party notices embedded. Download it for offline play, or serve it with `npm run preview`. Some managed browsers restrict direct file navigation.

Choose **New adventure**, name the lead hero, select one of six jobs, and customize appearance. The eight-scene introduction meets Tavin, Iona, and Soren. **Continue** resumes an existing journey. New creation offers she/her or he/him; compatible older profiles retain their saved identity.

Walk with **WASD / arrows**, click a destination, or use the touch pad. Hold **Shift** to run. Press **E / Space** to interact. **Escape** opens the party menu; **M** opens the world map. Menus support keyboard and pointer input.

Implemented gameplay includes:

- A scrolling overworld and ten local maps across six regions, with safe towns, dangerous dungeons, shops, inns, treasure, and story-gated bridges, ferries, and entrances.
- The original main story through Orren’s rescue, Neri’s release, the shelter trials, regional tower handovers, Veyr’s evacuation preparations, and the Heart Bell. The story concludes without restoring burned memories.
- Four-person turn planning, Guard, elemental weaknesses, telegraphed attacks, consumables, retreat, repeat commands, and adjustable battle playback. Walking encounters are the default; visible patrols and encounters off are settings.
- Six lead jobs with real stats, traits, equipment permissions, and spell access. Fixed regional enemies and stronger color variants replace automatic scaling to the party.
- Eight spell tiers, shared equipment, regional shop upgrades, six three-piece sets, and rare hunts with 2% sightings and a twelve-victory tracking guarantee. The opening Silver Reedback remains a disclosed showcase hunt for the original collection.
- Blue menu windows for Items / Equipment, Magic, Status, World Map, Journal, and System. Healing and recovery spells can be used outside battle.
- Version-three local saves, migration from earlier expeditions, safe-shelter recovery, and stable exploration checkpoints. Interrupted battles return to their preceding checkpoint. Save restrictions are labeled; session-only play remains possible.

See [the playable campaign](docs/playable-campaign.md) for scope, progression, and limitations, [character creation](docs/character-creation.md), and [the continuing gameplay direction](docs/gameplay-direction.md). The twelve detailed side quests, full refurbishment system, branching dialogue, and advanced combat models in the design documents are not all implemented.

## Campaign and editable content

- [Story and main quests](docs/story.md)
- [Twelve side-quest designs](docs/side-quests.md)
- [World and bestiary](docs/world-and-bestiary.md)
- [Progression, equipment, and rare drops](docs/progression-and-loot.md)
- [Balance research](docs/balance-research.md)
- [Combat design](docs/combat-design.md)

`data/` contains the editable catalog. `src/campaign.ts` defines playable geography, transitions, and story events. `src/engine.ts` owns simulation rules independently of Phaser; rendering and DOM menus present that state. [AGENTS.md](AGENTS.md) records the project direction for future additions.

## Validate

```bash
npm test
npm run build
npm run test:browser
python -m unittest discover -s tests -v
python tools/audit_balance.py
```

Playwright uses `/usr/bin/chromium` when available, or `CHROMIUM_PATH`. Otherwise install a browser with `npx playwright install chromium`. Tests cover engine progression and save rules, real browser input, combat, menus, mobile layout, and the standalone export. Browser screenshots and traces go under `test-results/`.

The Python tools are standard-library content models. Their planning budgets and full catalog differ from the condensed browser campaign’s encounter tuning; they are not a browser battle simulator. Automated routes provide regression evidence, while broad job, seed, strategy, and pacing balance still benefits from human playtesting.
