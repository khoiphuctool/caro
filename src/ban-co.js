// ===== BÀN CỜ - Render canvas vô hạn, zoom, pan, resize =====

// Thiết lập kích thước ô cờ mặc định ban đầu
let kichThuocOCoHienTai = 24;

// Hàm thay đổi kích thước ô cờ cho cả fixed board và infinite board
function thayDoiKichThuocCo(luongThayDoi) {
    kichThuocOCoHienTai += luongThayDoi;
    
    // Khống chế giới hạn: Thấp nhất là 18px, cao nhất 40px
    if (kichThuocOCoHienTai < 18) kichThuocOCoHienTai = 18;
    if (kichThuocOCoHienTai > 40) kichThuocOCoHienTai = 40;
    
    // TRƯỜNG HỢP A: Nếu bàn cờ dùng các ô thẻ <td> (TABLE - Fixed Board)
    const tatCaOCo = document.querySelectorAll('#board .cell');
    if (tatCaOCo.length > 0) {
        const fontSize = kichThuocOCoHienTai >= 30 ? "1.2rem" : (kichThuocOCoHienTai >= 24 ? "1rem" : "0.9rem");
        boardElement.style.gridTemplateColumns = `repeat(${boardSize}, ${kichThuocOCoHienTai}px)`;
        boardElement.style.gridTemplateRows = `repeat(${boardSize}, ${kichThuocOCoHienTai}px)`;
        tatCaOCo.forEach(oCo => {
            oCo.style.width = kichThuocOCoHienTai + 'px';
            oCo.style.height = kichThuocOCoHienTai + 'px';
            oCo.style.minWidth = kichThuocOCoHienTai + 'px';
            oCo.style.fontSize = fontSize;
        });
        return;
    }
    
    // TRƯỜNG HỢP B: Nếu bàn cờ dùng <canvas> (Infinite Board)
    if (typeof INF_CS !== 'undefined') {
        INF_CS = kichThuocOCoHienTai;
        saveZoom();
        if (typeof renderInfiniteBoard === 'function') {
            renderInfiniteBoard();
        }
    }
}

// ===== RENDER BÀN CỐ ĐỊNH =====
function renderFixedBoard() {
    boardElement.innerHTML = "";
    for (let r = 0; r < boardSize; r++)
        for (let c = 0; c < boardSize; c++)
            boardElement.appendChild(makeCell(r, c));
    recalculateCellSizes();
}

// Vẽ điểm lên bàn DOM — gọi sau khi bot tính xong
function renderCellScoresDOM() {
    const showScores = document.getElementById('show-cell-scores');
    if (!showScores || !showScores.checked || !window.cellScores) return;

    // Xóa điểm cũ
    for (const el of document.querySelectorAll('.cell-score-label')) el.remove();

    const entries = Object.entries(window.cellScores)
        .map(([key, val]) => ({ key, val }))
        .sort((a, b) => b.val - a.val)
        .slice(0, 4);
    const top1Key = entries.length > 0 ? entries[0].key : null;

    for (const { key, val } of entries) {
        const [r, c] = key.split(',').map(Number);
        const cell = document.querySelector(`[data-row='${r}'][data-col='${c}']`);
        if (!cell || cell.classList.contains('X') || cell.classList.contains('O')) continue;
        const isTop = key === top1Key;
        const label = val >= 10000 ? `${Math.round(val/1000)}k` : `${(val/1000).toFixed(1)}k`;
        const span = document.createElement('span');
        span.className = 'cell-score-label';
        span.textContent = label;
        span.style.cssText = `
            position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);
            font-size:${isTop ? '0.55em' : '0.45em'}; font-weight:bold; pointer-events:none;
            color:${isTop ? 'rgba(180,100,0,0.55)' : 'rgba(79,70,229,0.45)'};
            background:${isTop ? 'rgba(245,158,11,0.12)' : 'rgba(99,102,241,0.08)'};
            border-radius:2px; padding:0 1px; line-height:1.1; white-space:nowrap;
        `;
        cell.style.position = 'relative';
        cell.appendChild(span);
    }
}

