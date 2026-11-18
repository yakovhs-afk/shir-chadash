/* ===================== מצב ואחסון ===================== */
const STORE_KEY = 'shir_chadash_v1';
const PREFS_KEY = 'shir_chadash_prefs';
/* שני מצבי עבודה:
   API  – כשהאתר רץ דרך server.ps1: התוכן והתרומות נשמרים בשרת ומנוהלים מהבק אופיס.
   מקומי – כשאין שרת: התוכן מ-config.js והתרומות נשמרות בדפדפן בלבד (הדגמה). */
let C = CONFIG;
let API = false;

let prefs = { lang: 'he', cur: 'ILS' };
try { Object.assign(prefs, JSON.parse(localStorage.getItem(PREFS_KEY)) || {}); } catch (e) {}
let state = { donations: [], extraTeams: [] };

function loadLocalState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) { const s = JSON.parse(raw); s.extraTeams = s.extraTeams || []; return s; }
  } catch (e) {}
  const s = { donations: seedDonations(), extraTeams: [] };
  saveState(s);
  return s;
}
function saveState(s = state) { if (API) return; try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch (e) {} }
function savePrefs() { try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (e) {} }
function resetDemo() {
  if (!confirm(t('reset_confirm'))) return;
  state = { donations: seedDonations(), extraTeams: [] };
  saveState();
  location.hash = '#/';
  render();
}
async function loadFromServer() {
  const r = await fetch('api/public', { cache: 'no-store' });
  if (!r.ok) throw new Error('no-api');
  const data = await r.json();
  C = data.config;
  state = { donations: data.donations || [], extraTeams: [] };
  API = true;
}
async function api(path, body) {
  const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({ ok: false, error: 'server' }));
  return data;
}

/* ===================== עזרים ===================== */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const L = v => v == null ? '' : typeof v === 'object' ? (v[prefs.lang] ?? v.he ?? '') : v;
function t(key, vars = {}) {
  let s = T[prefs.lang][key] ?? T.he[key] ?? key;
  if (typeof s !== 'string') return s;
  return s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}
const locale = () => prefs.lang === 'he' ? 'he-IL' : 'en-US';
const num = n => Math.round(n).toLocaleString(locale());
/* סכום בש"ח → מוצג במטבע שנבחר */
const money = (ils, cur = prefs.cur) => cur === 'USD' ? '$' + num(ils / C.usdRate) : '₪' + num(ils);
/* סכום במטבע מקורי */
const moneyIn = (amt, cur) => cur === 'USD' ? '$' + num(amt) : '₪' + num(amt);
const pctOf = (a, b) => b ? Math.round(a / b * 100) : 0;
const initial = s => esc(String(s || '?').trim()[0] || '?');
const maskName = s => { const p = String(s || '').trim().split(/\s+/); return p.length > 1 ? `${p[0]} ${p[p.length - 1][0]}.` : p[0] || ''; };

const allTeams = () => [...C.teams, ...state.extraTeams];
const findTeam = id => allTeams().find(x => x.id === id);
const teamRaised = tm => (tm.raised || 0) + state.donations.filter(d => d.teamId === tm.id).reduce((s, d) => s + d.credited, 0);
const teamDonors = tm => (tm.donors || 0) + state.donations.filter(d => d.teamId === tm.id).length;
const totalRaised = () => C.baseRaised + state.donations.reduce((s, d) => s + d.credited, 0);
const totalDonors = () => C.baseDonors + state.donations.length;
const matchPool = () => C.matchers.reduce((s, m) => s + m.amount, 0);
const status = () => C.startsAt && Date.now() < C.startsAt ? 'upcoming' : !C.endsAt || Date.now() < C.endsAt ? 'live' : 'ended';
const matchingActive = () => status() === 'live' && C.multiplier > 1 && totalRaised() < C.goal;
const dedTaken = d => (Number(d.taken) || 0) + state.donations.filter(x => x.dedicationId === d.id).length;
const displayGoal = () => {
  const r = totalRaised();
  if (r < C.goal) return C.goal;
  const next = C.stretch.find(s => s.amount > r);
  return next ? next.amount : Math.ceil(r * 1.2 / 100000) * 100000;
};

function creditFor(baseIls) {
  if (!matchingActive()) return baseIls;
  const room = Math.max(0, C.goal - totalRaised() - baseIls);
  return baseIls + Math.min(baseIls * (C.multiplier - 1), room);
}
function timeAgo(ts) {
  const diff = Date.now() - ts, he = prefs.lang === 'he';
  if (diff < 60000) return he ? 'ממש עכשיו' : 'just now';
  if (diff < HOUR) { const m = Math.floor(diff / 60000); return he ? `לפני ${m} דק'` : `${m} min ago`; }
  if (diff < DAY) { const h = Math.floor(diff / HOUR); return he ? (h === 1 ? 'לפני שעה' : `לפני ${h} שעות`) : `${h}h ago`; }
  const d = Math.floor(diff / DAY);
  return he ? (d === 1 ? 'אתמול' : `לפני ${d} ימים`) : `${d}d ago`;
}
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 2600);
}
const pageUrl = (hash = '') => location.href.split('#')[0] + hash;

/* ===================== שעון ===================== */
const pad = n => String(n).padStart(2, '0');
function splitTime(ms) {
  ms = Math.max(0, ms);
  return { d: Math.floor(ms / DAY), h: Math.floor(ms % DAY / HOUR), m: Math.floor(ms % HOUR / 60000), s: Math.floor(ms % 60000 / 1000) };
}
function countdownHTML() {
  const st = status();
  if (st === 'ended') return `<div class="ended-note">${t('ended')}</div>`;
  const to = st === 'live' ? C.endsAt : C.startsAt;
  if (!to) return '';
  return `<div class="countdown" data-to="${to}" role="timer" aria-label="${t(st === 'live' ? 'ends_in' : 'starts_in')}">
    <div class="cd-label" aria-hidden="true">${t(st === 'live' ? 'ends_in' : 'starts_in')}</div>
    <div class="cd-boxes">
      <div><b data-u="d">0</b><span>${t('days')}</span></div>
      <div><b data-u="h">00</b><span>${t('hours')}</span></div>
      <div><b data-u="m">00</b><span>${t('minutes')}</span></div>
      <div><b data-u="s">00</b><span>${t('seconds')}</span></div>
    </div></div>`;
}
let lastStatus = status();
function tick() {
  $$('.countdown').forEach(el => {
    const x = splitTime(Number(el.dataset.to) - Date.now());
    el.querySelector('[data-u=d]').textContent = x.d;
    el.querySelector('[data-u=h]').textContent = pad(x.h);
    el.querySelector('[data-u=m]').textContent = pad(x.m);
    el.querySelector('[data-u=s]').textContent = pad(x.s);
  });
}
setInterval(() => {
  tick();
  if (status() !== lastStatus) { lastStatus = status(); if (!$('.modal')) render(); }
}, 1000);

