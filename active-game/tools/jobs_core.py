"""MP resources, persistent party jobs and compatible skill learning.

Legacy charge arrays remain derived compatibility metadata only. The active
resource is MP, including for martial techniques, field recovery and supplies.
"""

HELPERS = r'''function H(hero,skill){return!!hero&&!!skill&&!!V(hero.job)&&(Array.isArray(skill.jobs)?skill.jobs.includes(hero.job):V(hero.job).spellIds.includes(skill.id))}
var spellPrices=[35,100,250,500,900,1500,2400,3500];
function maxMana(job,level){let rule={warden:[12,2],striker:[12,2],scout:[14,2],spellblade:[16,3],mender:[20,4],arcanist:[18,5]}[job];return rule?Math.min(999,rule[0]+rule[1]*(Math.max(1,Math.min(50,level))-1)):0}
function skillCost(skill){return Math.max(1,Math.floor(skill?.mpCost??((skill?.tier??1)*4)))}
function skillUnlocked(hero,skill){return!!hero&&!!skill&&hero.level>=(skill.levelRequired??l.spell_tier_unlocks[(skill.tier??1)-1]??1)}
function hasLearnedSkill(state,hero,skill){return!!hero&&!!skill&&Array.isArray(state.learnedSpells?.[hero.id])&&state.learnedSpells[hero.id].includes(skill.id)}
function knowsSpell(state,hero,skill){return H(hero,skill)&&skillUnlocked(hero,skill)&&hasLearnedSkill(state,hero,skill)}
function canUseSkill(state,hero,skill){return knowsSpell(state,hero,skill)&&hero.hp>0&&hero.status!==`sleep`&&(skill.kind===`technique`||hero.status!==`silence`)&&Number.isFinite(hero.mp)&&hero.mp>=skillCost(skill)}
function starterSkillIds(job){let result=job===`mender`?[`mend`]:job===`arcanist`?[`ember`]:job===`spellblade`?[`mend`,`ember`]:[],technique=te.find(skill=>skill.kind===`technique`&&H({job},skill)&&(skill.levelRequired??1)===1);if(technique)result.push(technique.id);return result}
function partyJobsFor(profile,value,strict=!1){let defaults=Object.fromEntries(ne.map(id=>[id,ve(id,profile)]));if(value===void 0||value===null)return defaults;if(!Se(value)||Object.keys(value).length!==ne.length||!ne.every(id=>Object.hasOwn(value,id)&&typeof value[id]===`string`&&!!V(value[id])))return strict?null:defaults;return Object.fromEntries(ne.map(id=>[id,value[id]]))}
function starterSpellLists(profile,jobs){let party=partyJobsFor(profile,jobs);return Object.fromEntries(ne.map(id=>[id,starterSkillIds(party[id])]))}
function skillOffers(state,heroId){let hero=state.heroes.find(candidate=>candidate.id===heroId);return hero?te.filter(skill=>H(hero,skill)).map(skill=>({skillId:skill.id,spellId:skill.id,price:skill.price??spellPrices[(skill.tier??1)-1],known:hasLearnedSkill(state,hero,skill),unlocked:skillUnlocked(hero,skill)})):[]}
function spellOffers(state,heroId){return skillOffers(state,heroId)}
function legacyMana(saved,hero){let remaining=0,maximum=0,weights=[4,8,12,16,22,28,34,40];for(let tier=0;tier<8;tier++){remaining+=(saved.charges?.[tier]??0)*weights[tier];maximum+=(hero.maxCharges[tier]??0)*weights[tier]}return maximum?Math.min(hero.maxMp,Math.ceil(hero.maxMp*remaining/maximum)):hero.maxMp}
function canChangeJobs(state){return state?.mode===`explore`&&!state.battle&&!state.message&&!state.reward&&!state.messageQueue?.length&&p(state.area,state.player.x,state.player.y)}
function jobChangePreview(state,heroId,jobId){let current=state.heroes.find(hero=>hero.id===heroId),job=V(jobId);if(!current||!job)return null;let equipment={},changes=[];for(let slot of ie){let worn=K(current.equipment[slot]),next=worn&&U({job:jobId},worn)?worn.id:null;if(!next){let candidates=ee.filter(item=>item.kind===`equipment`&&item.slot===slot&&U({job:jobId},item)&&eqAvailable(state,item.id,heroId)>0).sort((left,right)=>eqSum(right)-eqSum(left));next=candidates[0]?.id??null}equipment[slot]=next;if((current.equipment[slot]??null)!==next)changes.push({slot,from:current.equipment[slot]??null,to:next})}let derived=be(heroId,current.level,equipment,state.profile,jobId),stats=Object.fromEntries([`maxHp`,`attack`,`defense`,`magicDefense`,`magic`,`accuracy`,`hits`,`maxMp`].map(key=>[key,derived[key]])),same=current.job===jobId;return{heroId,jobId,jobName:job.name,available:canChangeJobs(state)&&!same,reason:same?`This traveler already follows this job.`:canChangeJobs(state)?``:`Change jobs at a safe shelter after the current action is finished.`,stats,hp:Math.min(current.hp,derived.maxHp),mp:Math.min(current.mp,derived.maxMp),equipment,changes,starterSkills:starterSkillIds(jobId)}}
'''

