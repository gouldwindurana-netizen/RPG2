"""Apply the dungeon and battle-layout update to the selected game snapshot."""
from pathlib import Path
import hashlib
import importlib.util
import json
import re
import subprocess

root = Path(__file__).resolve().parents[1]
baseline = root / 'depth-baseline.html'
target = root / 'The_Road_Beyond_the_Bells.html'
expected = '735a067db6344d66df0e5911a12585fb8a211368d946f604bd8250a17b345293'
raw = baseline.read_bytes()
assert hashlib.sha256(raw).hexdigest() == expected, 'Dungeon update baseline changed.'
previous_manifest = root / 'depth-manifest.json'
allowed_targets = {expected}
if previous_manifest.exists():
    previous = json.loads(previous_manifest.read_text())
    if previous.get('baseline_sha256') == expected:
        allowed_targets.add(previous.get('working_sha256'))
assert hashlib.sha256(target.read_bytes()).hexdigest() in allowed_targets, 'The active game changed outside this patch; preserve those changes before rebuilding.'
source = raw.decode('utf-8')
changes = []
modules = ['depth_dungeons', 'depth_economy', 'depth_battle', 'depth_ui']
for name in modules:
    spec = importlib.util.spec_from_file_location(name, root / 'tools' / (name + '.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    source, labels = module.patch(source)
    changes.extend(labels)
scripts = re.findall(r'<script\b[^>]*>([\s\S]*?)</script\s*>', source)
assert scripts, 'Missing embedded game script.'
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
    'changes': changes,
    'preserved': [
        'Uploaded equipment/status customization and copy accounting',
        'Existing saved EXP, gold, learned spells, and story outcomes',
        'Ten canonical exterior destinations and physical world crossings',
        'Three town services and quantity purchases',
        'Existing original art, save key, and third-party notices',
    ],
}
(root / 'depth-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps({'file': str(target), 'bytes': len(result), 'sha256': manifest['working_sha256'], 'changes': len(changes)}, indent=2))
