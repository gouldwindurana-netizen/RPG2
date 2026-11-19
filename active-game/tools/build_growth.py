"""Polish the selected growth upload without replaying earlier game generators."""
from pathlib import Path
import hashlib
import importlib.util
import json
import re
import subprocess

root = Path(__file__).resolve().parents[1]
baseline = root / 'growth-baseline.html'
target = root / 'The_Road_Beyond_the_Bells.html'
manifest_file = root / 'growth-manifest.json'
expected = '60a22efc7e72b71024057eef913e8527cad316a63c99682e6b541779bb17ad14'
raw = baseline.read_bytes()
assert hashlib.sha256(raw).hexdigest() == expected, 'Growth upload changed.'
allowed = {expected}
if manifest_file.exists():
    previous = json.loads(manifest_file.read_text())
    if previous.get('baseline_sha256') == expected:
        allowed.add(previous.get('working_sha256'))
assert hashlib.sha256(target.read_bytes()).hexdigest() in allowed, 'Port later edits before rebuilding.'
source = raw.decode('utf-8')
modules = ['growth_stability', 'growth_rares', 'growth_presentation']
hashes, changes = {}, []
for name in modules:
    path = root / 'tools' / (name + '.py')
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    source, labels = module.patch(source)
    changes.extend(labels)
    hashes[name] = hashlib.sha256(path.read_bytes()).hexdigest()
scripts = re.findall(r'<script\b[^>]*>([\s\S]*?)</script\s*>', source)
assert scripts, 'Missing game script.'
for script in scripts:
    subprocess.run(['node', '--check', '--input-type=module'], input=script, text=True, check=True)
result = source.encode('utf-8')
target.write_bytes(result)
manifest = {
    'baseline_file': baseline.name,
    'baseline_sha256': expected,
    'baseline_upload': 'The Road Beyond the Bells (growth build).html',
    'working_file': target.name,
    'working_sha256': hashlib.sha256(result).hexdigest(),
    'working_bytes': len(result),
    'modules': modules,
    'module_sha256': hashes,
    'changes': changes,
    'preserved': [
        'Uploaded usage-based growth and regional skill-store distribution',
        'MP, party jobs, skill practice, difficulty, equipment-copy ownership and existing saves',
        'Story, 33 dungeon floors, travel, commissions, inventory/shop controls and original artwork',
        'Offline standalone delivery and third-party notices'
    ],
    'pushed': False,
    'published': False,
}
manifest_file.write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps({'bytes': len(result), 'sha256': manifest['working_sha256'], 'patches': len(changes)}, indent=2))
