"""Quiet party conversations at safe shelters, with optional saved history."""

CAMP_HELPERS = r'''var campTaleCatalog=[
{id:`first-watch`,stage:0,title:`Four pairs of boots`,teaser:`A courier's route begins with the people walking beside him.`,lines:[[`Tavin`,`Four pairs of boots. I used to leave before the others were awake. Faster that way.`],[`hero`,`And when the road washed out?`],[`Tavin`,`I found a longer road. Tonight I can ask three people whether it is a foolish one.`],[`Iona`,`Ask before breakfast. I intend to sleep through the first foolish suggestion.`]]},
{id:`lantern-bench`,stage:2,title:`The lantern bench`,teaser:`The party makes room for a different kind of repair.`,lines:[[`Soren`,`Orren left a lantern fitting on the bench. The repair is neat. His note says he would rather work after breakfast.`],[`Iona`,`Then after breakfast. A skill is not a debt he owes us.`],[`hero`,`I will put the broken lamps in a basket. He can choose which ones to mend.`],[`Tavin`,`Leave an empty place beside the basket. Someone should sit with him without bringing a job.`]]},
{id:`four-bowls`,stage:4,title:`An extra bowl`,teaser:`A kitchen can hold an invitation without demanding an answer.`,lines:[[`Tavin`,`Neri put an extra bowl on the kitchen shelf. I nearly told her where we used to keep it.`],[`Iona`,`Did she ask?`],[`Tavin`,`No. She asked whether I wanted soup. So I said yes.`],[`hero`,`Tomorrow we can carry back the clean bowls. That is an answer we know how to give.`]]},
{id:`two-kitchens`,stage:6,title:`Two kitchens`,teaser:`Maps need more than lines between safe roofs.`,lines:[[`Soren`,`Two refuges on the diagram, but only one mill on the supply list. The road between them is now part of the ward.`],[`hero`,`A ward needs flour?`],[`Iona`,`And dry blankets. And someone to notice when the person cooking has not eaten.`],[`Tavin`,`I will mark the mill and the rest stops. A short route that exhausts everyone is a long mistake.`]]},
{id:`last-watch`,stage:8,title:`A place on the roster`,teaser:`Before the final passage, the party checks who will be waiting.`,lines:[[`Iona`,`I copied our return names onto the receiving roster. Four places, and a separate line for anyone we bring out.`],[`Tavin`,`Leave room for terrible handwriting. I want to sign my own name when we get back.`],[`Soren`,`The rear guard has the diversion signal. If it changes, we turn around and check. No silent assumptions.`],[`hero`,`Then one last check of the pack. We go below with a way back, and people expecting us.`]]},
{id:`road-ahead`,stage:10,title:`The next ordinary morning`,teaser:`With the last bell quiet, there is still a road to walk.`,lines:[[`Soren`,`No command bell this morning. I woke up waiting for a fault I had forgotten to measure.`],[`Iona`,`There will be faults. Roofs leak. People become tired. We can answer them without feeding a machine.`],[`Tavin`,`There is a parcel for the next town. No seal, no levy. Just a pair of gloves somebody left behind.`],[`hero`,`We can take the slow road. There are people along it I would like to see again.`]]}
];
function normalizeCampTales(value){return Array.isArray(value)?[...new Set(value.filter(id=>typeof id===`string`&&campTaleCatalog.some(tale=>tale.id===id)))]:[]}
function campTales(state){let sheltered=!!(state&&Object.hasOwn(f,state.area)&&p(state.area,state.player?.x,state.player?.y)),clear=!!(state?.mode===`explore`&&!state.battle&&!state.message&&!state.reward&&!state.messageQueue?.length),heard=normalizeCampTales(state?.campTalesHeard);return campTaleCatalog.map(tale=>({id:tale.id,title:tale.title,stage:tale.stage,teaser:tale.teaser,unlocked:(state?.campaign?.stage??0)>=tale.stage,sheltered,available:clear&&sheltered&&(state?.campaign?.stage??0)>=tale.stage,heard:heard.includes(tale.id)}))}
function campTaleMessages(state,id){let tale=campTaleCatalog.find(tale=>tale.id===id);if(!tale)return[];let name=key=>state.heroes.find(hero=>hero.id===(key===`hero`?`Mara`:key))?.name??(key===`hero`?state.profile.name:key);return tale.lines.map(([speaker,text])=>({speaker:name(speaker),text}))}
'''


def patch(source):
    labels = []

    def once(old, new, label):
        nonlocal source
        count = source.count(old)
        assert count == 1, f'{label}: expected one anchor, found {count}'
        source = source.replace(old, new, 1)
        labels.append(label)

    once('function Ee(e={}){', CAMP_HELPERS + 'function Ee(e={}){',
         'six original shelter conversations with chapter and safe-location availability')
    once(',messageQueue:[],hunts:', ',messageQueue:[],campTalesHeard:[],hunts:',
         'new journeys start with an empty camp conversation history')
    once('c.rng=n.rng', 'c.campTalesHeard=normalizeCampTales(n.campTalesHeard),c.rng=n.rng',
         'optional camp history imports without resetting older saves')
    once('},reset(){o++',
         '},hearCampTale(id){let tale=campTales(a).find(tale=>tale.id===id);if(!tale?.available)return!1;let messages=campTaleMessages(a,id);if(!messages.length)return!1;a.campTalesHeard=normalizeCampTales(a.campTalesHeard);a.campTalesHeard.includes(id)||a.campTalesHeard.push(id);E(messages);l();z.save();return!0},reset(){o++',
         'listen or replay at a safe shelter without rewards healing or story mutations')
    return source, labels
