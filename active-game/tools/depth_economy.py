"""Lower future battle earnings without rewriting existing saved resources."""


def patch(source):
    labels = []

    def once(old, new, label):
        nonlocal source
        count = source.count(old)
        if count != 1:
            raise AssertionError(f'{label}: expected one anchor, found {count}')
        source = source.replace(old, new, 1)
        labels.append(label)

    helpers = r'''// Future rewards support deliberate preparation and repeatable regional training.
var rewardPacing={normal:{xp:.5,gold:.65},boss:{xp:.65,gold:.75},rare:{xp:.65,gold:.75}};
function progressionReward(value,kind,resource){if(!Number.isFinite(value)||value<=0)return 0;return Math.max(1,Math.floor(value*(rewardPacing[kind]?.[resource]??1)))}
'''
    once('function encounterUnit(member,index){', helpers + 'function encounterUnit(member,index){',
         'declare future reward pacing without migrating saved EXP or gold')
    once('enemy.rewardXp=Math.max(1,Math.round(se[region]*2*weight)),enemy.rewardGold=Math.max(1,Math.round(ce[region]/2*weight))',
         'enemy.rewardXp=progressionReward(Math.round(se[region]*2*weight),`normal`,`xp`),enemy.rewardGold=progressionReward(Math.round(ce[region]/2*weight),`normal`,`gold`)',
         'reduce each new regular enemy contribution once')
    once('r!==`normal`&&encounterAllocate(i,u*4,gold)',
         'r!==`normal`&&encounterAllocate(i,progressionReward(u*4,r,`xp`),progressionReward(gold,r,`gold`))',
         'reduce authored boss and rare budgets before allocating among voices')
    once('xp_policy:`Sum defeated enemy EXP once, divide by living heroes and round down. Fallen heroes earn none. Gold is pooled. Authored boss and rare totals are allocated among their units. No EXP or gold on flee/defeat.`',
         'xp_policy:`Future regular enemy EXP is 50% and gold 65% of the preceding regional budgets. Boss and rare budgets retain 65% EXP and 75% gold. Sum defeated contributions once, divide EXP among living heroes and round down; fallen heroes earn none. Gold is pooled. No EXP or gold on flee/defeat. Existing saved progress is unchanged.`',
         'document slower future earnings and unchanged saved progress')
    return source, labels
