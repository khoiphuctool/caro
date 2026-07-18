// ===== CẤU HÌNH - API, THEMES, HẰNG SỐ =====

// Đổi thành URL server thật khi deploy, ví dụ: 'https://your-server.com'
// Để trống ('') nếu chỉ dùng localStorage (offline)
const API_URL = '';

async function apiGet(path) {
    if (!API_URL) return null;
    try { return await (await fetch(API_URL + path)).json(); }
    catch(e) { console.warn('API offline:', e); return null; }
}
async function apiPost(path, body) {
    if (!API_URL) return null;
    try {
        return await (await fetch(API_URL + path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        })).json();
    } catch(e) { console.warn('API offline:', e); return null; }
}
async function apiDelete(path) {
    if (!API_URL) return null;
    try { return await (await fetch(API_URL + path, { method: 'DELETE' })).json(); }
    catch(e) { console.warn('API offline:', e); return null; }
}

// ===== THEMES =====
const themes = {
    'pure-white': `
        body { background: #f8fafc; color: #1e293b; }
        h1 { color: #0f172a; }
        .config-panel { background: #ffffff; border: 1px solid #e2e8f0; color: #475569; }
        select { background: #f1f5f9; color: #1e293b; border: 1px solid #cbd5e1; }
        .status-panel { background: #ffffff; border: 1px solid #e2e8f0; color: #0f172a; }
        .side-panel { background: #ffffff; border: 1px solid #e2e8f0; }
        .side-panel h3 { color: #0f172a; border-bottom: 2px solid #e2e8f0; }
        .game-container { background: #ffffff; border: 4px solid #cbd5e1; }
        .board { background: #cbd5e1; }
        .cell { background: #ffffff; color: #1e293b; border: 1px solid rgba(0,0,0,0.03); }
        .cell:not(.X):not(.O):hover { background: #f1f5f9; }
        .cell.X { color: #2563eb; } .cell.O { color: #dc2626; }
        .cell.X::before { content: "X"; } .cell.O::before { content: "O"; }
        .cell.winning-cell { background: #dbeafe !important; box-shadow: inset 0 0 8px #2563eb; }
        .btn-restart { background: #2563eb; color: white; }
        .turn-X { color: #2563eb; } .turn-O { color: #dc2626; }
    `,
    'pure-black': `
        body { background: #1a1a2e; color: #e2e8f0; }
        h1 { background: linear-gradient(to right, #c084fc, #818cf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .config-panel { background: #242440; border: 1px solid #3b3b60; color: #c4c4e0; }
        select { background: #2e2e50; color: #e2e8f0; border: 1px solid #4a4a70; }
        .status-panel { background: #242440; border: 1px solid #3b3b60; color: #e2e8f0; }
        .side-panel { background: #242440; border: 1px solid #3b3b60; }
        .side-panel h3 { color: #c084fc; border-bottom: 2px solid #3b3b60; }
        .game-container { background: #1e1e38; border: 4px solid #3b3b60; }
        .board { background: #2e2e50; }
        .cell { background: #242440; color: #e2e8f0; border: 1px solid rgba(255,255,255,0.05); }
        .cell:not(.X):not(.O):hover { background: #32325a; }
        .cell.X { color: #818cf8; text-shadow: 0 0 6px #818cf8; }
        .cell.O { color: #f472b6; text-shadow: 0 0 6px #f472b6; }
        .cell.X::before { content: "X"; } .cell.O::before { content: "O"; }
        .cell.winning-cell { background: #3730a3 !important; box-shadow: inset 0 0 8px #818cf8; }
        .btn-restart { background: linear-gradient(135deg, #818cf8, #c084fc); color: #fff; }
        .turn-X { color: #818cf8; } .turn-O { color: #f472b6; }
    `,
    'cyber': `
        body { background: #0f172a; color: #fff; }
        h1 { background: linear-gradient(to right, #38bdf8, #f43f5e); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .config-panel { background: #1e293b; border: 1px solid #334155; color: #38bdf8; }
        select { background: #0f172a; color: white; border: 1px solid #475569; }
        .status-panel { background: #1e293b; border: 1px solid #334155; }
        .side-panel { background: #1e293b; border: 1px solid #334155; }
        .side-panel h3 { color: #38bdf8; border-bottom: 2px solid #334155; }
        .game-container { background: #0f172a; border: 4px solid #334155; }
        .board { background: #334155; }
        .cell { background: #1e293b; color: #fff; }
        .cell:not(.X):not(.O):hover { background: #475569; }
        .cell.X { color: #38bdf8; text-shadow: 0 0 8px #38bdf8; }
        .cell.O { color: #f43f5e; text-shadow: 0 0 8px #f43f5e; }
        .cell.X::before { content: "X"; } .cell.O::before { content: "O"; }
        .cell.winning-cell { background: #0284c7 !important; }
        .btn-restart { background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; }
        .turn-X { color: #38bdf8; } .turn-O { color: #f43f5e; }
        .cell.last-move { outline: 3px solid #f43f5e !important; }
    `,
    'luxury-wood': `
        body { background: #1a1510; color: #f4f1de; font-family: Georgia, serif; }
        h1 { background: linear-gradient(to bottom, #f3e5ab, #d4af37); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .config-panel { background: #2d2219; border: 1px solid #5c4033; color: #d4af37; }
        select { background: #0f0a07; color: #f4f1de; border: 1px solid #8c6239; }
        .status-panel { background: #2d2219; border: 1px solid #4a3525; }
        .side-panel { background: #2d2219; border: 2px solid #8c6239; }
        .side-panel h3 { color: #d4af37; border-bottom: 2px solid #8c6239; }
        .game-container { background: #5c4033; border: 4px solid #3d2b1f; }
        .board { background: #2b1d15; }
        .cell { background: #c2996b; border: 1px solid rgba(0,0,0,0.1); }
        .cell:not(.X):not(.O):hover { background: #b08556; }
        .cell.X::before, .cell.O::before { content: ''; width: 75%; height: 75%; border-radius: 50%; display: block; box-shadow: 1px 2px 4px rgba(0,0,0,0.4); }
        .cell.X::before { background: radial-gradient(circle at 35% 35%, #ffffff, #9c9284); }
        .cell.O::before { background: radial-gradient(circle at 35% 35%, #555555, #000000); border: 1px solid #d4af37; }
        .cell.winning-cell { background: #b08556 !important; box-shadow: 0 0 10px #ffd700; }
        .btn-restart { background: #6f4724; color: #f4f1de; border: 1px solid #3d2b1f; }
        .turn-X { color: #ffffff; } .turn-O { color: #d4af37; }
        .cell.last-move { outline: 3px solid #ffd700 !important; }
    `
};

function changeTheme() {
    const selectedTheme = document.getElementById('theme-select').value;
    document.getElementById('theme-styles').innerHTML = themes[selectedTheme];
    applyHistoryTheme(selectedTheme);
    renderInfiniteBoard();
}

// ===== NHÃN CHẾ ĐỘ CHƠI =====
const MODE_LABELS = {
    'solo':      '2 Người',
    'ai-hard':   'Bot Khó',
    'ai-god':    'Bot Tối Thượng 💀'
};

// ===== HỆ SỐ ĐIỂM =====
const DIFFICULTY_MULTIPLIERS = {
    'solo': 0.5,
    'ai-hard': 2,
    'ai-god': 3
};

const WIN_COUNT_MULTIPLIERS = {
    3: 0.5, 4: 0.7, 5: 1, 6: 1.3,
    7: 1.6, 8: 2,   9: 2.5, 10: 3
};
