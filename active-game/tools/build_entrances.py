"""Align real building thresholds and Reedbank's western town exit."""
from pathlib import Path
import hashlib
import importlib.util
import json
import re
import subprocess

root = Path(__file__).resolve().parents[1]
baseline = root / 'entrances-baseline.html'
target = root / 'The_Road_Beyond_the_Bells.html'
receipt = root / 'entrances-manifest.json'
expected = 'c6ba59e2cfd83388a87e01011901718060b4da83332c35f0740dfa36038d34d1'
raw = baseline.read_bytes()
assert hashlib.sha256(raw).hexdigest() == expected, 'Entrance baseline changed.'
allowed = {expected}
if receipt.exists():
    previous = json.loads(receipt.read_text())
    if previous.get('baseline_sha256') == expected:
        allowed.add(previous.get('working_sha256'))
assert hashlib.sha256(target.read_bytes()).hexdigest() in allowed, 'Port later edits before rebuilding.'
original = raw.decode('utf-8')
source = original
modules = ['entrances_world', 'entrances_render']
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

for label, start, end in [
    ('hero stats', 'function be0(', 'function xe('),
    ('encounters and rewards', 'function j(e){a.encounterSteps=0;', 'function P(){'),
]:
    assert block(original, start, end) == block(source, start, end), f'{label} changed outside entrance scope.'
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
        'Saved journeys, progression, story switches and existing merchant services',
        'Ten canonical exterior world sites and their overworld approaches',
        'Growth, MP/jobs, equipment ownership and regional rare drops',
        'Optional NPC motion, camp menu, moon fix and travel ledger',
        'Offline delivery and third-party notices'
    ],
    'pushed': False,
    'published': False,
}
receipt.write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps({'bytes': len(result), 'sha256': manifest['working_sha256'], 'patches': len(changes), 'protected_combat_and_stats_unchanged': True}, indent=2))
