'use strict';
const $ = s => document.querySelector(s);
const KA = 'fk_answers_v1', KN = 'fk_notes_v1', KR = 'fk_rate_v1';
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const today = () => new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function toast(m) { const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => t.hidden = true, 2200); }

const SAMPLES = [
  { id: 'ex1', example: true, date: '30 ต.ค. 2569', title: 'ตัวอย่าง: กฎหมายควบคุม AI',
    text: 'ตอนนี้หลายประเทศเริ่มออกกฎควบคุมการใช้ปัญญาประดิษฐ์ ที่ชัดที่สุดคือสหภาพยุโรป ซึ่งมีกฎหมาย AI Act บังคับใช้เป็นขั้น ๆ เริ่มจากห้ามการใช้ AI ที่อันตราย เช่น การให้คะแนนพฤติกรรมประชาชน แล้วตามด้วยกฎสำหรับโมเดลใหญ่ ๆ และกฎสำหรับ AI ที่มีความเสี่ยงสูง ซึ่งบางส่วนมีการเสนอให้เลื่อนออกไป ส่วนสหรัฐยังไม่มีกฎหมายกลางเรื่อง AI โดยตรง แต่ละรัฐออกกฎของตัวเอง สำหรับเรา สิ่งที่ควรรู้คือ ข้อมูลส่วนตัวของลูกค้าต้องระวัง และถ้าใช้ AI ทำรูปหรือข้อความโฆษณา ควรตรวจให้ถูกต้องก่อนโพสต์' },
  { id: 'ex2', example: true, date: '30 ต.ค. 2569', title: 'ตัวอย่าง: กฎหมายคริปโตของสหรัฐ',
    text: 'สหรัฐมีกฎหมายสำหรับเหรียญดิจิทัลที่ผูกค่ากับเงินดอลลาร์ เรียกว่า สเตเบิลคอยน์ ชื่อว่า GENIUS Act ซึ่งลงนามเป็นกฎหมายแล้ว กำหนดให้ผู้ออกเหรียญต้องมีเงินสดหรือพันธบัตรหนุนเต็มจำนวน และต้องถูกตรวจสอบ ส่วนกฎหมายใหญ่อีกฉบับชื่อ CLARITY Act ที่จะแบ่งให้ชัดว่าใครดูแลบิตคอยน์และเหรียญอื่น ๆ ยังติดอยู่ในวุฒิสภา ยังไม่ผ่าน สรุปง่าย ๆ คือ กฎเริ่มชัดขึ้น แต่ราคาบิตคอยน์ยังขึ้นลงแรง ควรลงทุนแค่เงินที่เสียได้' },
  { id: 'ex3', example: true, date: '30 ต.ค. 2569', title: 'ตัวอย่าง: สรุปข่าว AI',
    text: 'ข่าว AI ช่วงนี้ บริษัทใหญ่อย่าง กูเกิล ไมโครซอฟท์ เมตา และอเมซอน ยังลงทุนสร้างศูนย์ข้อมูลกันมหาศาล ทำให้หุ้นกลุ่มชิปและเทคโนโลยีถูกจับตามาก ขณะเดียวกันนักลงทุนบางส่วนเริ่มกังวลว่าเงินที่ลงไปจะคุ้มหรือไม่ สำหรับคนทั่วไป AI ช่วยงานประจำวันได้มากขึ้น เช่น เขียนโพสต์ แปลภาษา และตอบคำถามลูกค้า นี่เป็นคำตอบตัวอย่าง ลบออกได้ถ้าไม่ต้องการ' },
];

let answers = load(KA, null);
if (!answers) { answers = SAMPLES; save(KA, answers); }
let notes = load(KN, []);
let rate = Number(load(KR, 1)) || 1;

/* ---------- Tabs ---------- */
function showTab(which) {
  const a = which === 'answers';
  $('#page-answers').hidden = !a; $('#page-notes').hidden = a;
  $('#tab-answers').classList.toggle('active', a); $('#tab-notes').classList.toggle('active', !a);
  $('#tab-answers').setAttribute('aria-selected', a); $('#tab-notes').setAttribute('aria-selected', !a);
  scrollTo(0, 0);
}
$('#tab-answers').onclick = () => showTab('answers');
$('#tab-notes').onclick = () => { showTab('notes'); renderNotes(); };

/* ---------- Speech ---------- */
const synth = window.speechSynthesis;
let thVoice = null, queue = [], playingId = null, playAll = false, token = 0;
function pickVoice() {
  if (!synth) return;
  const vs = synth.getVoices();
  thVoice = vs.find(v => /^th/i.test(v.lang) && /premium|enhanced/i.test(v.name))
         || vs.find(v => /^th/i.test(v.lang)) || null;
  const w = $('#voice-warn');
  if (vs.length && !thVoice) { w.hidden = false; w.textContent = 'เครื่องนี้ยังไม่มีเสียงภาษาไทย: เปิด การตั้งค่า (Settings) > การช่วยการเข้าถึง (Accessibility) > Spoken Content > Voices > ไทย แล้วดาวน์โหลดเสียงไทย'; }
  else w.hidden = true;
}
if (synth) { pickVoice(); synth.onvoiceschanged = pickVoice; }
else { const w = $('#voice-warn'); w.hidden = false; w.textContent = 'เบราว์เซอร์นี้อ่านออกเสียงไม่ได้ กรุณาเปิดด้วย Safari'; }

