'use strict';
const $ = s => document.querySelector(s);
const KA = 'fk_answers_v1', KN = 'fk_notes_v1', KR = 'fk_rate_v1', KT = 'fk_tab_v2';
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const today = () => new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function toast(m) { const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => t.hidden = true, 2600); }

let answers = load(KA, []);            // saved answers (old data kept)
answers = answers.filter(a => !a.example); save(KA, answers);
let notes = load(KN, []);
const rate = Number(load(KR, 1)) || 1;

/* ---------- Tabs ---------- */
function showTab(t) {
  ['news', 'ask', 'notes'].forEach(x => {
    $('#page-' + x).hidden = x !== t;
    $('#tab-' + x).classList.toggle('active', x === t);
  });
  if (t === 'notes') renderNotes();
  if (t === 'ask') renderAnswers();
  scrollTo(0, 0);
}
document.querySelectorAll('.tab').forEach(b => b.onclick = () => showTab(b.dataset.tab));

/* ---------- One stop for everything ---------- */
const player = $('#player');
const synth = window.speechSynthesis;
let queue = [], token = 0;
function setPlaying(on) { $('#stopbar').hidden = !on; }
function markCard(id) { document.querySelectorAll('.card[data-clip]').forEach(c => c.classList.toggle('playing', c.dataset.clip === id)); }
function stopAll() {
  token++; queue = [];
  try { player.pause(); player.removeAttribute('src'); player.load(); } catch {}
  if (synth) synth.cancel();
  markCard(null); setPlaying(false);
}
$('#stopbar').onclick = () => { stopAll(); toast('หยุดแล้ว'); };

/* ---------- Thai speech (for answers + fallback) ---------- */
let thVoice = null;
function pickVoice() {
  if (!synth) return;
  const vs = synth.getVoices();
  thVoice = vs.find(v => /^th/i.test(v.lang) && /premium|enhanced/i.test(v.name)) || vs.find(v => /^th/i.test(v.lang)) || null;
  const w = $('#voice-warn');
  if (vs.length && !thVoice) { w.hidden = false; w.textContent = 'ถ้าไม่มีเสียงอ่านคำตอบ: เปิด Settings > Accessibility > Spoken Content > Voices > ไทย แล้วดาวน์โหลดเสียงไทย'; }
  else w.hidden = true;
}
if (synth) { pickVoice(); synth.onvoiceschanged = pickVoice; }
function chunks(text) {
  const parts = String(text).replace(/\s+/g, ' ').trim().split(/(?<=[ .!?\n])/);
  const out = []; let cur = '';
  for (const p of parts) { if ((cur + p).length > 180 && cur) { out.push(cur); cur = p; } else cur += p; }
  if (cur.trim()) out.push(cur);
  return out;
}
function speak(text, done) {
  if (!synth) { done && done(); return; }
  const t = token, pieces = chunks(text); let i = 0;
  setPlaying(true);
  const next = () => {
    if (t !== token) return;
    if (i >= pieces.length) { setPlaying(false); done && done(); return; }
    const u = new SpeechSynthesisUtterance(pieces[i++]);
    u.lang = 'th-TH'; if (thVoice) u.voice = thVoice; u.rate = rate;
    u.onend = next; u.onerror = e => { if (e.error !== 'interrupted' && e.error !== 'canceled') next(); };
    synth.speak(u);
  };
  next();
}

