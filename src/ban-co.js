// ===== BÀN CỜ - Render canvas vô hạn, zoom, pan, resize =====

// Thiết lập kích thước ô cờ mặc định ban đầu
let kichThuocOCoHienTai = 24;

// NOTE: SharedBoardEngine đã thay thế hệ thống cũ
// Các hàm thayDoiKichThuocCo, setKichThuocCo đã bị xóa
// Sử dụng SharedBoardEngine.ViewportControl và SharedBoardEngine.Camera thay thế

// NOTE: Các hàm setContainerSize, loadContainerSize, updateResizeHandlesPosition đã bị xóa
// SharedBoardEngine.ViewportControl quản lý viewport size

// Ép canvas khớp bề rộng thực của vùng chứa (giữ tỉ lệ hiện tại, tối đa 70%)
function fitCanvasToContainer() {
    if (!isInfinite || !infCanvas) return;

    const isOnline = window.isOnlineModeActive && window.isOnlineModeActive();

    // BUG.TXT: Bot Room Board First - use full viewport dimensions
    const isBotRoom = window.isBotRoomMode && document.getElementById('view-bot-room')?.classList.contains('active');

    // Bot Room: use full viewport with constant CELL_SIZE
    if (isBotRoom) {
        const availW = window.innerWidth;
        const availH = window.innerHeight;
        if (Math.abs(infCanvasW - availW) > INF_CS || Math.abs(infCanvasH - availH) > INF_CS) {
            applyCanvasSize(availW, availH, false);
        }
        return;
    }

    // Online: canvas nằm trong #shared-board-online → đo container đó
    if (isOnline) {
        const sbOnline = document.getElementById('shared-board-online');
        if (!sbOnline) return;
        const rect = sbOnline.getBoundingClientRect();
        const availW = Math.max(200, rect.width - 4);
        const availH = Math.max(150, rect.height - 4);
        if (availW < 100) return;
        console.log('[DEBUG-BOARD] fitCanvasToContainer (online):', { availW, availH, currentW: infCanvasW, currentH: infCanvasH });
        // Chỉ resize khi lệch đáng kể (> 1 ô) để tránh loop từ room-health ping
        const diffW = Math.abs(infCanvasW - availW);
        const diffH = Math.abs(infCanvasH - availH);
        if (diffW > INF_CS || diffH > INF_CS) {
            applyCanvasSize(availW, availH, false);
        }
        return;
    }

    // Offline: logic cũ
    const wrapper = document.getElementById('inf-resizable');
    let host = null;
    if (wrapper) {
        const matchBoard = document.getElementById('match-board-section');
        const unifiedSlot = document.getElementById('unified-board-slot');
        const battleBoardContainer = document.getElementById('battle-board-container');
        if (matchBoard && matchBoard.contains(wrapper)) {
            host = matchBoard;
        } else if (unifiedSlot && unifiedSlot.contains(wrapper)) {
            host = unifiedSlot;
        } else if (battleBoardContainer && battleBoardContainer.contains(wrapper)) {
            host = battleBoardContainer;
        } else {
            host = wrapper.parentElement;
        }
    }
    if (!host) host = document.getElementById('ui-game-container');
    if (!host) return;
    const availW = host.getBoundingClientRect().width - 8;
    if (availW < 100) return;
    if (Math.abs(infCanvasW - availW) > INF_CS) {
        const ratio = infCanvasW > 0 ? Math.min(infCanvasH / infCanvasW, 0.7) : 0.7;
        applyCanvasSize(availW, availW * ratio, false);
    }
}

// NOTE: Hàm toggleAutoSize đã bị xóa - SharedBoardEngine.ViewportControl quản lý auto mode

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
// Responsive default cell size based on device type
function getDefaultCellSize() {
    const width = window.innerWidth;
    if (width <= 768) {
        return 36; // Mobile
    } else if (width <= 1024) {
        return 42; // Tablet
    } else {
        return 48; // PC
    }
}
let INF_CS = getDefaultCellSize();
const INF_CS_MIN = 18, INF_CS_MAX = 80;

let infCanvas = null, infCtx = null;
let infCanvasW = 0, infCanvasH = 0;
let panStartX = 0, panStartY = 0, panStartVRow = 0, panStartVCol = 0;
let infPanning = false;
let vRowF = 0, vColF = 0;

// BUG 3 FIX: Flag to prevent multiple listener registrations
let infCanvasInitialized = false;

