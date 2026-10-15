/* สูตรคำนวณคะแนนประเมิน คปสอ. — ใช้ร่วมกันทั้งหน้าเว็บ โหมดทดลอง และชุดทดสอบ (node) */
(function (root) {
  const PDCA = ['การวางแผน (Plan)', 'การดำเนินการ (Do)', 'การตรวจสอบ/ติดตาม (Check)',
                'การปรับปรุงและพัฒนา (Act)', 'ผลผลิต/ผลลัพธ์ (Results)'];
  const W_KPI = 0.6, W_GROUP = 0.4;
  const GRADES = [[90, 'ดีเยี่ยม'], [80, 'ดีมาก'], [50, 'ดี'], [-Infinity, 'ต้องปรับปรุง']];

  const num = v => (v === '' || v === null || v === undefined || isNaN(Number(v))) ? null : Number(v);

  /** น้ำหนักประเด็น: กำหนดเองได้ ถ้าไม่กำหนด PDCA = 1, เกณฑ์คะแนน = คะแนนเต็ม */
  function itemWeight(item) {
    const w = num(item.weight);
    if (w !== null && w > 0) return w;
    return item.type === 'criteria' ? (num(item.max) || 1) : 1;
  }

  /** คะแนนประเด็น 0–100 ของ 1 อำเภอ (null = ยังกรอกไม่ครบ)
   *  PDCA     : 15 × ค่าเฉลี่ยระดับ 5 องค์ประกอบ + 25   (ระดับ 1–5 → 40–100)
   *  criteria : คะแนนที่ได้ ÷ คะแนนเต็ม × 100            */
  function itemScore(item, values) {
    if (!values) return null;
    if (item.type === 'criteria') {
      const v = num(Array.isArray(values) ? values[0] : values), max = num(item.max);
      if (v === null || !max) return null;
      return v / max * 100;
    }
    if (!Array.isArray(values) || values.length < 5) return null;
    const lv = values.slice(0, 5).map(num);
    if (lv.some(x => x === null)) return null;
    return 15 * (lv.reduce((a, b) => a + b, 0) / 5) + 25;
  }

  /** คะแนน S ของกลุ่มงานใน 1 อำเภอ = ค่าเฉลี่ยถ่วงน้ำหนักของทุกประเด็น
   *  แสดงเมื่อกรอกครบทุกประเด็นเท่านั้น (ไม่ครบ = null และไม่นำไปเฉลี่ยส่วนที่ 2) */
  function groupScore(items, scoreOf) {
    if (!items.length) return null;
    let sw = 0, s = 0;
    for (const it of items) {
      const v = itemScore(it, scoreOf(it.id));
      if (v === null) return null;
      const w = itemWeight(it); sw += w; s += w * v;
    }
    return s / sw;
  }

  /** ความคืบหน้าของกลุ่มงานใน 1 อำเภอ: จำนวนประเด็นที่กรอกครบ / ทั้งหมด */
  function groupProgress(items, scoreOf) {
    return { done: items.filter(it => itemScore(it, scoreOf(it.id)) !== null).length, total: items.length };
  }

  function grade(total) {
    if (total === null || total === undefined) return null;
    return GRADES.find(([t]) => total >= t)[1];
  }

  /** ผลรวมรายอำเภอ
   *  data = { districts, groups, items, scores:{[itemId]:{[district]:values}}, kpi:{[district]:pct} } */
  function results(data) {
    return data.districts.map(d => {
      const gScores = data.groups.filter(g => g.active !== false).map(g => {
        const its = data.items.filter(i => i.groupId === g.id);
        return { groupId: g.id, s: groupScore(its, id => (data.scores[id] || {})[d]) };
      });
      const counted = gScores.filter(x => x.s !== null);
      const kpi = num((data.kpi || {})[d]);
      const p1 = kpi === null ? null : kpi * W_KPI;
      const p2pct = counted.length ? counted.reduce((a, x) => a + x.s, 0) / counted.length : null;
      const p2 = p2pct === null ? null : p2pct * W_GROUP;
      const total = (p1 === null || p2 === null) ? null : p1 + p2;
      return { district: d, kpi, p1, p2pct, p2, total, grade: grade(total),
               groupsCounted: counted.length, groupsTotal: gScores.length, byGroup: gScores };
    });
  }

  const api = { PDCA, W_KPI, W_GROUP, itemWeight, itemScore, groupScore, groupProgress, grade, results };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Scoring = api;
})(typeof window !== 'undefined' ? window : globalThis);
