// 請假 CP 值 App：畫面與互動。所有計算在 core.js。
(() => {
  'use strict';
  const L = self.LeavePlan;
  const KEY = 'leaveplan:state';
  const THEME = 'leaveplan:theme';
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  // ---- state ----
  let state = { budget: 5, workSat: false, leave: [] };
  let days = L.buildDays({ workSat: false });
  let popFrom = null; // 套用方案時，新增的日期依序「蓋章」
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (s && typeof s === 'object') {
        const b = Number(s.budget);
        if (Number.isInteger(b) && b >= 0 && b <= L.MAX_BUDGET) state.budget = b;
        state.workSat = s.workSat === true;
        days = L.buildDays({ workSat: state.workSat });
        state.leave = L.sanitizeLeave(s.leave, days);
      }
    } catch (e) { /* 壞掉的存檔直接忽略 */ }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* 無痕模式：不存也能用 */ }
  }
  let toastTimer;
  function toast(msg) {
    const t = $('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }
  const leaveSet = () => new Set(state.leave);
  const todayIso = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();

  // ---- render ----
  function renderMonths(runsWithLeave) {
    const root = $('months');
    root.textContent = '';
    const ls = leaveSet();
    const inRun = new Set();
    for (const r of runsWithLeave) for (let d = r.start; d <= r.end; d = L.addDays(d, 1)) inRun.add(d);
    const byMonth = new Map();
    for (const d of days) {
      if (d.date > '2027-12-31') continue;
      const m = +d.date.slice(5, 7);
      if (!byMonth.has(m)) byMonth.set(m, []);
      byMonth.get(m).push(d);
    }
    let k = 0;
    for (const [m, list] of byMonth) {
      const box = el('div', 'month');
      const h = el('h3', null, `${m} 月`);
      const usedHere = list.filter((d) => ls.has(d.date)).length;
      if (usedHere) h.append(el('small', null, `請 ${usedHere} 天`));
      box.append(h);
      const grid = el('div', 'mini');
      for (const w of L.WEEKDAYS) grid.append(el('div', 'wd', w));
      for (let i = 0; i < list[0].dow; i++) grid.append(el('div', 'c blank'));
      for (const d of list) {
        const isLeave = !d.off && ls.has(d.date);
        const status = d.holiday ? d.holiday : d.weekend ? '週末' : isLeave ? '請假' : '上班日';
        const cls = 'c' + (d.holiday ? ' hd' : d.weekend ? ' wk' : isLeave ? ' lv' : '') + (inRun.has(d.date) ? ' run' : '') + (d.date === todayIso ? ' today' : '');
        let c;
        if (d.off) { c = el('div', cls, String(+d.date.slice(8))); c.setAttribute('role', 'img'); }
        else {
          c = el('button', cls, String(+d.date.slice(8)));
          c.type = 'button'; c.dataset.date = d.date; c.setAttribute('aria-pressed', String(isLeave));
        }
        c.setAttribute('aria-label', `${L.fmtDate(d.date)} ${status}`);
        c.title = `${L.fmtDate(d.date)} ${status}`;
        if (isLeave && popFrom && popFrom.has(d.date)) { c.classList.add('pop'); c.style.setProperty('--d', `${Math.min(k++, 20) * 0.05}s`); }
        grid.append(c);
      }
      box.append(grid);
      const hol = list.filter((d) => d.holiday);
      if (hol.length) {
        const ul = el('ul', 'holi');
        // 同名連續的假日合併顯示（春節補假等）
        for (const d of hol) { const li = el('li'); li.append(el('b', null, String(+d.date.slice(8))), ' ' + d.holiday); ul.append(li); }
        box.append(ul);
      }
      root.append(box);
    }
    popFrom = null;
  }

  function planCard(title, plan, idx) {
    const b = el('button', 'plan'); b.type = 'button';
    b.append(el('b', null, title));
    const tot = el('div', 'tot');
    tot.append(el('strong', null, `${plan.totalLen} 天`), el('span', null, `請 ${plan.totalCost} 天・CP 值 ${(plan.totalLen / plan.totalCost).toFixed(1)}`));
    b.append(tot);
    const ul = el('ul');
    for (const it of plan.items) ul.append(el('li', null, `${L.fmtRange(it.start, it.end)}・${it.len} 天`));
    b.append(ul);
    b.addEventListener('click', () => {
      const prev = new Set(state.leave);
      state.leave = L.sanitizeLeave(plan.items.flatMap((i) => i.leaveDates), days);
      popFrom = new Set(state.leave.filter((d) => !prev.has(d)));
      save(); render(); toast(`已標出：連休 ${plan.totalLen} 天，請 ${plan.totalCost} 天`);
      const again = document.querySelectorAll('#plans .plan')[idx]; if (again) again.focus({ preventScroll: true });
    });
    return b;
  }

  function renderSide() {
    $('budgetOut').textContent = state.budget;
    const plans = $('plans'); plans.textContent = '';
    if (!state.budget) plans.append(el('p', 'empty', '先把天數調到 1 天以上。'));
    else {
      const one = L.longest(days, state.budget), many = L.bestPlan(days, state.budget);
      if (one.items.length) plans.append(planCard('一次長假：連休最久', one, 0));
      if (many.items.length) plans.append(planCard('分散出遊：總天數最多', many, one.items.length ? 1 : 0));
      if (!one.items.length) plans.append(el('p', 'empty', '這個天數找不到包含國定假日的方案。'));
    }
    const rank = $('rank'); rank.textContent = '';
    const list = state.budget ? L.ranking(days, state.budget, 8) : [];
    if (!list.length) rank.append(el('p', 'empty', '沒有符合的時段。'));
    list.forEach((c, ri) => {
      const b = el('button', 'rk'); b.type = 'button';
      b.append(el('span', 'd', `${L.fmtRange(c.start, c.end)}`));
      const cp = el('span', 'cp', `${c.cp.toFixed(1)}×`); cp.append(el('small', null, `請${c.cost}休${c.len}`));
      b.append(cp, el('span', 'h', c.holidays.join('、')));
      b.addEventListener('click', () => {
        const prev = new Set(state.leave);
        state.leave = L.sanitizeLeave([...state.leave, ...c.leaveDates], days);
        popFrom = new Set(state.leave.filter((d) => !prev.has(d)));
        save(); render(); toast(`已加入 ${L.fmtRange(c.start, c.end)}`);
        const again = document.querySelectorAll('#rank .rk')[ri]; if (again) again.focus({ preventScroll: true });
      });
      rank.append(b);
    });
  }

  function render() {
    const used = state.leave.length;
    const rs = L.runs(days, leaveSet(), 1);
    const mine = rs.filter((r) => r.leave > 0);
    const big = mine.filter((r) => r.len >= 3);
    $('used').textContent = '';
    const u = $('used');
    u.append('已請 ', el('b', null, String(used)), ` / ${state.budget} 天`);
    if (used > state.budget) u.append('（超過預算 ' + (used - state.budget) + ' 天）');
    else if (state.budget) u.append(`，還剩 ${state.budget - used} 天`);
    $('meterFill').style.width = (state.budget ? Math.min(100, (used / state.budget) * 100) : used ? 100 : 0) + '%';
    $('meter').classList.toggle('over', used > state.budget);
    $('meter').setAttribute('aria-valuenow', String(used));
    $('meter').setAttribute('aria-valuemax', String(Math.max(state.budget, used, 1)));
    $('sUsed').textContent = ''; $('sUsed').append(String(used), el('small', null, '天'));
    const longest = big.reduce((m, r) => Math.max(m, r.len), 0);
    $('sLong').textContent = ''; if (longest) { $('sLong').append(String(longest), el('small', null, '天')); } else $('sLong').textContent = '—';
    const days2 = big.reduce((s, r) => s + r.len, 0), cost2 = big.reduce((s, r) => s + r.leave, 0);
    $('sCp').textContent = cost2 ? `${(days2 / cost2).toFixed(1)}×` : '—';

    const ol = $('trips'); ol.textContent = '';
    const all = L.runs(days, leaveSet(), 3);
    for (const r of all) {
      const li = el('li', r.leave ? 'mine' : '');
      li.append(el('b', null, `${r.len} 天`), el('span', null, L.fmtRange(r.start, r.end)));
      li.append(el('span', null, (r.leave ? `請 ${r.leave} 天・` : '不用請假・') + r.holidays.join('、')));
      ol.append(li);
    }
    $('tripsNote').textContent = used ? '黃底是你標了請假的連休，其餘是原本就有的連假。' : '現在列的是 2027 年原本就有的 3 天以上連假。點日曆日期，或用左邊的「幫我挑」開始規劃。';
    renderSide();
    renderMonths(big);
  }

  // ---- actions ----
  $('months').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-date]');
    if (!b) return;
    const d = b.dataset.date;
    const set = leaveSet();
    if (set.has(d)) set.delete(d); else set.add(d);
    state.leave = L.sanitizeLeave([...set], days);
    save(); render();
    const again = document.querySelector(`button[data-date="${d}"]`);
    if (again) again.focus({ preventScroll: true });
  });
  $('plus').addEventListener('click', () => { if (state.budget < L.MAX_BUDGET) { state.budget++; save(); render(); } });
  $('minus').addEventListener('click', () => { if (state.budget > 0) { state.budget--; save(); render(); } });
  $('workSat').addEventListener('change', (e) => {
    state.workSat = e.target.checked;
    days = L.buildDays({ workSat: state.workSat });
    state.leave = L.sanitizeLeave(state.leave, days);
    save(); render();
  });
  $('clear').addEventListener('click', () => {
    if (!state.leave.length) return toast('目前沒有標任何請假日');
    state.leave = []; save(); render(); toast('已清除');
  });

  function summaryText() {
    const rs = L.runs(days, leaveSet(), 1).filter((r) => r.leave > 0);
    const lines = ['我的 2027 請假規劃'];
    rs.forEach((r, i) => {
      const lv = days.filter((d) => d.date >= r.start && d.date <= r.end && leaveSet().has(d.date) && !d.off).map((d) => `${+d.date.slice(5, 7)}/${+d.date.slice(8)}`);
      lines.push(`${i + 1}. ${L.fmtRange(r.start, r.end)} 連休 ${r.len} 天，請假 ${r.leave} 天（${lv.join('、')}）`);
    });
    lines.push(`合計請假 ${state.leave.length} 天`, '由「請假 CP 值」規劃：https://weeklyship-ai.github.io/leaveplan/');
    return lines.join('\n');
  }
  $('copy').addEventListener('click', async () => {
    if (!state.leave.length) return toast('先標幾天假再複製');
    const text = summaryText();
    try { await navigator.clipboard.writeText(text); toast('已複製，可以貼給主管或家人'); }
    catch (e) {
      const ta = el('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;opacity:0';
      document.body.append(ta); ta.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (err) { /* ignore */ }
      ta.remove(); toast(ok ? '已複製，可以貼給主管或家人' : '無法複製，請手動選取文字');
    }
  });
  $('ics').addEventListener('click', () => {
    const rs = L.runs(days, leaveSet(), 1).filter((r) => r.leave > 0);
    if (!rs.length) return toast('先標幾天假再下載');
    const blob = new Blob([L.toICS(rs)], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = el('a'); a.href = url; a.download = 'leaveplan-2027.ics';
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast('已下載，用行事曆 App 開啟即可匯入');
  });

  // ---- theme / install / service worker ----
  $('theme').addEventListener('click', () => {
    const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(THEME, next); } catch (e) { /* ignore */ }
  });
  let deferred = null;
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; $('install').classList.add('show'); });
  $('install').addEventListener('click', async () => {
    if (!deferred) return;
    deferred.prompt(); try { await deferred.userChoice; } catch (e) { /* ignore */ }
    deferred = null; $('install').classList.remove('show');
  });
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    addEventListener('load', () => navigator.serviceWorker.register('/leaveplan/sw.js', { scope: '/leaveplan/' }).catch(() => {}));
  }

  load();
  $('workSat').checked = state.workSat;
  render();
})();