function recalculateCellSizes() {
    if (isInfinite) return;
    const sz = boardSize;
    let cellSize, fontSize;
    if      (sz <= 3)  { cellSize = 100; fontSize = "2.2rem"; }
    else if (sz <= 5)  { cellSize = 80;  fontSize = "1.8rem"; }
    else if (sz <= 8)  { cellSize = 58;  fontSize = "1.4rem"; }
    else if (sz <= 10) { cellSize = 50;  fontSize = "1.2rem"; }
    else if (sz <= 15) { cellSize = 36;  fontSize = "1.1rem"; }
    else if (sz <= 20) { cellSize = 28;  fontSize = "1rem";   }
    else               { cellSize = 22;  fontSize = "0.9rem"; }

    boardElement.style.gridTemplateColumns = `repeat(${sz}, ${cellSize}px)`;
    boardElement.style.gridTemplateRows    = `repeat(${sz}, ${cellSize}px)`;
    for (const cell of boardElement.getElementsByClassName('cell')) {
        cell.style.width    = `${cellSize}px`;
        cell.style.height   = `${cellSize}px`;
        cell.style.fontSize = fontSize;
    }
}

// ===== RENDER BÀN VÔ HẠN — CANVAS ENGINE =====
let INF_CS = 36;
const INF_CS_MIN = 18, INF_CS_MAX = 80;

let infCanvas = null, infCtx = null;
let infCanvasW = 0, infCanvasH = 0;
let panStartX = 0, panStartY = 0, panStartVRow = 0, panStartVCol = 0;
let infPanning = false;
let vRowF = 0, vColF = 0;

function initInfCanvas() {
    infCanvas = document.getElementById('inf-canvas');
    infCtx    = infCanvas.getContext('2d');
    document.getElementById('board').style.display = 'none';

    const wrapper = document.getElementById('inf-resizable');
    wrapper.style.display = 'inline-block';

    const gc = document.getElementById('ui-game-container');
    gc.classList.add('inf-mode');

    infCanvas.onmousedown   = infOnMouseDown;
    infCanvas.onmousemove   = infOnMouseMove;
    infCanvas.onmouseup     = infOnMouseUp;
    infCanvas.onmouseleave  = infOnMouseLeave;
    infCanvas.onclick       = infOnClick;
    infCanvas.oncontextmenu = e => e.preventDefault();
    infCanvas.ontouchstart  = infOnTouchStart;
    infCanvas.ontouchmove   = infOnTouchMove;
    infCanvas.ontouchend    = infOnTouchEnd;
    infCanvas.addEventListener('wheel', infOnWheel, { passive: false });

    document.removeEventListener('keydown', infOnKeyDown);
    document.addEventListener('keydown', infOnKeyDown);

    setupResizeHandles();
    INF_CS = loadZoom();

    infCanvasW = 400; infCanvasH = 300;
    infCanvas.width = infCanvasW; infCanvas.height = infCanvasH;
    updateCursorByTurn();
    requestAnimationFrame(() => requestAnimationFrame(() => resizeInfCanvas()));
}

// ===== RESIZE HANDLES =====
const CANVAS_SIZE_KEY = 'caro_canvas_size';

