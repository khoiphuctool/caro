// ===== LỊCH SỬ & BẢNG XẾP HẠNG =====

const HISTORY_KEY = 'caro_history_v1';
const MAX_HISTORY = 50;

function loadHistory() {
    try {
        const raw = JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
        return raw.map(m => ({ ...m, time: new Date(m.time) }));
    } catch(e) { return []; }
}
function saveHistory(arr) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(arr));
}

let matchHistory = loadHistory();

function recordMatch(result, winner) {
    const boardLabel = '♾️ Vô Hạn';
    const actualMode      = isAutoplayRunning ? 'autoplay' : gameMode;
    const actualModeLabel = isAutoplayRunning ? '🤖 Autoplay (Bot Tự Học)' : (MODE_LABELS[gameMode] || gameMode);

    const entry = {
        result, winner,
        mode: actualMode, modeLabel: actualModeLabel,
        winCount, boardLabel,
        moves: moveCount,
        humanPiece, botPiece,
        time: new Date()
    };
    matchHistory.unshift(entry);
    if (matchHistory.length > MAX_HISTORY) matchHistory = matchHistory.slice(0, MAX_HISTORY);
    saveHistory(matchHistory);
    renderHistory();
    apiPost('/api/history', { ...entry, time: entry.time.toISOString() });
    const hp = document.getElementById('history-panel');
    if (hp) hp.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // Chuỗi thua liên tiếp
    if (gameMode.startsWith('ai')) {
        if (result === 'lose') {
            lossStreak++;
            localStorage.setItem(LOSS_STREAK_KEY, lossStreak);
            if (lossStreak > lossStreakRecord) {
                lossStreakRecord = lossStreak;
                localStorage.setItem(LOSS_STREAK_RECORD_KEY, lossStreakRecord);
            }
        } else if (result === 'win') {
            if (lossStreak > 0) {
                const brokenRecord = lossStreak > lossStreakRecord && lossStreak > 1;
                lossStreak = 0;
                localStorage.setItem(LOSS_STREAK_KEY, lossStreak);
                if (brokenRecord) {
                    setTimeout(() => {
                        alert(`🌟 CHÚC MỪNG! Bạn đã phá vỡ kỷ lục thua ${lossStreakRecord} ván liên tiếp! 🌟`);
                    }, 1000);
                }
            }
        }
    }
}

function renderHistory() {
    const list     = document.getElementById('history-list');
    const btnClear = document.getElementById('btn-clear-history');
    if (!list) return;

    if (matchHistory.length === 0) {
        list.innerHTML = '<div style="text-align:center;opacity:0.45;font-size:0.9rem;padding:12px 0;">Chưa có ván đấu nào.</div>';
        if (btnClear) btnClear.style.display = 'none';
        return;
    }
    if (btnClear) btnClear.style.display = 'block';

    list.innerHTML = matchHistory.map((m, i) => {
        let emoji, label, cls;
        if (m.result === 'draw') {
            emoji = '🤝'; label = 'Hòa'; cls = 'draw';
        } else if (m.mode === 'solo') {
            emoji = '🏆'; label = `Người <b>${m.winner}</b> Thắng`; cls = 'win';
        } else if (m.result === 'win') {
            emoji = '🏆'; label = `<b>Bạn (${m.humanPiece || humanPiece || 'X'}) Thắng</b>`; cls = 'win';
        } else {
            emoji = '💀'; label = `<b>Bot (${m.botPiece || botPiece || 'O'}) Thắng</b>`; cls = 'lose';
        }
        const timeStr  = m.time.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const movesStr = m.moves ? ` · ${m.moves} nước` : '';
        return `<div class="history-item ${cls}">
            <span class="h-num">#${matchHistory.length - i}</span>
            <span class="h-result">${emoji}</span>
            <div class="h-info">
                <span>${label}</span>
                <span class="h-mode"> — ${m.modeLabel} | ${m.boardLabel} | ${m.winCount} quân${movesStr} | ${timeStr}</span>
            </div>
        </div>`;
    }).join('');
}

function clearHistory() {
    matchHistory = [];
    saveHistory([]);
    renderHistory();
    apiDelete('/api/history');
}

function toggleHistory() {
    const body = document.getElementById('history-body');
    const icon = document.getElementById('history-toggle-icon');
    const isOpen = body.classList.toggle('open');
    if (icon) icon.textContent = isOpen ? '▼' : '▶';
}

