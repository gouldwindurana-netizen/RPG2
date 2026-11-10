"""Behavioral checks for progression, catalog integrity, and fair regional hunts.

Run from the repository root with: python -m unittest discover -s tests -v
"""

import json
from pathlib import Path
import sys
import unittest


class RewardReferenceTests(unittest.TestCase):
    def test_unique_and_fallback_rewards_resolve_to_content(self):
        from tools.rules import ITEMS, RULES, HuntProgress
        item_ids = {item["id"] for item in ITEMS["items"]}
        for region in RULES["regions"]:
            hunt = HuntProgress(region["region_id"])
            self.assertTrue(set(hunt.pieces) <= item_ids)
        entries = RULES["loot"]["bundles"]["supply_bundle"]
        self.assertTrue(entries)
        self.assertTrue(all(e["item_id"] in item_ids and e["quantity"] > 0 for e in entries))

    def test_malformed_saves_cannot_erase_or_duplicate_collection_history(self):
        from tools.rules import HuntProgress
        valid = HuntProgress("R01").to_json()
        for replacement in (dict(valid, acquired=["R02_SET_HEAD"]),
                            dict(valid, acquired=["R01_SET_HEAD", "R01_SET_HEAD"]),
                            dict(valid, wins=12, opportunity=False),
                            dict(valid, wins=-1)):
            with self.subTest(save=replacement), self.assertRaises((ValueError, TypeError)):
                HuntProgress.from_json(replacement)


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from tools.rules import (  # noqa: E402
    HuntProgress,
    build_catalog,
    enemy_stats,
    hero_stats,
    level_for_xp,
    spell_charges,
    xp_required,
)


class ProgressionTests(unittest.TestCase):
    def test_every_xp_threshold_enters_exactly_its_level(self):
        self.assertEqual(xp_required(1), 0)
        previous = -1
        for level in range(1, 51):
            with self.subTest(level=level):
                threshold = xp_required(level)
                self.assertIsInstance(threshold, int)
                self.assertGreater(threshold, previous)
                self.assertEqual(level_for_xp(threshold), level)
                if level > 1:
                    self.assertEqual(level_for_xp(threshold - 1), level - 1)
                previous = threshold

    def test_large_grant_crosses_multiple_levels_and_stops_at_cap(self):
        self.assertEqual(level_for_xp(xp_required(34) + 1), 34)
        self.assertEqual(level_for_xp(10**18), 50)

    def test_invalid_level_and_xp_inputs_are_rejected(self):
        for value in (0, -1, 51, 1.5, "2", None, True):
            with self.subTest(level=value):
                with self.assertRaises((ValueError, TypeError)):
                    xp_required(value)
        for value in (-1, 0.5, "0", None, True):
            with self.subTest(xp=value):
                with self.assertRaises((ValueError, TypeError)):
                    level_for_xp(value)

    def test_spell_tiers_unlock_without_creating_earlier_access(self):
        unlocks = (1, 5, 9, 13, 17, 21, 26, 31)
        for level in range(1, 51):
            charges = spell_charges(level)
            self.assertEqual(len(charges), 8)
            for index, unlock in enumerate(unlocks):
                with self.subTest(level=level, tier=index + 1):
                    self.assertIsInstance(charges[index], int)
                    self.assertGreaterEqual(charges[index], 0)
                    self.assertLessEqual(charges[index], 9)
                    if level < unlock:
                        self.assertEqual(charges[index], 0)
                    else:
                        self.assertGreater(charges[index], 0)

    def test_heroes_grow_and_keep_distinct_roles(self):
        for hero in ("Mara", "Tavin", "Iona", "Soren"):
            first = hero_stats(hero, 1, 1)
            late = hero_stats(hero, 34, 6)
            with self.subTest(hero=hero):
                for key in ("hp", "attack", "defense", "magic", "accuracy", "hits"):
                    self.assertIn(key, first)
                    self.assertGreaterEqual(first[key], 0)
                self.assertGreater(first["hp"], 0)
                self.assertGreater(late["hp"], first["hp"])
                self.assertGreater(late["attack"], first["attack"])
                self.assertGreaterEqual(late["hits"], first["hits"])
        self.assertGreater(hero_stats("Mara", 20, 3)["hp"],
                           hero_stats("Soren", 20, 3)["hp"])
        self.assertGreater(hero_stats("Soren", 20, 3)["magic"],
                           hero_stats("Mara", 20, 3)["magic"])

    def test_stats_reject_unknown_entities_and_out_of_range_inputs(self):
        calls = (
            lambda: hero_stats("Unknown", 1, 1),
            lambda: hero_stats("Mara", 0, 1),
            lambda: hero_stats("Mara", 51, 1),
            lambda: hero_stats("Mara", 1, 0),
            lambda: hero_stats("Mara", 1, 7),
            lambda: enemy_stats(0),
            lambda: enemy_stats(51),
            lambda: enemy_stats(10, role="unknown"),
            lambda: enemy_stats(10, kind="unknown"),
        )
        for index, call in enumerate(calls):
            with self.subTest(case=index):
                with self.assertRaises((ValueError, TypeError)):
                    call()

    def test_enemy_strength_is_fixed_when_the_hero_advances(self):
        original = enemy_stats(8, role="striker", kind="normal")
        hero_stats("Mara", 1, 1)
        hero_stats("Mara", 50, 6)
        self.assertEqual(enemy_stats(8, role="striker", kind="normal"), original)
        self.assertGreater(enemy_stats(20)["hp"], enemy_stats(8)["hp"])


