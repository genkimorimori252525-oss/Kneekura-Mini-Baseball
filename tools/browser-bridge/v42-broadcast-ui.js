/* v42 One-Pitch Broadcast UI (一球速報UI試作版)
 * Inspired by mobile sports live-cast UX (Record_2026-10-09-10-13-25.mp4),
 * adapted for Kneekura Mini Baseball's real-time 3D/2D physical engine.
 * Purely observational UI layer: never alters Core physics, RNG, or adjudication.
 */
(function (root) {
  'use strict';

  const PITCH_NAMES = {
    fastball: 'ストレート',
    slider: 'スライダー',
    curve: 'カーブ',
    changeup: 'チェンジアップ',
    cutter: 'カットボール',
    sinker: 'シンカー',
    splitter: 'スプリット',
    fork: 'フォーク',
    'two-seam': 'ツーシーム',
  };

  const POS_JP = {
    P: '投', C: '捕', '1B': '一', '2B': '二', '3B': '三', SS: '遊', LF: '左', CF: '中', RF: '右', DH: '指',
  };

  const ROLE_TASK_JP = {
    ball_hunter: '捕球担当',
    base_cover: 'ベースカバー',
    relay: '中継カット',
    backup: 'バックアップ',
    hold: '定位置待機',
  };

  const CATEGORY_COLORS = {
    ball: '#24b698',
    strike: '#e0b541',
    out: '#ed655f',
    hit: '#4ea8de',
    'in-play': '#4ea8de',
    unknown: '#9ca68f',
  };

  function injectStyles() {
    const style = document.createElement('style');
    style.id = 'v42-broadcast-ui-styles';
    style.textContent = `
      :root {
        --v42-bg: #070908;
        --v42-card: #111412;
        --v42-card-alt: #161a17;
        --v42-border: #262b26;
        --v42-gold: #e5b842;
        --v42-green: #22b573;
        --v42-amber: #f2a922;
        --v42-red: #e85349;
        --v42-blue: #3b9eed;
        --v42-away: #3b9eed;
        --v42-home: #e5b842;
        --v42-text: #f2f3ee;
        --v42-muted: #98a096;
      }

      /* Viewport preview mode toggle (PC Wide vs Smartphone 420px) */
      body.v42-mobile-preview main {
        max-width: 430px !important;
        padding: 8px 0 36px !important;
        margin: 0 auto !important;
        border-inline: 1px solid #222;
        background: #050706;
        box-shadow: 0 0 48px rgba(0,0,0,0.85);
      }

      .v42-top-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 16px;
        background: #0c0f0d;
        border-bottom: 1px solid var(--v42-border);
        gap: 10px;
      }
      .v42-title-group {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .v42-title-main {
        font-size: 16px;
        font-weight: 700;
        color: var(--v42-text);
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .v42-title-sub {
        font-size: 11px;
        color: var(--v42-muted);
      }
      .v42-layout-switch {
        display: flex;
        gap: 4px;
        background: #151916;
        padding: 3px;
        border-radius: 6px;
        border: 1px solid #2e342e;
      }
      .v42-layout-switch button {
        min-height: 28px;
        padding: 4px 10px;
        font-size: 11px;
        border: 0;
        border-radius: 4px;
        background: transparent;
        color: var(--v42-muted);
      }
      .v42-layout-switch button[aria-pressed="true"] {
        background: var(--v42-gold);
        color: #14130a;
        font-weight: 700;
      }

      /* 4 Global Navigation Tabs (トップ | 速報 | 経過 | 成績) */
      .v42-global-tabs {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        background: #0c0f0d;
        border-bottom: 1px solid var(--v42-border);
        position: sticky;
        top: 0;
        z-index: 30;
      }
      .v42-global-tabs button {
        background: transparent;
        border: 0;
        border-bottom: 3px solid transparent;
        border-radius: 0;
        color: var(--v42-muted);
        font-size: 14px;
        font-weight: 600;
        min-height: 44px;
        padding: 10px 4px;
        transition: color 0.18s, border-color 0.18s, background 0.18s;
      }
      .v42-global-tabs button:hover {
        color: var(--v42-text);
        background: rgba(255,255,255,0.03);
      }
      .v42-global-tabs button[aria-selected="true"] {
        color: #fff;
        border-bottom-color: #fff;
        background: rgba(255,255,255,0.04);
      }

      /* Compact Scoreboard always visible under tabs */
      .match-heading { display: none !important; }
      .score-wrap {
        padding: 8px 12px 10px !important;
        background: #0a0c0a;
        border-bottom: 1px solid var(--v42-border);
      }
      .scoreboard th { font-size: 11px !important; height: 22px !important; }
      .scoreboard td { height: 30px !important; font-size: 16px !important; }
      .scoreboard td:first-child { font-size: 14px !important; font-weight: 700; }

      /* Slide-Animated Pitch Call Banner */
      .play-status {
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        justify-content: center !important;
        padding: 10px 14px 10px !important;
        background: linear-gradient(180deg, #111512 0%, #0b0e0c 100%);
        border-block: 0 !important;
        border-bottom: 1px solid var(--v42-border) !important;
        gap: 6px !important;
        overflow: hidden;
      }
      @keyframes v42SlideIn {
        0% { opacity: 0; transform: translateY(10px) scale(0.98); }
        100% { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes v42PulseBadge {
        0% { transform: scale(0.82); }
        60% { transform: scale(1.08); }
        100% { transform: scale(1); }
      }
      .play-status .result {
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        gap: 4px !important;
        min-height: 46px !important;
        width: 100%;
        text-align: center;
      }
      .play-status .result.v42-slide-active {
        animation: v42SlideIn 0.26s cubic-bezier(0.22, 1, 0.36, 1);
      }
      .v42-call-headline {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 9px;
      }
      .pitch-number {
        width: 28px !important;
        height: 28px !important;
        font-size: 15px !important;
        font-weight: 700 !important;
        background: rgba(255,255,255,0.06);
        animation: v42PulseBadge 0.25s ease-out;
      }
      #result-text {
        font-size: 20px !important;
        font-weight: 700 !important;
        letter-spacing: 0.02em;
      }
      #pitch-meta {
        font-size: 13px !important;
        color: #d0d5cc !important;
      }
      .count-band {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 20px !important;
        width: 100%;
        padding-top: 2px;
      }
      .bso { gap: 18px !important; }
      .bso b { font-size: 14px !important; font-weight: 700 !important; }
      .lamp { width: 12px !important; height: 12px !important; transition: transform 0.2s, background-color 0.2s; }
      .lamp.on { transform: scale(1.1); box-shadow: 0 0 6px currentColor; }
      #bases { width: 46px !important; height: 34px !important; }

      /* Ensure [hidden] always wins over display !important */
      .play-status[hidden],
      .broadcast-layout[hidden],
      .v42-duel-section[hidden],
      .transport[hidden],
      .broadcast-column[hidden],
      .chart-wrap[hidden],
      .v42-subview[hidden] {
        display: none !important;
      }

      /* Center Stage & Side-Rail Circular Buttons */
      .broadcast-layout {
        grid-template-columns: minmax(0, 1fr) 384px !important;
      }
      .pitch-panel .panel-heading,
      .pitch-panel .pitch-details,
      .pitch-panel .symbol-help {
        display: none !important;
      }
      .pitch-content {
        display: block !important;
      }
      .chart-wrap {
        padding: 6px 58px 2px !important;
        box-sizing: border-box;
      }
      .chart-wrap > p {
        margin: 2px 0 8px !important;
      }
      .v42-stage-shell {
        position: relative;
        background: #0c0e0b;
        min-height: 310px;
        display: flex;
        flex-direction: column;
        justify-content: center;
      }

      /* Floating Left & Right Circular Side-Rail Buttons (as in the video) */
      .v42-side-rail {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        z-index: 18;
        display: flex;
        flex-direction: column;
        gap: 14px;
        pointer-events: none;
      }
      .v42-side-rail.left { left: 8px; }
      .v42-side-rail.right { right: 8px; }
      .v42-rail-btn {
        pointer-events: auto;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 3px;
        background: transparent !important;
        border: 0 !important;
        padding: 0 !important;
        min-height: 0 !important;
        color: #c2c8be;
        font-size: 10px;
        text-shadow: 0 1px 3px rgba(0,0,0,0.95);
      }
      .v42-rail-btn .v42-rail-circle {
        width: 42px;
        height: 42px;
        border-radius: 50%;
        background: rgba(20, 24, 21, 0.9);
        border: 1.5px solid #454d43;
        display: grid;
        place-items: center;
        box-shadow: 0 2px 8px rgba(0,0,0,0.65);
        transition: transform 0.16s, border-color 0.16s, background 0.16s, color 0.16s;
      }
      .v42-rail-btn:hover .v42-rail-circle {
        border-color: #9da897;
        transform: translateY(-1px);
      }
      .v42-rail-btn[aria-pressed="true"] {
        color: var(--v42-gold);
        font-weight: 700;
      }
      .v42-rail-btn[aria-pressed="true"] .v42-rail-circle {
        background: rgba(45, 38, 16, 0.95);
        border-color: var(--v42-gold);
        color: var(--v42-gold);
        box-shadow: 0 0 12px rgba(229, 184, 66, 0.35);
      }
      .v42-rail-circle svg {
        width: 20px;
        height: 20px;
        stroke: currentColor;
        fill: none;
        stroke-width: 1.8;
      }

      /* Tactical 2D Field Canvas (Runner / Position views) & Data Panels */
      .v42-subview {
        width: 100%;
        padding: 10px 58px;
        box-sizing: border-box;
      }
      #v42-tactical-canvas {
        width: 100%;
        max-width: 340px;
        height: auto;
        display: block;
        margin: 0 auto;
      }
      .v42-data-card {
        max-width: 340px;
        margin: 0 auto;
        background: #121613;
        border: 1px solid #2b322b;
        border-radius: 8px;
        padding: 12px 14px;
        font-size: 12px;
      }
      .v42-data-card h3 {
        margin: 0 0 10px;
        font-size: 13px;
        color: var(--v42-gold);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .v42-bar-row {
        display: grid;
        grid-template-columns: 76px 1fr 68px;
        align-items: center;
        gap: 8px;
        margin: 6px 0;
        font-size: 11px;
      }
      .v42-bar-track {
        height: 8px;
        background: #222822;
        border-radius: 4px;
        overflow: hidden;
      }
      .v42-bar-fill {
        height: 100%;
        background: var(--v42-gold);
        border-radius: 4px;
      }
      .v42-metric-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
        margin-top: 8px;
      }
      .v42-metric-box {
        background: #181d19;
        border: 1px solid #2c332c;
        border-radius: 6px;
        padding: 8px 10px;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .v42-metric-box span { font-size: 10px; color: var(--v42-muted); }
      .v42-metric-box strong { font-size: 14px; color: var(--v42-text); font-variant-numeric: tabular-nums; }

      /* Team Strip & Gold Action Pill Button (Wソックス | [リプレイを見る] | ガーディアンズ) */
      .v42-team-strip {
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        align-items: center;
        padding: 8px 14px;
        background: #121512;
        border-top: 1px solid var(--v42-border);
        border-bottom: 1px solid var(--v42-border);
        gap: 8px;
      }
      .v42-team-badge {
        font-size: 13px;
        font-weight: 700;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .v42-team-badge.away::before {
        content: "";
        width: 4px;
        height: 16px;
        background: var(--v42-away);
        border-radius: 2px;
      }
      .v42-team-badge.home {
        justify-content: flex-end;
      }
      .v42-team-badge.home::after {
        content: "";
        width: 4px;
        height: 16px;
        background: var(--v42-home);
        border-radius: 2px;
      }
      .v42-center-actions {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .v42-gold-pill {
        background: linear-gradient(180deg, #f0c94d 0%, #d4a328 100%) !important;
        color: #151206 !important;
        border: 0 !important;
        border-radius: 999px !important;
        padding: 5px 14px !important;
        min-height: 28px !important;
        font-size: 12px !important;
        font-weight: 700 !important;
        box-shadow: 0 2px 6px rgba(0,0,0,0.45);
      }
      .v42-gold-pill:hover {
        filter: brightness(1.07);
      }
      .v42-sub-pill {
        background: #1d231e !important;
        color: #e4e8e0 !important;
        border: 1px solid #3c463d !important;
        border-radius: 999px !important;
        padding: 4px 11px !important;
        min-height: 28px !important;
        font-size: 11px !important;
      }

      /* 2-Column Matchup Duel Card (Batter Left, Pitcher Right, as in video) */
      .v42-duel-section {
        background: #0d100e;
        border-bottom: 1px solid var(--v42-border);
      }
      .player-band {
        display: grid !important;
        grid-template-columns: 1fr 1fr !important;
        border-top: 0 !important;
      }
      .player-band .batter-card { order: 1; border-right: 1px solid var(--v42-border) !important; min-width: 0; }
      .player-band .pitcher-card { order: 2; border-right: 0 !important; min-width: 0; }
      .player-band > div {
        padding: 10px 12px !important;
      }
      .player-band strong {
        font-size: 17px !important;
        font-weight: 700 !important;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .v42-mini-stats {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 5px 10px;
        margin-top: 8px;
        padding-top: 7px;
        border-top: 1px solid #202520;
        font-size: 12px;
        font-variant-numeric: tabular-nums;
      }
      .v42-mini-stats.batter-layout {
        grid-template-columns: 1fr;
      }
      .v42-mini-stat {
        display: flex;
        justify-content: space-between;
        color: var(--v42-muted);
        white-space: nowrap;
      }
      .v42-mini-stat b {
        color: var(--v42-text);
        font-weight: 600;
      }
      .v42-batter-bottom-row {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 5px;
      }
      .v42-pa-chips {
        display: flex;
        gap: 5px;
        overflow-x: auto;
        scrollbar-width: none;
        flex: 1;
        min-width: 0;
      }
      .v42-pa-chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: #1a1f1b;
        border: 1px solid #2e362f;
        border-radius: 4px;
        padding: 2px 6px;
        font-size: 11px;
        white-space: nowrap;
      }
      .v42-pa-chip i {
        font-style: normal;
        color: var(--v42-muted);
        font-size: 10px;
      }

      /* Slide-Down Drawer Handle & Pitch Sequence Drawer (01:02-01:05 in video) */
      .v42-drawer-toggle {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        background: #141815 !important;
        border: 0 !important;
        border-top: 1px solid #232823 !important;
        border-radius: 0 !important;
        min-height: 30px !important;
        padding: 5px !important;
        color: var(--v42-muted) !important;
        font-size: 11px !important;
      }
      .v42-drawer-toggle .v42-chevron {
        transition: transform 0.22s ease;
        display: inline-block;
      }
      .v42-drawer-toggle[aria-expanded="true"] .v42-chevron {
        transform: rotate(180deg);
      }
      .v42-pitch-drawer {
        max-height: 0;
        overflow: hidden;
        transition: max-height 0.28s cubic-bezier(0.22, 1, 0.36, 1);
        background: #0a0c0a;
      }
      .v42-pitch-drawer.open {
        max-height: 420px;
        overflow-y: auto;
        border-top: 1px solid var(--v42-border);
      }
      .v42-seq-row {
        display: grid;
        grid-template-columns: 32px 78px 1fr auto;
        align-items: center;
        gap: 8px;
        width: 100%;
        padding: 9px 14px !important;
        border: 0 !important;
        border-bottom: 1px solid #1c211d !important;
        background: transparent !important;
        text-align: left;
        font-size: 13px;
      }
      .v42-seq-row[aria-pressed="true"] {
        background: #1d2015 !important;
        box-shadow: inset 3px 0 var(--v42-gold);
      }
      .v42-seq-badge {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        font-size: 12px;
        font-weight: 700;
        border: 1.5px solid currentColor;
      }

      /* Non-active top tab views (トップ / 経過 / 成績) */
      .v42-tab-pane {
        display: none;
        padding: 14px;
        background: #0a0d0b;
        min-height: 420px;
      }
      .v42-tab-pane.active {
        display: block;
      }
      .v42-section-card {
        background: var(--v42-card);
        border: 1px solid var(--v42-border);
        border-radius: 6px;
        margin-bottom: 14px;
        overflow: hidden;
      }
      .v42-section-title {
        padding: 10px 14px;
        font-size: 13px;
        font-weight: 700;
        background: #161a17;
        border-bottom: 1px solid var(--v42-border);
        border-left: 3px solid var(--v42-gold);
      }
      .v42-order-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
      }
      .v42-order-col {
        border-right: 1px solid var(--v42-border);
      }
      .v42-order-col:last-child { border-right: 0; }
      .v42-order-head {
        padding: 8px 10px;
        font-weight: 700;
        font-size: 12px;
        border-bottom: 1px solid var(--v42-border);
        background: #131714;
      }
      .v42-order-row {
        display: grid;
        grid-template-columns: 20px 26px 1fr;
        align-items: center;
        gap: 6px;
        padding: 8px 10px;
        border-bottom: 1px solid #1b201c;
        font-size: 12px;
      }
      .v42-pos-tag {
        display: inline-grid;
        place-items: center;
        width: 22px;
        height: 22px;
        border-radius: 4px;
        background: #202621;
        color: #d4dad1;
        font-size: 11px;
        font-weight: 600;
      }

      /* 経過 (Play-by-Play Accordion) */
      .v42-pbp-inning {
        margin-bottom: 14px;
      }
      .v42-pbp-inning-head {
        padding: 8px 12px;
        background: #171c18;
        border-left: 3px solid var(--v42-gold);
        font-weight: 700;
        font-size: 13px;
        margin-bottom: 6px;
      }
      .v42-pbp-card {
        background: var(--v42-card);
        border: 1px solid var(--v42-border);
        border-radius: 5px;
        margin-bottom: 6px;
        overflow: hidden;
      }
      .v42-pbp-summary {
        padding: 10px 12px;
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 13px;
        list-style: none;
      }
      .v42-pbp-summary::-webkit-details-marker { display: none; }
      .v42-pbp-pitches {
        border-top: 1px solid #1f2420;
        background: #0c0e0c;
        padding: 6px 12px;
      }
      .v42-pbp-pitch-line {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 0;
        border-bottom: 1px solid #171b18;
        font-size: 12px;
      }
      .v42-pbp-pitch-line:last-child { border-bottom: 0; }

      /* 成績 (Box Score & Sticky-Column Horizontal Scroll Table, 01:20-01:29 in video) */
      .v42-stats-subtabs {
        display: flex;
        gap: 8px;
        margin-bottom: 12px;
        align-items: center;
        flex-wrap: wrap;
      }
      .v42-scroll-table-wrap {
        overflow-x: auto;
        border: 1px solid var(--v42-border);
        border-radius: 6px;
        background: #0d100e;
      }
      .v42-box-table {
        border-collapse: collapse;
        width: max-content;
        min-width: 100%;
        font-size: 12px;
        font-variant-numeric: tabular-nums;
      }
      .v42-box-table th, .v42-box-table td {
        padding: 8px 10px;
        border-bottom: 1px solid #1d221e;
        text-align: center;
        white-space: nowrap;
      }
      .v42-box-table th {
        background: #161b17;
        color: var(--v42-muted);
        font-weight: 600;
      }
      .v42-box-table .sticky-pos {
        position: sticky;
        left: 0;
        z-index: 4;
        background: #111512;
        width: 42px;
      }
      .v42-box-table .sticky-name {
        position: sticky;
        left: 42px;
        z-index: 4;
        background: #111512;
        text-align: left;
        min-width: 124px;
        border-right: 1px solid var(--v42-border);
        font-weight: 600;
      }

      /* Responsive / Mobile-Preview Single-Stage Behavior */
      @media (max-width: 820px) {
        .broadcast-layout:not([hidden]) { display: block !important; }
        .pitch-panel { border-left: 0 !important; border-top: 0 !important; }
      }
      body.v42-mobile-preview .broadcast-layout:not([hidden]) {
        display: block !important;
      }
      body.v42-mobile-preview .pitch-panel {
        border-left: 0 !important;
        border-top: 0 !important;
      }
    `;
    document.head.append(style);
  }

  function svgIcon(name) {
    switch (name) {
      case 'runner':
        return '<svg viewBox="0 0 24 24"><path d="M12 3 21 12 12 21 3 12Z"/><circle cx="12" cy="7.5" r="1.6" fill="currentColor"/><circle cx="16.5" cy="12" r="1.6" fill="currentColor"/><circle cx="7.5" cy="12" r="1.6" fill="currentColor"/></svg>';
      case 'position':
        return '<svg viewBox="0 0 24 24"><path d="M4 11C4 6.5 7.6 4 12 4s8 2.5 8 7l-8 9-8-9Z"/><path d="M12 10l4 4-4 4-4-4 4-4Z"/></svg>';
      case 'pitchdata':
        return '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M9.5 6.5c1.5 2 1.5 9 0 11M14.5 6.5c-1.5 2-1.5 9 0 11"/></svg>';
      case 'chart':
        return '<svg viewBox="0 0 24 24"><rect x="5" y="4" width="14" height="16" rx="1"/><path d="M9.6 4v16M14.3 4v16M5 9.3h14M5 14.6h14"/></svg>';
      case '3d':
        return '<svg viewBox="0 0 24 24"><polygon points="9,7 17,12 9,17" fill="currentColor"/><rect x="3" y="4" width="18" height="16" rx="2"/></svg>';
      case 'batted':
        return '<svg viewBox="0 0 24 24"><path d="M4 19 19 4M14 4h5v5"/><path d="M4 14c4-4 9-5 15-2" stroke-dasharray="2 2"/></svg>';
      default:
        return '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/></svg>';
    }
  }

  function drawBatterSilhouetteOnChart(canvas, battingSide) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.save();
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    // Catcher perspective: RHB stands on the left (x ~ 52), LHB stands on the right (x ~ 268)
    const isLeftBatter = battingSide === 'L';
    const cx = isLeftBatter ? 268 : 52;
    const dir = isLeftBatter ? -1 : 1;
    ctx.fillStyle = 'rgba(180, 192, 174, 0.16)';
    ctx.strokeStyle = 'rgba(180, 192, 174, 0.28)';
    ctx.lineWidth = 1.5;

    // Helmet / Head
    ctx.beginPath();
    ctx.arc(cx, 86, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Visor
    ctx.beginPath();
    ctx.moveTo(cx + dir * 8, 82);
    ctx.lineTo(cx + dir * 18, 85);
    ctx.lineTo(cx + dir * 10, 89);
    ctx.closePath();
    ctx.fill();

    // Bat angled behind shoulder
    ctx.save();
    ctx.strokeStyle = 'rgba(224, 181, 65, 0.32)';
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - dir * 6, 108);
    ctx.lineTo(cx - dir * 24, 48);
    ctx.stroke();
    ctx.restore();

    // Torso + Legs silhouette
    ctx.beginPath();
    ctx.roundRect(cx - 16, 101, 32, 64, 10);
    ctx.fill();
    ctx.stroke();

    // Left & Right Legs
    ctx.beginPath();
    ctx.roundRect(cx - 14, 162, 11, 82, 5);
    ctx.roundRect(cx + 3, 162, 11, 82, 5);
    ctx.fill();
    ctx.restore();
  }

  function drawTactical2DField(canvas, mode, snap, matchData) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = 360, H = 300;
    if (canvas.width !== W * 2 || canvas.height !== H * 2) {
      canvas.width = W * 2;
      canvas.height = H * 2;
    }
    ctx.save();
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // Stadium turf background
    ctx.fillStyle = '#0c100d';
    ctx.fillRect(0, 0, W, H);

    const homeX = W / 2, homeY = 258, scale = 2.05;
    const toScreen = (x, z) => ({ x: homeX + x * scale, y: homeY - z * scale });

    // Outfield grass fan
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(homeX, homeY);
    ctx.arc(homeX, homeY, 108 * scale, -Math.PI * 0.75, -Math.PI * 0.25, false);
    ctx.closePath();
    ctx.fillStyle = '#1f5c35';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#d9a74a';
    ctx.stroke();
    ctx.restore();

    // Infield dirt diamond
    const b1 = toScreen(19.397, 19.397);
    const b2 = toScreen(0, 38.795);
    const b3 = toScreen(-19.397, 19.397);
    ctx.beginPath();
    ctx.moveTo(homeX, homeY + 4);
    ctx.lineTo(b1.x + 12, b1.y);
    ctx.arc(homeX, homeY - 19.4 * scale, 29 * scale, -Math.PI * 0.15, -Math.PI * 0.85, true);
    ctx.lineTo(b3.x - 12, b3.y);
    ctx.closePath();
    ctx.fillStyle = '#8b5e34';
    ctx.fill();

    // Infield grass diamond
    ctx.beginPath();
    ctx.moveTo(homeX, homeY - 3);
    ctx.lineTo(b1.x, b1.y);
    ctx.lineTo(b2.x, b2.y);
    ctx.lineTo(b3.x, b3.y);
    ctx.closePath();
    ctx.fillStyle = '#24693d';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Foul lines
    ctx.beginPath();
    ctx.moveTo(homeX, homeY);
    ctx.lineTo(homeX - 76 * scale, homeY - 76 * scale);
    ctx.moveTo(homeX, homeY);
    ctx.lineTo(homeX + 76 * scale, homeY - 76 * scale);
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 1.3;
    ctx.stroke();

    // Bases
    const match = snap.observedMatch ?? snap.host.match;
    const bases = [match.bases.first, match.bases.second, match.bases.third];
    [[b1, bases[0]], [b2, bases[1]], [b3, bases[2]]].forEach(([pt, occ]) => {
      ctx.save();
      ctx.translate(pt.x, pt.y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = occ ? '#f5655b' : '#f4f4ee';
      ctx.fillRect(-5, -5, 10, 10);
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 1;
      ctx.strokeRect(-5, -5, 10, 10);
      ctx.restore();
    });

    // Draw live ball position if in play
    const frame = snap.currentFrame;
    if (frame?.ball) {
      const bp = toScreen(frame.ball.position.x, frame.ball.position.z);
      ctx.beginPath();
      ctx.arc(bp.x, bp.y, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.strokeStyle = '#e5b842';
      ctx.lineWidth = 1.8;
      ctx.stroke();
    }

    function drawPill(x, y, text, borderColor, subText) {
      ctx.font = '600 10px "Kneekura JP", sans-serif';
      const tw = Math.max(54, ctx.measureText(text).width + 14);
      const th = subText ? 26 : 19;
      const rx = Math.max(4, Math.min(W - tw - 4, x - tw / 2));
      const ry = Math.max(4, Math.min(H - th - 4, y - th / 2));
      ctx.fillStyle = 'rgba(12, 16, 14, 0.92)';
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.roundRect(rx, ry, tw, th, 4);
      ctx.fill();
      ctx.stroke();
      // Left color bar like the video
      ctx.fillStyle = borderColor;
      ctx.fillRect(rx, ry, 3.5, th);
      ctx.fillStyle = '#f3f4ef';
      ctx.textAlign = 'center';
      ctx.fillText(text, rx + tw / 2 + 1, ry + 12.5);
      if (subText) {
        ctx.fillStyle = '#e5b842';
        ctx.font = '500 8.5px "Kneekura JP", sans-serif';
        ctx.fillText(subText, rx + tw / 2 + 1, ry + 22.5);
      }
    }

    const actors = frame?.actors ?? [];
    const roles = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];
    const fieldDiag = snap.lastResult?.play?.field?.diagnostics?.aiTelemetry;
    const latestRoles = fieldDiag?.roleTransitions?.at(-1)?.roles ?? null;

    if (mode === 'position') {
      const pillOffsets = {
        C: [0, 18],
        P: [0, -2],
        '1B': [24, 4],
        '3B': [-24, 4],
        '2B': [18, -14],
        SS: [-18, -14],
        LF: [-10, -4],
        CF: [0, -8],
        RF: [10, -4],
      };
      for (const role of roles) {
        const actor = actors.find((a) => a.role === role);
        const defPos = matchData.positions[role] ?? [0, 20];
        const pos = actor ? [actor.position.x, actor.position.z] : defPos;
        const pt = toScreen(pos[0], pos[1]);
        const [ox, oy] = pillOffsets[role] ?? [0, 0];
        const pInfo = actor ? matchData.players[actor.playerId] : null;
        const shortName = (pInfo?.name ?? role).slice(0, 7);
        const aiRole = latestRoles && actor ? ROLE_TASK_JP[latestRoles[actor.playerId]] : null;
        drawPill(pt.x + ox, pt.y + oy, shortName, '#3b9eed', aiRole && aiRole !== '定位置待機' ? aiRole : null);
      }
    } else if (mode === 'runner') {
      const baseCoords = [
        [1, b1.x + 28, b1.y - 16, bases[0]],
        [2, b2.x, b2.y - 24, bases[1]],
        [3, b3.x - 28, b3.y - 16, bases[2]],
      ];
      let anyRunner = false;
      for (const [bNum, bx, by, rId] of baseCoords) {
        if (!rId) continue;
        anyRunner = true;
        const pInfo = matchData.players[rId];
        drawPill(bx, by, pInfo?.name ?? rId, '#22b573', bNum + '塁走者');
      }
      if (!anyRunner) {
        drawPill(W / 2, H / 2 - 10, '現在ランナーなし', '#6c756b', '出塁時に走者名を表示');
      }
    }
    ctx.restore();
  }

  function computeLiveBoxScore(records, throughIndex, matchData) {
    const slice = records.slice(0, throughIndex + 1);
    const batterStats = {};
    const pitcherStats = {};
    const teamHits = [0, 0];
    const teamErrors = [0, 0];

    for (const id of Object.keys(matchData.players)) {
      batterStats[id] = { ab: 0, h: 0, r: 0, rbi: 0, hr: 0, so: 0, bb: 0, hbp: 0, byInning: {}, paList: [] };
      pitcherStats[id] = { outs: 0, np: 0, bf: 0, h: 0, hr: 0, so: 0, bb: 0, hbp: 0, r: 0, pitchTypes: {} };
    }

    const seenPa = new Set();
    for (const r of slice) {
      const bId = r.batterPlayerId;
      const pId = r.pitcherPlayerId;
      const bTeam = matchData.players[bId]?.team ?? 0;
      const ps = pitcherStats[pId];
      if (ps) {
        ps.np++;
        ps.pitchTypes[r.pitchType] = (ps.pitchTypes[r.pitchType] || 0) + 1;
      }

      const desc = root.KneekuraLivePlayDescription.describe(r);
      const isTerminal = r.play.rules.batterAdvanced || desc.playOuts > 0 || ['walk', 'hit_by_pitch', 'strikeout'].includes(r.play.classification);
      const paKey = r.beforeMatch.playId;
      if (isTerminal && !seenPa.has(paKey)) {
        seenPa.add(paKey);
        const bs = batterStats[bId];
        if (ps) ps.bf++;
        const inn = r.beforeMatch.inning;
        let shortRes = desc.label;
        const cls = r.play.classification;
        const isWalk = cls === 'walk' || desc.label.includes('四球');
        const isHbp = cls === 'hit_by_pitch' || desc.label.includes('死球');
        const isSo = cls === 'strikeout' || desc.label.includes('三振');
        const isHr = cls === 'home_run' || desc.label === 'ホームラン';
        const isHit = isHr || ['single', 'double', 'triple'].includes(cls) ||
          (cls === 'live_ball' && desc.playOuts === 0 && !desc.batter.out && (desc.batter.baseReached ?? 0) >= 1);

        if (isWalk) {
          bs.bb++;
          if (ps) ps.bb++;
          shortRes = '四球';
        } else if (isHbp) {
          bs.hbp++;
          if (ps) ps.hbp++;
          shortRes = '死球';
        } else {
          bs.ab++;
          if (isSo) {
            bs.so++;
            if (ps) ps.so++;
            shortRes = r.play.call === 'called_strike' ? '見三振' : '空三振';
          } else if (isHit) {
            bs.h++;
            if (ps) ps.h++;
            teamHits[bTeam]++;
            if (isHr) {
              bs.hr++;
              if (ps) ps.hr++;
              shortRes = '本塁打';
            } else {
              shortRes = desc.batter.baseReached === 3 ? '三塁打' : desc.batter.baseReached === 2 ? '二塁打' : '安打';
            }
          }
        }
        const runs = desc.runCount || 0;
        bs.rbi += runs;
        if (ps) {
          ps.outs += desc.playOuts || 0;
          ps.r += runs;
        }
        for (const scoredId of (r.play.rules.scoredRunnerIds ?? [])) {
          if (batterStats[scoredId]) batterStats[scoredId].r++;
        }
        bs.byInning[inn] = bs.byInning[inn] ? bs.byInning[inn] + ' / ' + shortRes : shortRes;
        bs.paList.push({ inning: inn, label: shortRes });
      }
    }
    return { batterStats, pitcherStats, teamHits, teamErrors };
  }

  function init() {
    const playback = root.liveMatchPlayback;
    const matchDataEl = document.getElementById('match-data');
    if (!playback || !matchDataEl) return;
    const matchData = JSON.parse(matchDataEl.textContent);

    injectStyles();

    // 1. Top Header with Viewport Mode Toggle (PC Wide vs Smartphone 430px)
    const masthead = document.querySelector('.masthead');
    const topBar = document.createElement('div');
    topBar.className = 'v42-top-bar';
    topBar.innerHTML = `
      <div class="v42-title-group">
        <div class="v42-title-main">
          <span>${matchData.teams[0]} vs ${matchData.teams[1]}</span>
          <span id="v42-header-inning" style="color:var(--v42-gold);font-size:13px;">1回表</span>
        </div>
        <div class="v42-title-sub">タンボフ・ホーム球場 · 一球速報UI試作版 v42</div>
      </div>
      <div class="v42-layout-switch" role="group" aria-label="表示レイアウト切替">
        <button type="button" id="v42-mode-mobile" aria-pressed="true">📱 スマホ速報UI</button>
        <button type="button" id="v42-mode-pc" aria-pressed="false">🖥 PC 2画面UI</button>
      </div>
    `;
    masthead.replaceWith(topBar);
    document.body.classList.add('v42-mobile-preview');

    // 2. Global 4-Tab Bar (トップ | 速報 | 経過 | 成績)
    const matchSection = document.querySelector('section.match');
    const scoreWrap = document.querySelector('.score-wrap');
    const globalTabs = document.createElement('nav');
    globalTabs.className = 'v42-global-tabs';
    globalTabs.setAttribute('role', 'tablist');
    globalTabs.innerHTML = `
      <button type="button" role="tab" data-v42-tab="top" aria-selected="false">トップ</button>
      <button type="button" role="tab" data-v42-tab="live" aria-selected="true">速報</button>
      <button type="button" role="tab" data-v42-tab="pbp" aria-selected="false">経過</button>
      <button type="button" role="tab" data-v42-tab="stats" aria-selected="false">成績</button>
    `;
    matchSection.insertBefore(globalTabs, scoreWrap);

    // Restructure .play-status .result so pitch-number + result-text sit on line 1, pitch-meta on line 2
    const resultDiv = document.querySelector('.play-status .result');
    const pitchNumEl = document.getElementById('pitch-number');
    const resultTextEl = document.getElementById('result-text');
    const pitchMetaEl = document.getElementById('pitch-meta');
    if (resultDiv && pitchNumEl && resultTextEl && pitchMetaEl) {
      const headline = document.createElement('div');
      headline.className = 'v42-call-headline';
      headline.append(pitchNumEl, resultTextEl);
      resultDiv.replaceChildren(headline, pitchMetaEl);
    }

    // 3. Center Stage & Side-Rail Circular Buttons
    const broadcastLayout = document.querySelector('.broadcast-layout');
    const broadcastCol = document.querySelector('.broadcast-column');
    const pitchPanel = document.querySelector('.pitch-panel');
    const chartWrap = document.querySelector('.chart-wrap');
    const playerBand = document.querySelector('.player-band');

    // Create subviews inside chart-wrap for Tactical 2D Runner/Position, Pitch Data, and Batted/Ability Data
    const tacticalView = document.createElement('div');
    tacticalView.className = 'v42-subview';
    tacticalView.hidden = true;
    tacticalView.innerHTML = `<canvas id="v42-tactical-canvas" width="720" height="600"></canvas>`;

    const pitchDataView = document.createElement('div');
    pitchDataView.className = 'v42-subview';
    pitchDataView.hidden = true;

    const battedDataView = document.createElement('div');
    battedDataView.className = 'v42-subview';
    battedDataView.hidden = true;

    chartWrap.parentElement.insertBefore(tacticalView, chartWrap.nextSibling);
    chartWrap.parentElement.insertBefore(pitchDataView, tacticalView.nextSibling);
    chartWrap.parentElement.insertBefore(battedDataView, pitchDataView.nextSibling);

    // Add Left & Right Circular Side-Rail Buttons onto the stage
    const stageShell = document.createElement('div');
    stageShell.className = 'v42-stage-shell';
    pitchPanel.insertBefore(stageShell, pitchPanel.firstChild);
    stageShell.append( document.querySelector('.pitch-content') );

    const leftRail = document.createElement('div');
    leftRail.className = 'v42-side-rail left';
    leftRail.innerHTML = `
      <button type="button" class="v42-rail-btn" data-v42-stage="runner" aria-pressed="false">
        <span class="v42-rail-circle">${svgIcon('runner')}</span>
        <span>ランナー</span>
      </button>
      <button type="button" class="v42-rail-btn" data-v42-stage="position" aria-pressed="false">
        <span class="v42-rail-circle">${svgIcon('position')}</span>
        <span>ポジション</span>
      </button>
      <button type="button" class="v42-rail-btn" data-v42-stage="pitchdata" aria-pressed="false">
        <span class="v42-rail-circle">${svgIcon('pitchdata')}</span>
        <span>投球データ</span>
      </button>
    `;

    const rightRail = document.createElement('div');
    rightRail.className = 'v42-side-rail right';
    rightRail.innerHTML = `
      <button type="button" class="v42-rail-btn" data-v42-stage="chart" aria-pressed="true">
        <span class="v42-rail-circle">${svgIcon('chart')}</span>
        <span>配球</span>
      </button>
      <button type="button" class="v42-rail-btn" data-v42-stage="3d" aria-pressed="false">
        <span class="v42-rail-circle">${svgIcon('3d')}</span>
        <span>3D中継</span>
      </button>
      <button type="button" class="v42-rail-btn" data-v42-stage="batted" aria-pressed="false">
        <span class="v42-rail-circle">${svgIcon('batted')}</span>
        <span>打球・能力</span>
      </button>
    `;
    stageShell.append(leftRail, rightRail);

    // 4. Team Strip + Gold [リプレイを見る] / [次の一球] Pill Bar + Duel Matchup Card + Slide-Down Drawer
    const duelSection = document.createElement('div');
    duelSection.className = 'v42-duel-section';
    const teamStrip = document.createElement('div');
    teamStrip.className = 'v42-team-strip';
    teamStrip.innerHTML = `
      <div class="v42-team-badge away">${matchData.teams[0]}</div>
      <div class="v42-center-actions">
        <button type="button" class="v42-gold-pill" id="v42-replay-btn">▶ リプレイを見る</button>
        <button type="button" class="v42-sub-pill" id="v42-next-btn">一球すすめる ▶</button>
      </div>
      <div class="v42-team-badge home">${matchData.teams[1]}</div>
    `;

    // Add mini-stats containers inside batter-card and pitcher-card
    const batterCard = playerBand.querySelector('.batter-card');
    const pitcherCard = playerBand.querySelector('.pitcher-card');
    const batterMini = document.createElement('div');
    batterMini.id = 'v42-batter-mini';
    batterCard.append(batterMini);
    const pitcherMini = document.createElement('div');
    pitcherMini.id = 'v42-pitcher-mini';
    pitcherCard.append(pitcherMini);

    const drawerToggle = document.createElement('button');
    drawerToggle.type = 'button';
    drawerToggle.className = 'v42-drawer-toggle';
    drawerToggle.setAttribute('aria-expanded', 'false');
    drawerToggle.innerHTML = `<span>この打席の全投球・詳細成績をスライド表示</span><span class="v42-chevron">▼</span>`;

    const pitchDrawer = document.createElement('div');
    pitchDrawer.className = 'v42-pitch-drawer';
    pitchDrawer.id = 'v42-pitch-drawer';

    duelSection.append(teamStrip, playerBand, drawerToggle, pitchDrawer);
    broadcastLayout.after(duelSection);

    // 5. Create Top / Play-by-Play (経過) / Stats (成績) Tab Panes
    const topPane = document.createElement('div');
    topPane.className = 'v42-tab-pane';
    topPane.dataset.v42Pane = 'top';

    const pbpPane = document.createElement('div');
    pbpPane.className = 'v42-tab-pane';
    pbpPane.dataset.v42Pane = 'pbp';

    const statsPane = document.createElement('div');
    statsPane.className = 'v42-tab-pane';
    statsPane.dataset.v42Pane = 'stats';

    duelSection.after(topPane, pbpPane, statsPane);

    // State for v42 UI
    let activeTab = 'live';
    let activeStage = 'chart'; // 'chart' | '3d' | 'runner' | 'position' | 'pitchdata' | 'batted'
    let mobilePreview = true;
    let lastAnimatedKey = '';
    let statsTeamFilter = 'all';
    let statsKind = 'batter'; // 'batter' | 'pitcher' | 'detailed'

    function updateStageVisibility() {
      const isMobile = mobilePreview || window.innerWidth <= 820;
      document.querySelectorAll('[data-v42-stage]').forEach((btn) => {
        btn.setAttribute('aria-pressed', String(btn.dataset.v42Stage === activeStage));
      });

      if (isMobile) {
        // In mobile single-stage mode, 3D broadcastCol is shown only when activeStage === '3d'
        broadcastCol.hidden = activeStage !== '3d';
        chartWrap.hidden = activeStage !== 'chart';
        tacticalView.hidden = activeStage !== 'runner' && activeStage !== 'position';
        pitchDataView.hidden = activeStage !== 'pitchdata';
        battedDataView.hidden = activeStage !== 'batted';
      } else {
        // In PC 2-column mode, 3D broadcastCol is ALWAYS visible on the left!
        broadcastCol.hidden = false;
        const rightStage = activeStage === '3d' ? 'chart' : activeStage;
        chartWrap.hidden = rightStage !== 'chart';
        tacticalView.hidden = rightStage !== 'runner' && rightStage !== 'position';
        pitchDataView.hidden = rightStage !== 'pitchdata';
        battedDataView.hidden = rightStage !== 'batted';
      }
    }

    function renderPitchDataView(snap, box) {
      const rec = snap.lastResult;
      const pId = rec?.pitcherPlayerId ?? snap.host.pitcherPlayerId;
      const pInfo = matchData.players[pId];
      const ps = box.pitcherStats[pId] ?? { np: 0, pitchTypes: {} };
      const total = Math.max(1, ps.np);
      const rows = Object.entries(ps.pitchTypes)
        .sort((a, b) => b[1] - a[1])
        .map(([k, count]) => {
          const pct = Math.round((count / total) * 100);
          return `<div class="v42-bar-row">
            <span>${PITCH_NAMES[k] ?? k}</span>
            <div class="v42-bar-track"><div class="v42-bar-fill" style="width:${pct}%"></div></div>
            <span style="text-align:right">${count}球 (${pct}%)</span>
          </div>`;
        })
        .join('');

      pitchDataView.innerHTML = `
        <div class="v42-data-card">
          <h3><span>${pInfo?.name ?? ''} 投球データ</span><span>計 ${ps.np} 球</span></h3>
          ${rows || '<p style="color:var(--v42-muted);margin:8px 0;">まだ投球データがありません</p>'}
          <div class="v42-metric-grid">
            <div class="v42-metric-box"><span>最高球速設定</span><strong>${pInfo?.maxSpeedKmh ?? '-'} km/h</strong></div>
            <div class="v42-metric-box"><span>奪三振 / 四球</span><strong>${ps.so ?? 0} / ${ps.bb ?? 0}</strong></div>
          </div>
        </div>
      `;
    }

    function renderBattedDataView(snap) {
      const rec = snap.lastResult;
      const bId = rec?.batterPlayerId ?? snap.host.batterPlayerId;
      const bInfo = matchData.players[bId];
      const contact = rec?.play?.contactMoment;
      const firstBatted = rec?.frames?.find((f) => f.ballKind === 'batted');
      let exitSpeedKmh = '-';
      let launchDeg = '-';
      if (firstBatted?.ball?.velocity) {
        const v = firstBatted.ball.velocity;
        const speedMps = Math.hypot(v.x, v.y, v.z);
        exitSpeedKmh = (speedMps * 3.6).toFixed(1) + ' km/h';
        launchDeg = ((Math.atan2(v.y, Math.hypot(v.x, v.z)) * 180) / Math.PI).toFixed(1) + '°';
      }
      const zj = rec?.play?.diagnostics?.zoneJudgment;
      const errCm = zj ? `X:${(zj.errorMeters.x * 100).toFixed(1)}cm / Y:${(zj.errorMeters.y * 100).toFixed(1)}cm` : '-';

      battedDataView.innerHTML = `
        <div class="v42-data-card">
          <h3><span>打球・選球眼物理データ</span><span>${bInfo?.name ?? ''}</span></h3>
          <div class="v42-metric-grid">
            <div class="v42-metric-box"><span>打球初速</span><strong>${exitSpeedKmh}</strong></div>
            <div class="v42-metric-box"><span>打球角度</span><strong>${launchDeg}</strong></div>
            <div class="v42-metric-box"><span>バット接触時刻</span><strong>${contact ? contact.elapsedSeconds.toFixed(3) + ' s' : '非接触'}</strong></div>
            <div class="v42-metric-box"><span>コース認識誤差</span><strong>${errCm}</strong></div>
          </div>
        </div>
      `;
    }

    function renderTopTab() {
      const buildOrderCol = (teamIdx) => {
        const teamCode = matchData.teams[teamIdx];
        const defMap = matchData.defenseMap?.[teamIdx] ?? {};
        const roleByIdx = {};
        for (const [role, idx] of Object.entries(defMap)) roleByIdx[idx] = role;
        let html = `<div class="v42-order-col"><div class="v42-order-head">${teamCode} スターティングオーダー</div>`;
        for (let i = 0; i < 9; i++) {
          const id = `${teamIdx}-b${i}`;
          const p = matchData.players[id];
          const pos = POS_JP[p?.position ?? roleByIdx[i] ?? 'DH'] ?? '野';
          html += `<div class="v42-order-row">
            <span style="color:var(--v42-muted)">${i + 1}</span>
            <span class="v42-pos-tag">${pos}</span>
            <span>${p?.name ?? id} <small style="color:var(--v42-muted)">(${p?.hand === 'L' ? '左' : '右'})</small></span>
          </div>`;
        }
        const pitcher = matchData.players[`${teamIdx}-p0`];
        html += `<div class="v42-order-row" style="background:#141915">
          <span style="color:var(--v42-gold)">投</span>
          <span class="v42-pos-tag">投</span>
          <span>${pitcher?.name ?? ''} <small style="color:var(--v42-muted)">(${pitcher?.throws === 'L' ? '左' : '右'})</small></span>
        </div></div>`;
        return html;
      };

      topPane.innerHTML = `
        <div class="v42-section-card">
          <div class="v42-section-title">バッテリー</div>
          <div style="padding:10px 14px;font-size:13px;display:grid;gap:6px;">
            <div><strong style="color:var(--v42-away)">${matchData.teams[0]}</strong>：${matchData.players['0-p0']?.name} － ${matchData.players['0-b3']?.name}</div>
            <div><strong style="color:var(--v42-home)">${matchData.teams[1]}</strong>：${matchData.players['1-p0']?.name} － ${matchData.players['1-b4']?.name}</div>
          </div>
        </div>
        <div class="v42-section-card">
          <div class="v42-section-title">オーダー</div>
          <div class="v42-order-grid">${buildOrderCol(0)}${buildOrderCol(1)}</div>
        </div>
      `;
    }

    function renderPbpTab(records, throughIndex) {
      const slice = records.slice(0, throughIndex + 1);
      if (!slice.length) {
        pbpPane.innerHTML = `<div class="v42-section-card" style="padding:18px;text-align:center;color:var(--v42-muted)">まだ試合が開始されていません。「一球すすめる」または「試合を進める」を押してください。</div>`;
        return;
      }
      // Group by half-inning -> plateAppearance
      const innings = [];
      const inningMap = new Map();
      for (let idx = 0; idx < slice.length; idx++) {
        const r = slice[idx];
        const iKey = `${r.beforeMatch.inning}-${r.beforeMatch.half}`;
        if (!inningMap.has(iKey)) {
          const group = { key: iKey, inning: r.beforeMatch.inning, half: r.beforeMatch.half, pas: [], paMap: new Map() };
          inningMap.set(iKey, group);
          innings.push(group);
        }
        const iGroup = inningMap.get(iKey);
        const paId = r.beforeMatch.playId;
        if (!iGroup.paMap.has(paId)) {
          const pa = { playId: paId, batterId: r.batterPlayerId, beforeMatch: r.beforeMatch, pitches: [] };
          iGroup.paMap.set(paId, pa);
          iGroup.pas.push(pa);
        }
        iGroup.paMap.get(paId).pitches.push({ index: idx, record: r });
      }

      let html = '';
      for (const ing of [...innings].reverse()) {
        const teamName = ing.half === 'top' ? matchData.teams[0] : matchData.teams[1];
        html += `<div class="v42-pbp-inning">
          <div class="v42-pbp-inning-head">${ing.inning}回${ing.half === 'top' ? '表' : '裏'} ${teamName}の攻撃</div>`;
        for (const pa of [...ing.pas].reverse()) {
          const b = matchData.players[pa.batterId];
          const lastPitch = pa.pitches.at(-1).record;
          const desc = root.KneekuraLivePlayDescription.describe(lastPitch);
          const outsText = ['無死', '一死', '二死'][pa.beforeMatch.outs] ?? '';
          const b1 = pa.beforeMatch.bases.first, b2 = pa.beforeMatch.bases.second, b3 = pa.beforeMatch.bases.third;
          const runnerText = b1 && b2 && b3 ? '走者満塁' : (!b1 && !b2 && !b3) ? '走者なし' :
            '走者' + [b1 ? '1' : '', b2 ? '2' : '', b3 ? '3' : ''].filter(Boolean).join(',') + '塁';
          const pitchLines = pa.pitches.map((pItem, pIdx) => {
            const pr = pItem.record;
            const pd = root.KneekuraLivePlayDescription.describe(pr);
            const col = CATEGORY_COLORS[pd.category] ?? '#e0b541';
            const pName = PITCH_NAMES[pr.pitchType] ?? pr.pitchType;
            return `<div class="v42-pbp-pitch-line" data-jump-pitch="${pItem.index}" style="cursor:pointer">
              <span class="v42-seq-badge" style="color:${col}">${pIdx + 1}</span>
              <span>${Math.round(pr.speedKmh)}km/h ${pName}</span>
              <strong style="margin-left:auto;color:${col}">${pd.label}</strong>
            </div>`;
          }).join('');
          html += `<details class="v42-pbp-card" open>
            <summary class="v42-pbp-summary">
              <span><strong>${b?.name ?? pa.batterId}</strong> <small style="color:var(--v42-muted)">${outsText}${runnerText}</small></span>
              <span style="color:${ desc.runCount > 0 ? 'var(--v42-gold)' : '#d6dcd2' };font-weight:700">${desc.label}${desc.runCount > 0 ? ' +' + desc.runCount + '点' : ''} ▼</span>
            </summary>
            <div class="v42-pbp-pitches">${pitchLines}</div>
          </details>`;
        }
        html += `</div>`;
      }
      pbpPane.innerHTML = html;
      pbpPane.querySelectorAll('[data-jump-pitch]').forEach((el) => {
        el.onclick = () => {
          const idx = Number(el.dataset.jumpPitch);
          playback.seekPitch(idx);
          switchTab('live');
        };
      });
    }

    function renderStatsTab(box, maxInning) {
      const innCols = Array.from({ length: Math.max(9, maxInning) }, (_, i) => i + 1);
      const buildBatterTable = (teamIdx) => {
        let rows = '';
        let totAb = 0, totR = 0, totH = 0, totRbi = 0, totSo = 0, totBb = 0, totHr = 0;
        for (let i = 0; i < 9; i++) {
          const id = `${teamIdx}-b${i}`;
          const p = matchData.players[id];
          const s = box.batterStats[id];
          totAb += s.ab; totR += s.r; totH += s.h; totRbi += s.rbi; totSo += s.so; totBb += s.bb; totHr += s.hr;
          const avg = s.ab > 0 ? (s.h / s.ab).toFixed(3).replace(/^0/, '') : '.000';
          const innCells = innCols.map((inn) => `<td style="color:${(s.byInning[inn] || '').includes('安') || (s.byInning[inn] || '').includes('本') ? 'var(--v42-red)' : '#cfd6cb'}">${s.byInning[inn] ?? ''}</td>`).join('');
          rows += `<tr>
            <td class="sticky-pos">(${POS_JP[p?.position] ?? '野'})</td>
            <td class="sticky-name">${p?.name ?? id}</td>
            <td>${avg}</td><td>${s.ab}</td><td>${s.r}</td><td>${s.h}</td><td>${s.rbi}</td><td>${s.so}</td><td>${s.bb}</td><td>${s.hr}</td>
            ${innCells}
          </tr>`;
        }
        return `<div class="v42-section-card">
          <div class="v42-section-title">${matchData.teams[teamIdx]} 打者成績（左右にスライドできます）</div>
          <div class="v42-scroll-table-wrap">
            <table class="v42-box-table">
              <thead><tr>
                <th class="sticky-pos">位置</th><th class="sticky-name">選手名</th>
                <th>打率</th><th>打数</th><th>得点</th><th>安打</th><th>打点</th><th>三振</th><th>四球</th><th>本塁打</th>
                ${innCols.map((n) => `<th>${n}回</th>`).join('')}
              </tr></thead>
              <tbody>${rows}</tbody>
              <tfoot><tr style="font-weight:700;background:#151916">
                <td class="sticky-pos">計</td><td class="sticky-name">合計</td>
                <td>${totAb > 0 ? (totH / totAb).toFixed(3).replace(/^0/, '') : '.000'}</td>
                <td>${totAb}</td><td>${totR}</td><td>${totH}</td><td>${totRbi}</td><td>${totSo}</td><td>${totBb}</td><td>${totHr}</td>
                ${innCols.map(() => `<td></td>`).join('')}
              </tr></tfoot>
            </table>
          </div>
        </div>`;
      };

      const buildPitcherTable = () => {
        const ids = ['0-p0', '1-p0'];
        const rows = ids.map((id) => {
          const p = matchData.players[id];
          const s = box.pitcherStats[id];
          const ip = `${Math.floor(s.outs / 3)}.${s.outs % 3}`;
          const era = s.outs > 0 ? ((s.r * 27) / s.outs).toFixed(2) : '0.00';
          return `<tr>
            <td class="sticky-pos">${matchData.teams[p.team]}</td>
            <td class="sticky-name">${p.name}</td>
            <td>${era}</td><td>${ip}</td><td>${s.np}</td><td>${s.bf}</td><td>${s.h}</td><td>${s.hr}</td><td>${s.so}</td><td>${s.bb}</td><td>${s.r}</td>
          </tr>`;
        }).join('');
        return `<div class="v42-section-card">
          <div class="v42-section-title">投手成績（左右にスライドできます）</div>
          <div class="v42-scroll-table-wrap">
            <table class="v42-box-table">
              <thead><tr>
                <th class="sticky-pos">球団</th><th class="sticky-name">選手名</th>
                <th>防御率</th><th>投球回</th><th>球数</th><th>打者</th><th>被安打</th><th>被本塁打</th><th>奪三振</th><th>四球</th><th>失点</th>
              </tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>`;
      };

      statsPane.innerHTML = buildBatterTable(0) + buildBatterTable(1) + buildPitcherTable();
    }

    function syncAll() {
      const snap = playback.inspect();
      const history = snap.host?.history ?? [];
      const throughIdx = snap.selectedPitch >= 0 ? snap.selectedPitch : history.length - 1;
      const box = computeLiveBoxScore(history, throughIdx, matchData);

      // Update Scoreboard Hits / Errors cells so they show live counts
      const scoreRows = document.querySelectorAll('#score-body tr');
      scoreRows.forEach((row, teamIdx) => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 3) {
          cells[cells.length - 2].textContent = String(box.teamHits[teamIdx] ?? 0);
          cells[cells.length - 1].textContent = String(box.teamErrors[teamIdx] ?? 0);
        }
      });

      const match = snap.observedMatch ?? snap.host.match;
      const headerInning = document.getElementById('v42-header-inning');
      if (headerInning) {
        headerInning.textContent = snap.host.finished && throughIdx === history.length - 1
          ? '試合終了'
          : `${match.inning}回${match.half === 'top' ? '表' : '裏'}`;
      }

      // Slide animation trigger when pitch or stage changes
      const animKey = `${snap.selectedPitch}-${snap.presentation?.stage}-${ document.getElementById('result-text')?.textContent }`;
      if (animKey !== lastAnimatedKey && resultDiv) {
        lastAnimatedKey = animKey;
        resultDiv.classList.remove('v42-slide-active');
        void resultDiv.offsetWidth;
        resultDiv.classList.add('v42-slide-active');
      }

      // Draw Batter Silhouette onto #pitch-chart after KneekuraLivePitchChart draws
      const pitchCanvas = document.getElementById('pitch-chart');
      const rec = snap.lastResult;
      const bId = rec?.batterPlayerId ?? snap.host.batterPlayerId;
      const pId = rec?.pitcherPlayerId ?? snap.host.pitcherPlayerId;
      const battingSide = rec?.play?.diagnostics?.battingSide ?? matchData.players[bId]?.hand ?? 'R';
      if (pitchCanvas) {
        drawBatterSilhouetteOnChart(pitchCanvas, battingSide);
      }

      // Update Tactical 2D Field / Pitch Data / Batted Data
      const tacticalCanvas = document.getElementById('v42-tactical-canvas');
      if (tacticalCanvas && (activeStage === 'runner' || activeStage === 'position')) {
        drawTactical2DField(tacticalCanvas, activeStage, snap, matchData);
      }
      renderPitchDataView(snap, box);
      renderBattedDataView(snap);

      // Update Matchup Duel Card mini-stats
      const bs = box.batterStats[bId] ?? { ab: 0, h: 0, hr: 0, rbi: 0, paList: [] };
      const ps = box.pitcherStats[pId] ?? { outs: 0, np: 0, so: 0, bb: 0, r: 0 };
      const avg = bs.ab > 0 ? (bs.h / bs.ab).toFixed(3).replace(/^0/, '') : '.000';
      const era = ps.outs > 0 ? ((ps.r * 27) / ps.outs).toFixed(2) : '0.00';

      batterMini.innerHTML = `
        <div class="v42-mini-stats batter-layout">
          <div class="v42-mini-stat"><span>率</span><b>${avg} (${bs.ab}-${bs.h})</b></div>
        </div>
        <div class="v42-batter-bottom-row">
          <div class="v42-mini-stat" style="gap:6px"><span>本</span><b>${bs.hr}</b></div>
          <div class="v42-pa-chips">
            ${bs.paList.length ? bs.paList.map((pa) => `<span class="v42-pa-chip"><i>${pa.inning}</i><b>${pa.label}</b></span>`).join('') : '<span class="v42-pa-chip"><i>初打席</i></span>'}
          </div>
        </div>
      `;
      pitcherMini.innerHTML = `
        <div class="v42-mini-stats">
          <div class="v42-mini-stat"><span>防</span><b>${era}</b></div>
          <div class="v42-mini-stat"><span>振</span><b>${ps.so}</b></div>
          <div class="v42-mini-stat"><span>球</span><b>${ps.np}</b></div>
          <div class="v42-mini-stat"><span>四</span><b>${ps.bb}</b></div>
        </div>
      `;

      // Update Slide-Down Pitch Sequence Drawer
      const chartHist = snap.presentation?.chart?.history ?? [];
      if (!chartHist.length) {
        pitchDrawer.innerHTML = `<div style="padding:12px 14px;color:var(--v42-muted);font-size:12px;text-align:center;">この打席の投球はまだありません</div>`;
      } else {
        pitchDrawer.innerHTML = [...chartHist].reverse().map((e) => {
          const col = CATEGORY_COLORS[e.category] ?? '#e0b541';
          const selected = e.pitchId === snap.presentation?.chart?.selectedPitchId;
          return `<button type="button" class="v42-seq-row" data-seq-pitch="${e.pitchId}" aria-pressed="${selected}">
            <span class="v42-seq-badge" style="color:${col}">${e.number}</span>
            <span style="font-variant-numeric:tabular-nums">${e.speedKmh}km/h</span>
            <span>${e.pitchType}</span>
            <strong style="color:${col}">${e.resultLabel}</strong>
          </button>`;
        }).join('');
        pitchDrawer.querySelectorAll('[data-seq-pitch]').forEach((btn) => {
          btn.onclick = () => {
            const idx = Number(btn.dataset.seqPitch.replace('live-pitch-', ''));
            if (Number.isInteger(idx) && idx >= 0) playback.seekPitch(idx);
          };
        });
      }

      if (activeTab === 'top') renderTopTab();
      else if (activeTab === 'pbp') renderPbpTab(history, throughIdx);
      else if (activeTab === 'stats') renderStatsTab(box, match.inning);
      updateStageVisibility();
    }

    function switchTab(tab) {
      activeTab = tab;
      globalTabs.querySelectorAll('[data-v42-tab]').forEach((b) => {
        b.setAttribute('aria-selected', String(b.dataset.v42Tab === tab));
      });
      const liveElements = [
        document.querySelector('.play-status'),
        broadcastLayout,
        duelSection,
        document.querySelector('.transport'),
      ];
      liveElements.forEach((el) => { if (el) el.hidden = tab !== 'live'; });
      topPane.classList.toggle('active', tab === 'top');
      pbpPane.classList.toggle('active', tab === 'pbp');
      statsPane.classList.toggle('active', tab === 'stats');
      syncAll();
    }

    // Bind events
    globalTabs.querySelectorAll('[data-v42-tab]').forEach((btn) => {
      btn.onclick = () => switchTab(btn.dataset.v42Tab);
    });

    document.querySelectorAll('[data-v42-stage]').forEach((btn) => {
      btn.onclick = () => {
        activeStage = btn.dataset.v42Stage;
        syncAll();
      };
    });

    drawerToggle.onclick = () => {
      const open = pitchDrawer.classList.toggle('open');
      drawerToggle.setAttribute('aria-expanded', String(open));
    };

    document.getElementById('v42-replay-btn').onclick = () => {
      activeStage = '3d';
      updateStageVisibility();
      const snap = playback.inspect();
      if (snap.generatedPitches === 0) {
        document.getElementById('next-pitch').click();
      } else {
        playback.seekPitch(Math.max(0, snap.selectedPitch));
        document.getElementById('play').click();
      }
    };

    document.getElementById('v42-next-btn').onclick = () => {
      document.getElementById('next-pitch').click();
    };

    const btnMobile = document.getElementById('v42-mode-mobile');
    const btnPc = document.getElementById('v42-mode-pc');
    btnMobile.onclick = () => {
      mobilePreview = true;
      document.body.classList.add('v42-mobile-preview');
      btnMobile.setAttribute('aria-pressed', 'true');
      btnPc.setAttribute('aria-pressed', 'false');
      updateStageVisibility();
    };
    btnPc.onclick = () => {
      mobilePreview = false;
      document.body.classList.remove('v42-mobile-preview');
      btnMobile.setAttribute('aria-pressed', 'false');
      btnPc.setAttribute('aria-pressed', 'true');
      updateStageVisibility();
    };

    // Observe UI updates via MutationObserver on #announcement / #result-text / #pitch-list + periodic sync during playback
    const obs = new MutationObserver(() => syncAll());
    for (const id of ['result-text', 'pitch-meta', 'inning-label', 'pitch-list']) {
      const el = document.getElementById(id);
      if (el) obs.observe(el, { childList: true, characterData: true, subtree: true });
    }
    setInterval(() => {
      if (playback.inspect().playing || activeStage === 'runner' || activeStage === 'position') syncAll();
    }, 110);

    renderTopTab();
    syncAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof globalThis === 'object' ? globalThis : this);
