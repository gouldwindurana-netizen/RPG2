"""Apply presentation-only polish to the completed growth build."""
from pathlib import Path
import hashlib
import importlib.util
import json
import re
import subprocess

root = Path(__file__).resolve().parents[1]
baseline = root / 'visual-baseline.html'
target = root / 'The_Road_Beyond_the_Bells.html'
receipt = root / 'visual-manifest.json'
expected = 'a5815160ceae4d9c87fae186dd1f642614c4eb7b55ff821638cbc6abc54fd23d'
raw = baseline.read_bytes()
assert hashlib.sha256(raw).hexdigest() == expected, 'Visual baseline changed.'
allowed = {expected}
if receipt.exists():
    prior = json.loads(receipt.read_text())
    if prior.get('baseline_sha256') == expected:
        allowed.add(prior.get('working_sha256'))
assert hashlib.sha256(target.read_bytes()).hexdigest() in allowed, 'Port later edits before rebuilding.'

original = raw.decode('utf-8')
source = original
modules = ['visual_world', 'visual_battle', 'visual_ui']
labels, hashes = [], {}
for name in modules:
    path = root / 'tools' / (name + '.py')
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    source, changes = module.patch(source)
    labels.extend(changes)
    hashes[name] = hashlib.sha256(path.read_bytes()).hexdigest()

def game_model(text):
    return text[text.index('var l={schemaVersion'):text.index('var De=new Set')]

assert game_model(source) == game_model(original), 'Presentation changes must not alter gameplay data, engine or save rules.'
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
    'module_sha256': hashes,
    'changes': labels,
    'gameplay_model_unchanged': True,
    'gameplay_model_sha256': hashlib.sha256(game_model(source).encode()).hexdigest(),
    'gameplay_model_bytes': len(game_model(source).encode()),
    'preserved': [
        'Usage-based growth, regional skill shops, MP and all-member jobs',
        'Repeatable regional rares, equipment drops and ownership rules',
        'Story, travel, dungeon floors, difficulty and saved journeys',
        'Original sprites, offline delivery and third-party notices'
    ],
    'pushed': False,
    'published': False,
}
receipt.write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps({'bytes': len(result), 'sha256': manifest['working_sha256'], 'patches': len(labels), 'gameplay_unchanged': True}, indent=2))