function loadCanvasSize() {
    try { return JSON.parse(localStorage.getItem(CANVAS_SIZE_KEY)) || null; }
    catch(e) { return null; }
}
function saveCanvasSize(w, h) {
    localStorage.setItem(CANVAS_SIZE_KEY, JSON.stringify({ w, h }));
}
function applyCanvasSize(w, h) {
    infCanvasW = Math.max(8 * INF_CS, Math.round(w / INF_CS) * INF_CS);
    infCanvasH = Math.max(8 * INF_CS, Math.round(h / INF_CS) * INF_CS);
    infCanvas.width  = infCanvasW;
    infCanvas.height = infCanvasH;
    infCanvas.style.width  = infCanvasW + 'px';
    infCanvas.style.height = infCanvasH + 'px';
    renderInfiniteBoard();
}
function setupResizeHandles() {
    const wrapper = document.getElementById('inf-resizable');
    if (!wrapper) return;
    wrapper.querySelectorAll('.rs-handle').forEach(handle => {
        handle.addEventListener('mousedown', onResizeStart);
    });
}
function onResizeStart(e) {
    e.preventDefault(); e.stopPropagation();
    const dir    = e.currentTarget.getAttribute('data-dir');
    const startX = e.clientX, startY = e.clientY;
    const startW = infCanvasW, startH = infCanvasH;

    function onMove(ev) {
        const dx = ev.clientX - startX, dy = ev.clientY - startY;
        let newW = startW, newH = startH;
        if (dir.includes('e'))  newW = startW + dx;
        if (dir.includes('w'))  newW = startW - dx;
        if (dir.includes('s'))  newH = startH + dy;
        if (dir.includes('n'))  newH = startH - dy;
        applyCanvasSize(newW, newH);
    }
    function onUp() {
        saveCanvasSize(infCanvasW, infCanvasH);
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup',   onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
}
function resizeInfCanvas() {
    if (!infCanvas) return;
    const saved = loadCanvasSize();
    if (saved && saved.w > 0 && saved.h > 0) { applyCanvasSize(saved.w, saved.h); return; }
    autoResizeInfCanvas();
}
function autoResizeInfCanvas() {
    if (!infCanvas) return;
    const rect  = infCanvas.getBoundingClientRect();
    const btnEl = document.getElementById('ui-btn-restart');
    const btnH  = btnEl ? btnEl.offsetHeight + 20 : 60;
    const availW = window.innerWidth  - rect.left - 18;
    const availH = window.innerHeight - rect.top  - btnH - 10;
    applyCanvasSize(availW, availH);
    saveCanvasSize(infCanvasW, infCanvasH);
}

window.addEventListener('resize', () => {
    if (isInfinite && infCanvas) autoResizeInfCanvas();
});

// ===== RENDER BÀN =====
function renderInfiniteBoard() {
    if (!infCanvas) initInfCanvas();
    const c  = infCtx;
    const W  = infCanvasW, H = infCanvasH;
    const CS = INF_CS;

    const theme = document.getElementById('theme-select').value;
    const themeColors = {
        'pure-white':  { bg:'#ffffff', grid:'#94a3b8', x:'#2563eb', o:'#dc2626', lastMove:'#f59e0b', win:'#dbeafe' },
        'pure-black':  { bg:'#242440', grid:'#6b6b90', x:'#818cf8', o:'#f472b6', lastMove:'#f59e0b', win:'#3730a3' },
        'cyber':       { bg:'#1e293b', grid:'#475569', x:'#38bdf8', o:'#f43f5e', lastMove:'#f43f5e', win:'#0284c7' },
        'luxury-wood': { bg:'#c2996b', grid:'#5c3d2e', x:'#ffffff', o:'#111111', lastMove:'#ffd700', win:'#b08556' }
    };
    const col = themeColors[theme] || themeColors['pure-white'];

    c.fillStyle = col.bg;
    c.fillRect(0, 0, W, H);

    const cols = Math.ceil(W / CS) + 1;
    const rows = Math.ceil(H / CS) + 1;
    const offX = -((vColF % 1 + 1) % 1) * CS;
    const offY = -((vRowF % 1 + 1) % 1) * CS;
    const c0   = Math.floor(vColF);
    const r0   = Math.floor(vRowF);

    // Vẽ grid
    c.strokeStyle = col.grid;
    c.lineWidth   = 1;
    for (let ci = 0; ci <= cols; ci++) {
        const x = offX + ci * CS;
        c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke();
    }
    for (let ri = 0; ri <= rows; ri++) {
        const y = offY + ri * CS;
        c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke();
    }

    // Vẽ quân cờ
    c.textAlign    = 'center';
    c.textBaseline = 'middle';
    c.font = `bold ${Math.floor(CS * 0.65)}px Segoe UI, sans-serif`;

    for (let ri = 0; ri < rows; ri++) {
        for (let ci = 0; ci < cols; ci++) {
            const gr = r0 + ri, gc2 = c0 + ci;
            const val = infiniteMap.get(`${gr},${gc2}`);
            if (!val) continue;
            const px = offX + ci * CS + CS / 2;
            const py = offY + ri * CS + CS / 2;

            const isWin  = winningCellCoords.some(([wr, wc]) => wr === gr && wc === gc2);
            if (isWin) {
                c.fillStyle = col.win;
                c.fillRect(offX + ci*CS + 0.5, offY + ri*CS + 0.5, CS-1, CS-1);
            }
            const isLast = (gr === lastMoveR && gc2 === lastMoveC);
            if (isLast) {
                c.strokeStyle = col.lastMove;
                c.lineWidth   = 2.5;
                c.strokeRect(offX + ci*CS + 1.5, offY + ri*CS + 1.5, CS-3, CS-3);
                c.lineWidth   = 0.5;
                c.strokeStyle = col.grid;
            }
            c.fillStyle = val === 'X' ? col.x : col.o;
            c.fillText(val, px, py);
        }
    }

    // Hover preview
    if (infHoverR !== null && isGameActive && !(gameMode.startsWith('ai') && currentPlayer === botPiece)) {
        const hr = infHoverR - r0, hc = infHoverC - c0;
        if (hr >= 0 && hc >= 0 && hr < rows && hc < cols) {
            c.fillStyle = theme === 'pure-white' ? 'rgba(37,99,235,0.12)' : 'rgba(255,255,255,0.08)';
            c.fillRect(offX + hc*CS + 0.5, offY + hr*CS + 0.5, CS-1, CS-1);
        }
    }

    // Keyboard cursor
    const isPlayerTurn = gameMode === 'solo' || (gameMode.startsWith('ai') && currentPlayer !== botPiece);
    if (keyboardCursorVisible && isPlayerTurn && isGameActive) {
        const kr = keyboardCursorR - r0, kc = keyboardCursorC - c0;
        if (kr >= 0 && kc >= 0 && kr < rows && kc < cols) {
            c.strokeStyle = '#f59e0b';
            c.lineWidth   = 3;
            c.strokeRect(offX + kc*CS + 1.5, offY + kr*CS + 1.5, CS-3, CS-3);
            c.lineWidth   = 0.5;
            c.strokeStyle = col.grid;
        }
    }

    // Nav bar
    const nav = document.getElementById('inf-nav');
    const cr  = Math.floor(vRowF + rows/2), cc = Math.floor(vColF + cols/2);
    document.getElementById('inf-coords').textContent = `Tâm: (${cr}, ${cc})`;
    nav.style.display = 'block';

    // Vẽ điểm đánh giá ô (debug scores) — PHẢI ở cuối cùng để không bị ghi đè
    const showScores = document.getElementById('show-cell-scores');
    if (showScores && showScores.checked && window.cellScores && Object.keys(window.cellScores).length > 0) {
        const top4 = Object.entries(window.cellScores)
            .map(([key, val]) => ({ key, val }))
            .sort((a, b) => b.val - a.val)
            .slice(0, 4);
        const top1Key = top4.length > 0 ? top4[0].key : null;
        c.textAlign    = 'center';
        c.textBaseline = 'middle';
        for (let i = 0; i < top4.length; i++) {
            const { key, val } = top4[i];
            const [gr, gc2] = key.split(',').map(Number);
            if (infiniteMap.get(key)) continue;
            const ri = gr - r0, ci = gc2 - c0;
            if (ri < 0 || ci < 0 || ri >= rows || ci >= cols) continue;
            const px = offX + ci * CS + CS / 2;
            const py = offY + ri * CS + CS / 2;
            const isTop = key === top1Key;
            const label = val >= 10000 ? `${Math.round(val/1000)}k` : `${(val/1000).toFixed(1)}k`;
            c.font = `bold ${Math.max(8, Math.floor(CS * 0.22))}px monospace`;
            c.fillStyle = isTop ? 'rgba(245,158,11,0.15)' : 'rgba(99,102,241,0.1)';
            c.fillRect(offX + ci*CS + 1, offY + ri*CS + 1, CS-2, CS-2);
            c.fillStyle = isTop ? 'rgba(180,100,0,0.55)' : 'rgba(79,70,229,0.45)';
            c.fillText(label, px, py);
        }
    }
}

// ===== HOVER =====
let infHoverR = null, infHoverC = null;
let _rafPending = false;

function scheduleRender() {
    if (_rafPending) return;
    _rafPending = true;
    requestAnimationFrame(() => {
        _rafPending = false;
        renderInfiniteBoard();
    });
}

function canvasPixelToCell(px, py) {
    const offX = -((vColF % 1 + 1) % 1) * INF_CS;
    const offY = -((vRowF % 1 + 1) % 1) * INF_CS;
    const c0 = Math.floor(vColF), r0 = Math.floor(vRowF);
    const ci = Math.floor((px - offX) / INF_CS);
    const ri = Math.floor((py - offY) / INF_CS);
    return { r: r0 + ri, c: c0 + ci };
}

// ===== MOUSE EVENTS =====
function infOnMouseDown(e) {
    if (e.button === 2) {
        e.preventDefault();
        infPanning = true; panMoved = false;
        panStartX = e.clientX; panStartY = e.clientY;
        panStartVRow = vRowF; panStartVCol = vColF;
        infCanvas.style.cursor = 'grabbing';
    }
}
function infOnMouseUp(e) {
    if (e.button === 2) { infPanning = false; updateCursorByTurn(); }
}
function infOnMouseMove(e) {
    if (infPanning) {
        e.preventDefault();
        const dx = e.clientX - panStartX, dy = e.clientY - panStartY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) panMoved = true;
        vColF = panStartVCol - dx / INF_CS;
        vRowF = panStartVRow - dy / INF_CS;
        scheduleRender();
        return;
    }
    const rect = infCanvas.getBoundingClientRect();
    const { r, c } = canvasPixelToCell(e.clientX - rect.left, e.clientY - rect.top);
    if (r !== infHoverR || c !== infHoverC) {
        infHoverR = r; infHoverC = c;
        scheduleRender();
    }
}
function infOnMouseLeave() {
    infPanning = false;
    updateCursorByTurn();
    infHoverR = null; infHoverC = null;
    scheduleRender();
}
function infOnClick(e) {
    if (e.button !== 0) return;
    if (panMoved) { panMoved = false; return; }
    if (!isGameActive) return;
    
    const rect = infCanvas.getBoundingClientRect();
    const { r, c } = canvasPixelToCell(e.clientX - rect.left, e.clientY - rect.top);

    // Chế độ online: giao hết cho makeMove, không xử lý ở đây
    if (window.isOnlineModeActive && window.isOnlineModeActive()) {
        if (getCell(r, c) !== '') return;
        makeMove(r, c);
        return;
    }

    // --- Offline ---
    if (gameMode.startsWith('ai') && currentPlayer === botPiece) return;
    if (getCell(r, c) !== '') return;
    makeMove(r, c);
}

