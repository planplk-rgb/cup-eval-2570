/* ตัวเชื่อมหลังบ้าน: RemoteApi (Google Apps Script) และ DemoApi (โหมดทดลอง เก็บในเบราว์เซอร์) */
(function () {
  const TOKEN_KEY = 'cupEval.token';
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} },
  };

  /* ---------------- หลังบ้านจริง ---------------- */
  class RemoteApi {
    constructor(url) { this.url = url; this.demo = false; this.token = store.get(TOKEN_KEY); }
    async call(action, payload = {}) {
      let res;
      try {
        // ใช้ text/plain เพื่อไม่ให้เบราว์เซอร์ส่ง preflight (Apps Script ไม่รองรับ OPTIONS)
        const r = await fetch(this.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(Object.assign({ action, token: this.token }, payload)) });
        res = await r.json();
      } catch (e) { throw new Error('เชื่อมต่อระบบไม่ได้ กรุณาลองใหม่'); }
      if (res.auth === false) { this.setToken(null); const err = new Error(res.error); err.auth = false; throw err; }
      if (!res.ok) throw new Error(res.error || 'เกิดข้อผิดพลาด');
      return res;
    }
    setToken(t) { this.token = t; t ? store.set(TOKEN_KEY, t) : store.del(TOKEN_KEY); }
    async login(username, password) { const r = await this.call('login', { username, password }); this.setToken(r.token); return r; }
    async logout() { try { await this.call('logout'); } catch (e) {} this.setToken(null); }
  }

  /* ---------------- โหมดทดลอง ----------------
   * ข้อมูลตัวอย่างทั้งหมดเป็นข้อมูลสมมติ (ไม่ใช่ข้อมูลจริงของอำเภอ และไม่ใช่เกณฑ์จริง) */
  const DEMO_KEY = 'cupEval.demo.v1';
  const DISTRICTS = ['เมือง', 'นครไทย', 'ชาติตระการ', 'บางระกำ', 'บางกระทุ่ม', 'พรหมพิราม', 'วัดโบสถ์', 'วังทอง', 'เนินมะปราง'];
  const GROUP_NAMES = ['กลุ่มงานพัฒนายุทธศาสตร์ฯ', 'กลุ่มงานส่งเสริมสุขภาพฯ', 'กลุ่มงานควบคุมโรคติดต่อ', 'กลุ่มงานควบคุมโรคไม่ติดต่อ',
    'กลุ่มงานอนามัยสิ่งแวดล้อมฯ', 'กลุ่มงานคุ้มครองผู้บริโภคฯ', 'กลุ่มงานทันตสาธารณสุข', 'กลุ่มงานประกันสุขภาพ',
    'กลุ่มงานพัฒนาคุณภาพฯ', 'กลุ่มงานทรัพยากรบุคคล', 'กลุ่มงานกฎหมาย', 'กลุ่มงานบริหารงานทั่วไป', 'กลุ่มงานภูมิปัญญาฯ',
    'กลุ่มงานสุขภาพดิจิทัล', 'กลุ่มงานแพทย์แผนไทยฯ'];

  function demoSeed() {
    const groups = GROUP_NAMES.map((n, i) => ({ id: 'G' + String(i + 1).padStart(2, '0'), name: n, order: i + 1, active: true }));
    const uid = () => Math.random().toString(36).slice(2, 10);
    const items = [];
    const add = (groupId, title, extra = {}) => items.push(Object.assign({ id: uid(), groupId, title, type: 'pdca', max: null,
      levels: [], criteria: '', weight: null, order: items.filter(i => i.groupId === groupId).length + 1 }, extra));
    groups.forEach(g => { add(g.id, 'ประเด็นตัวอย่างที่ 1 ของ' + g.name.replace('กลุ่มงาน', '')); add(g.id, 'ประเด็นตัวอย่างที่ 2'); });
    add('G08', 'ตัวอย่างเกณฑ์คะแนน: ความทันเวลาการส่งข้อมูล', { type: 'criteria', max: 15, levels: [15, 13, 10],
      criteria: '100% = 15 | 95–99.99% = 13 | <95% = 10' });
    add('G06', 'ตัวอย่างคะแนนรวมรายประเด็น (เต็ม 5)', { type: 'criteria', max: 5, levels: [5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1],
      criteria: 'ให้คะแนนรวม 1–5 (ขั้นละ 0.5)' });
    const scores = {}, rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
    items.filter(i => ['G01', 'G02', 'G06'].includes(i.groupId)).forEach(it => {
      scores[it.id] = {};
      DISTRICTS.forEach(d => {
        scores[it.id][d] = it.type === 'criteria' ? [it.levels[rnd(0, 2)]] : [1, 2, 3, 4, 5].map(() => rnd(3, 5));
      });
    });
    const kpi = {}; DISTRICTS.forEach(d => kpi[d] = rnd(60, 95));
    const users = [{ username: 'admin', password: 'admin1234', name: 'ผู้ดูแลระบบ (ทดลอง)', role: 'admin', groupId: '', active: true }]
      .concat(groups.map(g => ({ username: g.id.toLowerCase(), password: 'demo1234', name: g.name, role: 'group', groupId: g.id, active: true })));
    const rubric = Scoring.PDCA.map(p => [p, '(ตัวอย่าง) ดำเนินการครบถ้วน เป็นระบบ', '(ตัวอย่าง) ส่วนใหญ่ครบถ้วน',
      '(ตัวอย่าง) ดำเนินการในภารกิจหลัก', '(ตัวอย่าง) ดำเนินการบางส่วน', '(ตัวอย่าง) ดำเนินการน้อยมาก']);
    return { groups, items, scores, kpi, users, settings: { year: '2570', deadline: '', itemsOpen: true, scoringOpen: true, rubric, demo: true } };
  }

  class DemoApi {
    constructor() { this.demo = true; this.token = store.get(TOKEN_KEY + '.demo'); this.db = this.load(); }
    load() { try { const s = JSON.parse(store.get(DEMO_KEY)); if (s && s.groups) return s; } catch (e) {} const d = demoSeed(); this.save(d); return d; }
    save(d) { store.set(DEMO_KEY, JSON.stringify(d || this.db)); }
    reset() { store.del(DEMO_KEY); this.db = this.load(); }
    setToken(t) { this.token = t; t ? store.set(TOKEN_KEY + '.demo', t) : store.del(TOKEN_KEY + '.demo'); }
    me() { const u = this.db.users.find(x => x.username === this.token && x.active); if (!u) { const e = new Error('กรุณาเข้าสู่ระบบใหม่'); e.auth = false; throw e; } return u; }
    pub(u) { return { username: u.username, name: u.name, role: u.role, groupId: u.groupId, active: u.active }; }
    guard(me, groupId, flag) {
      if (me.role === 'admin') return;
      if (me.groupId !== groupId) throw new Error('แก้ไขได้เฉพาะกลุ่มงานของตนเอง');
      if (!this.db.settings[flag]) throw new Error(flag === 'itemsOpen' ? 'ขณะนี้ปิดการแก้ไขประเด็นแล้ว' : 'ขณะนี้ปิดรับคะแนนแล้ว');
    }
    async login(username, password) {
      const u = this.db.users.find(x => x.username === String(username).trim().toLowerCase() && x.active);
      if (!u || u.password !== password) throw new Error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
      this.setToken(u.username); return { token: u.username, user: this.pub(u) };
    }
    async logout() { this.setToken(null); }
    async call(action, p = {}) {
      const me = this.me(), db = this.db, admin = me.role === 'admin';
      const needAdmin = () => { if (!admin) throw new Error('เฉพาะผู้ดูแลระบบ'); };
      let out = { ok: true };
      switch (action) {
        case 'bootstrap': {
          const items = db.items.filter(i => admin || i.groupId === me.groupId);
          const ids = new Set(items.map(i => i.id)), scores = {};
          Object.keys(db.scores).forEach(k => { if (ids.has(k)) scores[k] = db.scores[k]; });
          out = Object.assign(out, { user: this.pub(me), districts: DISTRICTS, settings: db.settings, groups: db.groups, items, scores });
          if (admin) { out.kpi = db.kpi; out.users = db.users.map(u => this.pub(u)); }
          return JSON.parse(JSON.stringify(out));
        }
        case 'changePassword':
          if (me.password !== p.oldPassword) throw new Error('รหัสผ่านเดิมไม่ถูกต้อง');
          if (String(p.newPassword || '').length < 8) throw new Error('รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร');
          me.password = p.newPassword; break;
        case 'saveItem': {
          const it = p.item, groupId = admin ? it.groupId : me.groupId;
          this.guard(me, groupId, 'itemsOpen');
          if (!String(it.title || '').trim()) throw new Error('กรุณาระบุชื่อประเด็น');
          let row = db.items.find(i => i.id === it.id);
          if (row && row.type !== it.type && db.scores[row.id]) throw new Error('ประเด็นนี้มีคะแนนแล้ว เปลี่ยนรูปแบบการให้คะแนนไม่ได้');
          if (!row) { row = { id: Math.random().toString(36).slice(2, 10), groupId, order: db.items.filter(i => i.groupId === groupId).length + 1 }; db.items.push(row); }
          const levels = it.type === 'criteria' ? String(it.levels).split(',').map(Number).filter(x => !isNaN(x)) : [];
          if (it.type === 'criteria' && (!(Number(it.max) > 0) || !levels.length)) throw new Error('กรุณาระบุคะแนนเต็มและระดับคะแนน');
          Object.assign(row, { title: it.title.trim(), type: it.type, max: it.type === 'criteria' ? Number(it.max) : null,
            levels: [...new Set(levels)].sort((a, b) => b - a), criteria: it.criteria || '', weight: it.weight ? Number(it.weight) : null });
          break;
        }
        case 'deleteItem': {
          const row = db.items.find(i => i.id === p.id); this.guard(me, row.groupId, 'itemsOpen');
          db.items = db.items.filter(i => i.id !== p.id); delete db.scores[p.id]; break;
        }
        case 'saveScores': {
          const it = db.items.find(i => i.id === p.itemId); this.guard(me, it.groupId, 'scoringOpen');
          db.scores[it.id] = db.scores[it.id] || {};
          Object.keys(p.entries).forEach(d => {
            const v = p.entries[d], empty = !v || v.every(x => x === '' || x === null);
            if (empty) delete db.scores[it.id][d]; else db.scores[it.id][d] = v.map(x => x === '' ? null : Number(x));
          });
          break;
        }
        case 'saveUser': {
          needAdmin(); const u = p.user, name = String(u.username || '').trim().toLowerCase();
          if (!/^[a-z0-9._-]{3,30}$/.test(name)) throw new Error('ชื่อผู้ใช้ใช้ได้เฉพาะ a-z 0-9 . _ - (3–30 ตัว)');
          let row = db.users.find(x => x.username === name);
          if (!row && !p.password) throw new Error('ผู้ใช้ใหม่ต้องกำหนดรหัสผ่าน');
          if (p.password && p.password.length < 8) throw new Error('รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร');
          if (!row) { row = { username: name }; db.users.push(row); }
          Object.assign(row, { name: u.name || name, role: u.role, groupId: u.role === 'group' ? u.groupId : '', active: u.active !== false });
          if (p.password) row.password = p.password; break;
        }
        case 'deleteUser': needAdmin(); if (p.username === me.username) throw new Error('ลบบัญชีของตนเองไม่ได้');
          db.users = db.users.filter(u => u.username !== p.username); break;
        case 'saveGroup': {
          needAdmin(); let g = db.groups.find(x => x.id === p.group.id);
          if (!g) { g = { id: 'G' + (db.groups.length + 1) + '-' + Math.random().toString(36).slice(2, 6), order: db.groups.length + 1 }; db.groups.push(g); }
          Object.assign(g, { name: p.group.name || g.name, active: p.group.active !== false }); break;
        }
        case 'saveKpi': needAdmin(); db.kpi = p.kpi; break;
        case 'saveSettings': needAdmin(); Object.assign(db.settings, p.settings); break;
        case 'saveRubric': needAdmin(); db.settings.rubric = p.rubric; break;
        case 'getLog': needAdmin(); return { ok: true, log: (db.log || []).slice(-200).reverse() };
        case 'seedItems': needAdmin(); throw new Error('โหมดทดลองไม่มีประเด็นปี 2569 (ใช้ได้เมื่อเชื่อมหลังบ้านจริงที่มี Seed.gs)');
        default: throw new Error('ไม่รู้จักคำสั่ง ' + action);
      }
      (db.log = db.log || []).push({ time: new Date().toLocaleString('th-TH'), user: me.username, action, detail: '' });
      if (db.log.length > 500) db.log = db.log.slice(-500);
      this.save(); return out;
    }
  }

  window.createApi = function () {
    const url = (window.APP_CONFIG && window.APP_CONFIG.API_URL || '').trim();
    const wantDemo = /[?&]demo=1/.test(location.search) || !url;
    return wantDemo ? new DemoApi() : new RemoteApi(url);
  };
})();