/* ---------- News ---------- */
let NEWS = { days: [] };
const KIND = { ai: ['ai', '🤖 ข่าว AI'], tiger: ['tiger', '📈 หุ้นเทค & AI (Tiger)'] };
function clipId(d, it) { return d.date + '-' + it.kind; }
function cardHTML(d, it) {
  const [cls, lab] = KIND[it.kind] || ['ai', it.kind];
  const mins = it.seconds ? ` · ${Math.max(1, Math.round(it.seconds / 60))} นาที` : '';
  return `<article class="card" data-clip="${clipId(d, it)}">
    <span class="badge ${cls}">${lab}</span>
    <h2>${esc(it.title)}</h2>
    <div class="date">${esc(d.label)}${mins}</div>
    <button class="play" data-date="${d.date}" data-kind="${it.kind}">▶️ ฟังคลิปนี้</button>
    <div class="text clip">${esc(it.text)}</div>
    <button class="more">อ่านทั้งหมด ▼</button>
    <div class="src">ที่มา: ${(it.sources || []).map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a>`).join(' · ')}</div>
  </article>`;
}
function renderNews() {
  const [first, ...rest] = NEWS.days;
  if (!first) { $('#news-today').innerHTML = '<p class="empty">ยังโหลดข่าวไม่ได้ ลองเปิดใหม่อีกครั้ง</p>'; return; }
  $('#news-day').textContent = 'ข่าวล่าสุด: ' + first.label;
  $('#news-today').innerHTML = first.items.map(it => cardHTML(first, it)).join('');
  $('#news-older').innerHTML = rest.map(d => d.items.map(it => cardHTML(d, it)).join('')).join('') || '<p class="empty">ยังไม่มี</p>';
}
function findItem(date, kind) { const d = NEWS.days.find(x => x.date === date); return d && { d, it: d.items.find(i => i.kind === kind) }; }
function playClips(list) {          // list of {d,it}; returns promise from first play (to detect autoplay block)
  stopAll(); const t = token; queue = list.slice();
  const next = () => {
    if (t !== token) return Promise.resolve();
    const x = queue.shift();
    if (!x) { markCard(null); setPlaying(false); return Promise.resolve(); }
    markCard(clipId(x.d, x.it)); setPlaying(true);
    const el = document.querySelector(`.card[data-clip="${clipId(x.d, x.it)}"]`);
    el && el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    player.src = x.it.audio; player.onended = next;
    player.onerror = () => { if (t !== token) return; speak(x.it.title + ' . ' + x.it.text, next); };   // fallback: phone voice
    return player.play();
  };
  return next();
}
function playToday() { const d = NEWS.days[0]; if (d) return playClips(d.items.map(it => ({ d, it }))); }
$('#start').onclick = () => { $('#start').classList.remove('pulse'); const p = playToday(); p && p.catch(() => {}); };
$('#page-news').addEventListener('click', e => {
  const b = e.target.closest('.play');
  if (b) { const x = findItem(b.dataset.date, b.dataset.kind); x && playClips([x]).catch(() => {}); return; }
  const m = e.target.closest('.more');
  if (m) { const t = m.parentElement.querySelector('.text'); const c = t.classList.toggle('clip'); m.textContent = c ? 'อ่านทั้งหมด ▼' : 'ย่อ ▲'; }
});
async function loadNews() {
  try { NEWS = await (await fetch('news.json?t=' + Date.now(), { cache: 'no-store' })).json(); }
  catch { try { NEWS = await (await fetch('news.json')).json(); } catch {} }
  renderNews();
  // Try to start by itself. iPhone usually blocks sound until the first tap, so the big button stays ready.
  const p = playToday();
  if (p) p.then(() => toast('กำลังเล่นข่าววันนี้'), () => { stopAll(); $('#start').classList.add('pulse'); });
}

/* ---------- Ask (free AI, Thai, auto-speak) ---------- */
const API = 'https://text.pollinations.ai/openai';
let history = [], lastAnswer = null;
function cleanText(s) {
  return String(s || '').replace(/<think>[\s\S]*?<\/think>/g, '').replace(/```[\s\S]*?```/g, '')
    .replace(/[*#_`>|]/g, '').replace(/^\s*[-•]\s*/gm, '').replace(/\n{3,}/g, '\n\n').trim();
}
function newsContext() {
  const d = NEWS.days[0]; if (!d) return '';
  return '\n\nข่าวล่าสุดที่แอปมี (' + d.label + ') ใช้ตอบได้ถ้าเกี่ยวข้อง:\n' + d.items.map(i => i.title + ': ' + i.text).join('\n');
}
async function ask(q) {
  stopAll();
  // unlock iPhone speech inside the tap, then speak the answer as soon as it arrives
  if (synth) { const u = new SpeechSynthesisUtterance('กำลังหาคำตอบค่ะ'); u.lang = 'th-TH'; if (thVoice) u.voice = thVoice; synth.speak(u); }
  $('#answer-box').hidden = false; $('#ans-q').textContent = q;
  $('#ans-text').innerHTML = '<span class="thinking">⏳ กำลังหาคำตอบ…</span>';
  $('#ask-btn').disabled = true;
  const sys = 'คุณคือผู้ช่วยของคุณแพม เจ้าของร้านอาหารไทยในเมืองโอ๊คแลนด์ นิวซีแลนด์ ตอบเป็นภาษาไทยเสมอ ใช้ภาษาพูดที่ฟังง่าย เป็นกันเอง ลงท้ายด้วยค่ะ ' +
    'ตอบสั้นกระชับไม่เกินประมาณ 8 ประโยค ห้ามใช้ตาราง หัวข้อ หรือสัญลักษณ์ markdown เพราะคำตอบจะถูกอ่านออกเสียง ' +
    'ห้ามแต่งข้อมูล ถ้าไม่แน่ใจหรือเป็นเรื่องข่าวล่าสุดที่ไม่มีในข้อมูลด้านล่าง ให้บอกตรง ๆ ว่าอาจไม่ทันสมัย ' +
    'เรื่องการลงทุนให้ข้อมูลทั่วไปและบอกว่าไม่ใช่คำแนะนำการลงทุน' + newsContext();
  const msgs = [{ role: 'system', content: sys }, ...history.slice(-4), { role: 'user', content: q }];
  let text = '';
  try {
    const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 70000);
    const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl.signal,
      body: JSON.stringify({ model: 'openai', messages: msgs, private: true }) });
    clearTimeout(tm);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    text = cleanText(j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content);
    if (!text) throw new Error('empty');
  } catch (e) {
    $('#ask-btn').disabled = false;
    const msg = 'ขอโทษค่ะ ตอนนี้บริการ AI ฟรีไม่ตอบ ลองกดถามใหม่อีกครั้งในอีกสักครู่นะคะ';
    $('#ans-text').textContent = msg; speak(msg); return;
  }
  $('#ask-btn').disabled = false;
  history.push({ role: 'user', content: q }, { role: 'assistant', content: text });
  lastAnswer = { id: uid(), title: q, text, date: today() };
  answers.unshift(lastAnswer); answers = answers.slice(0, 100); save(KA, answers);
  $('#ans-text').textContent = text; $('#q').value = '';
  if (synth) synth.cancel();
  speak(text);                       // answer is read out straight away
}
$('#ask-form').onsubmit = e => { e.preventDefault(); const q = $('#q').value.trim(); if (!q) { toast('พิมพ์หรือพูดคำถามก่อนนะคะ'); $('#q').focus(); return; } $('#q').blur(); ask(q); };
$('#q').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#ask-form').requestSubmit(); } });
$('#ans-replay').onclick = () => { if (lastAnswer) { stopAll(); speak(lastAnswer.text); } };
$('#ans-note').onclick = () => { if (lastAnswer) toNote(lastAnswer); };
function toNote(a) { notes.unshift({ id: uid(), title: a.title, text: a.text, updated: Date.now() }); save(KN, notes); toast('บันทึกเป็นโน้ตแล้ว ✓'); }

