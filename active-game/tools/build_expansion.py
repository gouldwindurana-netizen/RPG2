"""Assemble the requested expansion onto the user's current corrected HTML."""
from pathlib import Path
import hashlib,importlib.util,json,re,shutil,subprocess
root=Path(__file__).resolve().parents[1]
target=root/'The_Road_Beyond_the_Bells.html';source=root/'expansion-baseline.html'
expected='2e1a556523d72f3296442884ef4c5919b6a0c921757916f307c8334589e7f5e7'
if not source.exists():
    assert hashlib.sha256(target.read_bytes()).hexdigest()==expected,'Review the latest game before selecting a new baseline.'
    shutil.copyfile(target,source)
raw=source.read_bytes();assert hashlib.sha256(raw).hexdigest()==expected,'Archived expansion baseline changed.'
s=raw.decode('utf-8');changes=[]
for name in ['expansion_world','expansion_encounters','expansion_magic','expansion_renderer','expansion_ui']:
    spec=importlib.util.spec_from_file_location(name,root/'tools'/(name+'.py'))
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    s,labels=module.patch(s);changes.extend(labels)
script=re.search(r'<script\b[^>]*>([\s\S]*?)</script\s*>',s).group(1)
js=Path('/tmp/avel-expansion-check.mjs');js.write_text(script)
subprocess.run(['node','--check',str(js)],check=True)
target.write_bytes(s.encode('utf-8'))
manifest={'baseline_file':source.name,'baseline_sha256':expected,'working_file':target.name,'working_sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'changes':changes,'preserved':['Custom equipment slot UI and copy ownership','Buy/sell quantity controls','Per-hero EXP and survivor sharing','Original main-story outcomes','Ten canonical world-site entries and return positions','Compatible v1/v2/v3 saves and original save key','Original art, branding, and third-party notices']}
(root/'expansion-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({'file':str(target),'bytes':target.stat().st_size,'changes':len(changes)},indent=2))
