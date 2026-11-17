/* Pousse : règles pures (points, série, stock, courses). Sans accès à l'écran. */
(function (root) {
  const DATA = (typeof module !== 'undefined' && module.exports) ? require('./data.js') : root.DATA;
  const { MOMENTS, EXTRA, FEELINGS, FOODS, AVOID, ADDITIVES, ALLERGENS, STOOLS, PAIN, ENERGY, RECIPES, LEVELS, WATER_GOAL } = DATA;

  const pad = n => String(n).padStart(2, '0');
  const dayKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const minutes = hhmm => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

  function norm(s) {
    return String(s || '').toLowerCase().replace(/œ/g, 'oe').normalize('NFD')
      .replace(/[̀-ͯ]/g, '').replace(/['’]/g, ' ');
  }

  // Lit la description : aliments reconnus et produits à éviter
  function detect(text) {
    const t = norm(text).replace(/\b(sans|pas de|pas d|ni)\s+[a-z]+/g, ' ');
    const foods = FOODS.filter(f => new RegExp(`\\b(?:${f.kw})\\b`).test(t)).map(f => f.id);
    const avoid = [];
    for (const w of AVOID) {
      const m = t.match(new RegExp(`\\b(?:${w})\\b`));
      if (m && !avoid.includes(m[0])) avoid.push(m[0]);
    }
    return { foods, avoid };
  }

  function plateParts(foodIds) {
    const groups = new Set(foodIds.map(id => (FOODS.find(f => f.id === id) || {}).group));
    return { base: groups.has('base'), legume: groups.has('legume'), proteine: groups.has('proteine') };
  }
  const isComplete = ids => { const p = plateParts(ids); return p.base && p.legume && p.proteine; };

  function onTime(meal) {
    const m = MOMENTS.find(x => x.id === meal.moment);
    if (!m) return false;
    const d = new Date(meal.ts);
    return Math.abs(d.getHours() * 60 + d.getMinutes() - minutes(m.h)) <= 90;
  }

  // Les points récompensent le fait de noter et la régularité. La quantité, la durée
  // et les produits consommés n'en retirent jamais. Noter un moment hors repas en donne.
  function mealPoints(meal) {
    const m = MOMENTS.find(x => x.id === meal.moment);
    if (!m) return 5;
    let p = 10;
    if (meal.modulen || meal.thumb) p += 5;
    if ((meal.text || '').trim()) p += 2;
    if (onTime(meal)) p += 3;
    if (m.full && isComplete(meal.foods || [])) p += 5;
    if (meal.duration > 0) p += 3;
    return p;
  }

  const firstByMoment = (meals, day) => {
    const out = {};
    meals.filter(x => x.day === day).sort((a, b) => a.ts - b.ts).forEach(x => { if (!out[x.moment]) out[x.moment] = x; });
    return out;
  };

  // Noter son ventre rapporte 5 points par jour, quel que soit ce qui est noté
  const gutNoted = g => !!g && (g.stools != null || g.pain != null || g.energy != null || !!g.blood);

  function totalPoints(meals, water, gut) {
    const days = new Set(meals.map(m => m.day));
    let total = 0;
    days.forEach(d => { Object.values(firstByMoment(meals, d)).forEach(m => { total += mealPoints(m); }); });
    Object.values(water || {}).forEach(n => { if (n >= WATER_GOAL) total += 10; });
    Object.values(gut || {}).forEach(g => { if (gutNoted(g)) total += 5; });
    return total;
  }

  function dayCount(meals, day) { return Object.keys(firstByMoment(meals, day)).filter(k => MOMENTS.some(m => m.id === k)).length; }

  // Une journée compte à partir de 4 moments sur 5, ou si elle est marquée « journée difficile »
  function streak(meals, hard, now) {
    const ok = d => dayCount(meals, dayKey(d)) >= 4 || !!(hard || {})[dayKey(d)];
    let d = new Date(now);
    if (!ok(d)) d = addDays(d, -1);
    let n = 0;
    while (ok(d)) { n++; d = addDays(d, -1); }
    return n;
  }

  function level(points) {
    let i = 0;
    LEVELS.forEach((l, k) => { if (points >= l.min) i = k; });
    const cur = LEVELS[i], next = LEVELS[i + 1];
    return { index: i, name: cur.name, next: next ? next.name : null, toNext: next ? next.min - points : 0,
      pct: next ? Math.round(100 * (points - cur.min) / (next.min - cur.min)) : 100 };
  }

  // Le prochain moment à noter : le premier non noté dont l'heure est la plus proche
  function currentMoment(doneMap, now) {
    const t = now.getHours() * 60 + now.getMinutes();
    const todo = MOMENTS.filter(m => !doneMap[m.id]);
    if (!todo.length) return null;
    return todo.reduce((a, b) => Math.abs(minutes(a.h) - t) <= Math.abs(minutes(b.h) - t) ? a : b);
  }

  function useFoods(stock, ids, delta) {
    ids.forEach(id => {
      const f = FOODS.find(x => x.id === id);
      const s = stock[id];
      if (!f || !s) return;
      s.uses = Math.max(0, (s.uses || 0) + delta);
      if (s.state === 'out' && !s.auto) return;
      const r = s.uses / f.portions;
      const before = s.state;
      s.state = r >= 1 ? 'out' : r >= 0.7 ? 'low' : (s.auto ? 'ok' : s.state);
      if (s.state !== before) s.auto = true;
    });
    return stock;
  }

  function setStock(stock, id, state) { stock[id] = { state, uses: 0, auto: false }; return stock; }
  const available = (stock, id) => !!stock[id] && stock[id].state !== 'out';

  // Propose des repas avec ce qu'il y a, en variant selon ce qui a été mangé récemment
  function suggest(stock, recentFoods) {
    const pick = g => FOODS.filter(f => f.group === g && f.id !== 'galette' && available(stock, f.id))
      .sort((a, b) => (recentFoods[a.id] || 0) - (recentFoods[b.id] || 0));
    const bases = pick('base'), legumes = pick('legume'), proteines = pick('proteine');
    const missing = [];
    if (!bases.length) missing.push('un féculent');
    if (!legumes.length) missing.push('un légume');
    if (!proteines.length) missing.push('une protéine');
    if (missing.length) return { meals: [], missing };
    const seen = new Set(), meals = [];
    for (let i = 0; i < 20 && meals.length < 5; i++) {
      const c = [bases[i % bases.length], legumes[i % legumes.length], proteines[i % proteines.length]];
      const k = c.map(x => x.id).join('+');
      if (!seen.has(k)) { seen.add(k); meals.push(c); }
    }
    return { meals, missing };
  }

  function shopping(stock, basket) {
    const groups = {};
    FOODS.forEach(f => {
      const s = stock[f.id] || { state: 'out' };
      const inBasket = !!(basket || {})[f.id];
      if (s.state === 'ok' && !inBasket) return;
      (groups[f.rayon] = groups[f.rayon] || []).push({ food: f, low: s.state === 'low', inBasket });
    });
    return groups;
  }

  const avg = a => a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null;

  // Résumé d'une semaine (lundi donné) : durée moyenne, hors repas, ressentis. Aucune cible.
  function weekStats(meals, monday) {
    const days = new Set([...Array(7)].map((_, i) => dayKey(addDays(monday, i))));
    const week = meals.filter(m => days.has(m.day));
    const feelings = {};
    week.forEach(m => { if (m.feel) feelings[m.feel] = (feelings[m.feel] || 0) + 1; });
    return { avgDuration: avg(week.filter(m => m.duration > 0).map(m => m.duration)),
      extra: week.filter(m => m.moment === 'hors').length, feelings };
  }

  function mondayOf(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return addDays(x, -((x.getDay() + 6) % 7)); }

  // Repas habituels : les descriptions les plus fréquentes des 30 derniers jours, pour noter en un geste
  function favorites(meals, now, max) {
    const since = new Date(now).getTime() - 30 * 86400000;
    const by = new Map();
    meals.filter(m => m.ts >= since && (m.text || '').trim()).sort((a, b) => a.ts - b.ts).forEach(m => {
      const k = norm(m.text).replace(/\s+/g, ' ').trim();
      const cur = by.get(k) || { n: 0 };
      by.set(k, { n: cur.n + 1, text: m.text.trim(), foods: m.foods || [], last: m.ts });
    });
    return [...by.values()].sort((a, b) => b.n - a.n || b.last - a.last).slice(0, max || 4);
  }

  // Lecture d'une fiche Open Food Facts : additifs et allergènes qui irritent souvent l'intestin
  function productCheck(p) {
    if (!p) return null;
    const additives = [...new Set((p.additives_tags || []).filter(t => ADDITIVES[t]).map(t => ADDITIVES[t]))];
    const allergens = [...new Set((p.allergens_tags || []).filter(t => ALLERGENS[t]).map(t => ALLERGENS[t]))];
    const ultra = Number(p.nova_group) === 4;
    return { name: p.product_name_fr || p.product_name || 'Produit sans nom', brand: p.brands || '',
      additives, allergens, ultra, calm: !additives.length && !allergens.length && !ultra };
  }

  // Recettes faisables avec ce qu'il y a
  const recipesFor = stock => RECIPES.filter(r => r.needs.every(id => available(stock, id)));

  // Bilan à partager avec l'équipe de soin. Que des faits notés, aucune note ni objectif.
  function report(meals, gut, water, end, days) {
    const n = days || 14;
    const last = new Date(end); last.setHours(0, 0, 0, 0);
    const first = addDays(last, -(n - 1));
    const keys = [...Array(n)].map((_, i) => dayKey(addDays(first, i)));
    const set = new Set(keys);
    const gs = keys.map(k => (gut || {})[k]).filter(gutNoted);
    const fr = d => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
    const lines = [`Suivi Pousse du ${fr(first)} au ${fr(last)} (${n} jours)`, ''];
    lines.push('VENTRE');
    if (!gs.length) lines.push('- Rien de noté sur la période');
    else {
      const st = gs.filter(g => g.stools != null).map(g => g.stools);
      if (st.length) lines.push(`- Selles par jour : ${Math.min(...st)} à ${Math.max(...st)}, ${(st.reduce((a, b) => a + b, 0) / st.length).toFixed(1).replace('.', ',')} en moyenne (${st.length} jour${st.length > 1 ? 's' : ''} noté${st.length > 1 ? 's' : ''})`);
      STOOLS.forEach(s => { const c = gs.filter(g => g.type === s.id).length; if (c) lines.push(`- ${s.label} : ${c} jour${c > 1 ? 's' : ''}`); });
      const night = gs.filter(g => g.night).length; if (night) lines.push(`- Selles la nuit : ${night} jour${night > 1 ? 's' : ''}`);
      const blood = keys.filter(k => ((gut || {})[k] || {}).blood); if (blood.length) lines.push(`- Sang noté : ${blood.map(k => fr(new Date(k + 'T12:00:00'))).join(', ')}`);
      PAIN.forEach((l, i) => { if (!i) return; const c = gs.filter(g => g.pain === i).length; if (c) lines.push(`- Douleur ${l.toLowerCase()} : ${c} jour${c > 1 ? 's' : ''}`); });
      const low = gs.filter(g => g.energy === 2).length; if (low) lines.push(`- Énergie faible : ${low} jour${low > 1 ? 's' : ''}`);
    }
    const ms = meals.filter(m => set.has(m.day));
    lines.push('', 'REPAS');
    const counts = keys.map(k => dayCount(meals, k)).filter(c => c > 0);
    lines.push(counts.length ? `- Moments notés : ${counts.length} jours sur ${n}` : '- Aucun repas noté');
    const durs = ms.filter(m => m.duration > 0).map(m => m.duration);
    if (durs.length) lines.push(`- Durée des repas : ${Math.round(durs.reduce((a, b) => a + b, 0) / durs.length)} minutes en moyenne (${durs.length} repas chronométrés)`);
    const extra = ms.filter(m => m.moment === EXTRA.id).length; if (extra) lines.push(`- Moments hors repas : ${extra}`);
    const feel = {}; ms.forEach(m => { if (m.feel) feel[m.feel] = (feel[m.feel] || 0) + 1; });
    const fl = Object.entries(feel).sort((a, b) => b[1] - a[1]).map(([id, c]) => `${(FEELINGS.find(f => f.id === id) || {}).label} ${c}`);
    if (fl.length) lines.push(`- Ressentis avant de manger : ${fl.join(', ')}`);
    const irr = {}; ms.forEach(m => (detect(m.text).avoid || []).forEach(w => { irr[w] = (irr[w] || 0) + 1; }));
    const il = Object.entries(irr).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([w, c]) => `${w} ${c}`);
    if (il.length) lines.push(`- Aliments souvent irritants mentionnés : ${il.join(', ')}`);
    const w = keys.map(k => (water || {})[k]).filter(v => v > 0);
    if (w.length) lines.push(`- Eau : ${(w.reduce((a, b) => a + b, 0) / w.length).toFixed(1).replace('.', ',')} verres par jour en moyenne (${w.length} jour${w.length > 1 ? 's' : ''} noté${w.length > 1 ? 's' : ''})`);
    const notes = keys.map(k => ((gut || {})[k] || {}).note ? `- ${fr(new Date(k + 'T12:00:00'))} : ${gut[k].note}` : null).filter(Boolean);
    if (notes.length) lines.push('', 'NOTES', ...notes);
    return lines.join('\n');
  }

  function buildVisionPrompt() {
    const list = FOODS.map(f => `${f.id} = ${f.name}`).join(', ');
    return `Voici une photo de réfrigérateur ou de placard. Parmi cette liste, indique uniquement les produits que tu vois clairement : ${list}. Réponds seulement avec un tableau JSON des identifiants, par exemple ["riz","carotte"].`;
  }

  // Photo d'une assiette : quels produits de la liste on voit. Jamais de calories ni de quantités.
  function buildPlatePrompt() {
    const list = FOODS.map(f => `${f.id} = ${f.name}`).join(', ');
    return `Voici la photo d'un plat. Parmi cette liste, indique les produits que tu reconnais : ${list}. Ne donne ni calories ni quantités. Réponds seulement avec un objet JSON : {"foods":["riz"],"description":"riz, carottes et poulet"}, la description en quelques mots simples en français.`;
  }

  function parsePlate(text) {
    const m = String(text).match(/\{[\s\S]*\}/);
    if (!m) return { foods: parseVision(text), description: '' };
    try {
      const j = JSON.parse(m[0]);
      return { foods: (j.foods || []).filter(id => FOODS.some(f => f.id === id)), description: String(j.description || '').slice(0, 120) };
    } catch (e) { return { foods: [], description: '' }; }
  }

  function parseVision(text) {
    const m = String(text).match(/\[[\s\S]*?\]/);
    if (!m) return [];
    try { return JSON.parse(m[0]).filter(id => FOODS.some(f => f.id === id)); } catch (e) { return []; }
  }

  const LOGIC = { dayKey, addDays, norm, detect, plateParts, isComplete, onTime, mealPoints, firstByMoment, totalPoints,
    dayCount, streak, level, currentMoment, useFoods, setStock, available, suggest, shopping, buildVisionPrompt, parseVision, weekStats, mondayOf,
    gutNoted, favorites, productCheck, recipesFor, report, buildPlatePrompt, parsePlate };
  if (typeof module !== 'undefined' && module.exports) module.exports = LOGIC;
  else root.LOGIC = LOGIC;
})(this);
