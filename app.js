/* ระบบประเมิน คปสอ. — หน้าเว็บ */
(function () {
  const api = window.createApi();
  const $ = (s, el = document) => el.querySelector(s);
  const esc = s => String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (v, d = 2) => (v === null || v === undefined || isNaN(v)) ? '–' : Number(v).toFixed(d);
  const app = $('#app');
  let S = null;                         // ข้อมูลจาก bootstrap
  let view = null, selGroup = null, selItem = null, sortByTotal = false;

  /* ---------------- ทั่วไป ---------------- */
  function toast(msg, kind = 'ok') {
    const t = document.createElement('div'); t.className = 'toast ' + kind; t.textContent = msg;
    document.body.appendChild(t); setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, kind === 'err' ? 5000 : 2500);
  }
  async function run(fn, okMsg) {
    document.body.classList.add('busy');
    try { const r = await fn(); if (okMsg) toast(okMsg); return r; }
    catch (e) { if (e.auth === false) { S = null; renderLogin(e.message); } else toast(e.message, 'err'); throw e; }
    finally { document.body.classList.remove('busy'); }
  }
  async function reload() { S = await run(() => api.call('bootstrap')); render(); }

  const isAdmin = () => S && S.user.role === 'admin';
  const groupName = id => (S.groups.find(g => g.id === id) || {}).name || id;
  const itemsOf = gid => S.items.filter(i => i.groupId === gid).sort((a, b) => a.order - b.order);
  const scoreOf = (itemId, d) => (S.scores[itemId] || {})[d];

  /* ---------------- เข้าสู่ระบบ ---------------- */
  function renderLogin(msg) {
    app.innerHTML = `
      <div class="login">
        <div class="card login-card">
          <div class="brand"><div class="logo">คปสอ.</div><div><h1>ระบบประเมินเครือข่ายบริการสุขภาพ</h1>
          <p class="muted">สำนักงานสาธารณสุขจังหวัดพิษณุโลก</p></div></div>
          ${api.demo ? `<div class="note">โหมดทดลอง — ข้อมูลทั้งหมดเป็นข้อมูลสมมติและเก็บในเบราว์เซอร์นี้เท่านั้น<br>
            ผู้ดูแลระบบ: <b>admin</b> / <b>admin1234</b> · กลุ่มงาน: <b>g01</b>–<b>g15</b> / <b>demo1234</b></div>` : ''}
          <form id="loginForm">
            <label>ชื่อผู้ใช้<input name="u" autocomplete="username" required></label>
            <label>รหัสผ่าน<input name="p" type="password" autocomplete="current-password" required></label>
            ${msg ? `<p class="err">${esc(msg)}</p>` : ''}
            <button class="btn primary block">เข้าสู่ระบบ</button>
          </form>
        </div>
      </div>`;
    $('#loginForm').onsubmit = async e => {
      e.preventDefault();
      const f = e.target;
      try { await run(() => api.login(f.u.value, f.p.value)); view = null; await reload(); }
      catch (err) { if (err.auth !== false) renderLogin(err.message); }
    };
  }

  /* ---------------- โครงหน้า ---------------- */
  function tabs() {
    return isAdmin()
      ? [['overview', 'ภาพรวม'], ['results', 'ผลการประเมิน'], ['kpi', 'ผลงาน KPI (60%)'], ['items', 'ประเด็น/คะแนนรายกลุ่ม'],
         ['users', 'ผู้ใช้งาน'], ['settings', 'ตั้งค่า'], ['rubricEdit', 'เกณฑ์ PDCA'], ['log', 'ประวัติการใช้งาน'], ['account', 'บัญชี']]
      : [['items', 'ประเด็นการประเมิน'], ['scores', 'ให้คะแนน'], ['rubric', 'เกณฑ์ PDCA'], ['account', 'บัญชี']];
  }
  function render() {
    if (!S) return renderLogin();
    const t = tabs(); if (!view || !t.some(x => x[0] === view)) view = t[0][0];
    if (!isAdmin()) selGroup = S.user.groupId; else if (!selGroup) selGroup = (S.groups[0] || {}).id;
    const st = S.settings;
    app.innerHTML = `
      <header class="top">
        <div class="brand"><div class="logo">คปสอ.</div><div><b>ระบบประเมิน คปสอ. ปีงบประมาณ ${esc(st.year)}</b>
          <div class="muted small">${isAdmin() ? 'ผู้ดูแลระบบ' : esc(groupName(S.user.groupId))} · ${esc(S.user.name)}</div></div></div>
        <div class="right">
          ${api.demo ? '<span class="pill warn">โหมดทดลอง</span>' : ''}
          <span class="pill ${st.scoringOpen ? 'ok' : 'off'}">${st.scoringOpen ? 'เปิดรับคะแนน' : 'ปิดรับคะแนน'}</span>
          ${st.deadline ? `<span class="pill">กำหนดส่ง ${esc(st.deadline)}</span>` : ''}
          <button class="btn ghost" id="logout">ออกจากระบบ</button>
        </div>
      </header>
      <nav class="tabs">${t.map(([k, l]) => `<button data-v="${k}" class="${k === view ? 'on' : ''}">${l}</button>`).join('')}</nav>
      <main id="main"></main>`;
    app.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { view = b.dataset.v; render(); });
    $('#logout').onclick = async () => { await api.logout(); S = null; renderLogin(); };
    ({ overview: vOverview, results: vResults, kpi: vKpi, items: vItems, scores: vScores, rubric: vRubric,
       users: vUsers, settings: vSettings, rubricEdit: vRubricEdit, log: vLog, account: vAccount })[view]($('#main'));
  }

  /* ---------------- กลุ่มงาน: ประเด็น ---------------- */
  function groupPicker() {
    if (!isAdmin()) return '';
    return `<label class="inline">กลุ่มงาน <select id="gpick">${S.groups.map(g =>
      `<option value="${g.id}" ${g.id === selGroup ? 'selected' : ''}>${esc(g.name)}${g.active ? '' : ' (ปิด)'}</option>`).join('')}</select></label>`;
  }
  function bindPicker(after) { const p = $('#gpick'); if (p) p.onchange = () => { selGroup = p.value; selItem = null; after(); }; }
  const typeLabel = it => it.type === 'criteria'
    ? `<span class="badge c">เกณฑ์คะแนน เต็ม ${fmt(it.max, 0)}</span>` : '<span class="badge p">PDCA 5 ด้าน</span>';

  function vItems(m) {
    const its = itemsOf(selGroup), open = S.settings.itemsOpen || isAdmin();
    m.innerHTML = `
      <div class="bar">${groupPicker()}<h2>${esc(groupName(selGroup))}</h2></div>
      ${!open ? '<p class="note">ขณะนี้ปิดการแก้ไขประเด็นแล้ว</p>' : ''}
      ${isAdmin() ? '' : `<p class="muted">เพิ่มประเด็นที่กลุ่มงานจะใช้ประเมิน คปสอ. ได้เอง แต่ละประเด็นเลือกรูปแบบการให้คะแนนได้ 2 แบบ:
        <b>PDCA 5 ด้าน</b> (ระดับ 1–5 ตามเกณฑ์กลาง) หรือ <b>เกณฑ์คะแนนของกลุ่มงาน</b> (กำหนดคะแนนเต็มและระดับคะแนนเอง)</p>`}
      <div class="card">
        <table class="tbl"><thead><tr><th>#</th><th>ประเด็น</th><th>รูปแบบ</th><th>ระดับคะแนน / เกณฑ์</th><th>น้ำหนัก</th><th></th></tr></thead>
        <tbody>${its.map((it, i) => `<tr>
          <td>${i + 1}</td><td>${esc(it.title)}</td><td>${typeLabel(it)}</td>
          <td class="small">${it.type === 'criteria' ? esc(it.levels.join(', ')) + (it.criteria ? '<br><span class="muted">' + esc(it.criteria) + '</span>' : '') : 'ระดับ 1–5'}</td>
          <td>${fmt(Scoring.itemWeight(it), 0)}</td>
          <td class="nowrap">${open ? `<button class="btn sm" data-e="${it.id}">แก้ไข</button> <button class="btn sm danger" data-d="${it.id}">ลบ</button>` : ''}</td>
        </tr>`).join('') || '<tr><td colspan="6" class="muted center">ยังไม่มีประเด็น</td></tr>'}</tbody></table>
        ${open ? '<button class="btn primary" id="addItem">+ เพิ่มประเด็น</button>' : ''}
      </div>
      <div id="itemForm"></div>`;
    bindPicker(() => vItems(m));
    if (!open) return;
    $('#addItem').onclick = () => itemForm({ type: 'pdca' });
    m.querySelectorAll('[data-e]').forEach(b => b.onclick = () => itemForm(S.items.find(i => i.id === b.dataset.e)));
    m.querySelectorAll('[data-d]').forEach(b => b.onclick = async () => {
      const it = S.items.find(i => i.id === b.dataset.d);
      if (!confirm('ลบประเด็น "' + it.title + '" และคะแนนทั้งหมดของประเด็นนี้?')) return;
      await run(() => api.call('deleteItem', { id: it.id }), 'ลบแล้ว'); await reload();
    });
  }

  function itemForm(it) {
    const box = $('#itemForm');
    box.innerHTML = `<div class="card"><h3>${it.id ? 'แก้ไขประเด็น' : 'เพิ่มประเด็น'}</h3>
      <form id="f" class="grid2">
        <label class="span2">ชื่อประเด็นการประเมิน<textarea name="title" rows="2" required>${esc(it.title || '')}</textarea></label>
        <label>รูปแบบการให้คะแนน<select name="type">
          <option value="pdca" ${it.type !== 'criteria' ? 'selected' : ''}>PDCA 5 ด้าน (ระดับ 1–5)</option>
          <option value="criteria" ${it.type === 'criteria' ? 'selected' : ''}>เกณฑ์คะแนนของกลุ่มงาน</option></select></label>
        <label>น้ำหนักประเด็น <span class="muted small">(เว้นว่าง = ค่าตั้งต้น)</span><input name="weight" type="number" step="any" min="0" value="${it.weight ?? ''}"></label>
        <div class="crit span2 grid2">
          <label>คะแนนเต็ม<input name="max" type="number" step="any" min="0" value="${it.max ?? ''}"></label>
          <label>ระดับคะแนนที่เลือกได้ (คั่นด้วย ,)<input name="levels" placeholder="เช่น 15,13,11,9,7" value="${esc((it.levels || []).join(','))}"></label>
          <label class="span2">คำอธิบายเกณฑ์<textarea name="criteria" rows="2" placeholder="เช่น 100% = 15 | 95–99.99% = 13 | <95% = 10">${esc(it.criteria || '')}</textarea></label>
        </div>
        <p class="muted small span2">วิธีคิด: PDCA = 15 × ค่าเฉลี่ยระดับ + 25 · เกณฑ์คะแนน = คะแนนที่ได้ ÷ คะแนนเต็ม × 100 ·
          คะแนนกลุ่มงาน = ค่าเฉลี่ยถ่วงน้ำหนักทุกประเด็น (ค่าตั้งต้น: PDCA = 1, เกณฑ์คะแนน = คะแนนเต็ม)</p>
        <div class="span2"><button class="btn primary">บันทึก</button> <button type="button" class="btn ghost" id="cancel">ยกเลิก</button></div>
      </form></div>`;
    const f = $('#f'), sync = () => box.querySelector('.crit').style.display = f.type.value === 'criteria' ? '' : 'none';
    f.type.onchange = sync; sync();
    $('#cancel').onclick = () => box.innerHTML = '';
    f.onsubmit = async e => {
      e.preventDefault();
      const item = { id: it.id, groupId: selGroup, title: f.title.value, type: f.type.value, weight: f.weight.value,
                     max: f.max.value, levels: f.levels.value, criteria: f.criteria.value };
      await run(() => api.call('saveItem', { item }), 'บันทึกประเด็นแล้ว'); await reload();
    };
    box.scrollIntoView({ behavior: 'smooth' });
  }

  /* ---------------- กลุ่มงาน: ให้คะแนน ---------------- */
  function vScores(m) {
    const its = itemsOf(selGroup), open = S.settings.scoringOpen || isAdmin();
    if (!selItem || !its.some(i => i.id === selItem)) selItem = (its[0] || {}).id;
    const it = its.find(i => i.id === selItem);
    const prog = d => Scoring.groupProgress(its, id => scoreOf(id, d));
    m.innerHTML = `
      <div class="bar">${groupPicker()}<h2>ให้คะแนน · ${esc(groupName(selGroup))}</h2></div>
      ${!open ? '<p class="note">ขณะนี้ปิดรับคะแนนแล้ว (ดูได้อย่างเดียว)</p>' : ''}
      ${!its.length ? '<p class="note">ยังไม่มีประเด็น — เพิ่มประเด็นที่แท็บ "ประเด็นการประเมิน" ก่อน</p>' : `
      <div class="layout">
        <aside class="card list">${its.map((x, i) => {
          const done = S.districts.filter(d => Scoring.itemScore(x, scoreOf(x.id, d)) !== null).length;
          return `<button data-i="${x.id}" class="${x.id === selItem ? 'on' : ''}"><span>${i + 1}. ${esc(x.title)}</span>
            <span class="pill ${done === S.districts.length ? 'ok' : done ? 'warn' : 'off'}">${done}/${S.districts.length}</span></button>`;
        }).join('')}</aside>
        <section class="card">
          <h3>${esc(it.title)}</h3><p>${typeLabel(it)} ${it.criteria ? '<span class="muted small">' + esc(it.criteria) + '</span>' : ''}</p>
          <div class="scroll"><table class="tbl score"><thead><tr><th>อำเภอ</th>
            ${it.type === 'criteria' ? '<th>คะแนนที่ได้</th>' : Scoring.PDCA.map(p => `<th title="${esc(p)}">${esc(p.match(/\((\w+)\)/)[1])}</th>`).join('')}
            <th>คะแนนประเด็น (0–100)</th></tr></thead>
          <tbody>${S.districts.map(d => {
            const v = scoreOf(it.id, d) || [];
            const opts = (vals, cur) => `<option value=""></option>` + vals.map(x => `<option ${Number(cur) === x && cur !== null && cur !== '' ? 'selected' : ''}>${x}</option>`).join('');
            const cells = it.type === 'criteria'
              ? `<td><select data-d="${esc(d)}" data-k="0" ${open ? '' : 'disabled'}>${opts(it.levels, v[0])}</select></td>`
              : [0, 1, 2, 3, 4].map(k => `<td><select data-d="${esc(d)}" data-k="${k}" ${open ? '' : 'disabled'}>${opts([5, 4, 3, 2, 1], v[k])}</select></td>`).join('');
            return `<tr><td>${esc(d)}</td>${cells}<td class="s" data-s="${esc(d)}">${fmt(Scoring.itemScore(it, v))}</td></tr>`;
          }).join('')}</tbody></table></div>
          ${open ? '<button class="btn primary" id="saveS">บันทึกคะแนนประเด็นนี้</button>' : ''}
        </section>
      </div>
      <div class="card"><h3>สรุปคะแนนกลุ่มงาน (S) รายอำเภอ</h3>
        <div class="scroll"><table class="tbl"><thead><tr><th></th>${S.districts.map(d => `<th>${esc(d)}</th>`).join('')}</tr></thead>
        <tbody><tr><td>กรอกครบ (ประเด็น)</td>${S.districts.map(d => { const p = prog(d); return `<td class="${p.done === p.total ? 'good' : ''}">${p.done}/${p.total}</td>`; }).join('')}</tr>
        <tr><td><b>คะแนน S</b></td>${S.districts.map(d => `<td><b>${fmt(Scoring.groupScore(its, id => scoreOf(id, d)))}</b></td>`).join('')}</tr></tbody></table></div>
        <p class="muted small">คะแนน S แสดงเมื่อกรอกครบทุกประเด็นของอำเภอนั้น</p></div>`}`;
    bindPicker(() => vScores(m));
    m.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { selItem = b.dataset.i; vScores(m); });
    if (!it) return;
    const collect = () => {
      const e = {};
      S.districts.forEach(d => {
        const arr = [...m.querySelectorAll(`select[data-d="${CSS.escape(d)}"]`)].map(s => s.value === '' ? '' : Number(s.value));
        e[d] = arr;
      });
      return e;
    };
    m.querySelectorAll('select[data-d]').forEach(s => s.onchange = () => {
      const d = s.dataset.d, arr = collect()[d];
      m.querySelector(`[data-s="${CSS.escape(d)}"]`).textContent = fmt(Scoring.itemScore(it, arr.map(x => x === '' ? null : x)));
    });
    const btn = $('#saveS');
    if (btn) btn.onclick = async () => {
      const entries = collect();
      const partial = S.districts.filter(d => it.type === 'pdca' && entries[d].some(x => x === '') && entries[d].some(x => x !== ''));
      if (partial.length && !confirm('ยังให้คะแนนไม่ครบ 5 ด้านใน: ' + partial.join(', ') + '\nบันทึกไว้ก่อนหรือไม่?')) return;
      await run(() => api.call('saveScores', { itemId: it.id, entries }), 'บันทึกคะแนนแล้ว'); await reload();
    };
  }

  function vRubric(m) {
    const r = S.settings.rubric || [];
    m.innerHTML = `<h2>เกณฑ์การให้คะแนน PDCA (ระดับ 1–5)</h2><div class="card scroll"><table class="tbl rub">
      <thead><tr><th>องค์ประกอบ</th><th>5 มากที่สุด</th><th>4 มาก</th><th>3 ปานกลาง</th><th>2 น้อย</th><th>1 น้อยมาก</th></tr></thead>
      <tbody>${r.map(row => `<tr>${row.map((c, i) => i ? `<td>${esc(c)}</td>` : `<th>${esc(c)}</th>`).join('')}</tr>`).join('')}</tbody></table>
      <p class="muted small">ระดับ 5 = 100 · 4 = 85 · 3 = 70 · 2 = 55 · 1 = 40 คะแนน</p></div>`;
  }

  /* ---------------- ผู้ดูแลระบบ ---------------- */
  function vOverview(m) {
    const act = S.groups.filter(g => g.active);
    const cell = (g, d) => {
      const its = itemsOf(g.id); if (!its.length) return '<td class="off">–</td>';
      const p = Scoring.groupProgress(its, id => scoreOf(id, d)), s = Scoring.groupScore(its, id => scoreOf(id, d));
      return `<td class="${s !== null ? 'good' : p.done ? 'part' : 'none'}" title="${p.done}/${p.total} ประเด็น">${s !== null ? fmt(s, 1) : p.done + '/' + p.total}</td>`;
    };
    const complete = act.filter(g => itemsOf(g.id).length && S.districts.every(d => Scoring.groupScore(itemsOf(g.id), id => scoreOf(id, d)) !== null)).length;
    m.innerHTML = `<h2>ความคืบหน้าการประเมินส่วนที่ 2 (40%)</h2>
      <div class="stats"><div class="stat"><b>${complete}/${act.length}</b><span>กลุ่มงานประเมินครบ 9 อำเภอ</span></div>
        <div class="stat"><b>${S.items.length}</b><span>ประเด็นทั้งหมด</span></div>
        <div class="stat"><b>${S.districts.filter(d => S.kpi && S.kpi[d] !== null && S.kpi[d] !== undefined && S.kpi[d] !== '').length}/9</b><span>อำเภอที่ลงผลงาน KPI แล้ว</span></div></div>
      <div class="card scroll"><table class="tbl matrix"><thead><tr><th>กลุ่มงาน</th><th>ประเด็น</th>${S.districts.map(d => `<th>${esc(d)}</th>`).join('')}</tr></thead>
      <tbody>${act.map(g => `<tr><td>${esc(g.name)}</td><td>${itemsOf(g.id).length}</td>${S.districts.map(d => cell(g, d)).join('')}</tr>`).join('')}</tbody></table>
      <p class="muted small"><span class="key good"></span> ครบ (แสดงคะแนน S) <span class="key part"></span> กรอกบางส่วน (ประเด็นที่ครบ/ทั้งหมด) <span class="key none"></span> ยังไม่กรอก</p></div>`;
  }

  function resultsData() {
    return Scoring.results({ districts: S.districts, groups: S.groups, items: S.items, scores: S.scores, kpi: S.kpi });
  }
  function vResults(m) {
    let rows = resultsData();
    if (sortByTotal) rows = rows.slice().sort((a, b) => (b.total ?? -1) - (a.total ?? -1));
    m.innerHTML = `<div class="bar"><h2>ผลการประเมิน คปสอ. ปีงบประมาณ ${esc(S.settings.year)}</h2>
        <label class="inline"><input type="checkbox" id="sort" ${sortByTotal ? 'checked' : ''}> เรียงตามคะแนนรวม</label>
        <button class="btn" id="csv">ดาวน์โหลด CSV</button></div>
      ${rows.some(r => r.groupsCounted < r.groupsTotal) ? `<p class="note">ผลยังไม่สมบูรณ์ — มีกลุ่มงานที่ยังประเมินไม่ครบในบางอำเภอ (ดูคอลัมน์ "กลุ่มงานที่นับ")
        คะแนนส่วนที่ 2 ตอนนี้เฉลี่ยจากกลุ่มที่ครบแล้วเท่านั้น ยังไม่ควรใช้ประกาศผล</p>` : ''}
      <div class="card scroll"><table class="tbl"><thead><tr><th>อำเภอ</th><th>ร้อยละผ่าน KPI</th><th>ส่วนที่ 1 (60)</th>
        <th>ส่วนที่ 2 ร้อยละ</th><th>ส่วนที่ 2 (40)</th><th>กลุ่มงานที่นับ</th><th>คะแนนรวม (100)</th><th>ระดับ</th></tr></thead>
      <tbody>${rows.map(r => `<tr><td>${esc(r.district)}</td><td>${fmt(r.kpi, 1)}</td><td>${fmt(r.p1)}</td><td>${fmt(r.p2pct)}</td>
        <td>${fmt(r.p2)}</td><td class="${r.groupsCounted < r.groupsTotal ? 'part' : 'good'}">${r.groupsCounted}/${r.groupsTotal}</td><td><b>${fmt(r.total)}</b></td>
        <td>${r.grade ? `<span class="grade g-${{ 'ดีเยี่ยม': 1, 'ดีมาก': 2, 'ดี': 3, 'ต้องปรับปรุง': 4 }[r.grade]}">${r.grade}</span>` : '–'}</td></tr>`).join('')}</tbody></table>
      <p class="muted small">ส่วนที่ 1 = ร้อยละผ่าน KPI × 0.60 · ส่วนที่ 2 = ค่าเฉลี่ยคะแนน S ของกลุ่มงานที่ประเมินครบ × 0.40 (ทุกกลุ่มน้ำหนักเท่ากัน) ·
        คะแนนรวมแสดงเมื่อมีครบทั้ง 2 ส่วน · ดีเยี่ยม ≥ 90 · ดีมาก 80–89.99 · ดี 50–79.99 · ต้องปรับปรุง &lt; 50</p></div>`;
    $('#sort').onchange = e => { sortByTotal = e.target.checked; vResults(m); };
    $('#csv').onclick = () => downloadCsv(rows);
  }
  function downloadCsv(rows) {
    const gs = S.groups.filter(g => g.active);
    const head = ['อำเภอ', 'ร้อยละผ่าน KPI', 'ส่วนที่ 1', 'ส่วนที่ 2 ร้อยละ', 'ส่วนที่ 2', 'คะแนนรวม', 'ระดับ'].concat(gs.map(g => 'S ' + g.name));
    const lines = [head].concat(rows.map(r => [r.district, r.kpi, r.p1, r.p2pct, r.p2, r.total, r.grade]
      .concat(gs.map(g => (r.byGroup.find(x => x.groupId === g.id) || {}).s))
      .map(v => typeof v === 'number' ? v.toFixed(2) : (v ?? ''))));
    const csv = '﻿' + lines.map(l => l.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `ผลประเมิน_คปสอ_${S.settings.year}.csv`; a.click();
  }

  function vKpi(m) {
    m.innerHTML = `<h2>ผลงานตัวชี้วัด (Health KPI) — ส่วนที่ 1 (60%)</h2>
      <p class="muted">ลงร้อยละของตัวชี้วัดที่ผ่านเกณฑ์ของแต่ละอำเภอ (0–100) ข้อมูลส่วนนี้ผู้ดูแลระบบเป็นผู้บันทึกเท่านั้น</p>
      <form id="kf" class="card"><table class="tbl narrow"><thead><tr><th>อำเภอ</th><th>ร้อยละผ่าน KPI</th><th>ส่วนที่ 1 (×0.60)</th></tr></thead>
      <tbody>${S.districts.map(d => `<tr><td>${esc(d)}</td><td><input type="number" step="0.01" min="0" max="100" name="${esc(d)}" value="${S.kpi[d] ?? ''}"></td>
        <td data-p="${esc(d)}">${fmt(S.kpi[d] === null || S.kpi[d] === undefined || S.kpi[d] === '' ? null : S.kpi[d] * 0.6)}</td></tr>`).join('')}</tbody></table>
      <button class="btn primary">บันทึกผลงาน KPI</button></form>`;
    const f = $('#kf');
    f.oninput = e => { const d = e.target.name; $(`[data-p="${CSS.escape(d)}"]`).textContent = fmt(e.target.value === '' ? null : e.target.value * 0.6); };
    f.onsubmit = async e => {
      e.preventDefault(); const kpi = {};
      S.districts.forEach(d => kpi[d] = f.elements[d].value === '' ? null : Number(f.elements[d].value));
      await run(() => api.call('saveKpi', { kpi }), 'บันทึกผลงาน KPI แล้ว'); await reload();
    };
  }

  function vUsers(m) {
    m.innerHTML = `<h2>ผู้ใช้งาน</h2>
      <div class="card scroll"><table class="tbl"><thead><tr><th>ชื่อผู้ใช้</th><th>ชื่อที่แสดง</th><th>สิทธิ์</th><th>กลุ่มงาน</th><th>สถานะ</th><th></th></tr></thead>
      <tbody>${S.users.map(u => `<tr><td>${esc(u.username)}</td><td>${esc(u.name)}</td><td>${u.role === 'admin' ? 'ผู้ดูแลระบบ' : 'กลุ่มงาน'}</td>
        <td>${u.groupId ? esc(groupName(u.groupId)) : '–'}</td><td>${u.active ? 'ใช้งาน' : '<span class="muted">ปิด</span>'}</td>
        <td class="nowrap"><button class="btn sm" data-u="${esc(u.username)}">แก้ไข/ตั้งรหัสผ่าน</button>
        ${u.username !== S.user.username ? `<button class="btn sm danger" data-x="${esc(u.username)}">ลบ</button>` : ''}</td></tr>`).join('')}</tbody></table>
      <button class="btn primary" id="addU">+ เพิ่มผู้ใช้</button></div><div id="uf"></div>`;
    $('#addU').onclick = () => userForm({ role: 'group', active: true });
    m.querySelectorAll('[data-u]').forEach(b => b.onclick = () => userForm(S.users.find(u => u.username === b.dataset.u), true));
    m.querySelectorAll('[data-x]').forEach(b => b.onclick = async () => {
      if (!confirm('ลบผู้ใช้ ' + b.dataset.x + '?')) return;
      await run(() => api.call('deleteUser', { username: b.dataset.x }), 'ลบแล้ว'); await reload();
    });
  }
  function genPw() {
    const c = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789', a = new Uint32Array(10);
    crypto.getRandomValues(a); return [...a].map(x => c[x % c.length]).join('');
  }
  function userForm(u, edit) {
    const box = $('#uf');
    box.innerHTML = `<div class="card"><h3>${edit ? 'แก้ไขผู้ใช้ ' + esc(u.username) : 'เพิ่มผู้ใช้'}</h3><form id="f" class="grid2">
      <label>ชื่อผู้ใช้ <span class="muted small">(a-z 0-9 . _ -)</span><input name="username" value="${esc(u.username || '')}" ${edit ? 'readonly' : ''} required></label>
      <label>ชื่อที่แสดง<input name="name" value="${esc(u.name || '')}"></label>
      <label>สิทธิ์<select name="role"><option value="group" ${u.role !== 'admin' ? 'selected' : ''}>กลุ่มงาน</option>
        <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>ผู้ดูแลระบบ</option></select></label>
      <label>กลุ่มงาน<select name="groupId"><option value=""></option>${S.groups.map(g => `<option value="${g.id}" ${g.id === u.groupId ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}</select></label>
      <label>รหัสผ่าน${edit ? ' <span class="muted small">(เว้นว่าง = ไม่เปลี่ยน)</span>' : ''}<span class="row"><input name="password" ${edit ? '' : 'required'} minlength="8">
        <button type="button" class="btn sm" id="gen">สุ่ม</button></span></label>
      <label class="inline"><input type="checkbox" name="active" ${u.active !== false ? 'checked' : ''}> เปิดใช้งาน</label>
      <p class="muted small span2">รหัสผ่านเก็บแบบเข้ารหัสทางเดียว ระบบแสดงให้ดูไม่ได้ภายหลัง — คัดลอกส่งให้กลุ่มงานก่อนกดบันทึก</p>
      <div class="span2"><button class="btn primary">บันทึก</button> <button type="button" class="btn ghost" id="cancel">ยกเลิก</button></div></form></div>`;
    const f = $('#f');
    $('#gen').onclick = () => { f.password.value = genPw(); f.password.select(); };
    $('#cancel').onclick = () => box.innerHTML = '';
    f.onsubmit = async e => {
      e.preventDefault();
      const user = { username: f.username.value, name: f.name.value, role: f.role.value, groupId: f.groupId.value, active: f.active.checked };
      await run(() => api.call('saveUser', { user, password: f.password.value || null }), 'บันทึกผู้ใช้แล้ว'); await reload();
    };
    box.scrollIntoView({ behavior: 'smooth' });
  }

  function vSettings(m) {
    const st = S.settings;
    m.innerHTML = `<h2>ตั้งค่า</h2>
      <form id="sf" class="card grid2">
        <label>ปีงบประมาณ<input name="year" value="${esc(st.year)}"></label>
        <label>กำหนดส่งคะแนน<input name="deadline" value="${esc(st.deadline || '')}" placeholder="เช่น 30 ก.ย. 2570"></label>
        <label class="inline"><input type="checkbox" name="itemsOpen" ${st.itemsOpen ? 'checked' : ''}> เปิดให้กลุ่มงานเพิ่ม/แก้ไขประเด็น</label>
        <label class="inline"><input type="checkbox" name="scoringOpen" ${st.scoringOpen ? 'checked' : ''}> เปิดรับคะแนน</label>
        <div class="span2"><button class="btn primary">บันทึกการตั้งค่า</button></div></form>
      <h3>กลุ่มงาน</h3><div class="card scroll"><table class="tbl"><thead><tr><th>รหัส</th><th>ชื่อกลุ่มงาน</th><th>ใช้งาน</th><th></th></tr></thead>
      <tbody>${S.groups.map(g => `<tr><td>${esc(g.id)}</td><td><input data-gn="${g.id}" value="${esc(g.name)}"></td>
        <td><input type="checkbox" data-ga="${g.id}" ${g.active ? 'checked' : ''}></td><td><button class="btn sm" data-gs="${g.id}">บันทึก</button></td></tr>`).join('')}
      <tr><td>ใหม่</td><td><input id="newG" placeholder="ชื่อกลุ่มงานใหม่"></td><td></td><td><button class="btn sm" id="addG">เพิ่ม</button></td></tr></tbody></table>
      <p class="muted small">ปิดใช้งานกลุ่มงาน = ไม่นับคะแนนกลุ่มนั้นในส่วนที่ 2</p></div>
      <h3>ประเด็นตั้งต้น</h3><div class="card"><p class="muted">นำประเด็นของปี 2569 มาเป็นตัวตั้งต้นให้ทุกกลุ่มงาน (ใช้ได้เฉพาะตอนที่ยังไม่มีประเด็นในระบบ) กลุ่มงานแก้ ลบ หรือเพิ่มเองได้ภายหลัง</p>
        <button class="btn" id="seed" ${S.items.length ? 'disabled' : ''}>นำเข้าประเด็นปี 2569</button></div>
      ${api.demo ? '<div class="card"><button class="btn danger" id="resetDemo">ล้างข้อมูลโหมดทดลอง</button></div>' : ''}`;
    $('#seed').onclick = async () => { if (!confirm('นำเข้าประเด็นปี 2569?')) return; const r = await run(() => api.call('seedItems'), 'นำเข้าแล้ว'); await reload(); };
    $('#sf').onsubmit = async e => {
      e.preventDefault(); const f = e.target;
      await run(() => api.call('saveSettings', { settings: { year: f.year.value, deadline: f.deadline.value, itemsOpen: f.itemsOpen.checked, scoringOpen: f.scoringOpen.checked } }), 'บันทึกแล้ว');
      await reload();
    };
    m.querySelectorAll('[data-gs]').forEach(b => b.onclick = async () => {
      const id = b.dataset.gs;
      await run(() => api.call('saveGroup', { group: { id, name: $(`[data-gn="${id}"]`).value, active: $(`[data-ga="${id}"]`).checked } }), 'บันทึกแล้ว');
      await reload();
    });
    $('#addG').onclick = async () => {
      const name = $('#newG').value.trim(); if (!name) return;
      await run(() => api.call('saveGroup', { group: { name, active: true } }), 'เพิ่มกลุ่มงานแล้ว'); await reload();
    };
    const rd = $('#resetDemo'); if (rd) rd.onclick = async () => { if (confirm('ล้างข้อมูลทดลองทั้งหมด?')) { api.reset(); await api.logout(); S = null; renderLogin(); } };
  }

  function vRubricEdit(m) {
    const r = S.settings.rubric && S.settings.rubric.length === 5 ? S.settings.rubric : Scoring.PDCA.map(p => [p, '', '', '', '', '']);
    m.innerHTML = `<h2>แก้ไขเกณฑ์การให้คะแนน PDCA</h2>
      <p class="muted">กลุ่มงานเห็นเกณฑ์นี้ในแท็บ "เกณฑ์ PDCA" หลังเข้าสู่ระบบ (ไม่เผยแพร่สาธารณะ) · ระดับ 5 = 100 · 4 = 85 · 3 = 70 · 2 = 55 · 1 = 40 คะแนน</p>
      <form id="rf" class="card scroll"><table class="tbl rub"><thead><tr><th>องค์ประกอบ</th><th>5 มากที่สุด</th><th>4 มาก</th><th>3 ปานกลาง</th><th>2 น้อย</th><th>1 น้อยมาก</th></tr></thead>
      <tbody>${r.map((row, i) => `<tr>${row.map((c, j) => `<td><textarea rows="${j ? 4 : 2}" data-r="${i}" data-c="${j}">${esc(c)}</textarea></td>`).join('')}</tr>`).join('')}</tbody></table>
      <button class="btn primary">บันทึกเกณฑ์</button></form>`;
    $('#rf').onsubmit = async e => {
      e.preventDefault();
      const rubric = [0, 1, 2, 3, 4].map(i => [0, 1, 2, 3, 4, 5].map(j => m.querySelector(`[data-r="${i}"][data-c="${j}"]`).value));
      await run(() => api.call('saveRubric', { rubric }), 'บันทึกเกณฑ์แล้ว'); await reload();
    };
  }

  async function vLog(m) {
    m.innerHTML = '<h2>ประวัติการใช้งาน</h2><p class="muted">กำลังโหลด…</p>';
    const r = await run(() => api.call('getLog', { limit: 300 }));
    const name = { login: 'เข้าสู่ระบบ', saveItem: 'บันทึกประเด็น', deleteItem: 'ลบประเด็น', saveScores: 'บันทึกคะแนน', saveUser: 'บันทึกผู้ใช้',
      deleteUser: 'ลบผู้ใช้', saveGroup: 'บันทึกกลุ่มงาน', saveKpi: 'บันทึกผลงาน KPI', saveSettings: 'บันทึกการตั้งค่า', saveRubric: 'บันทึกเกณฑ์',
      changePassword: 'เปลี่ยนรหัสผ่าน', seedItems: 'นำเข้าประเด็นปี 2569' };
    m.innerHTML = `<h2>ประวัติการใช้งาน</h2><p class="muted">300 รายการล่าสุด (ข้อมูลเต็มอยู่ในชีต Log)</p>
      <div class="card scroll"><table class="tbl"><thead><tr><th>เวลา</th><th>ผู้ใช้</th><th>การกระทำ</th><th>รายละเอียด</th></tr></thead>
      <tbody>${(r.log || []).filter(x => x.action !== 'bootstrap').map(x => `<tr><td class="nowrap small">${esc(x.time)}</td><td>${esc(x.user)}</td>
        <td>${esc(name[x.action] || x.action)}</td><td class="small">${esc(x.detail)}</td></tr>`).join('') || '<tr><td colspan="4" class="muted center">ยังไม่มีรายการ</td></tr>'}</tbody></table></div>`;
  }

  function vAccount(m) {
    m.innerHTML = `<h2>บัญชีผู้ใช้</h2><form id="pf" class="card grid2 narrowform">
      <p class="span2">ชื่อผู้ใช้: <b>${esc(S.user.username)}</b> · ${esc(S.user.name)}</p>
      <label class="span2">รหัสผ่านเดิม<input type="password" name="o" required autocomplete="current-password"></label>
      <label>รหัสผ่านใหม่ (อย่างน้อย 8 ตัว)<input type="password" name="n" minlength="8" required autocomplete="new-password"></label>
      <label>ยืนยันรหัสผ่านใหม่<input type="password" name="c" minlength="8" required autocomplete="new-password"></label>
      <div class="span2"><button class="btn primary">เปลี่ยนรหัสผ่าน</button></div></form>`;
    $('#pf').onsubmit = async e => {
      e.preventDefault(); const f = e.target;
      if (f.n.value !== f.c.value) return toast('รหัสผ่านใหม่ไม่ตรงกัน', 'err');
      await run(() => api.call('changePassword', { oldPassword: f.o.value, newPassword: f.n.value }), 'เปลี่ยนรหัสผ่านแล้ว'); f.reset();
    };
  }

  /* ---------------- เริ่มต้น ---------------- */
  if (api.token) reload().catch(() => {}); else renderLogin();
})();