function applyHistoryTheme(t) {
    const hp  = document.getElementById('history-panel');
    const ht  = document.getElementById('history-title');
    const hb  = document.getElementById('history-body');
    const ti  = document.getElementById('history-toggle-icon');
    const bc  = document.getElementById('btn-clear-history');
    const rp  = document.getElementById('rank-panel');
    const rt  = document.getElementById('rank-title');
    const br  = document.getElementById('btn-clear-rank');
    const configs = {
        'pure-white':  { bg:'#ffffff', border:'#e2e8f0', titleColor:'#0f172a', titleBorder:'#e2e8f0', btnBg:'#f1f5f9', btnColor:'#475569', toggleColor:'#475569' },
        'pure-black':  { bg:'#242440', border:'#3b3b60', titleColor:'#c084fc', titleBorder:'#3b3b60', btnBg:'#2e2e50', btnColor:'#e2e8f0', toggleColor:'#c084fc' },
        'cyber':       { bg:'#1e293b', border:'#334155', titleColor:'#38bdf8', titleBorder:'#334155', btnBg:'#0f172a', btnColor:'#38bdf8', toggleColor:'#38bdf8' },
        'luxury-wood': { bg:'#2d2219', border:'#8c6239', titleColor:'#d4af37', titleBorder:'#8c6239', btnBg:'#6f4724', btnColor:'#f4f1de', toggleColor:'#d4af37' }
    };
    const cfg = configs[t] || configs['pure-white'];
    if (hp) { hp.style.background = cfg.bg; hp.style.border = `1px solid ${cfg.border}`; }
    if (ht) ht.style.color = cfg.titleColor;
    if (hb) hb.style.borderTopColor = cfg.titleBorder;
    if (ti) ti.style.color = cfg.toggleColor;
    if (bc) { bc.style.background = cfg.btnBg; bc.style.color = cfg.btnColor; }
    if (rp) { rp.style.background = cfg.bg; rp.style.border = `1px solid ${cfg.border}`; }
    if (rt) { rt.style.color = cfg.titleColor; rt.style.borderBottomColor = cfg.titleBorder; }
    if (br) { br.style.background = cfg.btnBg; br.style.color = cfg.btnColor; }
}

// ===== BẢNG XẾP HẠNG =====
const RANK_KEY = 'caro_rank_v2';

function calculateScore(moves, mode, winCount, dangerScore, totalTime) {
    const baseScore          = 5000;
    const timePenalty        = totalTime * 5;
    const difficultyMultiplier = DIFFICULTY_MULTIPLIERS[mode] || 1;
    const winCountMultiplier   = WIN_COUNT_MULTIPLIERS[winCount] || 1;
    const cappedDangerBonus    = Math.min(dangerScore * 10, 1000);
    const score = Math.round((baseScore + cappedDangerBonus - timePenalty) * difficultyMultiplier * winCountMultiplier);
    return Math.max(0, score);
}

function loadRank() {
    try {
        const data     = JSON.parse(localStorage.getItem(RANK_KEY)) || {};
        const migrated = {};
        for (const [k, v] of Object.entries(data)) {
            if (k.includes('|')) migrated[k] = v;
        }
        if (Object.keys(migrated).length === 0) {
            try {
                const oldData = JSON.parse(localStorage.getItem('caro_rank_v1')) || {};
                for (const [k, entries] of Object.entries(oldData)) {
                    if (!k.includes('|')) continue;
                    const { mode, winCnt } = parseRankKey(k);
                    migrated[k] = entries.map(e => ({
                        ...e,
                        score: calculateScore(e.moves, mode, winCnt, 0, 0)
                    })).sort((a, b) => b.score - a.score).slice(0, 20);
                }
                if (Object.keys(migrated).length > 0) {
                    saveRank(migrated);
                    localStorage.removeItem('caro_rank_v1');
                }
            } catch(e) {}
        }
        return migrated;
    } catch(e) { return {}; }
}
function saveRank(data) {
    localStorage.setItem(RANK_KEY, JSON.stringify(data));
}

