// ══════════════════════════════════════════════════════════════════
// POSITION EDITOR - Tạo Thế Cờ (Position Editor Module)
// Standalone file — no browser imports needed.
// Depends on globals: infiniteMap, GameState, renderInfiniteBoard,
//                     initGame, makeAIMove, getBotMove, quickScore
// ══════════════════════════════════════════════════════════════════

const PositionEditor = {
    // ── State ──────────────────────────────────────────────────────
    enabled:     false,   // checkbox "Tạo thế cờ" bật
    active:      false,   // đang dựng thế cờ (sau khi bấm "Bắt đầu dựng")
    locked:      false,   // đã chốt position → chuyển sang chơi
    currentTool: 'X',     // 'X' | 'O' | 'Erase'
    undoStack:   [],      // [{map: Map, timestamp}]
    redoStack:   [],
    savedMap:    null,    // snapshot trước initGame (phòng trường hợp initGame reset)

    // ── Helpers ────────────────────────────────────────────────────
    /** Trả về tham chiếu infiniteMap toàn cục hiện tại */
    _map: function() {
        // GameState.board.infiniteMap là nguồn chính; infiniteMap (trang-thai.js) được sync
        if (typeof GameState !== 'undefined' && GameState.board && GameState.board.infiniteMap) {
            return GameState.board.infiniteMap;
        }
        if (typeof infiniteMap !== 'undefined') {
            return infiniteMap;
        }
        return null;
    },

    /** Clone một Map */
    _cloneMap: function(src) {
        return new Map(src);
    },

    /** Sync cả infiniteMap lẫn GameState.board.infiniteMap về cùng một Map instance */
    _syncMap: function(newMap) {
        if (typeof GameState !== 'undefined' && GameState.board) {
            GameState.board.infiniteMap = newMap;
        }
        // Gán lại biến toàn cục trang-thai.js (nếu có)
        if (typeof window !== 'undefined') {
            // infiniteMap được khai báo trong trang-thai.js với var → có thể gán qua window
            // Nhưng vì trang-thai.js dùng initializeBoardState() để sync, ta gọi sau khi gán
        }
    },

    // ── Lifecycle ──────────────────────────────────────────────────
    enable: function() {
        this.enabled = true;
        console.log('[PositionEditor] enabled');
    },

    disable: function() {
        this.enabled = false;
        console.log('[PositionEditor] disabled');
    },

    /**
     * Bắt đầu chế độ dựng thế cờ.
     * Gọi sau khi BotRoomManager đã init canvas (inf-canvas-bot tồn tại).
     * Preconditions: enabled === true, window.isBotRoomMode === true
     */
    enter: function() {
        this.enabled = true;
        this.active  = true;
        this.locked  = false;
        this.undoStack = [];
        this.redoStack = [];
        this.savedMap  = null;
        this.currentTool = 'X';

        // Xóa bàn cờ để bắt đầu dựng thế mới
        const map = this._map();
        if (map) {
            map.clear();
            console.log('[PositionEditor] Board cleared for editing');
        } else {
            console.error('[PositionEditor] ERROR: infiniteMap not available!');
            // Try to create it
            if (typeof GameState !== 'undefined' && GameState.board) {
                GameState.board.infiniteMap = new Map();
                GameState.board.isInfinite = true;
                console.log('[PositionEditor] Created new infiniteMap in GameState');
            }
        }

        // Sync GameState
        if (typeof GameState !== 'undefined' && GameState.board) {
            GameState.board.infiniteMap = this._map();
        }

        // Render empty board
        if (typeof renderInfiniteBoard === 'function') {
            renderInfiniteBoard();
        }

        console.log('[PositionEditor] Entered editor mode. Board size:', this._map() ? this._map().size : 'N/A');
    },

    /**
     * Chốt position — ẩn toolbar, khởi trò chơi trên thế cờ đã dựng.
     * Preconditions: active === true, locked === false
     */
    lock: function() {
        if (!this.active) {
            console.warn('[PositionEditor] lock() called but not active');
            return;
        }
        this.locked = true;
        this.active = false;
        console.log('[PositionEditor] Locked. Board size:', this._map() ? this._map().size : 'N/A');
    },

    /** Reset về trạng thái khởi đầu (dùng khi thoát editor) */
    reset: function() {
        this.enabled     = false;
        this.active      = false;
        this.locked      = false;
        this.currentTool = 'X';
        this.undoStack   = [];
        this.redoStack   = [];
        this.savedMap    = null;
        console.log('[PositionEditor] Reset');
    },

    /**
     * Vào editor với bàn cờ hiện tại (không xóa quân).
     * Dùng khi người chơi muốn chỉnh sửa thế cờ đang diễn ra.
     */
    enterWithCurrentBoard: function() {
        this.enabled = true;
        this.active  = true;
        this.locked  = false;
        this.undoStack = [];
        this.redoStack = [];
        this.currentTool = 'X';

        // Giữ nguyên bàn cờ, chỉ lưu snapshot ban đầu
        const map = this._map();
        if (map) {
            this.undoStack.push({ map: this._cloneMap(map), timestamp: Date.now() });
            console.log('[PositionEditor] Entered editor with current board. Pieces:', map.size);
        }

        if (typeof renderInfiniteBoard === 'function') renderInfiniteBoard();
    },

    // ── Board Manipulation ─────────────────────────────────────────
    /**
     * Đặt / xóa quân tại (r, c) theo currentTool.
     * Toggle: click lại quân cùng loại thì xóa.
     */
    placePiece: function(r, c) {
        if (!this.active) {
            console.warn('[PositionEditor] placePiece called but not active');
            return;
        }

        const map = this._map();
        if (!map) {
            console.warn('[PositionEditor] infiniteMap not available');
            return;
        }

        // Lưu snapshot vào undoStack
        const snapshot = { map: this._cloneMap(map), timestamp: Date.now() };
        this.undoStack.push(snapshot);
        if (this.undoStack.length > 100) this.undoStack.shift();

        // Xóa redoStack khi có action mới
        this.redoStack = [];

        const key = `${r},${c}`;
        const current = map.get(key);

        if (this.currentTool === 'Erase') {
            map.delete(key);
        } else if (current === this.currentTool) {
            // Toggle: click lại quân cùng loại → xóa
            map.delete(key);
        } else {
            map.set(key, this.currentTool);
        }

        // Sync global infiniteMap để renderInfiniteBoard đọc đúng
        if (typeof infiniteMap !== 'undefined' && infiniteMap !== map) {
            infiniteMap.clear();
            for (const [k, v] of map) infiniteMap.set(k, v);
        }

        // Render lại
        if (typeof renderInfiniteBoard === 'function') renderInfiniteBoard();

        // Cập nhật cellScores nếu checkbox được tích
        const checkbox = document.getElementById('show-cell-scores-bot');
        console.log('[PositionEditor placePiece] checkbox:', checkbox, 'checked:', checkbox ? checkbox.checked : 'N/A');
        if (checkbox && checkbox.checked && typeof BotRoomManager !== 'undefined' && typeof BotRoomManager.onCellScoresCheckboxChange === 'function') {
            console.log('[PositionEditor placePiece] Calling onCellScoresCheckboxChange');
            BotRoomManager.onCellScoresCheckboxChange();
        }

        // Cập nhật nút Compare Bots
        if (typeof CompareBots !== 'undefined') CompareBots.checkBoardEmpty();
    },

    undo: function() {
        if (!this.active) return;
        if (this.undoStack.length === 0) {
            console.log('[PositionEditor] Nothing to undo');
            return;
        }

        const map = this._map();
        if (!map) return;

        // Đẩy trạng thái hiện tại vào redoStack
        this.redoStack.push({ map: this._cloneMap(map), timestamp: Date.now() });

        // Khôi phục snapshot trước
        const prev = this.undoStack.pop();
        this._applySnapshot(prev.map);

        if (typeof renderInfiniteBoard === 'function') renderInfiniteBoard();
        
        // Cập nhật cellScores nếu checkbox được tích
        const checkbox = document.getElementById('show-cell-scores-bot');
        if (checkbox && checkbox.checked && typeof BotRoomManager !== 'undefined' && typeof BotRoomManager.onCellScoresCheckboxChange === 'function') {
            BotRoomManager.onCellScoresCheckboxChange();
        }
        
        if (typeof CompareBots !== 'undefined') CompareBots.checkBoardEmpty();
        console.log('[PositionEditor] Undo');
    },

    redo: function() {
        if (!this.active) return;
        if (this.redoStack.length === 0) {
            console.log('[PositionEditor] Nothing to redo');
            return;
        }

        const map = this._map();
        if (!map) return;

        this.undoStack.push({ map: this._cloneMap(map), timestamp: Date.now() });

        const next = this.redoStack.pop();
        this._applySnapshot(next.map);

        if (typeof renderInfiniteBoard === 'function') renderInfiniteBoard();
        
        // Cập nhật cellScores nếu checkbox được tích
        const checkbox = document.getElementById('show-cell-scores-bot');
        if (checkbox && checkbox.checked && typeof BotRoomManager !== 'undefined' && typeof BotRoomManager.onCellScoresCheckboxChange === 'function') {
            BotRoomManager.onCellScoresCheckboxChange();
        }
        
        if (typeof CompareBots !== 'undefined') CompareBots.checkBoardEmpty();
        console.log('[PositionEditor] Redo');
    },

    /** Áp dụng snapshot vào infiniteMap hiện tại (in-place clear + re-fill) */
    _applySnapshot: function(snapshotMap) {
        const map = this._map();
        if (!map) return;
        map.clear();
        for (const [k, v] of snapshotMap) map.set(k, v);

        // Sync global infiniteMap
        if (typeof infiniteMap !== 'undefined' && infiniteMap !== map) {
            infiniteMap.clear();
            for (const [k, v] of map) infiniteMap.set(k, v);
        }
    },

    /** Xóa toàn bộ quân, xóa cả 2 stack */
    clear: function() {
        if (!this.active) return;

        const map = this._map();
        if (!map) return;

        // Lưu undo trước khi clear
        this.undoStack.push({ map: this._cloneMap(map), timestamp: Date.now() });
        if (this.undoStack.length > 100) this.undoStack.shift();
        this.redoStack = [];

        map.clear();

        // Sync global infiniteMap
        if (typeof infiniteMap !== 'undefined' && infiniteMap !== map) {
            infiniteMap.clear();
        }

        if (typeof renderInfiniteBoard === 'function') renderInfiniteBoard();
        
        // Cập nhật cellScores nếu checkbox được tích
        const checkbox = document.getElementById('show-cell-scores-bot');
        if (checkbox && checkbox.checked && typeof BotRoomManager !== 'undefined' && typeof BotRoomManager.onCellScoresCheckboxChange === 'function') {
            BotRoomManager.onCellScoresCheckboxChange();
        }
        
        if (typeof CompareBots !== 'undefined') CompareBots.checkBoardEmpty();
        console.log('[PositionEditor] Board cleared');
    },

    /** Thay đổi tool hiện tại */
    setTool: function(tool) {
        if (['X', 'O', 'Erase'].includes(tool)) {
            this.currentTool = tool;
            console.log('[PositionEditor] Tool =', tool);
        }
    },

    // ── Game Launch ────────────────────────────────────────────────
    /**
     * Khởi trận trên thế cờ đã dựng, KHÔNG reset bàn cờ.
     * Algorithm:
     *   1. Lưu savedMap
     *   2. Set window.positionEditorMode = true → initGame sẽ bỏ qua reset map
     *   3. Gọi initGame()
     *   4. Sau initGame, kiểm tra nếu map bị reset thì inject lại savedMap
     *   5. renderInfiniteBoard() và trigger bot nếu lượt bot
     */
    initGameFromPosition: function() {
        const map = this._map();
        if (!map) {
            console.warn('[PositionEditor] infiniteMap not available');
            return;
        }

        const scoreCheckbox = document.getElementById('show-cell-scores-bot');
        const keepCellScores = !!(scoreCheckbox && scoreCheckbox.checked) || window._cellScoresEnabled === true;
        window._cellScoresEnabled = keepCellScores;

        // Snapshot thế cờ trước initGame
        this.savedMap = this._cloneMap(map);
        console.log('[PositionEditor] savedMap size:', this.savedMap.size);

        // Báo initGame không reset board
        window.positionEditorMode = true;

        // Gọi initGame()
        if (typeof initGame === 'function') {
            initGame();
        } else {
            console.error('[PositionEditor] initGame not available');
            window.positionEditorMode = false;
            return;
        }

        window.positionEditorMode = false;

        // Sau initGame, kiểm tra nếu map bị xóa thì inject lại
        setTimeout(() => {
            const currentMap = this._map();
            if (!currentMap || !this.savedMap) return;

            // Commit the editor position unconditionally. initGame can replace
            // or clear one board reference, so restore both references in-place.
            currentMap.clear();
            for (const [k, v] of this.savedMap) currentMap.set(k, v);
            if (typeof GameState !== 'undefined' && GameState.board) {
                GameState.board.infiniteMap = currentMap;
                GameState.board.isInfinite = true;
            }
            if (typeof infiniteMap !== 'undefined' && infiniteMap !== currentMap) {
                infiniteMap.clear();
                for (const [k, v] of this.savedMap) infiniteMap.set(k, v);
            }

            // The editor position is a new game state, not a continuation of
            // stale moves from before editing. Let the bot continue next.
            if (typeof moveHistory !== 'undefined') {
                moveHistory = Array.from(this.savedMap, ([key, player]) => {
                    const [r, c] = key.split(',').map(Number);
                    return { r, c, player };
                });
            }
            if (typeof moveCount !== 'undefined') moveCount = this.savedMap.size;
            if (typeof currentPlayer !== 'undefined' && typeof botPiece !== 'undefined') {
                currentPlayer = botPiece;
            }
            if (typeof isBotMove !== 'undefined') isBotMove = false;

            const restoredScoreCheckbox = document.getElementById('show-cell-scores-bot');
            if (restoredScoreCheckbox) restoredScoreCheckbox.checked = keepCellScores;

            if (typeof renderInfiniteBoard === 'function') renderInfiniteBoard();

            if (keepCellScores && typeof BotRoomManager !== 'undefined' &&
                typeof BotRoomManager.onCellScoresCheckboxChange === 'function') {
                BotRoomManager.onCellScoresCheckboxChange();
            }

            // Nếu lượt đầu là bot thì kích hoạt
            if (typeof makeAIMove === 'function' &&
                typeof isGameActive !== 'undefined' && isGameActive &&
                typeof currentPlayer !== 'undefined' &&
                typeof botPiece !== 'undefined' &&
                currentPlayer === botPiece) {
                setTimeout(makeAIMove, 300);
            }
        }, 150);

        console.log('[PositionEditor] initGameFromPosition done');
    },
};

