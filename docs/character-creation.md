# Your first traveler

First Watch now opens with a title screen and a three-step character creator. Continue resumes a saved expedition or an unfinished introduction. New adventure does not replace an existing save until the player confirms Begin the journey on the final screen.

## Identity and appearance

The lead hero has a 1–14-character name, story pronouns, four skin tones, four hair colors, three hairstyles, and four cloak colors. Names support Unicode letters and numbers, spaces, apostrophes, and hyphens. Empty, overlong, control-character, and markup inputs cannot start a new game.

Appearance is cosmetic. The creation preview, party portrait, field sprite, and battle sprite share the same pixel drawing instructions. The job also changes visual equipment details. All display names are separate from stable simulation identifiers, so a custom name cannot break targeting or equipment ownership.

## Six lead jobs

| Job | Strengths | Implemented trait and limitations |
| --- | --- | --- |
| Warden | High HP, heavy armor, dependable swordplay. | Guard reduces incoming damage by 65%. No spell pool. |
| Striker | High accuracy and physical pressure. | One additional physical hit, capped at four base hits. Light equipment, no spell pool. |
| Scout | Light equipment and strong accuracy. | 15% chance to evade an enemy strike. Less durable than the Warden. |
| Mender | Recovery and protective spells. | Healing spells restore 20% more HP. Full caster charge progression; low physical pressure. |
| Arcanist | Fire, frost, lightning, and area damage. | Weakness damage uses 1.65× instead of 1.5×. Full caster charges, low durability. |
| Spellblade | Swordplay with small amounts of healing and fire magic. | Mend and Ember; one initial tier-one charge growing to a maximum of four. No higher-tier pools in this demo. |

The companions retain their identities: Tavin is a Striker, Iona a Mender, and Soren an Arcanist. Their jobs use the same implemented rules. A chosen lead job can overlap a companion, allowing different approaches without removing a story character.

The lead's equipment permissions and starter gear follow the selected job, not the internal lead slot. Shared common gear is counted correctly when two heroes use the same archetype. Unique collection pieces remain exclusive to one wearer.

## Opening scenes

The eight-scene prologue establishes the night fog and silent bell, gives the hero a job-specific background, and introduces each companion through their own words and portrait. Tavin describes his search, Iona explains the cost of spellcasting, Soren connects the mystery to his engineering work, and Bessa gives the party a reason to stay together.

Scenes use the hero's chosen name and pronouns. Companions appear in the camp as their introductions occur. Continue advances at the player's pace; Skip introduction enters normal exploration without losing the character profile. Reloading mid-prologue restores its scene index.

The larger story outline still uses its default Warden, Mara. The playable opening adapts to the custom hero; job-specific branching for the later campaign and personal quest lines remains future writing work.

## Gameplay polish

- Classic walking encounters are the new-game default. In the bellworks, safe movement accumulates toward the next authored formation. Camp and recovery remain safe, and encounters do not run on a real-time clock.
- Settings can show the original visible patrols or turn ordinary encounters off. Bosses, treasure, and the post-demo hunt remain available. Switching modes clears partial walking pressure.
- Hold Shift to run. Map clicks still find a walkable route and interact from an adjacent tile.
- Battle planning remains turn based. Speed settings change playback only, from 1× through 3×; the game always waits for commands.
- Repeat last commands replaces the current partial plan, rechecks charges and shared item reservations, and uses a safe attack fallback when an action is no longer legal. It never commits the round automatically.
- Arrow keys navigate command and ability menus, Enter selects, and Escape returns to the command menu. Commands remain editable before resolution.
- Scenery, spell effects, guarding cues, character portraits, and job silhouettes have been refined. Reduced-motion settings remain supported.

## Saves and validation

Version-two saves include the profile, scene index, encounter settings, and battle speed. Version-one demo saves migrate to the original Mara Warden and visible encounters while retaining progression, equipment, supplies, and wounded resources. Battle saves still use the preceding stable exploration checkpoint.

Engine tests cover all jobs, class permissions, profile validation, intro continuation, migration, and repeat-command reservations. A starter-gear route has been exercised for each job using ordinary recovery. Browser checks exercise the complete named-hero expedition, creation, mobile layout, intro persistence, job menus, walking encounters, keyboard navigation, and the self-contained HTML build. These checks do not establish balance for the later campaign or every possible strategy.
