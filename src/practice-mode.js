// ===================================================================
// PRACTICE MODE — Chế độ Luyện Tập
// Phòng đấu giả lập: Người chơi vs Bot
// Không cần đăng nhập, không cược, không đuổi
// Dùng chung Shared Board Engine với Online (DO4.TXT implementation)
// ===================================================================

const PracticeMode = (function() {
    // ── STATE ──────────────────────────────────────────────────────
    let _state = {
        active:     false,
        botLevel:   null,   // 'ai-easy' | 'ai-medium' | 'ai-hard' | 'ai-god'
        sessionId:  null,
        missionProcessed: false,
        phase: 'select',    // 'select' | 'playing' | 'ended'
        boardInitialized: false
    };

    const BOT_LEVELS = [
        { value: 'ai-easy',        label: '🤖 BOT DỄ',          emoji: '🟢' },
        { value: 'ai-medium',      label: '🤖 BOT TRUNG BÌNH',   emoji: '🟡' },
        { value: 'ai-hard',        label: '🤖 BOT KHÓ',          emoji: '🟠' },
        { value: 'bot-toi-thuong', label: '👑 BOT TỐI THƯỢNG',  emoji: '💀' },
        { value: 'bot-tia-chop',   label: '⚡ BOT TIA CHỚP',    emoji: '⚡' },
        { value: 'bot-than-co',    label: '🌟 BOT THẦN CƠ',     emoji: '🌟' }
    ];

    // Tên hiển thị rút gọn
    const BOT_DISPLAY = {
        'ai-easy':        'Bot Dễ',
        'ai-medium':      'Bot Trung Bình',
        'ai-hard':        'Bot Khó',
        'bot-tia-chop':   'Bot Tia Chớp ⚡',
        'bot-toi-thuong': 'Bot Tối Thượng 💀',
        'bot-than-co':    'Bot Thần Cơ 🌟'
    };

    // ── HELPERS ────────────────────────────────────────────────────
    function _genSessionId() {
        return 'ps_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    }

    function _getPlayerName() {
        // Ưu tiên tên đăng nhập; fallback khách
        if (typeof window.currentUserData !== 'undefined' && window.currentUserData) {
            return window.currentUserData.displayName || window.currentUserData.username || 'Bạn';
        }
        if (typeof window.currentUsername !== 'undefined' && window.currentUsername) {
            return window.currentUsername;
        }
        return 'Bạn';
    }

    function _isLoggedIn() {
        return !!(
            (typeof window.currentUserData !== 'undefined' && window.currentUserData) ||
            (typeof window.currentUsername !== 'undefined' && window.currentUsername)
        );
    }

    // ── UI HELPERS ─────────────────────────────────────────────────
    function _setStatus(html) {
        const el = document.getElementById('practice-status-bar');
        if (el) el.innerHTML = html;
        // Sync sang status-panel cũ (dùng bởi logic-game.js)
        const sp = document.getElementById('status-panel');
        if (sp) sp.innerHTML = html;
    }

    function _setIndicator(activePlayer) {
        // activePlayer: 'X' = lượt người, 'O' = lượt bot, null = kết thúc
        const indX = document.getElementById('practice-indicator-x');
        const indO = document.getElementById('practice-indicator-o');
        if (!indX || !indO) return;
        if (activePlayer === 'X') {
            indX.textContent = '🟢 Lượt của bạn';
            indX.className   = 'practice-indicator practice-indicator-active';
            indO.textContent = 'Đang chờ';
            indO.className   = 'practice-indicator practice-indicator-inactive';
        } else if (activePlayer === 'O') {
            indX.textContent = 'Đang chờ';
            indX.className   = 'practice-indicator practice-indicator-inactive';
            indO.textContent = '🤖 Đang tính...';
            indO.className   = 'practice-indicator practice-indicator-active';
        } else {
            indX.className = 'practice-indicator practice-indicator-inactive';
            indO.className = 'practice-indicator practice-indicator-inactive';
        }
    }

    function _updatePlayerCards() {
        // Card X (người chơi)
        const nameX = document.getElementById('practice-name-x');
        if (nameX) nameX.textContent = _getPlayerName();

        // Card O (bot)
        const nameO = document.getElementById('practice-name-o');
        if (nameO) nameO.textContent = BOT_DISPLAY[_state.botLevel] || 'Bot';

        // Stats nếu đăng nhập
        const statsX = document.getElementById('practice-stats-x');
        if (statsX) {
            if (_isLoggedIn() && typeof window.currentUserData !== 'undefined' && window.currentUserData) {
                const d = window.currentUserData;
                statsX.textContent = `🤖${d.winBot||0} ⚔️${d.winSolo||0} 📉${d.loseSolo||0}`;
            } else {
                statsX.textContent = '🎯 Khách';
            }
        }
    }

    // ── RENDER PHASE: SELECT BOT ────────────────────────────────────
    function _showSelectPhase() {
        _state.phase = 'select';
        const overlay = document.getElementById('practice-select-overlay');
        if (overlay) overlay.style.display = 'flex';
    }

    function _hideSelectPhase() {
        const overlay = document.getElementById('practice-select-overlay');
        if (overlay) overlay.style.display = 'none';
    }

    function _showPlayingPhase() {
        _state.phase = 'playing';
        _hideSelectPhase();

        // Hiện các nút điều khiển
        const ctrl = document.getElementById('practice-controls');
        if (ctrl) ctrl.style.display = 'flex';

        // Cập nhật thẻ tên bot
        const badgeO = document.getElementById('practice-badge-o');
        if (badgeO) badgeO.textContent = '⚔️ ' + (BOT_DISPLAY[_state.botLevel] || 'Bot') + ' · Đối thủ';

        _updatePlayerCards();
    }

    // ── KHỞI ĐỘNG LUYỆN TẬP ────────────────────────────────────────
    function startWithBot(level) {
        if (!BOT_LEVELS.find(b => b.value === level)) {
            level = 'ai-god';
        }
        _state.botLevel      = level;
        _state.sessionId     = _genSessionId();
        _state.missionProcessed = false;
        _state.active        = true;

        // Ẩn header để bàn cờ rộng hơn
        const appHeader = document.getElementById('app-header');
        if (appHeader) appHeader.style.display = 'none';
        document.body.classList.add('in-game-active');

        // Set game-mode selector để logic-game.js đọc đúng
        const modeEl = document.getElementById('game-mode');
        if (modeEl) {
            modeEl.value = level;
        }

        // Người chơi luôn là X, bot là O
        const pieceEl = document.getElementById('player-piece');
        if (pieceEl) pieceEl.value = 'X';

        const firstEl = document.getElementById('first-move');
        if (firstEl) firstEl.value = 'X';

        _showPlayingPhase();
        
        // YC.TXT FIX: Use centralized GameModeManager
        if (typeof GameModeManager !== 'undefined') {
            GameModeManager.setMode(GameModes.TRAINING, { botLevel: level });
        }
        
        // BUG 5 FIX: Save complete training mode state to localStorage for F5 reload
        localStorage.setItem('training_mode', 'true');
        localStorage.setItem('training_config', JSON.stringify({
            botLevel: level,
            // Save game state for proper restoration
            boardState: typeof infiniteMap !== 'undefined' ? Array.from(infiniteMap.entries()) : null,
            moveHistory: typeof moveHistory !== 'undefined' ? moveHistory : [],
            currentPlayer: typeof currentPlayer !== 'undefined' ? currentPlayer : 'X',
            isGameActive: typeof isGameActive !== 'undefined' ? isGameActive : true,
            winCount: typeof winCount !== 'undefined' ? winCount : 5,
            lastMoveR: typeof lastMoveR !== 'undefined' ? lastMoveR : null,
            lastMoveC: typeof lastMoveC !== 'undefined' ? lastMoveC : null
        }));

        // DISABLED Shared Board Engine - use old system to avoid conflicts
        // The old system (initGame + renderInfiniteBoard) handles Practice mode
        // SharedBoardEngine was causing sync issues with the old system

        // Khởi tạo game qua engine hiện có
        if (typeof initGame === 'function') {
            initGame();
        }

        // Áp dụng board skin từ shop
        if (typeof applyBoardSkinToEngine === 'function') {
            applyBoardSkinToEngine();
        }

        _setStatus('🟢 LƯỢT CỦA BẠN (X)');
        _setIndicator('X');
    }

    // ── CHƠI LẠI ────────────────────────────────────────────────────
    function playAgain() {
        if (!_state.botLevel) {
            _showSelectPhase();
            return;
        }
        _state.sessionId        = _genSessionId();
        _state.missionProcessed = false;
        _state.phase            = 'playing';

        const modeEl = document.getElementById('game-mode');
        if (modeEl) modeEl.value = _state.botLevel;

        // DISABLED Shared Board Engine - use old system
        // Clear old board state instead
        if (typeof infiniteMap !== 'undefined') {
            infiniteMap.clear();
        }
        if (typeof moveHistory !== 'undefined') {
            moveHistory.length = 0;
        }

        // Xóa state restore khi chơi lại để tránh dùng state cũ
        localStorage.removeItem('training_mode');
        localStorage.removeItem('training_config');

        if (typeof initGame === 'function') initGame();

        _setStatus('🟢 LƯỢT CỦA BẠN (X)');
        _setIndicator('X');

        const ctrl = document.getElementById('practice-controls');
        if (ctrl) ctrl.style.display = 'flex';
    }

    // ── ĐỔI BOT ─────────────────────────────────────────────────────
    function changeBot() {
        _state.phase  = 'select';
        _state.active = false;
        
        // Xóa state restore khi đổi bot
        localStorage.removeItem('training_mode');
        localStorage.removeItem('training_config');
        
        _showSelectPhase();

        const ctrl = document.getElementById('practice-controls');
        if (ctrl) ctrl.style.display = 'none';
    }

    // ── THOÁT ────────────────────────────────────────────────────────
    function exit() {
        _state.active = false;
        _state.phase  = 'select';
        _hideSelectPhase();
        // Show navigation when exiting battle
        if (typeof showTopNavigation === 'function') {
            showTopNavigation();
        }
        if (typeof switchView === 'function') switchView('home');
    }

    // ── CẬP NHẬT TRẠNG THÁI (gọi từ logic-game.js hooks) ───────────
    function onGameEvent(event, data) {
        if (!_state.active) return;
        switch (event) {
            case 'bot-thinking':
                if (_state.phase !== 'ended') {
                    _setStatus('🤖 BOT ĐANG SUY NGHĨ...');
                    _setIndicator('O');
                }
                break;
            case 'player-turn':
                if (_state.phase !== 'ended') {
                    _setStatus('🟢 LƯỢT CỦA BẠN (X)');
                    _setIndicator('X');
                }
                break;
            case 'player-win':
                _setStatus('🏆 BẠN ĐÃ THẮNG!');
                _setIndicator(null);
                _state.phase = 'ended';
                _state.active = false; // Stop accepting moves
                _processMission('player-win');
                break;
            case 'bot-win':
                _setStatus('🤖 BOT ĐÃ THẮNG!');
                _setIndicator(null);
                _state.phase = 'ended';
                _state.active = false; // Stop accepting moves
                break;
            case 'game-end':
                _state.phase = 'ended';
                _state.active = false; // Stop accepting moves
                break;
        }
    }

    // ── XỬ LÝ NHIỆM VỤ ─────────────────────────────────────────────
    function _processMission(event) {
        // Chống tính trùng trong cùng session
        if (_state.missionProcessed) return;
        _state.missionProcessed = true;

        if (!_isLoggedIn()) {
            // Lưu tạm vào localStorage cho khách
            _saveGuestProgress();
            return;
        }

        if (event === 'player-win') {
            // Cập nhật thống kê winBot
            if (typeof window.updateUserStats === 'function') {
                // Resolve win count from GameState.roomRules if available, otherwise DOM fallback
                const resolvedWc = (typeof GameState !== 'undefined' && GameState.roomRules && typeof GameState.roomRules.winCount === 'number') ? GameState.roomRules.winCount : parseInt(document.getElementById('win-count')?.value || '5');
                if (resolvedWc >= 5) {
                    window.updateUserStats('winBot', 1);
                }
            }
            // Cộng Xu khi thắng bot (có giới hạn ngày) - dùng hệ thống thống nhất từ xu-nhiem-vu.js
            if (typeof window.onWinBotXu === 'function') {
                // Resolve win count from GameState.roomRules if available, otherwise DOM fallback
                const resolvedWc = (typeof GameState !== 'undefined' && GameState.roomRules && typeof GameState.roomRules.winCount === 'number') ? GameState.roomRules.winCount : parseInt(document.getElementById('win-count')?.value || '5');
                window.onWinBotXu(_state.botLevel, resolvedWc);
            }
        }
    }

    // ── LƯU TIẾN ĐỘ KHÁCH ─────────────────────────────────────────
    function _saveGuestProgress() {
        try {
            const key = 'guestMissionProgress';
            const cur = JSON.parse(localStorage.getItem(key) || '{}');
            cur.winBot = (cur.winBot || 0) + 1;
            cur[_state.botLevel] = (cur[_state.botLevel] || 0) + 1;
            cur.lastWin = new Date().toISOString();
            localStorage.setItem(key, JSON.stringify(cur));
        } catch(e) {}
    }

    // ── KHỞI TẠO VIEW ──────────────────────────────────────────────
    function initView() {
        // Reset state về select khi vào view
        _state.active = false;
        _state.phase  = 'select';

        _showSelectPhase();
        _updatePlayerCards();

        // Ẩn controls
        const ctrl = document.getElementById('practice-controls');
        if (ctrl) ctrl.style.display = 'none';

        _setStatus('Chọn Bot để bắt đầu luyện tập');
        _setIndicator(null);
    }

    // ── UNDO MOVE ───────────────────────────────────────────────────
    function undoPracticeMove() {
        // console.log({
            // active:_state.active,
            // phase:_state.phase,
            // moveHistory:typeof moveHistory !== 'undefined' ? moveHistory.length : 'undefined'
        // });
        if (!_state.active || _state.phase !== 'playing') {
            alert('Chỉ có thể undo khi đang chơi!');
            return;
        }

        if (typeof moveHistory === 'undefined' || !moveHistory || moveHistory.length < 2) {
            alert('Cần ít nhất 2 nước (người + bot) để undo!');
            return;
        }

        if (typeof infiniteMap === 'undefined') {
            alert('Bàn cờ chưa khởi tạo!');
            return;
        }

        // Undo 2 nước: bot move + player move
        const botMove = moveHistory.pop();
        const playerMove = moveHistory.pop();

        if (!botMove || !playerMove) {
            alert('Lỗi lịch sử nước đi!');
            return;
        }

        // Xóa quân khỏi bàn cờ
        infiniteMap.delete(`${botMove.r},${botMove.c}`);
        infiniteMap.delete(`${playerMove.r},${playerMove.c}`);

        // Giảm moveCount
        if (typeof moveCount !== 'undefined') {
            moveCount -= 2;
        }

        // Reset về lượt người
        if (typeof currentPlayer !== 'undefined') {
            currentPlayer = 'X';
        }

        // Reset last move
        if (typeof lastMoveR !== 'undefined' && typeof lastMoveC !== 'undefined') {
            if (moveHistory.length > 0) {
                const prevMove = moveHistory[moveHistory.length - 1];
                lastMoveR = prevMove.r;
                lastMoveC = prevMove.c;
            } else {
                lastMoveR = null;
                lastMoveC = null;
            }
        }

        // Render lại bàn cờ
        if (typeof renderInfiniteBoard === 'function') {
            renderInfiniteBoard();
        }

        // Cập nhật UI
        _setStatus('🟢 LƯỢT CỦA BẠN (X)');
        _setIndicator('X');

        // Bot sẽ không tự đánh vì currentPlayer đã được set về 'X' (lượt người)
    }

    // ── PUBLIC API ─────────────────────────────────────────────────
    return {
        initView,
        startWithBot,
        playAgain,
        changeBot,
        exit,
        onGameEvent,
        undoPracticeMove,
        getState: () => ({ ..._state }),
        BOT_LEVELS,
        BOT_DISPLAY
    };
})();

window.PracticeMode = PracticeMode;

// ── HOOKS VÀO LOGIC-GAME.JS ────────────────────────────────────────
// Patch updateStatus để PracticeMode nhận thông báo trạng thái
(function() {
    const _origUpdateStatus = window.updateStatus || function(){};
    window.updateStatus = function() {
        _origUpdateStatus.apply(this, arguments);

        // Chỉ hook khi đang ở view-training và practice active
        const vt = document.getElementById('view-training');
        if (!vt || !vt.classList.contains('active')) return;
        if (!PracticeMode.getState().active) return;

        if (typeof gameMode !== 'undefined' && gameMode.startsWith('ai')) {
            if (typeof currentPlayer !== 'undefined' && typeof botPiece !== 'undefined') {
                if (currentPlayer === botPiece) {
                    PracticeMode.onGameEvent('bot-thinking');
                } else {
                    PracticeMode.onGameEvent('player-turn');
                }
            }
        }
    };
})();

// BUG 5 FIX: Restore training mode state on page load
window.addEventListener('load', () => {
    // YC.TXT FIX: Use centralized GameModeManager for restore
    if (typeof GameModeManager !== 'undefined') {
        const restoredMode = GameModeManager.restoreMode();
        
        if (restoredMode === GameModes.TRAINING) {
            const context = GameModeManager.getContext();
            const savedTrainingConfig = localStorage.getItem('training_config');
            
            if (savedTrainingConfig) {
                try {
                    const config = JSON.parse(savedTrainingConfig);
                    
                    localStorage.removeItem('current_room_id');
                    
                    if (config.boardState && typeof infiniteMap !== 'undefined') {
                        infiniteMap.clear();
                        config.boardState.forEach(([key, value]) => {
                            infiniteMap.set(key, value);
                        });
                    }
                    if (config.moveHistory && typeof moveHistory !== 'undefined') {
                        moveHistory.length = 0;
                        moveHistory.push(...config.moveHistory);
                    }
                    if (typeof currentPlayer !== 'undefined') currentPlayer = config.currentPlayer || 'X';
                    if (typeof isGameActive !== 'undefined') isGameActive = config.isGameActive !== false;
                    if (typeof winCount !== 'undefined') winCount = config.winCount ?? 5;
                    if (typeof lastMoveR !== 'undefined') lastMoveR = config.lastMoveR;
                    if (typeof lastMoveC !== 'undefined') lastMoveC = config.lastMoveC;
                    
                    setTimeout(() => {
                        if (typeof switchView === 'function') {
                            switchView('training');
                        }
                        if (typeof hideTopNavigation === 'function') {
                            hideTopNavigation();
                        }
                        PracticeMode.startWithBot(config.botLevel);
                        // YC.TXT FIX: Only render if canvas is ready
                        if (typeof renderInfiniteBoard === 'function' && typeof infCanvas !== 'undefined' && infCanvas && typeof infCtx !== 'undefined' && infCtx) {
                            renderInfiniteBoard();
                        }
                    }, 100);
                } catch(e) {
                    console.error('[PracticeMode] Failed to restore training state:', e);
                    localStorage.removeItem('training_mode');
                    localStorage.removeItem('training_config');
                    GameModeManager.clearMode();
                }
            }
        }
    } else {
        // Fallback to old logic
        const savedTrainingMode = localStorage.getItem('training_mode');
        const savedTrainingConfig = localStorage.getItem('training_config');
        
        if (savedTrainingMode === 'true' && savedTrainingConfig) {
            try {
                const config = JSON.parse(savedTrainingConfig);
                
                localStorage.removeItem('current_room_id');
                
                if (config.boardState && typeof infiniteMap !== 'undefined') {
                    infiniteMap.clear();
                    config.boardState.forEach(([key, value]) => {
                        infiniteMap.set(key, value);
                    });
                }
                if (config.moveHistory && typeof moveHistory !== 'undefined') {
                    moveHistory.length = 0;
                    moveHistory.push(...config.moveHistory);
                }
                if (typeof currentPlayer !== 'undefined') currentPlayer = config.currentPlayer || 'X';
                if (typeof isGameActive !== 'undefined') isGameActive = config.isGameActive !== false;
                if (typeof winCount !== 'undefined') winCount = config.winCount ?? 5;
                if (typeof lastMoveR !== 'undefined') lastMoveR = config.lastMoveR;
                if (typeof lastMoveC !== 'undefined') lastMoveC = config.lastMoveC;
                
                setTimeout(() => {
                    if (typeof switchView === 'function') {
                        switchView('training');
                    }
                    if (typeof hideTopNavigation === 'function') {
                        hideTopNavigation();
                    }
                    PracticeMode.startWithBot(config.botLevel);
                    if (typeof renderInfiniteBoard === 'function') {
                        renderInfiniteBoard();
                    }
                }, 100);
            } catch(e) {
                console.error('[PracticeMode] Failed to restore training state:', e);
                localStorage.removeItem('training_mode');
                localStorage.removeItem('training_config');
            }
        }
    }
});

// BUG 5 FIX: Clear training state when exiting
const _origExitPractice = PracticeMode.exit || function(){};
PracticeMode.exit = function() {
    // YC.TXT FIX: Clear mode from GameModeManager
    if (typeof GameModeManager !== 'undefined') {
        GameModeManager.clearMode();
    }
    localStorage.removeItem('training_mode');
    localStorage.removeItem('training_config');
    _origExitPractice.apply(this, arguments);
};
