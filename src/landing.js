// 首頁：用同一份 core.js 算出示範月曆與「請 1 天」排行，確保畫面和 App 的數字一致。
(() => {
  'use strict';
  const L = self.LeavePlan;
  if (!L) return;
  const days = L.buildDays();
  const demoLeave = L.longest(days, 5).items[0];
  const leave = new Set(demoLeave ? demoLeave.leaveDates : []);
  const el = document.getElementById('demoCal');
  if (el) {
    const frag = document.createDocumentFragment();
    for (const w of L.WEEKDAYS) { const d = document.createElement('div'); d.className = 'wd'; d.textContent = w; frag.append(d); }
    const first = days.find((d) => d.date === '2027-02-01');
    for (let i = 0; i < first.dow; i++) { const b = document.createElement('div'); b.className = 'c blank'; frag.append(b); }
    let k = 0;
    for (const d of days.filter((x) => x.date.startsWith('2027-02'))) {
      const c = document.createElement('div');
      c.className = 'c' + (d.holiday ? ' hd' : d.weekend ? ' wk' : leave.has(d.date) ? ' lv pop' : '');
      if (leave.has(d.date)) c.style.setProperty('--d', (0.5 + 0.12 * k++) + 's');
      c.textContent = +d.date.slice(8);
      frag.append(c);
    }
    el.append(frag);
  }
  const top = document.getElementById('top3');
  if (top) {
    const list = L.ranking(days, 1, 12).filter((c) => c.cost === 1).sort((a, b) => b.len - a.len).slice(0, 3);
    for (const c of list) {
      const card = document.createElement('div'); card.className = 'trip';
      const big = document.createElement('div'); big.className = 'big'; big.textContent = c.len;
      const sm = document.createElement('small'); sm.textContent = '天連休'; big.append(sm);
      const cost = document.createElement('span'); cost.className = 'cost'; cost.textContent = `只請 1 天：${L.fmtDate(c.leaveDates[0])}`;
      const p1 = document.createElement('p'); p1.textContent = L.fmtRange(c.start, c.end);
      const p2 = document.createElement('p'); p2.textContent = '包含：' + c.holidays.join('、');
      card.append(big, cost, p1, p2); top.append(card);
    }
  }
})();
