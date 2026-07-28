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
        this.currentBotRoom = botConfig;
        this.isBotRoomMode  = true;

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
        window.currentBotConfig = this.currentBotRoom;

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
            setTimeout(() => this.renderBotBattlePanel(), 120);
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
                <div class="bot-speech-bubble-panel" id="bot-speech-panel">
                    💬 "Chào bạn! Sẵn sàng thua chưa?"
                </div>

                <div style="border-top:1px solid rgba(16,185,129,.25);margin:10px 0;"></div>

                <div style="font-size:12px;color:#94a3b8;line-height:1.8;">
                    <strong style="color:#e2e8f0;">Thông tin ván đấu:</strong><br>
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

    // ══ Thoát phòng bot ══════════════════════════════════════════
    exitBotRoom: function() {
        this.isBotRoomMode  = false;
        this.currentBotRoom = null;
        window.isBotRoomMode    = false;
        window.currentBotConfig = null;

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
        if (typeof switchView === 'function') {
            switchView('home');
        } else {
            document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
            const vh = document.getElementById('view-home');
            if (vh) vh.classList.add('active');
        }

        // Quay về tab bot trong lobby
        if (typeof switchRoomTab === 'function') switchRoomTab('bot');
    }
};

window.BotRoomManager = BotRoomManager;

// ══ Xử lý reload trang khi đang ở bot room ══════════════════════
// Bot room là offline, không lưu state → khi reload chỉ cần về home.
// Ngăn firebase-online.js đọc current_room_id nhầm.
(function() {
    // Xóa flag bot room khi trang load (reload đã mất state JS)
    window.isBotRoomMode    = false;
    window.currentBotConfig = null;
    // KHÔNG lưu bot room id vào localStorage để tránh nhầm với online room
})();