// Expose globally
window.PositionEditor = PositionEditor;

// ══════════════════════════════════════════════════════════════════
// DEBUG PANEL - Hiển thị thông tin nội tâm của bot
// ══════════════════════════════════════════════════════════════════
const DebugPanel = {
    visible:            false,
    explanationVisible: false,
    lastMoveInfo:       null,
    highlightCell:      null,  // {r, c} — ô vàng nước bot chọn

    show: function() {
        this.visible = true;
        const panel = document.getElementById('debug-info-panel');
        if (panel) panel.style.display = 'block';
    },

    hide: function() {
        this.visible = false;
        const panel = document.getElementById('debug-info-panel');
        if (panel) panel.style.display = 'none';
    },

    toggle: function() {
        if (this.visible) this.hide(); else this.show();
    },

    /**
     * Cập nhật panel sau khi bot đánh.
     * @param {Object} moveInfo - { depth, candidates, threatLevel, bestMove, evalScore,
     *                             attackScore, defenseScore, thinkTimeMs }
     */
    update: function(moveInfo) {
        this.lastMoveInfo = moveInfo;

        if (moveInfo && moveInfo.bestMove) {
            this.highlightCell = { r: moveInfo.bestMove.r, c: moveInfo.bestMove.c };
        } else {
            this.highlightCell = null;
        }

        const content = document.getElementById('debug-content');
        if (!content) return;

        if (!moveInfo) {
            content.innerHTML = '<div style="color:#94a3b8;font-size:12px;">Chờ bot đánh...</div>';
            return;
        }

        const fmt = v => (v !== undefined && v !== null) ? v : 'N/A';

        content.innerHTML = `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 12px;font-size:12px;">
                <div><span style="color:#94a3b8;">Depth:</span> <strong style="color:#a78bfa;">${fmt(moveInfo.depth)}</strong></div>
                <div><span style="color:#94a3b8;">Candidates:</span> <strong style="color:#a78bfa;">${fmt(moveInfo.candidates)}</strong></div>
                <div><span style="color:#94a3b8;">Threat:</span> <strong style="color:#f59e0b;">${fmt(moveInfo.threatLevel)}</strong></div>
                <div><span style="color:#94a3b8;">Score:</span> <strong style="color:#10b981;">${fmt(moveInfo.evalScore)}</strong></div>
                <div style="grid-column:span 2;">
                    <span style="color:#94a3b8;">Best Move:</span>
                    <strong style="color:#fbbf24;"> r=${fmt(moveInfo.bestMove && moveInfo.bestMove.r)}, c=${fmt(moveInfo.bestMove && moveInfo.bestMove.c)}</strong>
                    ${moveInfo.thinkTimeMs ? `<span style="color:#64748b;font-size:11px;"> (${moveInfo.thinkTimeMs}ms)</span>` : ''}
                </div>
            </div>
        `;

        // Kích hoạt nút giải thích
        const explainBtn = document.getElementById('btn-explain-move');
        if (explainBtn) explainBtn.style.display = 'inline-block';
    },

    toggleExplanation: function() {
        this.explanationVisible = !this.explanationVisible;
        const div = document.getElementById('debug-explanation');
        if (!div) return;

        if (this.explanationVisible && this.lastMoveInfo) {
            div.style.display = 'block';
            div.innerHTML = this._buildExplanationHtml();
        } else {
            div.style.display = 'none';
        }
    },

    _buildExplanationHtml: function() {
        const info = this.lastMoveInfo;
        if (!info) return '<div style="color:#94a3b8;">Không có dữ liệu</div>';

        let html = '';
        if (info.attackScore !== undefined)
            html += `<div style="margin-bottom:4px;font-size:12px;"><span style="color:#ef4444;">⚔️ Attack:</span> <strong>${info.attackScore}</strong></div>`;
        if (info.defenseScore !== undefined)
            html += `<div style="margin-bottom:4px;font-size:12px;"><span style="color:#3b82f6;">🛡️ Defense:</span> <strong>${info.defenseScore}</strong></div>`;
        if (info.threatScore !== undefined)
            html += `<div style="margin-bottom:4px;font-size:12px;"><span style="color:#f59e0b;">⚠️ Threat:</span> <strong>${info.threatScore}</strong></div>`;
        if (!html)
            html = '<div style="color:#94a3b8;font-size:12px;">Không có thông tin chi tiết</div>';
        return html;
    },

    /** Tô vàng ô bot chọn — gọi sau renderInfiniteBoard để vẽ overlay */
    highlightBotMove: function(r, c) {
        this.highlightCell = { r, c };
        // renderInfiniteBoard đọc window.debugHighlightCell để vẽ
        window.debugHighlightCell = { r, c };
        if (typeof renderInfiniteBoard === 'function') renderInfiniteBoard();
    },
};

