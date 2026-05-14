import { useState, useEffect, useRef, useCallback } from "react";

// ─── ICONS ───────────────────────────────────────────────────────────────────
const Icon = ({ d, size = 18, stroke = "currentColor", fill = "none" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const Icons = {
  cpu: "M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18",
  chart: "M3 3v18h18M7 16l4-4 4 4 4-8",
  beaker: "M9 3H5L3 7v13h18V7l-2-4h-4M9 3h6M9 3v4m6-4v4M3 7h18",
  journal: "M4 6h16M4 10h16M4 14h10",
  bot: "M12 2a2 2 0 012 2v1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1v8a2 2 0 01-2 2H8a2 2 0 01-2-2V10H5a1 1 0 01-1-1V6a1 1 0 011-1h3V4a2 2 0 012-2zm-2 8v6m4-6v6",
  send: "M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z",
  upload: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12",
  play: "M5 3l14 9-14 9V3z",
  plus: "M12 5v14M5 12h14",
  trash: "M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6",
  zap: "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  check: "M20 6L9 17l-5-5",
  x: "M18 6L6 18M6 6l12 12",
  settings: "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z",
  menu: "M3 12h18M3 6h18M3 18h18",
  chevron: "M9 18l6-6-6-6",
  info: "M12 16v-4M12 8h.01M12 22a10 10 0 100-20 10 10 0 000 20z",
  target: "M12 22a10 10 0 100-20 10 10 0 000 20zM12 18a6 6 0 100-12 6 6 0 000 12zM12 14a2 2 0 100-4 2 2 0 000 4z",
  trending: "M23 6l-9.5 9.5-5-5L1 18",
  award: "M12 15a7 7 0 100-14 7 7 0 000 14zM8.21 13.89L7 23l5-3 5 3-1.21-9.12",
  eye: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 100 6 3 3 0 000-6z",
  code: "M16 18l6-6-6-6M8 6l-6 6 6 6",
  refresh: "M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15",
};
const Ic = ({ name, size, stroke, fill }) => <Icon d={Icons[name]} size={size} stroke={stroke} fill={fill} />;

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function randomNormal(mean = 0, std = 1) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function runMonteCarlo({ winRate, rr, riskPerTrade, totalTrades, variance, propFirmRules, accountSize, dailyLoss, maxDD, tradesPerDay }) {
  const paths = 500;
  const results = [];
  let busted = 0;
  let passed = 0;
  const profitTarget = propFirmRules ? accountSize * 0.1 : Infinity;

  for (let p = 0; p < paths; p++) {
    let equity = 0;
    let peakEquity = 0;
    let dayPnL = 0;
    let tradesInDay = 0;
    let bustedPath = false;
    let passedPath = false;
    const curve = [0];

    for (let t = 0; t < totalTrades; t++) {
      if (tradesInDay >= tradesPerDay) { tradesInDay = 0; dayPnL = 0; }
      const win = Math.random() < winRate / 100;
      const noiseMultiplier = 1 + randomNormal(0, variance / 100);
      const pnl = win
        ? riskPerTrade * rr * Math.max(0.1, noiseMultiplier)
        : -riskPerTrade * Math.max(0.1, Math.abs(noiseMultiplier));

      equity += pnl;
      dayPnL += pnl;
      tradesInDay++;
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
  const p10 = finals[Math.floor(finals.length * 0.1)];
  const p50 = finals[Math.floor(finals.length * 0.5)];
  const p90 = finals[Math.floor(finals.length * 0.9)];

  return { results, avg, p10, p50, p90, busted, passed, paths };
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #080c10;
    --surface: #0d1117;
    --surface2: #161b22;
    --surface3: #1c2330;
    --border: #21262d;
    --border2: #30363d;
    --accent: #00ff88;
    --accent2: #00d4ff;
    --accent3: #ff6b35;
    --warn: #f0b429;
    --danger: #ff4757;
    --text: #e6edf3;
    --text2: #8b949e;
    --text3: #484f58;
    --font: 'Syne', sans-serif;
    --mono: 'JetBrains Mono', monospace;
    --radius: 10px;
    --shadow: 0 8px 32px rgba(0,0,0,0.5);
  }
  html, body, #root { height: 100%; background: var(--bg); color: var(--text); font-family: var(--font); }
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 4px; }

  .app { display: flex; height: 100vh; overflow: hidden; }

  /* SIDEBAR */
  .sidebar {
    width: 220px; min-width: 220px; background: var(--surface);
    border-right: 1px solid var(--border); display: flex; flex-direction: column;
    transition: width 0.3s; z-index: 10;
  }
  .sidebar.collapsed { width: 64px; min-width: 64px; }
  .logo {
    padding: 20px 16px; display: flex; align-items: center; gap: 10px;
    border-bottom: 1px solid var(--border);
  }
  .logo-icon {
    width: 32px; height: 32px; border-radius: 8px;
    background: linear-gradient(135deg, var(--accent), var(--accent2));
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .logo-text { font-size: 16px; font-weight: 800; letter-spacing: -0.5px; white-space: nowrap; overflow: hidden; }
  .logo-text span { color: var(--accent); }
  .nav { flex: 1; padding: 12px 8px; overflow-y: auto; }
  .nav-item {
    display: flex; align-items: center; gap: 12px; padding: 10px 10px;
    border-radius: 8px; cursor: pointer; transition: all 0.15s;
    color: var(--text2); font-size: 13.5px; font-weight: 600;
    white-space: nowrap; overflow: hidden; position: relative;
  }
  .nav-item:hover { background: var(--surface2); color: var(--text); }
  .nav-item.active { background: rgba(0,255,136,0.1); color: var(--accent); }
  .nav-item .nav-icon { flex-shrink: 0; }
  .nav-badge {
    margin-left: auto; background: var(--accent); color: var(--bg);
    font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 20px;
  }
  .nav-section { font-size: 10px; font-weight: 700; color: var(--text3); text-transform: uppercase;
    letter-spacing: 1.5px; padding: 16px 10px 6px; white-space: nowrap; overflow: hidden; }
  .collapse-btn {
    padding: 12px; border-top: 1px solid var(--border); display: flex;
    align-items: center; justify-content: center; cursor: pointer; color: var(--text2);
  }
  .collapse-btn:hover { color: var(--text); }

  /* MAIN */
  .main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
  .topbar {
    padding: 0 24px; height: 56px; border-bottom: 1px solid var(--border);
    display: flex; align-items: center; gap: 12px; background: var(--surface);
    flex-shrink: 0;
  }
  .topbar-title { font-size: 15px; font-weight: 700; flex: 1; }
  .topbar-title span { color: var(--text2); font-weight: 400; font-size: 13px; margin-left: 8px; }
  .tab-pills { display: flex; gap: 4px; background: var(--bg); border-radius: 8px; padding: 3px; }
  .tab-pill {
    padding: 5px 14px; border-radius: 6px; font-size: 12px; font-weight: 600;
    cursor: pointer; color: var(--text2); transition: all 0.15s;
  }
  .tab-pill.active { background: var(--surface2); color: var(--text); }

  .content { flex: 1; overflow-y: auto; padding: 24px; }

  /* CARDS */
  .card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 20px;
  }
  .card-title { font-size: 13px; font-weight: 700; color: var(--text2); text-transform: uppercase;
    letter-spacing: 1px; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
  .card-title .accent { color: var(--accent); }

  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
  .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
  .gap-16 { display: flex; flex-direction: column; gap: 16px; }

  /* STAT CARDS */
  .stat-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 16px 20px;
  }
  .stat-label { font-size: 11px; font-weight: 600; color: var(--text2); text-transform: uppercase; letter-spacing: 1px; }
  .stat-value { font-size: 26px; font-weight: 800; font-family: var(--mono); margin: 4px 0; }
  .stat-value.green { color: var(--accent); }
  .stat-value.red { color: var(--danger); }
  .stat-value.blue { color: var(--accent2); }
  .stat-value.orange { color: var(--accent3); }
  .stat-sub { font-size: 11px; color: var(--text2); }

  /* INPUTS */
  .input-group { margin-bottom: 14px; }
  .input-label { font-size: 11px; font-weight: 600; color: var(--text2); text-transform: uppercase;
    letter-spacing: 0.8px; margin-bottom: 6px; display: block; }
  .input {
    width: 100%; background: var(--bg); border: 1px solid var(--border2);
    border-radius: 8px; padding: 9px 12px; color: var(--text); font-family: var(--mono);
    font-size: 13px; outline: none; transition: border-color 0.15s;
  }
  .input:focus { border-color: var(--accent); }
  .select {
    width: 100%; background: var(--bg); border: 1px solid var(--border2);
    border-radius: 8px; padding: 9px 12px; color: var(--text);
    font-family: var(--font); font-size: 13px; outline: none; cursor: pointer;
    appearance: none;
  }
  .select:focus { border-color: var(--accent); }

  /* BUTTONS */
  .btn {
    display: inline-flex; align-items: center; gap: 8px; padding: 9px 18px;
    border-radius: 8px; font-family: var(--font); font-size: 13px; font-weight: 700;
    cursor: pointer; border: none; transition: all 0.15s; outline: none;
  }
  .btn-primary { background: var(--accent); color: var(--bg); }
  .btn-primary:hover { background: #00e67a; transform: translateY(-1px); }
  .btn-secondary { background: var(--surface2); color: var(--text); border: 1px solid var(--border2); }
  .btn-secondary:hover { border-color: var(--border2); background: var(--surface3); }
  .btn-danger { background: rgba(255,71,87,0.15); color: var(--danger); border: 1px solid rgba(255,71,87,0.3); }
  .btn-danger:hover { background: rgba(255,71,87,0.25); }
  .btn-sm { padding: 6px 12px; font-size: 12px; }
  .btn-full { width: 100%; justify-content: center; }
  .btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

  /* CHAT */
  .chat-wrap { display: flex; flex-direction: column; height: 100%; }
  .chat-header { padding: 0 24px 16px; flex-shrink: 0; }
  .chat-messages {
    flex: 1; overflow-y: auto; padding: 0 24px; display: flex; flex-direction: column; gap: 16px;
  }
  .msg { display: flex; gap: 12px; animation: fadeUp 0.2s ease; }
  .msg.user { flex-direction: row-reverse; }
  .msg-avatar {
    width: 32px; height: 32px; border-radius: 8px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700;
  }
  .msg-avatar.ai { background: linear-gradient(135deg, var(--accent), var(--accent2)); color: var(--bg); }
  .msg-avatar.user { background: var(--surface3); color: var(--text); }
  .msg-bubble {
    max-width: 75%; padding: 12px 16px; border-radius: 12px;
    font-size: 13.5px; line-height: 1.65;
  }
  .msg-bubble.ai { background: var(--surface); border: 1px solid var(--border); }
  .msg-bubble.user { background: rgba(0,255,136,0.1); border: 1px solid rgba(0,255,136,0.2); }
  .msg-bubble pre {
    background: var(--bg); border: 1px solid var(--border2); border-radius: 6px;
    padding: 12px; margin-top: 8px; font-family: var(--mono); font-size: 12px;
    overflow-x: auto; white-space: pre-wrap;
  }
  .code-header {
    display: flex; align-items: center; justify-content: space-between;
    background: var(--surface2); padding: 6px 12px; border-radius: 6px 6px 0 0;
    font-size: 11px; color: var(--text2); font-family: var(--mono);
    margin-top: 10px; border: 1px solid var(--border2); border-bottom: none;
  }
  .code-block {
    background: var(--bg); border: 1px solid var(--border2); border-top: none;
    border-radius: 0 0 6px 6px; padding: 12px; font-family: var(--mono);
    font-size: 12px; overflow-x: auto; white-space: pre-wrap; color: #a5d6ff;
    line-height: 1.6; margin-bottom: 10px;
  }
  .chat-input-area {
    padding: 16px 24px; border-top: 1px solid var(--border); flex-shrink: 0; background: var(--surface);
  }
  .chat-model-bar {
    display: flex; gap: 8px; margin-bottom: 10px; flex-wrap: wrap;
  }
  .model-chip {
    padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600;
    cursor: pointer; border: 1px solid var(--border2); color: var(--text2);
    background: var(--bg); transition: all 0.15s;
  }
  .model-chip.active { border-color: var(--accent); color: var(--accent); background: rgba(0,255,136,0.08); }
  .chat-input-row { display: flex; gap: 8px; }
  .chat-textarea {
    flex: 1; background: var(--bg); border: 1px solid var(--border2); border-radius: 8px;
    padding: 10px 14px; color: var(--text); font-family: var(--font); font-size: 13px;
    outline: none; resize: none; transition: border-color 0.15s; min-height: 42px; max-height: 120px;
  }
  .chat-textarea:focus { border-color: var(--accent); }

  /* MONTE CARLO CHART */
  .mc-canvas { width: 100%; border-radius: 8px; background: var(--bg); }
  .progress-bar {
    height: 6px; background: var(--surface2); border-radius: 3px; overflow: hidden; margin-top: 8px;
  }
  .progress-fill {
    height: 100%; border-radius: 3px;
    background: linear-gradient(90deg, var(--accent), var(--accent2));
    transition: width 0.3s;
  }

  /* JOURNAL */
  .challenge-card {
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
    padding: 16px; position: relative; overflow: hidden;
  }
  .challenge-card::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
  }
  .challenge-card.active::before { background: var(--accent); }
  .challenge-card.failed::before { background: var(--danger); }
  .challenge-card.passed::before { background: var(--accent2); }
  .challenge-name { font-size: 14px; font-weight: 700; margin-bottom: 4px; }
  .challenge-meta { font-size: 11px; color: var(--text2); margin-bottom: 12px; }
  .pnl-bar { height: 5px; background: var(--surface2); border-radius: 3px; margin: 6px 0; }
  .pnl-fill { height: 100%; border-radius: 3px; transition: width 0.6s; }
  .pnl-fill.profit { background: var(--accent); }
  .pnl-fill.loss { background: var(--danger); }
  .metric-row { display: flex; justify-content: space-between; font-size: 12px; color: var(--text2); margin: 3px 0; }
  .metric-row span:last-child { color: var(--text); font-family: var(--mono); font-weight: 600; }

  /* STRATEGY ANALYSIS */
  .file-drop {
    border: 2px dashed var(--border2); border-radius: var(--radius); padding: 40px;
    text-align: center; cursor: pointer; transition: all 0.2s; background: var(--bg);
  }
  .file-drop:hover, .file-drop.drag { border-color: var(--accent); background: rgba(0,255,136,0.04); }
  .file-drop-icon { color: var(--text3); margin-bottom: 12px; }
  .file-drop-title { font-size: 14px; font-weight: 600; color: var(--text); margin-bottom: 4px; }
  .file-drop-sub { font-size: 12px; color: var(--text2); }

  .trade-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  .trade-table th {
    padding: 8px 12px; text-align: left; font-size: 10px; font-weight: 700;
    color: var(--text3); text-transform: uppercase; letter-spacing: 1px;
    border-bottom: 1px solid var(--border);
  }
  .trade-table td { padding: 9px 12px; border-bottom: 1px solid var(--border); color: var(--text2); }
  .trade-table tr:hover td { background: var(--surface2); }
  .trade-table td.profit { color: var(--accent); font-family: var(--mono); font-weight: 600; }
  .trade-table td.loss { color: var(--danger); font-family: var(--mono); font-weight: 600; }

  /* TOGGLE */
  .toggle-wrap { display: flex; align-items: center; gap: 10px; cursor: pointer; }
  .toggle { width: 36px; height: 20px; background: var(--surface2); border-radius: 20px;
    position: relative; transition: background 0.2s; flex-shrink: 0; }
  .toggle.on { background: var(--accent); }
  .toggle::after { content: ''; position: absolute; top: 3px; left: 3px; width: 14px; height: 14px;
    background: white; border-radius: 50%; transition: transform 0.2s; }
  .toggle.on::after { transform: translateX(16px); }
  .toggle-label { font-size: 13px; color: var(--text2); font-weight: 600; }

  /* ANIMATIONS */
  @keyframes fadeUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
  @keyframes spin { to { transform: rotate(360deg); } }
  .loading-dot { animation: pulse 1.2s infinite; }
  .spin { animation: spin 0.8s linear infinite; }

  /* EMPTY STATE */
  .empty-state { text-align: center; padding: 48px 20px; color: var(--text2); }
  .empty-icon { margin-bottom: 12px; opacity: 0.3; }
  .empty-title { font-size: 15px; font-weight: 700; color: var(--text); margin-bottom: 6px; }
  .empty-sub { font-size: 13px; color: var(--text2); }

  /* BADGE */
  .badge {
    display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px;
    border-radius: 4px; font-size: 11px; font-weight: 700;
  }
  .badge-green { background: rgba(0,255,136,0.15); color: var(--accent); }
  .badge-red { background: rgba(255,71,87,0.15); color: var(--danger); }
  .badge-blue { background: rgba(0,212,255,0.15); color: var(--accent2); }
  .badge-orange { background: rgba(255,107,53,0.15); color: var(--accent3); }
  .badge-gray { background: var(--surface2); color: var(--text2); }

  .divider { border: none; border-top: 1px solid var(--border); margin: 16px 0; }
  .flex { display: flex; }
  .items-center { align-items: center; }
  .justify-between { justify-content: space-between; }
  .gap-8 { gap: 8px; }
  .gap-12 { gap: 12px; }
  .mt-4 { margin-top: 4px; }
  .mt-8 { margin-top: 8px; }
  .mt-12 { margin-top: 12px; }
  .mt-16 { margin-top: 16px; }
  .mb-4 { margin-bottom: 4px; }
  .mb-8 { margin-bottom: 8px; }
  .mb-12 { margin-bottom: 12px; }
  .mb-16 { margin-bottom: 16px; }
  .text-sm { font-size: 12px; }
  .text-xs { font-size: 11px; }
  .text-muted { color: var(--text2); }
  .text-mono { font-family: var(--mono); }
  .font-bold { font-weight: 700; }
  .w-full { width: 100%; }

  .section-title {
    font-size: 18px; font-weight: 800; margin-bottom: 4px; letter-spacing: -0.3px;
  }
  .section-sub { font-size: 13px; color: var(--text2); margin-bottom: 24px; }
  .tip-box {
    background: rgba(240,180,41,0.08); border: 1px solid rgba(240,180,41,0.2);
    border-radius: 8px; padding: 10px 14px; font-size: 12px; color: var(--warn);
    display: flex; align-items: flex-start; gap: 8px;
  }

  @media (max-width: 900px) {
    .sidebar { width: 64px; min-width: 64px; }
    .logo-text, .nav-item span, .nav-badge, .nav-section { display: none; }
    .grid-4 { grid-template-columns: 1fr 1fr; }
    .grid-3 { grid-template-columns: 1fr 1fr; }
  }
  @media (max-width: 600px) {
    .grid-2, .grid-3, .grid-4 { grid-template-columns: 1fr; }
    .content { padding: 16px; }
  }
`;

// ─── DUMMY DATA ───────────────────────────────────────────────────────────────
const SAMPLE_TRADES = [
  { id: 1, date: "2025-05-01", symbol: "NQ", side: "Long", entry: 19240, exit: 19280, contracts: 1, pnl: 800, duration: "14m" },
  { id: 2, date: "2025-05-01", symbol: "NQ", side: "Short", entry: 19310, exit: 19350, contracts: 1, pnl: -800, duration: "8m" },
  { id: 3, date: "2025-05-02", symbol: "NQ", side: "Long", entry: 19180, exit: 19240, contracts: 2, pnl: 2400, duration: "32m" },
  { id: 4, date: "2025-05-02", symbol: "ES", side: "Short", entry: 5280, exit: 5270, contracts: 1, pnl: 500, duration: "22m" },
  { id: 5, date: "2025-05-03", symbol: "NQ", side: "Long", entry: 19300, exit: 19260, contracts: 1, pnl: -800, duration: "5m" },
  { id: 6, date: "2025-05-05", symbol: "NQ", side: "Short", entry: 19420, exit: 19360, contracts: 2, pnl: 2400, duration: "18m" },
  { id: 7, date: "2025-05-06", symbol: "NQ", side: "Long", entry: 19280, exit: 19320, contracts: 1, pnl: 800, duration: "41m" },
  { id: 8, date: "2025-05-07", symbol: "ES", side: "Long", entry: 5260, exit: 5250, contracts: 1, pnl: -500, duration: "12m" },
];

// ─── AI CHAT MODULE ────────────────────────────────────────────────────────────
function AIChat() {
  const MODEL_OPTIONS = [
    { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4.6", provider: "anthropic" },
    { id: "claude-opus-4-20250514", label: "Claude Opus 4.6", provider: "anthropic" },
    { id: "gpt-4o", label: "GPT-4o", provider: "openai" },
    { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", provider: "google" },
  ];

  const [model, setModel] = useState(MODEL_OPTIONS[0]);
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hey! I'm your AI trading assistant. I can write Pine Script strategies, analyze your setups, explain ICT concepts, or help with any trading question.\n\nTry: *\"Write a Pine Script v6 NQ strategy using SMT divergence and IFVG entries\"*" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const formatMsg = (text) => {
    const parts = text.split(/(```[\s\S]*?```|\*[^*]+\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("```") && part.endsWith("```")) {
        const inner = part.slice(3, -3);
        const nl = inner.indexOf("\n");
        const lang = nl > -1 ? inner.slice(0, nl) : "pine";
        const code = nl > -1 ? inner.slice(nl + 1) : inner;
        return (
          <div key={i}>
            <div className="code-header"><span>{lang || "pinescript"}</span><span style={{ opacity: 0.6 }}>Pine Script v6</span></div>
            <div className="code-block">{code}</div>
          </div>
        );
      }
      if (part.startsWith("*") && part.endsWith("*")) return <em key={i} style={{ color: "var(--accent)", fontStyle: "normal", fontWeight: 600 }}>{part.slice(1, -1)}</em>;
      return <span key={i}>{part}</span>;
    });
  };

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    const systemPrompt = `You are an expert algorithmic trading assistant specializing in Pine Script v6, ICT concepts (SMT, IFVG, CISD, liquidity sweeps), NQ/ES futures, and prop firm trading strategies. When writing Pine Script, always use v6 syntax and include proper strategy() or indicator() calls. Format code blocks with triple backticks and 'pinescript' as the language label.`;

    try {
      const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey && { "x-api-key": apiKey }),
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: systemPrompt,
          messages: [
            ...messages.filter(m => m.role !== "assistant" || messages.indexOf(m) > 0).map(m => ({
              role: m.role, content: m.content
            })),
            { role: "user", content: userMsg }
          ]
        })
      });
      const data = await res.json();
      const reply = data.content?.[0]?.text || "Sorry, I couldn't process that.";
      setMessages(prev => [...prev, {
        role: "assistant",
        content: reply,
        model: model.label
      }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "⚠️ Connection error. Check API key in settings." }]);
    }
    setLoading(false);
  };

  const quickPrompts = [
    "Write NQ SMT + IFVG Pine Script v6",
    "Explain ICT CISD concept",
    "Add trailing stop to my strategy",
    "Best session times for NQ futures",
  ];

  return (
    <div className="chat-wrap">
      <div className="chat-header">
        <div className="section-title">AI Strategy Builder</div>
        <div className="section-sub">Write Pine Script, analyze setups, learn ICT — powered by leading AI models</div>
        <div className="chat-model-bar">
          {MODEL_OPTIONS.map(m => (
            <div key={m.id} className={`model-chip ${model.id === m.id ? "active" : ""}`} onClick={() => setModel(m)}>
              {m.label}
            </div>
          ))}
        </div>
      </div>
      <div className="chat-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`msg ${msg.role === "user" ? "user" : ""}`}>
            <div className={`msg-avatar ${msg.role === "user" ? "user" : "ai"}`}>
              {msg.role === "user" ? "U" : "AI"}
            </div>
            <div className={`msg-bubble ${msg.role === "user" ? "user" : "ai"}`}>
              {msg.model && <div style={{ fontSize: 10, color: "var(--text3)", marginBottom: 6, fontFamily: "var(--mono)" }}>{msg.model}</div>}
              {formatMsg(msg.content)}
            </div>
          </div>
        ))}
        {loading && (
          <div className="msg">
            <div className="msg-avatar ai">AI</div>
            <div className="msg-bubble ai">
              <span className="loading-dot">●</span>&nbsp;
              <span className="loading-dot" style={{ animationDelay: "0.2s" }}>●</span>&nbsp;
              <span className="loading-dot" style={{ animationDelay: "0.4s" }}>●</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      {messages.length <= 1 && (
        <div style={{ padding: "0 24px 12px", display: "flex", gap: 8, flexWrap: "wrap" }}>
          {quickPrompts.map(p => (
            <button key={p} className="btn btn-secondary btn-sm" onClick={() => { setInput(p); }}>
              {p}
            </button>
          ))}
        </div>
      )}
      <div className="chat-input-area">
        <div className="chat-input-row">
          <textarea
            className="chat-textarea"
            placeholder="Ask anything about trading, Pine Script, ICT concepts..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            rows={1}
          />
          <button className="btn btn-primary" onClick={send} disabled={loading || !input.trim()}>
            <Ic name="send" size={16} />
          </button>
        </div>
        <div className="text-xs text-muted mt-4">Enter to send · Shift+Enter for newline · Currently using: <strong style={{ color: "var(--accent)" }}>{model.label}</strong></div>
      </div>
    </div>
  );
}

// ─── MONTE CARLO MODULE ────────────────────────────────────────────────────────
function QuantLab() {
  const [params, setParams] = useState({
    winRate: 55, rr: 1.5, riskPerTrade: 500, totalTrades: 300,
    tradesPerDay: 3, variance: 35, propFirmRules: true,
    accountSize: 50000, dailyLoss: 2500, maxDD: 2500
  });
  const [results, setResults] = useState(null);
  const [running, setRunning] = useState(false);
  const canvasRef = useRef(null);

  const p = (key) => (val) => setParams(prev => ({ ...prev, [key]: parseFloat(val) || val }));
  const toggle = (key) => setParams(prev => ({ ...prev, [key]: !prev[key] }));

  const run = () => {
    setRunning(true);
    setTimeout(() => {
      const res = runMonteCarlo(params);
      setResults(res);
      setRunning(false);
    }, 50);
  };

  useEffect(() => {
    if (!results || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const W = canvas.offsetWidth; const H = 260;
    canvas.width = W; canvas.height = H;

    const allVals = results.results.flatMap(r => r.curve);
    const minV = Math.min(...allVals, 0);
    const maxV = Math.max(...allVals, 1);
    const range = maxV - minV || 1;

    const toX = (t, len) => (t / (len - 1)) * (W - 40) + 20;
    const toY = (v) => H - 20 - ((v - minV) / range) * (H - 40);

    ctx.clearRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = "#21262d";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = 20 + (i / 4) * (H - 40);
      ctx.beginPath(); ctx.moveTo(20, y); ctx.lineTo(W - 20, y); ctx.stroke();
    }

    // Zero line
    if (minV < 0 && maxV > 0) {
      ctx.strokeStyle = "#484f58"; ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      const y0 = toY(0);
      ctx.beginPath(); ctx.moveTo(20, y0); ctx.lineTo(W - 20, y0); ctx.stroke();
      ctx.setLineDash([]);
    }

    // Paths
    const step = Math.max(1, Math.floor(results.results.length / 80));
    results.results.forEach((r, idx) => {
      if (idx % step !== 0) return;
      const color = r.busted ? "rgba(255,71,87,0.15)" : r.passed ? "rgba(0,212,255,0.15)" : "rgba(0,255,136,0.08)";
      ctx.strokeStyle = color; ctx.lineWidth = 1;
      ctx.beginPath();
      r.curve.forEach((v, t) => {
        const x = toX(t, r.curve.length); const y = toY(v);
        t === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
    });

    // Median
    const medIdx = Math.floor(results.results.length / 2);
    ctx.strokeStyle = "var(--accent)"; ctx.lineWidth = 2;
    ctx.beginPath();
    results.results[medIdx].curve.forEach((v, t) => {
      const x = toX(t, results.results[medIdx].curve.length); const y = toY(v);
      t === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

  }, [results]);

  const fmt = (n) => n >= 0 ? `+$${n.toLocaleString()}` : `-$${Math.abs(n).toLocaleString()}`;

  return (
    <div className="gap-16">
      <div>
        <div className="section-title">Quant Lab</div>
        <div className="section-sub">Monte Carlo simulation with prop firm rules — 500 randomized paths</div>
      </div>

      <div className="grid-2" style={{ gap: 24 }}>
        {/* CONFIG */}
        <div className="gap-16">
          <div className="card">
            <div className="card-title"><Ic name="target" size={14} /><span className="accent">Trade Model</span></div>
            <div className="grid-2">
              <div className="input-group">
                <label className="input-label">Win Rate (%)</label>
                <input className="input" type="number" value={params.winRate} onChange={e => p("winRate")(e.target.value)} />
              </div>
              <div className="input-group">
                <label className="input-label">Reward / Risk</label>
                <input className="input" type="number" step="0.1" value={params.rr} onChange={e => p("rr")(e.target.value)} />
              </div>
              <div className="input-group">
                <label className="input-label">Risk / Trade ($)</label>
                <input className="input" type="number" value={params.riskPerTrade} onChange={e => p("riskPerTrade")(e.target.value)} />
              </div>
              <div className="input-group">
                <label className="input-label">Total Trades</label>
                <input className="input" type="number" value={params.totalTrades} onChange={e => p("totalTrades")(e.target.value)} />
              </div>
              <div className="input-group">
                <label className="input-label">Trades / Day</label>
                <input className="input" type="number" value={params.tradesPerDay} onChange={e => p("tradesPerDay")(e.target.value)} />
              </div>
              <div className="input-group">
                <label className="input-label">Variance (±%)</label>
                <input className="input" type="number" value={params.variance} onChange={e => p("variance")(e.target.value)} />
              </div>
            </div>
            <div style={{ padding: "6px 0", marginBottom: 4 }}>
              <div style={{ fontSize: 11, color: "var(--text2)", marginBottom: 6 }}>
                Expected Value per trade: <strong style={{ color: params.winRate / 100 * params.rr - (1 - params.winRate / 100) > 0 ? "var(--accent)" : "var(--danger)", fontFamily: "var(--mono)" }}>
                  {((params.winRate / 100 * params.rr - (1 - params.winRate / 100)) * params.riskPerTrade).toFixed(0)} $
                </strong>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-title" style={{ marginBottom: 12 }}>
              <Ic name="shield" size={14} /><span className="accent">Prop Firm Rules</span>
              <div style={{ marginLeft: "auto" }}>
                <div className={`toggle ${params.propFirmRules ? "on" : ""}`} onClick={() => toggle("propFirmRules")} />
              </div>
            </div>
            {params.propFirmRules && (
              <div className="grid-2">
                <div className="input-group">
                  <label className="input-label">Account Size</label>
                  <select className="select" value={params.accountSize} onChange={e => p("accountSize")(e.target.value)}>
                    <option value={25000}>$25,000</option>
                    <option value={50000}>$50,000</option>
                    <option value={100000}>$100,000</option>
                    <option value={150000}>$150,000</option>
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label">Max Daily Loss</label>
                  <input className="input" type="number" value={params.dailyLoss} onChange={e => p("dailyLoss")(e.target.value)} />
                </div>
                <div className="input-group">
                  <label className="input-label">Max Overall DD</label>
                  <input className="input" type="number" value={params.maxDD} onChange={e => p("maxDD")(e.target.value)} />
                </div>
                <div className="input-group">
                  <label className="input-label">Profit Target</label>
                  <input className="input" readOnly value={`$${(params.accountSize * 0.1).toLocaleString()}`} style={{ opacity: 0.6 }} />
                </div>
              </div>
            )}
            <button className="btn btn-primary btn-full mt-8" onClick={run} disabled={running}>
              {running ? <><span className="spin" style={{ display: "inline-block" }}>↻</span> Running…</> : <><Ic name="play" size={14} /> Run Simulation (500 paths)</>}
            </button>
          </div>
        </div>

        {/* RESULTS */}
        <div className="gap-16">
          {results ? (
            <>
              <div className="grid-2">
                <div className="stat-card"><div className="stat-label">Median Outcome</div><div className={`stat-value ${results.p50 >= 0 ? "green" : "red"}`}>{fmt(results.p50)}</div><div className="stat-sub">50th percentile</div></div>
                <div className="stat-card"><div className="stat-label">Best Case (P90)</div><div className="stat-value blue">{fmt(results.p90)}</div><div className="stat-sub">90th percentile</div></div>
                <div className="stat-card"><div className="stat-label">Worst Case (P10)</div><div className={`stat-value ${results.p10 >= 0 ? "green" : "red"}`}>{fmt(results.p10)}</div><div className="stat-sub">10th percentile</div></div>
                <div className="stat-card"><div className="stat-label">Average</div><div className={`stat-value ${results.avg >= 0 ? "green" : "red"}`}>{fmt(Math.round(results.avg))}</div><div className="stat-sub">Mean of 500 paths</div></div>
              </div>
              {params.propFirmRules && (
                <div className="grid-2">
                  <div className="stat-card">
                    <div className="stat-label">Challenge Pass Rate</div>
                    <div className="stat-value blue">{((results.passed / results.paths) * 100).toFixed(1)}%</div>
                    <div className="stat-sub">{results.passed} of {results.paths} paths</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Blow-Up Rate</div>
                    <div className={`stat-value ${results.busted / results.paths > 0.3 ? "red" : "orange"}`}>{((results.busted / results.paths) * 100).toFixed(1)}%</div>
                    <div className="stat-sub">{results.busted} accounts blown</div>
                  </div>
                </div>
              )}
              <div className="card">
                <div className="card-title">Equity Curve Distribution</div>
                <canvas ref={canvasRef} className="mc-canvas" style={{ height: 260 }} />
                <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 11, color: "var(--text2)" }}>
                  <span><span style={{ color: "var(--accent)" }}>─</span> Median path</span>
                  <span><span style={{ color: "rgba(0,212,255,0.6)" }}>─</span> Passed challenge</span>
                  <span><span style={{ color: "rgba(255,71,87,0.6)" }}>─</span> Blown account</span>
                </div>
              </div>
            </>
          ) : (
            <div className="card" style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div className="empty-state">
                <div className="empty-icon"><Ic name="beaker" size={48} /></div>
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

// ─── STRATEGY ANALYSIS MODULE ─────────────────────────────────────────────────
function StrategyAnalysis() {
  const [trades, setTrades] = useState(null);
  const [drag, setDrag] = useState(false);

  const parseCSV = (text) => {
    const lines = text.trim().split("\n");
    if (lines.length < 2) return null;
    const headers = lines[0].split(",").map(h => h.trim().replace(/"/g, "").toLowerCase());
    return lines.slice(1).map((line, idx) => {
      const vals = line.split(",").map(v => v.trim().replace(/"/g, ""));
      const obj = {};
      headers.forEach((h, i) => obj[h] = vals[i]);
      const pnl = parseFloat(obj["profit"] || obj["pnl"] || obj["net profit"] || obj["net pnl"] || "0");
      return {
        id: idx + 1,
        date: obj["date"] || obj["entry time"] || `Trade ${idx + 1}`,
        symbol: obj["symbol"] || obj["market"] || "NQ",
        side: obj["type"] || obj["direction"] || obj["side"] || "—",
        entry: parseFloat(obj["entry price"] || obj["entry"] || "0"),
        exit: parseFloat(obj["exit price"] || obj["exit"] || "0"),
        contracts: parseInt(obj["qty"] || obj["contracts"] || obj["quantity"] || "1"),
        pnl,
        duration: obj["duration"] || obj["time in trade"] || "—",
      };
    }).filter(t => !isNaN(t.pnl));
  };

  const handleFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const parsed = parseCSV(e.target.result);
      setTrades(parsed?.length ? parsed : SAMPLE_TRADES);
    };
    reader.readAsText(file);
  };

  const useSample = () => setTrades(SAMPLE_TRADES);

  const stats = trades ? (() => {
    const wins = trades.filter(t => t.pnl > 0);
    const losses = trades.filter(t => t.pnl < 0);
    const totalPnl = trades.reduce((s, t) => s + t.pnl, 0);
    const avgWin = wins.length ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0;
    const avgLoss = losses.length ? Math.abs(losses.reduce((s, t) => s + t.pnl, 0) / losses.length) : 1;
    let peak = 0, dd = 0, maxDD = 0, run = 0;
    let bestStreak = 0, worstStreak = 0, curStreak = 0;
    trades.forEach(t => {
      run += t.pnl;
      if (run > peak) peak = run;
      dd = peak - run;
      if (dd > maxDD) maxDD = dd;
      if (t.pnl > 0) { curStreak = Math.max(0, curStreak) + 1; bestStreak = Math.max(bestStreak, curStreak); }
      else { curStreak = Math.min(0, curStreak) - 1; worstStreak = Math.min(worstStreak, curStreak); }
    });
    return {
      total: trades.length, wins: wins.length, losses: losses.length,
      winRate: ((wins.length / trades.length) * 100).toFixed(1),
      totalPnl, avgWin, avgLoss,
      profitFactor: avgLoss > 0 ? (avgWin / avgLoss).toFixed(2) : "∞",
      maxDD, bestStreak, worstStreak: Math.abs(worstStreak),
    };
  })() : null;

  return (
    <div className="gap-16">
      <div>
        <div className="section-title">Strategy Analysis</div>
        <div className="section-sub">Import your trade history from TradingView, NinjaTrader, MT4/MT5, or any CSV</div>
      </div>

      {!trades ? (
        <div>
          <div
            className={`file-drop ${drag ? "drag" : ""}`}
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            onClick={() => { const inp = document.createElement("input"); inp.type = "file"; inp.accept = ".csv,.htm,.html"; inp.onchange = e => handleFile(e.target.files[0]); inp.click(); }}
          >
            <div className="file-drop-icon"><Ic name="upload" size={40} /></div>
            <div className="file-drop-title">Drop your trade history CSV here</div>
            <div className="file-drop-sub">Supports TradingView · NinjaTrader · MT4/MT5 · Any CSV format</div>
          </div>
          <div className="tip-box mt-12">
            <Ic name="info" size={14} />
            <span>Make sure TradingView is set to <strong>English</strong> before exporting. Hebrew UI may cause parse errors.</span>
          </div>
          <button className="btn btn-secondary mt-12" onClick={useSample}><Ic name="eye" size={14} /> Use Sample Data</button>
        </div>
      ) : (
        <>
          <div className="grid-4">
            <div className="stat-card"><div className="stat-label">Total PnL</div><div className={`stat-value ${stats.totalPnl >= 0 ? "green" : "red"}`}>{stats.totalPnl >= 0 ? "+" : ""}${stats.totalPnl.toLocaleString()}</div><div className="stat-sub">{stats.total} trades</div></div>
            <div className="stat-card"><div className="stat-label">Win Rate</div><div className={`stat-value ${stats.winRate >= 50 ? "green" : "orange"}`}>{stats.winRate}%</div><div className="stat-sub">{stats.wins}W / {stats.losses}L</div></div>
            <div className="stat-card"><div className="stat-label">Profit Factor</div><div className={`stat-value ${parseFloat(stats.profitFactor) >= 1.5 ? "green" : "orange"}`}>{stats.profitFactor}</div><div className="stat-sub">Avg win / avg loss</div></div>
            <div className="stat-card"><div className="stat-label">Max Drawdown</div><div className="stat-value red">${stats.maxDD.toLocaleString()}</div><div className="stat-sub">Best streak: {stats.bestStreak}</div></div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-12">
              <div className="card-title" style={{ marginBottom: 0 }}>Trade Log</div>
              <button className="btn btn-secondary btn-sm" onClick={() => setTrades(null)}><Ic name="refresh" size={14} /> New Upload</button>
            </div>
            <div style={{ overflow: "auto", maxHeight: 380 }}>
              <table className="trade-table">
                <thead>
                  <tr>
                    <th>#</th><th>Date</th><th>Symbol</th><th>Side</th>
                    <th>Entry</th><th>Exit</th><th>Contracts</th><th>Duration</th><th>PnL</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map(t => (
                    <tr key={t.id}>
                      <td className="text-muted">{t.id}</td>
                      <td>{t.date}</td>
                      <td><span className="badge badge-gray">{t.symbol}</span></td>
                      <td><span className={`badge ${t.side?.toLowerCase().includes("long") || t.side?.toLowerCase().includes("buy") ? "badge-green" : "badge-red"}`}>{t.side}</span></td>
                      <td className="text-mono">{t.entry || "—"}</td>
                      <td className="text-mono">{t.exit || "—"}</td>
                      <td className="text-mono">{t.contracts}</td>
                      <td className="text-muted">{t.duration}</td>
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

// ─── TRADING JOURNAL MODULE ────────────────────────────────────────────────────
function TradingJournal() {
  const [tab, setTab] = useState("challenges");
  const [challenges, setChallenges] = useState([
    { id: 1, firm: "Apex Trader Funding", size: 50000, target: 3000, pnl: 1840, dailyLoss: 2500, maxDD: 2500, status: "active", phase: "Challenge", trades: 12, startDate: "2025-05-01" },
    { id: 2, firm: "Topstep", size: 50000, target: 3000, pnl: -1200, dailyLoss: 1000, maxDD: 2000, status: "failed", phase: "Challenge", trades: 7, startDate: "2025-04-15" },
  ]);
  const [funded, setFunded] = useState([
    { id: 1, firm: "Apex Trader Funding", size: 150000, pnl: 4200, maxDD: 4500, status: "active", trades: 34, startDate: "2025-03-01" },
  ]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ firm: "", size: "50000", target: "3000", dailyLoss: "2500", maxDD: "2500", phase: "Challenge" });

  const addAccount = () => {
    if (!form.firm) return;
    const newAcc = {
      id: Date.now(), firm: form.firm, size: parseFloat(form.size),
      target: parseFloat(form.target), pnl: 0,
      dailyLoss: parseFloat(form.dailyLoss), maxDD: parseFloat(form.maxDD),
      status: "active", phase: form.phase, trades: 0,
      startDate: new Date().toISOString().split("T")[0]
    };
    if (tab === "challenges") setChallenges(prev => [...prev, newAcc]);
    else setFunded(prev => [...prev, newAcc]);
    setShowAdd(false);
    setForm({ firm: "", size: "50000", target: "3000", dailyLoss: "2500", maxDD: "2500", phase: "Challenge" });
  };

  const statusBadge = (s) => {
    if (s === "active") return <span className="badge badge-green">Active</span>;
    if (s === "failed") return <span className="badge badge-red">Failed</span>;
    if (s === "passed") return <span className="badge badge-blue">Passed</span>;
    return <span className="badge badge-gray">{s}</span>;
  };

  const ChallengeCard = ({ acc, onDelete }) => {
    const progress = acc.target ? Math.max(0, Math.min(100, (acc.pnl / acc.target) * 100)) : 0;
    const ddUsed = acc.pnl < 0 ? Math.min(100, (Math.abs(acc.pnl) / acc.maxDD) * 100) : 0;
    return (
      <div className={`challenge-card ${acc.status}`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="challenge-name">{acc.firm}</div>
            <div className="challenge-meta">{acc.phase} · ${acc.size.toLocaleString()} · Started {acc.startDate}</div>
          </div>
          <div className="flex gap-8 items-center">
            {statusBadge(acc.status)}
            <button className="btn btn-danger btn-sm" onClick={() => onDelete(acc.id)} style={{ padding: "4px 8px" }}>
              <Ic name="trash" size={13} />
            </button>
          </div>
        </div>
        {acc.target && (
          <div>
            <div className="flex justify-between text-xs text-muted mb-4">
              <span>Profit Target Progress</span>
              <span style={{ fontFamily: "var(--mono)", color: acc.pnl >= 0 ? "var(--accent)" : "var(--danger)" }}>
                {acc.pnl >= 0 ? "+" : ""}${acc.pnl.toLocaleString()} / ${acc.target.toLocaleString()}
              </span>
            </div>
            <div className="pnl-bar"><div className={`pnl-fill ${acc.pnl >= 0 ? "profit" : "loss"}`} style={{ width: `${Math.abs(progress)}%` }} /></div>
          </div>
        )}
        {ddUsed > 0 && (
          <div style={{ marginTop: 8 }}>
            <div className="flex justify-between text-xs text-muted mb-4">
              <span>Drawdown Used</span>
              <span style={{ fontFamily: "var(--mono)", color: "var(--danger)" }}>{ddUsed.toFixed(1)}%</span>
            </div>
            <div className="pnl-bar"><div className="pnl-fill loss" style={{ width: `${ddUsed}%` }} /></div>
          </div>
        )}
        <hr className="divider" />
        <div className="grid-3">
          <div><div className="text-xs text-muted">Trades</div><div className="text-mono font-bold mt-4">{acc.trades}</div></div>
          <div><div className="text-xs text-muted">Daily Limit</div><div className="text-mono font-bold mt-4">${acc.dailyLoss?.toLocaleString()}</div></div>
          <div><div className="text-xs text-muted">Max DD</div><div className="text-mono font-bold mt-4">${acc.maxDD?.toLocaleString()}</div></div>
        </div>
      </div>
    );
  };

  const list = tab === "challenges" ? challenges : funded;
  const setList = tab === "challenges" ? setChallenges : setFunded;

  return (
    <div className="gap-16">
      <div className="flex items-center justify-between">
        <div>
          <div className="section-title">Trading Journal</div>
          <div className="section-sub">Track prop firm challenges and funded accounts</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Ic name="plus" size={14} /> New Account</button>
      </div>

      <div className="tab-pills" style={{ alignSelf: "flex-start" }}>
        <div className={`tab-pill ${tab === "challenges" ? "active" : ""}`} onClick={() => setTab("challenges")}>
          <Ic name="award" size={13} /> Challenges ({challenges.length})
        </div>
        <div className={`tab-pill ${tab === "funded" ? "active" : ""}`} onClick={() => setTab("funded")}>
          <Ic name="zap" size={13} /> Funded ({funded.length})
        </div>
      </div>

      {showAdd && (
        <div className="card">
          <div className="card-title"><Ic name="plus" size={14} /><span className="accent">Add Account</span></div>
          <div className="grid-2">
            <div className="input-group" style={{ gridColumn: "1/-1" }}>
              <label className="input-label">Prop Firm Name</label>
              <input className="input" placeholder="e.g. Apex Trader Funding" value={form.firm} onChange={e => setForm(f => ({ ...f, firm: e.target.value }))} />
            </div>
            <div className="input-group">
              <label className="input-label">Account Size</label>
              <select className="select" value={form.size} onChange={e => setForm(f => ({ ...f, size: e.target.value }))}>
                <option value="25000">$25,000</option>
                <option value="50000">$50,000</option>
                <option value="100000">$100,000</option>
                <option value="150000">$150,000</option>
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">Phase</label>
              <select className="select" value={form.phase} onChange={e => setForm(f => ({ ...f, phase: e.target.value }))}>
                <option>Challenge</option><option>Funded</option><option>PA (Payout)</option>
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">Profit Target ($)</label>
              <input className="input" type="number" value={form.target} onChange={e => setForm(f => ({ ...f, target: e.target.value }))} />
            </div>
            <div className="input-group">
              <label className="input-label">Max Daily Loss ($)</label>
              <input className="input" type="number" value={form.dailyLoss} onChange={e => setForm(f => ({ ...f, dailyLoss: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-8 mt-8">
            <button className="btn btn-primary" onClick={addAccount}><Ic name="check" size={14} /> Add Account</button>
            <button className="btn btn-secondary" onClick={() => setShowAdd(false)}><Ic name="x" size={14} /> Cancel</button>
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><Ic name="journal" size={48} /></div>
          <div className="empty-title">No accounts yet</div>
          <div className="empty-sub">Create your first prop firm account to start tracking your progress.</div>
        </div>
      ) : (
        <div className="grid-2">
          {list.map(acc => (
            <ChallengeCard key={acc.id} acc={acc} onDelete={id => setList(prev => prev.filter(a => a.id !== id))} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── DASHBOARD ─────────────────────────────────────────────────────────────────
function Dashboard({ setPage }) {
  const quickActions = [
    { icon: "cpu", label: "Ask AI", sub: "Generate Pine Script", color: "var(--accent)", page: "ai" },
    { icon: "beaker", label: "Run Simulation", sub: "Monte Carlo", color: "var(--accent2)", page: "quant" },
    { icon: "chart", label: "Analyze Trades", sub: "Upload CSV", color: "var(--accent3)", page: "analysis" },
    { icon: "journal", label: "Journal", sub: "Track challenges", color: "var(--warn)", page: "journal" },
  ];
  return (
    <div className="gap-16">
      <div>
        <div className="section-title">Dashboard</div>
        <div className="section-sub">Your trading command center — strategy, simulation, analysis & journal</div>
      </div>
      <div className="grid-4">
        {quickActions.map(a => (
          <div key={a.page} className="card" style={{ cursor: "pointer", transition: "border-color 0.15s, transform 0.15s" }}
            onClick={() => setPage(a.page)}
            onMouseEnter={e => { e.currentTarget.style.borderColor = a.color; e.currentTarget.style.transform = "translateY(-2px)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.transform = ""; }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: `${a.color}20`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12, color: a.color }}>
              <Ic name={a.icon} size={20} stroke={a.color} />
            </div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{a.label}</div>
            <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 2 }}>{a.sub}</div>
          </div>
        ))}
      </div>
      <div className="grid-2">
        <div className="card">
          <div className="card-title"><Ic name="trending" size={14} /><span className="accent">Recent Performance</span></div>
          {SAMPLE_TRADES.slice(0, 5).map(t => (
            <div key={t.id} className="flex items-center justify-between" style={{ padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
              <div className="flex gap-8 items-center">
                <span className={`badge ${t.pnl >= 0 ? "badge-green" : "badge-red"}`}>{t.side}</span>
                <span style={{ color: "var(--text2)" }}>{t.symbol} · {t.date}</span>
              </div>
              <span className={`text-mono font-bold ${t.pnl >= 0 ? "" : ""}`} style={{ color: t.pnl >= 0 ? "var(--accent)" : "var(--danger)" }}>
                {t.pnl >= 0 ? "+" : ""}${t.pnl.toLocaleString()}
              </span>
            </div>
          ))}
          <button className="btn btn-secondary btn-sm mt-12" onClick={() => setPage("analysis")}><Ic name="chart" size={13} /> View All Trades</button>
        </div>
        <div className="card">
          <div className="card-title"><Ic name="award" size={14} /><span className="accent">Active Challenges</span></div>
          <div className="flex items-center justify-between" style={{ padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>Apex Trader Funding</div>
              <div style={{ fontSize: 11, color: "var(--text2)" }}>$50K Challenge · 12 trades</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ color: "var(--accent)", fontFamily: "var(--mono)", fontWeight: 700 }}>+$1,840</div>
              <div style={{ fontSize: 11, color: "var(--text2)" }}>of $3,000 target</div>
            </div>
          </div>
          <div className="pnl-bar mt-8"><div className="pnl-fill profit" style={{ width: "61%" }} /></div>
          <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 6 }}>61% to target</div>
          <button className="btn btn-secondary btn-sm mt-12" onClick={() => setPage("journal")}><Ic name="journal" size={13} /> Open Journal</button>
        </div>
      </div>
    </div>
  );
}

// ─── APP SHELL ─────────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState("dashboard");
  const [collapsed, setCollapsed] = useState(false);

  const navItems = [
    { id: "dashboard", icon: "zap", label: "Dashboard" },
    { id: "ai", icon: "cpu", label: "AI Builder", badge: "NEW" },
    { id: "quant", icon: "beaker", label: "Quant Lab" },
    { id: "analysis", icon: "chart", label: "Analysis" },
    { id: "journal", icon: "journal", label: "Journal" },
  ];

  const pageTitle = {
    dashboard: "Dashboard", ai: "AI Strategy Builder",
    quant: "Quant Lab", analysis: "Strategy Analysis", journal: "Trading Journal"
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
          <div className="logo">
            <div className="logo-icon">
              <Ic name="zap" size={16} stroke="#080c10" fill="#080c10" />
            </div>
            <div className="logo-text">Trade<span>Forge</span></div>
          </div>
          <nav className="nav">
            {navItems.map(item => (
              <div key={item.id} className={`nav-item ${page === item.id ? "active" : ""}`} onClick={() => setPage(item.id)}>
                <span className="nav-icon"><Ic name={item.icon} size={18} /></span>
                <span>{item.label}</span>
                {item.badge && <span className="nav-badge">{item.badge}</span>}
              </div>
            ))}
          </nav>
          <div className="collapse-btn" onClick={() => setCollapsed(c => !c)}>
            <Ic name={collapsed ? "chevron" : "chevron"} size={16} />
          </div>
        </aside>

        <main className="main">
          <div className="topbar">
            <div className="topbar-title">
              {pageTitle[page]}
              <span>TradeForge</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", boxShadow: "0 0 6px var(--accent)" }} />
              <span style={{ fontSize: 12, color: "var(--text2)" }}>NQ Futures · UTC+3</span>
            </div>
          </div>

          {page === "ai" ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <AIChat />
            </div>
          ) : (
            <div className="content">
              {page === "dashboard" && <Dashboard setPage={setPage} />}
              {page === "quant" && <QuantLab />}
              {page === "analysis" && <StrategyAnalysis />}
              {page === "journal" && <TradingJournal />}
            </div>
          )}
        </main>
      </div>
    </>
  );
}
