"""Assemble optional expedition goals on the selected merged difficulty game."""
from pathlib import Path
import hashlib
import importlib.util
import json
import re
import subprocess

root = Path(__file__).resolve().parents[1]
baseline = root / 'engagement-baseline.html'
target = root / 'The_Road_Beyond_the_Bells.html'
expected = '7ea381bba54c2d5feb260ed2f0a3dd1034d9287d9da85a4ccf305c53bf778895'
raw = baseline.read_bytes()
assert hashlib.sha256(raw).hexdigest() == expected, 'Engagement baseline changed.'
manifest_file = root / 'engagement-manifest.json'
allowed = {expected}
if manifest_file.exists():
    previous = json.loads(manifest_file.read_text())
    if previous.get('baseline_sha256') == expected:
        allowed.add(previous.get('working_sha256'))
assert hashlib.sha256(target.read_bytes()).hexdigest() in allowed, 'Preserve later active-game edits before rebuilding.'
source = raw.decode('utf-8')
labels = []
modules = ['engagement_engine', 'engagement_camp', 'engagement_ui', 'engagement_render']
module_hashes = {}
for name in modules:
    p = root / 'tools' / (name + '.py')
    spec = importlib.util.spec_from_file_location(name, p)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    source, changes = module.patch(source)
    labels.extend(changes)
    module_hashes[name] = hashlib.sha256(p.read_bytes()).hexdigest()
scripts = re.findall(r'<script\b[^>]*>([\s\S]*?)</script\s*>', source)
assert scripts
for script in scripts:
    subprocess.run(['node', '--check', '--input-type=module'], input=script, text=True, check=True)
result = source.encode('utf-8')
target.write_bytes(result)
manifest = {
    'baseline_file': baseline.name, 'baseline_sha256': expected,
    'working_file': target.name, 'working_sha256': hashlib.sha256(result).hexdigest(),
    'working_bytes': len(result), 'modules': modules, 'module_sha256': module_hashes,
    'changes': labels,
    'features': ['Regional optional commissions', 'Discovered bestiary', 'Shelter conversations', 'Town notice boards'],
    'preserved': ['Uploaded difficulty modes, equipment buffs, identities and spell growth',
                  'Saved EXP, gold, learned spells, equipment copies and story outcomes',
                  '33 dungeon floors, ten world destinations and slower earnings',
                  'Original art, offline packaging and third-party notices'],
    'published': False, 'pushed': False,
}
manifest_file.write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps({'bytes': len(result), 'sha256': manifest['working_sha256'], 'patches': len(labels)}, indent=2))