// ===== KEYBOARD =====
function infOnKeyDown(e) {
    if (!isInfinite || !isGameActive) return;
    const isPlayerTurn = gameMode === 'solo' || (gameMode.startsWith('ai') && currentPlayer !== botPiece);

    if (isPlayerTurn) {
        if (e.key === 'ArrowUp')    { e.preventDefault(); keyboardCursorR--; keyboardCursorVisible = true; renderInfiniteBoard(); return; }
        if (e.key === 'ArrowDown')  { e.preventDefault(); keyboardCursorR++; keyboardCursorVisible = true; renderInfiniteBoard(); return; }
        if (e.key === 'ArrowLeft')  { e.preventDefault(); keyboardCursorC--; keyboardCursorVisible = true; renderInfiniteBoard(); return; }
        if (e.key === 'ArrowRight') { e.preventDefault(); keyboardCursorC++; keyboardCursorVisible = true; renderInfiniteBoard(); return; }
        if (e.key === 'Enter') {
            e.preventDefault();
            if (keyboardCursorVisible && getCell(keyboardCursorR, keyboardCursorC) === '')
                makeMove(keyboardCursorR, keyboardCursorC);
            return;
        }
    }

    if (e.key !== 'Enter') return;
    if (gameMode.startsWith('ai') && currentPlayer === botPiece) return;
    if (infHoverR === null || infHoverC === null) return;
    if (getCell(infHoverR, infHoverC) !== '') return;
    makeMove(infHoverR, infHoverC);
}

