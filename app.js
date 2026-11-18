'use strict';

/* =========================================================
   Budget à deux — budget du couple
   Toutes les données restent sur l'appareil (localStorage).
   ========================================================= */

const STORE_KEY = 'budget-couple-v1';

/* ---------- Utilitaires ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v, d = 0) => { const n = parseFloat(String(v ?? '').replace(/\s/g, '').replace(',', '.')); return Number.isFinite(n) ? n : d; };
const sum = (arr, f = (x) => x) => arr.reduce((a, x) => a + f(x), 0);
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));

const EUR = new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const EUR2 = new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = (n, precise = false) => (precise ? EUR2 : EUR).format(Math.round((n || 0) * 100) / 100);
const moneyIn = (n) => (n ? String(Math.round(n * 100) / 100).replace('.', ',') : '');

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MONTHS_S = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const pad = (n) => String(n).padStart(2, '0');
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const currentMonth = () => todayISO().slice(0, 7);
const shiftMonth = (ym, n) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const monthLabel = (ym) => { const [y, m] = ym.split('-').map(Number); return `${MONTHS[m - 1]} ${y}`; };
const dayLabel = (iso) => new Date(iso + 'T12:00').toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long' });

const FREQ = {
  monthly: { label: 'Mensuel', n: 12 },
  bimonthly: { label: 'Tous les 2 mois', n: 6 },
  quarterly: { label: 'Trimestriel', n: 4 },
  semiannual: { label: 'Semestriel', n: 2 },
  yearly: { label: 'Annuel', n: 1 },
};
const perMonth = (it) => num(it.amount) * (FREQ[it.freq]?.n ?? 12) / 12;
const occursIn = (it, m) => {
  const n = FREQ[it.freq]?.n ?? 12;
  if (n === 12) return true;
  const step = 12 / n;
  return (((m - (it.month || 1)) % step) + step) % step === 0;
};
const dueMonths = (it) => Array.from({ length: 12 }, (_, i) => i + 1).filter((m) => occursIn(it, m));

const CHARGE_CATS = {
  logement: ['Logement', '🏠'], energie: ['Énergie & eau', '⚡'], assurances: ['Assurances', '🛡️'],
  transport: ['Transport', '🚗'], telecom: ['Télécom & internet', '📱'], abonnements: ['Abonnements', '📺'],
  enfants: ['Enfants', '🧸'], sante: ['Santé', '🩺'], impots: ['Impôts & taxes', '🏛️'],
  credit: ['Crédits', '🏦'], dons: ['Dons & cotisations', '🤝'], autre: ['Autre', '📌'],
};
const INCOME_CATS = {
  salaire: ['Salaire', '💼'], prime: ['Prime / 13e mois', '🎁'], pecule: ['Pécule de vacances', '🏖️'],
  allocations: ['Allocations', '👶'], independant: ['Activité indépendante', '🧾'],
  locatif: ['Revenus locatifs', '🏘️'], autre: ['Autre revenu', '💶'],
};
const POT_ICONS = ['🛟', '🏖️', '🚗', '🏠', '🎓', '👴', '💍', '🎁', '🩺', '💻', '🐷', '🌍'];
const ENV_ICONS = ['🛒', '⛽', '🍽️', '🎉', '🧺', '🎁', '👕', '💊', '🐾', '✂️', '📚', '🧾'];

/* ---------- État ---------- */
function defaultState() {
  return {
    version: 1,
    setup: false,
    settings: { p1: 'Personne 1', p2: 'Personne 2', split: 'equalFree', customPct: 50 },
    transfers: {},
    incomes: [],
    charges: [],
    savings: [],
    envelopes: [
      { id: uid(), name: 'Courses', icon: '🛒', budget: 0 },
      { id: uid(), name: 'Carburant', icon: '⛽', budget: 0 },
      { id: uid(), name: 'Restaurants & sorties', icon: '🍽️', budget: 0 },
      { id: uid(), name: 'Loisirs', icon: '🎉', budget: 0 },
      { id: uid(), name: 'Maison & divers', icon: '🧺', budget: 0 },
    ],
    pocket: { p1: 0, p2: 0 },
    transactions: [],
  };
}

function sampleState(names) {
  const s = defaultState();
  s.setup = true;
  if (names) Object.assign(s.settings, names);
  const inc = (name, owner, cat, amount, freq = 'monthly', month = 1) => ({ id: uid(), name, owner, cat, amount, freq, month });
  s.incomes = [
    inc('Salaire net', 'p1', 'salaire', 2600),
    inc('Salaire net', 'p2', 'salaire', 2200),
    inc('Prime de fin d’année', 'p1', 'prime', 2600, 'yearly', 12),
    inc('Prime de fin d’année', 'p2', 'prime', 2200, 'yearly', 12),
    inc('Pécule de vacances', 'p1', 'pecule', 2300, 'yearly', 5),
    inc('Pécule de vacances', 'p2', 'pecule', 1950, 'yearly', 6),
    inc('Allocations familiales', 'common', 'allocations', 180),
  ];
  const ch = (name, owner, cat, amount, freq = 'monthly', month = 1) => ({ id: uid(), name, owner, cat, amount, freq, month });
  s.charges = [
    ch('Prêt hypothécaire', 'common', 'logement', 1250),
    ch('Électricité & gaz', 'common', 'energie', 190),
    ch('Eau', 'common', 'energie', 135, 'quarterly', 2),
    ch('Internet, TV & GSM', 'common', 'telecom', 85),
    ch('Crèche', 'common', 'enfants', 450),
    ch('Streaming', 'common', 'abonnements', 18),
    ch('Assurance habitation', 'common', 'assurances', 420, 'yearly', 3),
    ch('Assurance auto', 'common', 'assurances', 780, 'yearly', 9),
    ch('Taxe de circulation', 'common', 'impots', 260, 'yearly', 6),
    ch('Précompte immobilier', 'common', 'impots', 1100, 'yearly', 8),
    ch('Mutuelle', 'common', 'sante', 90, 'quarterly', 1),
    ch('Salle de sport', 'p1', 'abonnements', 35),
    ch('Abonnement train', 'p2', 'transport', 60),
  ];
  const pot = (name, icon, owner, target, balance, monthly) => ({ id: uid(), name, icon, owner, target, balance, monthly, lastApplied: '', history: [] });
  s.savings = [
    pot('Épargne de précaution', '🛟', 'common', 15000, 6200, 400),
    pot('Vacances', '🏖️', 'common', 3000, 900, 250),
    pot('Prochaine voiture', '🚗', 'common', 10000, 2500, 150),
    pot('Épargne-pension', '👴', 'p1', 1020, 340, 85),
    pot('Épargne-pension', '👴', 'p2', 1020, 255, 85),
  ];
  ['Compte épargne précaution', 'Compte épargne vacances', 'Compte épargne voiture', 'Épargne-pension', 'Épargne-pension']
    .forEach((acc, i) => { s.savings[i].account = acc; });
  s.settings.commonAccount = 'Compte commun';
  const budgets = [750, 150, 150, 100, 80];
  s.envelopes.forEach((e, i) => { e.budget = budgets[i]; });
  s.envelopes.push({ id: uid(), name: 'Cadeaux', icon: '🎁', budget: 50 });
  s.pocket = { p1: 150, p2: 150 };
  const ym = currentMonth();
  const day = Math.max(1, Math.min(new Date().getDate(), 28));
  const d = (n) => `${ym}-${pad(clamp(n, 1, day))}`;
  const env = (i) => 'env:' + s.envelopes[i].id;
  const tx = (date, amount, cat, note) => ({ id: uid(), date, amount, cat, note });
  s.transactions = [
    tx(d(2), 142.35, env(0), 'Supermarché'),
    tx(d(5), 68.9, env(1), 'Plein'),
    tx(d(6), 38.4, env(2), 'Pizzeria'),
    tx(d(9), 96.1, env(0), 'Supermarché'),
    tx(d(10), 24.99, 'pocket:p1', 'Livre'),
    tx(d(12), 45, 'pocket:p2', 'Coiffeur'),
    tx(d(14), 31.5, env(4), 'Ampoules & rangement'),
    tx(d(15), 120.8, env(0), 'Courses de la semaine'),
  ];
  return s;
}