/* ===================== רכיבים משותפים ===================== */
function headerHTML() {
  const navs = ['about', 'dedications', 'teams', 'donors', 'faq'];
  return `<header class="site-header">
    <div class="container header-inner">
      <a href="#/" class="logo">${synagogueIcon(50)}<span>${esc(L(C.shortName))}</span></a>
      <nav class="main-nav" aria-label="${ax('main_nav')}">${navs.map(n => `<a href="#/" data-scroll="${n}">${t('nav_' + n)}</a>`).join('')}</nav>
      <div class="header-tools">
        <div class="cur-toggle" role="group" aria-label="${ax('currency')}">
          <button data-cur="ILS" class="${prefs.cur === 'ILS' ? 'sel' : ''}" aria-pressed="${prefs.cur === 'ILS'}" aria-label="${ax('ils')}">₪</button><button data-cur="USD" class="${prefs.cur === 'USD' ? 'sel' : ''}" aria-pressed="${prefs.cur === 'USD'}" aria-label="${ax('usd')}">$</button>
        </div>
        <button class="lang-btn" data-lang lang="${prefs.lang === 'he' ? 'en' : 'he'}">${t('lang_switch')}</button>
        <button class="btn btn-gold btn-sm" data-donate>${t('donate')} <span aria-hidden="true">♡</span></button>
      </div>
    </div>
  </header>`;
}
function progressHTML(raised, goal, markers = []) {
  const p = pctOf(raised, goal);
  return `<div class="progress ${raised >= goal ? 'over' : ''}" role="progressbar" aria-label="${ax('progress')}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(p, 100)}" aria-valuetext="${p}%"><div style="width:${Math.min(p, 100)}%"></div>
    ${markers.map(m => `<i style="inset-inline-start:${pctOf(m, goal)}%"></i>`).join('')}</div>`;
}
function shareHTML(url, text) {
  const enc = encodeURIComponent(text + ' ' + url);
  return `<div class="share">
    <a href="https://wa.me/?text=${enc}" target="_blank" rel="noopener">${t('whatsapp')}${srOnly(ax('new_window'))}</a>
    <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}" target="_blank" rel="noopener">${t('facebook')}${srOnly(ax('new_window'))}</a>
    <button type="button" data-copy="${esc(url)}">${t('copy_link')}</button>
  </div>`;
}
function donorRow(d) {
  const tm = d.teamId ? findTeam(d.teamId) : null;
  const ded = d.dedicationId ? C.dedications.find(x => x.id === d.dedicationId) : null;
  const amt = d.months > 1 ? t('x_months', { a: moneyIn(d.amount, d.cur), m: d.months }) : moneyIn(d.amount, d.cur);
  return `<div class="donor">
    <div class="avatar">${d.anon ? '♡' : initial(d.name)}</div>
    <div class="donor-body">
      <div class="donor-top"><strong>${d.anon ? t('anon') : esc(d.name)}</strong><span class="amt">${amt}</span></div>
      <div class="muted small">${timeAgo(d.date)}${tm ? ` · ${t('via')} <a href="#/team/${tm.id}">${esc(L(tm.name))}</a>` : ''}
        ${d.credited > d.baseIls + 1 ? ` · <span class="matched">${t('matched_to', { a: money(d.credited) })}</span>` : ''}</div>
      ${ded ? `<div class="tag-ded">${ico(ded.icon, 14)} ${esc(L(ded))}</div>` : ''}
      ${d.dedication ? `<div class="tag-ded">🕯️ ${esc(d.dedication)}</div>` : ''}
      ${d.message ? `<div class="msg">${esc(d.message)}</div>` : ''}
    </div></div>`;
}
function teamCardHTML(tm, rank) {
  const r = teamRaised(tm);
  return `<a class="team-card" href="#/team/${tm.id}">
    <div class="team-top"><div class="avatar">${rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : initial(L(tm.name))}</div>
      <div><strong>${esc(L(tm.name))}</strong><div class="muted small">${t('led_by', { n: esc(L(tm.leader)) })}</div></div></div>
    ${progressHTML(r, tm.goal)}
    <div class="row-between small"><span><strong>${money(r)}</strong> · ${pctOf(r, tm.goal)}%</span><span class="muted">${teamDonors(tm)} ${t('donors')}</span></div>
  </a>`;
}
let tickerPaused = false;
function tickerHTML() {
  const list = [...state.donations].sort((a, b) => b.date - a.date).slice(0, 14);
  if (!list.length) return '';
  const items = hidden => list.map(d => `<span class="tick"${hidden ? ' aria-hidden="true"' : ''}><span aria-hidden="true">♡</span> <b>${d.anon ? t('anon') : esc(d.name)}</b> ${d.months > 1 ? t('x_months', { a: moneyIn(d.amount, d.cur), m: d.months }) : moneyIn(d.amount, d.cur)}</span>`).join('');
  return `<section class="ticker${tickerPaused ? ' paused' : ''}" aria-label="${ax('ticker')}"><div class="ticker-label">${status() === 'live' ? '<span class="live-dot" aria-hidden="true"></span>' : ''}${t('ticker_label')}</div>
    <button type="button" class="ticker-pause" data-ticker-pause aria-pressed="${tickerPaused}" aria-label="${ax(tickerPaused ? 'play' : 'pause')}">${tickerPaused
      ? '<svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 4v16l13-8z" fill="currentColor"/></svg>'
      : '<svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 4h4v16H6zM14 4h4v16h-4z" fill="currentColor"/></svg>'}</button>
    <div class="ticker-viewport"><div class="ticker-track">${items(false)}${items(true)}</div></div></section>`;
}
// הסכום שגויס + הגרפיקה לפי הסגנון שנבחר (בק אופיס ← קמפיין), או בלי יעד בכלל
function goalMeterHTML() {
  const r = totalRaised(), donors = `<span><strong>${num(totalDonors())}</strong> ${t('donors')}</span>`;
  if (!showGoal()) return `<div class="raised">${money(r)}</div><div class="muted">${t('raised_so_far')}</div>
    <div class="row-between" style="margin-top:10px">${donors}</div>`;
  const g = displayGoal(), p = pctOf(r, g), st = currentProgressStyle();
  const marks = C.stretch.map(s => s.amount).filter(a => a < g).map(a => pctOf(a, g));
  const sub = r >= C.goal ? t('goal_reached', { g: money(g) }) : t('raised_of', { goal: money(C.goal) });
  const gfx = `<div role="progressbar" aria-label="${ax('progress')}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(p, 100)}" aria-valuetext="${p}%">${meterGraphic(st, p, marks, r >= C.goal)}</div>`;
  const pctTxt = `<span><strong>${p}%</strong> ${t('pct_goal')}</span>`;
  if (st === 'bar' || st === 'thick') return `<div class="raised">${money(r)}</div><div class="muted">${sub}</div>${gfx}
    <div class="row-between">${st === 'bar' ? pctTxt : '<span></span>'}${donors}</div>`;
  return `<div class="meter-side">${gfx}<div><div class="raised">${money(r)}</div><div class="muted">${sub}</div>
    <div class="meter-stats">${st === 'ring' ? '' : pctTxt}${donors}</div></div></div>`;
}
function goalCardHTML() {
  const st = status();
  return `<div class="goal-card">
    ${C.multiplier > 1 && st !== 'ended' ? `<div class="match-ribbon">${t('matched_badge', { m: C.multiplier })}</div>` : ''}
    ${goalMeterHTML()}
    ${countdownHTML()}
    <div class="quick-amounts">${(prefs.cur === 'USD' ? [36, 100, 180, 500] : [100, 180, 360, 1000]).map(a => `<button data-donate data-amt="${a}">${moneyIn(a, prefs.cur)}</button>`).join('')}</div>
    <button class="btn btn-gold btn-lg btn-block" data-donate>${t('donate_now')}${matchingActive() ? ` – ×${C.multiplier}` : ''}</button>
    ${matchingActive() ? `<div class="note">💡 ${t('match_note', { a: moneyIn(prefs.cur === 'USD' ? 100 : 100, prefs.cur), b: moneyIn(100 * C.multiplier, prefs.cur) })}</div>` : ''}
  </div>`;
}