// ===== D-PAD PAN (MOBILE) =====
// Bấm/giữ 4 nút mũi tên để dịch chuyển góc nhìn — thay cho kéo chuột phải trên PC.
let dpadPanTimer = null;
const DPAD_PAN_STEP = 0.5;      // số ô dịch mỗi tick
const DPAD_PAN_INTERVAL = 50;   // ms giữa các tick khi giữ nút

function dpadPanStart(dr, dc) {
    dpadPanStop();
    const tick = () => {
        vRowF += dr * DPAD_PAN_STEP;
        vColF += dc * DPAD_PAN_STEP;
        // Gọi render trực tiếp — scheduleRender bị chặn khi fullscreen không pan chuột
        renderInfiniteBoard();
    };
    tick();
    dpadPanTimer = setInterval(tick, DPAD_PAN_INTERVAL);
}
function dpadPanStop() {
    if (dpadPanTimer) { clearInterval(dpadPanTimer); dpadPanTimer = null; }
}
function setupDpadControls() {
    const dpad = document.getElementById('inf-dpad');
    if (!dpad) return;
    dpad.querySelectorAll('.dpad-btn').forEach(btn => {
        const dr = parseInt(btn.getAttribute('data-dr'), 10) || 0;
        const dc = parseInt(btn.getAttribute('data-dc'), 10) || 0;
        const start = (e) => { e.preventDefault(); dpadPanStart(dr, dc); };
        // Touch (mobile) + mouse (màn hình nhỏ trên PC)
        btn.addEventListener('touchstart',  start, { passive: false });
        btn.addEventListener('mousedown',   start);
        btn.addEventListener('touchend',    dpadPanStop);
        btn.addEventListener('touchcancel', dpadPanStop);
        btn.addEventListener('mouseup',     dpadPanStop);
        btn.addEventListener('mouseleave',  dpadPanStop);
        // Chặn context menu khi giữ lâu trên mobile
        btn.addEventListener('contextmenu', e => e.preventDefault());
    });
}