function normalize(s) {
  const d = defaultState();
  const out = Object.assign({}, d, s || {});
  out.settings = Object.assign({}, d.settings, s?.settings || {});
  out.pocket = Object.assign({}, d.pocket, s?.pocket || {});
  if (!out.transfers || typeof out.transfers !== 'object') out.transfers = {};
  for (const k of ['incomes', 'charges', 'savings', 'envelopes', 'transactions']) if (!Array.isArray(out[k])) out[k] = d[k];
  out.savings.forEach((p) => { if (!Array.isArray(p.history)) p.history = []; });
  return out;
}
function load() {
  try { const raw = localStorage.getItem(STORE_KEY); return raw ? normalize(JSON.parse(raw)) : defaultState(); }
  catch { return defaultState(); }
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
  catch { toast('⚠️ Impossible d’enregistrer sur cet appareil'); }
}

let state = load();
const ui = { view: 'home', month: currentMonth() };
try { const v = sessionStorage.getItem('bc-view'); if (v) ui.view = v; } catch { /* ignore */ }

/* ---------- Personnes ---------- */
const OWNERS = ['common', 'p1', 'p2'];
const ownerName = (o) => (o === 'common' ? 'Commun' : state.settings[o] || o);
const ownerChip = (o) => `<span class="chip ${o}">${esc(ownerName(o))}</span>`;
const initial = (o) => esc((state.settings[o] || '?').trim().charAt(0).toUpperCase() || '?');
const ownerOptions = (withCommon = true) => (withCommon ? OWNERS : ['p1', 'p2']).map((o) => [o, ownerName(o)]);

/* ---------- Calculs ---------- */
function plan() {
  const s = state;
  const by = () => ({ common: 0, p1: 0, p2: 0 });
  const inc = by(), ch = by(), sav = by();
  s.incomes.forEach((i) => { inc[i.owner] += perMonth(i); });
  s.charges.forEach((c) => { ch[c.owner] += perMonth(c); });
  s.savings.forEach((p) => { sav[p.owner] += num(p.monthly); });
  const env = sum(s.envelopes, (e) => num(e.budget));
  const pocket = { p1: num(s.pocket.p1), p2: num(s.pocket.p2) };

  const commonNeed = ch.common + sav.common + env - inc.common;
  const need = Math.max(0, commonNeed);

  // Ce qu'il reste à chacun AVANT sa part commune (revenus − charges, épargne et poche perso)
  const avail = {
    p1: inc.p1 - ch.p1 - sav.p1 - pocket.p1,
    p2: inc.p2 - ch.p2 - sav.p2 - pocket.p2,
  };
  let share1 = 0.5;
  let equalOk = true;
  if (s.settings.split === 'custom') share1 = clamp(num(s.settings.customPct, 50), 0, 100) / 100;
  else if (s.settings.split === 'prorata') { const t = inc.p1 + inc.p2; share1 = t > 0 ? inc.p1 / t : 0.5; }
  else if (s.settings.split === 'equalFree') {
    // Même reste libre pour les deux : p1 verse (besoin + écart) / 2
    const c1 = (need + avail.p1 - avail.p2) / 2;
    equalOk = c1 >= 0 && c1 <= need;
    share1 = need > 0 ? clamp(c1, 0, need) / need : 0.5;
  }
  const contrib = { p1: need * share1, p2: need * (1 - share1) };
  const free = {
    p1: inc.p1 - contrib.p1 - ch.p1 - sav.p1 - pocket.p1,
    p2: inc.p2 - contrib.p2 - ch.p2 - sav.p2 - pocket.p2,
    common: Math.max(0, -commonNeed),
  };
  const T = (o) => o.common + o.p1 + o.p2;
  const totals = { income: T(inc), charges: T(ch), savings: T(sav), pocket: pocket.p1 + pocket.p2, envelopes: env };
  totals.free = totals.income - totals.charges - totals.savings - totals.pocket - totals.envelopes;
  return { inc, ch, sav, env, pocket, share1, contrib, free, totals, commonNeed, need, avail, equalOk };
}

const txOfMonth = (ym) => state.transactions.filter((t) => t.date.startsWith(ym));
function monthActuals(ym) {
  const list = txOfMonth(ym);
  const env = {}; state.envelopes.forEach((e) => { env[e.id] = 0; });
  const pocket = { p1: 0, p2: 0 };
  let other = 0;
  list.forEach((t) => {
    const a = num(t.amount);
    if (t.cat.startsWith('env:')) { const id = t.cat.slice(4); if (id in env) env[id] += a; else other += a; }
    else if (t.cat.startsWith('pocket:')) pocket[t.cat.slice(7)] = (pocket[t.cat.slice(7)] || 0) + a;
    else other += a;
  });
  return { list, env, pocket, other, envTotal: sum(Object.values(env)) };
}
const catLabel = (cat) => {
  if (cat.startsWith('env:')) { const e = state.envelopes.find((x) => x.id === cat.slice(4)); return e ? [e.name, e.icon] : ['Enveloppe supprimée', '❔']; }
  if (cat.startsWith('pocket:')) return [`Poche · ${ownerName(cat.slice(7))}`, '👛'];
  return ['Hors budget', '⚠️'];
};

