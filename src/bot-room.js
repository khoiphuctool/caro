// ══════════════════════════════════════════════════════════════════
// BOT ROOM MANAGER - Quản lý phòng Bot Offline
// ══════════════════════════════════════════════════════════════════

const BotRoomManager = {
    BOT_ROOMS: [
        { id: 1, name: 'Bot Dễ',        emoji: '🟢', color: '#10b981', gameMode: 'ai-easy',        description: 'Dành cho người mới' },
        { id: 2, name: 'Bot Trung Bình', emoji: '🟡', color: '#f59e0b', gameMode: 'ai-medium',      description: 'Luyện phản xạ' },
        { id: 3, name: 'Bot Khó',        emoji: '🟠', color: '#f97316', gameMode: 'ai-hard',        description: 'Thử thách thật sự' },
        { id: 4, name: 'Bot Tối Thượng', emoji: '💀', color: '#ef4444', gameMode: 'bot-toi-thuong', description: 'Cấp cao nhất' },
        { id: 5, name: 'Bot Tia Chớp',  emoji: '⚡', color: '#3b82f6', gameMode: 'bot-tia-chop',   description: 'Tốc độ 2000x' },
        { id: 6, name: 'Sắp ra mắt',    emoji: '🔒', color: '#94a3b8', gameMode: null,             description: 'Mở khóa theo nhiệm vụ' },
        { id: 7, name: 'Sắp ra mắt',    emoji: '🔒', color: '#94a3b8', gameMode: null,             description: 'Mở khóa theo nhiệm vụ' },
        { id: 8, name: 'Sắp ra mắt',    emoji: '🔒', color: '#94a3b8', gameMode: null,             description: 'Mở khóa theo nhiệm vụ' },
        { id: 9, name: 'Sắp ra mắt',    emoji: '🔒', color: '#94a3b8', gameMode: null,             description: 'Mở khóa theo nhiệm vụ' }
    ],

    currentBotRoom: null,
    isBotRoomMode:  false,

    // ══ Danh sách phòng bot trong lobby ══════════════════════════
    openBotLobby: function() {
        const container = document.getElementById('room-list');
        if (!container) return;
        container.innerHTML = '';

        this.BOT_ROOMS.forEach(room => {
            const el = document.createElement('div');
            if (!room.gameMode) {
                // Phòng khóa
                el.style.cssText = 'padding:12px;margin:8px 0;border:1px dashed #cbd5e1;border-radius:8px;background:#f8fafc;display:flex;justify-content:space-between;align-items:center;opacity:0.6;';
                el.innerHTML = `
                    <div>
                        <div style="font-weight:bold;font-size:14px;color:#64748b;">${room.emoji} ${room.name}</div>
                        <div style="font-size:12px;color:#94a3b8;margin-top:2px;">${room.description}</div>
                    </div>
                    <span style="font-size:12px;color:#94a3b8;">🔒</span>
                `;
            } else {
                el.style.cssText = `padding:12px;margin:8px 0;border:2px solid ${room.color};border-radius:8px;background:linear-gradient(135deg,#f0fdf4 0%,#dcfce7 100%);display:flex;justify-content:space-between;align-items:center;cursor:pointer;transition:all 0.2s;`;
                el.onmouseover = function() { this.style.transform = 'scale(1.02)'; };
                el.onmouseout  = function() { this.style.transform = 'scale(1)'; };
                el.onclick = () => this.enterBotRoom(room);
                el.innerHTML = `
                    <div>
                        <div style="font-weight:bold;font-size:14px;color:${room.color};">${room.emoji} ${room.name}</div>
                        <div style="font-size:12px;color:#555;margin-top:2px;">${room.description}</div>
                    </div>
                    <button style="padding:6px 14px;background:${room.color};color:white;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">Thách đấu</button>
                `;
            }
            container.appendChild(el);
        });
    },

    // ══ Vào màn hình chờ phòng ═══════════════════════════════════
    enterBotRoom: function(botConfig) {
        // YC.TXT FIX: Cleanup previous mode before entering BOT
        this.cleanupPreviousMode();

        this.currentBotRoom = botConfig;
        this.isBotRoomMode  = true;

        // YC.TXT FIX: DISABLED - Do NOT save BOT mode to GameModeManager
        // BOT mode restore is disabled to prevent "Phòng Ma" and mode conflicts
        // if (typeof GameModeManager !== 'undefined') {
        //     GameModeManager.setMode(GameModes.BOT_ROOM, { botConfig: botConfig });
        // }

        // Chuyển view-room, dùng classList trực tiếp (không qua switchView
        // để tránh các hook online như moveBoardToBattle chạy sớm)
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        const vr = document.getElementById('view-room');
        if (vr) vr.classList.add('active');

        this.renderBotRoomView(botConfig);
    },

    // ══ Màn hình phòng: hiện cài đặt, người dùng tự bấm Bắt Đầu ═
    renderBotRoomView: function(botConfig) {
        const roomLayout = document.querySelector('.room-layout');
        if (!roomLayout) return;

        const username = localStorage.getItem('current_username') || 'Bạn';

        roomLayout.innerHTML = `
            <div class="room-header-card" style="background:linear-gradient(135deg,#10b981 0%,#059669 100%);">
                <div class="room-header-title">🤖 Phòng ${botConfig.name}</div>
                <button class="btn-leave-room" onclick="BotRoomManager.exitBotRoom()">← Quay lại</button>
            </div>

            <div class="versus-row">
                <div class="player-slot-card">
                    <div class="avatar-circle-lg player-x">X</div>
                    <div class="player-name">${username}</div>
                    <div class="pc-info"><span class="badge badge-green">Người chơi</span></div>
                </div>
                <div class="vs-badge">VS</div>
                <div class="player-slot-card">
                    <div class="avatar-circle-lg player-o"
                         style="background:#fef3c7;border-color:#f59e0b;color:#d97706;font-size:26px;">🤖</div>
                    <div class="player-name">${botConfig.name}</div>
                    <div class="pc-info">
                        <span class="badge" style="background:#ef4444;color:white;">BOT AI</span>
                    </div>
                </div>
            </div>

            <!-- Cài đặt luật — người dùng tự chọn -->
            <div class="card" style="background:#f0fdf4;border:1px solid #10b981;">
                <div class="card-body" style="padding:16px;">
                    <div style="font-weight:700;color:#065f46;margin-bottom:12px;">⚙️ Cài đặt ván đấu</div>
                    <div style="display:flex;flex-wrap:wrap;gap:16px;align-items:center;">

                        <label style="display:flex;align-items:center;gap:8px;font-size:14px;">
                            🎯 Số quân thắng:
                            <select id="bot-room-win-count"
                                    style="padding:4px 8px;border-radius:6px;border:1px solid #a7f3d0;background:#fff;font-size:14px;">
                                <option value="3">3 quân</option>
                                <option value="4">4 quân</option>
                                <option value="5" selected>5 quân</option>
                                <option value="6">6 quân</option>
                                <option value="7">7 quân</option>
                            </select>
                        </label>

                        <label style="display:flex;align-items:center;gap:8px;font-size:14px;cursor:pointer;">
                            <input type="checkbox" id="bot-room-block-both" checked
                                   style="width:16px;height:16px;accent-color:#10b981;">
                            🛡️ Chặn 2 đầu
                        </label>

                        <label style="display:flex;align-items:center;gap:8px;font-size:14px;">
                            ⚡ Đi trước:
                            <select id="bot-room-first-move"
                                    style="padding:4px 8px;border-radius:6px;border:1px solid #a7f3d0;background:#fff;font-size:14px;">
                                <option value="X" selected>Bạn (X)</option>
                                <option value="O">Bot (O)</option>
                            </select>
                        </label>
                    </div>
                    <div style="margin-top:10px;color:#64748b;font-size:12px;">
                        🎮 Chế độ luyện tập · Không cược Xu
                    </div>
                </div>
            </div>

            <!-- Nút Bắt đầu: người dùng tự bấm, KHÔNG tự động đếm ngược -->
            <button id="btn-bot-start"
                    onclick="BotRoomManager.startBotBattle()"
                    style="padding:16px;background:#10b981;color:white;border:none;border-radius:8px;font-size:18px;font-weight:bold;cursor:pointer;width:100%;transition:all 0.2s;"
                    onmouseover="this.style.background='#059669'"
                    onmouseout="this.style.background='#10b981'">
                ⚔️ Bắt Đầu Đấu!
            </button>
        `;
    },

    // ══ Chuyển sang battle view và khởi game ═════════════════════
    startBotBattle: function() {
        if (!this.currentBotRoom) return;

        // Đọc cài đặt người dùng đã chọn
        const wcEl = document.getElementById('bot-room-win-count');
        const bbEl = document.getElementById('bot-room-block-both');
        const fmEl = document.getElementById('bot-room-first-move');
        const wc   = wcEl ? wcEl.value   : '5';
        const bb   = bbEl ? bbEl.checked : true;
        const fm   = fmEl ? fmEl.value   : 'X';

        window.isBotRoomMode    = true;
        window.currentBotConfig = this.currentBotConfig;
        
        // YC.TXT FIX: DISABLED - Do NOT save bot room state to localStorage
        // BOT mode restore is disabled to prevent "Phòng Ma" and mode conflicts
        // localStorage.setItem('bot_room_mode', 'true');
        // localStorage.setItem('bot_room_config', JSON.stringify({
        //     botConfig: this.currentBotRoom,
        //     boardState: typeof infiniteMap !== 'undefined' ? Array.from(infiniteMap.entries()) : null,
        //     moveHistory: typeof moveHistory !== 'undefined' ? moveHistory : [],
        //     currentPlayer: typeof currentPlayer !== 'undefined' ? currentPlayer : 'X',
        //     isGameActive: typeof isGameActive !== 'undefined' ? isGameActive : true,
        //     winCount: typeof winCount !== 'undefined' ? winCount : 5,
        //     lastMoveR: typeof lastMoveR !== 'undefined' ? lastMoveR : null,
        //     lastMoveC: typeof lastMoveC !== 'undefined' ? lastMoveC : null
        // }));

        // Áp cài đặt vào engine
        const modeEl = document.getElementById('game-mode');
        if (modeEl) modeEl.value = this.currentBotRoom.gameMode;

        const winSelect = document.getElementById('win-count');
        if (winSelect) winSelect.value = wc;

        const playerPiece = document.getElementById('player-piece');
        if (playerPiece) playerPiece.value = 'X';   // người luôn X

        const firstMoveEl = document.getElementById('first-move');
        if (firstMoveEl) firstMoveEl.value = fm;

        const blockBothEnds = document.getElementById('block-both-ends');
        if (blockBothEnds) blockBothEnds.checked = bb;

        // BUG.TXT FIX: Create Exit button overlay
        this.createBotExitButton();

        // Cập nhật currentRoomId lên Firebase để người khác biết đang bận (bot room)
        const myId = localStorage.getItem('current_user_id');
        if (myId && typeof db !== 'undefined') {
            db.ref(`users/${myId}/currentRoomId`).set('bot-room');
        }

        // Cần view-training active trước để #inf-resizable có parent hợp lệ
        // khi initGame() tạo canvas — ẩn UI training để không nhấp nháy
        const viewTraining = document.getElementById('view-training');
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        if (viewTraining) {
            viewTraining.classList.add('active');
            const pl = document.querySelector('.practice-layout');
            if (pl) pl.style.visibility = 'hidden';
            const ov = document.getElementById('practice-select-overlay');
            if (ov) ov.style.display = 'none';
        }

        // Khởi tạo game → canvas được tạo trong #inf-resizable
        if (typeof initGame === 'function') initGame();

        // switchView('battle') sẽ gọi moveBoardToBattle() qua hook
        setTimeout(() => {
            // Restore visibility trước khi chuyển view
            const pl = document.querySelector('.practice-layout');
            if (pl) pl.style.visibility = '';
            if (typeof switchView === 'function') switchView('battle');
            // Hide navigation during battle
            if (typeof hideTopNavigation === 'function') {
                hideTopNavigation();
            }
            setTimeout(() => this.renderBotBattlePanel(), 120);
            // Enable mobile full-screen mode if on mobile
            this.enableMobileFullScreenMode();
        }, 60);
    },

    // ══ Panel bên phải trong battle view ════════════════════════
    renderBotBattlePanel: function() {
        const battleRight = document.querySelector('.battle-right');
        if (!battleRight || !this.currentBotRoom) return;

        const username = localStorage.getItem('current_username') || 'Bạn';

        // ── Cập nhật cột trái (Player X) với thông tin người chơi thật ──
        const nameX = document.getElementById('battle-name-x');
        if (nameX) nameX.textContent = username;
        const statsX = document.getElementById('battle-stats-x');
        if (statsX) statsX.textContent = '🎮 Người chơi';
        const indicatorX = document.getElementById('battle-indicator-x');
        if (indicatorX) indicatorX.textContent = 'Lượt của bạn';

        // ── Ẩn các element chỉ dành cho online mode ──
        // shared-board-online đã bị ẩn bởi moveBoardToBattle()
        // Ẩn thêm bet-info và battle-room-info
        const betInfo     = document.getElementById('battle-bet-info');
        if (betInfo)      betInfo.style.display = 'none';
        const roomInfo    = document.querySelector('.battle-room-info-card');
        if (roomInfo)     roomInfo.style.display = 'none';

        // ── Render panel bot thay thế chat + player O card ──
        battleRight.innerHTML = `
            <!-- Player O = Bot -->
            <div class="battle-player-card" style="background:rgba(16,185,129,.08);border-color:rgba(16,185,129,.3);">
                <div class="battle-avatar bo" style="background:rgba(16,185,129,.2);border-color:#10b981;color:#10b981;font-size:22px;">🤖</div>
                <div class="battle-pname">${this.currentBotRoom.name}</div>
                <div class="battle-pstats">🤖 Đối thủ AI</div>
                <div class="battle-indicator inactive" id="battle-indicator-o">Đang chờ</div>
            </div>

            <div class="battle-bot-panel">
                <div class="bot-speech-bubble-panel" id="bot-speech-panel" style="background:rgba(59,130,246,.15);border:1px solid rgba(59,130,246,.3);color:#3b82f6;">
                    💬 "Chào bạn! Sẵn sàng thua chưa?"
                </div>

                <div style="border-top:1px solid rgba(16,185,129,.25);margin:10px 0;"></div>

                <div style="font-size:12px;color:#94a3b8;line-height:1.8;">
                    <strong style="color:#E65100;">Thông tin ván đấu:</strong><br>
                    ${document.getElementById('win-count')?.value || 5} quân ·
                    ${document.getElementById('block-both-ends')?.checked ? 'Chặn 2 đầu' : 'Tự do'}<br>
                    Đi trước: ${document.getElementById('first-move')?.value === 'X' ? 'Bạn (X)' : 'Bot (O)'}
                </div>

                <div style="border-top:1px solid rgba(16,185,129,.25);margin:10px 0;"></div>

                <div style="display:flex;align-items:center;gap:8px;font-size:12px;color:#94a3b8;">
                    <input type="checkbox" id="bot-room-debug-scores" onchange="BotRoomManager.toggleDebugScores()" style="cursor:pointer;">
                    <label for="bot-room-debug-scores" style="cursor:pointer;">Hiện điểm ô (debug)</label>
                </div>

                <div style="border-top:1px solid rgba(16,185,129,.25);margin:10px 0;"></div>

                <div style="display:flex;flex-direction:column;gap:8px;">
                    <button onclick="BotRoomManager.replayBotBattle()"
                            style="padding:9px;background:#10b981;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;font-size:13px;">
                        🔄 Chơi lại
                    </button>
                    <button onclick="BotRoomManager.exitBotRoom()"
                            style="padding:9px;background:rgba(239,68,68,.15);color:#fca5a5;border:1px solid rgba(239,68,68,.3);border-radius:6px;cursor:pointer;font-weight:bold;font-size:13px;">
                        🚪 Thoát phòng
                    </button>
                </div>
            </div>
        `;
    },

    // ══ Toggle debug scores ══════════════════════════════════════════
    toggleDebugScores: function() {
        const checkbox = document.getElementById('bot-room-debug-scores');
        if (!checkbox) return;

        // Sync với checkbox chính của hệ thống
        const mainCheckbox = document.getElementById('show-cell-scores');
        if (mainCheckbox) {
            mainCheckbox.checked = checkbox.checked;
        }

        // Re-render bàn cờ ngay lập tức để áp dụng thay đổi
        if (typeof renderInfiniteBoard === 'function') {
            renderInfiniteBoard();
        }
    },

    // ══ Chơi lại (không qua màn hình phòng) ═════════════════════
    replayBotBattle: function() {
        if (!this.currentBotRoom) return;
        
        // Xóa state restore khi chơi lại để tránh dùng state cũ
        localStorage.removeItem('bot_room_mode');
        localStorage.removeItem('bot_room_config');
        
        if (typeof initGame === 'function') initGame();
        // Cập nhật lại thông tin trên panel
        setTimeout(() => this.renderBotBattlePanel(), 80);
    },

    // ══ Hiện bubble thoại bot ════════════════════════════════════
    showBotSpeech: function(msg) {
        const panel = document.getElementById('bot-speech-panel');
        if (!panel) return;
        panel.innerHTML = `💬 "${msg}"`;
        panel.classList.add('annoying');
        setTimeout(() => panel.classList.remove('annoying'), 3000);
    },

    // ══ Xử lý kết thúc ván ══════════════════════════════════════
    handleGameEnd: function(winner) {
        if (winner === 'X' && typeof window.updateUserStats === 'function') {
            window.updateUserStats('winBot', 1);
        }
        // Cộng Xu khi thắng bot - dùng hệ thống thống nhất từ xu-nhiem-vu.js
        if (winner === 'X' && typeof window.onWinBotXu === 'function') {
            const gameMode = this.currentBotRoom.gameMode;
            window.onWinBotXu(gameMode);
        }
        const panel = document.getElementById('bot-speech-panel');
        if (panel) {
            panel.innerHTML = winner === 'X'
                ? '💬 "Bạn thắng rồi! Đáng nể đấy! Thử ván nữa không?"'
                : '💬 "Tôi đã bảo rồi! Còn lâu mới thắng được tôi! 😈"';
        }
    },

    // ══ Undo move trong phòng bot ═════════════════════════════════
    undoBotRoomMove: function() {
        console.log({
            isBotRoomMode:this.isBotRoomMode,
            currentBotRoom:this.currentBotRoom,
            moveHistory:typeof moveHistory !== 'undefined' ? moveHistory.length : 'undefined'
        });
        if (!this.isBotRoomMode || !this.currentBotRoom) {
            alert('Chỉ có thể undo khi đang trong phòng bot!');
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
        const statusEl = document.getElementById('battle-status');
        if (statusEl) statusEl.textContent = '🟢 Lượt của bạn (X)';

        // Bot sẽ không tự đánh vì currentPlayer đã được set về 'X' (lượt người)
    },

    // ══ Thoát phòng bot ══════════════════════════════════════════
    exitBotRoom: function() {
        this.isBotRoomMode  = false;
        this.currentBotRoom = null;
        window.isBotRoomMode    = false;
        window.currentBotConfig = null;
        
        // YC.TXT FIX: Clear mode from GameModeManager
        if (typeof GameModeManager !== 'undefined') {
            GameModeManager.clearMode();
        }
        
        // YC.TXT FIX: Clear ALL BOT Restore State from localStorage
        localStorage.removeItem('bot_room_mode');
        localStorage.removeItem('bot_room_config');
        localStorage.removeItem('game_mode_current');
        localStorage.removeItem('game_mode_context');
        localStorage.removeItem('current_room_id');
        sessionStorage.removeItem('bot_session');

        // BUG.TXT FIX: Remove Exit button overlay
        this.removeBotExitButton();

        // Disable mobile full-screen mode
        this.disableMobileFullScreenMode();

        // Xóa currentRoomId khỏi Firebase khi thoát bot room
        const myId = localStorage.getItem('current_user_id');
        if (myId && typeof db !== 'undefined') {
            db.ref(`users/${myId}/currentRoomId`).remove();
        }

        // Restore các element đã ẩn khi vào bot room
        const betInfo  = document.getElementById('battle-bet-info');
        if (betInfo)   betInfo.style.display = '';
        const roomInfo = document.querySelector('.battle-room-info-card');
        if (roomInfo)  roomInfo.style.display = '';

        // Restore practice-layout nếu đã ẩn
        const pl = document.querySelector('.practice-layout');
        if (pl) { pl.style.visibility = ''; pl.style.display = ''; }

        // switchView('home') sẽ gọi returnBoardToTraining() và restore shared-board-online
        // Show navigation when exiting battle
        if (typeof showTopNavigation === 'function') {
            showTopNavigation();
        }
        if (typeof switchView === 'function') {
            switchView('home');
        } else {
            document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
            const vh = document.getElementById('view-home');
            if (vh) vh.classList.add('active');
        }

        // Quay về tab bot trong lobby
        if (typeof switchRoomTab === 'function') switchRoomTab('bot');
    },

    // ══ BUG.TXT FIX: Create Exit button overlay for BOT mode ═════════════════════
    createBotExitButton: function() {
        // Remove existing button if any
        this.removeBotExitButton();

        const exitBtn = document.createElement('button');
        exitBtn.id = 'bot-exit-overlay';
        exitBtn.innerHTML = '← Thoát';
        exitBtn.style.cssText = `
            position: fixed;
            top: 16px;
            left: 16px;
            z-index: 99999;
            padding: 10px 16px;
            background: rgba(239, 68, 68, 0.95);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: bold;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            transition: all 0.2s;
        `;
        exitBtn.onmouseover = function() {
            this.style.background = 'rgba(220, 38, 38, 1)';
            this.style.transform = 'scale(1.05)';
        };
        exitBtn.onmouseout = function() {
            this.style.background = 'rgba(239, 68, 68, 0.95)';
            this.style.transform = 'scale(1)';
        };
        exitBtn.onclick = () => this.handleBotExitClick();

        document.body.appendChild(exitBtn);
    },

    // ══ BUG.TXT FIX: Remove Exit button overlay ═════════════════════
    removeBotExitButton: function() {
        const exitBtn = document.getElementById('bot-exit-overlay');
        if (exitBtn) {
            exitBtn.remove();
        }
    },

    // ══ BUG.TXT FIX: Handle Exit button click with confirm dialog ═════════════════════
    handleBotExitClick: function() {
        if (confirm('Bạn có chắc muốn thoát trận BOT?')) {
            // Stop AI
            if (typeof stopAI === 'function') {
                stopAI();
            }

            // Stop Timer
            if (typeof stopTimer === 'function') {
                stopTimer();
            }

            // Cancel Animation
            if (typeof cancelAnimationFrame === 'function') {
                // Cancel any ongoing animation frames
            }

            // Cleanup Event
            // Events are already handled by exitBotRoom

            // Cleanup BOT Session
            // Already handled by exitBotRoom

            // Xóa BOT Restore Context
            localStorage.removeItem('bot_room_mode');
            localStorage.removeItem('bot_room_config');

            // Xóa BOT localStorage/sessionStorage liên quan
            sessionStorage.removeItem('bot_session');

            // YC.TXT FIX: Cleanup BOT mode completely
            this.cleanupBotMode();

            // Quay về Menu BOT
            this.exitBotRoom();
        }
    },

    // ══ YC.TXT FIX: Cleanup previous mode before entering BOT ═════════════════════
    cleanupPreviousMode: function() {
        const currentMode = typeof GameModeManager !== 'undefined' ? GameModeManager.getCurrentMode() : null;
        
        // Cleanup ONLINE mode if active
        if (currentMode === 'online' || (typeof GameModes !== 'undefined' && currentMode === GameModes.ONLINE)) {
            if (typeof thoatGiaoDienOnline === 'function') {
                thoatGiaoDienOnline();
            }
            // Clear Online Firebase listeners
            if (typeof currentRoomId !== 'undefined' && currentRoomId) {
                if (typeof db !== 'undefined') {
                    db.ref(`rooms/${currentRoomId}`).off();
                }
            }
        }
        
        // Cleanup REPLAY mode if active
        if (currentMode === 'replay' || (typeof GameModes !== 'undefined' && currentMode === GameModes.REPLAY)) {
            if (typeof closeHistoryView === 'function') {
                closeHistoryView();
            }
        }
        
        // Cleanup TRAINING mode if active
        if (currentMode === 'training' || (typeof GameModes !== 'undefined' && currentMode === GameModes.TRAINING)) {
            if (typeof PracticeMode !== 'undefined' && typeof PracticeMode.exit === 'function') {
                PracticeMode.exit();
            }
        }
        
        // Cleanup SOLO mode if active
        if (currentMode === 'solo' || (typeof GameModes !== 'undefined' && currentMode === GameModes.SOLO)) {
            // Solo mode cleanup
            if (typeof isGameActive !== 'undefined') {
                isGameActive = false;
            }
        }
    },

    // ══ YC.TXT FIX: Cleanup BOT mode completely ═════════════════════
    cleanupBotMode: function() {
        // Stop AI
        if (typeof stopAI === 'function') {
            stopAI();
        }

        // Stop Timer
        if (typeof stopTimer === 'function') {
            stopTimer();
        }

        // Clear game state
        if (typeof infiniteMap !== 'undefined') {
            infiniteMap.clear();
        }
        if (typeof moveHistory !== 'undefined') {
            moveHistory.length = 0;
        }
        if (typeof isGameActive !== 'undefined') {
            isGameActive = false;
        }

        // Clear Firebase currentRoomId
        const myId = localStorage.getItem('current_user_id');
        if (myId && typeof db !== 'undefined') {
            db.ref(`users/${myId}/currentRoomId`).remove();
        }
    },

    // ══ Enable mobile full-screen mode (YC.TXT) ═══════════════════
    enableMobileFullScreenMode: function() {
        // Only enable on mobile devices
        if (window.innerWidth > 768) return;

        // Add body class for CSS targeting
        document.body.classList.add('bot-room-mobile-mode');

        // Render mobile overlays
        this.renderMobileOverlays();
    },

    // ══ Disable mobile full-screen mode ═══════════════════════════
    disableMobileFullScreenMode: function() {
        // Remove body class
        document.body.classList.remove('bot-room-mobile-mode');

        // Remove mobile overlays
        const overlays = document.querySelectorAll('.mobile-bot-overlay');
        overlays.forEach(el => el.remove());
    },

    // ══ Render mobile overlay UI (YC.TXT) ═════════════════════════
    renderMobileOverlays: function() {
        // Remove existing overlays first
        const existingOverlays = document.querySelectorAll('.mobile-bot-overlay');
        existingOverlays.forEach(el => el.remove());

        const username = localStorage.getItem('current_username') || 'Bạn';

        // Exit button - top left
        const exitBtn = document.createElement('button');
        exitBtn.className = 'mobile-bot-overlay mobile-bot-exit';
        exitBtn.innerHTML = '✕';
        exitBtn.onclick = () => this.exitBotRoom();
        document.body.appendChild(exitBtn);

        // Bot info - top center
        const botInfo = document.createElement('div');
        botInfo.className = 'mobile-bot-overlay mobile-bot-info';
        botInfo.innerHTML = `🤖 ${this.currentBotRoom.name}`;
        document.body.appendChild(botInfo);

        // Player info - bottom left
        const playerInfo = document.createElement('div');
        playerInfo.className = 'mobile-bot-overlay mobile-bot-player-info';
        playerInfo.innerHTML = `👤 ${username}`;
        document.body.appendChild(playerInfo);

        // Action buttons - bottom center
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'mobile-bot-overlay mobile-bot-actions';

        const undoBtn = document.createElement('button');
        undoBtn.className = 'mobile-bot-action-btn undo';
        undoBtn.innerHTML = '↩ Undo';
        undoBtn.onclick = () => this.undoBotRoomMove();
        actionsDiv.appendChild(undoBtn);

        const surrenderBtn = document.createElement('button');
        surrenderBtn.className = 'mobile-bot-action-btn surrender';
        surrenderBtn.innerHTML = '🏳️ Đầu hàng';
        surrenderBtn.onclick = () => {
            if (confirm('Bạn có chắc muốn đầu hàng?')) {
                if (typeof handleGameEnd === 'function') {
                    handleGameEnd('O');
                }
            }
        };
        actionsDiv.appendChild(surrenderBtn);

        document.body.appendChild(actionsDiv);

        // Zoom controls - bottom right
        const zoomDiv = document.createElement('div');
        zoomDiv.className = 'mobile-bot-overlay mobile-bot-zoom';

        const zoomInBtn = document.createElement('button');
        zoomInBtn.className = 'mobile-bot-zoom-btn';
        zoomInBtn.innerHTML = '+';
        zoomInBtn.onclick = () => {
            if (typeof SharedBoardEngine !== 'undefined' && SharedBoardEngine.Camera) {
                SharedBoardEngine.Camera.zoomAt(
                    window.innerWidth / 2,
                    window.innerHeight / 2,
                    0.2,
                    window.innerWidth,
                    window.innerHeight
                );
                SharedBoardEngine.Renderer.render();
            }
        };
        zoomDiv.appendChild(zoomInBtn);

        const zoomOutBtn = document.createElement('button');
        zoomOutBtn.className = 'mobile-bot-zoom-btn';
        zoomOutBtn.innerHTML = '−';
        zoomOutBtn.onclick = () => {
            if (typeof SharedBoardEngine !== 'undefined' && SharedBoardEngine.Camera) {
                SharedBoardEngine.Camera.zoomAt(
                    window.innerWidth / 2,
                    window.innerHeight / 2,
                    -0.2,
                    window.innerWidth,
                    window.innerHeight
                );
                SharedBoardEngine.Renderer.render();
            }
        };
        zoomDiv.appendChild(zoomOutBtn);

        document.body.appendChild(zoomDiv);
    }
};

window.BotRoomManager = BotRoomManager;

// ══ Xử lý reload trang khi đang ở bot room ══════════════════════
// YC.TXT FIX: DISABLED - Do NOT restore BOT mode on page load
// BOT mode restore is disabled to prevent "Phòng Ma" and mode conflicts
// When F5 in BOT mode, always return to Menu BOT instead of restoring the battle
(function() {
    // Always clear any leftover BOT state on page load
    localStorage.removeItem('bot_room_mode');
    localStorage.removeItem('bot_room_config');
    localStorage.removeItem('current_room_id'); // Prevent Online reconnect from leftover state
    
    // Reset BOT flags
    window.isBotRoomMode    = false;
    window.currentBotConfig = null;
})();
