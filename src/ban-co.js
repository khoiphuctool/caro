// ===== BÀN CỜ - Render canvas vô hạn, zoom, pan, resize =====

// Thiết lập kích thước ô cờ mặc định ban đầu
let kichThuocOCoHienTai = 24;

// Hàm thay đổi kích thước ô cờ cho cả fixed board và infinite board
function thayDoiKichThuocCo(luongThayDoi) {
    kichThuocOCoHienTai += luongThayDoi;
    
    // Khống chế giới hạn: Thấp nhất là 18px, cao nhất 40px
    if (kichThuocOCoHienTai < 18) kichThuocOCoHienTai = 18;
    if (kichThuocOCoHienTai > 40) kichThuocOCoHienTai = 40;
    
    // Tắt auto resize khi người dùng thay đổi kích thước thủ công
    const autoCheckbox = document.getElementById('auto-size-checkbox');
    if (autoCheckbox) {
        autoCheckbox.checked = false;
        localStorage.setItem('caroAutoResize', 'false');
    }
    
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

// Hàm đặt kích thước ô cờ cố định (cho preset buttons)
function setKichThuocCo(kichThuoc) {
    // Khống chế giới hạn: Thấp nhất là 18px, cao nhất 40px
    if (kichThuoc < 18) kichThuoc = 18;
    if (kichThuoc > 40) kichThuoc = 40;
    
    kichThuocOCoHienTai = kichThuoc;
    
    // Tắt auto resize khi người dùng chọn kích thước thủ công
    const autoCheckbox = document.getElementById('auto-size-checkbox');
    if (autoCheckbox) {
        autoCheckbox.checked = false;
        localStorage.setItem('caroAutoResize', 'false');
    }
    
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

// Hàm đặt kích thước game-container (khung viền ngoài bàn cờ)
function setContainerSize(percent) {
    const gameContainer = document.getElementById('ui-game-container');
    if (gameContainer) {
        // Tắt auto resize khi người dùng chọn kích thước thủ công
        const autoCheckbox = document.getElementById('auto-size-checkbox');
        if (autoCheckbox) {
            autoCheckbox.checked = false;
        }
        
        // Đặt width theo phần trăm
        gameContainer.style.width = percent + '%';
        gameContainer.style.maxWidth = percent + '%';
        
        // Giới hạn chiều cao không vượt quá chiều rộng (hình chữ nhật)
        gameContainer.style.height = 'auto';
        gameContainer.style.maxHeight = '80vh'; // Giới hạn tối đa 80% chiều cao màn hình
        
        // Resize canvas để khớp với container mới
        setTimeout(() => {
            if (isInfinite && infCanvas) {
                const containerRect = gameContainer.getBoundingClientRect();
                let newW = containerRect.width;
                
                // Preset buttons: ép 70% ratio
                applyCanvasSize(newW, newW * 0.7, true);
            }
        }, 100);
        
        // Cập nhật vị trí resize handles
        updateResizeHandlesPosition();
        
        // Lưu vào localStorage
        localStorage.setItem('caroContainerSize', percent);
        localStorage.setItem('caroAutoResize', 'false');
        // Lưu cả canvas size để persistence
        if (isInfinite && infCanvas) {
            saveCanvasSize(infCanvasW, infCanvasH);
        }
    }
}

// Cập nhật kích thước handle theo 2% chiều rộng THỰC của container.
// CSS % theo chiều cao/chiều rộng riêng rẽ khiến handle bị méo và thường kẹt ở min-height.
function updateResizeHandlesPosition() {
    const container = document.getElementById('ui-game-container');
    if (!container) return;

    const containerWidth = container.getBoundingClientRect().width;
    const handleSize = Math.max(12, Math.min(20, containerWidth * 0.02));
    container.style.setProperty('--gc-handle-size', `${handleSize}px`);
}

// Hàm load kích thước container từ localStorage
function loadContainerSize() {
    const savedSize = localStorage.getItem('caroContainerSize');
    const savedAuto = localStorage.getItem('caroAutoResize');
    
    const gameContainer = document.getElementById('ui-game-container');
    const autoCheckbox = document.getElementById('auto-size-checkbox');
    
    // Luôn load trạng thái auto-resize checkbox
    if (savedAuto && autoCheckbox) {
        autoCheckbox.checked = savedAuto === 'true';
    }
    
    if (savedSize && gameContainer) {
        // Load kích thước đã lưu - set width, giới hạn chiều cao
        const percent = parseInt(savedSize);
        gameContainer.style.width = percent + '%';
        gameContainer.style.maxWidth = percent + '%';
        gameContainer.style.height = 'auto';
        gameContainer.style.maxHeight = '80vh'; // Giới hạn tối đa 80% chiều cao màn hình
    }
}

// Hàm toggle auto resize
function toggleAutoSize() {
    const autoCheckbox = document.getElementById('auto-size-checkbox');
    const isAuto = autoCheckbox ? autoCheckbox.checked : false;
    
    const gameContainer = document.getElementById('ui-game-container');
    if (gameContainer) {
        if (isAuto) {
            // Bật auto - xóa kích thước cố định để tự động theo màn hình
            gameContainer.style.width = '';
            gameContainer.style.height = '';
            gameContainer.style.maxWidth = '';
            gameContainer.style.maxHeight = '';
            
            // Xóa kích thước đã lưu
            localStorage.removeItem('caroContainerSize');
            localStorage.setItem('caroAutoResize', 'true');
        } else {
            // Tắt auto - giữ nguyên kích thước hiện tại
            localStorage.setItem('caroAutoResize', 'false');
        }
    }
    
    // Nếu auto bật, cũng gọi recalculateCellSizes cho fixed board
    if (isAuto && !isInfinite) {
        recalculateCellSizes();
    }
}

// Hàm lưu kích thước canvas hiện tại
function saveCurrentCanvasSize() {
    if (!infCanvas) return;
    
    const currentW = infCanvasW;
    const currentH = infCanvasH;
    
    // Lưu vào localStorage với key đúng
    saveCanvasSize(currentW, currentH);
    
    // Hiển thị thông báo
    if (typeof updateBotThinking === 'function') {
        updateBotThinking('Đã lưu kích thước bàn cờ! 💾');
    }
    
    // Tự động tắt auto resize
    const autoCheckbox = document.getElementById('auto-size-checkbox');
    if (autoCheckbox) {
        autoCheckbox.checked = false;
        localStorage.setItem('caroAutoResize', 'false');
    }
}

// ===== RENDER BÀN CỐ ĐỊNH =====
function renderFixedBoard() {
    // Tắt render khi fullscreen để tránh flickering
    if (isFullscreen) return;
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
    // Tắt recalculate khi fullscreen để tránh flickering
    if (isFullscreen) return;
    
    // Kiểm tra xem auto resize có được bật không
    const autoCheckbox = document.getElementById('auto-size-checkbox');
    const isAuto = autoCheckbox ? autoCheckbox.checked : false;
    if (!isAuto) return;
    
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

// BUG 3 FIX: Flag to prevent multiple listener registrations
let infCanvasInitialized = false;

function initInfCanvas() {
    // BUG 3 FIX: Prevent duplicate initialization - only if canvas element exists
    if (infCanvasInitialized && infCanvas) {
        console.warn('initInfCanvas already called, skipping duplicate initialization');
        return;
    }
    
    infCanvas = document.getElementById('inf-canvas');
    if (!infCanvas) {
        console.warn('inf-canvas element not found, skipping initialization');
        return;
    }
    
    infCanvasInitialized = true;
    infCtx    = infCanvas.getContext('2d');
    document.getElementById('board').style.display = 'none';

    const wrapper = document.getElementById('inf-resizable');
    wrapper.style.display = 'inline-block';

    const gc = document.getElementById('ui-game-container');
    gc.classList.add('inf-mode');

    // Gắn đầy đủ mouse events cho cả online và offline (giống bản backup)
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

    // Load saved canvas size ngay lập tức nếu có
    const saved = loadCanvasSize();
    if (saved && saved.w > 0 && saved.h > 0) {
        infCanvasW = saved.w;
        infCanvasH = saved.h;
        infCanvas.width = infCanvasW;
        infCanvas.height = infCanvasH;
        infCanvas.style.width = infCanvasW + 'px';
        infCanvas.style.height = infCanvasH + 'px';
        updateInfiniteResizeHandles();
        updateCursorByTurn();
        renderInfiniteBoard();
    } else {
        // Chỉ set mặc định khi không có saved size
        // Set kích thước mặc định lớn hơn để tránh bị co
        const defaultW = Math.max(500, window.innerWidth - 100);
        const defaultH = Math.floor(defaultW * 0.7); // Chiều cao 70% chiều rộng
        infCanvasW = defaultW; infCanvasH = defaultH;
        infCanvas.width = infCanvasW; infCanvas.height = infCanvasH;
        infCanvas.style.width = infCanvasW + 'px';
        infCanvas.style.height = infCanvasH + 'px';
        updateInfiniteResizeHandles();
        updateCursorByTurn();
        renderInfiniteBoard();
        // Gọi auto-resize sau khi đã render lần đầu để điều chỉnh theo màn hình
        requestAnimationFrame(() => requestAnimationFrame(() => resizeInfCanvas()));
    }
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
function applyCanvasSize(w, h, forceRatio = false) {
    if (!infCanvas) return;
    
    // Chỉ ép 70% ratio khi forceRatio = true (auto-resize, preset buttons)
    if (forceRatio) {
        h = Math.floor(w * 0.7);
    } else {
        // Manual resize: chỉ giới hạn tối đa 70%, cho phép tự do điều chỉnh
        h = Math.min(h, Math.floor(w * 0.7));
    }
    
    // Sử dụng Math.floor thay vì Math.round để đảm bảo không vượt quá kích thước có sẵn
    infCanvasW = Math.max(8 * INF_CS, Math.floor(w / INF_CS) * INF_CS);
    infCanvasH = Math.max(8 * INF_CS, Math.floor(h / INF_CS) * INF_CS);
    
    // Đảm bảo sau khi làm tròn, chiều cao không vượt quá giới hạn
    const maxH = forceRatio ? Math.floor(infCanvasW * 0.7) : Math.floor(infCanvasW * 0.7);
    if (infCanvasH > maxH) {
        infCanvasH = maxH;
    }
    
    infCanvas.width  = infCanvasW;
    infCanvas.height = infCanvasH;
    infCanvas.style.width  = infCanvasW + 'px';
    infCanvas.style.height = infCanvasH + 'px';
    updateInfiniteResizeHandles();
    renderInfiniteBoard();
}

// Đồng bộ handle ở mép bàn cờ với kích thước thật của canvas.
function updateInfiniteResizeHandles() {
    const wrapper = document.getElementById('inf-resizable');
    if (!wrapper) return;

    const width = wrapper.getBoundingClientRect().width;
    const cornerSize = Math.max(12, Math.min(20, width * 0.02));
    const edgeSize = Math.max(8, Math.min(12, cornerSize * 0.6));
    wrapper.style.setProperty('--inf-handle-size', `${cornerSize}px`);
    wrapper.style.setProperty('--inf-edge-handle-size', `${edgeSize}px`);
}
function setupResizeHandles() {
    const wrapper = document.getElementById('inf-resizable');
    if (!wrapper) return;
    wrapper.querySelectorAll('.rs-handle').forEach(handle => {
        handle.addEventListener('mousedown', onResizeStart);
        // Add touch support for mobile
        handle.addEventListener('touchstart', onResizeStart, { passive: false });
    });
    updateInfiniteResizeHandles();
}
function onResizeStart(e) {
    e.preventDefault(); e.stopPropagation();
    const dir    = e.currentTarget.getAttribute('data-dir');
    
    // Get start position from either mouse or touch event
    const startX = e.clientX || (e.touches && e.touches[0].clientX);
    const startY = e.clientY || (e.touches && e.touches[0].clientY);
    const startW = infCanvasW, startH = infCanvasH;

    function onMove(ev) {
        ev.preventDefault();
        const clientX = ev.clientX || (ev.touches && ev.touches[0].clientX);
        const clientY = ev.clientY || (ev.touches && ev.touches[0].clientY);
        const dx = clientX - startX, dy = clientY - startY;
        let newW = startW, newH = startH;
        if (dir.includes('e'))  newW = startW + dx;
        if (dir.includes('w'))  newW = startW - dx;
        if (dir.includes('s'))  newH = startH + dy;
        if (dir.includes('n'))  newH = startH - dy;
        applyCanvasSize(newW, newH, false); // Manual resize: không ép ratio
    }
    function onUp() {
        saveCanvasSize(infCanvasW, infCanvasH);
        // Tắt auto resize khi người dùng resize thủ công
        const autoCheckbox = document.getElementById('auto-size-checkbox');
        if (autoCheckbox) {
            autoCheckbox.checked = false;
            localStorage.setItem('caroAutoResize', 'false');
        }
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup',   onUp);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend',   onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend',   onUp);
}
function resizeInfCanvas() {
    if (!infCanvas) return;
    
    // Kiểm tra xem auto resize có được bật không
    const autoCheckbox = document.getElementById('auto-size-checkbox');
    const isAuto = autoCheckbox ? autoCheckbox.checked : true;
    
    // Nếu không auto-resize, chỉ load saved canvas size nếu có
    if (!isAuto) {
        const saved = loadCanvasSize();
        if (saved && saved.w > 0 && saved.h > 0) { 
            applyCanvasSize(saved.w, saved.h, false); // Load saved: không ép ratio
        }
        return;
    }
    
    // Nếu auto-resize, luôn auto-resize (không load saved size)
    autoResizeInfCanvas();
}
function autoResizeInfCanvas() {
    if (!infCanvas) return;
    
    // Kiểm tra xem auto resize có được bật không
    const autoCheckbox = document.getElementById('auto-size-checkbox');
    const isAuto = autoCheckbox ? autoCheckbox.checked : true;
    if (!isAuto) return; // Không auto-resize nếu người dùng đã tắt
    
    const rect  = infCanvas.getBoundingClientRect();
    const btnEl = document.getElementById('ui-btn-restart');
    const btnH  = btnEl ? btnEl.offsetHeight + 20 : 60;
    
    // Tính toán available width với padding an toàn
    const availW = Math.max(300, window.innerWidth - rect.left - 40);
    
    // Tính toán available height với padding an toàn lớn hơn để tránh tràn
    const headerHeight = document.querySelector('.notification-ticker')?.offsetHeight || 0;
    let availH = window.innerHeight - rect.top - headerHeight - btnH - 40;

    // ĐẢM BẢO CHIỀU CAO LÀ 70% CHIỀU RỘNG
    availH = Math.floor(availW * 0.7);

    // Giới hạn chiều cao tối đa là 70% viewport để tránh tràn
    availH = Math.min(availH, Math.floor(window.innerHeight * 0.7));

    // Trên mobile khi online: giới hạn chiều cao để còn scroll xuống nút Bắt đầu
    if (window.innerWidth <= 768 && window.isOnlineModeActive && window.isOnlineModeActive()) {
        availH = Math.min(availH, Math.floor(window.innerHeight * 0.45));
    }

    applyCanvasSize(availW, availH, true); // Auto-resize: ép 70% ratio
    // KHÔNG lưu canvas size khi auto-resize để tránh xung đột
}

let resizeTimeout = null;
window.addEventListener('resize', () => {
    // Tắt hoàn toàn resize khi fullscreen để tránh flickering
    if (isFullscreen) return;
    if (isInfinite && infCanvas) {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            autoResizeInfCanvas();
        }, 100);
    }
});

// ===== RENDER BÀN =====
function renderInfiniteBoard() {
    if (!infCanvas) initInfCanvas();
    // Tắt render khi fullscreen để tránh flickering
    if (isFullscreen) return;
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

    // Hover preview — chỉ hiện khi đến lượt mình và KHÔNG fullscreen
    const onlineActive = window.isOnlineModeActive && window.isOnlineModeActive();
    const myTurn = onlineActive
        ? (typeof currentTurn !== 'undefined' && currentTurn === (window.myOnlineRole))
        : (gameMode === 'solo' || (gameMode.startsWith('ai') && currentPlayer !== botPiece));

    if (infHoverR !== null && isGameActive && myTurn && !isFullscreen) {
        const hr = infHoverR - r0, hc = infHoverC - c0;
        if (hr >= 0 && hc >= 0 && hr < rows && hc < cols) {
            c.fillStyle = theme === 'pure-white' ? 'rgba(37,99,235,0.12)' : 'rgba(255,255,255,0.08)';
            c.fillRect(offX + hc*CS + 0.5, offY + hr*CS + 0.5, CS-1, CS-1);
        }
    }

    // Keyboard cursor — chỉ hiện offline hoặc khi đến lượt mình online
    const isPlayerTurnKb = onlineActive ? myTurn : (gameMode === 'solo' || (gameMode.startsWith('ai') && currentPlayer !== botPiece));
    if (keyboardCursorVisible && isPlayerTurnKb && isGameActive) {
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
let _lastMouseMoveTime = 0;
const MOUSE_MOVE_THROTTLE = 100; // ~10fps - giảm thêm để tránh flickering
let isFullscreen = false;
let cachedCanvasRect = null;
let lastRectUpdateTime = 0;

// Detect fullscreen changes
document.addEventListener('fullscreenchange', () => {
    isFullscreen = !!document.fullscreenElement;
    if (isFullscreen) {
        // Thêm class fullscreen-mode vào body
        document.body.classList.add('fullscreen-mode');
        // Tắt transition trên body và cell khi fullscreen để tránh flickering
        document.body.style.transition = 'none';
        document.querySelectorAll('.cell').forEach(cell => {
            cell.style.transition = 'none';
            cell.style.pointerEvents = 'none'; // Tắt hoàn toàn hover trên cell
        });
        // Tắt mouse events trên canvas khi fullscreen
        if (infCanvas) {
            infCanvas.onmousemove = null;
            infCanvas.style.pointerEvents = 'none';
            // Force GPU acceleration và tắt repaint
            infCanvas.style.willChange = 'transform';
            infCanvas.style.transform = 'translateZ(0)';
        }
        // Tắt wheel event khi fullscreen
        if (infCanvas) {
            infCanvas.removeEventListener('wheel', infOnWheel);
        }
        // KHÔNG render hay resize canvas khi vào fullscreen để tránh flickering
        // Giữ nguyên canvas như cũ
    } else {
        // Xóa class fullscreen-mode khỏi body
        document.body.classList.remove('fullscreen-mode');
        // Bật lại transition khi thoát fullscreen
        document.body.style.transition = '';
        document.querySelectorAll('.cell').forEach(cell => {
            cell.style.transition = '';
            cell.style.pointerEvents = 'auto'; // Bật lại hover trên cell
        });
        // Bật lại mouse events
        if (infCanvas) {
            infCanvas.onmousemove = infOnMouseMove;
            infCanvas.style.pointerEvents = 'auto';
            infCanvas.style.willChange = '';
        }
        // Bật lại wheel event
        if (infCanvas) {
            infCanvas.addEventListener('wheel', infOnWheel, { passive: false });
        }
        if (isInfinite && infCanvas) {
            // Re-render và resize khi thoát fullscreen
            setTimeout(() => {
                autoResizeInfCanvas();
            }, 150);
        }
    }
});

function scheduleRender() {
    // Chỉ tắt scheduleRender khi KHÔNG chơi online để tránh flickering
    const isOnline = window.isOnlineModeActive && window.isOnlineModeActive();
    if (!isOnline) {
        // TẬT HOÀN TOÀN SCHEDULE RENDER ĐỂ TRÁNH FLICKERING (OFFLINE)
        return;
    }
    
    // ONLINE: Giữ scheduleRender để bàn cờ update khi có nước đi mới
    if (_rafPending) return;
    if (isFullscreen) return;
    _rafPending = true;
    requestAnimationFrame(() => {
        _rafPending = false;
        renderInfiniteBoard();
    });
}

function canvasPixelToCell(px, py) {
    if (!infCanvas) return { r: 0, c: 0 };
    // BUG 2 FIX: Account for canvas CSS scaling/zoom
    const rect = infCanvas.getBoundingClientRect();
    const scaleX = infCanvas.width / rect.width;
    const scaleY = infCanvas.height / rect.height;
    
    // Adjust pixel coordinates for scaling
    const adjustedPx = px * scaleX;
    const adjustedPy = py * scaleY;
    
    const offX = -((vColF % 1 + 1) % 1) * INF_CS;
    const offY = -((vRowF % 1 + 1) % 1) * INF_CS;
    const c0 = Math.floor(vColF), r0 = Math.floor(vRowF);
    const ci = Math.floor((adjustedPx - offX) / INF_CS);
    const ri = Math.floor((adjustedPy - offY) / INF_CS);
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
    
    // TẮT HOÀN TOÀN HOVER EFFECT ĐỂ TRÁNH FLICKERING
    return;
    
    // Tắt hover effect khi ở fullscreen để tránh flickering
    if (isFullscreen) return;
    
    // Throttle mousemove để giảm tải render
    const now = performance.now();
    if (now - _lastMouseMoveTime < MOUSE_MOVE_THROTTLE) return;
    _lastMouseMoveTime = now;
    
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
    if (!infCanvas) return;
    if (e.button !== 0) return;
    if (panMoved) { panMoved = false; return; }
    if (!isGameActive) return;
    
    // BUG 1 FIX: Block click if it occurred shortly after touch end (prevent double-firing)
    const timeSinceTouch = performance.now() - lastTouchEndTime;
    if (timeSinceTouch < TOUCH_CLICK_DELAY) {
        return; // Ignore click - it's a duplicate of the touch event
    }
    
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
let lastTouchEndTime = 0;
const TOUCH_CLICK_DELAY = 300; // ms - prevent click after touch
function infOnTouchStart(e) {
    e.preventDefault();
    const t = e.touches[0];
    infPanning = true; panMoved = false;
    panStartX = t.clientX; panStartY = t.clientY;
    panStartVRow = vRowF; panStartVCol = vColF;
    touchStartX = t.clientX; touchStartY = t.clientY;
}
function infOnTouchMove(e) {
    const t = e.touches[0];
    const dx = t.clientX - panStartX, dy = t.clientY - panStartY;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) panMoved = true;
    // Luôn preventDefault để xử lý pan trong canvas (cả ngang và dọc)
    e.preventDefault();
    vColF = panStartVCol - dx / INF_CS;
    vRowF = panStartVRow - dy / INF_CS;
    scheduleRender();
}
function infOnTouchEnd(e) {
    e.preventDefault();
    infPanning = false;
    lastTouchEndTime = performance.now(); // Track touch end time to block click
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
    if (!infCanvas) return;
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
    // Không cho undo khi đang chơi online
    if (window.isOnlineModeActive && window.isOnlineModeActive()) return;
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

// Load kích thước container khi trang load
window.addEventListener('load', () => {
    setTimeout(loadContainerSize, 500);
    setupGameContainerResize();
});

// ===== RESIZE HANDLES CHO GAME-CONTAINER =====
function setupGameContainerResize() {
    const handles = document.querySelectorAll('.gc-resize-handle');
    handles.forEach(handle => {
        handle.addEventListener('mousedown', onGameContainerResizeStart);
    });

    const container = document.getElementById('ui-game-container');
    if (!container) return;

    // Cập nhật cả khi bấm preset 40–100%, kéo chuột hoặc đổi kích thước cửa sổ.
    updateResizeHandlesPosition();
    if (typeof ResizeObserver !== 'undefined') {
        new ResizeObserver(() => updateResizeHandlesPosition()).observe(container);
    } else {
        window.addEventListener('resize', updateResizeHandlesPosition);
    }
}

function onGameContainerResizeStart(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const container = document.getElementById('ui-game-container');
    if (!container) return;
    
    const dir = e.currentTarget.getAttribute('data-dir');
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = container.offsetWidth;
    const startHeight = container.offsetHeight;
    
    // Tắt auto resize khi bắt đầu kéo
    const autoCheckbox = document.getElementById('auto-size-checkbox');
    if (autoCheckbox) {
        autoCheckbox.checked = false;
        localStorage.setItem('caroAutoResize', 'false');
    }
    
    function onMouseMove(e) {
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        
        let newWidth = startWidth;
        let newHeight = startHeight;
        
        switch(dir) {
            case 'se':
                newWidth = startWidth + deltaX;
                newHeight = startHeight + deltaY;
                break;
            case 'sw':
                newWidth = startWidth - deltaX;
                newHeight = startHeight + deltaY;
                break;
            case 'ne':
                newWidth = startWidth + deltaX;
                newHeight = startHeight - deltaY;
                break;
            case 'nw':
                newWidth = startWidth - deltaX;
                newHeight = startHeight - deltaY;
                break;
        }
        
        // Giới hạn kích thước tối thiểu
        newWidth = Math.max(200, newWidth);
        newHeight = Math.max(200, newHeight);
        
        // Tính phần trăm theo màn hình
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        const widthPercent = Math.round((newWidth / screenWidth) * 100);
        const heightPercent = Math.round((newHeight / screenHeight) * 100);
        
        // Đặt kích thước theo phần trăm
        container.style.width = widthPercent + '%';
        container.style.height = heightPercent + '%';
        container.style.maxWidth = widthPercent + '%';
        container.style.maxHeight = heightPercent + '%';
        updateResizeHandlesPosition();
        
        // Lưu vào localStorage
        localStorage.setItem('caroContainerSize', widthPercent);
    }
    
    function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    }
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
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
