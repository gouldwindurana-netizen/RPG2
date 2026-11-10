# The Road Beyond the Bells

An original party RPG set in Avel. **First Watch** is a playable browser demo of the opening expedition, built with Phaser, TypeScript, and Vite. Campaign documents and editable content remain alongside the demo.

## Play the demo

Requires Node.js 22.12+ (this environment uses Node 24). From `/workspace/RPG2`:

```bash
npm ci
npm run dev
```

Vite serves the game on port **5173**. In a restricted cloud shell, use `npm ci --cache /tmp/rpg2-npm-cache` if the default npm cache is not writable. Use the existing checkout; a new worktree is unnecessary.

```bash
npm run build
```

The build produces **`dist/index.html`** and a distributable copy at [demo/index.html](demo/index.html): a self-contained HTML game with its JavaScript, styles, data, original pixel artwork, and third-party notices embedded. Download it to play without installing dependencies, or serve it using `npm run preview`. Managed browsers may restrict direct `file://` navigation; serving the file avoids that browser policy.

Start from the title screen: choose **New adventure**, name the lead hero, choose one of six jobs, and adjust skin tone, hair, hairstyle, cloak, and story pronouns. A live preview matches the in-world sprite. The eight-scene prologue introduces the hero, Tavin, Iona, and Soren; it can be skipped or resumed after a reload. **Continue** preserves an existing journey.

Move with **WASD / arrow keys** or click/tap a destination. Hold **Shift** to run. Press **E / Space** or click a nearby character/object to interact. Touch controls are available on small screens. Battle menus support arrow keys, Enter, Escape, and pointer input.

The demo includes:

- Reedbank camp, NPC conversations, a small lantern side quest, free camp recovery, and a functioning supply shop.
- Merewatch bellworks, six authored encounter formations, the inspection cache, and the Brass Bailiff rescue boss. New games use classic walking encounters; settings also offer visible patrols or ordinary encounters off. Bosses and rare hunts remain available in every mode.
- Four-hero action planning, spells with tiered charges, Guard, consumables, enemy telegraphs, elemental weaknesses, and EXP/class growth. Repeat commands fills a legal editable plan without automatically committing it. Battle animation speed is adjustable from 1× to 3×.
- Six functional lead jobs: Warden, Striker, Scout, Mender, Arcanist, and Spellblade. Jobs affect stats, traits, spell access, and equipment; appearance is cosmetic. Tavin, Iona, and Soren retain their story roles.
- Shared equipment, exclusive unique pieces, and the three-piece Reedwatch collection.
- A return-to-camp ending and an optional **guaranteed showcase** Silver Reedback hunt afterward. The demo does not pretend this scripted encounter uses the full-world 2% rare-sighting rule.
- Version-two local saves at stable checkpoints, including the custom profile and intro progress. Original demo saves migrate automatically to the default Warden with visible encounters; no forced restart is required. Reloading during a battle returns to its preceding exploration checkpoint. Storage failures allow session-only play and are labeled in the HUD. Sound is optional; reduced-motion settings are respected.

The demo uses only R01 and its opening spells/items. See [character creation and gameplay polish](docs/character-creation.md) for details. The complete campaign, later regions, full spell catalog, refurbishment, advanced enemy AI, and the 12-win tracking system remain designs or standalone rule models, not completed game features. The browser simulation is separate from Phaser presentation and text-heavy DOM menus so this baseline can grow. Companion jobs remain fixed; free respec, full party creation, later job promotions, and branching campaign dialogue are not part of this build.

## Campaign and content

- [Story and main quests](docs/story.md)
- [Twelve side quests](docs/side-quests.md)
- [World map, enemies, and bosses](docs/world-and-bestiary.md)
- [Leveling, items, regional sets, and rare drops](docs/progression-and-loot.md)
- [Online balance research](docs/balance-research.md)
- [Combat design](docs/combat-design.md)

The JSON files in `data/` are the editable source content. The Python content tools use only the standard library; no Python dependency installation or credentials are required.

## Validate

```bash
npm test
npm run build
npm run test:browser
```

The Playwright configuration uses system Chromium at `/usr/bin/chromium` when present, or `CHROMIUM_PATH` if supplied. Outside this cloud image, install a supported Playwright browser with `npx playwright install chromium` if needed. Browser tests cover actual map/DOM input, combat, rewards, persistence, mobile layout, and the self-contained export. Screenshots are written under `test-results/`.

From the existing checkout at `/workspace/RPG2`:

```bash
python -m unittest discover -s tests -v
python tools/audit_balance.py
python tools/audit_balance.py --export /tmp/avel-catalog.json
```

The export contains fixed stats for 72 ordinary rank variants, six rares, and ten boss encounters. Three rank definitions per ordinary template are content possibilities, not a claim that 72 distinct sprites or authored encounter maps exist.

The audit checks content references, XP planning budgets, gross baseline gear affordability, and loot math. Python tests exercise progression and collection rules; TypeScript engine tests exercise the actual demo simulation. Browser checks and screenshots verify the playable slice. Later-region combat, broader balance, and human playtesting are still outstanding.

