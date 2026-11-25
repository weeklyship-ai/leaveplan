// LeavePlan core: holiday data + planning logic. Pure functions, no DOM. Works in browsers and Node.
(function (root) {
  'use strict';

  // 中華民國 116 年（西元 2027 年）政府行政機關辦公日曆表（行政院核定，人事行政總處 2026-05-21 公告）。
  // 這裡只列「放假日」；一般週末由程式判斷。2027 年沒有補班日。
  // 末尾兩筆（2028-01-01 開國紀念日）是為了算出跨年連假（2027-12-31～2028-01-02）。
  const HOLIDAYS = {
    '2027-01-01': '開國紀念日',
    '2027-02-04': '春節連假',
    '2027-02-05': '除夕',
    '2027-02-06': '春節初一',
    '2027-02-07': '春節初二',
    '2027-02-08': '春節初三',
    '2027-02-09': '春節補假',
    '2027-02-10': '春節補假',
    '2027-02-28': '和平紀念日',
    '2027-03-01': '和平紀念日補假',
    '2027-04-04': '兒童節',
    '2027-04-05': '清明節',
    '2027-04-06': '兒童節補假',
    '2027-04-30': '勞動節補假',
    '2027-05-01': '勞動節',
    '2027-06-09': '端午節',
    '2027-09-15': '中秋節',
    '2027-09-28': '教師節',
    '2027-10-10': '國慶日',
    '2027-10-11': '國慶日補假',
    '2027-10-25': '光復節',
    '2027-12-24': '行憲紀念日補假',
    '2027-12-25': '行憲紀念日',
    '2027-12-31': '開國紀念日補假',
    '2028-01-01': '開國紀念日',
  };
  const RANGE = { start: '2027-01-01', end: '2028-01-02' }; // 計算範圍（含跨年連假）
  const YEAR = 2027;
  const MAX_BUDGET = 30;
  const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

  const DAY = 86400000;
  const isIso = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z')) && fromNum(toNum(s)) === s;
  const toNum = (iso) => Date.parse(iso + 'T00:00:00Z') / DAY;
  const fromNum = (n) => new Date(n * DAY).toISOString().slice(0, 10);
  const dow = (iso) => new Date(toNum(iso) * DAY).getUTCDay();
  const addDays = (iso, n) => fromNum(toNum(iso) + n);

  // 建立一年的日期陣列。opts.workSat：週六是否照常上班（隔週休、單休的公司）。
  function buildDays(opts) {
    const workSat = !!(opts && opts.workSat);
    const days = [];
    for (let n = toNum(RANGE.start); n <= toNum(RANGE.end); n++) {
      const date = fromNum(n);
      const d = dow(date);
      const holiday = HOLIDAYS[date] || null;
      const weekend = d === 0 || (d === 6 && !workSat);
      days.push({ date, dow: d, holiday, weekend, off: !!holiday || weekend });
    }
    return days;
  }

  // 找出所有連續休假（放假日 + 請假日）。回傳長度 >= minLen 的區段。
  function runs(days, leave, minLen) {
    const out = [];
    let cur = null;
    const close = () => { if (cur && cur.len >= (minLen || 1)) out.push(cur); cur = null; };
    for (const d of days) {
      const isLeave = !d.off && leave.has(d.date);
      if (d.off || isLeave) {
        if (!cur) cur = { start: d.date, end: d.date, len: 0, leave: 0, holidays: [] };
        cur.end = d.date; cur.len++;
        if (isLeave) cur.leave++;
        if (d.holiday && !cur.holidays.includes(d.holiday)) cur.holidays.push(d.holiday);
      } else close();
    }
    close();
    return out;
  }

  // 候選方案：請 1～budget 天假、且連休區段包含至少一個國定假日。
  function candidates(days, budget) {
    const B = Math.max(0, Math.min(MAX_BUDGET, budget | 0));
    const seen = new Map();
    const n = days.length;
    for (let i = 0; i < n; i++) {
      if (days[i].off) continue; // 從上班日開始請
      let cost = 0;
      for (let j = i; j < n; j++) {
        if (!days[j].off) cost++;
        if (cost > B) break;
        if (cost === 0) continue;
        // 擴張成最大連續區段
        let s = i, e = j;
        while (s > 0 && days[s - 1].off) s--;
        while (e < n - 1 && days[e + 1].off) e++;
        const key = s + ':' + e;
        const len = e - s + 1;
        const holidays = [];
        for (let k = s; k <= e; k++) if (days[k].holiday && !holidays.includes(days[k].holiday)) holidays.push(days[k].holiday);
        if (!holidays.length) continue;
        const prev = seen.get(key);
        if (!prev || prev.cost > cost) {
          const leaveDates = [];
          for (let k = s; k <= e; k++) if (!days[k].off) leaveDates.push(days[k].date);
          seen.set(key, { start: days[s].date, end: days[e].date, si: s, ei: e, len, cost: leaveDates.length, leaveDates, holidays, cp: len / leaveDates.length });
        }
      }
    }
    return [...seen.values()].filter((c) => c.cost >= 1 && c.cost <= B);
  }

  // 單次 CP 值排行：每個請假天數取最好的幾個，再依 CP 值排序。
  function ranking(days, budget, limit) {
    const best = [...candidates(days, budget)].sort((a, b) => b.cp - a.cp || b.len - a.len || a.si - b.si);
    // 同一時段有多種請法時，保留 CP 值較高的；去除與更高 CP 值方案重疊的結果。
    const picked = [];
    for (const c of best) {
      if (picked.some((p) => !(c.ei < p.si || c.si > p.ei))) continue;
      picked.push(c);
      if (picked.length >= (limit || 8)) break;
    }
    return picked;
  }

  // 最大化總連休天數：在預算內挑出互不重疊的方案（加權區間排程 + 背包）。
  function bestPlan(days, budget) {
    const B = Math.max(0, Math.min(MAX_BUDGET, budget | 0));
    const cs = candidates(days, B).sort((a, b) => a.si - b.si || a.ei - b.ei);
    const m = cs.length;
    if (!m || !B) return { items: [], totalLen: 0, totalCost: 0 };
    const next = new Array(m);
    for (let i = 0; i < m; i++) {
      let lo = i + 1, hi = m;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (cs[mid].si > cs[i].ei) hi = mid; else lo = mid + 1; }
      next[i] = lo;
    }
    // dp[i][b] = 從第 i 個候選起、預算 b 可拿到的最大總天數（以及其次要目標：用最少的假）
    const dp = Array.from({ length: m + 1 }, () => new Array(B + 1).fill(null));
    for (let b = 0; b <= B; b++) dp[m][b] = [0, 0];
    const better = (x, y) => x[0] > y[0] || (x[0] === y[0] && x[1] < y[1]);
    for (let i = m - 1; i >= 0; i--) {
      for (let b = 0; b <= B; b++) {
        let best = dp[i + 1][b];
        const c = cs[i];
        if (c.cost <= b) {
          const t = dp[next[i]][b - c.cost];
          const cand = [t[0] + c.len, t[1] + c.cost];
          if (better(cand, best)) best = cand;
        }
        dp[i][b] = best;
      }
    }
    const items = [];
    let i = 0, b = B;
    while (i < m) {
      const c = cs[i];
      const skip = dp[i + 1][b];
      if (c.cost <= b) {
        const t = dp[next[i]][b - c.cost];
        const take = [t[0] + c.len, t[1] + c.cost];
        if (dp[i][b][0] === take[0] && dp[i][b][1] === take[1] && !(skip[0] === take[0] && skip[1] === take[1])) {
          items.push(c); b -= c.cost; i = next[i]; continue;
        }
      }
      i++;
    }
    return { items, totalLen: items.reduce((s, x) => s + x.len, 0), totalCost: items.reduce((s, x) => s + x.cost, 0) };
  }

  // 一次長假：預算內單一最長的連休（同長度取請假最少、最早開始的）。
  function longest(days, budget) {
    const cs = candidates(days, budget).sort((a, b) => b.len - a.len || a.cost - b.cost || a.si - b.si);
    return cs.length ? { items: [cs[0]], totalLen: cs[0].len, totalCost: cs[0].cost } : { items: [], totalLen: 0, totalCost: 0 };
  }

  // 檢查使用者存的請假日：只留合法、在範圍內、確實是上班日的日期。
  function sanitizeLeave(list, days) {
    const ok = new Set(days.filter((d) => !d.off).map((d) => d.date));
    const out = [];
    if (Array.isArray(list)) for (const x of list.slice(0, 400)) if (isIso(x) && ok.has(x) && !out.includes(x)) out.push(x);
    return out.sort();
  }

  const fmtDate = (iso) => `${+iso.slice(5, 7)}/${+iso.slice(8, 10)}（${WEEKDAYS[dow(iso)]}）`;
  const fmtRange = (a, b) => (a === b ? fmtDate(a) : `${fmtDate(a)}～${fmtDate(b)}`);

  // ICS 文字跳脫與每行 75 byte 折行不處理（內容很短），但一定要跳脫特殊字元並移除換行。
  const icsEscape = (s) => String(s).replace(/[\\;,]/g, (m) => '\\' + m).replace(/[\r\n]+/g, ' ');
  function toICS(trips, stamp) {
    const z = (stamp || new Date().toISOString()).replace(/[-:]/g, '').replace(/\.\d+/, '');
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//WeeklyShip AI//LeavePlan//ZH', 'CALSCALE:GREGORIAN'];
    for (const t of trips) {
      if (!isIso(t.start) || !isIso(t.end)) continue;
      lines.push('BEGIN:VEVENT',
        `UID:leaveplan-${t.start}@weeklyship-ai.github.io`,
        `DTSTAMP:${z}`,
        `DTSTART;VALUE=DATE:${t.start.replace(/-/g, '')}`,
        `DTEND;VALUE=DATE:${addDays(t.end, 1).replace(/-/g, '')}`,
        `SUMMARY:${icsEscape(`連休 ${t.len} 天（請 ${t.leave} 天假）`)}`,
        `DESCRIPTION:${icsEscape(t.holidays.length ? '包含：' + t.holidays.join('、') : '')}`,
        'TRANSP:TRANSPARENT', 'END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    return lines.join('\r\n') + '\r\n';
  }

  const api = { HOLIDAYS, RANGE, YEAR, MAX_BUDGET, WEEKDAYS, isIso, addDays, dow, buildDays, runs, candidates, ranking, bestPlan, longest, sanitizeLeave, fmtDate, fmtRange, toICS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LeavePlan = api;
})(typeof self !== 'undefined' ? self : this);