// iPhone cuts off long speech, so split into short pieces (Thai uses spaces between phrases)
function chunks(text) {
  const parts = String(text).replace(/\s+/g, ' ').trim().split(/(?<=[ .!?。\n])/);
  const out = []; let cur = '';
  for (const p of parts) { if ((cur + p).length > 180 && cur) { out.push(cur); cur = p; } else cur += p; }
  if (cur.trim()) out.push(cur);
  return out;
}
function markPlaying(id) {
  playingId = id;
  document.querySelectorAll('.card').forEach(c => c.classList.toggle('playing', c.dataset.id === id));
  if (id) { const el = document.querySelector(`.card[data-id="${id}"]`); el && el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
}
function stopAll() { token++; playAll = false; queue = []; if (synth) synth.cancel(); markPlaying(null); }
function speakItem(item, t, done) {
  const pieces = chunks(item.title + ' . ' + item.text);
  let i = 0;
  markPlaying(item.id);
  const next = () => {
    if (t !== token) return;
    if (i >= pieces.length) { done && done(); return; }
    const u = new SpeechSynthesisUtterance(pieces[i++]);
    u.lang = 'th-TH'; if (thVoice) u.voice = thVoice; u.rate = rate;
    u.onend = next; u.onerror = e => { if (e.error !== 'interrupted' && e.error !== 'canceled') next(); };
    synth.speak(u);
  };
  next();
}
function listen(id) {
  if (!synth) return;
  stopAll(); const t = token;
  const item = answers.find(a => a.id === id); if (!item) return;
  speakItem(item, t, () => markPlaying(null));
}
function playAllFrom(idx = 0) {
  if (!synth) return;
  stopAll(); const t = token; playAll = true;
  const list = answers.slice(idx);
  if (!list.length) { toast('ยังไม่มีคำตอบ'); return; }
  let k = 0;
  const go = () => { if (t !== token) return; if (k >= list.length) { markPlaying(null); playAll = false; toast('อ่านครบทุกคำตอบแล้ว'); return; } speakItem(list[k++], t, go); };
  go();
}
$('#play-all').onclick = () => playAllFrom(0);
$('#stop').onclick = () => { stopAll(); toast('หยุดแล้ว'); };
document.querySelectorAll('.rate').forEach(b => {
  b.classList.toggle('on', Number(b.dataset.rate) === rate);
  b.onclick = () => { rate = Number(b.dataset.rate); save(KR, rate); document.querySelectorAll('.rate').forEach(x => x.classList.toggle('on', x === b)); toast('ตั้งความเร็ว: ' + b.textContent); };
});

/* ---------- Answers ---------- */
function renderAnswers() {
  const box = $('#answers');
  if (!answers.length) { box.innerHTML = '<p class="empty">ยังไม่มีคำตอบ แตะ “เพิ่มคำตอบใหม่” ด้านบน</p>'; return; }
  box.innerHTML = answers.map(a => `
    <article class="card${a.id === playingId ? ' playing' : ''}" data-id="${a.id}">
      <h2>${esc(a.title)}</h2>
      <div class="date">${esc(a.date)}</div>
      <div class="text clip">${esc(a.text)}</div>
      <button class="more">อ่านทั้งหมด ▼</button>
      <div class="actions">
        <button class="listen">🔊 ฟัง</button>
        <button class="tonote">📝 บันทึกเป็นโน้ต</button>
        <button class="del">🗑 ลบ</button>
      </div>
    </article>`).join('');
}
$('#answers').addEventListener('click', e => {
  const card = e.target.closest('.card'); if (!card) return;
  const id = card.dataset.id, a = answers.find(x => x.id === id);
  if (e.target.closest('.listen')) listen(id);
  else if (e.target.closest('.more')) { const t = card.querySelector('.text'); const c = t.classList.toggle('clip'); e.target.textContent = c ? 'อ่านทั้งหมด ▼' : 'ย่อ ▲'; }
  else if (e.target.closest('.tonote')) {
    notes.unshift({ id: uid(), title: a.title.replace(/^ตัวอย่าง:\s*/, ''), text: a.text, updated: Date.now() });
    save(KN, notes); toast('บันทึกเป็นโน้ตแล้ว ✓ ดูได้ที่แท็บ โน้ต');
  } else if (e.target.closest('.del')) {
    if (confirm('ลบคำตอบนี้ไหม?')) { if (playingId === id) stopAll(); answers = answers.filter(x => x.id !== id); save(KA, answers); renderAnswers(); toast('ลบแล้ว'); }
  }
});
$('#a-save').onclick = () => {
  const text = $('#a-text').value.trim(); if (!text) { toast('กรุณาวางข้อความก่อน'); return; }
  const title = $('#a-title').value.trim() || text.slice(0, 30) + (text.length > 30 ? '…' : '');
  answers.unshift({ id: uid(), title, text, date: today() }); save(KA, answers);
  $('#a-title').value = ''; $('#a-text').value = ''; $('#add-answer').open = false;
  renderAnswers(); toast('เพิ่มคำตอบแล้ว ✓');
};

/* ---------- Notes ---------- */
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
      <div class="actions">
        <button class="edit">✏️ แก้ไข</button>
        <button class="del">🗑 ลบ</button>
      </div>
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

renderAnswers();
if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