/* ===================== עמוד ראשי ===================== */
function mainPage() {
  const r = totalRaised();
  const teams = allTeams().sort((a, b) => teamRaised(b) - teamRaised(a));
  return `
  <section class="hero">
    <div class="hero-bg">${heroDecor()}</div>
    <div class="container hero-grid">
      <div class="hero-text">
        <div class="eyebrow">${ico("pin", 15)} ${esc(L(C.location))}</div>
        <h1>${esc(L(C.name))}</h1>
        <p class="lead">${esc(L(C.tagline))}</p>
        <div class="video-box">${C.videoUrl
          ? `<iframe src="${esc(C.videoUrl)}" title="${ax('video')}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture" allowfullscreen></iframe>`
          : `<div class="video-ph">${buildingSVG()}<div class="play"><svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="#fff"/></svg></div><span>${t('video_placeholder')}</span></div>`}</div>
      </div>
      <div>${goalCardHTML()}</div>
    </div>
  </section>

  <section class="section container">
    <h2 class="sec-title">${t('impact_title')}</h2>
    <div class="impact-grid">${C.impact.map(i => `<button class="impact-tile" data-donate data-amt-ils="${i.amount}">
      <span class="ico">${ico(i.icon, 30)}</span><strong>${money(i.amount)}</strong><span>${esc(L(i))}</span></button>`).join('')}</div>
  </section>

  <section class="section alt" id="sec-about">
    <div class="container two-col">
      <div>
        <h2 class="sec-title">${t('story_title')}</h2>
        <div class="story">${L(C.story).map(p => `<p>${esc(p)}</p>`).join('')}</div>
        <div class="org-box"><div class="avatar">${synagogueIcon(56)}</div>
          <div><strong>${esc(L(C.orgName))}</strong><div class="muted small">${prefs.lang === 'he' ? 'ע"ר' : 'Reg.'} ${esc(C.orgNumber)}${C.section46 ? ' · ' + t('s46') : ''}</div></div></div>
      </div>
      <div>
        <h2 class="sec-title">${t('progress_title')}</h2>
        <h3 class="sub-title">${t('milestones_title')}</h3>
        <ol class="timeline">${C.milestones.map(m => `<li class="${m.status}"><span class="dot"></span><div><strong>${esc(L(m))}</strong>${L(m.date) ? `<span class="muted small"> · ${esc(L(m.date))}</span>` : ''}</div></li>`).join('')}</ol>
        ${showGoal() ? `<h3 class="sub-title">${t('stretch_title')}</h3>
        ${C.stretch.map(s => `<div class="stretch ${r >= s.amount ? 'done' : ''}">
          <div class="row-between"><span>${esc(L(s))}</span><strong>${r >= s.amount ? t('reached') : money(s.amount)}</strong></div>
          ${progressHTML(r, s.amount)}</div>`).join('')}` : ''}
      </div>
    </div>
    <div class="container">
      <h3 class="sub-title" style="margin-top:36px">${t('gallery_title')}</h3>
      <div class="gallery">${C.gallery.map((g, i) => `<button class="g-item${g.src ? '' : ' ph'}" data-gallery="${i}" style="${g.src ? `background-image:url('${esc(g.src)}')` : ''}">
        ${g.src ? '' : galleryArt(g) + `<span class="g-soon">${ico('camera', 13)} ${t('photo_soon')}</span>`}<span class="g-cap">${esc(L(g))}</span></button>`).join('')}</div>
    </div>
  </section>

  <section class="section container" id="sec-dedications">
    <h2 class="sec-title">${t('ded_title')}</h2>
    <p class="sec-sub">${t('ded_sub')} · ${t('ded_payments')}</p>
    <div class="ded-grid">${C.dedications.map(d => {
      const left = d.total - dedTaken(d);
      return `<div class="ded-card ${left <= 0 ? 'taken' : ''}">
        <div class="ded-ico">${ico(d.icon, 26)}</div>
        <h3>${esc(L(d))}</h3>
        <p>${esc(prefs.lang === 'he' ? d.descHe : d.descEn)}</p>
        <div class="ded-amt">${money(d.amount)}</div>
        ${d.total > 1 ? `<div class="muted small">${t('ded_left', { n: Math.max(0, left), t: d.total })}</div>${progressHTML(dedTaken(d), d.total)}` : ''}
        ${left > 0 ? `<button class="btn btn-outline btn-block" data-donate data-ded="${d.id}">${t('ded_btn')}</button>` : `<div class="taken-label">${t('ded_taken')}</div>`}
      </div>`;
    }).join('')}</div>
  </section>

  ${C.multiplier > 1 ? `<section class="section alt">
    <div class="container">
      <h2 class="sec-title">${t('matchers_title')}</h2>
      <p class="sec-sub">${t('matchers_sub', { pool: money(matchPool()) })}</p>
      <div class="matchers">${C.matchers.map(m => `<div class="matcher"><div class="m-star">${ico("star", 22)}</div><strong>${esc(L(m.name))}</strong><span>${money(m.amount)}</span></div>`).join('')}</div>
    </div>
  </section>` : ''}

  <section class="section container" id="sec-teams">
    <div class="sec-head">
      <div><h2 class="sec-title">${t('teams_title')}</h2><p class="sec-sub">${t('teams_sub')}</p></div>
      <button class="btn btn-primary" id="new-team">${t('new_team')}</button>
    </div>
    <input class="search" id="team-q" type="search" placeholder="${t('search_team')}" aria-label="${ax('search_team')}" aria-controls="team-list">
    <div class="team-grid" id="team-list">${teams.map((tm, i) => teamCardHTML(tm, i + 1)).join('')}</div>
  </section>

  ${C.raffle.enabled ? `<section class="section raffle-sec">
    <div class="container">
      <h2 class="sec-title">${t('raffle_title')}</h2>
      <p class="sec-sub">${t('raffle_sub', { p: money(C.raffle.ticketPrice), d: esc(L(C.raffle.drawDate)) })}</p>
      <div class="prizes">${C.raffle.prizes.map((p, i) => {
        const w = (C.raffle.winners || []).find(x => x.prize === i);
        return `<div class="prize"><span class="p-num">${i + 1}</span><span class="p-ico">${ico(p.icon, 30)}</span><strong>${esc(L(p))}</strong>${w ? `<span class="winner-name">${ico("trophy", 14)} ${esc(maskName(w.name))}</span>` : ''}</div>`;
      }).join('')}</div>
    </div>
  </section>` : ''}

  <section class="section container" id="sec-donors">
    <h2 class="sec-title">${t('donors_title')} <span class="count">${num(totalDonors())}</span></h2>
    <div class="filters">
      <input class="search" id="donor-q" type="search" placeholder="${t('search_donor')}" aria-label="${ax('search_donor')}" aria-controls="donor-list">
      <select class="select" id="donor-sort" aria-label="${ax('sort')}"><option value="recent">${t('recent')}</option><option value="top">${t('top')}</option></select>
    </div>
    <div class="donor-grid" id="donor-list"></div>
    <div style="text-align:center;margin-top:16px"><button class="btn btn-outline" id="more-donors">${t('show_more')}</button></div>
  </section>

  <section class="section alt" id="sec-faq">
    <div class="container narrow">
      <h2 class="sec-title">${t('faq_title')}</h2>
      ${C.faq.map((f, i) => `<details ${i === 0 ? 'open' : ''}><summary>${esc(L(f.q))}</summary><p>${esc(L(f.a))}</p></details>`).join('')}
    </div>
  </section>

  <section class="section container" id="sec-contact">
    <div class="contact-grid">
      <div class="contact-card"><h3>${t('contact_title')}</h3>
        <p>${ico("phone", 18)} <a href="tel:${esc(C.contact.phone)}">${esc(C.contact.phone)}</a></p>
        <p>${ico("mail", 18)} <a href="mailto:${esc(C.contact.email)}">${esc(C.contact.email)}</a></p>
        <p>${ico("pin", 18)} ${esc(L(C.contact.address))}</p></div>
      <div class="contact-card"><h3>${ico("bank", 20)} ${t('bank_title')}</h3><p>${esc(L(C.contact.bank))}</p></div>
    </div>
  </section>`;
}
function bindMain() {
  const renderTeams = () => {
    const q = $('#team-q').value.trim().toLowerCase();
    const list = allTeams().sort((a, b) => teamRaised(b) - teamRaised(a)).map((tm, i) => ({ tm, i }))
      .filter(({ tm }) => !q || (L(tm.name) + ' ' + L(tm.leader)).toLowerCase().includes(q));
    $('#team-list').innerHTML = list.length ? list.map(({ tm, i }) => teamCardHTML(tm, i + 1)).join('') : `<p class="muted">${t('no_results')}</p>`;
  };
  let shown = 12;
  const renderDonors = () => {
    const q = $('#donor-q').value.trim().toLowerCase();
    const sort = $('#donor-sort').value;
    const list = state.donations.filter(d => !q || (!d.anon && d.name.toLowerCase().includes(q)))
      .sort(sort === 'top' ? (a, b) => b.credited - a.credited : (a, b) => b.date - a.date);
    $('#donor-list').innerHTML = list.length ? list.slice(0, shown).map(donorRow).join('') : `<p class="muted">${t('no_results')}</p>`;
    $('#more-donors').hidden = list.length <= shown;
  };
  $('#team-q').addEventListener('input', renderTeams);
  $('#donor-q').addEventListener('input', () => { shown = 12; renderDonors(); });
  $('#donor-sort').addEventListener('change', renderDonors);
  $('#more-donors').addEventListener('click', () => { shown += 12; renderDonors(); });
  $('#new-team').addEventListener('click', openNewTeam);
  renderDonors();
}

