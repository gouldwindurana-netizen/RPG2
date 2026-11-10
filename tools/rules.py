"""Engine-independent content rules and collection-state model; no game renderer."""

from dataclasses import dataclass, field
import json
import math
from pathlib import Path

DATA = Path(__file__).resolve().parents[1] / "data"
RULES = json.loads((DATA / "progression.json").read_text())
ITEMS = json.loads((DATA / "items.json").read_text())


def integer(value, minimum, maximum, name):
    if isinstance(value, bool) or not isinstance(value, int):
        raise TypeError(f"{name} must be an integer")
    if not minimum <= value <= maximum:
        raise ValueError(f"{name} must be between {minimum} and {maximum}")
    return value


def xp_required(level):
    integer(level, 1, RULES["level_cap"], "level")
    return RULES["xp_thresholds"][level - 1]


def level_for_xp(xp):
    if isinstance(xp, bool) or not isinstance(xp, int):
        raise TypeError("XP must be an integer")
    if xp < 0:
        raise ValueError("XP cannot be negative")
    return sum(xp >= threshold for threshold in RULES["xp_thresholds"])


def spell_charges(level):
    integer(level, 1, RULES["level_cap"], "level")
    return [0 if level < unlock else min(9, 2 + (level - unlock) // 4)
            for unlock in RULES["spell_tier_unlocks"]]


def hero_stats(hero, level, tier):
    integer(level, 1, RULES["level_cap"], "level")
    integer(tier, 1, 6, "equipment tier")
    if hero not in RULES["heroes"]:
        raise ValueError("Unknown hero")
    base = RULES["heroes"][hero]
    result = {stat: math.floor(values[0] + values[1] * (level - 1))
              for stat, values in base.items() if stat != "armor"}
    region = f"R{tier:02d}"
    gear_ids = [f"{region}_{hero.upper()}_WEAPON", f"{region}_{hero.upper()}_BODY"]
    gear_ids += [f"{region}_COMMON_{slot}" for slot in ("HEAD", "MANTLE", "CHARM")]
    gear = [item for item in ITEMS["items"] if item["id"] in gear_ids]
    result["attack"] = result.pop("strength") + sum(i["stats"].get("attack", 0) for i in gear)
    result["defense"] = 2 + (level - 1) // 3 + sum(i["stats"].get("defense", 0) for i in gear)
    result["magic"] += sum(i["stats"].get("magic", 0) for i in gear)
    result["magicDefense"] = 3 + level + sum(i["stats"].get("magicDefense", 0) for i in gear)
    result["hits"] = min(4, 1 + result["accuracy"] // 40)
    return result


def enemy_stats(level, role="striker", kind="normal"):
    """Fixed authored enemy level: never accepts or reads a player level."""
    integer(level, 1, 50, "enemy level")
    factors = {"swarm": .55, "striker": .95, "armored": 1.25,
               "caster": .8, "support": .9, "status": .85}
    if role not in factors or kind not in ("normal", "rare", "boss"):
        raise ValueError("Unknown enemy role or kind")
    multiplier = {"normal": 1, "rare": 2.5, "boss": 5}[kind]
    return {
        "hp": round((22 + 16 * level + 1.2 * level ** 2) * factors[role] * multiplier),
        "attack": round(5 + 2 * level + .02 * level ** 2),
        "defense": round((2 + 1.2 * level) * (1.5 if role == "armored" else 1)),
        "magicDefense": 3 + level,
    }


def build_catalog(world):
    regions = {r["region_id"]: r for r in RULES["regions"]}
    catalog = []
    for enemy in world["enemies"]:
        for variant in RULES["variants"]:
            level = enemy["level"] + variant["level_offset"]
            row = dict(enemy, id=enemy["id"] + "_" + variant["id"], kind="normal", level=level)
            row["template_id"] = enemy["id"]
            row["name"] = " ".join(filter(None, [variant["prefix"], enemy["name"]]))
            row["rank"] = variant["id"]
            row["presentation"] = dict(variant)
            row["stats"] = enemy_stats(level, enemy["role"])
            row["xp_each"] = round(regions[enemy["region_id"]]["normal_xp_each"] / 2
                                   * (1 + .2 * (variant["level_offset"] // 3)))
            catalog.append(row)
    for kind, key in (("rare", "rares"), ("boss", "bosses")):
        for enemy in world[key]:
            row = dict(enemy, kind=kind)
            row["stats"] = enemy_stats(enemy["level"], enemy.get("role", "striker"), kind)
            row["xp_each"] = (RULES["boss_xp_each"][enemy["id"]] if kind == "boss"
                              else round(regions[enemy["region_id"]]["normal_xp_each"] * 1.5))
            catalog.append(row)
    return catalog


@dataclass
class HuntProgress:
    """Persist this state with the game's RNG and inventory after each victory.

    Opportunities are sightings/lairs, not instant victories. The reward and
    counter reset are one state transition, so failed claims do not lose progress.
    """

    region_id: str
    wins: int = 0
    opportunity: bool = False
    acquired: set = field(default_factory=set)
    sources: set = field(default_factory=set)

    def __post_init__(self):
        if self.region_id not in {r["region_id"] for r in RULES["regions"]}:
            raise ValueError("Unknown region")
        integer(self.wins, 0, RULES["loot"]["tracked_hunt_after_wins"], "tracking wins")
        if not isinstance(self.opportunity, bool):
            raise TypeError("opportunity must be boolean")
        if not isinstance(self.acquired, set) or not isinstance(self.sources, set):
            raise TypeError("acquired and sources must be sets")
        if not self.acquired <= set(self.pieces) or not self.sources <= {"cache", "boss"}:
            raise ValueError("Invalid acquired item or one-time source")
        if self.wins == RULES["loot"]["tracked_hunt_after_wins"] and not self.opportunity:
            raise ValueError("A completed track must preserve its opportunity")

    @property
    def pieces(self):
        return [f"{self.region_id}_SET_{slot}" for slot in RULES["loot"]["pieces"]]

    def record_win(self, eligible, roll):
        if not isinstance(eligible, bool):
            raise TypeError("Eligibility must be boolean")
        if (isinstance(roll, bool) or not isinstance(roll, (int, float))
                or not math.isfinite(roll) or not 0 <= roll < 1):
            raise ValueError("Roll must be finite and in [0, 1)")
        if not eligible or self.opportunity:
            return self.opportunity
        self.wins += 1
        self.opportunity = (roll < RULES["loot"]["natural_opportunity_chance"]
                            or self.wins >= RULES["loot"]["tracked_hunt_after_wins"])
        return self.opportunity

    def claim(self, source, choice=None):
        if source not in ("cache", "boss", "hunt"):
            raise ValueError("Unknown reward source")
        if source in self.sources:
            raise ValueError("One-time reward already claimed")
        if source == "hunt" and not self.opportunity:
            raise ValueError("No available rare target")
        unowned = [piece for piece in self.pieces if piece not in self.acquired]
        if unowned and choice not in unowned:
            raise ValueError("Choose one unowned regional piece")
        if not unowned and choice is not None:
            raise ValueError("Completed sets yield supplies, not another piece")
        reward = choice if unowned else "supply_bundle"
        # All checks precede mutation. Persist this together with inventory delivery.
        if unowned:
            self.acquired.add(choice)
        if source == "hunt":
            self.wins = 0
            self.opportunity = False
        else:
            self.sources.add(source)
        return reward

    def to_json(self):
        return {"region_id": self.region_id, "wins": self.wins,
                "opportunity": self.opportunity, "acquired": sorted(self.acquired),
                "sources": sorted(self.sources)}

    @classmethod
    def from_json(cls, data):
        expected = {"region_id", "wins", "opportunity", "acquired", "sources"}
        if not isinstance(data, dict) or set(data) != expected:
            raise ValueError("Malformed hunt save")
        for name in ("acquired", "sources"):
            if (not isinstance(data[name], list)
                    or not all(isinstance(v, str) for v in data[name])
                    or len(data[name]) != len(set(data[name]))):
                raise ValueError("Malformed or duplicate hunt save entries")
        return cls(data["region_id"], data["wins"], data["opportunity"],
                   set(data["acquired"]), set(data["sources"]))