// ===== TOUCH =====
let touchStartX = 0, touchStartY = 0;
function infOnTouchStart(e) {
    e.preventDefault();
    const t = e.touches[0];
    infPanning = true; panMoved = false;
    panStartX = t.clientX; panStartY = t.clientY;
    panStartVRow = vRowF; panStartVCol = vColF;
    touchStartX = t.clientX; touchStartY = t.clientY;
}
function infOnTouchMove(e) {
    e.preventDefault();
    const t = e.touches[0];
    const dx = t.clientX - panStartX, dy = t.clientY - panStartY;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) panMoved = true;
    vColF = panStartVCol - dx / INF_CS;
    vRowF = panStartVRow - dy / INF_CS;
    scheduleRender();
}
function infOnTouchEnd(e) {
    e.preventDefault();
    infPanning = false;
    if (!panMoved) {
        const t = e.changedTouches[0];
        const rect = infCanvas.getBoundingClientRect();
        const { r, c } = canvasPixelToCell(t.clientX - rect.left, t.clientY - rect.top);
        if (!isGameActive) return;
        if (getCell(r, c) !== '') return;

        // Online: giao cho makeMove
        if (window.isOnlineModeActive && window.isOnlineModeActive()) {
            makeMove(r, c);
        } else if (!(gameMode.startsWith('ai') && currentPlayer === botPiece)) {
            makeMove(r, c);
        }
    }
    panMoved = false;
}