/* ---------- Icônes de navigation ---------- */
const ICONS = {
  home: '<path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  incomes: '<path d="M12 3v11m0 0-4.5-4.5M12 14l4.5-4.5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
  charges: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3"/>',
  spending: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h3l2.6 12.2a1 1 0 0 0 1 .8h9.7a1 1 0 0 0 1-.8L21 7H6"/>',
  savings: '<path d="M19 9.5c1.2.4 2 1.4 2 2.5M5 10.5C5 7.5 8 5 12 5s7 2.5 7 6c0 2-1 3.6-2.6 4.6V19h-2.6v-1.6c-.6.1-1.2.1-1.8.1s-1.2 0-1.8-.1V19H7.6v-2.4C6 15.6 5 14 5 12"/><circle cx="15" cy="10" r=".9" fill="currentColor"/><path d="M3 11h2"/>',
  pocket: '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H17v3M3 7.5V18a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2H5.5A2.5 2.5 0 0 1 3 7.5zM16.5 14h1.5"/>',
  settings: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
};
const svgIcon = (k) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k]}</svg>`;

const VIEWS = [
  ['home', 'Accueil', 'Vue d’ensemble'],
  ['incomes', 'Revenus', 'Revenus'],
  ['charges', 'Charges', 'Charges fixes'],
  ['spending', 'Dépenses', 'Dépenses du mois'],
  ['savings', 'Épargne', 'Épargne'],
  ['pocket', 'Poche', 'Argent de poche'],
  ['settings', 'Réglages', 'Réglages'],
];
const MONTH_VIEWS = new Set(['home', 'spending', 'pocket', 'savings']);

/* ---------- Rendu principal ---------- */
function render() {
  const nav = $('#nav');
  if (!state.setup) {
    nav.classList.add('hidden');
    $('.app').classList.add('no-nav');
    $('#topbar').classList.add('hidden');
    $('#view').innerHTML = renderWelcome();
    return;
  }
  nav.classList.remove('hidden');
  $('.app').classList.remove('no-nav');
  $('#topbar').classList.remove('hidden');
  nav.innerHTML = `<div class="brand"><img src="icons/icon-192.png" alt="">Budget à deux</div>` +
    VIEWS.map(([k, short]) => `<button data-nav="${k}" ${ui.view === k ? 'aria-current="page"' : ''}>${svgIcon(k)}<span>${short}</span></button>`).join('');
  const v = VIEWS.find((x) => x[0] === ui.view) || VIEWS[0];
  $('#topbar').innerHTML = `<h1>${v[2]}</h1><span class="spacer"></span>` + (MONTH_VIEWS.has(ui.view)
    ? `<div class="month-nav"><button data-act="month" data-n="-1" aria-label="Mois précédent">‹</button><span>${monthLabel(ui.month)}</span><button data-act="month" data-n="1" aria-label="Mois suivant">›</button></div>`
    : '');
  const fn = { home: renderHome, incomes: renderIncomes, charges: renderCharges, spending: renderSpending, savings: renderSavings, pocket: renderPocket, settings: renderSettings }[ui.view] || renderHome;
  $('#view').innerHTML = fn();
}

/* ---------- Bienvenue ---------- */
function renderWelcome() {
  return `<div class="welcome">
    <img src="icons/icon-192.png" alt="">
    <h2>Budget à deux</h2>
    <p>Revenus, charges mensuelles et annuelles, épargne, enveloppes et argent de poche : tout le budget du couple au même endroit. Les données restent sur cet appareil.</p>
    <form class="card stack" id="welcome-form">
      <div class="grid two" style="gap:12px">
        <label class="field"><span>Prénom 1</span><input name="p1" required autocomplete="off" placeholder="Ex. Alex"></label>
        <label class="field"><span>Prénom 2</span><input name="p2" required autocomplete="off" placeholder="Ex. Sam"></label>
      </div>
      <button class="btn primary" type="submit">Commencer avec un budget vide</button>
      <button class="btn" type="button" data-act="sample">Découvrir avec des données d’exemple</button>
    </form>
  </div>`;
}
function welcomeNames() {
  const f = $('#welcome-form');
  const p1 = f.p1.value.trim(), p2 = f.p2.value.trim();
  return { p1: p1 || 'Personne 1', p2: p2 || 'Personne 2' };
}

/* ---------- Accueil ---------- */
function kpi(label, value, sub = '', color = '') {
  return `<div class="card kpi"><div class="label">${color ? `<span class="dot" style="background:${color}"></span>` : ''}${label}</div><div class="value num">${value}</div>${sub ? `<div class="sub">${sub}</div>` : ''}</div>`;
}
function renderHome() {
  const p = plan();
  const a = monthActuals(ui.month);
  const t = p.totals;
  const freeCls = t.free < 0 ? 'neg' : '';
  const base = Math.max(t.income, t.charges + t.savings + t.pocket + t.envelopes, 1);
  const segs = [
    ['Charges fixes', t.charges, 'var(--c-charges)'],
    ['Épargne', t.savings, 'var(--c-savings)'],
    ['Argent de poche', t.pocket, 'var(--c-pocket)'],
    ['Dépenses courantes', t.envelopes, 'var(--c-env)'],
    ['Non affecté', Math.max(0, t.free), 'var(--c-free)'],
  ];
  const savedTotal = sum(state.savings, (x) => num(x.balance));
  const [, mm] = ui.month.split('-').map(Number);
  const monthIncome = sum(state.incomes.filter((i) => occursIn(i, mm)), (i) => num(i.amount));
  const monthCharges = sum(state.charges.filter((c) => occursIn(c, mm)), (c) => num(c.amount));

  let html = '';
  if (!state.incomes.length && !state.charges.length) {
    html += `<div class="notice" style="margin-bottom:16px">👋 Commencez par ajouter vos <b>revenus</b> puis vos <b>charges fixes</b> ; le tableau de bord se remplira automatiquement.</div>`;
  }
  html += `<div class="grid kpis">
    ${kpi('Revenus / mois', money(t.income), 'moyenne lissée sur 12 mois')}
    ${kpi('Charges fixes', money(t.charges), 'y c. provisions annuelles', 'var(--c-charges)')}
    ${kpi('Épargne programmée', money(t.savings), `${money(savedTotal)} déjà épargnés`, 'var(--c-savings)')}
    ${kpi('Non affecté', `<span class="${freeCls}">${money(t.free)}</span>`, t.free < 0 ? 'budget en déficit !' : 'marge de manœuvre')}
  </div>`;

  html += transferCard(p, mm);

  html += `<div class="section-title"><h2>Répartition du budget mensuel</h2></div>
  <div class="card">
    <div class="bar lg">${segs.filter((s) => s[1] > 0).map((s) => `<span title="${s[0]}" style="width:${(s[1] / base) * 100}%;background:${s[2]}"></span>`).join('')}</div>
    <div class="legend">${segs.map((s) => `<div><span class="dot" style="background:${s[2]}"></span>${s[0]}<span class="num">${money(s[1])}</span></div>`).join('')}</div>
    ${t.free < 0 ? `<div class="notice warn" style="margin-top:14px">⚠️ Les dépenses prévues dépassent les revenus de <b>${money(-t.free)}</b> par mois.</div>` : ''}
  </div>`;

  html += `<div class="grid two" style="margin-top:16px">`;

  // Enveloppes du mois
  html += `<div class="card">
    <h3>🛒 Dépenses courantes — ${MONTHS[mm - 1]}</h3>
    ${envelopesBlock(a)}
    <div class="row" style="margin-top:12px"><span class="muted small">Total ${money(a.envTotal)} / ${money(p.env)}${a.other ? ` · hors budget ${money(a.other)}` : ''}</span><span class="spacer"></span><button class="btn sm primary" data-act="tx-new">+ Dépense</button></div>
  </div>`;

  // Poche
  html += `<div class="card"><h3>👛 Argent de poche</h3><div class="env">${['p1', 'p2'].map((o) => {
    const b = p.pocket[o], sp = a.pocket[o] || 0;
    return envRow(`<span class="avatar ${o}" style="width:26px;height:26px;font-size:.8rem">${initial(o)}</span>${esc(ownerName(o))}`, sp, b);
  }).join('')}</div></div>`;

  // Échéances
  html += `<div class="card"><h3>📅 Échéances à venir</h3>${upcomingBlock(mm)}
    <p class="muted small" style="margin:10px 0 0">Ce mois-ci : ${money(monthIncome)} de revenus attendus et ${money(monthCharges)} de charges à payer.</p></div>`;
  html += `</div>`;
  return html;
}

const SPLIT_MODES = {
  equalFree: 'Même reste pour chacun',
  prorata: 'Au prorata des revenus',
  equal: '50 / 50',
  custom: 'Personnalisé',
};
/* ---------- Virements : une ligne par compte et par personne ---------- */
const round2 = (n) => Math.round(n * 100) / 100;
function splitAmount(x, share1) {
  const total = Math.round(x);
  const a1 = Math.round(x * share1);
  return { p1: a1, p2: total - a1 };
}
function transferLines(p) {
  const commonBase = p.ch.common + p.env - p.inc.common;
  const commonAcct = Math.max(0, commonBase);
  const surplus = Math.max(0, -commonBase); // revenus communs > charges : réduit l'épargne commune à financer
  const potScale = p.sav.common > 0 ? Math.max(0, p.sav.common - surplus) / p.sav.common : 0;
  const lines = { p1: [], p2: [] };
  const c = splitAmount(commonAcct, p.share1);
  ['p1', 'p2'].forEach((o) => {
    if (c[o] > 0) lines[o].push({ key: 'common', label: 'Compte commun', sub: 'Charges & dépenses courantes', icon: '🏦', account: state.settings.commonAccount, amount: c[o] });
  });
  state.savings.forEach((pot) => {
    const m = num(pot.monthly);
    if (!m) return;
    const a = pot.owner === 'common' ? splitAmount(m * potScale, p.share1) : { p1: 0, p2: 0, [pot.owner]: round2(m) };
    ['p1', 'p2'].forEach((o) => {
      if (a[o] > 0) lines[o].push({ key: pot.id, label: pot.name, sub: pot.owner === 'common' ? 'Épargne commune' : 'Épargne perso', icon: pot.icon || '🐷', account: pot.account, amount: a[o], pot });
    });
  });
  return lines;
}
const transferDone = (ym, o, key) => !!state.transfers?.[ym]?.[`${o}:${key}`];
// Coche / décoche un virement. Pour un compte d'épargne, le solde de l'objectif est mis à jour.
function toggleTransfer(o, key, on) {
  const ym = ui.month;
  const m = (state.transfers[ym] ||= {});
  const k = `${o}:${key}`;
  if (on === undefined) on = !m[k];
  if (!!m[k] === on) return null;
  if (on) {
    const line = transferLines(plan())[o].find((l) => l.key === key);
    const rec = { at: todayISO() };
    if (line?.pot) {
      const hid = uid();
      line.pot.balance = round2(num(line.pot.balance) + line.amount);
      line.pot.history.unshift({ id: hid, date: todayISO(), amount: line.amount, note: `Virement ${ownerName(o)} · ${monthLabel(ym)}` });
      Object.assign(rec, { pot: line.pot.id, amount: line.amount, hid });
    }
    m[k] = rec;
    return line;
  }
  const rec = m[k];
  const pot = rec?.pot && state.savings.find((x) => x.id === rec.pot);
  if (pot) {
    pot.balance = round2(num(pot.balance) - num(rec.amount));
    pot.history = pot.history.filter((h) => h.id !== rec.hid);
  }
  delete m[k];
  return null;
}
function pendingSavingsLines() {
  const L = transferLines(plan());
  return ['p1', 'p2'].flatMap((o) => L[o].filter((l) => l.pot && !transferDone(ui.month, o, l.key)).map((l) => [o, l]));
}
function potDoneThisMonth(pot) {
  const L = transferLines(plan());
  const mine = ['p1', 'p2'].flatMap((o) => L[o].filter((l) => l.key === pot.id).map((l) => [o, l]));
  return mine.length > 0 && mine.every(([o, l]) => transferDone(ui.month, o, l.key));
}

function transferCard(p, mm) {
  const s = state.settings;
  const lines = transferLines(p);
  const col = (o) => {
    const L = lines[o];
    const total = sum(L, (l) => l.amount);
    const nDone = L.filter((l) => transferDone(ui.month, o, l.key)).length;
    const all = L.length && nDone === L.length;
    return `<div class="card tcol">
      <div class="who"><span class="avatar ${o}">${initial(o)}</span>
        <div><b>${esc(s[o])}</b><div class="small ${all ? 'pos' : 'muted'}">${all ? '✓ Tous les virements sont faits' : `${nDone} / ${L.length} virement${L.length > 1 ? 's' : ''} fait${nDone > 1 ? 's' : ''}`}</div></div>
        <span class="spacer"></span><div class="tot num">${money(total)}</div></div>
      ${L.length ? `<ul class="list">${L.map((l) => {
        const d = transferDone(ui.month, o, l.key);
        return `<li><label class="item tline ${d ? 'done' : ''}">
          <input type="checkbox" data-transfer="${o}|${esc(l.key)}" ${d ? 'checked' : ''} aria-label="${esc(l.label)} : virement fait">
          <span class="ico">${l.icon}</span>
          <span class="body"><span class="title">${esc(l.label)}</span><span class="meta">${esc(l.account || l.sub)}</span></span>
          <span class="amount num">${money(l.amount)}</span></label></li>`;
      }).join('')}</ul>` : '<div class="empty">Aucun virement à faire.</div>'}
    </div>`;
  };
  const neg = (v) => (v > 0.005 ? `−${money(v)}` : money(0));
  const parts = [
    [p.ch.common, 'charges communes'], [p.env, 'dépenses courantes'], [p.sav.common, 'épargne commune'],
  ].filter(([v]) => v > 0).map(([v, l]) => `${money(v)} de ${l}`).join(' + ');
  let modeNote;
  if (s.split === 'equalFree') {
    if (p.equalOk) {
      modeNote = `<div class="notice" style="margin-top:12px">⚖️ Les virements sont calculés pour qu’il vous reste <b>exactement la même somme</b> à chacun : <b class="num">${money(p.free.p1)}</b> par mois (en plus de l’argent de poche).</div>`;
    } else {
      const rich = p.avail.p1 > p.avail.p2 ? 'p1' : 'p2', poor = rich === 'p1' ? 'p2' : 'p1';
      const gap = Math.abs(p.free.p1 - p.free.p2);
      modeNote = `<div class="notice warn" style="margin-top:12px">⚠️ L’écart de revenus dépasse le besoin commun : même en payant toute la part commune, ${esc(s[rich])} garde ${money(gap)} de plus. Pour être à égalité, ${esc(s[rich])} peut verser en plus <b class="num">${money(gap / 2)}</b> à ${esc(s[poor])}.</div>`;
    }
  } else {
    modeNote = `<p class="muted small" style="margin:10px 0 0">Mode de partage : ${SPLIT_MODES[s.split] || s.split}. Modifiable dans Réglages.</p>`;
  }
  return `<div class="section-title"><h2>💸 Virements de ${MONTHS[mm - 1]}</h2><span class="spacer"></span><span class="muted small">Cochez chaque virement une fois fait</span></div>
  <div class="grid two">${col('p1')}${col('p2')}</div>
  ${modeNote}
  <details class="card details" style="margin-top:12px"><summary>Détail du calcul</summary>
    <p class="muted small">Part commune : <b class="num">${money(p.need)}</b> par mois${parts ? ` (${parts}${p.inc.common ? `, moins ${money(p.inc.common)} de revenus communs` : ''})` : ''}. Les charges et dépenses courantes vont sur le compte commun, chaque objectif d’épargne sur son propre compte.</p>
    <table class="split-table">
      <thead><tr><th>Par mois</th><th>${esc(s.p1)}</th><th>${esc(s.p2)}</th></tr></thead>
      <tbody>
        <tr><td>Revenus perso</td><td class="num">${money(p.inc.p1)}</td><td class="num">${money(p.inc.p2)}</td></tr>
        <tr><td>Charges perso</td><td class="num">${neg(p.ch.p1)}</td><td class="num">${neg(p.ch.p2)}</td></tr>
        <tr><td>Épargne perso</td><td class="num">${neg(p.sav.p1)}</td><td class="num">${neg(p.sav.p2)}</td></tr>
        <tr><td>Argent de poche</td><td class="num">${neg(p.pocket.p1)}</td><td class="num">${neg(p.pocket.p2)}</td></tr>
        <tr class="highlight"><td><b>Part commune</b> (${Math.round(p.share1 * 100)} / ${100 - Math.round(p.share1 * 100)} %)</td><td class="num"><b>${neg(p.contrib.p1)}</b></td><td class="num"><b>${neg(p.contrib.p2)}</b></td></tr>
        <tr class="total"><td>Reste libre</td><td class="num ${p.free.p1 < 0 ? 'neg' : ''}">${money(p.free.p1)}</td><td class="num ${p.free.p2 < 0 ? 'neg' : ''}">${money(p.free.p2)}</td></tr>
      </tbody>
    </table>
  </details>`;
}

function envRow(nameHtml, spent, budget) {
  const pct = budget > 0 ? (spent / budget) * 100 : (spent > 0 ? 100 : 0);
  const cls = pct > 100 ? 'over' : pct > 85 ? 'warn' : '';
  const left = budget - spent;
  return `<div class="env-row"><div class="name">${nameHtml}</div>
    <div class="vals num"><b>${money(spent)}</b> <span class="muted">/ ${money(budget)}</span><br><span class="small ${left < 0 ? 'neg' : 'muted'}">${left < 0 ? `dépassé de ${money(-left)}` : `reste ${money(left)}`}</span></div>
    <div class="progress ${cls}"><span style="width:${clamp(pct, 0, 100)}%"></span></div></div>`;
}
function envelopesBlock(a) {
  if (!state.envelopes.length) return `<div class="empty">Aucune enveloppe. Ajoutez-en dans « Dépenses ».</div>`;
  return `<div class="env">${state.envelopes.map((e) => envRow(`<span>${e.icon}</span><span>${esc(e.name)}</span>`, a.env[e.id] || 0, num(e.budget))).join('')}</div>`;
}
function upcomingBlock(fromMonth) {
  const rows = [];
  for (let k = 0; k < 3; k++) {
    const m = ((fromMonth - 1 + k) % 12) + 1;
    state.charges.filter((c) => c.freq !== 'monthly' && occursIn(c, m)).forEach((c) => rows.push([m, c]));
  }
  if (!rows.length) return `<div class="empty">Aucune charge non mensuelle dans les 3 prochains mois.</div>`;
  return `<ul class="list">${rows.map(([m, c]) => `<li><button class="item" data-act="charge-edit" data-id="${c.id}" style="padding:10px 0">
    <span class="ico">${(CHARGE_CATS[c.cat] || CHARGE_CATS.autre)[1]}</span>
    <span class="body"><span class="title">${esc(c.name)}</span><span class="meta">${MONTHS[m - 1]} · ${FREQ[c.freq].label} ${ownerChip(c.owner)}</span></span>
    <span class="amount num">${money(c.amount)}</span></button></li>`).join('')}</ul>`;
}

/* ---------- Revenus ---------- */
function renderIncomes() {
  const p = plan();
  let html = `<div class="grid kpis">
    ${kpi('Total / mois', money(p.totals.income), 'moyenne lissée')}
    ${kpi(esc(state.settings.p1), money(p.inc.p1), '', 'var(--c-p1)')}
    ${kpi(esc(state.settings.p2), money(p.inc.p2), '', 'var(--c-p2)')}
    ${p.inc.common ? kpi('Commun', money(p.inc.common), '', 'var(--accent)') : ''}
  </div>
  <div class="section-title"><h2>Sources de revenus</h2><span class="spacer"></span><button class="btn sm primary" data-act="income-new">+ Revenu</button></div>
  <div class="card flush">`;
  const groups = ['p1', 'p2', 'common'].map((o) => [o, state.incomes.filter((i) => i.owner === o)]).filter(([, l]) => l.length);
  if (!groups.length) html += `<div class="empty">Aucun revenu encore. Ajoutez les salaires, primes, pécule de vacances, allocations…</div>`;
  groups.forEach(([o, list]) => {
    html += `<div class="group-head"><span>${esc(ownerName(o))}</span><span class="num">${money(sum(list, perMonth))} / mois</span></div><ul class="list">`;
    list.forEach((i) => {
      const [cl, ic] = INCOME_CATS[i.cat] || INCOME_CATS.autre;
      const when = i.freq === 'monthly' ? '' : ` · ${dueMonths(i).map((m) => MONTHS_S[m - 1]).join(', ')}`;
      html += `<li><button class="item" data-act="income-edit" data-id="${i.id}"><span class="ico">${ic}</span>
        <span class="body"><span class="title">${esc(i.name)}</span><span class="meta">${cl} · ${FREQ[i.freq].label}${when}</span></span>
        <span class="amount num">${money(i.amount)}${i.freq !== 'monthly' ? `<span class="sub">≈ ${money(perMonth(i))} / mois</span>` : ''}</span></button></li>`;
    });
    html += `</ul>`;
  });
  html += `</div><p class="muted small">Les revenus non mensuels (13e mois, pécule…) sont lissés sur l’année pour calculer le budget mensuel.</p>`;
  return html;
}
function incomeForm(id) {
  const i = state.incomes.find((x) => x.id === id);
  formModal({
    title: i ? 'Modifier le revenu' : 'Nouveau revenu',
    fields: [
      { name: 'name', label: 'Libellé', type: 'text', value: i?.name ?? '', required: true, placeholder: 'Ex. Salaire net' },
      { name: 'amount', label: 'Montant net', type: 'money', value: i?.amount, required: true, half: true },
      { name: 'cat', label: 'Type', type: 'select', value: i?.cat ?? 'salaire', options: Object.entries(INCOME_CATS).map(([k, [l, ic]]) => [k, `${ic} ${l}`]), half: true },
      { name: 'owner', label: 'Perçu par', type: 'seg', value: i?.owner ?? 'p1', options: ownerOptions() },
      { name: 'freq', label: 'Fréquence', type: 'select', value: i?.freq ?? 'monthly', options: Object.entries(FREQ).map(([k, f]) => [k, f.label]), half: true },
      { name: 'month', label: 'Mois de versement', type: 'select', value: i?.month ?? 1, options: MONTHS.map((m, k) => [k + 1, m]), half: true, showIf: ['freq', (v) => v !== 'monthly'], hint: 'Premier mois de l’année concerné' },
    ],
    onSave: (v) => upsert('incomes', id, { ...v, month: Number(v.month) }),
    onDelete: i ? () => remove('incomes', id) : null,
  });
}

/* ---------- Charges ---------- */
function renderCharges() {
  const p = plan();
  const monthly = state.charges.filter((c) => c.freq === 'monthly');
  const other = state.charges.filter((c) => c.freq !== 'monthly');
  const provision = sum(other, perMonth);
  let html = `<div class="grid kpis">
    ${kpi('Total mensualisé', money(p.totals.charges), `${money(p.totals.charges * 12)} par an`, 'var(--c-charges)')}
    ${kpi('Charges mensuelles', money(sum(monthly, perMonth)), `${monthly.length} postes`)}
    ${kpi('Provision à mettre de côté', money(provision), `pour ${other.length} charges non mensuelles`)}
    ${kpi('Commun / perso', money(p.ch.common), `${money(p.ch.p1 + p.ch.p2)} de charges perso`)}
  </div>`;

  html += `<div class="section-title"><h2>Calendrier des charges non mensuelles</h2></div>
    <div class="card">${chargesChart(other, provision)}
    <p class="muted small" style="margin:8px 0 0">En mettant <b>${money(provision)}</b> de côté chaque mois, les grosses factures annuelles sont couvertes sans surprise. La ligne pointillée indique cette provision mensuelle.</p></div>`;

  html += `<div class="section-title"><h2>Toutes les charges</h2><span class="spacer"></span><button class="btn sm primary" data-act="charge-new">+ Charge</button></div><div class="card flush">`;
  if (!state.charges.length) html += `<div class="empty">Aucune charge. Ajoutez loyer/prêt, énergie, assurances, abonnements, taxes…</div>`;
  Object.entries(CHARGE_CATS).forEach(([k, [label, ic]]) => {
    const list = state.charges.filter((c) => (CHARGE_CATS[c.cat] ? c.cat : 'autre') === k);
    if (!list.length) return;
    html += `<div class="group-head"><span>${ic} ${label}</span><span class="num">${money(sum(list, perMonth))} / mois</span></div><ul class="list">`;
    list.forEach((c) => {
      const when = c.freq === 'monthly' ? '' : ` · ${dueMonths(c).map((m) => MONTHS_S[m - 1]).join(', ')}`;
      html += `<li><button class="item" data-act="charge-edit" data-id="${c.id}"><span class="ico">${ic}</span>
        <span class="body"><span class="title">${esc(c.name)}</span><span class="meta">${FREQ[c.freq].label}${when} ${ownerChip(c.owner)}</span></span>
        <span class="amount num">${money(c.amount)}${c.freq !== 'monthly' ? `<span class="sub">≈ ${money(perMonth(c))} / mois</span>` : ''}</span></button></li>`;
    });
    html += `</ul>`;
  });
  html += `</div>`;
  return html;
}
function chargesChart(list, provision) {
  const vals = Array.from({ length: 12 }, (_, i) => sum(list.filter((c) => occursIn(c, i + 1)), (c) => num(c.amount)));
  const max = Math.max(...vals, provision, 1);
  const W = 720, H = 210, padL = 8, padB = 24, padT = 22, bw = (W - padL * 2) / 12;
  const y = (v) => H - padB - (v / max) * (H - padB - padT);
  let svg = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Charges non mensuelles par mois">`;
  vals.forEach((v, i) => {
    const x = padL + i * bw + bw * 0.18, w = bw * 0.64;
    if (v > 0) {
      svg += `<rect x="${x}" y="${y(v)}" width="${w}" height="${H - padB - y(v)}" rx="5" fill="var(--c-charges)"><title>${MONTHS[i]} : ${money(v)}</title></rect>`;
      svg += `<text class="lbl" x="${x + w / 2}" y="${y(v) - 6}" text-anchor="middle">${Math.round(v)}</text>`;
    }
    svg += `<text x="${x + w / 2}" y="${H - 6}" text-anchor="middle">${MONTHS_S[i]}</text>`;
  });
  svg += `<line x1="${padL}" x2="${W - padL}" y1="${H - padB}" y2="${H - padB}" stroke="var(--border)"/>`;
  if (provision > 0) svg += `<line x1="${padL}" x2="${W - padL}" y1="${y(provision)}" y2="${y(provision)}" stroke="var(--accent)" stroke-width="2" stroke-dasharray="6 5"/>`;
  return svg + `</svg>`;
}
function chargeForm(id) {
  const c = state.charges.find((x) => x.id === id);
  formModal({
    title: c ? 'Modifier la charge' : 'Nouvelle charge',
    fields: [
      { name: 'name', label: 'Libellé', type: 'text', value: c?.name ?? '', required: true, placeholder: 'Ex. Assurance habitation' },
      { name: 'amount', label: 'Montant par échéance', type: 'money', value: c?.amount, required: true, half: true },
      { name: 'cat', label: 'Catégorie', type: 'select', value: c?.cat ?? 'logement', options: Object.entries(CHARGE_CATS).map(([k, [l, ic]]) => [k, `${ic} ${l}`]), half: true },
      { name: 'owner', label: 'Payé par', type: 'seg', value: c?.owner ?? 'common', options: ownerOptions() },
      { name: 'freq', label: 'Fréquence', type: 'select', value: c?.freq ?? 'monthly', options: Object.entries(FREQ).map(([k, f]) => [k, f.label]), half: true },
      { name: 'month', label: 'Mois d’échéance', type: 'select', value: c?.month ?? 1, options: MONTHS.map((m, k) => [k + 1, m]), half: true, showIf: ['freq', (v) => v !== 'monthly'], hint: 'Premier mois de l’année concerné' },
    ],
    onSave: (v) => upsert('charges', id, { ...v, month: Number(v.month) }),
    onDelete: c ? () => remove('charges', id) : null,
  });
}