function renderAnswers() {
  const box = $('#answers');
  if (!answers.length) { box.innerHTML = '<p class="empty">ยังไม่มี คำตอบใหม่จะเก็บไว้ที่นี่อัตโนมัติ</p>'; return; }
  box.innerHTML = answers.map(a => `
    <article class="card" data-id="${a.id}">
      <h2>${esc(a.title)}</h2><div class="date">${esc(a.date || '')}</div>
      <div class="text clip">${esc(a.text)}</div>
      <button class="more">อ่านทั้งหมด ▼</button>
      <div class="actions">
        <button class="listen">🔊 ฟัง</button><button class="tonote">📝 เป็นโน้ต</button><button class="del">🗑 ลบ</button>
      </div>
    </article>`).join('');
}
$('#answers').addEventListener('click', e => {
  const card = e.target.closest('.card'); if (!card) return;
  const a = answers.find(x => x.id === card.dataset.id); if (!a) return;
  if (e.target.closest('.listen')) { stopAll(); speak(a.title + ' . ' + a.text); }
  else if (e.target.closest('.more')) { const t = card.querySelector('.text'); const c = t.classList.toggle('clip'); e.target.textContent = c ? 'อ่านทั้งหมด ▼' : 'ย่อ ▲'; }
  else if (e.target.closest('.tonote')) toNote(a);
  else if (e.target.closest('.del') && confirm('ลบคำตอบนี้ไหม?')) { answers = answers.filter(x => x !== a); save(KA, answers); renderAnswers(); toast('ลบแล้ว'); }
});

