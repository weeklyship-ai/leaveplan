const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../src/core.js');

const days = L.buildDays();
const range = (r) => `${r.start}~${r.end}`;

test('2027 有 121 個放假日（與人事行政總處公告一致）', () => {
  assert.equal(days.filter((d) => d.off && d.date <= '2027-12-31').length, 121);
});

test('3 天以上連假共 9 段，與官方附表一致', () => {
  assert.deepEqual(L.runs(days, new Set(), 3).map(range), [
    '2027-01-01~2027-01-03', '2027-02-04~2027-02-10', '2027-02-27~2027-03-01', '2027-04-03~2027-04-06',
    '2027-04-30~2027-05-02', '2027-10-09~2027-10-11', '2027-10-23~2027-10-25', '2027-12-24~2027-12-26', '2027-12-31~2028-01-02',
  ]);
});

test('補假規則：週六放假補前一個上班日、週日補後一個上班日', () => {
  const off = (d) => days.find((x) => x.date === d).off;
  for (const d of ['2027-04-30', '2027-12-24', '2027-12-31', '2027-03-01', '2027-04-06', '2027-10-11', '2027-02-09', '2027-02-10']) assert.ok(off(d), d);
  for (const d of ['2027-01-04', '2027-02-11', '2027-04-07', '2027-12-30']) assert.ok(!off(d), d);
});

test('請 1 天：春節前一天最划算（8 天）', () => {
  const top = L.ranking(days, 1, 3);
  assert.equal(top[0].len, 8);
  assert.equal(top[0].cost, 1);
  assert.deepEqual(top[0].leaveDates, ['2027-02-03']);
});

test('請 5 天最長連休 16 天（首頁宣傳數字）', () => {
  const p = L.longest(days, 5);
  assert.equal(p.totalLen, 16);
  assert.equal(p.totalCost, 5);
  assert.equal(range(p.items[0]), '2027-01-30~2027-02-14');
});

test('預算為 0 或負數時沒有方案', () => {
  assert.equal(L.candidates(days, 0).length, 0);
  assert.equal(L.bestPlan(days, 0).items.length, 0);
  assert.equal(L.longest(days, -3).items.length, 0);
});

test('bestPlan：不超過預算、互不重疊、總天數不少於單一最長', () => {
  for (const b of [1, 2, 3, 5, 8, 12, 20, 30]) {
    const p = L.bestPlan(days, b);
    assert.ok(p.totalCost <= b, `cost ${p.totalCost} > ${b}`);
    const sorted = [...p.items].sort((x, y) => x.si - y.si);
    for (let i = 1; i < sorted.length; i++) assert.ok(sorted[i].si > sorted[i - 1].ei, 'overlap');
    assert.ok(p.totalLen >= L.longest(days, b).totalLen, `b=${b}`);
  }
});

test('bestPlan 與暴力搜尋一致（小預算）', () => {
  const cs = L.candidates(days, 3).sort((a, b) => a.si - b.si);
  let best = 0;
  (function go(i, cost, len, lastEnd) {
    best = Math.max(best, len);
    for (let k = i; k < cs.length; k++) {
      const c = cs[k];
      if (c.si <= lastEnd || cost + c.cost > 3) continue;
      go(k + 1, cost + c.cost, len + c.len, c.ei);
    }
  })(0, 0, 0, -1);
  assert.equal(L.bestPlan(days, 3).totalLen, best);
});

test('週六上班：週六變成可請假的上班日，連假區段改變', () => {
  const ws = L.buildDays({ workSat: true });
  assert.equal(ws.find((d) => d.date === '2027-01-02').off, false);
  assert.equal(ws.find((d) => d.date === '2027-02-06').off, true, '週六國定假日仍放假');
});

test('runs 計入請假日，並忽略放假日上的請假', () => {
  const r = L.runs(days, new Set(['2027-02-01', '2027-02-02', '2027-02-03', '2027-02-11', '2027-02-12']), 3).find((x) => x.start <= '2027-02-10' && x.end >= '2027-02-10');
  assert.equal(range(r), '2027-01-30~2027-02-14');
  assert.equal(r.leave, 5);
  const r2 = L.runs(days, new Set(['2027-02-05']), 3).find((x) => x.start === '2027-02-04');
  assert.equal(r2.leave, 0);
});

test('sanitizeLeave：過濾非法、放假日、重複與超量資料', () => {
  const dirty = ['2027-02-03', '2027-02-03', '2027-02-05', 'hello', 123, null, { a: 1 }, '2027-13-40', '2026-01-05', '2027-03-02'];
  assert.deepEqual(L.sanitizeLeave(dirty, days), ['2027-02-03', '2027-03-02']);
  assert.deepEqual(L.sanitizeLeave('x', days), []);
  assert.deepEqual(L.sanitizeLeave(null, days), []);
  const many = Array.from({ length: 5000 }, () => '2027-03-02');
  assert.deepEqual(L.sanitizeLeave(many, days), ['2027-03-02']);
});

test('isIso 拒絕不合法日期', () => {
  assert.ok(L.isIso('2027-02-28'));
  assert.ok(!L.isIso('2027-02-30'));
  assert.ok(!L.isIso('2027-2-3'));
  assert.ok(!L.isIso(20270203));
});

test('ICS：全天事件、結束日為隔天、CRLF 換行、特殊字元跳脫', () => {
  const rs = L.runs(days, new Set(['2027-02-03']), 1).filter((r) => r.leave > 0);
  const ics = L.toICS(rs, '2026-11-25T00:00:00.000Z');
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /DTSTART;VALUE=DATE:20270203\r\n/);
  assert.match(ics, /DTEND;VALUE=DATE:20270211\r\n/);
  assert.match(ics, /SUMMARY:連休 8 天（請 1 天假）/);
  assert.match(ics, /DTSTAMP:20261125T000000Z/);
  const evil = L.toICS([{ start: '2027-02-03', end: '2027-02-04', len: 2, leave: 1, holidays: ['a,b;c\nEND:VEVENT\nBEGIN:VEVENT'] }]);
  assert.equal(evil.split('\r\n').filter((l) => l === 'BEGIN:VEVENT').length, 1, 'no injected event');
  assert.ok(evil.includes('a\\,b\\;c END:VEVENT'));
  assert.deepEqual(L.toICS([{ start: 'bad', end: 'bad', len: 1, leave: 0, holidays: [] }]).includes('VEVENT'), false);
});

test('fmtDate / fmtRange', () => {
  assert.equal(L.fmtDate('2027-02-03'), '2/3（三）');
  assert.equal(L.fmtRange('2027-02-03', '2027-02-10'), '2/3（三）～2/10（三）');
});

test('效能：最大預算也在 200ms 內算完', () => {
  const t = Date.now();
  L.bestPlan(days, L.MAX_BUDGET);
  assert.ok(Date.now() - t < 200);
});
