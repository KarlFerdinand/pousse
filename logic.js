/* Pousse : règles pures (points, série, stock, courses). Sans accès à l'écran. */
(function (root) {
  const DATA = (typeof module !== 'undefined' && module.exports) ? require('./data.js') : root.DATA;
  const { MOMENTS, FOODS, AVOID, LEVELS, WATER_GOAL } = DATA;

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

  function totalPoints(meals, water) {
    const days = new Set(meals.map(m => m.day));
    let total = 0;
    days.forEach(d => { Object.values(firstByMoment(meals, d)).forEach(m => { total += mealPoints(m); }); });
    Object.values(water || {}).forEach(n => { if (n >= WATER_GOAL) total += 10; });
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

  function buildVisionPrompt() {
    const list = FOODS.map(f => `${f.id} = ${f.name}`).join(', ');
    return `Voici une photo de réfrigérateur ou de placard. Parmi cette liste, indique uniquement les produits que tu vois clairement : ${list}. Réponds seulement avec un tableau JSON des identifiants, par exemple ["riz","carotte"].`;
  }

  function parseVision(text) {
    const m = String(text).match(/\[[\s\S]*?\]/);
    if (!m) return [];
    try { return JSON.parse(m[0]).filter(id => FOODS.some(f => f.id === id)); } catch (e) { return []; }
  }

  const LOGIC = { dayKey, addDays, norm, detect, plateParts, isComplete, onTime, mealPoints, firstByMoment, totalPoints,
    dayCount, streak, level, currentMoment, useFoods, setStock, available, suggest, shopping, buildVisionPrompt, parseVision, weekStats, mondayOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = LOGIC;
  else root.LOGIC = LOGIC;
})(this);