/* ---------- Dépenses courantes ---------- */
function renderSpending() {
  const p = plan();
  const a = monthActuals(ui.month);
  const totalBudget = p.env;
  let html = `<div class="fab-row"><button class="btn primary" data-act="tx-new">+ Nouvelle dépense</button><button class="btn" data-act="env-new">+ Enveloppe</button></div>
  <div class="grid kpis" style="margin-top:12px">
    ${kpi('Dépensé ce mois', money(a.envTotal), `sur ${money(totalBudget)} prévus`, 'var(--c-env)')}
    ${kpi('Reste à dépenser', `<span class="${totalBudget - a.envTotal < 0 ? 'neg' : ''}">${money(totalBudget - a.envTotal)}</span>`)}
    ${kpi('Hors budget', money(a.other), 'dépenses imprévues')}
  </div>
  <div class="section-title"><h2>Enveloppes</h2><span class="muted small">Touchez une enveloppe pour la modifier</span></div>
  <div class="card flush"><ul class="list">`;
  if (!state.envelopes.length) html += `<div class="empty">Aucune enveloppe.</div>`;
  state.envelopes.forEach((e) => {
    const sp = a.env[e.id] || 0, b = num(e.budget);
    const pct = b > 0 ? (sp / b) * 100 : sp > 0 ? 100 : 0;
    const cls = pct > 100 ? 'over' : pct > 85 ? 'warn' : '';
    html += `<li><div class="row" style="padding-right:12px"><button class="item" data-act="env-edit" data-id="${e.id}"><span class="ico">${e.icon}</span>
      <span class="body"><span class="title">${esc(e.name)}</span><span class="progress ${cls}" style="display:block;margin-top:6px"><span style="width:${clamp(pct, 0, 100)}%"></span></span></span>
      <span class="amount num">${money(sp)}<span class="sub">/ ${money(b)}</span></span></button>
      <button class="icon-btn" data-act="tx-new" data-cat="env:${e.id}" aria-label="Ajouter une dépense ${esc(e.name)}">＋</button></div></li>`;
  });
  html += `</ul></div>
  <div class="section-title"><h2>Journal de ${MONTHS[Number(ui.month.slice(5)) - 1]}</h2></div>
  ${txList(a.list)}`;
  return html;
}
function txList(list) {
  if (!list.length) return `<div class="card"><div class="empty">Aucune dépense enregistrée ce mois-ci.</div></div>`;
  const sorted = [...list].sort((x, y) => (y.date.localeCompare(x.date)) || 0);
  const days = [...new Set(sorted.map((t) => t.date))];
  return `<div class="card flush">${days.map((d) => {
    const items = sorted.filter((t) => t.date === d);
    return `<div class="group-head"><span style="text-transform:capitalize">${dayLabel(d)}</span><span class="num">${money(sum(items, (t) => num(t.amount)), true)}</span></div><ul class="list">${items.map((t) => {
      const [l, ic] = catLabel(t.cat);
      return `<li><button class="item" data-act="tx-edit" data-id="${t.id}"><span class="ico">${ic}</span><span class="body"><span class="title">${esc(t.note || l)}</span><span class="meta">${esc(l)}</span></span><span class="amount num">${money(t.amount, true)}</span></button></li>`;
    }).join('')}</ul>`;
  }).join('')}</div>`;
}
function txCatOptions() {
  return [
    ...state.envelopes.map((e) => ['env:' + e.id, `${e.icon} ${e.name}`]),
    ['pocket:p1', `👛 Poche · ${state.settings.p1}`],
    ['pocket:p2', `👛 Poche · ${state.settings.p2}`],
    ['other', '⚠️ Hors budget / imprévu'],
  ];
}
function txForm(id, presetCat) {
  const t = state.transactions.find((x) => x.id === id);
  const inMonth = ui.month === currentMonth() ? todayISO() : `${ui.month}-01`;
  formModal({
    title: t ? 'Modifier la dépense' : 'Nouvelle dépense',
    fields: [
      { name: 'amount', label: 'Montant', type: 'money', value: t?.amount, required: true, half: true, autofocus: !t },
      { name: 'date', label: 'Date', type: 'date', value: t?.date ?? inMonth, required: true, half: true },
      { name: 'cat', label: 'Catégorie', type: 'select', value: t?.cat ?? presetCat ?? txCatOptions()[0]?.[0], options: txCatOptions() },
      { name: 'note', label: 'Note (facultatif)', type: 'text', value: t?.note ?? '', placeholder: 'Ex. Supermarché' },
    ],
    onSave: (v) => upsert('transactions', id, v),
    onDelete: t ? () => remove('transactions', id) : null,
  });
}
function envForm(id) {
  const e = state.envelopes.find((x) => x.id === id);
  formModal({
    title: e ? 'Modifier l’enveloppe' : 'Nouvelle enveloppe',
    fields: [
      { name: 'name', label: 'Nom', type: 'text', value: e?.name ?? '', required: true, placeholder: 'Ex. Courses' },
      { name: 'budget', label: 'Budget mensuel', type: 'money', value: e?.budget, half: true },
      { name: 'icon', label: 'Icône', type: 'select', value: e?.icon ?? '🛒', options: ENV_ICONS.map((i) => [i, i]), half: true },
    ],
    onSave: (v) => upsert('envelopes', id, v),
    onDelete: e ? () => {
      const n = state.transactions.filter((t) => t.cat === 'env:' + id).length;
      if (n && !confirm(`${n} dépense(s) sont liées à cette enveloppe. Elles seront classées « hors budget ». Continuer ?`)) return false;
      state.transactions.forEach((t) => { if (t.cat === 'env:' + id) t.cat = 'other'; });
      return remove('envelopes', id);
    } : null,
  });
}