/* ===================== דף צוות ===================== */
function teamPage(tm) {
  const r = teamRaised(tm);
  const ranked = allTeams().sort((a, b) => teamRaised(b) - teamRaised(a));
  const rank = ranked.findIndex(x => x.id === tm.id) + 1;
  const donations = state.donations.filter(d => d.teamId === tm.id).sort((a, b) => b.date - a.date);
  const url = pageUrl('#/team/' + tm.id);
  return `
  <section class="hero small">
    <div class="hero-bg">${heroDecor()}</div>
    <div class="container hero-text">
      <a class="back-link" href="#/">← ${esc(L(C.name))}</a>
      <h1>${esc(L(tm.name))}</h1>
      <p class="lead">${t('team_page_sub', { l: esc(L(tm.leader)), r: rank, t: ranked.length })}</p>
    </div>
  </section>
  <div class="container team-layout">
    <div class="panel">
      <div class="team-intro"><div class="avatar big">${initial(L(tm.leader))}</div>
        <div><h2>${t('team_intro', { l: esc(L(tm.leader)), n: esc(L(C.name)) })}</h2><p class="muted">${t('team_desc')}${matchingActive() ? ` – ×${C.multiplier}` : ''}.</p></div></div>
      <h3>${t('team_donors')} (${donations.length})</h3>
      ${donations.length ? `<div class="donor-grid one">${donations.map(donorRow).join('')}</div>` : `<p class="muted">${t('no_team_donors')}</p>`}
    </div>
    <aside class="side">
      <div class="goal-card">
        <div class="raised">${money(r)}</div>
        <div class="muted">${t('raised_of', { goal: money(tm.goal) })}</div>
        ${progressHTML(r, tm.goal)}
        <div class="row-between"><span><strong>${pctOf(r, tm.goal)}%</strong></span><span><strong>${teamDonors(tm)}</strong> ${t('donors')}</span></div>
        ${countdownHTML()}
        <button class="btn btn-gold btn-lg btn-block" data-donate data-team="${tm.id}">${t('donate_now')}${matchingActive() ? ` – ×${C.multiplier}` : ''}</button>
      </div>
      ${shareHTML(url, t('share_team_text', { n: L(C.name) }))}
      <div class="panel small-panel"><h4>${t('whole_campaign')}</h4>${showGoal() ? progressHTML(totalRaised(), C.goal) : ''}
        <div class="row-between small"><span>${money(totalRaised())}${showGoal() ? ' / ' + money(C.goal) : ''}</span><a href="#/" class="link">${t('back')}</a></div></div>
    </aside>
  </div>`;
}

