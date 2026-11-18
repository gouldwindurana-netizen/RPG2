# Walking the roads of Avel

The travel loop is **prepare in town → walk into the field → explore a dungeon → return to recover**. Towns, roads, and indoor rooms are different places to walk through. The campaign’s bridges and ferries open through story progress.

## Entrances and exits

Walk onto a town, dungeon entrance, building door, or road exit to travel. Clicking or tapping that destination walks the party onto the entrance. E and Space remain available for nearby interactions. A blocked crossing explains its requirement and leaves the party on the approach tile.

The opening region can be explored before the first boss. Bessa’s briefing is still required before entering Merewatch, and the north-road bridge remains locked until the Reedbank handoff. Later regional gates keep their existing story conditions.

Returning to the overworld places the party beside the entrance it used. Visiting a town’s shop or inn preserves that outdoor return position. A crossing step does not roll a random encounter, and a short arrival pause prevents held movement from carrying the party straight back through a doorway. Reduced motion removes the nonessential fade while retaining the input boundary.

## Town services

Each of the six settlements has marked Outfitters and Inn entrances, with furnished rooms and a clear door back to the street. Towns and rooms have no random encounters. Orchard and Crown Road retain dangerous terraces outside their calm service courts.

Outfitters sell regional equipment and shared supplies. Category tabs separate supplies, weapons, and armor. Select a traveler to see equipment compatibility and stat changes against the item currently worn in that slot. Buying places the item in the shared pack; equipping remains an explicit choice in Items / Equipment.

The innkeeper quotes the party’s lodging price before payment. Confirm a stay to restore HP, spell charges, and conditions, or decline without spending gold. Reedbank’s shelter and watchfire remain free. Later lodging uses the region’s modest fixed rate.

## Maps and interface

M opens the area map. Its world-map tab shows Avel’s broader routes. The local view marks the party, doors, people, services, and remaining treasure; chest counts support revisits. Maps provide directions rather than teleporting the party.

Exploration uses a wide playfield, a compact four-traveler HP strip, and contextual actions. The blue command windows, full party status, and battle log return for combat. Long lore and objectives remain available through the Journal.

## Compatibility and verification

Existing version-one, version-two, and version-three saves remain compatible. The new service rooms use the existing validated save format, and a save inside a room can resume and return outside. Old saves whose outdoor return point stood on an entrance are moved to a clear adjacent tile when leaving.

Engine regression tests cover step-on entrances, blocked approaches, encounter ordering, all twelve service rooms, nested return positions, inn costs, and reloads. The complete campaign test still uses actual earned levels and equipment. Browser playtests cover keyboard, pointer, touch, reduced motion, menus, safe rooms, and continued campaign travel.
