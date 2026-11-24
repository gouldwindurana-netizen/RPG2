"""Add walk-in shops and optional town movement to the polished visual build."""
from pathlib import Path
import hashlib
import importlib.util
import json
import re
import subprocess

root = Path(__file__).resolve().parents[1]
baseline = root / 'settlement-baseline.html'
target = root / 'The_Road_Beyond_the_Bells.html'
receipt = root / 'settlement-manifest.json'
expected = 'c566c3d5c2a7eee911ce7a449d50fb9203f8298ee12f3b698eca1c1f20519218'
raw = baseline.read_bytes()
assert hashlib.sha256(raw).hexdigest() == expected, 'Settlement baseline changed.'
allowed = {expected}
if receipt.exists():
    previous = json.loads(receipt.read_text())
    if previous.get('baseline_sha256') == expected:
        allowed.add(previous.get('working_sha256'))
assert hashlib.sha256(target.read_bytes()).hexdigest() in allowed, 'Port later edits before rebuilding.'
original = raw.decode('utf-8')
source = original
modules = ['settlement_shops', 'settlement_npcs', 'settlement_soften', 'settlement_menu']
changes, hashes = [], {}
for name in modules:
    path = root / 'tools' / (name + '.py')
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    source, labels = module.patch(source)
    changes.extend(labels)
    hashes[name] = hashlib.sha256(path.read_bytes()).hexdigest()

def block(text, start, end):
    offset = text.index(start)
    return text[offset:text.index(end, offset)]

protected = {
    'hero_base_stats': ('function be0(', 'function xe('),
    'encounter_creation_and_rewards': ('function j(e){a.encounterSteps=0;', 'function P(){'),
}
for name, (start, end) in protected.items():
    assert block(original, start, end) == block(source, start, end), f'{name} changed outside town/presentation scope.'
scripts = re.findall(r'<script\b[^>]*>([\s\S]*?)</script\s*>', source)
assert scripts, 'Missing embedded script.'
for script in scripts:
    subprocess.run(['node', '--check', '--input-type=module'], input=script, text=True, check=True)
result = source.encode('utf-8')
target.write_bytes(result)
manifest = {
    'baseline_file': baseline.name,
    'baseline_sha256': expected,
    'working_file': target.name,
    'working_sha256': hashlib.sha256(result).hexdigest(),
    'working_bytes': len(result),
    'modules': modules,
    'module_sha256': hashes,
    'changes': changes,
    'protected_combat_and_stats_unchanged': True,
    'preserved': [
        'Growth upload, MP, party jobs, skill practice, difficulty and saved journeys',
        'Regional encounters, rare equipment drops, copy accounting and shop economy',
        'Original story, dungeon floors, canonical world sites and paired travel',
        'Completed title, UI, world and battle visual polish',
        'Offline delivery and third-party notices'
    ],
    'pushed': False,
    'published': False,
}
receipt.write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps({'bytes': len(result), 'sha256': manifest['working_sha256'], 'patches': len(changes), 'protected_combat_and_stats_unchanged': True}, indent=2))