class CatalogTests(unittest.TestCase):
    def test_variants_have_unique_ids_and_keep_named_rares_and_bosses(self):
        world = json.loads((ROOT / "data" / "world.json").read_text())
        original = json.loads(json.dumps(world))
        catalog = build_catalog(world)
        self.assertEqual(len(catalog), 88)
        identifiers = [entry["id"] for entry in catalog]
        self.assertEqual(len(set(identifiers)), 88)
        named = {entry["id"] for entry in world["rares"] + world["bosses"]}
        self.assertTrue(named.issubset(identifiers))
        region_ids = {region["id"] for region in world["regions"]}
        self.assertTrue(all(entry["region_id"] in region_ids for entry in catalog))
        self.assertEqual(world, original, "Building a catalog must not rewrite source content")


class HuntTests(unittest.TestCase):
    HEAD = "R01_SET_HEAD"
    MANTLE = "R01_SET_MANTLE"
    CHARM = "R01_SET_CHARM"

    def setUp(self):
        self.hunt = HuntProgress("R01")

    def unlock(self, count=12):
        for _ in range(count):
            self.hunt.record_win(eligible=True, roll=0.5)

    def assert_unchanged_after_rejection(self, operation):
        before = json.loads(json.dumps(self.hunt.to_json()))
        with self.assertRaises((ValueError, TypeError)):
            operation()
        self.assertEqual(self.hunt.to_json(), before)

    def test_twelfth_eligible_win_guarantees_an_opportunity(self):
        self.unlock(11)
        self.assertEqual(self.hunt.wins, 11)
        self.assertFalse(self.hunt.opportunity)
        self.unlock(1)
        self.assertEqual(self.hunt.wins, 12)
        self.assertTrue(self.hunt.opportunity)
        self.unlock(5)
        self.assertEqual(self.hunt.wins, 12)
        self.assertTrue(self.hunt.opportunity)

    def test_ineligible_wins_neither_advance_nor_trigger_rare_roll(self):
        for _ in range(20):
            self.hunt.record_win(eligible=False, roll=0.0)
        self.assertEqual(self.hunt.wins, 0)
        self.assertFalse(self.hunt.opportunity)

    def test_rare_threshold_is_strict_and_can_unlock_early(self):
        self.hunt.record_win(eligible=True, roll=0.02)
        self.assertFalse(self.hunt.opportunity)
        self.hunt.record_win(eligible=True, roll=0.019999)
        self.assertTrue(self.hunt.opportunity)
        self.assertEqual(self.hunt.wins, 2)

    def test_invalid_roll_does_not_change_progress(self):
        self.unlock(3)
        for value in (-0.01, 1.0, float("nan"), float("inf")):
            with self.subTest(roll=value):
                self.assert_unchanged_after_rejection(
                    lambda: self.hunt.record_win(eligible=True, roll=value))

    def test_save_reload_preserves_partial_and_ready_hunts(self):
        self.hunt.claim("cache", self.HEAD)
        self.unlock(7)
        saved = json.loads(json.dumps(self.hunt.to_json()))
        self.hunt = HuntProgress.from_json(saved)
        self.assertEqual(self.hunt.to_json(), saved)
        self.assertEqual(self.hunt.wins, 7)
        self.unlock(5)
        self.assertTrue(self.hunt.opportunity)
        ready = json.loads(json.dumps(self.hunt.to_json()))
        self.hunt = HuntProgress.from_json(ready)
        self.assertEqual(self.hunt.to_json(), ready)
        self.assertTrue(self.hunt.opportunity)
        self.assertEqual(self.hunt.claim("hunt", self.MANTLE), self.MANTLE)

    def test_cache_and_boss_do_not_reset_an_earned_hunt(self):
        self.unlock()
        self.hunt.claim("cache", self.HEAD)
        self.hunt.claim("boss", self.MANTLE)
        self.assertEqual(self.hunt.wins, 12)
        self.assertTrue(self.hunt.opportunity)

    def test_cache_boss_and_hunt_give_three_different_pieces(self):
        found = {self.hunt.claim("cache", self.HEAD), self.hunt.claim("boss", self.MANTLE)}
        self.unlock()
        found.add(self.hunt.claim("hunt", self.CHARM))
        self.assertEqual(found, {self.HEAD, self.MANTLE, self.CHARM})
        self.assertEqual(self.hunt.acquired, found)

    def test_invalid_or_duplicate_choice_does_not_consume_opportunity(self):
        self.hunt.claim("cache", self.HEAD)
        self.unlock()
        for choice in (self.HEAD, "R02_SET_HEAD", "unknown"):
            with self.subTest(choice=choice):
                self.assert_unchanged_after_rejection(
                    lambda: self.hunt.claim("hunt", choice))
        self.assertEqual(self.hunt.claim("hunt", self.MANTLE), self.MANTLE)
        self.assertEqual(self.hunt.wins, 0)
        self.assertFalse(self.hunt.opportunity)

    def test_one_off_sources_cannot_be_claimed_twice(self):
        self.hunt.claim("cache", self.HEAD)
        self.assert_unchanged_after_rejection(
            lambda: self.hunt.claim("cache", self.MANTLE))
        self.hunt.claim("boss", self.MANTLE)
        self.assert_unchanged_after_rejection(
            lambda: self.hunt.claim("boss", self.CHARM))

    def test_invalid_source_and_unearned_hunt_are_not_consumed(self):
        self.assert_unchanged_after_rejection(
            lambda: self.hunt.claim("unknown", self.HEAD))
        self.assert_unchanged_after_rejection(
            lambda: self.hunt.claim("hunt", self.HEAD))
        self.assertEqual(self.hunt.claim("cache", self.HEAD), self.HEAD)

    def test_completed_set_yields_supplies_and_hunts_remain_repeatable(self):
        self.hunt.claim("cache", self.HEAD)
        self.hunt.claim("boss", self.MANTLE)
        self.unlock()
        self.hunt.claim("hunt", self.CHARM)
        for _ in range(2):
            self.unlock()
            self.assertEqual(self.hunt.claim("hunt", None), "supply_bundle")
            self.assertEqual(self.hunt.wins, 0)
            self.assertFalse(self.hunt.opportunity)
        self.assertEqual(self.hunt.acquired, {self.HEAD, self.MANTLE, self.CHARM})


if __name__ == "__main__":
    unittest.main()