window.DebugPanel = DebugPanel;

// ── Hook makeAIMove toàn cục để thu thập debug info ────────────────
// Sau khi tất cả script đã load, wrap window.makeAIMove
if (typeof window !== 'undefined') {
    window.addEventListener('load', function() {
        const originalMakeAIMove = window.makeAIMove;
        if (typeof originalMakeAIMove === 'function') {
            window.makeAIMove = function() {
                const t0 = performance.now();
                const result = originalMakeAIMove.apply(this, arguments);
                const t1 = performance.now();

                // Đọc debug info từ window.lastBotMoveInfo (nếu AI engine set)
                const moveInfo = window.lastBotMoveInfo || null;
                if (moveInfo) {
                    moveInfo.thinkTimeMs = Math.round(t1 - t0);
                }

                // Cập nhật DebugPanel nếu đang hiển thị
                if (typeof DebugPanel !== 'undefined' && DebugPanel.visible) {
                    DebugPanel.update(moveInfo);
                }

                return result;
            };
            console.log('[PositionEditor] makeAIMove hooked for debug');
        }
    });
}

// ══════════════════════════════════════════════════════════════════
// COMPARE BOTS - So sánh nước đi của nhiều bot trên cùng một thế cờ
// ══════════════════════════════════════════════════════════════════
const CompareBots = {
    bots: ['ai-easy', 'ai-medium', 'ai-hard', 'bot-toi-thuong', 'bot-tia-chop', 'bot-super'],

    _botNames: {
        'ai-easy':        'Bot Dễ',
        'ai-medium':      'Bot Trung Bình',
        'ai-hard':        'Bot Khó',
        'bot-toi-thuong': 'Bot Tối Thượng',
        'bot-tia-chop':   'Bot Tia Chớp',
        'bot-super':      'Bot Siêu Phẩm',
    },

    /**
     * Chạy compare — gọi getBotMove() với từng bot trên thế cờ hiện tại.
     * Postcondition: gameMode, botPiece, humanPiece, isGameActive được khôi phục
     */
    run: function(currentPlayerArg) {
        // Xác định currentPlayer
        const player = currentPlayerArg ||
            (typeof currentPlayer !== 'undefined' ? currentPlayer : 'X');

        // Kiểm tra bàn không trống
        const map = (typeof GameState !== 'undefined' && GameState.board && GameState.board.infiniteMap)
            ? GameState.board.infiniteMap
            : (typeof infiniteMap !== 'undefined' ? infiniteMap : null);

        if (!map || map.size === 0) {
            const panel = document.getElementById('compare-bots-panel');
            if (panel) {
                panel.style.display = 'block';
                const content = document.getElementById('compare-bots-content');
                if (content) content.innerHTML = '<div style="color:#f59e0b;padding:12px;text-align:center;">⚠️ Hãy đặt ít nhất 1 quân trước khi so sánh</div>';
            }
            return;
        }

        // Lưu snapshot bàn cờ — PHẢI giữ nguyên sau compare
        const savedMap = new Map(map);

        // Lưu trạng thái game gốc
        const origGameMode   = typeof gameMode   !== 'undefined' ? gameMode   : null;
        const origBotPiece   = typeof botPiece   !== 'undefined' ? botPiece   : null;
        const origHumanPiece = typeof humanPiece !== 'undefined' ? humanPiece : null;
        const origIsGameActive = typeof isGameActive !== 'undefined' ? isGameActive : false;
        const origIsSolo     = typeof isSolo !== 'undefined' ? isSolo : false;
        const origCurrentPlayer = typeof currentPlayer !== 'undefined' ? currentPlayer : null;
        const origLastMoveR  = typeof lastMoveR  !== 'undefined' ? lastMoveR  : null;
        const origLastMoveC  = typeof lastMoveC  !== 'undefined' ? lastMoveC  : null;
        const origMoveHistory = typeof moveHistory !== 'undefined' ? [...moveHistory] : null;

        const results = [];

        for (const botId of this.bots) {
            try {
                // Override trạng thái cho bot engine
                if (typeof gameMode   !== 'undefined') gameMode   = botId;
                if (typeof botPiece   !== 'undefined') botPiece   = player;
                if (typeof humanPiece !== 'undefined') humanPiece = player === 'X' ? 'O' : 'X';
                if (typeof isGameActive !== 'undefined') isGameActive = true;
                if (typeof isSolo !== 'undefined') isSolo = false;
                if (typeof currentPlayer !== 'undefined') currentPlayer = player;

                // Initialize other required global variables
                if (typeof lastMoveR !== 'undefined') lastMoveR = null;
                if (typeof lastMoveC !== 'undefined') lastMoveC = null;
                if (typeof lastMoveCell !== 'undefined') lastMoveCell = null;
                if (typeof moveHistory !== 'undefined') moveHistory = [];
                if (typeof moveCount !== 'undefined') moveCount = map.size;
                if (typeof isInfinite !== 'undefined') isInfinite = true;
                if (typeof winningCellCoords !== 'undefined') winningCellCoords = [];

                // Khôi phục bàn cờ (phòng trường hợp getBotMove() thay đổi)
                map.clear();
                for (const [k, v] of savedMap) map.set(k, v);

                // Sync cả GameState và global infiniteMap
                if (typeof GameState !== 'undefined' && GameState.board) {
                    GameState.board.infiniteMap = map;
                    GameState.board.isInfinite = true;
                    if (typeof GameState.board.winCount !== 'undefined') {
                        // Try to get winCount from roomRules
                        if (typeof window.roomRules !== 'undefined' && window.roomRules.winCount) {
                            GameState.board.winCount = window.roomRules.winCount;
                        }
                    }
                }
                if (typeof infiniteMap !== 'undefined') {
                    // Sync global infiniteMap with the map we're using
                    if (infiniteMap !== map) {
                        infiniteMap.clear();
                        for (const [k, v] of map) infiniteMap.set(k, v);
                    }
                }

                const t0 = performance.now();
                let move = null;
                if (typeof getBotMove === 'function') {
                    move = getBotMove();
                }
                const t1 = performance.now();

                // Tính score
                let score = 'N/A';
                if (move && typeof quickScore === 'function') {
                    try { score = quickScore(move.r, move.c, player); } catch(_) {}
                } else if (move && move.score !== undefined) {
                    score = move.score;
                }

                results.push({
                    botId,
                    botName:  this._botNames[botId] || botId,
                    move:     move ? { r: move.r, c: move.c } : null,
                    label:    move ? `r=${move.r}, c=${move.c}` : '—',
                    evalScore: score,
                    thinkMs:  Math.round(t1 - t0),
                });
            } catch(e) {
                console.error('[CompareBots] Error for bot', botId, e);
                results.push({ botId, botName: this._botNames[botId] || botId, move: null, label: 'Lỗi', evalScore: 'Lỗi', thinkMs: 0 });
            }

            // Luôn khôi phục bàn cờ sau mỗi bot
            map.clear();
            for (const [k, v] of savedMap) map.set(k, v);
        }

        // Khôi phục trạng thái game
        if (origGameMode   !== null && typeof gameMode   !== 'undefined') gameMode   = origGameMode;
        if (origBotPiece   !== null && typeof botPiece   !== 'undefined') botPiece   = origBotPiece;
        if (origHumanPiece !== null && typeof humanPiece !== 'undefined') humanPiece = origHumanPiece;
        if (typeof isGameActive !== 'undefined') isGameActive = origIsGameActive;
        if (typeof isSolo !== 'undefined') isSolo = origIsSolo;
        if (origCurrentPlayer !== null && typeof currentPlayer !== 'undefined') currentPlayer = origCurrentPlayer;
        if (origLastMoveR  !== null && typeof lastMoveR  !== 'undefined') lastMoveR  = origLastMoveR;
        if (origLastMoveC  !== null && typeof lastMoveC  !== 'undefined') lastMoveC  = origLastMoveC;
        if (origMoveHistory !== null && typeof moveHistory !== 'undefined') moveHistory = origMoveHistory;

        // Sync GameState cuối cùng
        if (typeof GameState !== 'undefined' && GameState.board) {
            GameState.board.infiniteMap = map;
        }

        this.renderTable(results);
    },

    renderTable: function(results) {
        const panel = document.getElementById('compare-bots-panel');
        const content = document.getElementById('compare-bots-content');
        if (!panel || !content) return;

        panel.style.display = 'block';

        let html = `
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
                <thead>
                    <tr style="border-bottom:1px solid #475569;">
                        <th style="text-align:left;padding:6px 8px;color:#a78bfa;">Bot</th>
                        <th style="text-align:center;padding:6px 8px;color:#a78bfa;">Nước đi</th>
                        <th style="text-align:right;padding:6px 8px;color:#a78bfa;">Score</th>
                        <th style="text-align:right;padding:6px 8px;color:#a78bfa;">Time</th>
                    </tr>
                </thead>
                <tbody>
        `;

        for (const r of results) {
            html += `
                <tr style="border-bottom:1px solid #1e293b;">
                    <td style="padding:6px 8px;color:#e2e8f0;">${r.botName}</td>
                    <td style="text-align:center;padding:6px 8px;color:#fbbf24;font-weight:bold;">${r.label}</td>
                    <td style="text-align:right;padding:6px 8px;color:#10b981;">${r.evalScore}</td>
                    <td style="text-align:right;padding:6px 8px;color:#64748b;">${r.thinkMs}ms</td>
                </tr>
            `;
        }

        html += `</tbody></table>`;
        content.innerHTML = html;
    },

    /** Disable nút Compare nếu bàn trống */
    checkBoardEmpty: function() {
        const map = (typeof GameState !== 'undefined' && GameState.board && GameState.board.infiniteMap)
            ? GameState.board.infiniteMap
            : (typeof infiniteMap !== 'undefined' ? infiniteMap : null);
        const btn = document.getElementById('btn-compare-bots');
        if (!btn) return;
        const empty = !map || map.size === 0;
        btn.disabled = empty;
        btn.style.opacity = empty ? '0.45' : '1';
        btn.style.cursor  = empty ? 'not-allowed' : 'pointer';
    },
};

window.CompareBots = CompareBots;