/* ===================== דף תודה ===================== */
function thanksPage(p) {
  const d = state.donations.find(x => x.id === p.get('id'));
  if (!d) return notFound();
  const tm = d.teamId ? findTeam(d.teamId) : null;
  const tickets = C.raffle.enabled ? Math.floor(d.baseIls / C.raffle.ticketPrice) : 0;
  const url = pageUrl(tm ? '#/team/' + tm.id : '#/');
  return `<div class="success-page container">
    <div class="big-check">✓</div>
    <h1>${t('thanks_title')}</h1>
    <p class="lead-sm">${d.months > 1 ? t('thanks_monthly', { a: moneyIn(d.amount, d.cur), m: d.months }) : t('thanks_one', { a: moneyIn(d.amount, d.cur) })}</p>
    ${d.credited > d.baseIls + 1 ? `<div class="impact-box big"><div>${t('thanks_matched')}</div><div class="impact-total"><strong>${money(d.credited)}</strong></div></div>` : ''}
    <p class="muted">${[d.dedicationId ? t('thanks_ded') : '', tm ? t('thanks_team', { t: esc(L(tm.name)) }) : '', t('thanks_receipt')].filter(Boolean).join(' ')}</p>
    ${tickets ? `<p class="tickets-note">🎟️ ${t('thanks_tickets', { n: tickets })}</p>` : ''}
    <p><strong>${t('share_more')}</strong></p>
    <div style="max-width:440px;margin:0 auto 20px">${shareHTML(url, t('share_text', { n: L(C.name) }))}</div>
    <a class="btn btn-outline" href="#/">${t('back')}</a>
  </div>`;
}
function notFound() {
  return `<div class="success-page container"><div class="nf-ico">${ico("search", 48)}</div><h2>${t('not_found')}</h2><a class="btn btn-primary" href="#/">${t('back')}</a></div>`;
}

/* ===================== חלון תרומה ===================== */
/* חלון דו-שיח נגיש: הפוקוס נכנס לחלון, נשאר בתוכו (Tab) וחוזר לכפתור שפתח אותו בסגירה */
let modalOpener = null;
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),iframe,[tabindex]:not([tabindex="-1"])';
function closeModal() {
  if (!$('#modal-root').innerHTML) return;
  $('#modal-root').innerHTML = ''; document.body.style.overflow = '';
  $('#root').removeAttribute('inert');
  if (modalOpener && document.contains(modalOpener)) modalOpener.focus();
  modalOpener = null;
}
function openModal(inner, focusSel) {
  if (!$('#modal-root').innerHTML) modalOpener = document.activeElement;
  $('#modal-root').innerHTML = `<div class="modal-back" id="modal-back">${inner}</div>`;
  document.body.style.overflow = 'hidden';
  $('#root').setAttribute('inert', '');
  const m = $('#modal-root .modal');
  m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('tabindex', '-1');
  const h = m.querySelector('h2');
  if (h) { h.id = 'modal-title'; m.setAttribute('aria-labelledby', 'modal-title'); }
  $('#modal-close').setAttribute('aria-label', ax('close'));
  $('#modal-close').addEventListener('click', closeModal);
  $('#modal-back').addEventListener('mousedown', e => { if (e.target.id === 'modal-back') closeModal(); });
  m.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    const f = $$(FOCUSABLE, m).filter(x => x.offsetParent !== null);
    if (!f.length) return;
    if (e.shiftKey && (document.activeElement === f[0] || document.activeElement === m)) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  });
  ((focusSel && $(focusSel, m)) || m).focus();
}

