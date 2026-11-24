"""Build the camp-at-dusk title and travel-ledger menu on the current game."""
from pathlib import Path
import hashlib
import importlib.util
import json
import re
import subprocess

root = Path(__file__).resolve().parents[1]
baseline = root / 'camp-menu-baseline.html'
target = root / 'The_Road_Beyond_the_Bells.html'
receipt = root / 'camp-menu-manifest.json'
expected = '2d33e151dc0fc08ab4e4f9f39e6586f18d2a3216ff011c9b35d68b2c17ea555b'
raw = baseline.read_bytes()
assert hashlib.sha256(raw).hexdigest() == expected, 'Camp menu baseline changed.'
allowed = {expected}
if receipt.exists():
    previous = json.loads(receipt.read_text())
    if previous.get('baseline_sha256') == expected:
        allowed.add(previous.get('working_sha256'))
assert hashlib.sha256(target.read_bytes()).hexdigest() in allowed, 'Port later edits before rebuilding.'
original = raw.decode('utf-8')
source = original
modules = ['camp_title', 'camp_ledger']
changes, hashes = [], {}
for name in modules:
    path = root / 'tools' / (name + '.py')
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    source, labels = module.patch(source)
    changes.extend(labels)
    hashes[name] = hashlib.sha256(path.read_bytes()).hexdigest()

def game_model(text):
    return text[text.index('var l={schemaVersion'):text.index('var De=new Set')]

assert game_model(original) == game_model(source), 'Menu redesign must preserve all gameplay and save code.'
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
    'gameplay_model_unchanged': True,
    'gameplay_model_sha256': hashlib.sha256(game_model(source).encode()).hexdigest(),
    'gameplay_model_bytes': len(game_model(source).encode()),
    'preserved': [
        'Existing journeys, growth, MP, skills, jobs and equipment ownership',
        'Regional rare drops, shop interiors, optional NPC movement and travel',
        'Original party identities, story, world art and battle behavior',
        'Offline delivery and third-party notices'
    ],
    'pushed': False,
    'published': False,
}
receipt.write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps({'bytes': len(result), 'sha256': manifest['working_sha256'], 'patches': len(changes), 'gameplay_unchanged': True}, indent=2))
