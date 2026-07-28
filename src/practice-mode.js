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
        { value: 'bot-tia-chop',   label: '⚡ BOT TIA CHỚP',    emoji: '⚡' }
    ];

    // Tên hiển thị rút gọn
    const BOT_DISPLAY = {
        'ai-easy':        'Bot Dễ',
        'ai-medium':      'Bot Trung Bình',
        'ai-hard':        'Bot Khó',
        'bot-tia-chop':   'Bot Tia Chớp ⚡',
        'bot-toi-thuong': 'Bot Tối Thượng 💀'
    };

    // Cấu hình thưởng và giới hạn
    const BOT_REWARDS = {
        'ai-easy':        { xu: 100,  dailyLimit: null },
        'ai-medium':      { xu: 200,  dailyLimit: null },
        'ai-hard':        { xu: 500,  dailyLimit: null },
        'bot-tia-chop':   { xu: 2000, dailyLimit: 30 },  // 30 trận/ngày
        'bot-toi-thuong': { xu: 1500, dailyLimit: null }
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
        _showSelectPhase();

        const ctrl = document.getElementById('practice-controls');
        if (ctrl) ctrl.style.display = 'none';
    }

    // ── THOÁT ────────────────────────────────────────────────────────
    function exit() {
        _state.active = false;
        _state.phase  = 'select';
        _hideSelectPhase();
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
                const wc = parseInt(document.getElementById('win-count')?.value || '5');
                if (wc >= 5) {
                    window.updateUserStats('winBot', 1);
                }
            }
            // Cộng Xu khi thắng bot (có giới hạn ngày)
            if (typeof window.onWinBotXu === 'function') {
                const reward = BOT_REWARDS[_state.botLevel];
                if (reward && reward.xu > 0) {
                    // Kiểm tra giới hạn ngày
                    if (reward.dailyLimit !== null) {
                        if (!_checkDailyLimit(_state.botLevel, reward.dailyLimit)) {
                            console.log(`[PracticeMode] Đã đạt giới hạn ngày cho ${_state.botLevel}`);
                            return;
                        }
                    }
                    window.onWinBotXu(_state.botLevel, reward.xu);
                    // Tăng đếm ngày nếu có giới hạn
                    if (reward.dailyLimit !== null) {
                        _incrementDailyCount(_state.botLevel);
                    }
                }
            }
        }
    }

    // ── KIỂM TRA GIỚI HẠN NGÀY ───────────────────────────────────────
    function _checkDailyLimit(botLevel, limit) {
        try {
            const today = new Date().toDateString();
            const key = `practice_daily_${botLevel}`;
            const data = JSON.parse(localStorage.getItem(key) || '{}');

            if (data.date !== today) {
                // Reset cho ngày mới
                localStorage.setItem(key, JSON.stringify({ date: today, count: 0 }));
                return true;
            }

            return data.count < limit;
        } catch (e) {
            console.error('[PracticeMode] Error checking daily limit:', e);
            return true; // Mặc định cho phép nếu có lỗi
        }
    }

    // ── TĂNG ĐẾM NGÀY ───────────────────────────────────────────────
    function _incrementDailyCount(botLevel) {
        try {
            const today = new Date().toDateString();
            const key = `practice_daily_${botLevel}`;
            const data = JSON.parse(localStorage.getItem(key) || '{}');

            if (data.date !== today) {
                data.date = today;
                data.count = 1;
            } else {
                data.count++;
            }

            localStorage.setItem(key, JSON.stringify(data));
        } catch (e) {
            console.error('[PracticeMode] Error incrementing daily count:', e);
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

    // ── PUBLIC API ─────────────────────────────────────────────────
    return {
        initView,
        startWithBot,
        playAgain,
        changeBot,
        exit,
        onGameEvent,
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