function initInfCanvas(canvasElement) {
    // YC.TXT FIX: Canvas element is REQUIRED - no fallback to hardcode DOM lookup
    if (window.DEBUG_SYNC) console.log('[DEBUG-BOARD] initInfCanvas START', { canvasElementId: canvasElement?.id, canvasElement });

    if (!canvasElement) {
        console.error('[DEBUG-BOARD] initInfCanvas: canvasElement is REQUIRED - no fallback to hardcode DOM lookup');
        return;
    }

    const previousCanvas = infCanvas;
    infCanvas = canvasElement;
    const isOnline = window.isOnlineModeActive && window.isOnlineModeActive();

    // BUG 3 FIX: Only skip if already initialized AND pointing to the correct canvas element
    if (infCanvasInitialized && previousCanvas && previousCanvas === infCanvas) {
        console.warn('[DEBUG-BOARD] initInfCanvas already called for', infCanvas.id, '— skipping duplicate');
        return;
    }

    // Reset flag when switching to a different canvas
    if (previousCanvas && previousCanvas !== infCanvas) {
        console.log('[DEBUG-BOARD] Canvas mode switched from', previousCanvas.id, 'to', infCanvas.id, '— re-initializing');
        infCanvasInitialized = false;
    }

    if (window.DEBUG_SYNC) console.log('[DEBUG-BOARD] initInfCanvas called:', {
        isOnline,
        canvasId: infCanvas.id,
        canvasWidth: infCanvas.width,
        canvasHeight: infCanvas.height,
        canvasClientWidth: infCanvas.clientWidth,
        canvasClientHeight: infCanvas.clientHeight,
        parentElement: infCanvas.parentElement ? infCanvas.parentElement.id : 'none',
        parentClientWidth: infCanvas.parentElement ? infCanvas.parentElement.clientWidth : 0
    });

    infCanvasInitialized = true;
    infCtx    = infCanvas.getContext('2d');
    const boardEl = document.getElementById('board');
    if (boardEl) boardEl.style.display = 'none';

    // In online mode, inf-resizable is hidden, use shared-board-online container
    const wrapper = document.getElementById('inf-resizable');
    if (wrapper && !isOnline) {
        wrapper.style.display = 'inline-block';
    }

    const gc = document.getElementById('ui-game-container');
    if (gc) gc.classList.add('inf-mode');

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
    setupDpadControls();
    // Online dùng zoom riêng để không xung đột với zoom offline
    if (isOnline) {
        const savedOnlineZoom = parseFloat(localStorage.getItem('caro_zoom_online'));
        INF_CS = (savedOnlineZoom >= INF_CS_MIN && savedOnlineZoom <= INF_CS_MAX) ? savedOnlineZoom : 28;
    } else {
        INF_CS = loadZoom();
    }

    // BUG.TXT FIX: For Bot Room, don't override canvas dimensions
    const isBotRoom = window.isBotRoomMode && document.getElementById('view-bot-room')?.classList.contains('active');

    if (isBotRoom) {
        // Bot Room: canvas dimensions already set by initBotRoomCanvas
        infCanvasW = infCanvas.width;
        infCanvasH = infCanvas.height;
        if (window.DEBUG_SYNC) console.log('[DEBUG-BOARD] Bot Room: using existing canvas dimensions:', { infCanvasW, infCanvasH });
        updateCursorByTurn();
        if (window.DEBUG_SYNC) console.log('[DEBUG-BOARD] initInfCanvas DONE - ctx initialized');
        return;
    }

    // Online mode: đo kích thước từ shared-board-online container thực tế
    if (isOnline) {
        const sbOnline = document.getElementById('shared-board-online');
        const sbRect = sbOnline ? sbOnline.getBoundingClientRect() : null;
        let containerW = (sbRect && sbRect.width > 50) ? sbRect.width - 4 : 0;
        let containerH = (sbRect && sbRect.height > 50) ? sbRect.height - 4 : 0;

        // Nếu container chưa có kích thước (layout chưa paint), dùng fallback hợp lý
        if (containerW <= 50) {
            // Ước tính từ viewport: battle layout thường chiếm ~55% chiều rộng
            containerW = Math.max(300, Math.floor(window.innerWidth * 0.50));
        }
        if (containerH <= 50) {
            containerH = Math.max(220, Math.floor(containerW * 0.70));
        }

        infCanvasW = Math.floor(containerW / INF_CS) * INF_CS;
        infCanvasH = Math.floor(containerH / INF_CS) * INF_CS;
        if (infCanvasW < 200) infCanvasW = Math.max(200, containerW);
        if (infCanvasH < 150) infCanvasH = Math.max(150, containerH);

        infCanvas.width  = infCanvasW;
        infCanvas.height = infCanvasH;
        infCanvas.style.width  = infCanvasW + 'px';
        infCanvas.style.height = infCanvasH + 'px';
        if (window.DEBUG_SYNC) console.log('[DEBUG-BOARD] Canvas size set for online from container:', {
            infCanvasW, infCanvasH, sbRect,
            containerW, containerH
        });
        updateCursorByTurn();
        if (window.DEBUG_SYNC) console.log('[DEBUG-BOARD] initInfCanvas DONE - ctx initialized');
        // YC.TXT FIX: Don't call renderInfiniteBoard() here - let caller handle lifecycle
        // renderInfiniteBoard();
        // Fit lại sau khi layout CSS hoàn tất (2 frames để đảm bảo)
        requestAnimationFrame(() => requestAnimationFrame(() => {
            fitCanvasToContainer();
            renderInfiniteBoard();
        }));
        return;
    }

    // Load saved canvas size ngay lập tức nếu có
    const saved = loadCanvasSize();
    if (saved && saved.w > 0 && saved.h > 0) {
        infCanvasW = saved.w;
        infCanvasH = saved.h;
        infCanvas.width = infCanvasW;
        infCanvas.height = infCanvasH;
        infCanvas.style.width = infCanvasW + 'px';
        infCanvas.style.height = infCanvasH + 'px';
        if (window.DEBUG_SYNC) console.log('[DEBUG-BOARD] Canvas size set from saved:', { infCanvasW, infCanvasH });
        updateInfiniteResizeHandles();
        updateCursorByTurn();
        if (window.DEBUG_SYNC) console.log('[DEBUG-BOARD] initInfCanvas DONE - ctx initialized');
        // YC.TXT FIX: Don't call renderInfiniteBoard() here - let caller handle lifecycle
        // renderInfiniteBoard();
        requestAnimationFrame(() => requestAnimationFrame(() => fitCanvasToContainer()));
    } else {
        const defaultW = Math.max(500, window.innerWidth - 100);
        const defaultH = Math.floor(defaultW * 0.7);
        infCanvasW = defaultW; infCanvasH = defaultH;
        infCanvas.width = infCanvasW; infCanvas.height = infCanvasH;
        infCanvas.style.width = infCanvasW + 'px';
        infCanvas.style.height = infCanvasH + 'px';
        if (window.DEBUG_SYNC) console.log('[DEBUG-BOARD] Canvas size set to default:', { infCanvasW, infCanvasH });
        updateInfiniteResizeHandles();
        updateCursorByTurn();
        if (window.DEBUG_SYNC) console.log('[DEBUG-BOARD] initInfCanvas DONE - ctx initialized');
        // YC.TXT FIX: Don't call renderInfiniteBoard() here - let caller handle lifecycle
        // renderInfiniteBoard();
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

    const isOnline = window.isOnlineModeActive && window.isOnlineModeActive();
    
    // YC.TXT: Mobile bot room mode - use viewport dimensions instead of container
    const isMobileBotRoom = window.innerWidth <= 768 && 
                           window.isBotRoomMode && 
                           document.body.classList.contains('bot-room-mobile-mode');

    if (isMobileBotRoom) {
        // Use full viewport dimensions for mobile bot room
        w = window.innerWidth;
        h = window.innerHeight;
        // Don't apply ratio constraints in full-screen mode
        forceRatio = false;
    } else if (isOnline) {
        // Online: dùng kích thước thực từ container, KHÔNG áp tỉ lệ 70%
        // Chiều cao do container quyết định (shared-board-container có height tường minh)
        h = Math.min(h, Math.floor(window.innerHeight * 0.85));
    } else if (forceRatio) {
        h = Math.floor(w * 0.7);
    } else {
        h = Math.min(h, Math.floor(w * 0.7));
        h = Math.min(h, Math.floor(window.innerHeight * 0.68));
    }

    // Làm tròn xuống bội số INF_CS để grid vừa khít
    infCanvasW = Math.max(8 * INF_CS, Math.floor(w / INF_CS) * INF_CS);
    infCanvasH = Math.max(8 * INF_CS, Math.floor(h / INF_CS) * INF_CS);

    // Offline: đảm bảo chiều cao không vượt 70% chiều rộng (except mobile bot room)
    if (!isOnline && !isMobileBotRoom) {
        const maxH = Math.floor(infCanvasW * 0.7);
        if (infCanvasH > maxH) infCanvasH = maxH;
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
    
    // Nếu không auto-resize: load saved size rồi ép khớp bề rộng container hiện tại
    if (!isAuto) {
        const saved = loadCanvasSize();
        if (saved && saved.w > 0 && saved.h > 0) { 
            applyCanvasSize(saved.w, saved.h, false); // Load saved: không ép ratio
        }
        fitCanvasToContainer(); // Saved px có thể lệch với container % — đồng bộ lại
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
    if (!isAuto) return;

    const isOnline = window.isOnlineModeActive && window.isOnlineModeActive();

    // Online: đo theo shared-board-online container (canvas nằm trực tiếp trong đó)
    if (isOnline) {
        const sbOnline = document.getElementById('shared-board-online');
        if (!sbOnline) return;
        const rect = sbOnline.getBoundingClientRect();
        const availW = Math.max(200, rect.width - 4);
        const availH = Math.max(150, rect.height - 4);
        console.log('[DEBUG-BOARD] autoResizeInfCanvas (online):', { availW, availH });
        if (availW > 50 && availH > 50) {
            // Chỉ resize khi lệch đáng kể để tránh loop từ room-health ping
            if (Math.abs(infCanvasW - availW) > INF_CS || Math.abs(infCanvasH - availH) > INF_CS) {
                applyCanvasSize(availW, availH, false);
            }
        }
        return;
    }

    // Offline: logic cũ
    const wrapper = document.getElementById('inf-resizable');
    let availW;
    if (wrapper) {
        const matchBoard = document.getElementById('match-board-section');
        const unifiedSlot = document.getElementById('unified-board-slot');
        const battleBoardContainer = document.getElementById('battle-board-container');
        let host = null;
        if (matchBoard && matchBoard.contains(wrapper)) {
            host = matchBoard;
        } else if (unifiedSlot && unifiedSlot.contains(wrapper)) {
            host = unifiedSlot;
        } else if (battleBoardContainer && battleBoardContainer.contains(wrapper)) {
            host = battleBoardContainer;
        } else {
            host = wrapper.parentElement;
        }
        if (host) {
            availW = Math.max(300, host.getBoundingClientRect().width - 16);
        }
    }
    if (!availW) {
        const rect = infCanvas.getBoundingClientRect();
        availW = Math.max(300, window.innerWidth - rect.left - 40);
    }
    
    let availH = Math.floor(availW * 0.7);
    availH = Math.min(availH, Math.floor(window.innerHeight * 0.7));
    if (window.innerWidth <= 768 && isOnline) {
        availH = Math.min(availH, Math.floor(window.innerHeight * 0.45));
    }
    applyCanvasSize(availW, availH, true);
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
// BUG 3 & 4 FIX: Promise-based wrapper to wait for render completion
let _renderPromise = null;
function renderInfiniteBoardAsync() {
    if (_renderPromise) return _renderPromise;
    
    return new Promise((resolve) => {
        // Call original render
        if (window.DEBUG_SYNC) console.log('[DEBUG-BOARD] renderInfiniteBoardAsync() calling renderInfiniteBoard()');
        renderInfiniteBoard();
        
        // Wait for browser to paint the frame
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                _renderPromise = null;
                resolve();
            });
        });
    });
}

