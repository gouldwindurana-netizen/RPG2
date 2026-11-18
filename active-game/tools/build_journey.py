"""Add planning and exploration tools to the current selected standalone game."""
from pathlib import Path
import hashlib
import importlib.util
import json
import re
import subprocess

root = Path(__file__).resolve().parents[1]
baseline = root / 'journey-baseline.html'
target = root / 'The_Road_Beyond_the_Bells.html'
expected = 'b75e5b8b788b10ce0869ba07d2a78c0b8ebfcc91f0ef975d255d112f0ba2b0a6'
raw = baseline.read_bytes()
assert hashlib.sha256(raw).hexdigest() == expected, 'Journey baseline changed.'
manifest_file = root / 'journey-manifest.json'
allowed = {expected}
if manifest_file.exists():
    prior = json.loads(manifest_file.read_text())
    if prior.get('baseline_sha256') == expected:
        allowed.add(prior.get('working_sha256'))
assert hashlib.sha256(target.read_bytes()).hexdigest() in allowed, 'Preserve later active-game edits before rebuilding.'

source = raw.decode('utf-8')
labels = []
modules = ['journey_tactics', 'journey_tracker', 'journey_map']
module_hashes = {}
for name in modules:
    module_path = root / 'tools' / (name + '.py')
    spec = importlib.util.spec_from_file_location(name, module_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    source, changes = module.patch(source)
    labels.extend(changes)
    module_hashes[name] = hashlib.sha256(module_path.read_bytes()).hexdigest()
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
    'features': ['Discovered tactical notes', 'Available battle supplies and valid targeting',
                 'Optional tracked commissions', 'Current-floor discovery checklist'],
    'preserved': ['Uploaded difficulty, spell practice, equipment and save compatibility',
                  'Turn planning, rewards, RNG, encounter layouts and main story',
                  '33 floors, commissions, discovered bestiary and camp conversations',
                  'Offline original artwork and third-party notices'],
    'published': False, 'pushed': False,
}
manifest_file.write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps({'bytes': len(result), 'sha256': manifest['working_sha256'], 'patches': len(labels)}, indent=2))