function openDonate(opts = {}) {
  let cur = prefs.cur, months = 1;
  let ded = opts.ded ? C.dedications.find(d => d.id === opts.ded) : null;
  let amount = opts.amt ? Number(opts.amt) : opts.amtIls ? Math.ceil(Number(opts.amtIls) / (cur === 'USD' ? C.usdRate : 1)) : (cur === 'USD' ? 100 : 360);
  const rate = () => cur === 'USD' ? C.usdRate : 1;
  const presets = () => cur === 'USD' ? [18, 36, 100, 180, 500, 1000] : [36, 52, 100, 180, 360, 1000];
  const dedPerPayment = () => Math.ceil(ded.amount / rate() / months);

  openModal(`<form class="modal" id="donate-form" novalidate>
    <button type="button" class="close" id="modal-close" aria-label="close">✕</button>
    <div class="modal-head">${synagogueIcon(52)}<div><div class="muted small">${esc(L(C.orgName))}</div><h2>${t('modal_title', { n: esc(L(C.shortName)) })}</h2></div></div>
    ${matchingActive() ? `<div class="match-ribbon inline">${t('matched_badge', { m: C.multiplier })}</div>` : ''}
    <div id="ded-box" aria-live="polite"></div>
    <div class="lbl" id="freq-lbl">${t('freq_label')}</div>
    <div class="seg" id="freq" role="group" aria-labelledby="freq-lbl">${[1, 12, 24, 36].map(m => `<button type="button" data-m="${m}">${m === 1 ? t('one_time') : t('monthly_n', { n: m })}</button>`).join('')}</div>
    <div class="lbl" id="amt-lbl"></div>
    <div class="amounts" id="amounts" role="group" aria-labelledby="amt-lbl"></div>
    <div class="amount-input">
      <div class="cur-toggle small-toggle" id="m-cur" role="group" aria-label="${ax('currency')}"><button type="button" data-c="ILS" aria-label="${ax('ils')}">₪</button><button type="button" data-c="USD" aria-label="${ax('usd')}">$</button></div>
      <input type="number" id="amount" min="1" step="1" inputmode="numeric" aria-labelledby="amt-lbl" aria-describedby="impact">
    </div>
    <div class="impact-box" id="impact" aria-live="polite"></div>
    <div class="field"><label for="d-team">${t('team_label')}</label>
      <select id="d-team"><option value="">${t('none')}</option>${allTeams().map(tm => `<option value="${tm.id}" ${tm.id === opts.team ? 'selected' : ''}>${esc(L(tm.name))}</option>`).join('')}</select></div>
    <div class="row2">
      <div class="field"><label for="d-name">${t('name')}</label><input id="d-name" autocomplete="name" aria-required="true"></div>
      <div class="field"><label for="d-email">${t('email')}</label><input id="d-email" type="email" autocomplete="email" aria-required="true"></div>
    </div>
    <div class="field"><label for="d-phone">${t('phone')}</label><input id="d-phone" type="tel" autocomplete="tel" dir="ltr" aria-required="true"></div>
    ${C.section46 ? `<div class="field"><label for="d-idnum">${t('idnum')} <span class="hint">${t('idnum_hint')}</span></label><input id="d-idnum" inputmode="numeric" maxlength="11" autocomplete="off" dir="ltr"></div>` : ''}
    <div class="field" role="group" aria-labelledby="ded-lbl"><div class="field-lbl" id="ded-lbl">${t('dedicate_text')} <span class="hint">${t('optional')}</span></div>
      <div class="dedic-row"><select id="d-ded-type" aria-label="${t('dedicate_text')}">${t('ded_types').map((x, i) => `<option value="${i ? esc(x) : ''}">${esc(x)}</option>`).join('')}</select><input id="d-ded" placeholder="${t('ded_name_ph')}" aria-label="${t('ded_name_ph')}"></div></div>
    <div class="field"><label for="d-msg">${t('message')} <span class="hint">${t('message_hint')}</span></label><input id="d-msg" maxlength="140"></div>
    <label class="check"><input type="checkbox" id="d-anon"> ${t('anon_check')}</label>
    <label class="check"><input type="checkbox" id="d-receipt" checked> ${t('receipt_check')}</label>
    <div class="error" id="form-err" role="alert"></div>
    <button class="btn btn-gold btn-lg btn-block" type="submit" id="pay-btn"></button>
    <div class="demo-note">${t('secure_note')}</div>
  </form>`);

  const amtInput = $('#amount');
  amtInput.value = ded ? dedPerPayment() : amount;

  const sync = (fromDed = false) => {
    if (ded && fromDed) amtInput.value = dedPerPayment();
    amount = Math.max(0, Math.floor(Number(amtInput.value) || 0));
    $('#ded-box').innerHTML = ded ? `<div class="selected-ded"><span>${t('ded_selected', { i: ico(ded.icon, 16), n: esc(L(ded)), a: money(ded.amount) })}</span><button type="button" id="rm-ded">${t('remove')}</button></div>` : '';
    $('#rm-ded')?.addEventListener('click', () => { ded = null; sync(); });
    $$('#freq button').forEach(b => { const on = Number(b.dataset.m) === months; b.classList.toggle('sel', on); b.setAttribute('aria-pressed', on); });
    $$('#m-cur button').forEach(b => { const on = b.dataset.c === cur; b.classList.toggle('sel', on); b.setAttribute('aria-pressed', on); });
    $('#amt-lbl').textContent = months > 1 ? t('amount_label_m') : t('amount_label');
    const fa = document.activeElement?.closest?.('#amounts') ? document.activeElement.dataset.amt : null;
    $('#amounts').innerHTML = presets().map(p => `<button type="button" data-amt="${p}" class="${p === amount ? 'sel' : ''}" aria-pressed="${p === amount}">${moneyIn(p, cur)}</button>`).join('');
    if (fa) $(`#amounts [data-amt="${fa}"]`)?.focus();
    const baseIls = amount * months * rate();
    const credit = creditFor(baseIls);
    const tickets = C.raffle.enabled ? Math.floor(baseIls / C.raffle.ticketPrice) : 0;
    $('#impact').innerHTML = amount ? `
      <div>${months > 1 ? t('total_monthly', { a: moneyIn(amount, cur), m: months, t: moneyIn(amount * months, cur) }) : t('your_gift', { a: moneyIn(amount, cur) })}</div>
      <div class="impact-total">${t('building_gets')} <strong>${moneyIn(credit / rate(), cur)}</strong>${credit > baseIls + 1 ? ` <span class="mult-badge">×${+(credit / baseIls).toFixed(1)}</span>` : ''}</div>
      ${tickets ? `<div class="small">${t('tickets', { n: tickets })}</div>` : ''}` : '';
    $('#pay-btn').textContent = months > 1 ? t('pay_monthly', { a: moneyIn(amount, cur) }) : t('pay', { a: moneyIn(amount, cur) });
  };
  $('#amounts').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; amtInput.value = b.dataset.amt; sync(); });
  $('#freq').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; months = Number(b.dataset.m); sync(true); });
  $('#m-cur').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.dataset.c === cur) return;
    const ils = (Number(amtInput.value) || 0) * rate();
    cur = b.dataset.c;
    amtInput.value = Math.ceil(ils / rate());
    sync(true);
  });
  amtInput.addEventListener('input', () => sync());
  sync(true);

  $('#donate-form').addEventListener('submit', e => {
    e.preventDefault();
    const name = $('#d-name').value.trim(), email = $('#d-email').value.trim();
    const baseIls = amount * months * rate();
    const minIls = 10;
    let err = '';
    if (baseIls < minIls) err = t('err_amount', { a: money(minIls) });
    else if (ded && baseIls < ded.amount - rate() * months) err = t('err_ded', { a: money(ded.amount) });
    else if (!name) err = t('err_name');
    else if (!/^\S+@\S+\.\S+$/.test(email)) err = t('err_email');
    // טלפון חובה: 9–15 ספרות (אפשר עם רווחים, מקפים, סוגריים ו-+ בתחילת מספר מחו"ל)
    const phone = $('#d-phone').value.trim(), phoneDigits = phone.replace(/\D/g, '');
    if (!err && (!/^\+?[\d\s\-().]+$/.test(phone) || phoneDigits.length < 9 || phoneDigits.length > 15)) err = t('err_phone');
    const idRaw = $('#d-idnum') ? $('#d-idnum').value.trim() : '', idNumber = cleanIsraeliId(idRaw);
    if (!err && idRaw && !idNumber) err = t('err_idnum');
    $('#form-err').textContent = err;
    const bad = err === t('err_name') ? '#d-name' : err === t('err_email') ? '#d-email' : err === t('err_phone') ? '#d-phone' : err === t('err_idnum') ? '#d-idnum' : err ? '#amount' : null;
    ['#d-name', '#d-email', '#d-phone', '#amount', '#d-idnum'].forEach(s => { if (!$(s)) return; s === bad ? $(s).setAttribute('aria-invalid', 'true') : $(s).removeAttribute('aria-invalid'); });
    if (bad) $(bad).setAttribute('aria-errormessage', 'form-err');
    if (err) { $(bad).focus(); return; }

    const btn = $('#pay-btn');
    btn.disabled = true;
    btn.textContent = t('processing');
    const dt = $('#d-ded-type').value, dn = $('#d-ded').value.trim();
    const payload = {
      name, email, phone, idNumber, amount, cur, months, teamId: $('#d-team').value,
      dedicationId: ded ? ded.id : '', dedication: dt && dn ? `${dt} ${dn}` : '',
      message: $('#d-msg').value.trim(), anon: $('#d-anon').checked, receipt: $('#d-receipt').checked
    };
    const done = id => { closeModal(); location.hash = '#/thanks?id=' + id; };
    if (API) {
      api('api/donate', payload).then(async res => {
        if (!res.ok) {
          btn.disabled = false; sync();
          $('#form-err').textContent = res.error === 'dedication-taken' ? t('err_ded_taken') : res.error === 'idnum' ? t('err_idnum') : res.error === 'phone' ? t('err_phone') : t('err_server');
          return;
        }
        await loadFromServer();
        done(res.id);
      }).catch(() => { btn.disabled = false; sync(); $('#form-err').textContent = t('err_server'); });
    } else {
      setTimeout(() => {
        const id = 'l' + Date.now().toString(36);
        state.donations.push({ ...payload, id, baseIls, credited: creditFor(baseIls), date: Date.now() });
        saveState();
        done(id);
      }, 900);
    }
  });
}