/* ---------- Épargne ---------- */
function potETA(pot) {
  const left = num(pot.target) - num(pot.balance);
  if (!num(pot.target)) return '';
  if (left <= 0) return '🎉 Objectif atteint';
  if (!num(pot.monthly)) return `Il manque ${money(left)}`;
  const months = Math.ceil(left / num(pot.monthly));
  return `Objectif en ${months <= 1 ? 'un mois' : months + ' mois'} (${monthLabel(shiftMonth(currentMonth(), months))})`;
}
function renderSavings() {
  const p = plan();
  const total = sum(state.savings, (x) => num(x.balance));
  const pending = pendingSavingsLines();
  let html = `<div class="grid kpis">
    ${kpi('Total épargné', money(total), '', 'var(--c-savings)')}
    ${kpi('Versements / mois', money(p.totals.savings), `${money(p.totals.savings * 12)} par an`)}
    ${kpi('Taux d’épargne', p.totals.income ? Math.round((p.totals.savings / p.totals.income) * 100) + ' %' : '—', 'des revenus')}
  </div>
  <div class="fab-row" style="margin-top:16px">
    <button class="btn primary" data-act="pot-new">+ Objectif d’épargne</button>
    <button class="btn" data-act="pot-apply" ${pending.length ? '' : 'disabled'}>✓ Enregistrer les versements de ${MONTHS[Number(ui.month.slice(5)) - 1]}${pending.length ? ` (${money(sum(pending, ([, l]) => l.amount))})` : ''}</button>
  </div>`;
  if (!state.savings.length) return html + `<div class="card" style="margin-top:16px"><div class="empty">Créez vos objectifs : épargne de précaution, vacances, voiture, épargne-pension…</div></div>`;
  ['common', 'p1', 'p2'].forEach((o) => {
    const list = state.savings.filter((x) => x.owner === o);
    if (!list.length) return;
    html += `<div class="section-title"><h2>${esc(ownerName(o))}</h2><span class="muted small num">${money(sum(list, (x) => num(x.balance)))}</span></div><div class="grid two">`;
    list.forEach((x) => {
      const pct = num(x.target) ? clamp((num(x.balance) / num(x.target)) * 100, 0, 100) : 0;
      html += `<div class="card pot">
        <div class="pot-head"><span class="ico">${x.icon || '🐷'}</span><div class="t"><b>${esc(x.name)}</b><span class="muted small">${num(x.monthly) ? money(x.monthly) + ' / mois' : 'pas de versement programmé'}${potDoneThisMonth(x) ? ' · ✓ versé ce mois' : ''}${x.account ? `<br>🏦 ${esc(x.account)}` : ''}</span></div><button class="icon-btn" data-act="pot-edit" data-id="${x.id}" aria-label="Modifier">✎</button></div>
        <div class="row"><span class="bal num">${money(x.balance)}</span>${num(x.target) ? `<span class="muted num">/ ${money(x.target)}</span><span class="spacer"></span><b class="num">${Math.round(pct)} %</b>` : ''}</div>
        ${num(x.target) ? `<div class="progress"><span style="width:${pct}%;background:var(--c-savings)"></span></div>` : ''}
        <div class="muted small">${potETA(x)}</div>
        <div class="actions"><button class="btn sm" data-act="pot-move" data-id="${x.id}" data-dir="1">+ Verser</button><button class="btn sm" data-act="pot-move" data-id="${x.id}" data-dir="-1">− Retirer</button>${x.history.length ? `<button class="btn sm ghost" data-act="pot-history" data-id="${x.id}">Historique</button>` : ''}</div>
      </div>`;
    });
    html += `</div>`;
  });
  return html;
}
function potForm(id) {
  const x = state.savings.find((s) => s.id === id);
  formModal({
    title: x ? 'Modifier l’objectif' : 'Nouvel objectif d’épargne',
    fields: [
      { name: 'name', label: 'Nom', type: 'text', value: x?.name ?? '', required: true, placeholder: 'Ex. Vacances d’été' },
      { name: 'icon', label: 'Icône', type: 'select', value: x?.icon ?? '🐷', options: POT_ICONS.map((i) => [i, i]), half: true },
      { name: 'owner', label: 'Pour', type: 'select', value: x?.owner ?? 'common', options: ownerOptions(), half: true },
      { name: 'target', label: 'Objectif (facultatif)', type: 'money', value: x?.target, half: true },
      { name: 'monthly', label: 'Versement mensuel', type: 'money', value: x?.monthly, half: true },
      { name: 'balance', label: 'Montant déjà épargné', type: 'money', value: x?.balance },
      { name: 'account', label: 'Compte d’épargne (facultatif)', type: 'text', value: x?.account ?? '', placeholder: 'Ex. Compte vacances · BE12 3456 7890 1234' },
    ],
    onSave: (v) => upsert('savings', id, x ? v : { ...v, history: [] }),
    onDelete: x ? () => remove('savings', id) : null,
  });
}
function potMove(id, dir) {
  const x = state.savings.find((s) => s.id === id);
  if (!x) return;
  formModal({
    title: `${dir > 0 ? 'Verser sur' : 'Retirer de'} « ${x.name} »`,
    saveLabel: dir > 0 ? 'Verser' : 'Retirer',
    fields: [
      { name: 'amount', label: 'Montant', type: 'money', value: dir > 0 ? x.monthly : '', required: true, autofocus: true },
      { name: 'note', label: 'Note (facultatif)', type: 'text', value: '' },
    ],
    onSave: (v) => {
      const a = num(v.amount) * dir;
      x.balance = Math.round((num(x.balance) + a) * 100) / 100;
      x.history.unshift({ date: todayISO(), amount: a, note: v.note });
      toast(dir > 0 ? `💰 ${money(Math.abs(a), true)} versés` : `${money(Math.abs(a), true)} retirés`);
    },
  });
}
function potApply() {
  const pending = pendingSavingsLines();
  if (!pending.length) return;
  pending.forEach(([o, l]) => toggleTransfer(o, l.key, true));
  save(); render();
  toast(`✓ ${pending.length} versement(s) enregistré(s)`);
}
function potHistory(id) {
  const x = state.savings.find((s) => s.id === id);
  openModal(`<div class="form"><header class="modal-head"><h2>${esc(x.name)} — historique</h2><button class="icon-btn" data-close aria-label="Fermer">✕</button></header>
    <div style="overflow:auto"><ul class="list">${x.history.map((h) => `<li><div class="item"><span class="body"><span class="title">${esc(h.note || (h.amount >= 0 ? 'Versement' : 'Retrait'))}</span><span class="meta">${new Date(h.date + 'T12:00').toLocaleDateString('fr-BE')}</span></span><span class="amount num ${h.amount < 0 ? 'neg' : 'pos'}">${h.amount > 0 ? '+' : ''}${money(h.amount, true)}</span></div></li>`).join('')}</ul></div></div>`);
}

