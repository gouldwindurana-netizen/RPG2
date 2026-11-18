"""Build the unified skill, MP and party-job update on the selected game."""
from pathlib import Path
import hashlib
import importlib.util
import json
import re
import subprocess

root = Path(__file__).resolve().parents[1]
baseline = root / 'jobs-baseline.html'
target = root / 'The_Road_Beyond_the_Bells.html'
expected = '218bee8425ed5a139b697f3e0072068530d187dc03e9fee57f2ee338c212247a'
raw = baseline.read_bytes()
assert hashlib.sha256(raw).hexdigest() == expected, 'Jobs baseline changed.'
manifest_file = root / 'jobs-manifest.json'
allowed = {expected}
if manifest_file.exists():
    prior = json.loads(manifest_file.read_text())
    if prior.get('baseline_sha256') == expected:
        allowed.add(prior.get('working_sha256'))
assert hashlib.sha256(target.read_bytes()).hexdigest() in allowed, 'Port later active-game edits before rebuilding.'
source = raw.decode('utf-8')
labels = []
modules = ['jobs_data', 'jobs_core', 'jobs_combat', 'jobs_ui', 'jobs_inventory', 'jobs_render']
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
assert scripts, 'Missing embedded game script.'
for script in scripts:
    subprocess.run(['node', '--check', '--input-type=module'], input=script, text=True, check=True)
result = source.encode('utf-8')
target.write_bytes(result)
manifest = {
    'baseline_file': baseline.name, 'baseline_sha256': expected,
    'working_file': target.name, 'working_sha256': hashlib.sha256(result).hexdigest(),
    'working_bytes': len(result), 'modules': modules, 'module_sha256': module_hashes,
    'changes': labels,
    'features': ['Unified magical and martial skills', 'Shared MP pool per hero',
                 'Skill Shops', 'Safe-shelter job customization for all four heroes'],
    'save_version': 4,
    'preserved': ['Existing journey, story outcomes, EXP, gold and equipment-copy ownership',
                  'Uploaded difficulty, equipment buffs and skill practice',
                  '33 dungeon floors, commissions, bestiary, camp tales and tracking',
                  'Original artwork, offline packaging and third-party notices'],
    'published': False, 'pushed': False,
}
manifest_file.write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps({'bytes': len(result), 'sha256': manifest['working_sha256'], 'patches': len(labels)}, indent=2))
