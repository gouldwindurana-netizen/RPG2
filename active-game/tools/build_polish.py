"""Apply verified fixes to the exact uploaded-game dungeon snapshot.

Never rebuild the separately maintained TypeScript implementation over this game.
Refuse to overwrite an active file changed since the previous assembled output.
"""
from pathlib import Path
import hashlib
import importlib.util
import json
import re
import subprocess

root = Path(__file__).resolve().parents[1]
baseline = root / 'polish-baseline.html'
target = root / 'The_Road_Beyond_the_Bells.html'
expected = '57484856a698facf70e6ef98bf41731588f6f89658af88a3365c19c61f7cc2bb'
raw = baseline.read_bytes()
assert hashlib.sha256(raw).hexdigest() == expected, 'Polish baseline changed.'
manifest_file = root / 'polish-manifest.json'
allowed = {expected}
if manifest_file.exists():
    previous = json.loads(manifest_file.read_text())
    if previous.get('baseline_sha256') == expected:
        allowed.add(previous.get('working_sha256'))
assert hashlib.sha256(target.read_bytes()).hexdigest() in allowed, 'Active game has later edits; port them before assembling.'

source = raw.decode('utf-8')
changes = []
modules = ['polish_combat', 'polish_save', 'polish_ui', 'difficulty_merge']
module_hashes = {}
for name in modules:
    module_path = root / 'tools' / (name + '.py')
    spec = importlib.util.spec_from_file_location(name, module_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    source, labels = module.patch(source)
    changes.extend(labels)
    module_hashes[name] = hashlib.sha256(module_path.read_bytes()).hexdigest()

scripts = re.findall(r'<script\b[^>]*>([\s\S]*?)</script\s*>', source)
assert scripts, 'Missing embedded script.'
for script in scripts:
    subprocess.run(['node', '--check', '--input-type=module'], input=script, text=True, check=True)
result = source.encode('utf-8')
target.write_bytes(result)
manifest = {
    'baseline_file': baseline.name, 'baseline_sha256': expected,
    'working_file': target.name, 'working_sha256': hashlib.sha256(result).hexdigest(),
    'working_bytes': len(result), 'modules': modules, 'module_sha256': module_hashes,
    'merged_upload': 'difficulty-upload.html',
    'merged_upload_sha256': 'cbb83307ef4e82b2c57f3416457d3633b4789b2a674b022ed7792f21fd147487',
    'changes': changes,
    'preserved': ['Uploaded customization and all five equipment slots',
                  'Owned copies, per-hero EXP, learned spells and version-3 saves',
                  'Story outcomes, 33 dungeon floors and ten exterior destinations',
                  'Slower earnings, original art and third-party notices'],
    'delivery': 'Local active game; packaging and validation recorded after checks',
    'published': False, 'pushed': False,
}
manifest_file.write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps({'bytes': len(result), 'sha256': manifest['working_sha256'], 'changes': len(changes)}, indent=2))
