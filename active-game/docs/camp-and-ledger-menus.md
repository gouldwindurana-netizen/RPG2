# Camp and ledger menus

The new menus build on the complete game archived in `camp-menu-baseline.html`. The title uses an original camp-at-dusk illustration, and the party menu uses a compact travel-ledger layout. The game retains its indigo, silver and bell-gold identity, original characters, softened world art and existing interfaces. The crescent moon uses a transparent cutout so its inner edge reveals the real sky instead of an overlapping dark disc.

## Opening screen

The primary actions remain Continue and New Adventure. A journey preview uses the actual hero, party, location and campaign state; it does not invent timestamps or playtime. Completed journeys display a completion state rather than a chapter beyond the campaign total. The wording also supports in-memory sessions where browser storage is unavailable.

How to Play is a persistent, dismissible disclosure with concise movement, interaction and battle basics. New Adventure still follows the existing creator flow. Cancelling creation retains the current journey, and Continue resumes that same state.

## Travel ledger

The in-game menu retains all eight destination keys and accessible command names. A compact ruled party roster shows current HP, MP, jobs, levels and conditions. The contextual objective uses the existing story or shop guidance. A Return to Adventure control closes the menu through the existing handler.

The design supports keyboard navigation, restored focus, narrow touch screens and reduced motion. Decorative artwork does not intercept input. Opening a menu continues to pause world input and citizen movement.

## Reproduction and verification

`tools/build_camp_menu.py` applies `camp_title.py` and `camp_ledger.py` to the immutable baseline. Before writing, it checks embedded script syntax and verifies the entire gameplay/data prefix is unchanged. Earlier generators must not overwrite this menu update.

Browser checks cover fresh and existing journeys, Continue, creator cancellation, completion/session-only states, menu navigation and resources, responsive layouts and offline rendering. Existing engine and renderer checks remain relevant. Final receipts and build hashes live in `camp-menu-manifest.json`. These bounded checks do not constitute a complete campaign playthrough.