function openNewTeam() {
  openModal(`<form class="modal" id="team-form" novalidate>
    <button type="button" class="close" id="modal-close" aria-label="close">✕</button>
    <h2>${t('nt_title')}</h2>
    <p class="muted">${t('nt_sub')}</p>
    <div class="field"><label for="t-leader">${t('nt_leader')}</label><input id="t-leader" aria-required="true"></div>
    <div class="field"><label for="t-name">${t('nt_name')}</label><input id="t-name" placeholder="${t('nt_name_ph')}" aria-required="true"></div>
    <div class="field"><label for="t-goal">${t('nt_goal')}</label><input id="t-goal" type="number" min="1000" step="1000" value="10000"></div>
    <div class="error" id="t-err" role="alert"></div>
    <button class="btn btn-primary btn-lg btn-block" type="submit">${t('nt_create')}</button>
  </form>`);
  $('#team-form').addEventListener('submit', e => {
    e.preventDefault();
    const leader = $('#t-leader').value.trim(), name = $('#t-name').value.trim(), goal = Number($('#t-goal').value);
    const err = !leader ? t('nt_err_leader') : !name ? t('nt_err_name') : !(goal >= 1000) ? t('nt_err_goal') : '';
    $('#t-err').textContent = err;
    if (err) { $(!leader ? '#t-leader' : !name ? '#t-name' : '#t-goal').focus(); return; }
    if (API) {
      api('api/teams', { leader, name, goal }).then(async res => {
        if (!res.ok) { $('#t-err').textContent = t('err_server'); return; }
        closeModal();
        if (res.team.status === 'pending') { toast(t('nt_pending')); return; }
        await loadFromServer();
        toast(t('nt_done'));
        location.hash = '#/team/' + res.team.id;
      }).catch(() => { $('#t-err').textContent = t('err_server'); });
      return;
    }
    const tm = { id: 'u' + Date.now().toString(36), name, leader, goal, raised: 0, donors: 0 };
    state.extraTeams.push(tm);
    saveState();
    closeModal();
    toast(t('nt_done'));
    location.hash = '#/team/' + tm.id;
  });
}

function openGallery(i, focusSel) {
  const g = C.gallery[i];
  openModal(`<div class="modal lightbox">
    <button type="button" class="close" id="modal-close" aria-label="close">✕</button>
    <div class="lb-img${g.src ? '' : ' ph'}" style="${g.src ? `background-image:url('${esc(g.src)}')` : ''}">${g.src ? '' : galleryArt(g, 90)}</div>
    <div class="lb-cap"><button type="button" data-gallery="${(i - 1 + C.gallery.length) % C.gallery.length}" aria-label="${ax('prev')}"><span aria-hidden="true">‹</span></button>
      <h2 class="lb-title" aria-live="polite">${esc(L(g))}</h2>
      <button type="button" data-gallery="${(i + 1) % C.gallery.length}" aria-label="${ax('next')}"><span aria-hidden="true">›</span></button></div>
  </div>`, focusSel);
}

/* ===================== ניתוב ותצוגה ===================== */
/* ===================== ערכת צבע ===================== */
// הערכה השמורה נקבעת בבק אופיס (C.theme). עם ?palette בכתובת מופיע בורר לתצוגה מקדימה בלבד.
const PALETTE_MODE = /[?&]palette\b/.test(location.search);
let previewTheme = null;
try { previewTheme = PALETTE_MODE ? sessionStorage.getItem('sc_theme_preview') : null; } catch (e) {}
function currentTheme() {
  const id = previewTheme || C.theme || 'classic';
  return THEMES.some(th => th.id === id) ? id : 'classic';
}
function applyTheme() {
  document.documentElement.dataset.theme = currentTheme();
  if (!PALETTE_MODE) return;
  let box = document.getElementById('palette-picker');
  if (!box) { box = document.createElement('div'); box.id = 'palette-picker'; box.className = 'palette-picker'; document.body.appendChild(box); }
  const cur = currentTheme();
  box.innerHTML = `<strong>${prefs.lang === 'he' ? 'תצוגה מקדימה – צבעי האתר' : 'Preview – site colors'}</strong>
    ${THEMES.map(th => `<button type="button" data-theme-pick="${th.id}" class="${th.id === cur ? 'sel' : ''}">${swatchHTML(th)}<span>${esc(L(th))}</span></button>`).join('')}
    <p class="pp-note">${prefs.lang === 'he' ? 'רק אצלך. לשמירה לכולם: בק אופיס ← הגדרות ← צבעי האתר.' : 'Only on your screen. To save for everyone: back office → Settings.'}</p>`;
  box.onclick = e => {
    const b = e.target.closest('[data-theme-pick]'); if (!b) return;
    previewTheme = b.dataset.themePick;
    try { sessionStorage.setItem('sc_theme_preview', previewTheme); } catch (err) {}
    applyTheme();
  };
}

/* ===================== גופנים ===================== */
// הזוג השמור נקבע בבק אופיס (C.fonts). עם ?fonts בכתובת מופיע בורר לתצוגה מקדימה בלבד.
const FONTS_MODE = /[?&]fonts\b/.test(location.search);
let previewFonts = null;
try { previewFonts = FONTS_MODE ? sessionStorage.getItem('sc_fonts_preview') : null; } catch (e) {}
function applyFonts() {
  const fp = fontPair(previewFonts || C.fonts);
  if (FONTS_MODE) { const link = $('#font-link'); if (link && !link.dataset.all) { link.dataset.all = '1'; link.href = allFontsURL(); } }
  setFontVars(fp, 'font-link');
  if (!FONTS_MODE) return;
  let box = document.getElementById('font-picker');
  if (!box) { box = document.createElement('div'); box.id = 'font-picker'; box.className = 'palette-picker font-picker'; document.body.appendChild(box); }
  const he = prefs.lang === 'he';
  box.innerHTML = `<strong>${he ? 'תצוגה מקדימה – גופנים' : 'Preview – fonts'}</strong>
    ${FONTS.map(f => `<button type="button" data-font-pick="${f.id}" class="${f.id === fp.id ? 'sel' : ''}" aria-pressed="${f.id === fp.id}">
      <span class="fp-sample" style="font-family:'${f.head}'">${he ? 'שיר חדש' : 'Shir Chadash'}</span><span class="fp-name" style="font-family:'${f.body}'">${esc(L(f))}</span></button>`).join('')}
    <p class="pp-note">${he ? 'רק אצלך. לשמירה לכולם: בק אופיס ← הגדרות ← גופנים.' : 'Only on your screen. To save for everyone: back office → Settings.'}</p>`;
  box.onclick = e => {
    const b = e.target.closest('[data-font-pick]'); if (!b) return;
    previewFonts = b.dataset.fontPick;
    try { sessionStorage.setItem('sc_fonts_preview', previewFonts); } catch (err) {}
    applyFonts();
    $(`[data-font-pick="${previewFonts}"]`)?.focus();
  };
}

