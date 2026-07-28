// ══════════════════════════════════════════════════════════════════
// BOT ROOM MANAGER - Quản lý phòng Bot Offline
// ══════════════════════════════════════════════════════════════════

const BotRoomManager = {
    // Cấu hình 9 phòng bot
    BOT_ROOMS: [
        { id: 1, name: 'Bot Dễ', emoji: '🟢', color: '#10b981', gameMode: 'ai-easy', description: 'Dành cho người mới' },
        { id: 2, name: 'Bot Trung Bình', emoji: '🟡', color: '#f59e0b', gameMode: 'ai-medium', description: 'Luyện phản xạ' },
        { id: 3, name: 'Bot Khó', emoji: '🟠', color: '#f97316', gameMode: 'ai-hard', description: 'Thử thách thật sự' },
        { id: 4, name: 'Bot Tối Thượng', emoji: '💀', color: '#ef4444', gameMode: 'bot-toi-thuong', description: 'Cấp cao nhất' },
        { id: 5, name: 'Bot Tia Chớp', emoji: '⚡', color: '#3b82f6', gameMode: 'bot-tia-chop', description: 'Tốc độ 2000x' },
        { id: 6, name: 'Sắp ra mắt', emoji: '🔒', color: '#94a3b8', gameMode: null, description: 'Mở khóa theo nhiệm vụ' },
        { id: 7, name: 'Sắp ra mắt', emoji: '🔒', color: '#94a3b8', gameMode: null, description: 'Mở khóa theo nhiệm vụ' },
        { id: 8, name: 'Sắp ra mắt', emoji: '🔒', color: '#94a3b8', gameMode: null, description: 'Mở khóa theo nhiệm vụ' },
        { id: 9, name: 'Sắp ra mắt', emoji: '🔒', color: '#94a3b8', gameMode: null, description: 'Mở khóa theo nhiệm vụ' }
    ],

    currentBotRoom: null,
    isBotRoomMode: false,

    // Hiện tab phòng bot trong lobby
    openBotLobby: function() {
        console.log('[BotRoomManager] Opening bot lobby');
        const container = document.getElementById('room-list');
        if (!container) return;

        container.innerHTML = '';
        
        this.BOT_ROOMS.forEach((room, index) => {
            const el = document.createElement('div');
            const isLocked = !room.gameMode;
            
            if (isLocked) {
                el.style.cssText = 'padding:12px;margin:8px 0;border:1px dashed #cbd5e1;border-radius:8px;background:#f8fafc;display:flex;justify-content:space-between;align-items:center;opacity:0.6;';
                el.innerHTML = `
                    <div>
                        <div style="font-weight:bold;font-size:14px;color:#64748b;">${room.emoji} ${room.name}</div>
                        <div style="font-size:12px;color:#94a3b8;margin-top:2px;">${room.description}</div>
                    </div>
                    <span style="font-size:12px;color:#94a3b8;">🔒</span>
                `;
            } else {
                el.style.cssText = 'padding:12px;margin:8px 0;border:2px solid ' + room.color + ';border-radius:8px;background:linear-gradient(135deg,#f0fdf4 0%,#dcfce7 100%);display:flex;justify-content:space-between;align-items:center;cursor:pointer;transition:all 0.2s;';
                el.onmouseover = function() { this.style.transform = 'scale(1.02)'; };
                el.onmouseout = function() { this.style.transform = 'scale(1)'; };
                el.onclick = () => this.enterBotRoom(room);
                
                el.innerHTML = `
                    <div>
                        <div style="font-weight:bold;font-size:14px;color:' + room.color + ';">${room.emoji} ${room.name}</div>
                        <div style="font-size:12px;color:#555;margin-top:2px;">${room.description}</div>
                    </div>
                    <button style="padding:6px 14px;background:' + room.color + ';color:white;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">Thách đấu</button>
                `;
            }
            
            container.appendChild(el);
        });
    },

    // Vào màn hình room giả lập
    enterBotRoom: function(botConfig) {
        console.log('[BotRoomManager] Entering bot room:', botConfig);
        this.currentBotRoom = botConfig;
        this.isBotRoomMode = true;

        // Chuyển sang view-room
        const viewRoom = document.getElementById('view-room');
        const viewHome = document.getElementById('view-home');
        const viewBattle = document.getElementById('view-battle');
        
        if (viewHome) viewHome.classList.remove('active');
        if (viewBattle) viewBattle.classList.remove('active');
        if (viewRoom) viewRoom.classList.add('active');

        // Render bot room interface
        this.renderBotRoomView(botConfig);
    },

    // Render màn hình phòng bot
    renderBotRoomView: function(botConfig) {
        const roomLayout = document.querySelector('.room-layout');
        if (!roomLayout) return;

        const username = localStorage.getItem('current_username') || 'Bạn';

        roomLayout.innerHTML = `
            <div class="room-header-card" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
                <div class="room-header-title">🤖 Phòng ${botConfig.name}</div>
                <button class="btn-leave-room" onclick="BotRoomManager.exitBotRoom()">← Quay lại</button>
            </div>

            <div class="versus-row">
                <div class="player-slot-card">
                    <div class="avatar-circle-lg player-x">X</div>
                    <div class="player-name">${username}</div>
                    <div class="pc-info">
                        <span class="badge badge-green">Người chơi</span>
                    </div>
                </div>

                <div class="vs-badge">VS</div>

                <div class="player-slot-card">
                    <div class="avatar-circle-lg player-o" style="background:#fef3c7;border-color:#f59e0b;color:#f59e0b;">🤖</div>
                    <div class="player-name">${botConfig.name}</div>
                    <div class="pc-info">
                        <span class="badge" style="background:#ef4444;color:white;">BOT</span>
                    </div>
                </div>
            </div>

            <div class="card" style="background:#f0fdf4;border:1px solid #10b981;">
                <div class="card-body" style="padding:16px;">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
                        <span style="font-size:18px;">⚙️</span>
                        <span style="font-weight:bold;">Cài đặt:</span>
                        <span>5 quân · Chặn 2 đầu ✓</span>
                    </div>
                    <div style="color:#64748b;font-size:13px;">Chế độ luyện tập · Không cược Xu</div>
                </div>
            </div>

            <button id="btn-bot-ready" onclick="BotRoomManager.startBotBattle()" 
                    style="padding:16px;background:#10b981;color:white;border:none;border-radius:8px;font-size:18px;font-weight:bold;cursor:pointer;transition:all 0.2s;"
                    onmouseover="this.style.background='#059669'" onmouseout="this.style.background='#10b981'">
                🎮 Sẵn Sàng Chiến
            </button>
        `;

        // Bot tự động ready sau 1.5s
        setTimeout(() => {
            const btn = document.getElementById('btn-bot-ready');
            if (btn) {
                btn.innerHTML = '🤖 Bot đã sẵn sàng! Đang đếm ngược...';
                btn.style.background = '#059669';
                
                // Đếm ngược 3-2-1
                let count = 3;
                const countdown = setInterval(() => {
                    if (count > 0) {
                        btn.innerHTML = `⏱️ ${count}...`;
                        count--;
                    } else {
                        clearInterval(countdown);
                        this.startBotBattle();
                    }
                }, 1000);
            }
        }, 1500);
    },

    // Chuyển sang battle view
    startBotBattle: function() {
        console.log('[BotRoomManager] Starting bot battle');
        
        // Set global flags
        window.isBotRoomMode = true;
        window.currentBotConfig = this.currentBotRoom;

        // Chuyển sang view-battle
        const viewRoom = document.getElementById('view-room');
        const viewBattle = document.getElementById('view-battle');
        
        if (viewRoom) viewRoom.classList.remove('active');
        if (viewBattle) viewBattle.classList.add('active');

        // Render bot panel in battle view
        this.renderBotBattlePanel();

        // Khởi động game với config bot
        if (typeof initGame === 'function') {
            // Set game mode
            const modeSelect = document.getElementById('mode-select');
            if (modeSelect) modeSelect.value = this.currentBotRoom.gameMode;
            
            // Set win count to 5
            const winSelect = document.getElementById('win-count');
            if (winSelect) winSelect.value = '5';

            // Set player piece to X
            const playerPiece = document.getElementById('player-piece');
            if (playerPiece) playerPiece.value = 'X';

            // Set first move to X
            const firstMove = document.getElementById('first-move');
            if (firstMove) firstMove.value = 'X';

            // Enable block both ends
            const blockBothEnds = document.getElementById('block-both-ends');
            if (blockBothEnds) blockBothEnds.checked = true;

            // Start game
            initGame();
        }
    },

    // Render panel bot trong battle view
    renderBotBattlePanel: function() {
        const battleRight = document.querySelector('.battle-right');
        if (!battleRight) return;

        const username = localStorage.getItem('current_username') || 'Bạn';

        // Thay thế chat bằng bot panel
        battleRight.innerHTML = `
            <div class="battle-bot-panel">
                <div class="bot-avatar-large">🤖</div>
                <div style="text-align:center;font-weight:bold;font-size:16px;margin-bottom:8px;color:#10b981;">
                    ${this.currentBotRoom.name}
                </div>
                <div style="border-top:1px solid rgba(16,185,129,.25);margin:8px 0;"></div>
                
                <div class="bot-speech-bubble-panel" id="bot-speech-panel">
                    💬 "Chào bạn! Sẵn sàng thua chưa?"
                </div>
                
                <div style="border-top:1px solid rgba(16,185,129,.25);margin:12px 0;"></div>
                
                <div style="font-size:12px;color:#64748b;">
                    <div style="margin-bottom:4px;"><strong>Thông tin phòng:</strong></div>
                    <div>5 quân · Chặn 2 đầu</div>
                    <div>Ván: 1 · Thắng: 0</div>
                </div>
            </div>
        `;
    },

    // Hiện bubble thoại trong panel bot
    showBotSpeech: function(msg) {
        const panel = document.getElementById('bot-speech-panel');
        if (panel) {
            panel.innerHTML = `💬 "${msg}"`;
            panel.classList.add('annoying');
            setTimeout(() => panel.classList.remove('annoying'), 3000);
        }
    },

    // Thoát phòng bot
    exitBotRoom: function() {
        console.log('[BotRoomManager] Exiting bot room');
        this.isBotRoomMode = false;
        this.currentBotRoom = null;
        window.isBotRoomMode = false;
        window.currentBotConfig = null;

        // Quay về lobby
        const viewRoom = document.getElementById('view-room');
        const viewHome = document.getElementById('view-home');
        const viewBattle = document.getElementById('view-battle');
        
        if (viewRoom) viewRoom.classList.remove('active');
        if (viewBattle) viewBattle.classList.remove('active');
        if (viewHome) viewHome.classList.add('active');

        // Reset về tab bot
        switchRoomTab('bot');
    }
};

// Export to global scope
window.BotRoomManager = BotRoomManager;