/* ---------- Notes (unchanged behaviour) ---------- */
let editingId = null;
function renderNotes() {
  const q = $('#n-search').value.trim().toLowerCase();
  const list = notes.filter(n => !q || (n.title + ' ' + n.text).toLowerCase().includes(q));
  const box = $('#notes');
  if (!list.length) { box.innerHTML = `<p class="empty">${q ? 'ไม่พบโน้ตที่ค้นหา' : 'ยังไม่มีโน้ต แตะ “เขียนโน้ตใหม่” ด้านบน'}</p>`; return; }
  box.innerHTML = list.map(n => `
    <article class="card" data-id="${n.id}">
      <h2>${esc(n.title || 'ไม่มีหัวข้อ')}</h2>
      <div class="date">แก้ไขล่าสุด ${new Date(n.updated).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}</div>
      <div class="text">${esc(n.text)}</div>
      <div class="actions"><button class="edit">✏️ แก้ไข</button><button class="del">🗑 ลบ</button></div>
    </article>`).join('');
}
$('#n-search').addEventListener('input', renderNotes);
$('#notes').addEventListener('click', e => {
  const card = e.target.closest('.card'); if (!card) return;
  const n = notes.find(x => x.id === card.dataset.id);
  if (e.target.closest('.edit')) {
    editingId = n.id; $('#n-title').value = n.title; $('#n-text').value = n.text;
    $('#add-note').open = true; $('#add-note summary').textContent = '✏️ แก้ไขโน้ต'; $('#n-save').textContent = 'บันทึกการแก้ไข';
    scrollTo({ top: 0, behavior: 'smooth' });
  } else if (e.target.closest('.del')) {
    if (confirm('ลบโน้ตนี้ไหม?')) { notes = notes.filter(x => x.id !== n.id); save(KN, notes); renderNotes(); toast('ลบโน้ตแล้ว'); }
  }
});
function resetNoteForm() { editingId = null; $('#n-title').value = ''; $('#n-text').value = ''; $('#add-note').open = false; $('#add-note summary').textContent = '➕ เขียนโน้ตใหม่'; $('#n-save').textContent = 'บันทึกโน้ต'; }
$('#n-save').onclick = () => {
  const title = $('#n-title').value.trim(), text = $('#n-text').value.trim();
  if (!title && !text) { toast('กรุณาเขียนโน้ตก่อน'); return; }
  if (editingId) { const n = notes.find(x => x.id === editingId); Object.assign(n, { title, text, updated: Date.now() }); notes = [n, ...notes.filter(x => x !== n)]; }
  else notes.unshift({ id: uid(), title, text, updated: Date.now() });
  save(KN, notes); resetNoteForm(); renderNotes(); toast('บันทึกโน้ตแล้ว ✓');
};

loadNews();
if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
