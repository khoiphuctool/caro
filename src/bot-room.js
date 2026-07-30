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
                <button class="btn-leave-room" onclick="BotRoomManager.exitBotRoom()">← Thoát phòng</button>
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

    // ══ Chuyển sang bot room view và khởi game (YC.TXT Board First) ═════════════════════
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

        // YC.TXT: Switch to new view-bot-room instead of battle view
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        const viewBotRoom = document.getElementById('view-bot-room');
        if (viewBotRoom) {
            viewBotRoom.classList.add('active');
        }

        // Hide navigation during battle
        if (typeof hideTopNavigation === 'function') {
            hideTopNavigation();
        }

        // Initialize canvas in the new bot room container
        this.initBotRoomCanvas();

        // YC.TXT FIX: Log infCanvas.id after initBotRoomCanvas
        console.log('[BOT ROOM] enterBotRoom - infCanvas.id:', typeof infCanvas !== 'undefined' && infCanvas ? infCanvas.id : 'null');

        // Initialize GameState before initGame - ensures single source of truth is ready
        if (typeof GameState !== 'undefined' && typeof GameState.initialize === 'function') {
            GameState.initialize();
            console.log('[BOT ROOM] GameState initialized');
        }

        // Khởi tạo game
        if (typeof initGame === 'function') initGame();

        // YC.TXT FIX: Call renderInfiniteBoard() AFTER initGame() to ensure GameState.board.infiniteMap is initialized
        if (typeof renderInfiniteBoard === 'function') {
            renderInfiniteBoard();
        }

        // Update overlay UI
        setTimeout(() => this.updateBotRoomOverlays(), 120);
    },

    // ══ Initialize canvas for BOT ROOM (YC.TXT - SharedBoardUI Migration) ═════════════════════
    initBotRoomCanvas: function() {
        console.log('[BOT ROOM] initBotRoomCanvas - Using SharedBoardUI');

        // Use SharedBoardUI for unified canvas initialization
        if (typeof SharedBoardUI !== 'undefined') {
            const success = SharedBoardUI.init('bot');
            if (!success) {
                console.error('[BOT ROOM] SharedBoardUI.init failed, falling back to old logic');
                this.initBotRoomCanvasFallback();
            }
        } else {
            console.warn('[BOT ROOM] SharedBoardUI not loaded, using fallback logic');
            this.initBotRoomCanvasFallback();
        }

        // YC.TXT FIX: renderInfiniteBoard() will be called AFTER initGame() in startBotBattle()
        // to ensure GameState.board.infiniteMap is properly initialized
    },

    // ══ Fallback canvas initialization (old logic) ═════════════════════
    initBotRoomCanvasFallback: function() {
        // YC.TXT FIX: Use the existing inf-canvas-bot canvas in HTML instead of moving canvas
        const canvas = document.getElementById('inf-canvas-bot');
        const botContainer = document.getElementById('shared-board-bot');

        console.log('[BOT ROOM] initBotRoomCanvasFallback - canvas element:', {
            canvasId: canvas ? canvas.id : 'null',
            canvasWidth: canvas ? canvas.width : 'null',
            canvasHeight: canvas ? canvas.height : 'null',
            botContainerId: botContainer ? botContainer.id : 'null'
        });

        if (canvas && botContainer) {
            // YC.TXT FIX: Use container dimensions instead of window dimensions
            // Container dimensions reflect the actual available space
            const containerRect = botContainer.getBoundingClientRect();
            const containerWidth = containerRect.width || window.innerWidth;
            const containerHeight = containerRect.height || window.innerHeight;

            // Set canvas internal dimensions to match container
            canvas.width = containerWidth;
            canvas.height = containerHeight;
            canvas.style.width = '100%';
            canvas.style.height = '100%';

            console.log('[BOT ROOM] initBotRoomCanvasFallback dimensions:', {
                containerWidth: containerRect.width,
                containerHeight: containerRect.height,
                canvasWidth: canvas.width,
                canvasHeight: canvas.height
            });
        }

        // Update infCanvasW/infCanvasH BEFORE calling initInfCanvas
        if (typeof infCanvasW !== 'undefined' && typeof infCanvasH !== 'undefined') {
            infCanvasW = canvas.width;
            infCanvasH = canvas.height;
        }

        // YC.TXT: Ensure constant CELL_SIZE (32px) - don't resize cells
        if (typeof INF_CS !== 'undefined') {
            INF_CS = 32; // Bot room uses constant 32px
        }

        // BUG.TXT FIX: Reset viewport offset to center (0,0) at middle of screen
        if (typeof vRowF !== 'undefined' && typeof vColF !== 'undefined' &&
            typeof infCanvasW !== 'undefined' && typeof infCanvasH !== 'undefined') {
            vRowF = -Math.floor(infCanvasH / INF_CS / 2);
            vColF = -Math.floor(infCanvasW / INF_CS / 2);
        }

        // Initialize canvas with fullscreen size - pass canvas element to avoid hardcode
        if (typeof initInfCanvas === 'function') {
            initInfCanvas(canvas);
        }

        // Initialize camera to center of viewport
        if (typeof camera !== 'undefined') {
            camera.x = canvas.width / 2;
            camera.y = canvas.height / 2;
        }

        // Add resize listener for bot room
        this.addBotRoomResizeListener();
    },

    // ══ Add resize listener for BOT ROOM ═════════════════════
    addBotRoomResizeListener: function() {
        // Remove existing listener if any
        if (this.botRoomResizeHandler) {
            window.removeEventListener('resize', this.botRoomResizeHandler);
        }

        let resizeTimeout = null;
        this.botRoomResizeHandler = () => {
            if (!this.isBotRoomMode) return;

            // Debounce resize to avoid jitter
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                // YC.TXT FIX: Use inf-canvas-bot instead of inf-canvas for Bot Room mode
                const canvas = document.getElementById('inf-canvas-bot');
                const botContainer = document.getElementById('shared-board-bot');
                
                if (canvas && botContainer) {
                    // Use container dimensions instead of window dimensions
                    const containerRect = botContainer.getBoundingClientRect();
                    const containerWidth = containerRect.width || window.innerWidth;
                    const containerHeight = containerRect.height || window.innerHeight;

                    canvas.width = containerWidth;
                    canvas.height = containerHeight;
                    canvas.style.width = containerWidth + 'px';
                    canvas.style.height = containerHeight + 'px';

                    // Update infCanvasW/infCanvasH for renderer
                    if (typeof infCanvasW !== 'undefined' && typeof infCanvasH !== 'undefined') {
                        infCanvasW = canvas.width;
                        infCanvasH = canvas.height;
                    }

                    // Re-render board
                    if (typeof renderInfiniteBoard === 'function') {
                        renderInfiniteBoard();
                    }
                }
            }, 100);
        };

        window.addEventListener('resize', this.botRoomResizeHandler);
    },

    // ══ Remove resize listener when exiting BOT ROOM ═════════════════════
    removeBotRoomResizeListener: function() {
        if (this.botRoomResizeHandler) {
            window.removeEventListener('resize', this.botRoomResizeHandler);
            this.botRoomResizeHandler = null;
        }
    },

    // ══ Update BOT ROOM overlay UI (YC.TXT) ═════════════════════
    updateBotRoomOverlays: function() {
        const username = localStorage.getItem('current_username') || 'Bạn';

        // Update player info
        const playerName = document.getElementById('bot-player-name');
        if (playerName) playerName.textContent = username;

        // Update bot info
        const botName = document.getElementById('bot-bot-name');
        if (botName) botName.textContent = this.currentBotRoom.name;

        const botDifficulty = document.getElementById('bot-difficulty');
        if (botDifficulty) botDifficulty.textContent = this.currentBotRoom.description;

        // Update player stats (mock data for now)
        const playerLevel = document.getElementById('bot-player-level');
        if (playerLevel) playerLevel.textContent = '25';

        const playerElo = document.getElementById('bot-player-elo');
        if (playerElo) playerElo.textContent = '1500';

        const playerWins = document.getElementById('bot-player-wins');
        if (playerWins) playerWins.textContent = '0';

        const playerXu = document.getElementById('bot-player-xu');
        if (playerXu) playerXu.textContent = '25000';

        // Update bot stats
        const botElo = document.getElementById('bot-elo');
        if (botElo) botElo.textContent = '1800';

        const botWinrate = document.getElementById('bot-winrate');
        if (botWinrate) botWinrate.textContent = '65%';

        // Update turn indicators
        const playerIndicator = document.getElementById('bot-player-indicator');
        const botIndicator = document.getElementById('bot-bot-indicator');
        
        if (playerIndicator) playerIndicator.textContent = 'Lượt của bạn';
        if (botIndicator) botIndicator.textContent = 'Đang chờ';
    },


    // ══ Chơi lại (YC.TXT - Updated for new view) ═════════════════════
    replayBotBattle: function() {
        if (!this.currentBotRoom) return;

        // Xóa state restore khi chơi lại để tránh dùng state cũ
        localStorage.removeItem('bot_room_mode');
        localStorage.removeItem('bot_room_config');

        // Re-initialize game
        if (typeof initGame === 'function') initGame();

        // Update overlay UI
        setTimeout(() => this.updateBotRoomOverlays(), 80);

        // Show bot speech
        this.showBotSpeech('Ván mới bắt đầu! Đấu tiếp nhé!');
    },

    // ══ Hiện bubble thoại bot (YC.TXT - Updated for new overlay) ═════════════════════
    showBotSpeech: function(msg) {
        const chatBubble = document.getElementById('bot-chat-message');
        if (!chatBubble) return;
        chatBubble.textContent = `💬 "${msg}"`;
        
        // Add animation
        const overlay = document.getElementById('bot-chat-bubble');
        if (overlay) {
            overlay.style.animation = 'none';
            overlay.offsetHeight; // Trigger reflow
            overlay.style.animation = 'botChatBubble 0.3s ease-out';
        }
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            if (overlay) {
                overlay.style.animation = 'botChatBubbleFade 0.3s ease-out forwards';
            }
        }, 5000);
    },

    // ══ Xử lý kết thúc ván (YC.TXT - Updated for new popup) ═════════════════════
    handleGameEnd: function(winner) {
        if (winner === 'X' && typeof window.updateUserStats === 'function') {
            window.updateUserStats('winBot', 1);
        }
        // Cộng Xu khi thắng bot - dùng hệ thống thống nhất từ xu-nhiem-vu.js
        if (winner === 'X' && typeof window.onWinBotXu === 'function') {
            const gameMode = this.currentBotRoom.gameMode;
            window.onWinBotXu(gameMode);
        }

        if (winner === 'X') {
            if (typeof showWinOverlay === 'function') {
                showWinOverlay('X', false, '', '🏆');
            }
            this.showBotSpeech('Bạn thắng rồi! Đáng nể đấy! Thử ván nữa không?');
        } else if (winner === 'O') {
            if (typeof showWinOverlay === 'function') {
                showWinOverlay('O', true, '', '💀');
            }
            this.showBotSpeech('Tôi đã bảo rồi! Còn lâu mới thắng được tôi! 😈');
        } else {
            if (typeof showWinOverlay === 'function') {
                showWinOverlay('draw', false, 'Trận đấu hòa! Lần sau sẽ thắng được đâu!', '🤝');
            }
            this.showBotSpeech('Hòa! Lần sau sẽ thắng được đâu!');
        }
    },

    // ══ Undo move trong phòng bot ═════════════════════════════════
    undoBotRoomMove: function() {
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

        // Bot sẽ không tự đánh vì currentPlayer đã được set về 'X' (lượt người)
    },

    // ══ Đầu hàng trong BOT ROOM (YC.TXT) ═════════════════════════════════
    surrenderBotGame: function() {
        if (!this.isBotRoomMode || !this.currentBotRoom) {
            alert('Chỉ có thể đầu hàng khi đang trong phòng bot!');
            return;
        }

        if (confirm('Bạn có chắc muốn đầu hàng? Bot sẽ thắng.')) {
            // Stop AI
            if (typeof stopAI === 'function') {
                stopAI();
            }

            // End game state
            if (typeof isGameActive !== 'undefined') {
                isGameActive = false;
            }

            // Show shared win overlay for bot victory
            if (typeof showWinOverlay === 'function') {
                showWinOverlay('O', true, 'Bạn đã đầu hàng. Bot thắng ván này!', '😈');
            }

            // Update bot chat
            this.showBotSpeech('Bạn đã đầu hàng! Tôi thắng rồi! 😈');
        }
    },

    // ══ Thoát phòng bot (YC.TXT - Updated for new view) ═════════════════════
    exitBotRoom: function() {
        console.log('[BotRoom] Exit Start - Full cleanup');
        
        this.isBotRoomMode  = false;
        this.currentBotRoom = null;
        window.isBotRoomMode    = false;
        window.currentBotConfig = null;

        // YC.TXT FIX: Destroy SharedBoardUI FIRST (same as Online Room)
        if (typeof SharedBoardUI !== 'undefined') {
            console.log('[BotRoom] Destroying SharedBoardUI');
            SharedBoardUI.destroy();
        }

        // Remove resize listener (fallback cleanup)
        this.removeBotRoomResizeListener();

        // YC.TXT FIX: Clear mode from GameModeManager (same as Online Room)
        if (typeof GameModeManager !== 'undefined') {
            console.log('[BotRoom] Clearing GameModeManager');
            GameModeManager.clearMode();
        }

        // YC.TXT FIX: Clear ALL BOT Restore State from localStorage
        localStorage.removeItem('bot_room_mode');
        localStorage.removeItem('bot_room_config');
        localStorage.removeItem('game_mode_current');
        localStorage.removeItem('game_mode_context');
        localStorage.removeItem('current_room_id');
        sessionStorage.removeItem('bot_session');

        // Xóa currentRoomId khỏi Firebase khi thoát bot room
        const myId = localStorage.getItem('current_user_id');
        if (myId && typeof db !== 'undefined') {
            console.log('[BotRoom] Removing user currentRoomId from Firebase');
            db.ref(`users/${myId}/currentRoomId`).remove();
        }

        // Restore canvas to original location
        this.restoreCanvas();

        // Restore các element đã ẩn khi vào bot room
        const betInfo  = document.getElementById('battle-bet-info');
        if (betInfo)   betInfo.style.display = '';
        const roomInfo = document.querySelector('.battle-room-info-card');
        if (roomInfo)  roomInfo.style.display = '';

        // Restore practice-layout nếu đã ẩn
        const pl = document.querySelector('.practice-layout');
        if (pl) { pl.style.visibility = ''; pl.style.display = ''; }

        // YC.TXT FIX: Show navigation when exiting battle (same as Online Room)
        if (typeof showTopNavigation === 'function') {
            console.log('[BotRoom] Showing top navigation');
            showTopNavigation();
        }

        // YC.TXT FIX: Reset game state (same as Online Room)
        if (typeof isGameActive !== 'undefined') {
            isGameActive = false;
        }
        if (typeof infiniteMap !== 'undefined') {
            infiniteMap.clear();
        }
        if (typeof moveHistory !== 'undefined') {
            moveHistory.length = 0;
        }

        // switchView('home') sẽ gọi returnBoardToTraining() và restore shared-board-online
        if (typeof switchView === 'function') {
            console.log('[BotRoom] Switching to home view');
            switchView('home');
        } else {
            document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
            const vh = document.getElementById('view-home');
            if (vh) vh.classList.add('active');
        }

        // YC.TXT FIX: KHÔNG tự động quay lại tab Bot sau khi thoát
        // Để user tự chọn tab (Bot/Normal/VIP) sau khi thoát
        // if (typeof switchRoomTab === 'function') switchRoomTab('bot');
        
        console.log('[BotRoom] Exit Complete - Full cleanup done');
    },

    // ══ Restore canvas to original location (YC.TXT) ═════════════════════
    restoreCanvas: function() {
        // Move canvas back to original container WITHOUT changing id
        const botCanvas = document.getElementById('inf-canvas');
        const originalContainer = document.getElementById('inf-resizable');

        if (botCanvas && originalContainer) {
            // YC.TXT FIX: Don't change canvas id - just move it back
            // botCanvas.id = 'inf-canvas'; // REMOVED - don't change id
            originalContainer.appendChild(botCanvas);

            // Reset canvas size
            botCanvas.style.width = '';
            botCanvas.style.height = '';
        }
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