/* ---------- Argent de poche ---------- */
function renderPocket() {
  const a = monthActuals(ui.month);
  let html = `<div class="grid two">`;
  ['p1', 'p2'].forEach((o) => {
    const b = num(state.pocket[o]), sp = a.pocket[o] || 0, left = b - sp;
    const pct = b > 0 ? (sp / b) * 100 : sp > 0 ? 100 : 0;
    const cls = pct > 100 ? 'over' : pct > 85 ? 'warn' : '';
    const list = a.list.filter((t) => t.cat === 'pocket:' + o).sort((x, y) => y.date.localeCompare(x.date));
    html += `<div class="card pocket-card stack" style="gap:12px">
      <div class="who"><span class="avatar ${o}">${initial(o)}</span>${esc(ownerName(o))}<span class="spacer"></span><button class="btn sm ghost" data-act="pocket-edit" data-owner="${o}">${money(b)} / mois ✎</button></div>
      <div><div class="muted small">Reste ce mois-ci</div><div class="big num ${left < 0 ? 'neg' : ''}">${money(left, true)}</div></div>
      <div class="progress ${cls}"><span style="width:${clamp(pct, 0, 100)}%;${cls ? '' : 'background:var(--c-pocket)'}"></span></div>
      <div class="muted small">${money(sp, true)} dépensés sur ${money(b)}</div>
      <button class="btn primary" data-act="tx-new" data-cat="pocket:${o}">+ Dépense perso</button>
      ${list.length ? `<ul class="list">${list.map((t) => `<li><button class="item" style="padding:10px 0" data-act="tx-edit" data-id="${t.id}"><span class="body"><span class="title">${esc(t.note || 'Dépense')}</span><span class="meta">${new Date(t.date + 'T12:00').toLocaleDateString('fr-BE', { day: 'numeric', month: 'short' })}</span></span><span class="amount num">${money(t.amount, true)}</span></button></li>`).join('')}</ul>` : `<div class="empty" style="padding:8px">Aucune dépense ce mois-ci.</div>`}
    </div>`;
  });
  html += `</div><p class="muted small" style="margin-top:14px">L’argent de poche est la somme que chacun·e peut dépenser librement, sans avoir à se justifier. Il est déduit des revenus personnels dans le calcul du « reste libre ».</p>`;
  return html;
}
function pocketForm(o) {
  formModal({
    title: `Argent de poche — ${ownerName(o)}`,
    fields: [{ name: 'amount', label: 'Montant mensuel', type: 'money', value: state.pocket[o], required: true, autofocus: true }],
    onSave: (v) => { state.pocket[o] = num(v.amount); },
  });
}