// ===== ZOOM =====
const ZOOM_KEY = 'caro_zoom';
function loadZoom() {
    const v = parseFloat(localStorage.getItem(ZOOM_KEY));
    return (v >= INF_CS_MIN && v <= INF_CS_MAX) ? v : 36;
}
function saveZoom() { localStorage.setItem(ZOOM_KEY, INF_CS); }

function infOnWheel(e) {
    e.preventDefault();
    const rect = infCanvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const worldR = vRowF + my / INF_CS, worldC = vColF + mx / INF_CS;
    const factor = e.deltaY < 0 ? 1.15 : (1 / 1.15);
    const newCS  = Math.min(INF_CS_MAX, Math.max(INF_CS_MIN, INF_CS * factor));
    INF_CS = Math.round(newCS);
    vRowF  = worldR - my / INF_CS;
    vColF  = worldC - mx / INF_CS;
    saveZoom();
    renderInfiniteBoard();
}

function zoomBoard(direction) {
    const factor = direction > 0 ? 1.15 : (1 / 1.15);
    const newCS  = Math.min(INF_CS_MAX, Math.max(INF_CS_MIN, INF_CS * factor));
    if (newCS === INF_CS) return;
    const mx = infCanvasW / 2, my = infCanvasH / 2;
    const worldR = vRowF + my / INF_CS, worldC = vColF + mx / INF_CS;
    INF_CS = Math.round(newCS);
    vRowF  = worldR - my / INF_CS;
    vColF  = worldC - mx / INF_CS;
    saveZoom();
    renderInfiniteBoard();
}

