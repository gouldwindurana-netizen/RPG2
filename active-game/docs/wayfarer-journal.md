# Work for the road crews

Visit a **Wayfarer Board** in Reedbank, Dunmere, Alder Fen, Orchard Highroad, Crown Road or Veyr. Accept a commission, follow its objectives, and return to that region's board to deliver it. The party menu's **Wayfarer Journal** tracks progress anywhere. The area map marks boards with **▤**. Escape or the top close button leaves the board.

Each region has three optional commissions, for 18 total:

- **Patrol:** defeat six ordinary regional foes after acceptance. Every enemy in a won formation counts.
- **Survey:** copy two distinct dungeon records below the first floor. Evidence already copied in the save counts.
- **Return route:** open a service lift and defeat three ordinary regional foes after acceptance. An already-open lift counts.

The titles and reports follow local work: inspection pages, salt carts, relief stores, ashwater, receiving crews and the final convoy. Regional work unlocks with the existing main story, rather than bypassing it. A newly ready patrol or return-route commission is mentioned in the victory report.

## Rewards and preparation

Rewards pay once, only at the local board. They grant no EXP. Regional patrol gold runs from 35 to 300; survey gold is roughly 70% and return-route gold roughly 85% of that region's patrol payment. Early patrols award two Potions, later ones a High Potion. Surveys award a Packed Meal in the first two regions, Spark Tea in the next two and Deep Tea in the last two. Return-route work awards one Revival Salt.

This introduces small, finite sources of the existing field meals and charge teas. Their existing use restrictions remain: one living hero for a meal, an explicitly selected spent permitted tier for tea. Commissions never heal the party automatically. If any reward cannot fit its stack or gold limit, the entire payment remains at the board until room is available. Repeating a completed task cannot pay again.

Normal encounter EXP/gold and all four difficulty multipliers retain the user's merged tuning. Commissions add a short optional loop around routes the party already explores; they do not replace the main campaign or its slower leveling.

## Bestiary

The **Bestiary** tab fills from actual victories. It groups duplicates by regional catalog entry and strength rank, records defeated counts, and shows family weaknesses/resistances, including the uploaded physical/light/dark affinities. Boss voices share their authored boss entry. No progress is granted for retreating or losing, and old saves do not receive invented kill histories.

HP and attack values are omitted because the chosen difficulty changes them. The notes remain useful for deciding which jobs and spells to bring without claiming that one stat line describes every mode.

## Camp tales

At a safe shelter, open **Camp tales** to hear a four-line party exchange. Six scenes unlock at stages 0, 2, 4, 6, 8 and 10: Four pairs of boots, The lantern bench, An extra bowl, Two kitchens, A place on the roster, and The next ordinary morning.

The lead hero's current name appears in the conversation. The scenes preserve the story's permanent losses and the companions' independent lives. Heard status and active dialogue queues save normally. Scenes can be replayed; they grant no resources or story advancement.

## Compatibility and evidence

Optional version-three fields hold the new journal and conversation history. Old saves retain their party, items, equipment copies, difficulty, spell learning/practice, EXP, gold, locations and story outcomes. All 33 dungeon floors and ten exterior destinations remain.

The new engine, UI and camp suites add 27 checks to the prior 258, for 285 automated checks. Browser fixtures exercise real walking, acceptance, victory, delivery, keyboard focus, dialogue and reloads on desktop and 390px viewports. Later-state fixtures are identified in the test source; they are not a full-campaign playthrough. Exact hashes and final browser receipts are in `engagement-manifest.json`.