/* ---------- Réglages ---------- */
function renderSettings() {
  const s = state.settings;
  const p = plan();
  return `<div class="grid two">
  <form class="card stack" id="settings-form" style="gap:14px">
    <h3>👫 Le couple</h3>
    <div class="form-body" style="padding:0">
      <label class="field half"><span>Prénom 1</span><input name="p1" value="${esc(s.p1)}" autocomplete="off"></label>
      <label class="field half"><span>Prénom 2</span><input name="p2" value="${esc(s.p2)}" autocomplete="off"></label>
      <label class="field"><span>Compte commun (nom ou IBAN, facultatif)</span><input name="commonAccount" value="${esc(s.commonAccount || '')}" placeholder="Ex. Compte commun · BE00 0000 0000 0000" autocomplete="off"></label>
      <div class="field"><span>Partage des dépenses communes</span>
        <div class="seg">${Object.entries(SPLIT_MODES).map(([k, l]) => `<label><input type="radio" name="split" value="${k}" ${s.split === k ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>
        <span class="hint">« Même reste pour chacun » : le virement de chacun est calculé pour qu’il vous reste la même somme à tous les deux après les charges, l’épargne et l’argent de poche. Actuellement : ${esc(s.p1)} verse ${money(p.contrib.p1)}, ${esc(s.p2)} verse ${money(p.contrib.p2)}.</span>
      </div>
      <label class="field ${s.split === 'custom' ? '' : 'hidden'}" id="custom-pct"><span>Part de ${esc(s.p1)} (%)</span><input name="customPct" type="number" inputmode="numeric" min="0" max="100" value="${num(s.customPct, 50)}"></label>
    </div>
    <button class="btn primary" type="submit">Enregistrer</button>
  </form>

  <div class="card stack" style="gap:12px">
    <h3>💾 Sauvegarde des données</h3>
    <div class="notice">🔒 Les données sont stockées uniquement sur cet appareil, dans l’app. Pensez à exporter une sauvegarde de temps en temps (par ex. dans Fichiers ou iCloud Drive).</div>
    <button class="btn" data-act="export">⬆️ Exporter une sauvegarde (.json)</button>
    <label class="btn" style="position:relative">⬇️ Importer une sauvegarde<input type="file" accept="application/json,.json" id="import-file" style="position:absolute;inset:0;opacity:0"></label>
    <p class="muted small" style="margin:0">Pour utiliser l’app sur deux iPad, exportez sur l’un puis importez sur l’autre.</p>
  </div>

  <div class="card stack" style="gap:12px">
    <h3>🧹 Réinitialiser</h3>
    <button class="btn" data-act="sample-reset">Charger les données d’exemple</button>
    <button class="btn danger" data-act="reset">Tout effacer</button>
  </div>

  <div class="card">
    <h3>ℹ️ À propos</h3>
    <p class="muted small" style="margin:0">Budget à deux · version 1.0<br>${state.transactions.length} dépenses, ${state.incomes.length} revenus, ${state.charges.length} charges, ${state.savings.length} objectifs d’épargne.</p>
  </div>
  </div>`;
}
function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const name = `budget-a-deux-${todayISO()}.json`;
  const file = new File([blob], name, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator.share({ files: [file], title: 'Sauvegarde Budget à deux' }).catch(() => {});
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function importData(file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const data = JSON.parse(r.result);
      if (!data || typeof data !== 'object' || !data.settings) throw new Error('format');
      if (!confirm('Remplacer toutes les données actuelles par celles de la sauvegarde ?')) return;
      state = normalize(data); state.setup = true;
      save(); render(); toast('✓ Sauvegarde importée');
    } catch { toast('⚠️ Fichier de sauvegarde invalide'); }
  };
  r.readAsText(file);
}

/* ---------- CRUD ---------- */
function upsert(coll, id, values) {
  const list = state[coll];
  if (id) { const it = list.find((x) => x.id === id); if (it) Object.assign(it, values); }
  else list.push({ id: uid(), ...values });
}
function remove(coll, id) {
  state[coll] = state[coll].filter((x) => x.id !== id);
  return true;
}

/* ---------- Modale & formulaires ---------- */
const modal = $('#modal');
function openModal(html) {
  $('#modal-content').innerHTML = html;
  if (!modal.open) modal.showModal();
}
function closeModal() { if (modal.open) modal.close(); }
modal.addEventListener('click', (e) => {
  if (e.target === modal || e.target.closest('[data-close]')) closeModal();
});

function fieldHtml(f) {
  const id = 'f-' + f.name;
  const cls = `field${f.half ? ' half' : ''}`;
  const show = f.showIf ? ` data-show="${f.showIf[0]}"` : '';
  const hint = f.hint ? `<span class="hint">${esc(f.hint)}</span>` : '';
  const af = f.autofocus ? ' autofocus' : '';
  if (f.type === 'seg') {
    return `<div class="${cls}"${show}><span>${esc(f.label)}</span><div class="seg">${f.options.map(([v, l]) => `<label><input type="radio" name="${f.name}" value="${esc(v)}" ${String(v) === String(f.value) ? 'checked' : ''}><span>${esc(l)}</span></label>`).join('')}</div>${hint}</div>`;
  }
  let input;
  if (f.type === 'select') {
    input = `<select id="${id}" name="${f.name}">${f.options.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(f.value) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  } else if (f.type === 'money') {
    input = `<div class="money"><input id="${id}" name="${f.name}" inputmode="decimal" autocomplete="off" placeholder="0,00" value="${esc(moneyIn(num(f.value)))}"${f.required ? ' required' : ''}${af}></div>`;
  } else {
    input = `<input id="${id}" name="${f.name}" type="${f.type === 'date' ? 'date' : 'text'}" value="${esc(f.value)}" placeholder="${esc(f.placeholder || '')}" autocomplete="off"${f.required ? ' required' : ''}${af}>`;
  }
  return `<label class="${cls}"${show} for="${id}"><span>${esc(f.label)}</span>${input}${hint}</label>`;
}
function formModal({ title, fields, onSave, onDelete, saveLabel = 'Enregistrer' }) {
  openModal(`<form class="form" id="mform" novalidate>
    <header class="modal-head"><h2>${esc(title)}</h2><button type="button" class="icon-btn" data-close aria-label="Fermer">✕</button></header>
    <div class="form-body">${fields.map(fieldHtml).join('')}</div>
    <footer class="modal-foot">${onDelete ? '<button type="button" class="btn danger ghost" data-del>Supprimer</button>' : ''}<span class="spacer"></span><button type="button" class="btn ghost" data-close>Annuler</button><button type="submit" class="btn primary">${esc(saveLabel)}</button></footer>
  </form>`);
  const form = $('#mform');
  const syncShow = () => fields.filter((f) => f.showIf).forEach((f) => {
    const ctrl = form.elements[f.showIf[0]];
    const val = ctrl?.value ?? '';
    form.querySelector(`[data-show][for="f-${f.name}"], [data-show] [name="${f.name}"]`)?.closest('[data-show]')?.classList.toggle('hidden', !f.showIf[1](val));
  });
  syncShow();
  form.addEventListener('change', syncShow);
  const first = form.querySelector('[autofocus]');
  if (first) setTimeout(() => first.focus(), 60);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const values = {};
    for (const f of fields) {
      const el = form.elements[f.name];
      let v = el?.value ?? '';
      if (f.type === 'money') {
        if (f.required && !String(v).trim()) { el.focus(); toast('Indiquez un montant'); return; }
        v = Math.round(num(v) * 100) / 100;
      } else if (typeof v === 'string') {
        v = v.trim();
        if (f.required && !v) { el.focus?.(); toast(`« ${f.label} » est obligatoire`); return; }
      }
      values[f.name] = v;
    }
    if (onSave(values) === false) return;
    save(); closeModal(); render();
  });
  form.querySelector('[data-del]')?.addEventListener('click', () => {
    if (!confirm('Supprimer définitivement cet élément ?')) return;
    if (onDelete() === false) return;
    save(); closeModal(); render(); toast('Élément supprimé');
  });
}