// ===== UNDO =====
function undoMove() {
    if (moveHistory.length === 0 || !isGameActive) return;
    const lastMove = moveHistory.pop();
    setCell(lastMove.r, lastMove.c, "");
    moveCount--;
    currentPlayer = lastMove.player;

    if (moveHistory.length > 0) {
        const prevMove = moveHistory[moveHistory.length - 1];
        lastMoveR = prevMove.r; lastMoveC = prevMove.c;
    } else {
        lastMoveR = null; lastMoveC = null;
    }
    winningCellCoords = [];

    if (isInfinite) {
        renderInfiniteBoard();
    } else {
        if (lastMoveCell) lastMoveCell.classList.remove('last-move');
        const cell = document.querySelector(`[data-row='${lastMove.r}'][data-col='${lastMove.c}']`);
        if (cell) { cell.classList.remove(lastMove.player); cell.classList.remove('last-move'); }
        if (moveHistory.length > 0) {
            const prevMove = moveHistory[moveHistory.length - 1];
            const prevCell = document.querySelector(`[data-row='${prevMove.r}'][data-col='${prevMove.c}']`);
            if (prevCell) { prevCell.classList.add('last-move'); lastMoveCell = prevCell; }
        }
    }
    updateCursorByTurn();
    updateStatus();
}

// ===== JUMP =====
function jumpToCenter() {
    if (lastMoveR !== null) {
        vRowF = lastMoveR - Math.floor(infCanvasH / INF_CS / 2);
        vColF = lastMoveC - Math.floor(infCanvasW / INF_CS / 2);
    } else {
        vRowF = -Math.floor(infCanvasH / INF_CS / 2);
        vColF = -Math.floor(infCanvasW / INF_CS / 2);
    }
    renderInfiniteBoard();
}
function jumpToOrigin() {
    vRowF = -Math.floor(infCanvasH / INF_CS / 2);
    vColF = -Math.floor(infCanvasW / INF_CS / 2);
    renderInfiniteBoard();
}

// ===== CURSOR =====
function updateCursorByTurn() {
    const canvas = document.getElementById('inf-canvas');
    if (!canvas) return;
    let svgContent = '';
    if (typeof currentPlayer !== 'undefined') {
        if (currentPlayer === 'X') {
            svgContent = `<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'><line x1='2' y1='2' x2='10' y2='10' stroke='#007bff' stroke-width='2' stroke-linecap='round'/><line x1='10' y1='2' x2='2' y2='10' stroke='#007bff' stroke-width='2' stroke-linecap='round'/></svg>`;
        } else {
            svgContent = `<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'><circle cx='6' cy='6' r='4' stroke='#dc2626' stroke-width='2' fill='none'/></svg>`;
        }
        const encodedSvg = btoa(svgContent.trim());
        canvas.style.cursor = `url('data:image/svg+xml;base64,${encodedSvg}') 6 6, auto`;
    }
}

// ===== BLOCK BOTH ENDS =====
const BLOCK_BOTH_ENDS_KEY = 'caro_block_both_ends';
function loadBlockBothEndsSetting() {
    const v = localStorage.getItem(BLOCK_BOTH_ENDS_KEY);
    return v === null ? true : v === 'true';
}
function saveBlockBothEndsSetting() {
    const checkbox = document.getElementById('block-both-ends');
    localStorage.setItem(BLOCK_BOTH_ENDS_KEY, checkbox.checked);
}

// ===== TẠO Ô DOM =====
function makeCell(r, c) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.setAttribute('data-row', r);
    cell.setAttribute('data-col', c);
    cell.addEventListener('click', handleCellClick);
    return cell;
}

let isDragging = false, panMoved = false;

function handleCellClick(e) {
    if (panMoved) return;
    if (!isGameActive) return;
    
    let target = e.target;
    if (!target.classList.contains('cell')) target = target.parentElement;
    const r = parseInt(target.getAttribute('data-row'));
    const c = parseInt(target.getAttribute('data-col'));
    if (getCell(r, c) !== "") return;

    // Online và offline đều giao hết cho makeMove
    if (window.isOnlineModeActive && window.isOnlineModeActive()) {
        makeMove(r, c);
        return;
    }

    // --- Offline ---
    if (gameMode.startsWith('ai') && currentPlayer === botPiece) return;
    makeMove(r, c);
    if (getCell(r, c) !== "") return;
    makeMove(r, c);
}

// ===== RENDER BÀN CỐ ĐỊNH (alias) =====
function renderBoard() {
    renderFixedBoard();
}
