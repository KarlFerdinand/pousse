/* Pousse : interface. Aucune dépendance, données uniquement sur l'appareil. */
(function () {
  'use strict';
  const { MOMENTS, EXTRA, FEELINGS, GROUPS, FOODS, AVOID_TEXT, ALERTS, WATER_GOAL } = window.DATA;
  const L = window.LOGIC;
  const PREVIEW = !!window.POUSSE_PREVIEW || location.hash === '#demo';
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const getMoment = id => id === EXTRA.id ? EXTRA : MOMENTS.find(m => m.id === id);
  const pad = n => String(n).padStart(2, '0');
  const hhmm = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const fmtTime = ts => hhmm(new Date(ts)).replace(':', ' h ');
  const fmtDur = m => m > 0 ? `${m} min` : 'durée non notée';
  const JOURS = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];

  const ICON = {
    today: '<path d="M12 21V10m0 0C12 6 9 4 5 4c0 4 3 6 7 6Zm0 3c0-3 3-5 7-5 0 4-3 5-7 5Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    fridge: '<rect x="6" y="3" width="12" height="18" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M6 10h12M9 6v2M9 13v3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    cart: '<path d="M3 4h2l2.4 11h10L20 7H6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9" cy="19.5" r="1.4" fill="currentColor"/><circle cx="16" cy="19.5" r="1.4" fill="currentColor"/>',
    chart: '<path d="M5 20v-6M12 20V5M19 20v-9" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
    camera: '<path d="M4 8.5A1.5 1.5 0 0 1 5.5 7H8l1.4-2.2h5.2L16 7h2.5A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="13" r="3.2" fill="none" stroke="currentColor" stroke-width="1.8"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
    gear: '<circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    plus: '<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
    close: '<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  };
  const icon = n => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[n]}</svg>`;

  /* ---------- Stockage ---------- */
  const mem = { kv: new Map(), meals: new Map(), photos: new Map() };
  let idb = null;
  const openDb = () => new Promise(resolve => {
    if (PREVIEW) return resolve(null);
    try {
      const r = indexedDB.open('pousse', 1);
      r.onupgradeneeded = () => { ['kv', 'meals', 'photos'].forEach(s => r.result.createObjectStore(s)); };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => resolve(null);
    } catch (e) { resolve(null); }
  });
  const req = (store, mode, fn) => new Promise((res, rej) => {
    const t = idb.transaction(store, mode); const q = fn(t.objectStore(store));
    t.oncomplete = () => res(q.result); t.onerror = () => rej(t.error);
  });
  const db = {
    get: (s, k) => idb ? req(s, 'readonly', o => o.get(k)) : Promise.resolve(mem[s].get(k)),
    put: (s, k, v) => idb ? req(s, 'readwrite', o => o.put(v, k)) : Promise.resolve(void mem[s].set(k, v)),
    del: (s, k) => idb ? req(s, 'readwrite', o => o.delete(k)) : Promise.resolve(void mem[s].delete(k)),
    all: s => idb ? req(s, 'readonly', o => o.getAll()) : Promise.resolve([...mem[s].values()]),
    keys: s => idb ? req(s, 'readonly', o => o.getAllKeys()) : Promise.resolve([...mem[s].keys()]),
  };

  const S = { meals: [], settings: { modulen: false, modulenTarget: '', apiKey: '', model: 'claude-haiku-4-5' }, stock: {}, water: {}, hard: {}, fridge: null, basket: {}, active: null };
  const KV = ['settings', 'stock', 'water', 'hard', 'fridge', 'basket', 'active'];
  const save = k => db.put('kv', k, S[k]).catch(() => toast("Enregistrement impossible. Vérifie l'espace disponible."));
  let tab = 'today', sheet = null, F = null, lastPop = null, tick = null, deleting = false;

  function today() { return L.dayKey(new Date()); }

  /* ---------- Photos ---------- */
  function resize(file, max, q) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        const r = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        res(c.toDataURL('image/jpeg', q));
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('image')); };
      img.src = url;
    });
  }
  const toPhoto = f => Promise.all([resize(f, 1280, .72), resize(f, 220, .62)]);

  /* ---------- Plante ---------- */
  function plant(flags, opts) {
    const o = opts || {}, leaf = 'M0 0C9-13 31-14 42 0C31 10 9 10 0 0Z';
    const spots = [[100, 118, 200], [100, 98, -20], [100, 78, 200], [100, 58, -20], [100, 38, -62]];
    const leaves = spots.map(([x, y, a], i) => {
      const cls = `leafshape${flags[i] ? '' : ' off'}${o.pop === i ? ' pop' : ''}`;
      const flip = a === 200 ? ` scale(1,-1)` : '';
      return `<g transform="translate(${x} ${y}) rotate(${a})${flip}"><path class="${cls}" d="${leaf}"/></g>`;
    }).join('');
    const full = flags.every(Boolean);
    const flower = full ? `<g class="flower">${[0, 72, 144, 216, 288].map(a => `<circle cx="${100 + 10 * Math.sin(a * Math.PI / 180)}" cy="${16 - 10 * Math.cos(a * Math.PI / 180)}" r="7"/>`).join('')}</g><circle cx="100" cy="16" r="5" fill="#fff6e0"/>` : '';
    return `<svg class="plant ${o.mini ? 'mini' : ''}" viewBox="44 0 112 140" role="img" aria-label="${flags.filter(Boolean).length} feuilles sur 5"><ellipse class="ground" cx="100" cy="131" rx="44" ry="7"/><path class="stem" d="M100 130V${full ? 22 : 38}" stroke-width="4" stroke-linecap="round" fill="none"/>${leaves}${flower}</svg>`;
  }

  /* ---------- Écrans ---------- */
  function render() {
    const views = { today: viewToday, frigo: viewFrigo, courses: viewCourses, progres: viewProgres };
    $('app').innerHTML = views[tab]();
    const t = (k, label, ic) => `<button data-act="tab" data-v="${k}" class="${tab === k ? 'on' : ''}"${tab === k ? ' aria-current="page"' : ''}>${icon(ic)}${label}</button>`;
    $('tabs').innerHTML = t('today', "Aujourd'hui", 'today') + t('frigo', 'Frigo', 'fridge') +
      `<button class="add" data-act="add" aria-label="Noter un repas"><span class="c">${icon('camera')}</span>Noter</button>` +
      t('courses', 'Courses', 'cart') + t('progres', 'Progrès', 'chart');
    lastPop = null;
  }

  const previewBanner = () => PREVIEW ? `<p class="banner"><b>Aperçu avec des exemples.</b> Rien n'est enregistré ici. Tes vraies données resteront sur ton iPhone une fois l'appli installée.</p>` : '';

  function installHint() {
    const standalone = window.navigator.standalone || matchMedia('(display-mode: standalone)').matches;
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (PREVIEW || standalone || !ios) return '';
    return `<p class="banner"><b>Pour installer Pousse</b> : touche Partager dans Safari, puis Sur l'écran d'accueil.</p>`;
  }

  function viewToday() {
    const day = today(), done = L.firstByMoment(S.meals, day);
    const flags = MOMENTS.map(m => !!done[m.id]);
    const n = flags.filter(Boolean).length;
    const pts = L.totalPoints(S.meals, S.water), lvl = L.level(pts), st = L.streak(S.meals, S.hard, new Date());
    const cur = L.currentMoment(done, new Date());
    const msg = n === 5 ? 'Journée complète, ta plante a fleuri.' : n === 0 ? 'Chaque repas noté ajoute une feuille.' : n === 4 ? 'Plus qu’une feuille pour la fleur.' : 'Ta plante grandit, continue à ton rythme.';
    const water = S.water[day] || 0;
    const dayMeals = S.meals.filter(m => m.day === day);
    const peu = dayMeals.filter(m => m.qty === 'peu').length;
    const extra = dayMeals.filter(m => m.moment === EXTRA.id).sort((a, b) => a.ts - b.ts);
    const modCount = dayMeals.filter(m => m.modulen).length;
    const date = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

    const rows = MOMENTS.map(m => {
      const meal = done[m.id];
      const hint = S.settings.modulen && m.modulen ? 'Modulen' : m.hint;
      if (meal) {
        const sub = [fmtTime(meal.ts), meal.duration ? fmtDur(meal.duration) : '', meal.text || (meal.modulen ? 'Modulen' : '')].filter(Boolean).join(' · ');
        return `<button class="moment done" data-act="meal" data-v="${meal.id}"><span class="mark">${icon('check')}</span><span class="txt"><b>${esc(m.label)}</b><span>${esc(sub)}</span></span>${meal.thumb ? `<img class="thumb" src="${meal.thumb}" alt="">` : ''}</button>`;
      }
      return `<button class="moment ${cur && cur.id === m.id ? 'now' : ''}" data-act="add" data-v="${m.id}"><span class="mark">${icon('plus')}</span><span class="txt"><b>${esc(m.label)}</b><span>${esc(hint)}</span></span><span class="hour">${m.h.replace(':', ' h ')}</span></button>`;
    }).join('');

    const timer = S.active ? `<section class="timer" aria-label="Repas en cours">
        <p class="sub">Repas en cours depuis ${fmtTime(S.active.start)}</p>
        <div class="clock" id="clock">00:00</div>
        ${S.active.photo ? `<img class="detailimg" src="${S.active.thumb}" alt="Ton plat" style="max-height:120px;object-fit:cover">` : `<label class="btn ghost small"><input class="vh" type="file" accept="image/*" id="activePhoto">${icon('camera').replace('<svg', '<svg width="22" height="22"')}Photo du plat avant de manger</label>`}
        <button class="btn primary" data-act="finish">J'ai fini</button>
        <button class="linkbtn" data-act="cancelTimer">Annuler le chrono</button>
      </section>` : `<div class="row2">
        <button class="btn primary" data-act="start">Je commence à manger</button>
        <button class="btn ghost" data-act="add" data-v="${EXTRA.id}">Noter hors repas</button>
      </div>`;

    return `${previewBanner()}${installHint()}
      <header class="top"><div><small>${esc(date)}</small><h1>Aujourd'hui</h1></div><button class="iconbtn" data-act="settings" aria-label="Réglages et rappels">${icon('gear')}</button></header>
      <section class="hero">
        <div><div class="big">${n}<span> sur 5 moments</span></div><p>${msg}</p>
          <div class="pills"><span class="pill">${pts} points</span><span class="pill">${st} j d'affilée</span><span class="pill">${esc(lvl.name)}</span></div></div>
        ${plant(flags, { pop: lastPop })}
      </section>
      ${timer}
      <section class="stack" aria-label="Moments du jour">${rows}</section>
      ${extra.length ? `<section class="stack"><h2>Hors repas</h2>${extra.map(journalRow).join('')}</section>` : ''}
      ${S.settings.modulen ? `<p class="banner"><b>Modulen</b> : ${modCount}${S.settings.modulenTarget ? ` sur ${esc(S.settings.modulenTarget)}` : ''} portion${modCount > 1 ? 's' : ''} aujourd'hui${S.settings.modulenTarget ? '' : '. Indique ta prescription dans les réglages'}.</p>` : ''}
      ${peu >= 2 ? `<p class="note">Tu as noté plusieurs petites prises aujourd'hui. Si ça dure, parles-en à ton équipe de soin.</p>` : ''}
      <section class="stack"><h2>Eau : ${water} verre${water > 1 ? 's' : ''} sur ${WATER_GOAL}</h2>
        <div class="water">${[...Array(WATER_GOAL)].map((_, i) => `<button class="glass ${i < water ? 'on' : ''}" data-act="water" data-v="${i + 1}" aria-label="${i + 1} verres"></button>`).join('')}</div>
        <p class="sub">À température ambiante ou tiède.</p></section>
      <button class="linkbtn" data-act="hard">${S.hard[day] ? "Journée difficile notée, ta série est protégée. Annuler" : 'Journée difficile ? Protège ta série'}</button>`;
  }

  function stockLabel(s) { return { ok: "J'en ai", low: 'Presque fini', out: 'À acheter' }[s]; }

  function viewFrigo() {
    const f = S.fridge;
    const age = f ? Math.floor((Date.now() - f.ts) / 86400000) : null;
    const recent = {};
    S.meals.filter(m => Date.now() - m.ts < 5 * 86400000).forEach(m => (m.foods || []).forEach(id => { recent[id] = (recent[id] || 0) + 1; }));
    const ideas = L.suggest(S.stock, recent);
    const ai = !!S.settings.apiKey;
    const groups = Object.keys(GROUPS).map(g => `<h2 style="margin-top:6px">${GROUPS[g]}</h2><div class="fridge-grid">${FOODS.filter(x => x.group === g).map(x => {
      const st = (S.stock[x.id] || { state: 'out' }).state;
      return `<button class="stock ${st}" data-act="stock" data-v="${x.id}"><span class="e">${x.e}</span><span class="n">${esc(x.name)}<span class="st">${stockLabel(st)}</span></span></button>`;
    }).join('')}</div>`).join('');
    return `${previewBanner()}<header class="top"><div><small>${f ? (age === 0 ? "Mis à jour aujourd'hui" : `Mis à jour il y a ${age} j`) : 'Pas encore de photo'}</small><h1>Mon frigo</h1></div></header>
      <label class="photo ${f && f.photo ? 'filled' : 'short'}"><input class="vh" type="file" accept="image/*" id="fridgeIn">
        ${f && f.photo ? `<img src="${f.photo}" alt="Dernière photo du frigo">` : `<div style="text-align:center">${icon('camera')}<div>Prendre le frigo en photo</div></div>`}</label>
      ${f && f.photo ? `<label class="btn ghost small" for="fridgeIn">Nouvelle photo</label>` : ''}
      <p class="sub">${ai ? 'La photo coche ce qui est visible, vérifie ensuite.' : 'Regarde ta photo et touche chaque produit pour dire ce que tu as.'}</p>
      <section class="stack"><h2>Repas possibles</h2>
        ${ideas.meals.length ? ideas.meals.map(c => `<div class="mealidea">${c.map(x => `${x.e} ${esc(x.name)}`).join(' + ')}</div>`).join('') : `<p class="note">Il manque ${ideas.missing.join(', ')} pour composer un repas. Ajoute-les à tes courses.</p>`}
      </section>
      <section class="stack">${groups}</section>`;
  }

  function viewCourses() {
    const g = L.shopping(S.stock, S.basket);
    const items = Object.values(g).flat();
    const left = items.filter(i => !i.inBasket).length;
    const rayons = Object.keys(g).map(r => `<section class="stack"><h2>${esc(r)}</h2>${g[r].map(i => `<button class="shop ${i.inBasket ? 'done' : ''}" data-act="buy" data-v="${i.food.id}">
      <span class="box">${i.inBasket ? icon('check') : ''}</span><span class="e">${i.food.e}</span>
      <span class="t"><b>${esc(i.food.name)}</b><span>${i.low ? 'Presque fini · ' : ''}${esc(i.food.qty)}</span></span></button>`).join('')}</section>`).join('');
    return `${previewBanner()}<header class="top"><div><small>Selon ton frigo et tes repas notés</small><h1>Courses</h1></div></header>
      <p class="big-line"><b>${left}</b> produit${left > 1 ? 's' : ''} à acheter</p>
      ${left ? `<button class="btn ghost small" data-act="shareList">Partager la liste</button>` : ''}
      ${rayons || `<p class="note">Rien à acheter pour l'instant.</p>`}
      ${Object.keys(S.basket).length ? `<button class="btn ghost small" data-act="clearBasket">Courses terminées</button>` : ''}
      ${S.settings.modulen ? `<p class="sub">Modulen sur prescription. Les quantités des petits-déjeuners et collations diminuent.</p>` : ''}`;
  }

  function journalRow(m) {
    const mo = getMoment(m.moment);
    const d = new Date(m.ts);
    const feel = m.feel ? (FEELINGS.find(x => x.id === m.feel) || {}).label : '';
    return `<button class="journal" data-act="meal" data-v="${m.id}">${m.thumb ? `<img class="thumb" src="${m.thumb}" alt="">` : ''}
      <span class="t"><b>${esc(mo.label)}</b><span>${JOURS[d.getDay()]} ${d.getDate()} · ${fmtTime(m.ts)} · ${fmtDur(m.duration)}${feel ? ' · ' + esc(feel) : ''}</span>
      ${m.text ? `<span>${esc(m.text)}</span>` : ''}${m.note ? `<em>${esc(m.note)}</em>` : ''}</span></button>`;
  }

  function badges(pts, st) {
    const m = S.meals;
    const best = (() => { let b = 0; [...new Set(m.map(x => x.day))].forEach(d => { b = Math.max(b, L.dayCount(m, d)); }); return b; })();
    return [
      ['Première photo', m.some(x => x.thumb)], ['Journée complète', best >= 5], ['3 jours d’affilée', st >= 3], ['7 jours d’affilée', st >= 7],
      ['Eau du jour', Object.values(S.water).some(n => n >= WATER_GOAL)], ['Frigo à jour', !!S.fridge],
      ['10 assiettes complètes', m.filter(x => L.isComplete(x.foods || [])).length >= 10], ['10 repas chronométrés', m.filter(x => x.duration > 0).length >= 10],
    ];
  }

  function viewProgres() {
    const pts = L.totalPoints(S.meals, S.water), lvl = L.level(pts), st = L.streak(S.meals, S.hard, new Date());
    const first = new Date(); first.setHours(0, 0, 0, 0); first.setDate(first.getDate() - 6);
    const days = [...Array(7)].map((_, i) => L.addDays(first, i));
    const td = today();
    const garden = days.map(d => {
      const k = L.dayKey(d), done = L.firstByMoment(S.meals, k);
      return `<div class="${k === td ? 'today' : ''}">${plant(MOMENTS.map(m => !!done[m.id]), { mini: true })}${JOURS[d.getDay()]}</div>`;
    }).join('');
    const pct = ts => { const d = new Date(ts); return (d.getHours() * 60 + d.getMinutes()) / 14.4; };
    const chart = days.map(d => {
      const k = L.dayKey(d);
      const bars = S.meals.filter(m => m.day === k).map(m => `<button class="${m.moment === EXTRA.id ? 'hors' : ''}" data-act="meal" data-v="${m.id}" style="left:${Math.min(98, pct(m.ts)).toFixed(2)}%;width:${((m.duration || 0) / 14.4).toFixed(2)}%" aria-label="${esc(getMoment(m.moment).label)}, ${fmtTime(m.ts)}, ${fmtDur(m.duration)}"></button>`).join('');
      return `<div class="day"><span class="d">${JOURS[d.getDay()]}</span><div class="track">${bars}</div></div>`;
    }).join('');
    const w = L.weekStats(S.meals, first), prev = L.weekStats(S.meals, L.addDays(first, -7));
    const delta = w.avgDuration != null && prev.avgDuration != null ? w.avgDuration - prev.avgDuration : null;
    const feels = Object.entries(w.feelings).sort((a, b) => b[1] - a[1]).map(([id, n]) => `${(FEELINGS.find(x => x.id === id) || {}).label} ${n}`).join(' · ');
    const week = S.meals.filter(m => m.ts >= first.getTime());
    const counts = Object.keys(GROUPS).filter(g => g !== 'autre').map(g => {
      const c = week.filter(m => (m.foods || []).some(id => (FOODS.find(f => f.id === id) || {}).group === g)).length;
      return `<div class="tile"><div class="v">${c}</div><div class="l">prises avec ${GROUPS[g].toLowerCase()}</div></div>`;
    }).join('');
    const journal = [...S.meals].sort((a, b) => b.ts - a.ts).slice(0, 20).map(journalRow).join('');
    const bs = badges(pts, st);
    return `${previewBanner()}<header class="top"><div><small>${pts} points</small><h1>Progrès</h1></div></header>
      <section class="levelcard"><div class="name">${esc(lvl.name)}</div><div class="bar"><i style="width:${lvl.pct}%"></i></div>
        <p class="sub">${lvl.next ? `Encore ${lvl.toNext} points pour devenir ${esc(lvl.next)}` : 'Niveau maximum atteint'} · ${st} jour${st > 1 ? 's' : ''} d'affilée</p></section>
      <section class="stack"><h2>Mon jardin des 7 derniers jours</h2><div class="garden">${garden}</div></section>
      <section class="stack"><h2>Horaires et durée des repas</h2>
        <div class="tiles"><div class="tile"><div class="v">${w.avgDuration != null ? w.avgDuration + ' min' : '–'}</div><div class="l">durée moyenne${delta != null ? ` (${delta > 0 ? '+' : ''}${delta} min par rapport aux 7 jours d'avant)` : ''}</div></div>
        <div class="tile"><div class="v">${w.extra}</div><div class="l">moment${w.extra > 1 ? 's' : ''} hors repas</div></div></div>
        <div class="chart"><div class="axis"><span></span><div class="ticks">${[0, 6, 12, 18, 24].map(h => `<span style="left:${h / 24 * 100}%">${h} h</span>`).join('')}</div></div>${chart}
          <div class="legend"><span><i></i>Repas</span><span><i class="hors"></i>Hors repas</span></div></div>
        ${feels ? `<p class="banner"><b>Ressentis avant de manger</b> : ${esc(feels)}</p>` : ''}
        <p class="sub">Observe sans te juger. Aucune durée n'est imposée.</p></section>
      <section class="stack"><h2>Produits sur 7 jours</h2><div class="tiles">${counts}</div></section>
      <section class="stack"><h2>Récompenses</h2><div class="badges">${bs.map(([t, on]) => `<div class="badge ${on ? 'on' : ''}">${esc(t)}</div>`).join('')}</div></section>
      <section class="stack"><h2>Journal</h2>${journal || '<p class="note">Tes repas apparaîtront ici avec leur heure, leur durée et ta note.</p>'}</section>`;
  }

  /* ---------- Saisie ---------- */
  function newForm(momentId, extra) {
    const done = L.firstByMoment(S.meals, today());
    const cur = L.currentMoment(done, new Date());
    const id = momentId || (cur ? cur.id : EXTRA.id);
    const m = getMoment(id);
    const now = new Date();
    return Object.assign({ moment: id, photo: null, thumb: null, text: '', qty: 'normal', time: hhmm(now), duration: '', feel: null, note: '',
      picked: [], removed: [], foods: [], avoid: [], modulen: !!(S.settings.modulen && m.modulen), start: null }, extra || {});
  }

  function computeFoods() {
    const d = L.detect(F.text);
    F.avoid = d.avoid;
    F.foods = [...new Set([...F.picked, ...d.foods])].filter(id => !F.removed.includes(id));
  }

  function previewPoints() {
    const d = new Date(); const [h, mi] = F.time.split(':').map(Number); d.setHours(h, mi, 0, 0);
    const already = L.firstByMoment(S.meals, today())[F.moment];
    if (already) return 0;
    return L.mealPoints({ moment: F.moment, ts: d.getTime(), thumb: F.thumb, text: F.text, foods: F.foods, modulen: F.modulen, duration: +F.duration });
  }

  function dynHtml() {
    const m = getMoment(F.moment), p = L.plateParts(F.foods);
    const foods = F.modulen ? '' : Object.keys(GROUPS).filter(g => g !== 'autre').map(g => `<div class="chiptitle">${GROUPS[g]}</div><div class="chips">${FOODS.filter(x => x.group === g).map(x => `<button class="chip ${F.foods.includes(x.id) ? 'on' : ''}" data-act="food" data-v="${x.id}" aria-pressed="${F.foods.includes(x.id)}">${x.e} ${esc(x.name)}</button>`).join('')}</div>`).join('');
    const plate = !F.modulen && m.full ? `<div class="plate"><span class="${p.base ? 'on' : ''}">Féculent</span><span class="${p.legume ? 'on' : ''}">Légume</span><span class="${p.proteine ? 'on' : ''}">Protéine</span></div>` : '';
    const avoid = F.avoid.length ? `<p class="note">Sur ta liste à éviter : ${esc(F.avoid.join(', '))}. C'est noté, sans perdre de points.</p>` : '';
    const pts = previewPoints();
    return { foods: foods + plate + avoid, save: pts ? `Enregistrer · +${pts} points` : 'Enregistrer' };
  }
  function refreshDyn() {
    computeFoods();
    const d = dynHtml();
    if ($('dyn')) $('dyn').innerHTML = d.foods;
    if ($('saveBtn')) $('saveBtn').textContent = d.save;
  }

  function sheetAdd() {
    const m = getMoment(F.moment), all = [...MOMENTS, EXTRA];
    computeFoods();
    const d = dynHtml();
    const modAvail = S.settings.modulen && m.modulen;
    return `<div class="top"><h1>${esc(m.label)}</h1><button class="iconbtn" data-act="close" aria-label="Fermer">${icon('close')}</button></div>
      <div class="seg" role="group" aria-label="Moment">${all.map(x => `<button data-act="moment" data-v="${x.id}" class="${x.id === F.moment ? 'on' : ''}" aria-pressed="${x.id === F.moment}">${esc(x.short)}</button>`).join('')}</div>
      ${modAvail ? `<div class="seg" role="group" aria-label="Type de prise"><button data-act="mod" data-v="1" class="${F.modulen ? 'on' : ''}">Modulen</button><button data-act="mod" data-v="0" class="${F.modulen ? '' : 'on'}">Repas</button></div>` : ''}
      ${F.modulen ? `<details open><summary>Bien prendre Modulen</summary><ul><li>1 portion = 50 g de poudre (6 mesurettes rases) + 210 ml d'eau</li><li>À température ambiante</li><li>À petites gorgées, sur 20 à 30 minutes</li><li>Prépare-la juste avant, ou garde-la 24 h maximum au frigo</li></ul></details>` : `
      <label class="photo ${F.photo ? 'filled' : ''}"><input class="vh" type="file" accept="image/*" id="photoIn">
        ${F.photo ? `<img src="${F.photo}" alt="Ton plat">` : `<div style="text-align:center">${icon('camera')}<div>Photo du plat</div></div>`}</label>`}
      <div class="row2">
        <div class="field"><label class="label" for="fTime">Début</label><input type="time" id="fTime" value="${esc(F.time)}"></div>
        <div class="field"><label class="label" for="fDur">Durée (minutes)</label><input type="number" inputmode="numeric" min="0" max="240" id="fDur" value="${esc(F.duration)}" placeholder="Facultatif"></div>
      </div>
      ${F.modulen ? '' : `<div class="field"><label class="label" for="fText">En quelques mots</label><input type="text" id="fText" value="${esc(F.text)}" placeholder="Ex. riz, carotte et poulet" autocomplete="off"></div>
      <div class="field"><span class="label">Quantité</span><div class="seg" role="group" aria-label="Quantité">${[['peu', 'Petite'], ['normal', 'Normale'], ['bien', 'Grande']].map(([k, l]) => `<button data-act="qty" data-v="${k}" class="${F.qty === k ? 'on' : ''}" aria-pressed="${F.qty === k}">${l}</button>`).join('')}</div></div>`}
      <div class="field"><span class="label">Avant de manger, je ressentais</span><div class="chips">${FEELINGS.map(x => `<button class="chip ${F.feel === x.id ? 'on' : ''}" data-act="feel" data-v="${x.id}" aria-pressed="${F.feel === x.id}">${esc(x.label)}</button>`).join('')}</div></div>
      <div class="field" id="dyn">${d.foods}</div>
      <div class="field"><label class="label" for="fNote">Note libre</label><textarea id="fNote" placeholder="Comment ça s'est passé, ce que tu veux retenir">${esc(F.note)}</textarea></div>
      <button class="btn primary" id="saveBtn" data-act="saveMeal">${d.save}</button>`;
  }

  function sheetMeal(m) {
    const mo = getMoment(m.moment), d = new Date(m.ts);
    const names = (m.foods || []).map(id => FOODS.find(f => f.id === id)).filter(Boolean).map(f => `${f.e} ${f.name}`).join(', ');
    const feel = m.feel ? (FEELINGS.find(x => x.id === m.feel) || {}).label : '';
    const qty = { peu: 'Petite', normal: 'Normale', bien: 'Grande' }[m.qty];
    return `<div class="top"><h1>${esc(mo.label)}</h1><button class="iconbtn" data-act="close" aria-label="Fermer">${icon('close')}</button></div>
      <img class="detailimg" id="detailPhoto" src="${m.thumb || ''}" alt="" ${m.thumb ? '' : 'hidden'}>
      <div class="kv"><div><b>Quand</b> : ${JOURS[d.getDay()]} ${d.getDate()} à ${fmtTime(m.ts)}</div><div><b>Durée</b> : ${fmtDur(m.duration)}</div>
        ${m.modulen ? '<div><b>Modulen</b></div>' : `<div><b>Quantité</b> : ${esc(qty)}</div>`}
        ${feel ? `<div><b>Ressenti</b> : ${esc(feel)}</div>` : ''}${m.text ? `<div><b>Description</b> : ${esc(m.text)}</div>` : ''}${names ? `<div><b>Produits</b> : ${esc(names)}</div>` : ''}</div>
      <div class="field"><label class="label" for="detailNote">Note libre</label><textarea id="detailNote" data-id="${m.id}" placeholder="Ajoute ce que tu veux retenir">${esc(m.note)}</textarea></div>
      ${deleting ? `<p class="note">Supprimer définitivement ce repas ?</p><div class="row2"><button class="btn ghost small" data-act="noDelete">Garder</button><button class="btn danger small" data-act="delete" data-v="${m.id}">Supprimer</button></div>` : `<button class="btn danger small" data-act="askDelete">Supprimer ce repas</button>`}`;
  }

  function sheetSettings() {
    const s = S.settings;
    const standalone = window.navigator.standalone || matchMedia('(display-mode: standalone)').matches;
    const ics = standalone ? `x-safari-${new URL('rappels.ics', location.href).href}` : 'rappels.ics';
    return `<div class="top"><h1>Réglages et rappels</h1><button class="iconbtn" data-act="close" aria-label="Fermer">${icon('close')}</button></div>
      <section class="alertcard"><h3>Appelle ton gastro ou va aux urgences en cas de</h3><ul>${ALERTS.map(a => `<li>${esc(a)}</li>`).join('')}</ul></section>
      <details><summary>À éviter</summary><ul>${AVOID_TEXT.map(a => `<li>${esc(a)}</li>`).join('')}</ul></details>
      <section class="stack"><h2>Rappels des repas</h2>
        <p class="sub">Une notification à chaque moment, et le dimanche pour le frigo et les courses, via le Calendrier de l'iPhone.</p>
        ${PREVIEW ? '<p class="note">Disponible une fois l’appli installée.</p>' : `<a class="btn ghost small" style="color:inherit;text-decoration:none" href="${esc(ics)}">Ajouter les rappels au Calendrier</a>`}</section>
      <section class="stack"><h2>Modulen</h2>
        <label class="switch">Modulen m'a été prescrit<input type="checkbox" id="setMod" ${s.modulen ? 'checked' : ''}></label>
        ${s.modulen ? `<div class="field"><label class="label" for="setTarget">Portions par jour selon ta prescription</label><input type="number" inputmode="numeric" min="0" id="setTarget" value="${esc(s.modulenTarget)}" placeholder="Celui prescrit par ton médecin ou ta diététicienne"></div>` : ''}</section>
      ${PREVIEW ? '' : `<details><summary>Lecture automatique du frigo (facultatif)</summary>
        <p class="sub" style="margin-top:8px">Avec une clé Anthropic personnelle, la photo du frigo est envoyée à Anthropic pour cocher les produits visibles. Sans clé, rien ne quitte ton téléphone. Chaque analyse est facturée sur ton compte.</p>
        <div class="field" style="margin-top:8px"><label class="label" for="setKey">Clé API</label><input type="password" id="setKey" autocomplete="off" value="${esc(s.apiKey)}" placeholder="sk-ant-…"></div>
        <div class="field" style="margin-top:8px"><label class="label" for="setModel">Modèle</label><input type="text" id="setModel" autocomplete="off" value="${esc(s.model)}"></div></details>
      <section class="stack"><h2>Sauvegarde</h2><p class="sub">Tes données restent sur cet iPhone. Exporte-les de temps en temps.</p>
        <div class="row2"><button class="btn ghost small" data-act="export">Exporter</button><label class="btn ghost small"><input class="vh" type="file" accept="application/json,.json" id="importIn">Importer</label></div></section>`}
      <p class="sub">Pousse est open source (licence MIT). Ce suivi ne remplace pas l'avis de ton gastro-entérologue ou d'un diététicien.</p>`;
  }

  function openSheet(kind, arg) {
    sheet = { kind, arg };
    deleting = false;
    drawSheet();
    $('sheet').hidden = false;
    $('sheet').scrollTop = 0;
    document.body.style.overflow = 'hidden';
  }
  function drawSheet() {
    const top = $('sheet').scrollTop;
    const html = sheet.kind === 'add' ? sheetAdd() : sheet.kind === 'settings' ? sheetSettings() : sheetMeal(sheet.arg);
    $('sheet').innerHTML = `<div class="sheetin">${html}</div>`;
    $('sheet').scrollTop = top;
    if (sheet.kind === 'meal' && sheet.arg.thumb) db.get('photos', sheet.arg.id).then(p => { if (p && $('detailPhoto')) $('detailPhoto').src = p; });
  }
  function closeSheet() { sheet = null; F = null; $('sheet').hidden = true; $('sheet').innerHTML = ''; document.body.style.overflow = ''; }

  let toastT;
  function toast(msg) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 3200); }

  async function saveMeal() {
    const [h, mi] = F.time.split(':').map(Number);
    const base = new Date(F.start || Date.now());
    if (!Number.isNaN(h)) base.setHours(h, mi, 0, 0);
    const moment = getMoment(F.moment);
    const already = L.firstByMoment(S.meals, L.dayKey(base))[F.moment];
    const meal = { id: uid(), day: L.dayKey(base), moment: F.moment, ts: base.getTime(), duration: Math.max(0, Math.round(+F.duration || 0)) || null,
      qty: F.modulen ? null : F.qty, text: F.modulen ? '' : F.text.trim(), note: F.note.trim(), feel: F.feel, foods: F.modulen ? [] : F.foods, thumb: F.modulen ? null : F.thumb, modulen: F.modulen };
    S.meals.push(meal);
    await db.put('meals', meal.id, meal);
    if (meal.thumb && F.photo) await db.put('photos', meal.id, F.photo);
    L.useFoods(S.stock, meal.foods, 1); save('stock');
    if (F.start) { S.active = null; save('active'); }
    closeSheet();
    const idx = MOMENTS.findIndex(m => m.id === meal.moment);
    if (!already && idx >= 0) lastPop = idx;
    tab = 'today'; render();
    const n = L.dayCount(S.meals, meal.day);
    const pts = already ? 0 : L.mealPoints(meal);
    toast(pts ? (idx >= 0 && n === 5 ? `+${pts} points. Journée complète, ta plante fleurit.` : `+${pts} points · ${idx >= 0 ? `${n} sur 5` : 'Noté, sans jugement'}`) : `${moment.label} ajouté au journal`);
  }

  async function analyseFridge(photo) {
    toast('Lecture de la photo…');
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': S.settings.apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model: S.settings.model, max_tokens: 300, messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: photo.split(',')[1] } },
          { type: 'text', text: L.buildVisionPrompt() }] }] }),
      });
      if (!r.ok) throw new Error(String(r.status));
      const j = await r.json();
      const found = L.parseVision((j.content || []).map(c => c.text || '').join(''));
      found.forEach(id => L.setStock(S.stock, id, 'ok'));
      save('stock'); render();
      toast(found.length ? `${found.length} produits reconnus. Vérifie la liste.` : 'Aucun produit reconnu. Coche-les toi-même.');
    } catch (e) { toast('Analyse impossible. Vérifie ta clé ou coche les produits toi-même.'); }
  }

  async function exportData() {
    const photos = {};
    for (const k of await db.keys('photos')) photos[k] = await db.get('photos', k);
    const data = { app: 'pousse', v: 1, exported: new Date().toISOString(), meals: S.meals, photos };
    KV.filter(k => k !== 'settings').forEach(k => { data[k] = S[k]; });
    data.settings = Object.assign({}, S.settings, { apiKey: '' });
    const name = `pousse-sauvegarde-${today()}.json`;
    const file = new File([JSON.stringify(data)], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; a.click();
  }

  async function importData(file) {
    try {
      const d = JSON.parse(await file.text());
      if (d.app !== 'pousse') throw new Error('format');
      for (const m of d.meals) await db.put('meals', m.id, m);
      for (const [k, v] of Object.entries(d.photos || {})) await db.put('photos', k, v);
      for (const k of KV) if (d[k] !== undefined) { S[k] = k === 'settings' ? Object.assign({}, S.settings, d[k], { apiKey: S.settings.apiKey }) : d[k]; await save(k); }
      S.meals = await db.all('meals');
      closeSheet(); render(); toast('Sauvegarde restaurée');
    } catch (e) { toast("Ce fichier n'est pas une sauvegarde Pousse."); }
  }

  /* ---------- Événements ---------- */
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const v = b.dataset.v;
    switch (b.dataset.act) {
      case 'tab': tab = v; render(); window.scrollTo(0, 0); break;
      case 'add': F = newForm(v); openSheet('add'); break;
      case 'close': closeSheet(); render(); break;
      case 'settings': openSheet('settings'); break;
      case 'meal': openSheet('meal', S.meals.find(m => m.id === v)); break;
      case 'askDelete': deleting = true; drawSheet(); break;
      case 'noDelete': deleting = false; drawSheet(); break;
      case 'delete': {
        const m = S.meals.find(x => x.id === v);
        S.meals = S.meals.filter(x => x.id !== v);
        await db.del('meals', v); await db.del('photos', v);
        L.useFoods(S.stock, m.foods || [], -1); save('stock');
        closeSheet(); render(); toast('Repas supprimé'); break;
      }
      case 'moment': { F.moment = v; F.modulen = !!(S.settings.modulen && getMoment(v).modulen); drawSheet(); break; }
      case 'mod': F.modulen = v === '1'; drawSheet(); break;
      case 'qty': F.qty = v; drawSheet(); break;
      case 'feel': F.feel = F.feel === v ? null : v; drawSheet(); break;
      case 'food':
        if (F.foods.includes(v)) { F.picked = F.picked.filter(x => x !== v); F.removed.push(v); }
        else { F.removed = F.removed.filter(x => x !== v); F.picked.push(v); }
        refreshDyn(); break;
      case 'saveMeal': b.disabled = true; await saveMeal(); break;
      case 'water': { const d = today(), c = S.water[d] || 0, n = +v === c ? c - 1 : +v;
        S.water[d] = n; save('water'); render(); if (n === WATER_GOAL && c < WATER_GOAL) toast('Objectif eau atteint, +10 points'); break; }
      case 'hard': { const d = today(); if (S.hard[d]) delete S.hard[d]; else S.hard[d] = true; save('hard'); render(); break; }
      case 'stock': { const cur = (S.stock[v] || { state: 'out' }).state; const next = { out: 'ok', ok: 'low', low: 'out' }[cur];
        L.setStock(S.stock, v, next); save('stock'); render(); break; }
      case 'buy': {
        if (S.basket[v]) { S.stock[v] = S.basket[v]; delete S.basket[v]; }
        else { S.basket[v] = S.stock[v] || { state: 'out', uses: 0, auto: false }; L.setStock(S.stock, v, 'ok'); }
        save('stock'); save('basket'); render(); break;
      }
      case 'clearBasket': S.basket = {}; save('basket'); render(); break;
      case 'shareList': {
        const g = L.shopping(S.stock, S.basket);
        const text = Object.keys(g).map(r => `${r}\n${g[r].filter(i => !i.inBasket).map(i => `- ${i.food.name} : ${i.food.qty}`).join('\n')}`).join('\n\n');
        try { await navigator.share({ title: 'Courses', text }); }
        catch (err) { if (err.name !== 'AbortError') { try { await navigator.clipboard.writeText(text); toast('Liste copiée'); } catch (e2) { toast('Partage indisponible ici'); } } }
        break;
      }
      case 'start': S.active = { start: Date.now() }; save('active'); render(); startClock(); break;
      case 'cancelTimer': S.active = null; save('active'); render(); break;
      case 'finish': {
        const a = S.active, d = new Date(a.start);
        const dur = Math.max(1, Math.round((Date.now() - a.start) / 60000));
        F = newForm(undefined, { start: a.start, time: hhmm(d), duration: String(dur), photo: a.photo || null, thumb: a.thumb || null });
        openSheet('add'); break;
      }
      case 'export': exportData(); break;
    }
  });

  document.addEventListener('input', e => {
    const t = e.target;
    if (F && t.id === 'fText') { F.text = t.value; refreshDyn(); }
    else if (F && t.id === 'fNote') F.note = t.value;
    else if (F && t.id === 'fTime') { F.time = t.value || F.time; refreshDyn(); }
    else if (F && t.id === 'fDur') { F.duration = t.value; refreshDyn(); }
    else if (t.id === 'detailNote') {
      const m = S.meals.find(x => x.id === t.dataset.id);
      if (m) { m.note = t.value; db.put('meals', m.id, m); }
    }
    else if (t.id === 'setKey') { S.settings.apiKey = t.value.trim(); save('settings'); }
    else if (t.id === 'setModel') { S.settings.model = t.value.trim(); save('settings'); }
    else if (t.id === 'setTarget') { S.settings.modulenTarget = t.value; save('settings'); }
  });

  document.addEventListener('change', async e => {
    const t = e.target, file = t.files && t.files[0];
    if (t.id === 'setMod') { S.settings.modulen = t.checked; save('settings'); drawSheet(); return; }
    if (!file) return;
    if (t.id === 'importIn') return importData(file);
    try {
      const [photo, thumb] = await toPhoto(file);
      if (t.id === 'photoIn' && F) { F.photo = photo; F.thumb = thumb; drawSheet(); refreshDyn(); }
      else if (t.id === 'activePhoto' && S.active) { S.active.photo = photo; S.active.thumb = thumb; save('active'); render(); startClock(); }
      else if (t.id === 'fridgeIn') {
        S.fridge = { ts: Date.now(), photo }; save('fridge'); render();
        if (S.settings.apiKey && !PREVIEW) analyseFridge(photo); else toast('Touche les produits que tu vois sur la photo');
      }
    } catch (err) { toast("Cette photo n'a pas pu être lue. Essaie avec une autre."); }
  });

  function startClock() {
    clearInterval(tick);
    const upd = () => {
      const el = $('clock');
      if (!el || !S.active) return;
      const s = Math.max(0, Math.floor((Date.now() - S.active.start) / 1000));
      const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60);
      el.textContent = h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
    };
    upd(); tick = setInterval(upd, 1000);
  }

  /* ---------- Exemples pour l'aperçu ---------- */
  function fakePlate(e) {
    const c = document.createElement('canvas'); c.width = c.height = 160;
    const g = c.getContext('2d');
    g.fillStyle = '#9db9a8'; g.fillRect(0, 0, 160, 160);
    g.fillStyle = '#f7f7f2'; g.beginPath(); g.arc(80, 80, 66, 0, 7); g.fill();
    g.font = '58px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(e, 80, 86);
    return c.toDataURL('image/jpeg', .7);
  }
  function seedPreview() {
    const now = new Date();
    const add = (dayOffset, moment, h, m, duration, text, foods, e, extra) => {
      const d = L.addDays(now, dayOffset); d.setHours(h, m, 0, 0);
      if (d.getTime() > now.getTime()) return;
      S.meals.push(Object.assign({ id: uid(), day: L.dayKey(d), moment, ts: d.getTime(), duration, qty: 'normal', text, note: '', feel: null, foods, thumb: e ? fakePlate(e) : null, modulen: false }, extra || {}));
    };
    for (let i = -7; i <= 0; i++) {
      add(i, 'pdj', 8, 5 + (i & 3) * 5, 6 + (-i % 3), 'Œufs durs et galettes', ['oeuf', 'galette'], '🥚');
      add(i, 'col1', 10, 30, 3, 'Banane', ['banane'], '🍌');
      add(i, 'dej', 12, 40, 8 + (-i % 5) * 2, 'Riz, soupe et poulet', ['riz', 'courge', 'poulet'], '🍚', i === -1 ? { feel: 'stress', note: 'Mangé vite, réunion juste après.' } : { feel: 'faim' });
      if (i % 3 !== 0) add(i, 'col2', 16, 10, 5, 'Pomme cuite', ['pomme'], '🍎');
      add(i, 'din', 19, 45, 10 + (-i % 4) * 3, 'Pommes de terre, courgette, cabillaud', ['pdt', 'courgette', 'poisson'], '🐟');
      if (i === -2 || i === -5) add(i, EXTRA.id, 22, 30, 5, 'Galettes de riz', ['galette'], null, { feel: 'ennui' });
    }
    FOODS.forEach((f, i) => L.setStock(S.stock, f.id, i % 5 === 3 ? 'out' : i % 5 === 1 ? 'low' : 'ok'));
    S.water[today()] = 3;
    for (const m of S.meals) mem.meals.set(m.id, m);
  }

  /* ---------- Démarrage ---------- */
  (async function boot() {
    idb = await openDb();
    if (PREVIEW) seedPreview();
    else {
      for (const k of KV) { const v = await db.get('kv', k); if (v !== undefined) S[k] = k === 'settings' ? Object.assign(S.settings, v) : v; }
      S.meals = await db.all('meals');
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
      if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
      else if ('serviceWorker' in navigator && location.hostname === 'localhost') navigator.serviceWorker.register('sw.js').catch(() => {});
    }
    render();
    if (S.active) startClock();
    // Changement de jour pendant que l'appli reste ouverte
    document.addEventListener('visibilitychange', () => { if (!document.hidden && !sheet) render(), S.active && startClock(); });
  })();
})();