function renderInfiniteBoard() {
    // YC.TXT FIX: Early guard to prevent log spam - render only when canvas, context, and viewport are ready
    if (!infCanvas || !infCtx) {
        // Silent skip - don't log to avoid console spam
        return;
    }
    
    // Check viewport variables are ready
    if (typeof vRowF === 'undefined' || typeof vColF === 'undefined' ||
        typeof infCanvasW === 'undefined' || typeof infCanvasH === 'undefined' ||
        typeof INF_CS === 'undefined') {
        // Silent skip - don't log to avoid console spam
        return;
    }
    
    const canvasW = infCanvas?.width || 0;
    const canvasH = infCanvas?.height || 0;
    const logCols = Math.ceil(canvasW / INF_CS) + 1;
    const logRows = Math.ceil(canvasH / INF_CS) + 1;
    
    console.log('[DEBUG-BOARD] renderInfiniteBoard START - DIAGNOSTIC LOG', {
        canvasW,
        canvasH,
        INF_CS,
        cols: logCols,
        rows: logRows,
        scale: window.devicePixelRatio,
        infCanvasId: infCanvas?.id
    });

    // REMOVED GUARD: Allow old system to render in Online mode
    // SharedBoardEngine is not initialized for Online mode, so old system must handle it
    // YC.TXT FIX: Don't call initInfCanvas() here - canvas should be initialized before rendering
    // if (!infCanvas) initInfCanvas();
    // Tắt render khi fullscreen để tránh flickering
    if (isFullscreen) return;

    // BUG.TXT FIX: For Bot Room, use actual canvas dimensions instead of infCanvasW/infCanvasH
    const isBotRoom = window.isBotRoomMode && document.getElementById('view-bot-room')?.classList.contains('active');

    if (isBotRoom) {
        // Use actual canvas dimensions for Bot Room
        infCanvasW = infCanvas.width;
        infCanvasH = infCanvas.height;
    } else if (infCanvasW === 0 || infCanvasH === 0) {
        // Đảm bảo canvas có kích thước hợp lệ — trường hợp bố cục CSS chưa kịp áp dụng
        const container = infCanvas.parentElement;
        if (container) {
            const cw = container.clientWidth || container.getBoundingClientRect().width;
            if (cw > 0) {
                const ch = Math.floor(cw * 0.7);
                infCanvasW = cw; infCanvasH = ch;
                infCanvas.width = cw; infCanvas.height = ch;
                infCanvas.style.width = cw + 'px'; infCanvas.style.height = ch + 'px';
                console.log('[DEBUG-BOARD] Canvas size fixed from container:', { infCanvasW, infCanvasH });
            }
        }
        if (infCanvasW === 0) return; // Vẫn 0 thì bỏ qua
    }

    const c  = infCtx;
    const W  = infCanvasW, H = infCanvasH;
    const CS = INF_CS;

    const cols = Math.ceil(W / CS) + 1;
    const rows = Math.ceil(H / CS) + 1;

    console.log('[Viewport]', {
        canvasWidth: infCanvas.width,
        canvasHeight: infCanvas.height,
        clientWidth: infCanvas.clientWidth,
        clientHeight: infCanvas.clientHeight,
        infCanvasW,
        infCanvasH,
        INF_CS,
        cols,
        rows,
        DPR: window.devicePixelRatio
    });

    const theme = document.getElementById('theme-select').value;
    const themeColors = {
        'pure-white':  { bg:'#ffffff', grid:'#94a3b8', x:'#2563eb', o:'#dc2626', lastMove:'#f59e0b', win:'#dbeafe' },
        'pure-black':  { bg:'#242440', grid:'#6b6b90', x:'#818cf8', o:'#f472b6', lastMove:'#f59e0b', win:'#3730a3' },
        'cyber':       { bg:'#1e293b', grid:'#475569', x:'#38bdf8', o:'#f43f5e', lastMove:'#f43f5e', win:'#0284c7' },
        'luxury-wood': { bg:'#c2996b', grid:'#5c3d2e', x:'#ffffff', o:'#111111', lastMove:'#ffd700', win:'#b08556' }
    };
    let col = themeColors[theme] || themeColors['pure-white'];
    
    // Override với board skin từ shop nếu đã equip
    if (typeof getEquippedBoardSkin === 'function') {
        const boardSkin = getEquippedBoardSkin();
        console.log('[DEBUG-BOARD] Board skin from getEquippedBoardSkin:', boardSkin);
        if (boardSkin) {
            col = {
                ...col,
                bg: boardSkin.bg,
                grid: boardSkin.grid,
                win: boardSkin.win,
                lastMove: boardSkin.lastMove
            };
            console.log('[DEBUG-BOARD] Applied board skin colors:', { bg: col.bg, grid: col.grid, win: col.win, lastMove: col.lastMove });
        }
    }

    c.fillStyle = col.bg;
    c.fillRect(0, 0, W, H);

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

    // Lấy skin đang trang bị (nếu có hệ thống skin)
    // Khi online: mỗi bên dùng skin riêng. Khi offline: dùng skin của mình.
    const _onlineActive = window.isOnlineModeActive && window.isOnlineModeActive();
    let _iconX, _iconO, _colorX, _colorO, _useEmojiX, _useEmojiO;

    if (_onlineActive && typeof getSkinById === 'function') {
        const skinX = getSkinById(window._onlineSkinX || 'skin_default');
        const skinO = getSkinById(window._onlineSkinO || 'skin_default');
        _iconX    = skinX.icon_X;
        _iconO    = skinO.icon_O;
        _colorX   = skinX.color_X || col.x;
        _colorO   = skinO.color_O || col.o;
        _useEmojiX = (_iconX !== 'X');
        _useEmojiO = (_iconO !== 'O');
    } else {
        const _skin = (typeof getEquippedSkin === 'function') ? getEquippedSkin() : null;
        _useEmojiX = _skin && (_skin.icon_X !== 'X');
        _useEmojiO = _skin && (_skin.icon_O !== 'O');
        _iconX    = _skin ? _skin.icon_X : 'X';
        _iconO    = _skin ? _skin.icon_O : 'O';
        _colorX   = (_skin && _skin.color_X) ? _skin.color_X : col.x;
        _colorO   = (_skin && _skin.color_O) ? _skin.color_O : col.o;
    }

    // Vẽ quân cờ
    c.textAlign    = 'center';
    c.textBaseline = 'middle';

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

            // Xác định icon, màu và font size cho từng quân riêng biệt
            const isX = (val === 'X');
            const icon = isX ? _iconX : _iconO;
            const useEmoji = isX ? _useEmojiX : _useEmojiO;
            const color = isX ? _colorX : _colorO;

            // Emoji dùng font lớn hơn, text dùng font nhỏ hơn
            const fontSize = useEmoji ? Math.floor(CS * 0.72) : Math.floor(CS * 0.65);
            c.font = `bold ${fontSize}px Segoe UI, sans-serif`;

            // Dùng màu từ skin (nếu emoji thì không cần đổi fillStyle vì emoji tự có màu)
            if (!useEmoji) {
                c.fillStyle = color;
            }
            c.fillText(icon, px, py);
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

    // Nav bar (UI đã bị xóa, thêm null check)
    const nav = document.getElementById('inf-nav');
    const coordsEl = document.getElementById('inf-coords');
    if (nav && coordsEl) {
        const cr  = Math.floor(vRowF + rows/2), cc = Math.floor(vColF + cols/2);
        coordsEl.textContent = `Tâm: (${cr}, ${cc})`;
        nav.style.display = 'block';
    }

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
    // Hover effect đã bị tắt riêng trong infOnMouseMove nên render qua rAF không gây flickering.
    // PHẢI render khi pan (chuột phải / touch kéo) — nếu không bàn cờ sẽ không di chuyển.
    if (_rafPending) return;
    if (isFullscreen && !infPanning) return;
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
        if (infCanvas) infCanvas.style.cursor = 'grabbing';
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

    console.log('[DEBUG-BOARD] infOnClick triggered:', {
        isGameActive,
        currentPlayer: typeof currentPlayer !== 'undefined' ? currentPlayer : 'undefined',
        isOnlineMode: window.isOnlineModeActive ? window.isOnlineModeActive() : false,
        myOnlineRole: window.myOnlineRole || null,
        currentTurn: typeof currentTurn !== 'undefined' ? currentTurn : 'undefined',
        gameMode: typeof gameMode !== 'undefined' ? gameMode : 'undefined',
        botPiece: typeof botPiece !== 'undefined' ? botPiece : 'undefined'
    });

    if (!isGameActive) {
        console.warn('[DEBUG-BOARD] Click blocked: isGameActive is false');
        return;
    }

    // Chặn double-fire sau touch
    const timeSinceTouch = performance.now() - lastTouchEndTime;
    if (timeSinceTouch < TOUCH_CLICK_DELAY) return;

    const rect = infCanvas.getBoundingClientRect();
    const { r, c } = canvasPixelToCell(e.clientX - rect.left, e.clientY - rect.top);

    // ── ONLINE MODE: makeMove xử lý tất cả kiểm tra lượt/role ──
    if (window.isOnlineModeActive && window.isOnlineModeActive()) {
        if (getCell(r, c) !== '') return;
        makeMove(r, c);
        return;
    }

    // ── OFFLINE MODE ──
    if (gameMode.startsWith('ai') && currentPlayer === botPiece) return;
    if (getCell(r, c) !== '') return;
    makeMove(r, c);
}