function getRankKey(mode, winCnt, boardLabel) {
    return `${mode}|${winCnt}q|${boardLabel}`;
}
function parseRankKey(k) {
    const [mode, qPart, boardLabel] = k.split('|');
    return { mode, winCnt: parseInt(qPart), boardLabel };
}
function getRankModes() {
    const data   = loadRank();
    const modes  = [...new Set(Object.keys(data).map(k => parseRankKey(k).mode))];
    const order  = ['solo','ai-easy','ai-medium','ai-hard','ai-god'];
    return modes.sort((a, b) => order.indexOf(a) - order.indexOf(b));
}
function getRankSubKeys(mode) {
    const data = loadRank();
    return Object.keys(data)
        .filter(k => k.startsWith(mode + '|'))
        .sort((a, b) => {
            const pa = parseRankKey(a), pb = parseRankKey(b);
            return pa.winCnt !== pb.winCnt ? pa.winCnt - pb.winCnt : a.localeCompare(b);
        });
}

let currentRankMode = null;
let currentRankTab  = null;

function renderRankPanel() {
    const data     = loadRank();
    const modes    = getRankModes();
    const tabsEl   = document.getElementById('rank-tabs');
    const listEl   = document.getElementById('rank-list');
    const btnClear = document.getElementById('btn-clear-rank');

    if (modes.length === 0) {
        tabsEl.innerHTML = '';
        listEl.innerHTML = '<div style="text-align:center;opacity:0.45;font-size:0.9rem;padding:12px 0;">Chưa có kỷ lục nào.</div>';
        if (btnClear) btnClear.style.display = 'none';
        return;
    }
    if (btnClear) btnClear.style.display = 'block';

    if (!currentRankMode || !modes.includes(currentRankMode)) currentRankMode = modes[0];

    const subKeys = getRankSubKeys(currentRankMode);
    if (!currentRankTab || !data[currentRankTab] || !currentRankTab.startsWith(currentRankMode + '|')) {
        currentRankTab = subKeys[0] || null;
    }

    const modeTabsHtml = modes.map(m => {
        const active = m === currentRankMode ? ' active' : '';
        return `<button class="rank-tab${active}" onclick="switchRankMode('${m}')">${MODE_LABELS[m] || m}</button>`;
    }).join('');

    const subTabsHtml = subKeys.map(k => {
        const { winCnt, boardLabel } = parseRankKey(k);
        const active = k === currentRankTab ? ' active' : '';
        return `<button class="rank-tab${active}" style="font-size:0.78rem;padding:3px 10px" onclick="switchRankTab('${k}')">${winCnt} quân · ${boardLabel}</button>`;
    }).join('');

    tabsEl.innerHTML = `
        <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin-bottom:6px">${modeTabsHtml}</div>
        ${subKeys.length > 1 ? `<div style="display:flex;gap:5px;flex-wrap:wrap;justify-content:center">${subTabsHtml}</div>` : ''}
    `;

    if (!currentRankTab) {
        listEl.innerHTML = '<div style="text-align:center;opacity:0.45;font-size:0.9rem;padding:8px 0;">Chưa có kỷ lục.</div>';
        return;
    }
    const entries = (data[currentRankTab] || []).slice(0, 50);
    const medals  = ['🥇','🥈','🥉'];
    listEl.innerHTML = entries.map((e, i) => `
        <div class="rank-item rank-${i+1}">
            <span class="rank-medal">${medals[i] || `#${i+1}`}</span>
            <span class="rank-name">${e.name}</span>
            <span class="rank-time">${e.score ? e.score.toLocaleString('vi-VN') : e.moves} ${e.score ? 'điểm' : 'nước'}</span>
            <span class="rank-meta">${e.moves || ''} ${e.moves ? 'nước' : ''} · ${e.totalTime || '--:--'} · ${e.date || '--/--/--'} · ${e.time || '--:--:--'}</span>
            ${e.moveHistory && e.moveHistory.length > 0
                ? `<button onclick="loadRankHistory(${i})" style="margin-left:8px;padding:2px 8px;font-size:0.75rem;border-radius:4px;border:1px solid #444;background:#222;color:#fff;cursor:pointer;">📺 Xem lại</button>`
                : ''}
        </div>
    `).join('');
}

function switchRankMode(mode) {
    currentRankMode = mode;
    currentRankTab  = null;
    renderRankPanel();
}
function switchRankTab(key) {
    currentRankTab = key;
    renderRankPanel();
}

function loadRankHistory(index) {
    const data = loadRank();
    if (!currentRankTab || !data[currentRankTab]) return;
    const entry = data[currentRankTab][index];
    if (!entry || !entry.moveHistory || entry.moveHistory.length === 0) {
        alert('Không có lịch sử trận đấu này!');
        return;
    }
    document.getElementById('rank-panel').classList.remove('show');
    const { winCnt, boardLabel } = parseRankKey(currentRankTab);
    initGameWithConfig(winCnt, boardLabel);
    moveHistory = [...entry.moveHistory];
    statusPanel.innerHTML = `📺 Đang xem lại trận đấu · ${entry.name} · ${entry.score.toLocaleString('vi-VN')} điểm &nbsp;|&nbsp; <button onclick="closeHistoryView()" style="padding:4px 12px;border-radius:6px;border:none;cursor:pointer;font-weight:bold;font-size:0.85rem;background:#dc2626;color:#fff;">❌ Đóng</button>`;
    renderBoardFromHistory();
}

function renderBoardFromHistory() {
    if (isInfinite) {
        infiniteMap.clear();
    } else {
        for (let r = 0; r < boardSize; r++)
            for (let c = 0; c < boardSize; c++)
                boardState[r][c] = "";
    }
    for (const move of moveHistory) {
        const { r, c, player } = move;
        if (isInfinite) {
            infiniteMap.set(`${r},${c}`, player);
        } else {
            if (r >= 0 && r < boardSize && c >= 0 && c < boardSize) boardState[r][c] = player;
        }
    }
    if (isInfinite) {
        renderInfiniteBoard();
        if (moveHistory.length > 0) {
            const lastMove = moveHistory[moveHistory.length - 1];
            vRowF = lastMove.r - (infCanvasH / INF_CS) / 2;
            vColF = lastMove.c - (infCanvasW / INF_CS) / 2;
            renderInfiniteBoard();
        }
    } else {
        renderBoard();
    }
}

function closeHistoryView() { initGame(); }

function initGameWithConfig(wc, boardLabel) {
    let size = 15;
    if (boardLabel.includes('10x10')) size = 10;
    else if (boardLabel.includes('20x20')) size = 20;
    else if (boardLabel.includes('25x25')) size = 25;
    boardSize  = size;
    winCount   = wc;
    isInfinite = boardLabel.includes('Vô hạn');
    initGame();
}

function clearRank() {
    if (!confirm('Xóa toàn bộ bảng xếp hạng?')) return;
    localStorage.removeItem(RANK_KEY);
    currentRankMode = null;
    currentRankTab  = null;
    renderRankPanel();
    apiDelete('/api/rank');
}

function promptRankName(moves, mode, winCnt, boardLabel, winnerLabel, dangerScore, totalTime) {
    const score    = calculateScore(moves, mode, winCnt, dangerScore, totalTime);
    const now      = new Date();
    const dateStr  = now.toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit', year:'2-digit' });
    const timeStr  = now.toLocaleTimeString('vi-VN', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
    const totalTimeStr = `${Math.floor(totalTime/60)}:${(totalTime%60).toString().padStart(2,'0')}`;

    pendingRankEntry = { moves, mode, winCnt, boardLabel, score, dangerScore, totalTime, date: dateStr, time: timeStr };

    const sub = document.getElementById('name-overlay-sub');
    if (sub) sub.innerHTML = `🏅 ${score.toLocaleString('vi-VN')} điểm<br><span style="opacity:0.7;font-size:0.85rem">${winnerLabel} · ${MODE_LABELS[mode] || mode} · ${winCnt} quân · ${boardLabel} · ${moves} nước · ${totalTimeStr} · ${dateStr} · ${timeStr}</span>`;
    const inp = document.getElementById('name-input');
    if (inp) inp.value = '';
    document.getElementById('name-overlay').classList.add('show');
    setTimeout(() => inp && inp.focus(), 100);
}

function saveRankEntry() {
    const inp  = document.getElementById('name-input');
    const name = (inp ? inp.value.trim() : '') || 'Ẩn Danh';
    if (!pendingRankEntry) { closeNameOverlay(); return; }
    const { moves, mode, winCnt, boardLabel, score, dangerScore, totalTime, date, time } = pendingRankEntry;
    const data        = loadRank();
    const key         = getRankKey(mode, winCnt, boardLabel);
    if (!data[key]) data[key] = [];
    const totalTimeStr = `${Math.floor(totalTime/60)}:${(totalTime%60).toString().padStart(2,'0')}`;
    data[key].push({ name, score, moves, date, time, totalTime: totalTimeStr, dangerScore, moveHistory: [...moveHistory] });
    data[key].sort((a, b) => b.score - a.score);
    data[key] = data[key].slice(0, 50);
    saveRank(data);
    currentRankMode  = mode;
    currentRankTab   = key;
    pendingRankEntry = null;
    closeNameOverlay();
    renderRankPanel();
    apiPost('/api/rank', { key, name, score, moves, date, time, totalTime: totalTimeStr, dangerScore, moveHistory });
    const rp = document.getElementById('rank-panel');
    if (rp) setTimeout(() => rp.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 200);
}

function closeNameOverlay() {
    document.getElementById('name-overlay').classList.remove('show');
}

function setupNameInputListener() {
    const inp = document.getElementById('name-input');
    if (inp) {
        inp.addEventListener('keydown', e => {
            if (e.key === 'Enter')  saveRankEntry();
            if (e.key === 'Escape') closeNameOverlay();
        });
    }
}

// ===== PANEL RESIZE =====
const PANEL_SIZE_KEY = 'caro_panel_sizes';

function loadPanelSizes() {
    try { return JSON.parse(localStorage.getItem(PANEL_SIZE_KEY)) || {}; }
    catch(e) { return {}; }
}
function savePanelSizes(sizes) {
    localStorage.setItem(PANEL_SIZE_KEY, JSON.stringify(sizes));
}
function applyPanelSizes() {
    const sizes        = loadPanelSizes();
    const historyPanel = document.getElementById('history-panel');
    const rankPanel    = document.getElementById('rank-panel');
    if (sizes.history && historyPanel) historyPanel.style.width = sizes.history + 'px';
    if (sizes.rank    && rankPanel)    rankPanel.style.width    = sizes.rank    + 'px';
}
function setupPanelResize() {
    const handles = document.querySelectorAll('.resize-handle');
    handles.forEach(handle => {
        handle.addEventListener('mousedown', (e) => {
            e.preventDefault(); e.stopPropagation();
            const panel     = handle.closest('#history-panel, #rank-panel');
            if (!panel) return;
            const panelType = handle.getAttribute('data-panel');
            const startX    = e.clientX;
            const startWidth = panel.offsetWidth;

            function onMouseMove(ev) {
                const dx = ev.clientX - startX;
                const newWidth = Math.max(100, Math.min(500, startWidth + dx));
                panel.style.width = newWidth + 'px';
            }
            function onMouseUp() {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup',   onMouseUp);
                const sizes = loadPanelSizes();
                sizes[panelType] = panel.offsetWidth;
                savePanelSizes(sizes);
            }
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup',   onMouseUp);
        });
    });
}

// ===== MERGE UTILITIES (giữ cho tương thích) =====
function mergeLeaderboard(importedLeaderboard, localLeaderboard) {
    const mergedMap = new Map();
    importedLeaderboard.forEach(p => mergedMap.set(p.name.trim().toLowerCase(), { ...p }));
    localLeaderboard.forEach(p => {
        const key = p.name.trim().toLowerCase();
        if (mergedMap.has(key)) {
            if (p.score > mergedMap.get(key).score) mergedMap.set(key, { ...p });
        } else {
            mergedMap.set(key, { ...p });
        }
    });
    return Array.from(mergedMap.values()).sort((a, b) => b.score - a.score);
}

function mergeRankDataWithDedup(importedRankData, localRank) {
    for (const [key, importedEntries] of Object.entries(importedRankData)) {
        if (!Array.isArray(importedEntries)) continue;
        if (!localRank[key]) localRank[key] = [];
        const mergedMap = new Map();
        importedEntries.forEach(e => mergedMap.set(e.name.trim().toLowerCase(), { ...e }));
        localRank[key].forEach(e => {
            const k = e.name.trim().toLowerCase();
            if (mergedMap.has(k)) {
                if (e.score > mergedMap.get(k).score) mergedMap.set(k, { ...e });
            } else {
                mergedMap.set(k, { ...e });
            }
        });
        localRank[key] = Array.from(mergedMap.values()).sort((a,b) => b.score - a.score).slice(0, 50);
    }
    return localRank;
}
