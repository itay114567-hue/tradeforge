import { useState, useEffect, useRef, useCallback } from "react";

// ─── ICONS ────────────────────────────────────────────────────────────────────
const Icon = ({ d, size = 18, stroke = "currentColor", fill = "none", strokeWidth = 1.75 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
  </svg>
);

const ICONS = {
  dashboard:    "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10",
  ai:           "M12 2a2 2 0 012 2v1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1v8a2 2 0 01-2 2H8a2 2 0 01-2-2V10H5a1 1 0 01-1-1V6a1 1 0 011-1h3V4a2 2 0 012-2zm-2 8v6m4-6v6",
  quant:        "M9 3H5L3 7v13h18V7l-2-4h-4M9 3h6M9 3v4m6-4v4M3 7h18",
  analysis:     "M3 3v18h18M7 16l4-4 4 4 4-8",
  journal:      "M4 6h16M4 10h16M4 14h10",
  coach:        "M12 2a10 10 0 110 20A10 10 0 0112 2zm0 6v4l3 3",
  guardian:     "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  settings:     ["M12 15a3 3 0 100-6 3 3 0 000 6z", "M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"],
  send:         "M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z",
  upload:       "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12",
  play:         "M5 3l14 9-14 9V3z",
  plus:         "M12 5v14M5 12h14",
  trash:        "M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6",
  zap:          "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  check:        "M20 6L9 17l-5-5",
  x:            "M18 6L6 18M6 6l12 12",
  info:         "M12 16v-4M12 8h.01M12 22a10 10 0 100-20 10 10 0 000 20z",
  target:       "M12 22a10 10 0 100-20 10 10 0 000 20zM12 18a6 6 0 100-12 6 6 0 000 12zM12 14a2 2 0 100-4 2 2 0 000 4z",
  trending:     "M23 6l-9.5 9.5-5-5L1 18",
  award:        "M12 15a7 7 0 100-14 7 7 0 000 14zM8.21 13.89L7 23l5-3 5 3-1.21-9.12",
  eye:          "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 100 6 3 3 0 000-6z",
  eyeoff:       "M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22",
  code:         "M16 18l6-6-6-6M8 6l-6 6 6 6",
  refresh:      "M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15",
  chevronLeft:  "M15 18l-6-6 6-6",
  chevronRight: "M9 18l6-6-6-6",
  menu:         "M3 12h18M3 6h18M3 18h18",
  star:         "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  bolt:         "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  copy:         "M8 4H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2M8 4a2 2 0 002 2h4a2 2 0 002-2M8 4a2 2 0 012-2h4a2 2 0 012 2",
  user:         "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 3a4 4 0 100 8 4 4 0 000-8z",
  crown:        "M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zM5 20h14",
  link:         "M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71",
  sparkle:      "M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3zM5 17l.75 2.25L8 20l-2.25.75L5 23l-.75-2.25L2 20l2.25-.75L5 17zM19 3l.75 2.25L22 6l-2.25.75L19 9l-.75-2.25L16 6l2.25-.75L19 3z",
};
const Ic = ({ name, size = 18, stroke, fill, sw }) => (
  <Icon d={ICONS[name]} size={size} stroke={stroke || "currentColor"} fill={fill || "none"} strokeWidth={sw || 1.75} />
);

// ─── MONTE CARLO ───────────────────────────────────────────────────────────────
function rng(mean = 0, std = 1) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function runMonteCarlo({ winRate, rr, riskPerTrade, totalTrades, variance, propFirmRules, accountSize, dailyLoss, maxDD, tradesPerDay }) {
  const paths = 500; const results = []; let busted = 0; let passed = 0;
  const profitTarget = propFirmRules ? accountSize * 0.1 : Infinity;
  for (let p = 0; p < paths; p++) {
    let equity = 0, peakEquity = 0, dayPnL = 0, tradesInDay = 0;
    let bustedPath = false, passedPath = false;
    const curve = [0];
    for (let t = 0; t < totalTrades; t++) {
      if (tradesInDay >= tradesPerDay) { tradesInDay = 0; dayPnL = 0; }
      const win = Math.random() < winRate / 100;
      const nm = 1 + rng(0, variance / 100);
      const pnl = win ? riskPerTrade * rr * Math.max(0.1, nm) : -riskPerTrade * Math.max(0.1, Math.abs(nm));
      equity += pnl; dayPnL += pnl; tradesInDay++;
      if (equity > peakEquity) peakEquity = equity;
      if (propFirmRules) {
        if (dayPnL <= -dailyLoss) { bustedPath = true; break; }
        if ((peakEquity - equity) >= maxDD) { bustedPath = true; break; }
        if (equity >= profitTarget) { passedPath = true; break; }
      }
      curve.push(parseFloat(equity.toFixed(2)));
    }
    if (bustedPath) busted++;
    if (passedPath) passed++;
    results.push({ curve, final: equity, busted: bustedPath, passed: passedPath });
  }
  results.sort((a, b) => a.final - b.final);
  const finals = results.map(r => r.final);
  const avg = finals.reduce((s, v) => s + v, 0) / finals.length;
  return { results, avg, p10: finals[Math.floor(finals.length * 0.1)], p50: finals[Math.floor(finals.length * 0.5)], p90: finals[Math.floor(finals.length * 0.9)], busted, passed, paths };
}

// ─── SAMPLE DATA ──────────────────────────────────────────────────────────────
const SAMPLE_TRADES = [
  { id: 1, date: "2026-05-01", symbol: "NQ", side: "Long", entry: 19240, exit: 19280, contracts: 1, pnl: 800, duration: "14m" },
  { id: 2, date: "2026-05-01", symbol: "NQ", side: "Short", entry: 19310, exit: 19350, contracts: 1, pnl: -800, duration: "8m" },
  { id: 3, date: "2026-05-02", symbol: "NQ", side: "Long", entry: 19180, exit: 19240, contracts: 2, pnl: 2400, duration: "32m" },
  { id: 4, date: "2026-05-02", symbol: "ES", side: "Short", entry: 5280, exit: 5270, contracts: 1, pnl: 500, duration: "22m" },
  { id: 5, date: "2026-05-03", symbol: "NQ", side: "Long", entry: 19300, exit: 19260, contracts: 1, pnl: -800, duration: "5m" },
  { id: 6, date: "2026-05-05", symbol: "NQ", side: "Short", entry: 19420, exit: 19360, contracts: 2, pnl: 2400, duration: "18m" },
  { id: 7, date: "2026-05-06", symbol: "NQ", side: "Long", entry: 19280, exit: 19320, contracts: 1, pnl: 800, duration: "41m" },
  { id: 8, date: "2026-05-07", symbol: "ES", side: "Long", entry: 5260, exit: 5250, contracts: 1, pnl: -500, duration: "12m" },
];

// ─── GLOBAL CSS ───────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:        #0a0a0f;
    --bg2:       #0f0f17;
    --surface:   #13131e;
    --surface2:  #1a1a28;
    --surface3:  #22223a;
    --border:    #1e1e30;
    --border2:   #2a2a42;
    --accent:    #6366f1;
    --accent-h:  #818cf8;
    --accent-bg: rgba(99,102,241,0.1);
    --accent-bg2:rgba(99,102,241,0.06);
    --green:     #10b981;
    --green-bg:  rgba(16,185,129,0.1);
    --red:       #ef4444;
    --red-bg:    rgba(239,68,68,0.1);
    --yellow:    #f59e0b;
    --yellow-bg: rgba(245,158,11,0.1);
    --blue:      #3b82f6;
    --blue-bg:   rgba(59,130,246,0.1);
    --text:      #e8e8f0;
    --text2:     #8080a0;
    --text3:     #40405a;
    --font:      'Inter', sans-serif;
    --mono:      'JetBrains Mono', monospace;
    --r:         10px;
    --r-lg:      14px;
    --sidebar-w: 240px;
  }

  html, body, #root { height: 100%; background: var(--bg); color: var(--text); font-family: var(--font); font-size: 14px; line-height: 1.5; }
  ::selection { background: rgba(99,102,241,0.3); }
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: var(--text3); }

  /* ── LAYOUT ── */
  .app { display: flex; height: 100vh; overflow: hidden; background: var(--bg); }

  /* ── SIDEBAR ── */
  .sidebar {
    width: var(--sidebar-w); min-width: var(--sidebar-w);
    background: var(--surface); border-right: 1px solid var(--border);
    display: flex; flex-direction: column; transition: width 0.25s ease, min-width 0.25s ease;
    position: relative; z-index: 20;
  }
  .sidebar.collapsed { width: 64px; min-width: 64px; }

  .sidebar-logo {
    height: 60px; padding: 0 18px;
    display: flex; align-items: center; gap: 10px;
    border-bottom: 1px solid var(--border); flex-shrink: 0;
  }
  .logo-mark {
    width: 32px; height: 32px; border-radius: 9px; flex-shrink: 0;
    background: linear-gradient(135deg, var(--accent) 0%, #8b5cf6 100%);
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 0 20px rgba(99,102,241,0.4);
  }
  .logo-name { font-size: 15px; font-weight: 700; letter-spacing: -0.3px; white-space: nowrap; overflow: hidden; }
  .logo-name em { color: var(--accent-h); font-style: normal; }

  .upgrade-btn {
    margin: 12px 10px 4px;
    background: linear-gradient(135deg, var(--accent) 0%, #8b5cf6 100%);
    border: none; border-radius: 8px; padding: 10px 12px;
    display: flex; align-items: center; gap: 8px;
    color: white; font-size: 12.5px; font-weight: 600;
    cursor: pointer; transition: opacity 0.15s, transform 0.15s;
    white-space: nowrap; overflow: hidden;
  }
  .upgrade-btn:hover { opacity: 0.9; transform: translateY(-1px); }
  .sidebar.collapsed .upgrade-btn { justify-content: center; padding: 10px; }
  .sidebar.collapsed .upgrade-btn span { display: none; }

  .nav { flex: 1; padding: 6px 8px; overflow-y: auto; overflow-x: hidden; }
  .nav-section { font-size: 10px; font-weight: 600; color: var(--text3); text-transform: uppercase;
    letter-spacing: 1.2px; padding: 14px 10px 5px; white-space: nowrap; }
  .sidebar.collapsed .nav-section { display: none; }

  .nav-item {
    display: flex; align-items: center; gap: 11px; padding: 9px 10px;
    border-radius: 8px; cursor: pointer; transition: all 0.12s;
    color: var(--text2); font-size: 13.5px; font-weight: 500;
    white-space: nowrap; overflow: hidden; position: relative;
    margin-bottom: 1px;
  }
  .nav-item:hover { background: var(--surface2); color: var(--text); }
  .nav-item.active { background: var(--accent-bg); color: var(--accent-h); }
  .nav-item.active .nav-icon { color: var(--accent); }
  .nav-icon { flex-shrink: 0; display: flex; align-items: center; }
  .nav-label { flex: 1; }
  .nav-badge {
    background: var(--accent); color: white;
    font-size: 9.5px; font-weight: 700; padding: 2px 6px;
    border-radius: 20px; flex-shrink: 0;
  }

  .sidebar-footer {
    padding: 12px 8px; border-top: 1px solid var(--border);
    display: flex; align-items: center; gap: 10px;
    overflow: hidden; flex-shrink: 0;
  }
  .user-avatar {
    width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0;
    background: linear-gradient(135deg, var(--accent), #8b5cf6);
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 700; color: white;
  }
  .user-info { overflow: hidden; }
  .user-name { font-size: 12.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .user-plan { font-size: 11px; color: var(--text3); }

  .collapse-btn {
    width: 22px; height: 22px; border-radius: 6px; flex-shrink: 0; margin-left: auto;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; color: var(--text3); transition: all 0.15s;
    background: var(--surface2); border: 1px solid var(--border);
  }
  .collapse-btn:hover { color: var(--text2); border-color: var(--border2); }

  /* ── MAIN ── */
  .main { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }

  .topbar {
    height: 60px; padding: 0 28px;
    border-bottom: 1px solid var(--border);
    display: flex; align-items: center; gap: 16px;
    background: var(--surface); flex-shrink: 0;
  }
  .topbar-left { flex: 1; display: flex; align-items: center; gap: 12px; min-width: 0; }
  .topbar-title { font-size: 14px; font-weight: 600; color: var(--text); }
  .topbar-breadcrumb { font-size: 12px; color: var(--text3); }
  .topbar-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
  .status-pill {
    display: flex; align-items: center; gap: 6px;
    background: var(--surface2); border: 1px solid var(--border2);
    border-radius: 20px; padding: 5px 12px;
    font-size: 12px; font-weight: 500; color: var(--text2);
  }
  .status-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--green); box-shadow: 0 0 6px var(--green); flex-shrink: 0; }

  .content { flex: 1; overflow-y: auto; padding: 28px; }

  /* ── CARDS ── */
  .card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--r-lg); padding: 22px;
  }
  .card-sm { padding: 16px; }
  .card-title {
    font-size: 11.5px; font-weight: 600; color: var(--text2); text-transform: uppercase;
    letter-spacing: 0.8px; margin-bottom: 18px; display: flex; align-items: center; gap: 8px;
  }
  .card-title-plain { font-size: 14px; font-weight: 600; color: var(--text); margin-bottom: 6px; }
  .card-sub { font-size: 12.5px; color: var(--text2); margin-bottom: 18px; }

  /* ── GRIDS ── */
  .g1 { display: flex; flex-direction: column; gap: 16px; }
  .g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .g3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
  .g4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
  .g-auto { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }

  /* ── STAT CARDS ── */
  .stat {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--r-lg); padding: 18px 20px;
    transition: border-color 0.15s;
  }
  .stat:hover { border-color: var(--border2); }
  .stat-label { font-size: 11px; font-weight: 600; color: var(--text2); text-transform: uppercase; letter-spacing: 0.7px; margin-bottom: 10px; }
  .stat-num { font-size: 28px; font-weight: 700; font-family: var(--mono); line-height: 1; margin-bottom: 6px; letter-spacing: -1px; }
  .stat-num.green { color: var(--green); }
  .stat-num.red   { color: var(--red); }
  .stat-num.blue  { color: var(--blue); }
  .stat-num.accent{ color: var(--accent-h); }
  .stat-num.yellow{ color: var(--yellow); }
  .stat-foot { font-size: 11.5px; color: var(--text3); }

  /* ── INPUTS ── */
  .field { margin-bottom: 14px; }
  .label { font-size: 11.5px; font-weight: 500; color: var(--text2); margin-bottom: 6px; display: block; }
  .input {
    width: 100%; background: var(--bg2); border: 1px solid var(--border2);
    border-radius: 8px; padding: 9px 12px; color: var(--text);
    font-family: var(--mono); font-size: 13px; outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(99,102,241,0.12); }
  .input::placeholder { color: var(--text3); font-family: var(--font); }
  .select {
    width: 100%; background: var(--bg2); border: 1px solid var(--border2);
    border-radius: 8px; padding: 9px 12px; color: var(--text);
    font-family: var(--font); font-size: 13px; outline: none;
    cursor: pointer; appearance: none; transition: border-color 0.15s;
  }
  .select:focus { border-color: var(--accent); }

  /* ── BUTTONS ── */
  .btn {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 9px 18px; border-radius: 8px;
    font-family: var(--font); font-size: 13px; font-weight: 600;
    cursor: pointer; border: none; outline: none;
    transition: all 0.15s; white-space: nowrap;
  }
  .btn-primary {
    background: var(--accent); color: white;
    box-shadow: 0 0 0 0 rgba(99,102,241,0);
  }
  .btn-primary:hover { background: var(--accent-h); transform: translateY(-1px); box-shadow: 0 4px 14px rgba(99,102,241,0.4); }
  .btn-secondary {
    background: var(--surface2); color: var(--text);
    border: 1px solid var(--border2);
  }
  .btn-secondary:hover { background: var(--surface3); border-color: var(--text3); }
  .btn-ghost { background: transparent; color: var(--text2); border: 1px solid var(--border2); }
  .btn-ghost:hover { background: var(--surface2); color: var(--text); }
  .btn-danger { background: var(--red-bg); color: var(--red); border: 1px solid rgba(239,68,68,0.2); }
  .btn-danger:hover { background: rgba(239,68,68,0.2); }
  .btn-sm { padding: 6px 12px; font-size: 12px; border-radius: 7px; gap: 5px; }
  .btn-full { width: 100%; justify-content: center; }
  .btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none !important; box-shadow: none !important; }

  /* ── TOGGLE ── */
  .toggle-row { display: flex; align-items: center; gap: 10px; cursor: pointer; }
  .toggle { width: 38px; height: 21px; background: var(--surface3); border-radius: 21px; position: relative; transition: background 0.2s; flex-shrink: 0; border: 1px solid var(--border2); }
  .toggle.on { background: var(--accent); border-color: var(--accent); }
  .toggle::after { content: ''; position: absolute; top: 2px; left: 2px; width: 15px; height: 15px; background: white; border-radius: 50%; transition: transform 0.2s; }
  .toggle.on::after { transform: translateX(17px); }
  .toggle-txt { font-size: 13px; color: var(--text2); font-weight: 500; }

  /* ── BADGES ── */
  .badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 5px; font-size: 11.5px; font-weight: 600; }
  .b-green  { background: var(--green-bg);  color: var(--green); }
  .b-red    { background: var(--red-bg);    color: var(--red); }
  .b-blue   { background: var(--blue-bg);   color: var(--blue); }
  .b-accent { background: var(--accent-bg); color: var(--accent-h); }
  .b-yellow { background: var(--yellow-bg); color: var(--yellow); }
  .b-gray   { background: var(--surface2);  color: var(--text2);  border: 1px solid var(--border2); }

  /* ── CHAT ── */
  .chat-wrap { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
  .chat-sidebar {
    width: 260px; min-width: 260px; border-right: 1px solid var(--border);
    background: var(--surface); display: flex; flex-direction: column; overflow: hidden;
  }
  .chat-sidebar-head { padding: 18px 16px 12px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
  .chat-history { flex: 1; overflow-y: auto; padding: 8px; }
  .chat-history-item {
    padding: 9px 10px; border-radius: 7px; cursor: pointer; margin-bottom: 2px;
    transition: background 0.12s; color: var(--text2); font-size: 12.5px;
  }
  .chat-history-item:hover { background: var(--surface2); color: var(--text); }
  .chat-history-item.active { background: var(--accent-bg); color: var(--accent-h); }
  .chat-history-time { font-size: 10.5px; color: var(--text3); margin-top: 2px; }

  .chat-body { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
  .chat-messages { flex: 1; overflow-y: auto; padding: 24px; display: flex; flex-direction: column; gap: 20px; }
  .msg { display: flex; gap: 12px; animation: fadeUp 0.2s ease; }
  .msg.user { flex-direction: row-reverse; }
  .msg-av {
    width: 34px; height: 34px; border-radius: 9px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 13px; font-weight: 700;
  }
  .msg-av.ai { background: linear-gradient(135deg, var(--accent), #8b5cf6); color: white; }
  .msg-av.user { background: var(--surface3); color: var(--text); border: 1px solid var(--border2); }
  .msg-bubble {
    max-width: 72%; padding: 13px 16px; border-radius: 12px;
    font-size: 13.5px; line-height: 1.7;
  }
  .msg-bubble.ai { background: var(--surface); border: 1px solid var(--border); }
  .msg-bubble.user { background: var(--accent-bg); border: 1px solid rgba(99,102,241,0.2); }
  .code-header {
    display: flex; align-items: center; justify-content: space-between;
    background: var(--surface3); padding: 7px 14px;
    border-radius: 8px 8px 0 0; font-size: 11px; color: var(--text2);
    font-family: var(--mono); margin-top: 10px;
    border: 1px solid var(--border2); border-bottom: none;
  }
  .code-block {
    background: var(--bg); border: 1px solid var(--border2); border-top: none;
    border-radius: 0 0 8px 8px; padding: 14px; font-family: var(--mono);
    font-size: 12.5px; overflow-x: auto; white-space: pre-wrap;
    color: #a5d6ff; line-height: 1.65; margin-bottom: 8px;
  }
  .chat-quick-btns { padding: 0 24px 14px; display: flex; gap: 8px; flex-wrap: wrap; }
  .quick-btn {
    padding: 7px 13px; border-radius: 7px; font-size: 12px; font-weight: 500;
    background: var(--surface2); border: 1px solid var(--border2); color: var(--text2);
    cursor: pointer; transition: all 0.12s;
  }
  .quick-btn:hover { background: var(--surface3); color: var(--text); border-color: var(--border2); }
  .chat-input-wrap {
    padding: 16px 24px; border-top: 1px solid var(--border);
    background: var(--surface); flex-shrink: 0;
  }
  .chat-input-row { display: flex; gap: 8px; align-items: flex-end; }
  .chat-textarea {
    flex: 1; background: var(--bg2); border: 1px solid var(--border2);
    border-radius: 10px; padding: 10px 14px; color: var(--text);
    font-family: var(--font); font-size: 13.5px; outline: none;
    resize: none; transition: border-color 0.15s, box-shadow 0.15s;
    min-height: 44px; max-height: 120px; line-height: 1.5;
  }
  .chat-textarea:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(99,102,241,0.12); }
  .chat-textarea::placeholder { color: var(--text3); }
  .chat-footer-note { font-size: 11.5px; color: var(--text3); margin-top: 8px; }

  /* ── JOURNAL CARD ── */
  .j-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--r-lg); overflow: hidden;
    transition: border-color 0.15s;
  }
  .j-card:hover { border-color: var(--border2); }
  .j-card-top { padding: 16px 18px; display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  .j-card-bar { height: 3px; width: 100%; }
  .j-card-bar.green { background: var(--green); }
  .j-card-bar.red   { background: var(--red); }
  .j-card-bar.blue  { background: var(--blue); }
  .j-card-body { padding: 0 18px 16px; }
  .progress-track { height: 5px; background: var(--surface2); border-radius: 3px; overflow: hidden; }
  .progress-fill { height: 100%; border-radius: 3px; transition: width 0.6s ease; }
  .progress-fill.green { background: var(--green); }
  .progress-fill.red   { background: var(--red); }
  .progress-fill.accent { background: linear-gradient(90deg, var(--accent), var(--accent-h)); }

  /* ── TABLES ── */
  .tbl { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  .tbl th { padding: 9px 13px; text-align: left; font-size: 10.5px; font-weight: 600;
    color: var(--text3); text-transform: uppercase; letter-spacing: 0.7px;
    border-bottom: 1px solid var(--border); white-space: nowrap; }
  .tbl td { padding: 10px 13px; border-bottom: 1px solid var(--border); color: var(--text2); }
  .tbl tr:last-child td { border-bottom: none; }
  .tbl tr:hover td { background: var(--surface2); color: var(--text); }
  .tbl td.profit { color: var(--green); font-family: var(--mono); font-weight: 600; }
  .tbl td.loss   { color: var(--red);   font-family: var(--mono); font-weight: 600; }
  .tbl td.mono   { font-family: var(--mono); }

  /* ── FILE DROP ── */
  .file-drop {
    border: 2px dashed var(--border2); border-radius: var(--r-lg); padding: 56px 40px;
    text-align: center; cursor: pointer; transition: all 0.2s; background: var(--bg2);
  }
  .file-drop:hover, .file-drop.drag {
    border-color: var(--accent); background: var(--accent-bg2);
  }
  .file-drop-icon { color: var(--text3); margin-bottom: 14px; display: flex; justify-content: center; }
  .file-drop-title { font-size: 14.5px; font-weight: 600; margin-bottom: 6px; }
  .file-drop-sub { font-size: 12.5px; color: var(--text2); }

  /* ── MC CANVAS ── */
  .mc-canvas { width: 100%; border-radius: 8px; background: var(--bg2); display: block; }

  /* ── TIP BOX ── */
  .tip { background: var(--yellow-bg); border: 1px solid rgba(245,158,11,0.2); border-radius: 9px;
    padding: 11px 14px; font-size: 12.5px; color: var(--yellow); display: flex; align-items: flex-start; gap: 9px; }

  /* ── SECTION HEADER ── */
  .page-title { font-size: 20px; font-weight: 700; letter-spacing: -0.4px; margin-bottom: 4px; }
  .page-sub { font-size: 13px; color: var(--text2); margin-bottom: 24px; }

  /* ── DIVIDER ── */
  hr { border: none; border-top: 1px solid var(--border); margin: 16px 0; }

  /* ── FLEX UTILS ── */
  .row { display: flex; align-items: center; }
  .row-between { display: flex; align-items: center; justify-content: space-between; }
  .col { display: flex; flex-direction: column; }
  .gap4  { gap: 4px; }  .gap6  { gap: 6px; }  .gap8  { gap: 8px; }
  .gap10 { gap: 10px; } .gap12 { gap: 12px; } .gap16 { gap: 16px; }
  .gap20 { gap: 20px; } .gap24 { gap: 24px; }
  .mt4 { margin-top: 4px; } .mt6 { margin-top: 6px; } .mt8 { margin-top: 8px; }
  .mt12 { margin-top: 12px; } .mt16 { margin-top: 16px; } .mt20 { margin-top: 20px; }
  .mb4 { margin-bottom: 4px; } .mb8 { margin-bottom: 8px; } .mb12 { margin-bottom: 12px; }
  .mb16 { margin-bottom: 16px; } .mb20 { margin-bottom: 20px; }
  .mla { margin-left: auto; }
  .w100 { width: 100%; }
  .f1 { flex: 1; } .f0 { flex-shrink: 0; }
  .text-sm { font-size: 12px; } .text-xs { font-size: 11px; }
  .muted { color: var(--text2); } .dim { color: var(--text3); }
  .mono { font-family: var(--mono); }
  .bold { font-weight: 700; }
  .green { color: var(--green); } .red { color: var(--red); }
  .accent { color: var(--accent-h); }

  /* ── EMPTY STATE ── */
  .empty { text-align: center; padding: 64px 24px; }
  .empty-icon { margin-bottom: 14px; color: var(--text3); display: flex; justify-content: center; }
  .empty-title { font-size: 15px; font-weight: 600; margin-bottom: 8px; }
  .empty-sub { font-size: 13px; color: var(--text2); max-width: 320px; margin: 0 auto 20px; }

  /* ── MODEL CHIPS ── */
  .model-chips { display: flex; gap: 6px; flex-wrap: wrap; }
  .model-chip {
    padding: 5px 11px; border-radius: 20px; font-size: 11.5px; font-weight: 500;
    cursor: pointer; border: 1px solid var(--border2); color: var(--text2);
    background: transparent; transition: all 0.12s;
  }
  .model-chip:hover { border-color: var(--accent); color: var(--accent-h); }
  .model-chip.active { border-color: var(--accent); color: var(--accent-h); background: var(--accent-bg); }

  /* ── SETTINGS ── */
  .settings-section { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-lg); overflow: hidden; margin-bottom: 16px; }
  .settings-head { padding: 16px 20px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 10px; }
  .settings-head-title { font-size: 13px; font-weight: 600; }
  .settings-head-sub { font-size: 12px; color: var(--text2); margin-top: 1px; }
  .settings-row { padding: 16px 20px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border); gap: 20px; }
  .settings-row:last-child { border-bottom: none; }
  .settings-row-label { font-size: 13px; font-weight: 500; }
  .settings-row-sub { font-size: 12px; color: var(--text2); margin-top: 2px; }
  .settings-val { font-family: var(--mono); font-size: 13px; color: var(--text); }
  .usage-bar { height: 4px; background: var(--surface2); border-radius: 2px; overflow: hidden; margin-top: 6px; width: 160px; }
  .usage-fill { height: 100%; border-radius: 2px; background: var(--accent); }

  /* ── TAB PILLS ── */
  .tabs { display: flex; gap: 2px; background: var(--bg2); border: 1px solid var(--border); border-radius: 9px; padding: 3px; align-self: flex-start; }
  .tab { padding: 6px 14px; border-radius: 7px; font-size: 12.5px; font-weight: 500; cursor: pointer; color: var(--text2); transition: all 0.12s; }
  .tab:hover { color: var(--text); }
  .tab.active { background: var(--surface); color: var(--text); box-shadow: 0 1px 4px rgba(0,0,0,0.3); }

  /* ── ANIMATIONS ── */
  @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes pulse  { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
  @keyframes spin   { to { transform: rotate(360deg); } }
  @keyframes shimmer { from { background-position: -200% 0; } to { background-position: 200% 0; } }
  .spin { animation: spin 0.7s linear infinite; display: inline-block; }
  .loading-dot { animation: pulse 1.3s infinite; font-size: 18px; line-height: 1; }

  /* ── MODAL ── */
  .modal-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.7);
    display: flex; align-items: center; justify-content: center;
    z-index: 100; padding: 20px; backdrop-filter: blur(4px);
    animation: fadeUp 0.15s ease;
  }
  .modal {
    background: var(--surface); border: 1px solid var(--border2);
    border-radius: 16px; padding: 28px; max-width: 540px; width: 100%;
    max-height: 90vh; overflow-y: auto;
    box-shadow: 0 24px 80px rgba(0,0,0,0.6);
  }
  .modal-title { font-size: 17px; font-weight: 700; margin-bottom: 20px; }
  .modal-footer { display: flex; gap: 10px; justify-content: flex-end; margin-top: 24px; }

  /* ── RESPONSIVE ── */
  @media (max-width: 1024px) {
    .sidebar { width: 64px; min-width: 64px; }
    .sidebar.collapsed { width: 64px; min-width: 64px; }
    .logo-name, .nav-item .nav-label, .nav-badge, .nav-section, .upgrade-btn span, .user-info { display: none; }
    .upgrade-btn { justify-content: center; padding: 10px; }
    .user-info { display: none; }
    .g4 { grid-template-columns: 1fr 1fr; }
  }
  @media (max-width: 768px) {
    .g2, .g3, .g4 { grid-template-columns: 1fr; }
    .content { padding: 16px; }
    .chat-sidebar { display: none; }
  }
`;

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({ setPage }) {
  const stats = [
    { label: "Total PnL",     value: "+$4,800", cls: "green", foot: "↑ 12% this month" },
    { label: "Win Rate",      value: "63.5%",   cls: "accent", foot: "51W / 29L · 80 trades" },
    { label: "Profit Factor", value: "2.04",    cls: "blue",  foot: "Strong profitability" },
    { label: "Max Drawdown",  value: "$1,240",  cls: "red",   foot: "4.9% of account" },
  ];
  const quickActions = [
    { icon: "ai",       label: "AI Builder",    sub: "Pine Script + ICT concepts",   color: "var(--accent-h)",   page: "ai" },
    { icon: "quant",    label: "Quant Lab",     sub: "Monte Carlo simulation",        color: "var(--blue)",       page: "quant" },
    { icon: "analysis", label: "Analysis",      sub: "Import & analyze CSV",          color: "var(--green)",      page: "analysis" },
    { icon: "coach",    label: "AI Coach",      sub: "Trading psychology & review",   color: "#a78bfa",           page: "coach" },
    { icon: "journal",  label: "Journal",       sub: "Prop firm tracker",             color: "var(--yellow)",     page: "journal" },
    { icon: "guardian", label: "Guardian",      sub: "Auto lockout protection",       color: "var(--red)",        page: "guardian" },
  ];
  return (
    <div className="g1">
      <div>
        <div className="page-title">Dashboard</div>
        <div className="page-sub">Your trading command center</div>
      </div>

      {/* Upload CTA */}
      <div className="card row-between gap16" style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.05))", borderColor: "rgba(99,102,241,0.2)" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Upload Trade History</div>
          <div className="muted text-sm">Import from TradingView, NinjaTrader, MT4, MT5, MultiCharts, or any CSV</div>
        </div>
        <button className="btn btn-primary f0" onClick={() => setPage("analysis")}>
          <Ic name="upload" size={14} /> Upload CSV
        </button>
      </div>

      {/* Stats */}
      <div className="g4">
        {stats.map(s => (
          <div key={s.label} className="stat">
            <div className="stat-label">{s.label}</div>
            <div className={`stat-num ${s.cls}`}>{s.value}</div>
            <div className="stat-foot">{s.foot}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 12 }}>Quick Access</div>
        <div className="g3">
          {quickActions.map(a => (
            <div key={a.page} className="card card-sm row gap12"
              style={{ cursor: "pointer", transition: "all 0.15s" }}
              onClick={() => setPage(a.page)}
              onMouseEnter={e => { e.currentTarget.style.borderColor = a.color; e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.transform = ""; }}>
              <div style={{ width: 38, height: 38, borderRadius: 9, background: `${a.color}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: a.color }}>
                <Ic name={a.icon} size={18} stroke={a.color} />
              </div>
              <div style={{ overflow: "hidden" }}>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{a.label}</div>
                <div className="muted text-xs mt4" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent + Challenge */}
      <div className="g2">
        <div className="card">
          <div className="card-title"><Ic name="trending" size={13} /> Recent Trades</div>
          {SAMPLE_TRADES.slice(0, 5).map(t => (
            <div key={t.id} className="row-between" style={{ padding: "9px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
              <div className="row gap8">
                <span className={`badge ${t.pnl >= 0 ? "b-green" : "b-red"}`}>{t.side}</span>
                <span className="muted">{t.symbol} · {t.date}</span>
              </div>
              <span className={`mono bold ${t.pnl >= 0 ? "green" : "red"}`}>{t.pnl >= 0 ? "+" : ""}${t.pnl.toLocaleString()}</span>
            </div>
          ))}
          <button className="btn btn-ghost btn-sm mt12" onClick={() => setPage("analysis")}><Ic name="analysis" size={13} /> View All</button>
        </div>

        <div className="card">
          <div className="card-title"><Ic name="award" size={13} /> Active Challenge</div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Apex Trader Funding</div>
            <div className="muted text-sm mt4">$50K Challenge · Phase 1</div>
          </div>
          <div className="row-between text-sm muted mb4">
            <span>Profit Target Progress</span>
            <span className="mono green">+$1,840 / $3,000</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill green" style={{ width: "61%" }} />
          </div>
          <div className="text-xs dim mt6 mb16">61% to target · 12 trading days</div>
          <div className="g3" style={{ gap: 10 }}>
            {[["Daily Limit", "$2,500"], ["Max DD", "$2,500"], ["Trades", "12"]].map(([k, v]) => (
              <div key={k} style={{ background: "var(--bg2)", borderRadius: 8, padding: "10px 12px" }}>
                <div className="text-xs dim mb4">{k}</div>
                <div className="mono bold" style={{ fontSize: 13 }}>{v}</div>
              </div>
            ))}
          </div>
          <button className="btn btn-ghost btn-sm mt12" onClick={() => setPage("journal")}><Ic name="journal" size={13} /> Open Journal</button>
        </div>
      </div>
    </div>
  );
}