/* ---------- Toast ---------- */
let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

/* ---------- Événements ---------- */
const ACTIONS = {
  month: (b) => { ui.month = shiftMonth(ui.month, Number(b.dataset.n)); render(); },
  sample: () => { state = sampleState(welcomeNames()); save(); render(); toast('Données d’exemple chargées'); },
  'income-new': () => incomeForm(), 'income-edit': (b) => incomeForm(b.dataset.id),
  'charge-new': () => chargeForm(), 'charge-edit': (b) => chargeForm(b.dataset.id),
  'tx-new': (b) => txForm(null, b.dataset.cat), 'tx-edit': (b) => txForm(b.dataset.id),
  'env-new': () => envForm(), 'env-edit': (b) => envForm(b.dataset.id),
  'pot-new': () => potForm(), 'pot-edit': (b) => potForm(b.dataset.id),
  'pot-move': (b) => potMove(b.dataset.id, Number(b.dataset.dir)),
  'pot-apply': () => potApply(), 'pot-history': (b) => potHistory(b.dataset.id),
  'pocket-edit': (b) => pocketForm(b.dataset.owner),
  export: () => exportData(),
  'sample-reset': () => { if (confirm('Remplacer toutes vos données par les données d’exemple ?')) { state = sampleState({ p1: state.settings.p1, p2: state.settings.p2 }); save(); render(); toast('Données d’exemple chargées'); } },
  reset: () => { if (confirm('Effacer définitivement toutes les données de l’app ? Exportez une sauvegarde avant si besoin.')) { state = defaultState(); save(); ui.view = 'home'; render(); } },
};
document.addEventListener('click', (e) => {
  const nav = e.target.closest('[data-nav]');
  if (nav) {
    ui.view = nav.dataset.nav;
    try { sessionStorage.setItem('bc-view', ui.view); } catch { /* ignore */ }
    render(); window.scrollTo(0, 0); return;
  }
  const b = e.target.closest('[data-act]');
  if (b && ACTIONS[b.dataset.act]) { e.preventDefault(); ACTIONS[b.dataset.act](b); }
});
document.addEventListener('submit', (e) => {
  if (e.target.id === 'welcome-form') {
    e.preventDefault();
    state.settings = { ...state.settings, ...welcomeNames() };
    state.setup = true; save(); render();
  } else if (e.target.id === 'settings-form') {
    e.preventDefault();
    const f = e.target;
    state.settings.p1 = f.p1.value.trim() || 'Personne 1';
    state.settings.p2 = f.p2.value.trim() || 'Personne 2';
    state.settings.commonAccount = f.commonAccount.value.trim();
    state.settings.split = f.split.value;
    state.settings.customPct = clamp(num(f.customPct.value, 50), 0, 100);
    save(); render(); toast('✓ Réglages enregistrés');
  }
});
document.addEventListener('change', (e) => {
  if (e.target.name === 'split' && e.target.closest('#settings-form')) $('#custom-pct').classList.toggle('hidden', e.target.value !== 'custom');
  if (e.target.id === 'import-file' && e.target.files[0]) importData(e.target.files[0]);
  if (e.target.dataset.transfer) {
    const [o, key] = e.target.dataset.transfer.split('|');
    const line = toggleTransfer(o, key, e.target.checked);
    save(); render();
    if (line?.pot) toast(`💰 ${money(line.amount)} ajoutés à « ${line.pot.name} »`);
  }
});

/* ---------- Démarrage ---------- */
render();
if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