/* ===================== תצוגת ההתקדמות ===================== */
// נשמר בבק אופיס ← קמפיין (C.progressStyle, C.hideGoal). עם ?progress בכתובת מופיע בורר לתצוגה מקדימה בלבד.
const PROGRESS_MODE = /[?&]progress\b/.test(location.search);
let previewProgress = null;
try { previewProgress = PROGRESS_MODE ? JSON.parse(sessionStorage.getItem('sc_progress_preview') || 'null') : null; } catch (e) {}
const currentProgressStyle = () => progressStyleId(previewProgress ? previewProgress.style : C.progressStyle);
const showGoal = () => C.goal > 0 && !(previewProgress ? previewProgress.hide : C.hideGoal);
function renderProgressPicker() {
  if (!PROGRESS_MODE) return;
  let box = document.getElementById('progress-picker');
  if (!box) { box = document.createElement('div'); box.id = 'progress-picker'; box.className = 'palette-picker progress-picker'; document.body.appendChild(box); }
  const he = prefs.lang === 'he', cur = showGoal() ? currentProgressStyle() : 'none';
  box.innerHTML = `<strong>${he ? 'תצוגה מקדימה – התקדמות הקמפיין' : 'Preview – campaign progress'}</strong>
    ${PROGRESS_STYLES.map(s => `<button type="button" data-progress-pick="${s.id}" class="${s.id === cur ? 'sel' : ''}" aria-pressed="${s.id === cur}"><span class="pp-mini">${meterGraphic(s.id, 62)}</span><span>${esc(L(s))}</span></button>`).join('')}
    <button type="button" data-progress-pick="none" class="${cur === 'none' ? 'sel' : ''}" aria-pressed="${cur === 'none'}"><span class="pp-mini pp-none">₪</span><span>${he ? 'בלי יעד – רק הסכום שנתרם' : 'No goal – amount raised only'}</span></button>
    <p class="pp-note">${he ? 'רק אצלך. לשמירה לכולם: בק אופיס ← קמפיין ← תצוגת ההתקדמות.' : 'Only on your screen. To save for everyone: back office → Campaign.'}</p>`;
  box.onclick = e => {
    const b = e.target.closest('[data-progress-pick]'); if (!b) return;
    const v = b.dataset.progressPick;
    previewProgress = v === 'none' ? { style: currentProgressStyle(), hide: true } : { style: v, hide: false };
    try { sessionStorage.setItem('sc_progress_preview', JSON.stringify(previewProgress)); } catch (err) {}
    render();
    $(`[data-progress-pick="${v}"]`)?.focus();
  };
}

function render() {
  const h = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = h.split('?');
  const parts = path.split('/').filter(Boolean);
  const params = new URLSearchParams(qs || '');

  document.documentElement.lang = prefs.lang;
  document.documentElement.dir = prefs.lang === 'he' ? 'rtl' : 'ltr';
  applyTheme();
  applyFonts();
  renderProgressPicker();
  renderA11yBar();

  let body, after = () => {};
  if (parts[0] === 'accessibility') {
    body = a11yStatementPage();
    document.title = `${ax('statement')} | ${L(C.shortName)}`;
  } else if (parts[0] === 'team') {
    const tm = findTeam(parts[1]);
    body = tm ? teamPage(tm) : notFound();
    document.title = tm ? `${L(tm.name)} | ${L(C.shortName)}` : L(C.name);
  } else if (parts[0] === 'thanks') {
    body = thanksPage(params);
    document.title = t('thanks_title');
  } else {
    body = mainPage();
    after = bindMain;
    document.title = `${L(C.name)} | ${t('donate')}`;
  }

  $("#skip").textContent = ax("skip");
  $("#root").innerHTML = tickerHTML() + headerHTML() + `<main id="main" tabindex="-1">${body}</main>` + footerHTML() +
    `<div class="mobile-bar"><div><strong>${money(totalRaised())}</strong>${showGoal() ? `<span class="muted small"> / ${money(C.goal)}</span>` : ''}</div><button class="btn btn-gold" data-donate ${parts[0] === 'team' ? `data-team="${parts[1]}"` : ''}>${t('donate')}${matchingActive() ? ` ×${C.multiplier}` : ''}</button></div>`;
  after();
  tick();
  window.scrollTo(0, 0);
}
function footerHTML() {
  return `<footer class="site-footer"><div class="container footer-inner">
    <div class="logo light">${synagogueIcon(64)}<span>${esc(L(C.name))}</span></div>
    <div class="muted-light small">${esc(L(C.orgName))} · ${prefs.lang === 'he' ? 'ע"ר' : 'Reg.'} ${esc(C.orgNumber)}${C.section46 ? ' · ' + t('s46') : ''}</div>
    <div class="muted-light small">© ${new Date().getFullYear()} · ${t('rights')} · <a href="#/accessibility" class="admin-link">${ax('statement')}</a>${API ? ` · <a href="/admin" class="admin-link">${t('admin_link')}</a>` : ` · ${t('demo_note')} · <a href="#/" data-reset>${t('reset')}</a>`}</div>
  </div></footer>`;
}

/* אירועים גלובליים */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-donate],[data-scroll],[data-cur],[data-lang],[data-copy],[data-gallery],[data-reset],[data-skip],[data-ticker-pause]');
  if (!el) return;
  if (el.matches('[data-skip]')) {
    e.preventDefault(); $('#main').focus();
  } else if (el.matches('[data-ticker-pause]')) {
    tickerPaused = !tickerPaused;
    const tk = $('.ticker'); tk.outerHTML = tickerHTML(); $('[data-ticker-pause]').focus();
  } else if (el.matches('[data-donate]')) {
    e.preventDefault();
    openDonate({ amt: el.dataset.amt, amtIls: el.dataset.amtIls, ded: el.dataset.ded, team: el.dataset.team });
  } else if (el.matches('[data-scroll]')) {
    e.preventDefault();
    const go = () => {
      const s = $('#sec-' + el.dataset.scroll); if (!s) return;
      s.setAttribute('tabindex', '-1');
      s.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth' });
      s.focus({ preventScroll: true });
    };
    if (location.hash && location.hash !== '#/') { location.hash = '#/'; setTimeout(go, 50); } else go();
  } else if (el.matches('[data-cur]')) {
    prefs.cur = el.dataset.cur; savePrefs(); rerender();
  } else if (el.matches('[data-lang]')) {
    prefs.lang = prefs.lang === 'he' ? 'en' : 'he'; savePrefs(); rerender();
  } else if (el.matches('[data-copy]')) {
    navigator.clipboard?.writeText(el.dataset.copy).then(() => toast(t('copied')), () => toast(el.dataset.copy));
  } else if (el.matches('[data-gallery]')) {
    const inLb = el.closest('.lightbox');
    openGallery(Number(el.dataset.gallery), inLb ? `[aria-label="${el.getAttribute('aria-label')}"]` : null);
  } else if (el.matches('[data-reset]')) {
    e.preventDefault(); resetDemo();
  }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
/* רינדור מחדש (שפה/מטבע) – שומר את מיקום הגלילה ואת הכפתור שבפוקוס */
function rerender() {
  const y = scrollY, a = document.activeElement;
  const sel = a?.matches?.('[data-lang]') ? '[data-lang]' : a?.dataset?.cur ? `[data-cur="${a.dataset.cur}"]` : null;
  render(); window.scrollTo(0, y);
  if (sel) $(sel)?.focus({ preventScroll: true });
}
/* מעבר עמוד – הפוקוס עובר לתחילת התוכן, כדי שקורא מסך יתחיל מהעמוד החדש */
window.addEventListener('hashchange', () => { modalOpener = null; closeModal(); render(); $('#main')?.focus({ preventScroll: true }); });

(async function boot() {
  try { await loadFromServer(); }
  catch (e) { API = false; C = CONFIG; state = loadLocalState(); }
  render();
})();
