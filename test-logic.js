const a = require('assert'), L = require('./logic.js');
let d = L.detect('Riz, carotte et poulet avec une pomme de terre');
a.deepStrictEqual(d.foods.sort(), ['carotte','pdt','poulet','riz']); a.deepStrictEqual(d.avoid, []);
d = L.detect('compote sans sucre, pas de lait'); a.deepStrictEqual(d.foods, ['pomme']); a.deepStrictEqual(d.avoid, []);
d = L.detect('un café et du pain'); a.ok(d.avoid.includes('cafe') && d.avoid.includes('pain'));
d = L.detect('vinaigre'); a.deepStrictEqual(d.avoid, []);
d = L.detect('œufs durs'); a.deepStrictEqual(d.foods, ['oeuf']);
const ts = (day, h, m=0) => new Date(`${day}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`).getTime();
const meal = (day, moment, h, extra={}) => ({ id: day+moment+h, day, moment, ts: ts(day,h), foods: [], text: '', ...extra });
a.strictEqual(L.mealPoints(meal('2026-11-09','dej',12,{thumb:'x',text:'ok',foods:['riz','carotte','poulet']})), 25);
a.strictEqual(L.mealPoints(meal('2026-11-09','dej',22)), 10);
// une 2e saisie sur le même moment ne donne rien de plus
a.strictEqual(L.totalPoints([meal('2026-11-09','pdj',8),meal('2026-11-09','pdj',9)], {}), 13);
a.strictEqual(L.totalPoints([], {'2026-11-09':8}), 10);
const full = day => ['pdj','col1','dej','col2'].map((m,i)=>meal(day,m,8+i));
const meals = [...full('2026-11-07'),...full('2026-11-08')];
a.strictEqual(L.streak(meals,{}, new Date('2026-11-09T09:00:00')), 2);       // aujourd'hui en cours : série gardée
a.strictEqual(L.streak(meals,{}, new Date('2026-11-10T09:00:00')), 0);       // un jour manqué
a.strictEqual(L.streak(meals,{'2026-11-09':true}, new Date('2026-11-10T09:00:00')), 3); // journée difficile
a.strictEqual(L.level(0).name,'Graine'); a.strictEqual(L.level(500).name,'Pousse'); a.strictEqual(L.level(9999).pct,100);
let s = {}; L.setStock(s,'saumon','ok'); L.useFoods(s,['saumon'],1); a.strictEqual(s.saumon.state,'ok');
L.useFoods(s,['saumon'],1); a.strictEqual(s.saumon.state,'out');
L.useFoods(s,['saumon'],-1); a.strictEqual(s.saumon.state,'ok');
s = {}; ['riz','carotte','poulet','oeuf'].forEach(i=>L.setStock(s,i,'ok'));
const r = L.suggest(s,{}); a.strictEqual(r.missing.length,0); a.strictEqual(r.meals.length,2);
s = {}; L.setStock(s,'riz','ok'); a.deepStrictEqual(L.suggest(s,{}).missing,['un légume','une protéine']);
const g = L.shopping({riz:{state:'ok'},pdt:{state:'low'}},{}); a.ok(!g['Épicerie'].some(i=>i.food.id==='riz')); a.ok(g['Fruits et légumes'].find(i=>i.food.id==='pdt').low);
a.deepStrictEqual(L.parseVision('Voici : ["riz","licorne","carotte"]'),['riz','carotte']);
a.strictEqual(L.mealPoints(meal('2026-11-09','dej',12,{thumb:'x',text:'ok',foods:['riz','carotte','poulet'],duration:7})), 28);
a.strictEqual(L.mealPoints(meal('2026-11-09','dej',12,{thumb:'x',text:'ok',foods:['riz','carotte','poulet'],duration:45})), 28); // la durée ne change pas les points
a.strictEqual(L.mealPoints(meal('2026-11-09','hors',23)), 5);
a.strictEqual(L.dayCount([meal('2026-11-09','hors',23)],'2026-11-09'), 0); // hors repas : pas de feuille
const wk = L.weekStats([meal('2026-11-09','dej',12,{duration:10,feel:'stress'}),meal('2026-11-10','din',19,{duration:20}),meal('2026-11-10','hors',23,{feel:'stress'})], new Date('2026-11-09T00:00:00'));
a.deepStrictEqual(wk,{avgDuration:15,extra:1,feelings:{stress:2}});
a.strictEqual(L.dayKey(L.mondayOf(new Date('2026-11-15T10:00:00'))),'2026-11-09');
console.log('logique OK');