CHANGE_JOB = r'''changeJob(heroId,jobId){let preview=jobChangePreview(a,heroId,jobId);if(!preview?.available)return!1;let index=a.heroes.findIndex(hero=>hero.id===heroId),old=a.heroes[index],hero=be(heroId,old.level,preview.equipment,a.profile,jobId);hero.hp=preview.hp;hero.mp=preview.mp;hero.status=old.status;a.partyJobs[heroId]=jobId;if(heroId===`Mara`)a.profile.job=jobId;a.heroes[index]=hero;for(let id of starterSkillIds(jobId))if(!a.learnedSpells[heroId].includes(id))a.learnedSpells[heroId].push(id);l();z.save();return!0},'''


def patch(source):
    labels = []

    def once(old, new, label):
        nonlocal source
        count = source.count(old)
        assert count == 1, f'{label}: expected one source anchor, got {count}'
        source = source.replace(old, new, 1)
        labels.append(label)

    def block(start, end, replacement, label):
        a = source.index(start)
        b = source.index(end, a)
        once(source[a:b], replacement, label)

    block('function H(e,t){', 'function shopAccepts(state,item){', HELPERS,
          'shared MP job skill and history helpers')
    once('speaker===`Magic Shop`?!1:', 'speaker===`Skill Shop`||speaker===`Magic Shop`?!1:',
         'skill merchants cannot buy or sell physical inventory')
    once('function ye(e,t){let n=V(ve(e,t)).starterSourceHero.toUpperCase();',
         'function ye(e,t,jobOverride){let n=V(jobOverride??ve(e,t)).starterSourceHero.toUpperCase();',
         'starter loadouts follow optional companion job choices')
    once('function be(e,t,n,r){let i=ve(e,r),',
         'function be(e,t,n,r,jobOverride){let i=jobOverride??ve(e,r),',
         'derive every hero from the chosen party job')
    once('level:t,hp:u,maxHp:u,attack:',
         'level:t,hp:u,maxHp:u,mp:maxMana(i,t),maxMp:maxMana(i,t),attack:',
         'all jobs receive their own growing MP pool')
    once('function xe(e,t=R){let n={...l.starting_loadout.supplies};for(let e of ne)for(let r of Object.values(ye(e,t)))n[r]=(n[r]??0)+1;return{version:3,',
         'function xe(e,t=R,jobs){let party=partyJobsFor(t,jobs);t={...t,job:party.Mara};let n={...l.starting_loadout.supplies};for(let e of ne)for(let r of Object.values(ye(e,t,party[e])))n[r]=(n[r]??0)+1;return{version:4,partyJobs:party,',
         'version-four expeditions support all four starting jobs')
    once('heroes:ne.map(e=>be(e,1,ye(e,t),t)),learnedSpells:starterSpellLists(t),',
         'heroes:ne.map(e=>be(e,1,ye(e,t,party[e]),t,party[e])),learnedSpells:starterSpellLists(t,party),',
         'new heroes receive compatible gear and one basic job skill')
    once('![1,2,3].includes(n.version)',
         '(![1,2,3,4].includes(n.version)||n.version===4&&!Object.hasOwn(n,`learnedSpells`))',
         'accept legacy saves and require earned skill history in MP saves')
    once('let r=n.version!==3;', 'let r=n.version<3;',
         'retain version-three campaign data when importing MP saves')
    once('if(!s)return null;let c=xe(t,s);',
         'if(!s)return null;let savedJobs=n.version===4?partyJobsFor(s,n.partyJobs,!0):partyJobsFor(s);if(!savedJobs||n.version===4&&(!Se(n.partyJobs)||savedJobs.Mara!==s.job))return null;let c=xe(t,s,savedJobs);',
         'validate saved party jobs before deriving heroes')
    once('let i=n.equipment[t],a=typeof i==`string`?K(i):null;if(!a||a.kind!==`equipment`||a.slot!==t||!U({job:ve(e,s)},a)',
         'let i=n.equipment[t];if(n.version===4&&i===null){r[t]=null;continue}let a=typeof i==`string`?K(i):null;if(!a||a.kind!==`equipment`||a.slot!==t||!U({job:c.partyJobs[e]},a)',
         'MP saves permit empty gear slots and enforce each chosen job')
    once('let i=be(e,ge(c.hx[e]),r,s);if(!Ce(n.hp,0,i.maxHp)||!Array.isArray(n.charges)||n.charges.length!==8||!n.charges.every((e,t)=>Ce(e,0,i.maxCharges[t]))||n.status!==null&&![`poison`,`sleep`,`silence`].includes(String(n.status)))throw Error(`Invalid resources`);return{...i,hp:n.hp,charges:[...n.charges],status:n.status}',
         'let i=be(e,ge(c.hx[e]),r,s,c.partyJobs[e]);if(!Ce(n.hp,0,i.maxHp)||(n.version===4?!Ce(n.mp,0,i.maxMp):!Array.isArray(n.charges)||n.charges.length!==8||!n.charges.every((e,t)=>Ce(e,0,i.maxCharges[t])))||n.status!==null&&![`poison`,`sleep`,`silence`].includes(String(n.status)))throw Error(`Invalid resources`);return{...i,hp:n.hp,mp:n.version===4?n.mp:legacyMana(n,i),status:n.status}',
         'migrate depleted legacy charges into MP and validate saved MP')
    # The local hero variable shadows the parsed save. Use outer c.version (always4)
    # only for state derivation; format detection is captured separately above.
    once('let l=n.heroes;', 'let mpSave=n.version===4,l=n.heroes;',
         'capture the incoming resource format before per-hero validation')
    once('if(n.version===4&&i===null)', 'if(mpSave&&i===null)',
         'use the incoming format for nullable equipment validation')
    once('(n.version===4?!Ce(n.mp,0,i.maxMp):', '(mpSave?!Ce(n.mp,0,i.maxMp):',
         'use the incoming format for MP resource validation')
    once('mp:n.version===4?n.mp:legacyMana(n,i)', 'mp:mpSave?n.mp:legacyMana(n,i)',
         'convert charge resources only for legacy formats')
    once('te.some(spell=>spell.id===spellId&&H(c.heroes.find(hero=>hero.id===id),spell))',
         'te.some(spell=>spell.id===spellId&&(n.version===4||H(c.heroes.find(hero=>hero.id===id),spell)))',
         'retain purchased skills from earlier jobs in MP saves')
    once('te.filter(spell=>H(hero,spell)&&hero.maxCharges[spell.tier-1]>0).map(spell=>spell.id)]));',
         'te.filter(spell=>spell.kind!==`technique`&&H(hero,spell)&&skillUnlocked(hero,spell)).map(spell=>spell.id)]));for(let hero of c.heroes)for(let id of starterSkillIds(hero.job))if(!c.learnedSpells[hero.id].includes(id))c.learnedSpells[hero.id].push(id);',
         'legacy spellbooks retain unlocked magic and gain the current basic technique')
    once('if(c.message=n.message,!r){',
         'if(c.message=n.message?.speaker===`Magic Shop`?{speaker:`Skill Shop`,text:`Learn job skills and magic without restoring MP.`}:n.message,!r){',
         'resume an older open magic merchant as the skill service')
    once('c.messageQueue=structuredClone(n.messageQueue)',
         'c.messageQueue=structuredClone(n.messageQueue).map(message=>message.speaker===`Magic Shop`?{speaker:`Skill Shop`,text:`Learn job skills and magic without restoring MP.`}:message)',
         'preserve queued dialogue while migrating legacy skill-merchant labels')
    once('function A(){a.heroes=a.heroes.map(t=>{let n=be(t.id,ge(a.hx[t.id]),t.equipment,a.profile);return n.hp=Math.min(n.maxHp,t.hp+(t.hp>0?Math.max(0,n.maxHp-t.maxHp):0)),n.charges=n.maxCharges.map((e,n)=>Math.min(e,t.charges[n]+Math.max(0,e-t.maxCharges[n]))),n.status=t.status,n})}',
         'function A(){a.heroes=a.heroes.map(t=>{let n=be(t.id,ge(a.hx[t.id]),t.equipment,a.profile,a.partyJobs[t.id]);return n.hp=Math.min(n.maxHp,t.hp+(t.hp>0?Math.max(0,n.maxHp-t.maxHp):0)),n.mp=Math.min(n.maxMp,t.mp+(n.level>t.level?Math.max(0,n.maxMp-t.maxMp):0)),n.status=t.status,n})}',
         'level growth adds only new MP capacity and equipment changes never refill it')
    once('for(let e of a.heroes)e.hp=e.maxHp,e.status=null,e.charges=[...e.maxCharges];',
         'for(let e of a.heroes)e.hp=e.maxHp,e.status=null,e.mp=e.maxMp;',
         'shelter recovery restores HP and MP')
    once('for(let e of a.heroes)e.hp=e.maxHp,e.charges=[...e.maxCharges],e.status=null;',
         'for(let e of a.heroes)e.hp=e.maxHp,e.mp=e.maxMp,e.status=null;',
         'defeat recovery restores the new resource model')
    once('buySpell(heroId,spellId){if(a.mode!==`explore`||a.reward||a.message?.speaker!==`Magic Shop`||!p(a.area,a.player.x,a.player.y))return!1;let hero=a.heroes.find(candidate=>candidate.id===heroId),offer=spellOffers(a,heroId).find(candidate=>candidate.spellId===spellId);if(!hero||!offer||offer.known||!offer.unlocked||a.gold<offer.price)return!1;a.learnedSpells[heroId].push(spellId),a.gold-=offer.price,l(),z.save();return!0},',
         'buySkill(heroId,skillId){if(a.mode!==`explore`||a.reward||a.message?.speaker!==`Skill Shop`||!p(a.area,a.player.x,a.player.y))return!1;let hero=a.heroes.find(candidate=>candidate.id===heroId),offer=skillOffers(a,heroId).find(candidate=>candidate.skillId===skillId);if(!hero||!offer||offer.known||!offer.unlocked||a.gold<offer.price)return!1;a.learnedSpells[heroId].push(skillId);a.gold-=offer.price;l();z.save();return!0},buySpell(heroId,skillId){return z.buySkill(heroId,skillId)},'+CHANGE_JOB,
         'skill purchases and safe job changes preserve resources and owned copies')
    once('if(!r||r.hp<=0||r.status===`silence`||!i||!knowsSpell(a,r,i)||r.charges[i.tier-1]<=0||![`heal`,`cure`,`revive`].includes(i.effect??``))return!1;',
         'if(!r||!i||!canUseSkill(a,r,i)||![`heal`,`cure`,`revive`].includes(i.effect??``))return!1;',
         'field recovery obeys current-job learning and MP costs')
    once('r.charges[i.tier-1]--;for(let e of o)I(r,i,e);',
         'r.mp-=skillCost(i);for(let e of o)I(r,i,e);',
         'field skills spend MP once after validating a useful target')
    once('beginAdventure(e){let n=B(e);return n?(o++,s.clear(),a=xe(t,n),a.mode=`intro`,l(),z.save(),!0):!1}',
         'beginAdventure(e,partyJobs){let n=B(e),jobs=n&&partyJobsFor(n,partyJobs,!0);return n&&jobs?(o++,s.clear(),n={...n,job:jobs.Mara},a=xe(t,n,jobs),a.mode=`intro`,l(),z.save(),!0):!1}',
         'creation may choose all companion jobs as well as the lead job')
    once('ue=[`POTION`,`HIGH_POTION`,`MENDING_BALM`,`REVIVAL_SALT`,`ANTIDOTE`,`SOOTHING_DRAUGHT`,`CLEAR_TONIC`]',
         'ue=[`POTION`,`HIGH_POTION`,`MENDING_BALM`,`REVIVAL_SALT`,`ANTIDOTE`,`SOOTHING_DRAUGHT`,`CLEAR_TONIC`,`SPARK_TEA`,`DEEP_TEA`]',
         'MP teas can be planned like other shared battle supplies')
    once('if(itemId===`SPARK_TEA`||itemId===`DEEP_TEA`)return!battle&&Number.isInteger(tier)&&tier>=1&&tier<=(itemId===`SPARK_TEA`?2:4)&&target.charges[tier-1]<target.maxCharges[tier-1];',
         'if(itemId===`SPARK_TEA`||itemId===`DEEP_TEA`)return target.mp<target.maxMp;',
         'MP tea eligibility needs a living traveler with spent MP')
    once('e===`SPARK_TEA`||e===`DEEP_TEA`?t.charges[tier-1]++:',
         'e===`SPARK_TEA`||e===`DEEP_TEA`?t.mp=Math.min(t.maxMp,t.mp+(e===`SPARK_TEA`?20:60)):',
         'existing owned teas restore bounded MP without tier selection')
    once('...Object.entries(de).map(([e,t])=>({itemId:e,price:t})),',
         '...Object.entries(de).map(([e,t])=>({itemId:e,price:t})),...(t>=3?[{itemId:`SPARK_TEA`,price:450}]:[]),',
         'regional item stores offer the existing Spark Tea from region three')
    once('x(`Magic Shop`,`Choose a traveler and learn a spell suited to their job. A learned spell still needs an unlocked tier and a charge. Rest at a safe shelter to restore charges.`)',
         'x(`Skill Shop`,`Choose a traveler and learn a technique or magic suited to their current job. Learning never restores MP. Rest at a safe shelter to recover.`)',
         'existing magic merchants become the common skill service')
    once('Restore one spent tier1-2 spell charge chosen by the player; never exceeds maximum. Sold from R03; not in ordinary drop pool.',
         'Restore 20 MP to one living traveler, up to maximum. Sold from R03; not in the ordinary drop pool.',
         'Spark Tea describes its MP recovery')
    once('Restore one spent tier1-4 charge; scarce fixed chest/optional boss supplies, not a repeatable normal drop.',
         'Restore 60 MP to one living traveler, up to maximum. Scarce expedition supplies; not an ordinary drop.',
         'Deep Tea describes its finite MP recovery')
    return source, labels