// ===== KEYBOARD =====
function infOnKeyDown(e) {
    if (!isInfinite || !isGameActive) return;
    // Không xử lý khi đang gõ trong ô nhập liệu (chat, tên BXH...)
    const tag = (e.target && e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target && e.target.isContentEditable)) return;
    const isPlayerTurn = gameMode === 'solo' || (gameMode.startsWith('ai') && currentPlayer !== botPiece);

    // Mũi tên: PAN bàn cờ (như D-pad / kéo chuột phải).
    // Shift + Mũi tên: di chuyển CON TRỎ THỨ 2 (tính năng cũ).
    const KB_PAN_STEP = 1; // số ô dịch mỗi lần bấm
    if (!e.shiftKey) {
        if (e.key === 'ArrowUp')    { e.preventDefault(); vRowF -= KB_PAN_STEP; renderInfiniteBoard(); return; }
        if (e.key === 'ArrowDown')  { e.preventDefault(); vRowF += KB_PAN_STEP; renderInfiniteBoard(); return; }
        if (e.key === 'ArrowLeft')  { e.preventDefault(); vColF -= KB_PAN_STEP; renderInfiniteBoard(); return; }
        if (e.key === 'ArrowRight') { e.preventDefault(); vColF += KB_PAN_STEP; renderInfiniteBoard(); return; }
    }

    if (isPlayerTurn) {
        if (e.shiftKey) {
            if (e.key === 'ArrowUp')    { e.preventDefault(); keyboardCursorR--; keyboardCursorVisible = true; renderInfiniteBoard(); return; }
            if (e.key === 'ArrowDown')  { e.preventDefault(); keyboardCursorR++; keyboardCursorVisible = true; renderInfiniteBoard(); return; }
            if (e.key === 'ArrowLeft')  { e.preventDefault(); keyboardCursorC--; keyboardCursorVisible = true; renderInfiniteBoard(); return; }
            if (e.key === 'ArrowRight') { e.preventDefault(); keyboardCursorC++; keyboardCursorVisible = true; renderInfiniteBoard(); return; }
        }
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
    lastTouchEndTime = performance.now();
    if (!panMoved) {
        const t = e.changedTouches[0];
        const rect = infCanvas.getBoundingClientRect();
        const { r, c } = canvasPixelToCell(t.clientX - rect.left, t.clientY - rect.top);
        if (!isGameActive) return;
        if (typeof r !== 'number' || typeof c !== 'number' || isNaN(r) || isNaN(c)) return;
        if (getCell(r, c) !== '') return;

        // ── ONLINE MODE ──
        if (window.isOnlineModeActive && window.isOnlineModeActive()) {
            makeMove(r, c);
        // ── OFFLINE MODE ──
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
    // Lưu zoom riêng theo mode
    if (window.isOnlineModeActive && window.isOnlineModeActive()) {
        localStorage.setItem('caro_zoom_online', INF_CS);
    } else {
        saveZoom();
    }
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
    // REMOVED GUARD: Allow undo in online mode (for testing)
    if (moveHistory.length === 0 || !isGameActive) return;
    const lastMove = moveHistory.pop();
    setCell(lastMove.r, lastMove.c, "");
    moveCount--;
    currentPlayer = lastMove.player;

    // DISABLED Shared Board Engine sync - use old system only
    // This prevents conflicts between old system and SharedBoardEngine

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
    // YC.TXT FIX: Use existing infCanvas instead of hardcoding DOM lookup
    if (!infCanvas) return;
    if (typeof currentPlayer === 'undefined') return;

    // Online: khi không phải lượt mình → cursor default (không gây nhầm)
    const isOnline = window.isOnlineModeActive && window.isOnlineModeActive();
    if (isOnline) {
        const myTurn = (typeof currentTurn !== 'undefined' && currentTurn === window.myOnlineRole);
        if (!myTurn || !isGameActive) {
            infCanvas.style.cursor = 'default';
            return;
        }
        // Đến lượt mình: hiện icon quân của mình
        const myRole = window.myOnlineRole;
        const skinId = myRole === 'X' ? (window._onlineSkinX || 'skin_default') : (window._onlineSkinO || 'skin_default');
        const skin = (typeof getSkinById === 'function') ? getSkinById(skinId) : null;
        const icon  = skin ? (myRole === 'X' ? skin.icon_X : skin.icon_O) : myRole;
        const color = skin ? (myRole === 'X' ? (skin.color_X || '#2563eb') : (skin.color_O || '#dc2626'))
                           : (myRole === 'X' ? '#2563eb' : '#dc2626');
        _setCursorIcon(infCanvas, icon, color);
        return;
    }

    // Offline: dùng skin của mình theo lượt hiện tại
    let icon, color;
    if (typeof getEquippedSkin === 'function') {
        const skin = getEquippedSkin();
        icon  = currentPlayer === 'X' ? skin.icon_X  : skin.icon_O;
        color = currentPlayer === 'X' ? (skin.color_X || '#2563eb') : (skin.color_O || '#dc2626');
    } else {
        icon  = currentPlayer;
        color = currentPlayer === 'X' ? '#2563eb' : '#dc2626';
    }
    _setCursorIcon(infCanvas, icon, color);
}

// Helper vẽ cursor icon
function _setCursorIcon(canvas, icon, color) {
    const isEmoji = icon && icon.length <= 2 && /\p{Emoji}/u.test(icon);
    const SIZE = 32;
    const HOT  = Math.floor(SIZE / 2);

    if (isEmoji) {
        const tmp = document.createElement('canvas');
        tmp.width = tmp.height = SIZE;
        const ctx2 = tmp.getContext('2d');
        ctx2.font = `${Math.floor(SIZE * 0.78)}px Segoe UI Emoji, Apple Color Emoji, sans-serif`;
        ctx2.textAlign = 'center'; ctx2.textBaseline = 'middle';
        ctx2.fillText(icon, SIZE / 2, SIZE / 2);
        canvas.style.cursor = `url('${tmp.toDataURL()}') ${HOT} ${HOT}, auto`;
    } else {
        const hex = (color || '#2563eb').replace('#', '');
        let svgContent;
        if (icon === 'X') {
            svgContent = `<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 14 14'><line x1='2' y1='2' x2='12' y2='12' stroke='%23${hex}' stroke-width='2.5' stroke-linecap='round'/><line x1='12' y1='2' x2='2' y2='12' stroke='%23${hex}' stroke-width='2.5' stroke-linecap='round'/></svg>`;
        } else if (icon === 'O') {
            svgContent = `<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 14 14'><circle cx='7' cy='7' r='5' stroke='%23${hex}' stroke-width='2.5' fill='none'/></svg>`;
        } else {
            svgContent = `<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'><text x='8' y='13' text-anchor='middle' font-size='14' font-family='sans-serif' fill='%23${hex}'>${icon}</text></svg>`;
        }
        canvas.style.cursor = `url("data:image/svg+xml,${svgContent}") 7 7, auto`;
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
// NOTE: loadContainerSize đã bị xóa - SharedBoardEngine quản lý viewport
window.addEventListener('load', () => {
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