// ─── AI BUILDER ───────────────────────────────────────────────────────────────
function AIBuilder() {
  const MODELS = [
    { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4.6", tag: "anthropic" },
    { id: "claude-opus-4-20250514",   label: "Claude Opus 4.6",   tag: "anthropic" },
    { id: "gpt-4o",                   label: "GPT-4o",             tag: "openai"    },
    { id: "gemini-2.0-flash",         label: "Gemini 2.0",         tag: "google"    },
  ];
  const QUICK = [
    "Write NQ SMT + IFVG Pine Script v6",
    "Explain ICT CISD concept",
    "Add trailing stop to my strategy",
    "Best session times for NQ futures",
  ];
  const [model, setModel]       = useState(MODELS[0]);
  const [messages, setMessages] = useState([{ role: "assistant", content: "Hey! I'm your AI trading assistant. I can write Pine Script strategies, analyze your setups, explain ICT concepts, or help with any trading question.\n\nTry: *\"Write a Pine Script v6 NQ strategy using SMT divergence and IFVG entries\"*" }]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [history]               = useState([{ id: 1, preview: "SMT + IFVG Pine Script", time: "31m ago" }]);
  const [copied, setCopied]     = useState(null);
  const bottomRef               = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const copyCode = (code, id) => {
    navigator.clipboard.writeText(code).then(() => { setCopied(id); setTimeout(() => setCopied(null), 2000); });
  };

  const formatMsg = (text, msgIdx) => {
    const parts = text.split(/(```[\s\S]*?```|\*[^*]+\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("```") && part.endsWith("```")) {
        const inner = part.slice(3, -3);
        const nl = inner.indexOf("\n");
        const lang = nl > -1 ? inner.slice(0, nl) : "pine";
        const code = nl > -1 ? inner.slice(nl + 1) : inner;
        const cid = `${msgIdx}-${i}`;
        return (
          <div key={i}>
            <div className="code-header">
              <span>{lang || "pinescript"}</span>
              <button className="btn btn-sm btn-ghost" style={{ padding: "2px 8px", fontSize: 11 }} onClick={() => copyCode(code, cid)}>
                {copied === cid ? <><Ic name="check" size={11} stroke="var(--green)" /> Copied</> : <><Ic name="copy" size={11} /> Copy</>}
              </button>
            </div>
            <div className="code-block">{code}</div>
          </div>
        );
      }
      if (part.startsWith("*") && part.endsWith("*")) return <em key={i} style={{ color: "var(--accent-h)", fontStyle: "normal", fontWeight: 600 }}>{part.slice(1, -1)}</em>;
      return <span key={i} style={{ whiteSpace: "pre-wrap" }}>{part}</span>;
    });
  };

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);
    const systemPrompt = `You are an expert algorithmic trading assistant specializing in Pine Script v6, ICT concepts (SMT, IFVG, CISD, liquidity sweeps), NQ/ES futures, and prop firm trading strategies. When writing Pine Script, always use v6 syntax. Format code blocks with triple backticks and 'pinescript' as the language label.`;
    try {
      const apiKey = typeof import_meta_env !== "undefined" ? import_meta_env.VITE_ANTHROPIC_API_KEY : undefined;
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(apiKey ? { "x-api-key": apiKey } : {}) },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 2000, system: systemPrompt,
          messages: [...messages.filter((m, i) => i > 0 || m.role === "user").map(m => ({ role: m.role, content: m.content })), { role: "user", content: userMsg }]
        })
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.content?.[0]?.text || "Sorry, couldn't process that.", model: model.label }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "⚠️ Connection error. Check your API key in settings." }]);
    }
    setLoading(false);
  };

  return (
    <div style={{ display: "flex", flex: 1, overflow: "hidden", height: "100%" }}>
      {/* Sidebar */}
      <div className="chat-sidebar">
        <div className="chat-sidebar-head">
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>AI Builder</div>
          <button className="btn btn-secondary btn-sm w100"><Ic name="plus" size={13} /> New Chat</button>
        </div>
        <div style={{ padding: "8px 8px 4px", fontSize: 10.5, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: 600 }}>Today</div>
        <div className="chat-history">
          {history.map(h => (
            <div key={h.id} className="chat-history-item active">
              <div style={{ fontSize: 12.5, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{h.preview}</div>
              <div className="chat-history-time">{h.time}</div>
            </div>
          ))}
        </div>
        <div style={{ padding: "10px 8px", borderTop: "1px solid var(--border)" }}>
          <div className="model-chips" style={{ flexDirection: "column", gap: 4 }}>
            {MODELS.map(m => (
              <div key={m.id} className={`model-chip ${model.id === m.id ? "active" : ""}`} style={{ borderRadius: 7, fontSize: 11.5 }} onClick={() => setModel(m)}>{m.label}</div>
            ))}
          </div>
        </div>
      </div>

      {/* Chat */}
      <div className="chat-body">
        <div className="chat-messages">
          {messages.map((msg, i) => (
            <div key={i} className={`msg ${msg.role === "user" ? "user" : ""}`}>
              <div className={`msg-av ${msg.role}`}>{msg.role === "user" ? "I" : <Ic name="sparkle" size={15} stroke="white" />}</div>
              <div className={`msg-bubble ${msg.role}`}>
                {msg.model && <div style={{ fontSize: 10.5, color: "var(--text3)", marginBottom: 6, fontFamily: "var(--mono)" }}>{msg.model}</div>}
                {formatMsg(msg.content, i)}
              </div>
            </div>
          ))}
          {loading && (
            <div className="msg">
              <div className="msg-av ai"><Ic name="sparkle" size={15} stroke="white" /></div>
              <div className="msg-bubble ai">
                <span className="loading-dot">●</span>&nbsp;<span className="loading-dot" style={{ animationDelay: "0.2s" }}>●</span>&nbsp;<span className="loading-dot" style={{ animationDelay: "0.4s" }}>●</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        {messages.length <= 1 && (
          <div className="chat-quick-btns">
            {QUICK.map(p => <div key={p} className="quick-btn" onClick={() => setInput(p)}>{p}</div>)}
          </div>
        )}
        <div className="chat-input-wrap">
          <div className="chat-input-row">
            <textarea className="chat-textarea" placeholder="Ask about Pine Script, ICT concepts, trading strategies..." value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} rows={1} />
            <button className="btn btn-primary f0" onClick={send} disabled={loading || !input.trim()} style={{ height: 44, borderRadius: 10 }}>
              <Ic name="send" size={15} />
            </button>
          </div>
          <div className="chat-footer-note">Enter to send · Shift+Enter for newline · <span className="accent">{model.label}</span></div>
        </div>
      </div>
    </div>
  );
}

// ─── COACH EDGE ───────────────────────────────────────────────────────────────
function CoachEdge() {
  const QUICK_PROMPTS = [
    { icon: "trending", label: "Bad day", prompt: "I had a really bad trading day today and I need to talk through it." },
    { icon: "target",   label: "Plan tomorrow", prompt: "Help me plan my trading session for tomorrow." },
    { icon: "analysis", label: "Review my stats", prompt: "Can you review my current account performance and give feedback?" },
    { icon: "info",     label: "Just need to vent", prompt: "I just need to talk about my frustrations with trading." },
  ];
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [history]               = useState([{ id: 1, preview: "Can you review my current accou...", time: "31m ago" }]);
  const bottomRef               = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async (text) => {
    const userMsg = (text || input).trim();
    if (!userMsg || loading) return;
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);
    const systemPrompt = `You are Coach Edge, an elite trading performance coach and psychologist. You specialize in prop firm trading, NQ/ES futures, mindset, risk management, and helping traders overcome emotional and psychological barriers. You are empathetic, direct, and insightful. You reference the trader's actual stats when available. Be conversational and supportive, not generic. Keep replies concise and actionable.`;
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 1000, system: systemPrompt,
          messages: [...messages.map(m => ({ role: m.role, content: m.content })), { role: "user", content: userMsg }]
        })
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.content?.[0]?.text || "I'm here for you. Let's talk." }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Coach Edge is temporarily offline. Try again in a moment." }]);
    }
    setLoading(false);
  };

  return (
    <div style={{ display: "flex", flex: 1, overflow: "hidden", height: "100%" }}>
      {/* Sidebar */}
      <div className="chat-sidebar">
        <div className="chat-sidebar-head">
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Coach Edge</div>
          <div className="text-xs muted mb12">AI performance coach</div>
          <button className="btn btn-secondary btn-sm w100"><Ic name="plus" size={13} /> New Conversation</button>
        </div>
        <div style={{ padding: "8px 8px 4px", fontSize: 10.5, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: 600 }}>Today</div>
        <div className="chat-history">
          {history.map(h => (
            <div key={h.id} className="chat-history-item active">
              <div style={{ fontSize: 12.5, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{h.preview}</div>
              <div className="chat-history-time">{h.time}</div>
            </div>
          ))}
        </div>
        <div style={{ padding: "12px 10px", borderTop: "1px solid var(--border)" }}>
          <div className="text-xs dim mb8" style={{ textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: 600 }}>Quick topics</div>
          {QUICK_PROMPTS.map(q => (
            <div key={q.label} className="chat-history-item row gap8" onClick={() => send(q.prompt)}>
              <Ic name={q.icon} size={13} />
              <span>{q.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Chat */}
      <div className="chat-body">
        {messages.length === 0 ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 24px" }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: "linear-gradient(135deg, #a78bfa, var(--accent))", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18, boxShadow: "0 0 30px rgba(167,139,250,0.3)" }}>
              <Ic name="coach" size={24} stroke="white" />
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, textAlign: "center" }}>Hey, I'm Coach Edge</div>
            <div className="muted" style={{ fontSize: 13.5, textAlign: "center", maxWidth: 380, marginBottom: 28, lineHeight: 1.65 }}>
              I don't see any active accounts yet, but I'm here whenever you want to talk trading. What's on your mind?
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
              {QUICK_PROMPTS.map(q => (
                <button key={q.label} className="btn btn-secondary gap6" onClick={() => send(q.prompt)}>
                  <Ic name={q.icon} size={14} /> {q.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="chat-messages">
            {messages.map((msg, i) => (
              <div key={i} className={`msg ${msg.role === "user" ? "user" : ""}`}>
                <div className={`msg-av ${msg.role}`}>{msg.role === "user" ? "I" : <Ic name="coach" size={15} stroke="white" />}</div>
                <div className={`msg-bubble ${msg.role}`} style={{ whiteSpace: "pre-wrap" }}>{msg.content}</div>
              </div>
            ))}
            {loading && (
              <div className="msg">
                <div className="msg-av ai"><Ic name="coach" size={15} stroke="white" /></div>
                <div className="msg-bubble ai">
                  <span className="loading-dot">●</span>&nbsp;<span className="loading-dot" style={{ animationDelay: "0.2s" }}>●</span>&nbsp;<span className="loading-dot" style={{ animationDelay: "0.4s" }}>●</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
        <div className="chat-input-wrap">
          <div className="text-xs dim mb8">Coach Edge is an AI performance assistant — not a licensed therapist or financial advisor. Conversations are private.</div>
          <div className="chat-input-row">
            <textarea className="chat-textarea" placeholder="Talk to Coach Edge..." value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} rows={1} />
            <button className="btn btn-primary f0" onClick={() => send()} disabled={loading || !input.trim()} style={{ height: 44, borderRadius: 10, background: "linear-gradient(135deg, #a78bfa, var(--accent))" }}>
              <Ic name="send" size={15} />
            </button>
          </div>
          <div className="chat-footer-note">Enter to send · Shift+Enter for newline · 20 messages remaining today</div>
        </div>
      </div>
    </div>
  );
}

// ─── TRADING GUARDIAN ─────────────────────────────────────────────────────────
function TradingGuardian() {
  const [connected, setConnected] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [rules, setRules] = useState({ dailyLoss: "2500", maxDD: "5000", maxTrades: "3", enabled: true });

  const connect = () => {
    if (!username || !password) return;
    setConnecting(true);
    setTimeout(() => { setConnecting(false); setConnected(true); }, 1800);
  };

  if (!connected) return (
    <div className="g1">
      <div>
        <div className="page-title">Trading Guardian</div>
        <div className="page-sub">Connect your Tradovate account to enable automatic trade lockout protection</div>
      </div>
      <div style={{ display: "flex", justifyContent: "center", paddingTop: 32 }}>
        <div className="card" style={{ maxWidth: 460, width: "100%" }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ width: 64, height: 64, borderRadius: 18, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <Ic name="guardian" size={28} stroke="var(--red)" />
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Connect to Tradovate</div>
            <div className="muted text-sm">Your credentials are encrypted end-to-end and never leave your browser</div>
          </div>
          <div className="field">
            <label className="label">Tradovate Username</label>
            <input className="input" placeholder="username" value={username} onChange={e => setUsername(e.target.value)} />
          </div>
          <div className="field">
            <label className="label">Password</label>
            <div style={{ position: "relative" }}>
              <input className="input" type={showPw ? "text" : "password"} placeholder="password" value={password} onChange={e => setPassword(e.target.value)} style={{ paddingRight: 42 }} />
              <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", cursor: "pointer", color: "var(--text2)" }} onClick={() => setShowPw(p => !p)}>
                <Ic name={showPw ? "eyeoff" : "eye"} size={16} />
              </div>
            </div>
          </div>
          <button className="btn btn-primary btn-full mt8" onClick={connect} disabled={connecting || !username || !password}>
            {connecting ? <><span className="spin">↻</span> Connecting…</> : <><Ic name="link" size={14} /> Connect to Tradovate</>}
          </button>
          <div className="text-xs dim" style={{ textAlign: "center", marginTop: 12 }}>🔒 Your credentials are encrypted end-to-end and never leave your browser.</div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="g1">
      <div className="row-between">
        <div>
          <div className="page-title">Trading Guardian</div>
          <div className="page-sub">Automatic lockout protection — connected to Tradovate</div>
        </div>
        <div className="row gap8">
          <div className="status-pill"><div className="status-dot" /> Connected</div>
          <button className="btn btn-ghost btn-sm" onClick={() => setConnected(false)}>Disconnect</button>
        </div>
      </div>

      <div className="g2">
        <div className="card">
          <div className="card-title"><Ic name="guardian" size={13} stroke="var(--red)" /> Lockout Rules</div>
          <div className="field">
            <label className="label">Max Daily Loss ($)</label>
            <input className="input" type="number" value={rules.dailyLoss} onChange={e => setRules(r => ({ ...r, dailyLoss: e.target.value }))} />
          </div>
          <div className="field">
            <label className="label">Max Overall Drawdown ($)</label>
            <input className="input" type="number" value={rules.maxDD} onChange={e => setRules(r => ({ ...r, maxDD: e.target.value }))} />
          </div>
          <div className="field">
            <label className="label">Max Trades Per Day</label>
            <input className="input" type="number" value={rules.maxTrades} onChange={e => setRules(r => ({ ...r, maxTrades: e.target.value }))} />
          </div>
          <div className="toggle-row mt8" onClick={() => setRules(r => ({ ...r, enabled: !r.enabled }))}>
            <div className={`toggle ${rules.enabled ? "on" : ""}`} />
            <span className="toggle-txt">Lockout protection {rules.enabled ? "enabled" : "disabled"}</span>
          </div>
          <button className="btn btn-primary btn-full mt16"><Ic name="check" size={14} /> Save Rules</button>
        </div>

        <div className="g1">
          <div className="card">
            <div className="card-title"><Ic name="trending" size={13} /> Today's Status</div>
            <div className="g2" style={{ gap: 10 }}>
              {[["Daily P&L", "+$320", "green"], ["Drawdown Used", "$0", "green"], ["Trades Today", "2 / 3", "accent"], ["Status", "Trading OK", "green"]].map(([k, v, c]) => (
                <div key={k} style={{ background: "var(--bg2)", borderRadius: 9, padding: "12px 14px" }}>
                  <div className="text-xs dim mb6">{k}</div>
                  <div className={`mono bold ${c}`} style={{ fontSize: 16 }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="card" style={{ background: "rgba(16,185,129,0.06)", borderColor: "rgba(16,185,129,0.2)" }}>
            <div className="row gap10 mb8">
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--green-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Ic name="check" size={18} stroke="var(--green)" />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>All Clear</div>
                <div className="text-xs muted">No rules breached today</div>
              </div>
            </div>
            <div className="text-sm muted">Guardian is actively monitoring your account. If daily loss limit or max drawdown is reached, trading will be automatically halted.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── QUANT LAB ────────────────────────────────────────────────────────────────
function QuantLab() {
  const [params, setParams] = useState({ winRate: 55, rr: 1.5, riskPerTrade: 500, totalTrades: 300, tradesPerDay: 3, variance: 35, propFirmRules: true, accountSize: 50000, dailyLoss: 2500, maxDD: 2500 });
  const [results, setResults] = useState(null);
  const [running, setRunning] = useState(false);
  const canvasRef = useRef(null);
  const p = key => val => setParams(prev => ({ ...prev, [key]: parseFloat(val) || val }));

  const run = () => {
    setRunning(true);
    setTimeout(() => { setResults(runMonteCarlo(params)); setRunning(false); }, 80);
  };

  useEffect(() => {
    if (!results || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const W = canvas.offsetWidth; const H = 280;
    canvas.width = W; canvas.height = H;
    const allVals = results.results.flatMap(r => r.curve);
    const minV = Math.min(...allVals, 0); const maxV = Math.max(...allVals, 1); const range = maxV - minV || 1;
    const toX = (t, len) => (t / (len - 1)) * (W - 48) + 24;
    const toY = v => H - 24 - ((v - minV) / range) * (H - 48);
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = "#1e1e30"; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) { const y = 24 + (i / 4) * (H - 48); ctx.beginPath(); ctx.moveTo(24, y); ctx.lineTo(W - 24, y); ctx.stroke(); }
    if (minV < 0 && maxV > 0) {
      ctx.strokeStyle = "#40405a"; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
      const y0 = toY(0); ctx.beginPath(); ctx.moveTo(24, y0); ctx.lineTo(W - 24, y0); ctx.stroke(); ctx.setLineDash([]);
    }
    const step = Math.max(1, Math.floor(results.results.length / 100));
    results.results.forEach((r, idx) => {
      if (idx % step !== 0) return;
      ctx.strokeStyle = r.busted ? "rgba(239,68,68,0.18)" : r.passed ? "rgba(59,130,246,0.18)" : "rgba(99,102,241,0.1)";
      ctx.lineWidth = 1; ctx.beginPath();
      r.curve.forEach((v, t) => { const x = toX(t, r.curve.length); const y = toY(v); t === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
      ctx.stroke();
    });
    const medIdx = Math.floor(results.results.length / 2);
    ctx.strokeStyle = "rgba(99,102,241,0.9)"; ctx.lineWidth = 2.5;
    ctx.beginPath();
    results.results[medIdx].curve.forEach((v, t) => { const x = toX(t, results.results[medIdx].curve.length); const y = toY(v); t === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
    ctx.stroke();
  }, [results]);

  const fmt = n => n >= 0 ? `+$${Math.round(n).toLocaleString()}` : `-$${Math.abs(Math.round(n)).toLocaleString()}`;
  const ev = ((params.winRate / 100 * params.rr - (1 - params.winRate / 100)) * params.riskPerTrade).toFixed(0);

  return (
    <div className="g1">
      <div>
        <div className="page-title">Quant Lab</div>
        <div className="page-sub">Monte Carlo simulation with prop firm rules — 500 randomized equity paths</div>
      </div>
      <div className="g2" style={{ gap: 24, alignItems: "start" }}>
        {/* Config */}
        <div className="g1">
          <div className="card">
            <div className="card-title"><Ic name="target" size={13} /> Trade Model</div>
            <div className="g2">
              <div className="field"><label className="label">Win Rate (%)</label><input className="input" type="number" value={params.winRate} onChange={e => p("winRate")(e.target.value)} /></div>
              <div className="field"><label className="label">Reward / Risk</label><input className="input" type="number" step="0.1" value={params.rr} onChange={e => p("rr")(e.target.value)} /></div>
              <div className="field"><label className="label">Risk / Trade ($)</label><input className="input" type="number" value={params.riskPerTrade} onChange={e => p("riskPerTrade")(e.target.value)} /></div>
              <div className="field"><label className="label">Total Trades</label><input className="input" type="number" value={params.totalTrades} onChange={e => p("totalTrades")(e.target.value)} /></div>
              <div className="field"><label className="label">Trades / Day</label><input className="input" type="number" value={params.tradesPerDay} onChange={e => p("tradesPerDay")(e.target.value)} /></div>
              <div className="field"><label className="label">Variance (±%)</label><input className="input" type="number" value={params.variance} onChange={e => p("variance")(e.target.value)} /></div>
            </div>
            <div style={{ background: "var(--bg2)", borderRadius: 8, padding: "10px 14px", fontSize: 12.5 }}>
              Expected Value: <span className="mono bold" style={{ color: ev >= 0 ? "var(--green)" : "var(--red)" }}>${ev} / trade</span>
            </div>
          </div>
          <div className="card">
            <div className="card-title row-between" style={{ marginBottom: 14 }}>
              <div className="row gap8"><Ic name="guardian" size={13} /> Prop Firm Rules</div>
              <div className={`toggle ${params.propFirmRules ? "on" : ""}`} onClick={() => setParams(p => ({ ...p, propFirmRules: !p.propFirmRules }))} />
            </div>
            {params.propFirmRules && (
              <div className="g2">
                <div className="field"><label className="label">Account Size</label>
                  <select className="select" value={params.accountSize} onChange={e => p("accountSize")(e.target.value)}>
                    {[25000, 50000, 100000, 150000].map(v => <option key={v} value={v}>${v.toLocaleString()}</option>)}
                  </select>
                </div>
                <div className="field"><label className="label">Max Daily Loss</label><input className="input" type="number" value={params.dailyLoss} onChange={e => p("dailyLoss")(e.target.value)} /></div>
                <div className="field"><label className="label">Max Overall DD</label><input className="input" type="number" value={params.maxDD} onChange={e => p("maxDD")(e.target.value)} /></div>
                <div className="field"><label className="label">Profit Target (10%)</label><input className="input" readOnly value={`$${(params.accountSize * 0.1).toLocaleString()}`} style={{ opacity: 0.5 }} /></div>
              </div>
            )}
            <button className="btn btn-primary btn-full" onClick={run} disabled={running}>
              {running ? <><span className="spin">↻</span> Running 500 paths…</> : <><Ic name="play" size={14} /> Run Simulation</>}
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="g1">
          {results ? (
            <>
              <div className="g2">
                {[["Median (P50)", fmt(results.p50), results.p50 >= 0 ? "green" : "red", "50th percentile"],
                  ["Best Case (P90)", fmt(results.p90), "blue", "90th percentile"],
                  ["Worst Case (P10)", fmt(results.p10), results.p10 >= 0 ? "green" : "red", "10th percentile"],
                  ["Average", fmt(results.avg), results.avg >= 0 ? "green" : "red", "Mean of 500 paths"]
                ].map(([label, value, cls, foot]) => (
                  <div key={label} className="stat">
                    <div className="stat-label">{label}</div>
                    <div className={`stat-num ${cls}`}>{value}</div>
                    <div className="stat-foot">{foot}</div>
                  </div>
                ))}
              </div>
              {params.propFirmRules && (
                <div className="g2">
                  <div className="stat">
                    <div className="stat-label">Challenge Pass Rate</div>
                    <div className="stat-num blue">{((results.passed / results.paths) * 100).toFixed(1)}%</div>
                    <div className="stat-foot">{results.passed} of {results.paths} paths passed</div>
                  </div>
                  <div className="stat">
                    <div className="stat-label">Blow-Up Rate</div>
                    <div className={`stat-num ${results.busted / results.paths > 0.3 ? "red" : "yellow"}`}>{((results.busted / results.paths) * 100).toFixed(1)}%</div>
                    <div className="stat-foot">{results.busted} accounts blown</div>
                  </div>
                </div>
              )}
              <div className="card">
                <div className="card-title">Equity Curve Distribution</div>
                <canvas ref={canvasRef} className="mc-canvas" style={{ height: 280 }} />
                <div className="row gap16 mt12 text-xs muted">
                  <span><span style={{ color: "var(--accent)" }}>─</span> Median path</span>
                  <span><span style={{ color: "rgba(59,130,246,0.8)" }}>─</span> Passed challenge</span>
                  <span><span style={{ color: "rgba(239,68,68,0.8)" }}>─</span> Blown account</span>
                </div>
              </div>
            </>
          ) : (
            <div className="card" style={{ minHeight: 320, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div className="empty">
                <div className="empty-icon"><Ic name="quant" size={48} /></div>
                <div className="empty-title">Configure & Run</div>
                <div className="empty-sub">Set your strategy parameters and run the Monte Carlo simulation to explore 500 randomized equity paths.</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── STRATEGY ANALYSIS ────────────────────────────────────────────────────────
function StrategyAnalysis() {
  const [trades, setTrades] = useState(null);
  const [drag, setDrag] = useState(false);

  const parseCSV = text => {
    const lines = text.trim().split("\n");
    if (lines.length < 2) return null;
    const headers = lines[0].split(",").map(h => h.trim().replace(/"/g, "").toLowerCase());
    return lines.slice(1).map((line, idx) => {
      const vals = line.split(",").map(v => v.trim().replace(/"/g, ""));
      const obj = {}; headers.forEach((h, i) => obj[h] = vals[i]);
      const pnl = parseFloat(obj.profit || obj.pnl || obj["net profit"] || obj["net pnl"] || "0");
      return { id: idx + 1, date: obj.date || obj["entry time"] || `Trade ${idx + 1}`, symbol: obj.symbol || obj.market || "NQ", side: obj.type || obj.direction || obj.side || "—", entry: parseFloat(obj["entry price"] || obj.entry || "0"), exit: parseFloat(obj["exit price"] || obj.exit || "0"), contracts: parseInt(obj.qty || obj.contracts || obj.quantity || "1"), pnl, duration: obj.duration || "—" };
    }).filter(t => !isNaN(t.pnl));
  };

  const handleFile = file => {
    const reader = new FileReader();
    reader.onload = e => { const parsed = parseCSV(e.target.result); setTrades(parsed?.length ? parsed : SAMPLE_TRADES); };
    reader.readAsText(file);
  };

  const stats = trades ? (() => {
    const wins = trades.filter(t => t.pnl > 0); const losses = trades.filter(t => t.pnl < 0);
    const totalPnl = trades.reduce((s, t) => s + t.pnl, 0);
    const avgWin = wins.length ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0;
    const avgLoss = losses.length ? Math.abs(losses.reduce((s, t) => s + t.pnl, 0) / losses.length) : 1;
    let peak = 0, dd = 0, maxDD = 0, curStreak = 0, bestStreak = 0, worstStreak = 0;
    trades.forEach(t => { dd = peak - (peak += Math.max(0, t.pnl - peak), peak - t.pnl < 0 ? peak + t.pnl : peak); if (t.pnl > 0) { curStreak = Math.max(0, curStreak) + 1; bestStreak = Math.max(bestStreak, curStreak); } else { curStreak = Math.min(0, curStreak) - 1; worstStreak = Math.min(worstStreak, curStreak); } });
    let run = 0, pk = 0; trades.forEach(t => { run += t.pnl; if (run > pk) pk = run; const d = pk - run; if (d > maxDD) maxDD = d; });
    return { total: trades.length, wins: wins.length, losses: losses.length, winRate: ((wins.length / trades.length) * 100).toFixed(1), totalPnl, avgWin, avgLoss, profitFactor: avgLoss > 0 ? (avgWin / avgLoss).toFixed(2) : "∞", maxDD, bestStreak, worstStreak: Math.abs(worstStreak) };
  })() : null;

  return (
    <div className="g1">
      <div>
        <div className="page-title">Strategy Analysis</div>
        <div className="page-sub">Import your trade history from TradingView, NinjaTrader, MT4/MT5, or any CSV</div>
      </div>
      {!trades ? (
        <>
          <div className={`file-drop ${drag ? "drag" : ""}`}
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            onClick={() => { const inp = document.createElement("input"); inp.type = "file"; inp.accept = ".csv,.htm,.html"; inp.onchange = e => handleFile(e.target.files[0]); inp.click(); }}>
            <div className="file-drop-icon"><Ic name="upload" size={42} stroke="var(--text3)" /></div>
            <div className="file-drop-title">Drop your trade history CSV here</div>
            <div className="file-drop-sub">Supports TradingView · NinjaTrader · MT4/MT5 · Any CSV format</div>
          </div>
          <div className="tip"><Ic name="info" size={14} /><span>Make sure TradingView is set to <strong>English</strong> before exporting. Hebrew UI may cause parse errors.</span></div>
          <button className="btn btn-secondary" style={{ alignSelf: "flex-start" }} onClick={() => setTrades(SAMPLE_TRADES)}><Ic name="eye" size={14} /> Use Sample Data</button>
        </>
      ) : (
        <>
          <div className="g4">
            {[
              ["Total PnL", `${stats.totalPnl >= 0 ? "+" : ""}$${stats.totalPnl.toLocaleString()}`, stats.totalPnl >= 0 ? "green" : "red", `${stats.total} trades`],
              ["Win Rate", `${stats.winRate}%`, parseFloat(stats.winRate) >= 50 ? "green" : "yellow", `${stats.wins}W / ${stats.losses}L`],
              ["Profit Factor", stats.profitFactor, parseFloat(stats.profitFactor) >= 1.5 ? "green" : "yellow", "Avg win / avg loss"],
              ["Max Drawdown", `$${stats.maxDD.toLocaleString()}`, "red", `Best streak: ${stats.bestStreak}`],
            ].map(([label, value, cls, foot]) => (
              <div key={label} className="stat"><div className="stat-label">{label}</div><div className={`stat-num ${cls}`}>{value}</div><div className="stat-foot">{foot}</div></div>
            ))}
          </div>
          <div className="card">
            <div className="row-between mb16">
              <div style={{ fontWeight: 600, fontSize: 14 }}>Trade Log</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setTrades(null)}><Ic name="refresh" size={13} /> New Upload</button>
            </div>
            <div style={{ overflow: "auto", maxHeight: 380 }}>
              <table className="tbl">
                <thead><tr><th>#</th><th>Date</th><th>Symbol</th><th>Side</th><th>Entry</th><th>Exit</th><th>Qty</th><th>Duration</th><th>PnL</th></tr></thead>
                <tbody>
                  {trades.map(t => (
                    <tr key={t.id}>
                      <td className="dim">{t.id}</td>
                      <td>{t.date}</td>
                      <td><span className="badge b-gray">{t.symbol}</span></td>
                      <td><span className={`badge ${t.side?.toLowerCase().includes("long") || t.side?.toLowerCase().includes("buy") ? "b-green" : "b-red"}`}>{t.side}</span></td>
                      <td className="mono">{t.entry || "—"}</td>
                      <td className="mono">{t.exit || "—"}</td>
                      <td className="mono">{t.contracts}</td>
                      <td className="muted">{t.duration}</td>
                      <td className={t.pnl >= 0 ? "profit" : "loss"}>{t.pnl >= 0 ? "+" : ""}${t.pnl.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── TRADING JOURNAL ──────────────────────────────────────────────────────────
function TradingJournal() {
  const [tab, setTab] = useState("challenges");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ firm: "", size: "50000", target: "3000", dailyLoss: "2500", maxDD: "2500", phase: "Challenge" });
  const [challenges, setChallenges] = useState([
    { id: 1, firm: "Apex Trader Funding", size: 50000, target: 3000, pnl: 1840, dailyLoss: 2500, maxDD: 2500, status: "active", phase: "Challenge", trades: 12, startDate: "2026-05-01" },
    { id: 2, firm: "Topstep", size: 50000, target: 3000, pnl: -1200, dailyLoss: 1000, maxDD: 2000, status: "failed", phase: "Challenge", trades: 7, startDate: "2026-04-15" },
  ]);
  const [funded, setFunded] = useState([
    { id: 1, firm: "Apex Trader Funding", size: 150000, pnl: 4200, maxDD: 4500, status: "active", trades: 34, startDate: "2026-03-01" },
  ]);

  const addAccount = () => {
    if (!form.firm) return;
    const newAcc = { id: Date.now(), firm: form.firm, size: parseFloat(form.size), target: parseFloat(form.target), pnl: 0, dailyLoss: parseFloat(form.dailyLoss), maxDD: parseFloat(form.maxDD), status: "active", phase: form.phase, trades: 0, startDate: new Date().toISOString().split("T")[0] };
    if (tab === "challenges") setChallenges(p => [...p, newAcc]);
    else setFunded(p => [...p, newAcc]);
    setShowModal(false);
    setForm({ firm: "", size: "50000", target: "3000", dailyLoss: "2500", maxDD: "2500", phase: "Challenge" });
  };

  const list = tab === "challenges" ? challenges : funded;
  const setList = tab === "challenges" ? setChallenges : setFunded;

  const statusBadge = s => {
    if (s === "active") return <span className="badge b-green">Active</span>;
    if (s === "failed") return <span className="badge b-red">Failed</span>;
    if (s === "passed") return <span className="badge b-blue">Passed</span>;
    return <span className="badge b-gray">{s}</span>;
  };

  const JCard = ({ acc }) => {
    const progress = acc.target ? Math.max(0, Math.min(100, (acc.pnl / acc.target) * 100)) : 0;
    const barColor = acc.status === "failed" ? "red" : acc.status === "passed" ? "blue" : "green";
    const ddUsed = acc.pnl < 0 ? Math.min(100, (Math.abs(acc.pnl) / acc.maxDD) * 100) : 0;
    return (
      <div className="j-card">
        <div className={`j-card-bar ${barColor}`} />
        <div className="j-card-top">
          <div>
            <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 3 }}>{acc.firm}</div>
            <div className="text-xs muted">{acc.phase} · ${acc.size.toLocaleString()} · Started {acc.startDate}</div>
          </div>
          <div className="row gap8 f0">
            {statusBadge(acc.status)}
            <button className="btn btn-danger btn-sm" style={{ padding: "4px 8px" }} onClick={() => setList(prev => prev.filter(a => a.id !== acc.id))}><Ic name="trash" size={12} /></button>
          </div>
        </div>
        <div className="j-card-body">
          {acc.target && (
            <>
              <div className="row-between text-xs muted mb6">
                <span>Profit Target</span>
                <span className={`mono bold ${acc.pnl >= 0 ? "green" : "red"}`}>{acc.pnl >= 0 ? "+" : ""}${acc.pnl.toLocaleString()} / ${acc.target.toLocaleString()}</span>
              </div>
              <div className="progress-track mb12"><div className={`progress-fill ${acc.pnl >= 0 ? "green" : "red"}`} style={{ width: `${Math.abs(progress)}%` }} /></div>
            </>
          )}
          {ddUsed > 0 && (
            <>
              <div className="row-between text-xs muted mb6"><span>Drawdown Used</span><span className="mono bold red">{ddUsed.toFixed(1)}%</span></div>
              <div className="progress-track mb12"><div className="progress-fill red" style={{ width: `${ddUsed}%` }} /></div>
            </>
          )}
          <hr />
          <div className="g3" style={{ gap: 8 }}>
            <div><div className="text-xs dim mb4">Trades</div><div className="mono bold">{acc.trades}</div></div>
            <div><div className="text-xs dim mb4">Daily Limit</div><div className="mono bold">${acc.dailyLoss?.toLocaleString() ?? "—"}</div></div>
            <div><div className="text-xs dim mb4">Max DD</div><div className="mono bold">${acc.maxDD?.toLocaleString() ?? "—"}</div></div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="g1">
      <div className="row-between">
        <div>
          <div className="page-title">Trading Journal</div>
          <div className="page-sub">Track prop firm challenges and funded accounts</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}><Ic name="plus" size={14} /> New Account</button>
      </div>

      <div className="tabs">
        <div className={`tab ${tab === "challenges" ? "active" : ""}`} onClick={() => setTab("challenges")}>Challenges ({challenges.length})</div>
        <div className={`tab ${tab === "funded"    ? "active" : ""}`} onClick={() => setTab("funded")}>Funded ({funded.length})</div>
      </div>

      {list.length === 0 ? (
        <div className="empty">
          <div className="empty-icon"><Ic name="journal" size={48} /></div>
          <div className="empty-title">No accounts yet</div>
          <div className="empty-sub">Create your first prop firm account to start tracking your challenge progress.</div>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}><Ic name="plus" size={14} /> Create Account</button>
        </div>
      ) : (
        <div className="g2">
          {list.map(acc => <JCard key={acc.id} acc={acc} />)}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-title">New Account</div>
            <div className="g2">
              <div className="field" style={{ gridColumn: "1/-1" }}>
                <label className="label">Account Name</label>
                <input className="input" placeholder="e.g. Apex $100k #2" value={form.firm} onChange={e => setForm(f => ({ ...f, firm: e.target.value }))} />
              </div>
              <div className="field">
                <label className="label">Prop Firm</label>
                <input className="input" placeholder="e.g. FTMO" />
              </div>
              <div className="field">
                <label className="label">Phase</label>
                <select className="select" value={form.phase} onChange={e => setForm(f => ({ ...f, phase: e.target.value }))}>
                  <option>Challenge</option><option>Funded</option><option>PA (Payout)</option>
                </select>
              </div>
              <div className="field">
                <label className="label">Account Size ($)</label>
                <select className="select" value={form.size} onChange={e => setForm(f => ({ ...f, size: e.target.value }))}>
                  {[25000, 50000, 100000, 150000].map(v => <option key={v} value={v}>${v.toLocaleString()}</option>)}
                </select>
              </div>
              <div className="field">
                <label className="label">Profit Target ($)</label>
                <input className="input" type="number" value={form.target} onChange={e => setForm(f => ({ ...f, target: e.target.value }))} />
              </div>
              <div className="field">
                <label className="label">Max Daily Loss ($)</label>
                <input className="input" type="number" value={form.dailyLoss} onChange={e => setForm(f => ({ ...f, dailyLoss: e.target.value }))} />
              </div>
              <div className="field">
                <label className="label">Max Overall DD ($)</label>
                <input className="input" type="number" value={form.maxDD} onChange={e => setForm(f => ({ ...f, maxDD: e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addAccount}><Ic name="check" size={14} /> Create Account</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SETTINGS ─────────────────────────────────────────────────────────────────
function Settings() {
  const [coachCode, setCoachCode] = useState("");
  const [studentCode, setStudentCode] = useState("");
  const [plan] = useState("free");

  const usage = [
    { label: "Uploads",        used: 0, max: 5,   icon: "upload" },
    { label: "Journal Accounts",used: 1, max: 1,  icon: "journal" },
    { label: "Coach Messages", used: 0, max: 20,  icon: "coach" },
  ];

  return (
    <div className="g1" style={{ maxWidth: 680 }}>
      <div>
        <div className="page-title">Settings</div>
        <div className="page-sub">Manage your account, plan, and preferences</div>
      </div>

      {/* Profile */}
      <div className="settings-section">
        <div className="settings-head">
          <Ic name="user" size={15} stroke="var(--text2)" />
          <div>
            <div className="settings-head-title">Profile</div>
          </div>
        </div>
        <div className="settings-row">
          <div><div className="settings-row-label">Name</div></div>
          <div className="settings-val">Itay Malka</div>
        </div>
        <div className="settings-row">
          <div><div className="settings-row-label">Email</div></div>
          <div className="settings-val">itay114567@gmail.com</div>
        </div>
      </div>

      {/* Plan */}
      <div className="settings-section">
        <div className="settings-head">
          <Ic name="crown" size={15} stroke="var(--yellow)" />
          <div>
            <div className="settings-head-title">Plan & Usage</div>
            <div className="settings-head-sub">You're on the Free tier</div>
          </div>
        </div>
        <div className="settings-row">
          <div>
            <div className="settings-row-label">Current Plan</div>
            <div className="settings-row-sub">Free Tier — limited features</div>
          </div>
          <div className="row gap8">
            <button className="btn btn-primary btn-sm" style={{ background: "linear-gradient(135deg, var(--accent), #8b5cf6)" }}>Monthly — $29/mo</button>
            <button className="btn btn-ghost btn-sm">Annual — $249/yr <span style={{ color: "var(--green)", marginLeft: 4 }}>Save 28%</span></button>
          </div>
        </div>
        {usage.map(u => (
          <div key={u.label} className="settings-row">
            <div>
              <div className="settings-row-label">{u.label}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="text-sm muted" style={{ marginBottom: 6 }}>{u.used} / {u.max}</div>
              <div className="usage-bar"><div className="usage-fill" style={{ width: `${(u.used / u.max) * 100}%` }} /></div>
            </div>
          </div>
        ))}
      </div>

      {/* Coach */}
      <div className="settings-section">
        <div className="settings-head">
          <Ic name="coach" size={15} stroke="var(--accent-h)" />
          <div>
            <div className="settings-head-title">Become a Coach</div>
            <div className="settings-head-sub">Create your coach code and share trades with your community</div>
          </div>
        </div>
        <div className="settings-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: 12 }}>
          <div className="text-sm muted">Free coaches can connect up to 5 students. Generate your code below.</div>
          <button className="btn btn-primary btn-sm"><Ic name="star" size={13} /> Create My Coach Code</button>
        </div>
      </div>

      {/* Coaching (join) */}
      <div className="settings-section">
        <div className="settings-head">
          <Ic name="link" size={15} stroke="var(--text2)" />
          <div>
            <div className="settings-head-title">Join a Coach</div>
            <div className="settings-head-sub">Enter a coach code to connect</div>
          </div>
        </div>
        <div className="settings-row">
          <input className="input" style={{ maxWidth: 240, marginRight: 10 }} placeholder="e.g. AVI19" value={studentCode} onChange={e => setStudentCode(e.target.value)} />
          <button className="btn btn-primary btn-sm">Connect</button>
        </div>
      </div>
    </div>
  );
}

// ─── APP SHELL ─────────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage]           = useState("dashboard");
  const [collapsed, setCollapsed] = useState(false);

  const NAV = [
    { section: null },
    { id: "dashboard", icon: "dashboard", label: "Dashboard" },
    { section: "Trading Tools" },
    { id: "ai",        icon: "ai",        label: "AI Builder",  badge: "NEW" },
    { id: "quant",     icon: "quant",     label: "Quant Lab" },
    { id: "analysis",  icon: "analysis",  label: "Analysis" },
    { id: "journal",   icon: "journal",   label: "Journal" },
    { section: "Performance" },
    { id: "coach",    icon: "coach",     label: "Coach Edge" },
    { id: "guardian", icon: "guardian",  label: "Guardian" },
    { section: "Account" },
    { id: "settings", icon: "settings",  label: "Settings" },
  ];

  const PAGE_TITLE = { dashboard: "Dashboard", ai: "AI Builder", quant: "Quant Lab", analysis: "Strategy Analysis", journal: "Trading Journal", coach: "Coach Edge", guardian: "Trading Guardian", settings: "Settings" };

  const isFullHeight = page === "ai" || page === "coach";

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        {/* Sidebar */}
        <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
          <div className="sidebar-logo">
            <div className="logo-mark"><Ic name="bolt" size={16} stroke="white" sw={2} /></div>
            <div className="logo-name">Trade<em>Forge</em></div>
          </div>

          <button className="upgrade-btn" onClick={() => setPage("settings")}>
            <Ic name="crown" size={14} stroke="white" sw={2} />
            <span>Upgrade to Pro</span>
          </button>

          <nav className="nav">
            {NAV.map((item, i) => {
              if (item.section !== undefined && !item.id) {
                return item.section ? <div key={i} className="nav-section">{item.section}</div> : <div key={i} style={{ height: 4 }} />;
              }
              return (
                <div key={item.id} className={`nav-item ${page === item.id ? "active" : ""}`} onClick={() => setPage(item.id)}>
                  <span className="nav-icon"><Ic name={item.icon} size={17} /></span>
                  <span className="nav-label">{item.label}</span>
                  {item.badge && <span className="nav-badge">{item.badge}</span>}
                </div>
              );
            })}
          </nav>

          <div className="sidebar-footer">
            <div className="user-avatar">I</div>
            <div className="user-info f1">
              <div className="user-name">Itay Malka</div>
              <div className="user-plan">Free Tier</div>
            </div>
            <div className="collapse-btn" onClick={() => setCollapsed(c => !c)}>
              <Ic name={collapsed ? "chevronRight" : "chevronLeft"} size={12} />
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="main">
          <div className="topbar">
            <div className="topbar-left">
              <span className="topbar-breadcrumb">TradeForge</span>
              <span className="topbar-breadcrumb" style={{ color: "var(--border2)" }}>/</span>
              <span className="topbar-title">{PAGE_TITLE[page]}</span>
            </div>
            <div className="topbar-right">
              <div className="status-pill">
                <div className="status-dot" />
                <span>NQ Futures · UTC+3</span>
              </div>
            </div>
          </div>

          {isFullHeight ? (
            <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
              {page === "ai"    && <AIBuilder />}
              {page === "coach" && <CoachEdge />}
            </div>
          ) : (
            <div className="content">
              {page === "dashboard" && <Dashboard setPage={setPage} />}
              {page === "quant"     && <QuantLab />}
              {page === "analysis"  && <StrategyAnalysis />}
              {page === "journal"   && <TradingJournal />}
              {page === "guardian"  && <TradingGuardian />}
              {page === "settings"  && <Settings />}
            </div>
          )}
        </main>
      </div>
    </>
  );
}
