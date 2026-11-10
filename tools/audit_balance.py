"""Run: python tools/audit_balance.py [--export /tmp/avel-catalog.json]."""

import argparse
import json
import math
from pathlib import Path

from rules import DATA, ITEMS, RULES, build_catalog, hero_stats, level_for_xp, xp_required


def check(condition, message):
    if not condition:
        raise ValueError(message)


def audit(export=None):
    world = json.loads((DATA / "world.json").read_text())
    region_ids = {r["id"] for r in world["regions"]}
    check(len(region_ids) == 6, "Expected six unique regions")
    item_ids = [i["id"] for i in ITEMS["items"]]
    check(len(set(item_ids)) == len(item_ids), "Duplicate item ID")
    family_ids = {f["id"] for f in world["families"]}
    sets = {s["id"]: s for s in ITEMS["sets"]}
    pool = RULES["loot"]["normal_drop_pool"]
    check(all(entry["item_id"] in item_ids and entry["weight"] > 0 for entry in pool),
          "Invalid ordinary supply pool")
    check(sum(entry["weight"] for entry in pool) == 100, "Unexpected supply weights")
    for entries in RULES["loot"]["bundles"].values():
        check(all(e["item_id"] in item_ids and e["quantity"] > 0 for e in entries),
              "Unresolvable fallback reward")
    for region in world["regions"]:
        check(set(region["connections"]) <= region_ids, "Unknown connected region")
        check(region["set_id"] in sets, "Missing regional set")
        check(region["rare_enemy_id"] in {r["id"] for r in world["rares"]}, "Missing rare")
        check(sum(e["region_id"] == region["id"] for e in world["enemies"]) == 4,
              "Expected four ordinary templates per region")
    for set_ in ITEMS["sets"]:
        check(len(set_["pieces"]) == 3 and set(set_["pieces"]) <= set(item_ids), "Bad set pieces")
    for enemy in world["enemies"] + world["rares"]:
        check(enemy["region_id"] in region_ids and enemy["family"] in family_ids, "Bad enemy reference")
    for boss in world["bosses"]:
        check(boss["region_id"] in region_ids, "Bad boss region")
        for reward in boss["guaranteed_rewards"]:
            if reward["type"] == "item":
                check(reward["item_id"] in item_ids and reward["quantity"] > 0, "Bad boss item")
            elif reward["type"] == "regional_set_choice":
                check(reward["set_id"] in sets, "Bad boss set")
            else:
                check(reward["type"] == "cosmetic_unlock", "Unknown boss reward type")
    catalog = build_catalog(world)
    check(len(catalog) == 88 and len({e["id"] for e in catalog}) == 88, "Bad compiled catalog count")
    check(all(e["stats"]["hp"] > 0 and e["xp_each"] >= 0 for e in catalog), "Invalid enemy stats/reward")
    check(all(a < b for a, b in zip(RULES["xp_thresholds"], RULES["xp_thresholds"][1:])), "Nonmonotonic XP")
    print(f"Catalog: {len(world['regions'])} regions, 72 ordinary rank variants, 6 rares, 10 bosses")
    print(f"Items: {len(item_ids)} including 18 unique pieces in 6 regional sets")
    print("Main-route XP budget (per hero, no side quests or rare hunts):")
    cumulative = 0
    for tier, budget in enumerate(RULES["regions"], 1):
        actual_boss_xp = sum(RULES["boss_xp_each"][boss["id"]] for boss in world["bosses"]
                            if boss["region_id"] == budget["region_id"] and not boss["optional"])
        check(actual_boss_xp == budget["boss_xp_each_total"], "Boss budget mismatch")
        check(sum(b["gold_party"] for b in world["bosses"]
                  if b["region_id"] == budget["region_id"] and not b["optional"])
              == budget["boss_gold_party_total"], "Boss gold mismatch")
        cumulative += budget["ordinary_battles_budget"] * budget["normal_xp_each"] + actual_boss_xp
        level = level_for_xp(cumulative)
        check(level == budget["exit_level_target"], "Main-route level misses target")
        check(xp_required(level) <= cumulative, "XP threshold unreachable")
        print(f"  {budget['region_id']}: {cumulative:6d} XP -> level {level}")
        # A budget-envelope check, not a battle simulator or boss-win claim.
        stats = [hero_stats(h, level, tier) for h in RULES["heroes"]]
        check(all(s["hp"] > 0 and 1 <= s["hits"] <= 4 for s in stats), "Invalid hero growth")
        income = budget["ordinary_battles_budget"] * budget["normal_gold_party"]
        full_shop_upgrade = sum(i["gold_price"] for i in ITEMS["items"]
                                if i.get("region_id") == budget["region_id"]
                                and i.get("kind") == "equipment" and not i.get("set_id")
                                and i["slot"] in ("weapon", "body"))
        supporting_slots = 4 * sum(i["gold_price"] for i in ITEMS["items"]
                                   if i.get("region_id") == budget["region_id"]
                                   and i.get("kind") == "equipment" and not i.get("set_id")
                                   and i["slot"] in ("head", "mantle", "charm"))
        if tier > 1:  # Tier-one gear is supplied at the start, not bought again.
            check(income > full_shop_upgrade + supporting_slots,
                  "Baseline gear needs its own boss reward or rare-drop sales")
    p = RULES["loot"]["natural_opportunity_chance"]
    cap = RULES["loot"]["tracked_hunt_after_wins"]
    mean = sum((1 - p) ** n for n in range(cap))
    print(f"Rare opportunity: natural {p:.0%}; tracked after {cap} eligible wins")
    print(f"Analytical mean to opportunity: {mean:.3f} wins; cap route {(1-p)**(cap-1):.2%}")
    print("Completion after cache + boss stamp: one successful rare hunt; no duplicate roll")
    print("PASS: content references, XP planning budgets, baseline gear affordability, and loot math")
    print("Not verified here: boss victory rates, AI, encounter duration, maps, rendering, or in-game saves.")
    if export:
        output = Path(export)
        output.write_text(json.dumps({"schemaVersion": 1, "enemies": catalog}, indent=2) + "\n")
        print(f"Exported fixed enemy stats: {output}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--export", type=Path)
    args = parser.parse_args()
    audit(args.export)
