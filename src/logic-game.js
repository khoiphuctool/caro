// ===== LOGIC GAME - initGame, makeMove, checkWin, timer =====
// boardElement, statusPanel, modeSelect được khai báo trong index.html sau khi DOM sẵn sàng

// Helper: kiểm tra có phải chế độ đấu bot không (bao gồm cả bot-toi-thuong, bot-tia-chop)
function isBotMode(mode) {
    const m = mode || gameMode;
    return m.startsWith('ai') || m === 'bot-toi-thuong' || m === 'bot-tia-chop' || m === 'bot-super';
}

// ===== TIMER =====
function updateTimerDisplay() {
    const gameTimerEl = document.getElementById('game-timer');
    const turnTimerEl = document.getElementById('turn-timer');
    if (gameTimerEl) {
        const mins = Math.floor(gameTotalSeconds / 60);
        const secs = gameTotalSeconds % 60;
        gameTimerEl.textContent = `${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`;
    }
    if (turnTimerEl) {
        const mins = Math.floor(playerTurnSeconds / 60);
        const secs = playerTurnSeconds % 60;
        turnTimerEl.textContent = `${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`;
    }
}

function startPlayerTurnTimer() {
    playerTurnSeconds = 0;
    if (playerTurnTimer) clearInterval(playerTurnTimer);
    updateTimerDisplay();

    playerTurnTimer = setInterval(() => {
        playerTurnSeconds++;
        updateTimerDisplay();

        if (playerTurnSeconds === 10 && isBotMode() && currentPlayer === humanPiece) {
            const messages = [
                'Lâu thế, tôi còn phải đi đái! 🚽',
                'Nhanh lên! Bắp rang của tôi nguội mất rồi 🍿',
                'Ơ kìa, ngủ quên à? 😴',
                'Tôi đang chờ đấy... thở dài nghe không? 😮‍💨',
                'Bấm đi! Bàn cờ không tự di chuyển đâu nhé 🎯',
                'Còn đây không? Hay đã bỏ trốn rồi? 👀',
                'Suy nghĩ hay đang gọi viện binh vậy? 📞',
            ];
            // CHẶN LỜI THOẠI: Nếu chơi Online thì không cho xuất chữ ra khung chat nữa
            if (window.isOnlineModeActive && window.isOnlineModeActive()) {
                return;
            }

            const randomMsg = messages[Math.floor(Math.random() * messages.length)];
            
            // Nếu ở chế độ bot room, hiển thị trong panel bot
            if (window.isBotRoomMode && typeof BotRoomManager !== 'undefined' && BotRoomManager.showBotSpeech) {
                BotRoomManager.showBotSpeech(randomMsg);
            } else {
                // Hiển thị trong bot-bubble cũ (training mode)
                const botMessage = document.getElementById('bot-message');
                const botBubble  = document.getElementById('bot-bubble');
                if (botMessage && botBubble) {
                    botMessage.textContent = randomMsg;
                    botBubble.classList.add('annoying');
                    setTimeout(() => botBubble.classList.remove('annoying'), 3000);
                }
            }
        }
        if (playerTurnSeconds === 15 && isBotMode() && currentPlayer === humanPiece) {
            const messages = [
                'Trời ơi 15 giây rồi! Tôi chờ mà sắp tè ra quần rồi 😤',
                'Chậm như rùa! Rùa còn đang cười bạn kìa 🐢😂',
                'OK tôi đi pha cà phê đây, xong về còn chưa đi thì thôi ☕',
                '15 giây... Tôi đã nghĩ xong 5 nước tiếp theo rồi đấy 😏',
                'Bạn đang thiền à? Thiền bàn cờ kiểu mới? 🧘',
                'Nước cờ không phải rượu, ngâm lâu không ngon hơn đâu! 🍷',
            ];
            // CHẶN LỜI THOẠI: Nếu chơi Online thì không cho xuất chữ ra khung chat nữa
            if (window.isOnlineModeActive && window.isOnlineModeActive()) {
                return;
            }

            const randomMsg = messages[Math.floor(Math.random() * messages.length)];
            
            // Nếu ở chế độ bot room, hiển thị trong panel bot
            if (window.isBotRoomMode && typeof BotRoomManager !== 'undefined' && BotRoomManager.showBotSpeech) {
                BotRoomManager.showBotSpeech(randomMsg);
            } else {
                // Hiển thị trong bot-bubble cũ (training mode)
                const botMessage = document.getElementById('bot-message');
                const botBubble  = document.getElementById('bot-bubble');
                if (botMessage && botBubble) {
                    botMessage.textContent = randomMsg;
                    botBubble.classList.add('annoying');
                    setTimeout(() => botBubble.classList.remove('annoying'), 4000);
                }
            }
        }
        if (playerTurnSeconds === 25 && isBotMode() && currentPlayer === humanPiece) {
            const messages = [
                'Ơ bạn vẫn còn đây không?? Tôi tưởng bạn đã ngủ rồi 😂',
                '25 giây! Kỷ lục chần chừ mới! 🏆',
                'Bạn đang nhờ ChatGPT tính nước à? Gian lận đấy nhé 😒',
                'Thôi được rồi, tôi sẽ dùng thời gian này học thêm 1 pattern mới 🧠',
                'Cứ từ từ đi, tôi không đi đâu cả... ngoại trừ lên bục chiến thắng 😈',
                'OK OK tôi hiểu rồi, bạn đang cố làm tôi mất tập trung phải không 🤔',
            ];
            // CHẶN LỜI THOẠI: Nếu chơi Online thì không cho xuất chữ ra khung chat nữa
            if (window.isOnlineModeActive && window.isOnlineModeActive()) {
                return;
            }

            const randomMsg = messages[Math.floor(Math.random() * messages.length)];
            
            // Nếu ở chế độ bot room, hiển thị trong panel bot
            if (window.isBotRoomMode && typeof BotRoomManager !== 'undefined' && BotRoomManager.showBotSpeech) {
                BotRoomManager.showBotSpeech(randomMsg);
            } else {
                // Hiển thị trong bot-bubble cũ (training mode)
                const botMessage = document.getElementById('bot-message');
                const botBubble  = document.getElementById('bot-bubble');
                if (botMessage && botBubble) {
                    botMessage.textContent = randomMsg;
                    botBubble.classList.add('annoying');
                    setTimeout(() => botBubble.classList.remove('annoying'), 5000);
                }
            }
        }
        if (playerTurnSeconds === 40 && isBotMode() && currentPlayer === humanPiece) {
            const messages = [
                '40 GIÂY!! Bạn ổn không? Cần gọi cấp cứu không? 🚑',
                'Tôi đã ngủ một giấc ngắn rồi thức dậy mà bạn vẫn chưa đi 😴',
                'Kỷ lục thế giới về đứng im nhìn bàn cờ đây rồi 🌍',
                'Bao lâu nữa? Tôi đặt hẹn cắt tóc chiều nay rồi 💈',
                'Thôi được, tôi sẽ tweet về trận này: "Đối thủ đang thiền định" 🐦',
            ];
            // CHẶN LỜI THOẠI: Nếu chơi Online thì không cho xuất chữ ra khung chat nữa
            if (window.isOnlineModeActive && window.isOnlineModeActive()) {
                return;
            }

            const randomMsg = messages[Math.floor(Math.random() * messages.length)];
            
            // Nếu ở chế độ bot room, hiển thị trong panel bot
            if (window.isBotRoomMode && typeof BotRoomManager !== 'undefined' && BotRoomManager.showBotSpeech) {
                BotRoomManager.showBotSpeech(randomMsg);
            } else {
                // Hiển thị trong bot-bubble cũ (training mode)
                const botMessage = document.getElementById('bot-message');
                const botBubble  = document.getElementById('bot-bubble');
                if (botMessage && botBubble) {
                    botMessage.textContent = randomMsg;
                    botBubble.classList.add('annoying');
                    setTimeout(() => botBubble.classList.remove('annoying'), 5000);
                }
            }
        }
    }, 1000);
}

// ===== INIT GAME =====
function initGame() {
    console.log('[initGame] START - timestamp:', performance.now());
    console.trace();

    // Chặn restart khi đang chơi online (ngoại trừ bot room mode)
    if (window.isOnlineModeActive && window.isOnlineModeActive() && !window.isBotRoomMode) {
        alert("Bạn đang trong trận đấu Online, không thể tự làm mới ván cờ!");
        return;
    }
    
    isInfinite = true;
    gameMode   = modeSelect.value;

    const winSelect = document.getElementById('win-count');
    winCount = parseInt(winSelect.value);
    if (winCount < 3) winCount = 3;

    isSolo = gameMode === 'solo';
    if (!gameMode && window.isBotRoomMode && window.currentBotConfig) {
        if (window.currentBotConfig.gameMode !== 'bot-vs-bot') {
            gameMode = window.currentBotConfig.gameMode || 'ai-easy';
        } else if (window.botVsBotState && window.botVsBotState.botXMode) {
            gameMode = window.botVsBotState.botXMode;
        }
        console.warn('[initGame] fallback gameMode from bot room config:', gameMode);
    }
    const groupPiece = document.getElementById('group-piece');
    const groupFirst = document.getElementById('group-first');
    if (groupPiece) groupPiece.style.display = isSolo ? 'none' : 'flex';
    if (groupFirst) groupFirst.style.display  = 'flex';

    const playerPiece = isSolo ? 'X' : (document.getElementById('player-piece')?.value || 'X');
    const firstMove   = document.getElementById('first-move')?.value || 'X';

    humanPiece = isSolo ? null : playerPiece;
    botPiece   = isSolo ? null : (playerPiece === 'X' ? 'O' : 'X');

    currentPlayer     = firstMove;
    isGameActive      = true;
    
    // YC.TXT FIX: Use centralized GameModeManager for solo mode
    if (isSolo && isGameActive) {
        if (typeof GameModeManager !== 'undefined') {
            GameModeManager.setMode(GameModes.SOLO, { gameMode, winCount });
        }
    }
    
    // BUG 5 FIX: Save complete game state to localStorage for F5 reload (solo mode)
    if (isSolo && isGameActive) {
        localStorage.setItem('solo_game_mode', 'true');
        localStorage.setItem('solo_game_config', JSON.stringify({
            gameMode,
            winCount,
            currentPlayer,
            // Save game state for proper restoration
            boardState: typeof infiniteMap !== 'undefined' ? Array.from(infiniteMap.entries()) : null,
            moveHistory: typeof moveHistory !== 'undefined' ? moveHistory : [],
            isGameActive: true,
            lastMoveR: typeof lastMoveR !== 'undefined' ? lastMoveR : null,
            lastMoveC: typeof lastMoveC !== 'undefined' ? lastMoveC : null
        }));
    }
    lastMoveCell      = null;
    lastMoveR         = null;
    lastMoveC         = null;

    console.log('[DEBUG-BOARD] initGame called:', {
        gameMode,
        playerPiece,
        firstMove,
        currentPlayer,
        isGameActive,
        boardSize,
        isInfinite
    });
    winningCellCoords = [];
    moveCount         = 0;
    moveHistory       = [];
    keyboardCursorR   = 0;
    keyboardCursorC   = 0;
    keyboardCursorVisible = false;
    updateCursorByTurn();

    playerTurnSeconds = 0;
    gameTotalSeconds  = 0;
    playerDangerScore = 0;
    if (playerTurnTimer) clearInterval(playerTurnTimer);
    if (gameTotalTimer)  clearInterval(gameTotalTimer);

    gameTotalTimer = setInterval(() => { gameTotalSeconds++; updateTimerDisplay(); }, 1000);
    startPlayerTurnTimer();

    // Reset only GameState - single source of truth
    if (typeof GameState !== 'undefined' && GameState.board) {
        GameState.board.infiniteMap = new Map();
        GameState.board.isInfinite = true;
        // Sync trang-thai.js reference
        if (typeof initializeBoardState === 'function') {
            initializeBoardState();
        }
    } else {
        // Fallback if GameState not available
        infiniteMap = new Map();
    }

    console.log('[initGame] infiniteMap identity check:', {
        GameState: typeof GameState !== 'undefined' ? 'exists' : 'undefined',
        GameStateMap: typeof GameState !== 'undefined' && GameState.board ? GameState.board.infiniteMap : 'N/A',
        trangThaiMap: infiniteMap,
        same: typeof GameState !== 'undefined' && GameState.board ? Object.is(GameState.board.infiniteMap, infiniteMap) : 'N/A'
    });
    // YC.TXT FIX: KHÔNG reset infCanvas về null trong bất kỳ mode nào
    // Board First architecture: canvas được inject và giữ nguyên
    // Chỉ reset khi thực sự cần thay đổi canvas (không phải trong initGame)
    // if (!window.isOnlineModeActive || !window.isOnlineModeActive()) {
    //     infCanvas   = null;
    //     infCanvasInitialized = false;
    // }

    // BUG.TXT FIX: Don't reset vRowF/vColF in Bot Room mode (viewport already set by initBotRoomCanvas)
    if (!window.isBotRoomMode) {
        vRowF = 0; vColF = 0;
    }

    infHoverR = null; infHoverC = null;

    zobristHash = 0;

    // Log state before AI scheduling
    console.log('[initGame] State before AI scheduling - timestamp:', performance.now(), {
        currentPlayer,
        botPiece,
        isGameActive,
        isSolo,
        isBotMode: isBotMode(),
        gameMode,
        GameState: typeof GameState !== 'undefined' ? 'exists' : 'undefined',
        GameStateMap: typeof GameState !== 'undefined' && GameState.board ? GameState.board.infiniteMap : 'N/A',
        trangThaiMap: infiniteMap,
        same: typeof GameState !== 'undefined' && GameState.board ? Object.is(GameState.board.infiniteMap, infiniteMap) : 'N/A',
        infiniteMapSize: infiniteMap ? infiniteMap.size : 'undefined'
    });

    // Sử dụng requestAnimationFrame để render mượt hơn
    requestAnimationFrame(() => {
        renderInfiniteBoard();
        updateStatus();

        if (isGameActive && !isSolo && isBotMode() && currentPlayer === botPiece) {
            const thinkTime = gameMode === 'ai-god' || gameMode === 'bot-toi-thuong' ? 500 :
                            gameMode === 'bot-tia-chop' ? 200 :
                            gameMode === 'ai-hard' ? 300 : 180;
            statusPanel.innerHTML = `🤖 <span style="opacity:0.7">Đang tính toán</span> <span class="think-dots">...</span>`;
            console.log('[initGame] Scheduling AI move in', thinkTime, 'ms - timestamp:', performance.now());
            setTimeout(makeAIMove, thinkTime);
        }
    });

    console.log('[initGame] END - timestamp:', performance.now());
    console.trace();
}

// ===== STATUS =====
function updateStatus() {
    if (!isGameActive) return;
    if (isBotMode() && currentPlayer === botPiece) {
        statusPanel.innerHTML = `🤖 Siêu Não AI đang phong tỏa các hướng đi...`;
    } else {
        statusPanel.innerHTML = `Lượt của bạn: <span class="turn-${currentPlayer}">${currentPlayer}</span>`;
    }
}

// ===== MAKE MOVE =====
function makeMove(r, c) {
    if (typeof isGameActive !== 'undefined' && !isGameActive) {
        return;
    }
    if (typeof getCell === 'function' && getCell(r, c) !== '') {
        return;
    }

    console.log('[DEBUG-BOARD] makeMove called:', {
        r, c,
        isGameActive,
        currentPlayer,
        gameMode,
        isOnlineMode: window.isOnlineModeActive ? window.isOnlineModeActive() : false,
        myOnlineRole: window.myOnlineRole,
        currentTurn: typeof currentTurn !== 'undefined' ? currentTurn : 'undefined'
    });

    // NẾU ĐANG CHƠI ONLINE
    if (typeof GameModeManager !== 'undefined' && GameModeManager.isReplay && GameModeManager.isReplay()) {
        console.warn('[DEBUG-BOARD] makeMove blocked: replay mode active');
        return;
    }
    if (window.isOnlineModeActive && window.isOnlineModeActive()) {
        // Chỉ cho gửi một nước đi tại một thời điểm. Nếu không, người chơi có
        // thể click nhanh nhiều ô trước khi Firebase phản hồi và làm lệch bàn cờ local.
        if (window.onlineMovePending) {
            console.warn('[DEBUG-BOARD] makeMove blocked: onlineMovePending is true');
            return;
        }
        const quanToi = window.myOnlineRole;

        // Chặn: viewer hoặc chưa có ghế thì không được đánh
        if (!quanToi || quanToi === 'viewer') {
            console.warn('[DEBUG-BOARD] makeMove blocked: role=', quanToi);
            return;
        }

        // Chặn: không phải lượt mình thì không được đánh
        if (typeof currentTurn !== 'undefined' && currentTurn !== quanToi) {
            console.warn('[DEBUG-BOARD] makeMove blocked: currentTurn=', currentTurn, 'myRole=', quanToi);
            return;
        }

        // Chặn: nếu có yêu cầu undo đang chờ, không được đánh tiếp
        if (window.undoRequestPending) {
            console.warn('[DEBUG-BOARD] makeMove blocked: undo request pending');
            return;
        }

        // Vẽ quân lên bàn trước (optimistic update)
        moveCount++;
        setCell(r, c, quanToi);
        moveHistory.push({ r, c, player: quanToi });
        if (typeof locallyAppliedLastMove !== 'undefined') {
            locallyAppliedLastMove.row = r;
            locallyAppliedLastMove.col = c;
        }
        
        // DISABLED Shared Board Engine sync - use old system only
        // This prevents conflicts between old system and SharedBoardEngine

        if (typeof neuralEvaluator !== 'undefined' && neuralEvaluator.invalidateCache) {
            neuralEvaluator.invalidateCache();
        }

        keyboardCursorR = r; keyboardCursorC = c;
        keyboardCursorVisible = true;
        if (playerTurnTimer) clearInterval(playerTurnTimer);

        if (isInfinite) {
            lastMoveR = r; lastMoveC = c;
            const cols = infCanvasW / INF_CS, rows = infCanvasH / INF_CS;
            if (Math.abs((r - vRowF) - rows / 2) > rows * 0.35 || Math.abs((c - vColF) - cols / 2) > cols * 0.35) {
                vRowF = r - rows / 2; vColF = c - cols / 2;
            }
            renderInfiniteBoard();
        } else {
            if (lastMoveCell) lastMoveCell.classList.remove('last-move');
            const cell = document.querySelector(`[data-row='${r}'][data-col='${c}']`);
            if (cell) { cell.classList.add(quanToi); cell.classList.add('last-move'); lastMoveCell = cell; }
        }

        // Gửi lên Firebase SAU KHI đã setCell (để kiểm tra thắng đọc đúng board).
        // Kết quả thắng chỉ được chốt sau khi transaction được Firebase xác nhận.
        const isWinningMove = (typeof checkWinSilent === 'function') ? checkWinSilent(r, c) : false;
        if (window.guiNuocDiLenFirebase) {
            window.onlineMovePending = true;
            return Promise.resolve(window.guiNuocDiLenFirebase(r, c))
                .then(hopLe => {
                    if (!hopLe) {
                        // Firebase từ chối nước đi (sai lượt/ô đã có quân/kết nối lỗi).
                        // Hoàn tác nước optimistic để bàn cờ local luôn khớp server.
                        setCell(r, c, '');
                        moveHistory.pop();
                        moveCount--;
                        if (isInfinite) renderInfiniteBoard();
                        else {
                            const rollbackCell = document.querySelector(`[data-row='${r}'][data-col='${c}']`);
                            if (rollbackCell) rollbackCell.classList.remove(quanToi, 'last-move');
                        }
                        if (typeof currentPlayer !== 'undefined') currentPlayer = quanToi;
                        updateCursorByTurn();
                        updateStatus();
                        return;
                    }
                    if (isWinningMove) {
                        isGameActive = false;
                        statusPanel.innerHTML = `🏆 <strong>${quanToi}</strong> chiến thắng!`;
                        if (gameTotalTimer) clearInterval(gameTotalTimer);
                        if (playerTurnTimer) clearInterval(playerTurnTimer);
                        return;
                    }
                    // Chuyển lượt local chỉ khi Firebase xác nhận nước đi hợp lệ và không phải nước thắng.
                    currentPlayer = quanToi === 'X' ? 'O' : 'X';
                    updateCursorByTurn();
                    updateStatus();
                })
                .catch(() => {
                    setCell(r, c, '');
                    moveHistory.pop();
                    moveCount--;
                    if (isInfinite) renderInfiniteBoard();
                    else {
                        const rollbackCell = document.querySelector(`[data-row='${r}'][data-col='${c}']`);
                        if (rollbackCell) rollbackCell.classList.remove(quanToi, 'last-move');
                    }
                    if (typeof currentPlayer !== 'undefined') currentPlayer = quanToi;
                    updateCursorByTurn();
                    updateStatus();
                })
                .finally(() => { window.onlineMovePending = false; });
        }

        // Nước thắng chờ Firebase xác nhận; tránh hiển thị thắng giả khi transaction bị từ chối.
        if (isWinningMove) return;

        // Nếu không ở chế độ online thì chuyển lượt như bình thường
        currentPlayer = quanToi === 'X' ? 'O' : 'X';
        updateCursorByTurn();
        updateStatus();
        return;
    }
    // --- GIỮ NGUYÊN LOGIC ĐẤU BOT TỰ ĐỘNG CŨ CỦA ANH Ở DƯỚI ĐÂY ---

    console.log('[makeMove] makeMove(' + r + ',' + c + ')');
    const sizeBefore = typeof infiniteMap !== 'undefined' ? infiniteMap.size : 'undefined';
    console.log('[makeMove] infiniteMap.size before=' + sizeBefore);

    moveCount++;
    setCell(r, c, currentPlayer);
    moveHistory.push({ r, c, player: currentPlayer });

    const sizeAfter = typeof infiniteMap !== 'undefined' ? infiniteMap.size : 'undefined';
    console.log('[makeMove] infiniteMap.size after=' + sizeAfter);

    // Invalidate neural cache khi board state thay đổi
    if (typeof neuralEvaluator !== 'undefined' && neuralEvaluator.invalidateCache) {
        neuralEvaluator.invalidateCache();
    }

    keyboardCursorR = r; keyboardCursorC = c;
    keyboardCursorVisible = true;

    if (playerTurnTimer) clearInterval(playerTurnTimer);
    updateCursorByTurn();

    if (isInfinite) {
        lastMoveR = r; lastMoveC = c;
        const cols  = infCanvasW / INF_CS;
        const rows  = infCanvasH / INF_CS;
        const distR = Math.abs((r - vRowF) - rows / 2);
        const distC = Math.abs((c - vColF) - cols / 2);
        if (distR > rows * 0.35 || distC > cols * 0.35) {
            vRowF = r - rows / 2;
            vColF = c - cols / 2;
        }
        renderInfiniteBoard();
    } else {
        if (lastMoveCell) lastMoveCell.classList.remove('last-move');
        let cell = document.querySelector(`[data-row='${r}'][data-col='${c}']`);
        if (cell) { cell.classList.add(currentPlayer); cell.classList.add('last-move'); lastMoveCell = cell; }
    }

    if (checkWin(r, c)) {
        isGameActive = false;
        if (lastMoveCell) lastMoveCell.classList.remove('last-move');
        const isBotWin   = isBotMode() && currentPlayer === botPiece;
        const boardLabel = '♾️ Vô Hạn';

        // Lưu kết quả cho autoplay
        if (typeof autoplayLastWinner !== 'undefined') {
            autoplayLastWinner = currentPlayer;
        }

        // Nếu đang autoplay thì bỏ qua phần UI popup
        if (isAutoplayRunning) {
            // autoplayLastWinner đã được set ở trên
            // KHÔNG gọi onBotLoss ở đây — autoplayMove sẽ xử lý learning sau ván
            return;
        }

        // Show navigation when game ends (before showing win overlay)
        if (typeof showTopNavigation === 'function') {
            showTopNavigation();
        }

        if (gameMode === 'solo') {
            statusPanel.innerHTML = `🏆 Người <strong>${currentPlayer}</strong> chiến thắng!`;
            recordMatch('win', currentPlayer);
            setTimeout(() => {
                showWinOverlay(currentPlayer, false, '', '');
                if (gameTotalTimer) clearInterval(gameTotalTimer);
                if (playerTurnTimer) clearInterval(playerTurnTimer);
                const timerPanel = document.getElementById('timer-panel');
                if (timerPanel) timerPanel.style.display = 'none';
                setTimeout(() => promptRankName(moveCount, gameMode, winCount, boardLabel, `Người ${currentPlayer}`, playerDangerScore, gameTotalSeconds), 600);
            }, 500);
        } else {
            if (isBotWin) {
                let tauntMessage = '', tauntEmoji = '';
                if (lossStreak === 2) {
                    const t = ['Thua 2 ván rồi! Cần luyện thêm nhé! 😅','2 ván liên tiếp! Bạn đang gặp khó khăn đấy! 🤔','Thua 2 lần! Đừng nản, cố lên! 😊'];
                    tauntMessage = t[Math.floor(Math.random() * t.length)]; tauntEmoji = '😅';
                } else if (lossStreak === 3) {
                    const t = ['3 ván liên tiếp! Gừng càng già càng cay! 🔥','Thua 3 ván! BOT đang lên hương đấy! 😎','3 lần thua! Bạn có muốn thử chế độ Dễ không? 🤭'];
                    tauntMessage = t[Math.floor(Math.random() * t.length)]; tauntEmoji = '😎';
                } else if (lossStreak >= 4) {
                    const t = [
                        `${lossStreak} ván liên tiếp! Bạn đang tạo kỷ lục đấy! 🏆`,
                        `Thua ${lossStreak} ván! BOT TỐI THƯỢNG không thể bị đánh bại! 💀`,
                        `${lossStreak} lần! Có lẽ nên nghỉ ngơi một chút? 😂`,
                        `Kỷ lục ${lossStreak} ván! Bạn rất kiên trì! 🎖️`,
                        `${lossStreak} ván thua! BOT cảm thấy bất lực... vì bạn quá yếu! 😜`
                    ];
                    tauntMessage = t[Math.floor(Math.random() * t.length)]; tauntEmoji = '💀';
                } else {
                    tauntMessage = 'Gừng càng già càng cay — bó tay thì gặp anh Chần!'; tauntEmoji = '💀';
                }
                statusPanel.innerHTML = `💀 BOT TỐI THƯỢNG ĐÃ THẮNG! ${tauntMessage}`;
                recordMatch('lose', botPiece);
                // Bot thắng → nhớ pattern thắng để lặp lại
                if (typeof onBotWin === 'function') {
                    onBotWin([...moveHistory], botPiece);
                }
                // Bot cũng học pattern của người thắng để tránh bị đánh bại tương tự
                if (typeof onBotLoss === 'function') {
                    onBotLoss([...moveHistory], humanPiece);
                }
                setTimeout(() => {
                    showWinOverlay(botPiece, true, tauntMessage, tauntEmoji);
                    if (gameTotalTimer) clearInterval(gameTotalTimer);
                    if (playerTurnTimer) clearInterval(playerTurnTimer);
                    const timerPanel = document.getElementById('timer-panel');
                    if (timerPanel) timerPanel.style.display = 'none';
                }, 500);
            } else {
                statusPanel.innerHTML = `🏆 KINH ĐIỂM! Bạn đã chiến thắng BOT của PRO PRO, bạn rất là kinh, bái phục`;
                recordMatch('win', humanPiece);
                // Cập nhật thống kê winBot cho user nếu đã đăng nhập - chỉ tính khi winCount >= 5
                if (typeof window.updateUserStats === 'function' && winCount >= 5) {
                    window.updateUserStats('winBot', 1);
                } else if (winCount < 5) {
                    console.log("Trận thắng Bot ở chế độ dưới 5 quân không được tính vào điểm Rank!");
                }
                // Cộng Xu khi thắng bot (có giới hạn ngày)
                if (typeof window.onWinBotXu === 'function') {
                    window.onWinBotXu(gameMode);
                }
                // Người thắng → bot học pattern của người thắng để tránh bị đánh bại tương tự
                if (typeof onBotLoss === 'function') {
                    onBotLoss([...moveHistory], humanPiece);
                }
                setTimeout(() => {
                    if (gameTotalTimer) clearInterval(gameTotalTimer);
                    if (playerTurnTimer) clearInterval(playerTurnTimer);
                    const timerPanel = document.getElementById('timer-panel');
                    if (timerPanel) timerPanel.style.display = 'none';
                    promptRankName(moveCount, gameMode, winCount, boardLabel, `Người thắng Bot ${MODE_LABELS[gameMode]}`, playerDangerScore, gameTotalSeconds);
                    setTimeout(() => showWinOverlay(humanPiece, false, '', ''), 100);
                }, 500);
            }
        }
        return;
    }

    currentPlayer = currentPlayer === "X" ? "O" : "X";
    updateCursorByTurn();
    console.log('[makeMove] nextPlayer=', currentPlayer, 'botPiece=', botPiece, 'humanPiece=', humanPiece, 'isBotMode=', isBotMode(), 'isBotVsBotMode=', window.isBotVsBotMode);

    if (isBotMode() && !isBotMove && !window.isBotVsBotMode) evaluatePlayerMove(r, c);
    if (isGameActive && isBotMode() && currentPlayer === humanPiece && !window.isBotVsBotMode) startPlayerTurnTimer();

    updateStatus();
    if (isGameActive && isBotMode() && currentPlayer === botPiece && !window.isBotVsBotMode) {
        const thinkTime = gameMode === 'ai-god' || gameMode === 'bot-toi-thuong' ? 500 :
                        gameMode === 'bot-tia-chop' ? 200 :
                        gameMode === 'ai-hard' ? 300 : 180;
        statusPanel.innerHTML = `🤖 <span style="opacity:0.7">Đang tính toán</span> <span class="think-dots">...</span>`;
        setTimeout(makeAIMove, thinkTime);
    }
}

// ===== CHECK WIN =====
function getWinningLine(row, col, player, winCount, blockBothEndsEnabled) {
    const opp = player === 'X' ? 'O' : 'X';
    for (let { dr, dc } of DIRECTIONS) {
        const line = [[row, col]];
        let r = row;
        let c = col;

        while (getCell(r + dr, c + dc) === player) {
            r += dr;
            c += dc;
            line.push([r, c]);
        }

        r = row;
        c = col;
        while (getCell(r - dr, c - dc) === player) {
            r -= dr;
            c -= dc;
            line.unshift([r, c]);
        }

        if (line.length < winCount) continue;

        if (!blockBothEndsEnabled) {
            return line;
        }

        const segmentCount = line.length - winCount + 1;
        for (let startIndex = 0; startIndex < segmentCount; startIndex++) {
            const segment = line.slice(startIndex, startIndex + winCount);
            const startCell = segment[0];
            const endCell = segment[segment.length - 1];
            const headCell = getCell(endCell[0] + dr, endCell[1] + dc);
            const tailCell = getCell(startCell[0] - dr, startCell[1] - dc);
            const headBlocked = headCell === opp;
            const tailBlocked = tailCell === opp;

            if (!(headBlocked && tailBlocked)) {
                return segment;
            }
        }
    }
    return null;
}

// Resolve room rules from parameter, GameState.roomRules, or fallback
function _resolveRoomRules(passedRules) {
    if (passedRules && typeof passedRules.winCount === 'number') return passedRules;
    if (typeof GameState !== 'undefined' && GameState.roomRules) return GameState.roomRules;
    if (typeof window !== 'undefined' && window.roomRules && typeof window.roomRules.winCount === 'number') return window.roomRules;
    // Fallback to GameState.board.winCount if available
    const fallbackWin = (typeof GameState !== 'undefined' && GameState.board && typeof GameState.board.winCount === 'number') ? GameState.board.winCount : (typeof winCount === 'number' ? winCount : undefined);
    const fallbackChan = (typeof document !== 'undefined') ? !!document.getElementById('block-both-ends')?.checked : true;
    if (typeof fallbackWin === 'undefined') {
        console.warn('[checkWin] roomRules missing; unable to determine winCount reliably');
    }
    return { winCount: fallbackWin, chan2Dau: fallbackChan, firstTurn: (typeof window !== 'undefined' && window.firstTurn) ? window.firstTurn : 'X' };
}

function checkWin(r, c, roomRules) {
    const player = getCell(r, c);
    if (!player) return false;
    const rules = _resolveRoomRules(roomRules);
    const blockBothEndsEnabled = !!rules.chan2Dau;
    const countRequired = rules.winCount;
    const winningLine = getWinningLine(r, c, player, countRequired, blockBothEndsEnabled);
    if (!winningLine) return false;
    highlightWinners(winningLine);
    return true;
}

// checkWinSilent: dùng cho AI — nhận roomRules optional
function checkWinSilent(r, c, roomRules) {
    const player = getCell(r, c);
    if (!player) return false;
    const rules = _resolveRoomRules(roomRules);
    const blockBothEndsEnabled = !!rules.chan2Dau;
    const countRequired = rules.winCount;
    return !!getWinningLine(r, c, player, countRequired, blockBothEndsEnabled);
}

// ĐỊNH NGHĨA HÀM XÓA SẠCH BÀN CỜ CHO VÁN MỚI TINH
window.xoaBanCoCu = function() {
    // Online mode luôn dùng infinite canvas — đảm bảo flag đúng
    if (window.isOnlineModeActive && window.isOnlineModeActive()) {
        isInfinite = true;
    }
    // Reset mảng dữ liệu logic cờ
    if (typeof infiniteMap !== 'undefined') infiniteMap.clear();
    if (typeof GameState !== 'undefined' && GameState.board && GameState.board.infiniteMap) {
        GameState.board.infiniteMap.clear();
    }
    if (typeof moveHistory !== 'undefined') moveHistory.length = 0;
    if (typeof lastMoveR   !== 'undefined') { lastMoveR = null; lastMoveC = null; }
    if (typeof currentPlayer !== 'undefined') currentPlayer = 'X';
    if (typeof winningCellCoords !== 'undefined') winningCellCoords.length = 0;
    if (typeof isGameActive !== 'undefined') isGameActive = true;
    if (window._suppressOnlineWinOverlay) {
        window._suppressOnlineWinOverlay = false;
        window._suppressOnlineWinOverlayRoom = null;
    }
    // Reset hover để không còn chấm xanh
    if (typeof infHoverR !== 'undefined') { infHoverR = null; infHoverC = null; }

    // DISABLED Shared Board Engine clear - use old system only
    // This prevents conflicts between old system and SharedBoardEngine

    document.querySelectorAll('.cell').forEach(cell => {
        cell.innerHTML = '';
        cell.classList.remove('winning-cell');
    });

    if (typeof renderInfiniteBoard === 'function') renderInfiniteBoard();
    if (typeof renderFixedBoard    === 'function') renderFixedBoard();
};

// ===== UNDO MOVE FOR SOLO BOT MODE =====
window.undoSoloBotMove = function() {
    console.log({
        gameMode:typeof gameMode !== 'undefined' ? gameMode : 'undefined',
        moveHistory:typeof moveHistory !== 'undefined' ? moveHistory.length : 'undefined'
    });
    if (typeof gameMode === 'undefined' || (!gameMode.startsWith('ai') && gameMode !== 'solo')) {
        alert('Chỉ có thể undo trong chế độ đấu Bot!');
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
        currentPlayer = playerPiece || 'X';
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
    if (typeof updateStatus === 'function') {
        updateStatus();
    }

    // Bot sẽ không tự đánh vì currentPlayer đã được set về lượt người
};

// checkWinLogicOld: Hàm kiểm tra thắng thua hỗ trợ cả Online và Offline với tham số luật chơi tùy chỉnh
window.checkWinLogicOld = function(row, col, playerRole, customRule, customWinCount) {
    const player = playerRole || getCell(row, col);
    if (!player) return false;

    let blockBothEndsEnabled = false;
    let currentWinCount = winCount;

    if (window.isOnlineModeActive && window.isOnlineModeActive()) {
        if (typeof customRule === 'string') {
            blockBothEndsEnabled = (customRule === 'chan_2_dau');
        } else if (typeof currentRule !== 'undefined') {
            blockBothEndsEnabled = currentRule === 'chan_2_dau';
        }
        if (typeof customWinCount === 'number') currentWinCount = customWinCount;
    } else {
        const checkboxCu = document.getElementById('block-both-ends');
        blockBothEndsEnabled = checkboxCu ? checkboxCu.checked : false;
        if (typeof customWinCount === 'number') currentWinCount = customWinCount;
    }

    const winningLine = getWinningLine(row, col, player, currentWinCount, blockBothEndsEnabled);
    if (winningLine) {
        highlightWinners(winningLine);
        return true;
    }
    return false;
};

function highlightWinners(winningCells) {
    if (isInfinite) winningCellCoords = winningCells.slice();
    winningCells.forEach(([r, c]) => {
        const cell = document.querySelector(`[data-row='${r}'][data-col='${c}']`);
        if (cell) cell.classList.add('winning-cell');
    });
    // Sync winning cells to SharedBoardEngine for online mode
    if (typeof SharedBoardEngine !== 'undefined' && SharedBoardEngine && SharedBoardEngine.BoardState) {
        const cellObjects = winningCells.map(([r, c]) => ({ x: r, y: c }));
        SharedBoardEngine.BoardState.setWinningCells(cellObjects);
    }
}

// ===== CANDIDATES =====
function hasNeighbor(r, c, range) {
    for (let dr = -range; dr <= range; dr++)
        for (let dc = -range; dc <= range; dc++)
            if (!(dr === 0 && dc === 0) && getCell(r+dr, c+dc) !== "" && getCell(r+dr, c+dc) !== "W") return true;
    return false;
}

function getCandidates(range) {
    const result = [];
    if (isInfinite) {
        const checked = new Set();
        for (const key of infiniteMap.keys()) {
            const [r, c] = key.split(',').map(Number);
            for (let dr = -range; dr <= range; dr++) {
                for (let dc = -range; dc <= range; dc++) {
                    const nr = r+dr, nc = c+dc;
                    const nk = `${nr},${nc}`;
                    if (!checked.has(nk) && !infiniteMap.has(nk)) {
                        checked.add(nk);
                        result.push({ r: nr, c: nc });
                    }
                }
            }
        }
        if (result.length === 0) result.push({ r: 0, c: 0 });
    } else {
        for (let r = 0; r < boardSize; r++)
            for (let c = 0; c < boardSize; c++)
                if (boardState[r][c] === "" && hasNeighbor(r, c, range)) result.push({ r, c });
        if (result.length === 0) result.push({ r: Math.floor(boardSize/2), c: Math.floor(boardSize/2) });
    }
    return result;
}

function getActivityCenter() {
    if (isInfinite && infiniteMap.size > 0) {
        let sr = 0, sc = 0, n = 0;
        for (const key of infiniteMap.keys()) {
            const [r, c] = key.split(',').map(Number);
            sr += r; sc += c; n++;
        }
        return [Math.round(sr/n), Math.round(sc/n)];
    }
    return [Math.floor(boardSize/2), Math.floor(boardSize/2)];
}

// ===== OPENING BOOK =====
const openingBook = {
    // Nước đi đầu tiên - mở rộng với diagonal và indirect openings
    start: [
        { moves: [], move: [0, 0], weight: 10 },        // Center (tốt nhất)
        { moves: [], move: [-2, -2], weight: 3 },      // Diagonal opening
        { moves: [], move: [2, 2], weight: 3 },
        { moves: [], move: [-2, 2], weight: 3 },
        { moves: [], move: [2, -2], weight: 3 },
        { moves: [], move: [-3, 0], weight: 2 },        // Indirect opening
        { moves: [], move: [3, 0], weight: 2 },
        { moves: [], move: [0, -3], weight: 2 },
        { moves: [], move: [0, 3], weight: 2 },
    ],
    // Response khi đối thủ đi trung tâm
    centerResponse: (() => {
        const mid = 0;
        return [
            { moves: [[mid,mid]], move: [mid-1, mid-1], weight: 10 }, // Direct diagonal
            { moves: [[mid,mid]], move: [mid-1, mid+1], weight: 10 },
            { moves: [[mid,mid]], move: [mid+1, mid-1], weight: 10 },
            { moves: [[mid,mid]], move: [mid+1, mid+1], weight: 10 },
            { moves: [[mid,mid]], move: [mid-2, mid], weight: 6 },   // Indirect
            { moves: [[mid,mid]], move: [mid+2, mid], weight: 6 },
            { moves: [[mid,mid]], move: [mid, mid-2], weight: 6 },
            { moves: [[mid,mid]], move: [mid, mid+2], weight: 6 },
            { moves: [[mid,mid]], move: [mid-2, mid-2], weight: 4 }, // Far diagonal
            { moves: [[mid,mid]], move: [mid-2, mid+2], weight: 4 },
            { moves: [[mid,mid]], move: [mid+2, mid-2], weight: 4 },
            { moves: [[mid,mid]], move: [mid+2, mid+2], weight: 4 },
        ];
    })(),
    // Response khi đối thủ đi diagonal
    diagonalResponse: (() => {
        return [
            { pattern: 'diagonal', move: [0, 0], weight: 10 },       // Chặn trung tâm
            { pattern: 'diagonal', move: [-1, 1], weight: 8 },       // Counter diagonal
            { pattern: 'diagonal', move: [1, -1], weight: 8 },
            { pattern: 'diagonal', move: [-2, 0], weight: 5 },        // Indirect
            { pattern: 'diagonal', move: [2, 0], weight: 5 },
            { pattern: 'diagonal', move: [0, -2], weight: 5 },
            { pattern: 'diagonal', move: [0, 2], weight: 5 },
        ];
    })(),
    // Response khi đối thủ đi indirect
    indirectResponse: (() => {
        return [
            { pattern: 'indirect', move: [0, 0], weight: 10 },       // Lấy trung tâm
            { pattern: 'indirect', move: [-1, -1], weight: 8 },      // Tạo diagonal
            { pattern: 'indirect', move: [-1, 1], weight: 8 },
            { pattern: 'indirect', move: [1, -1], weight: 8 },
            { pattern: 'indirect', move: [1, 1], weight: 8 },
            { pattern: 'indirect', move: [-2, -1], weight: 5 },      // Kết nối
            { pattern: 'indirect', move: [-2, 1], weight: 5 },
            { pattern: 'indirect', move: [2, -1], weight: 5 },
            { pattern: 'indirect', move: [2, 1], weight: 5 },
        ];
    })()
};

function getOpeningMove() {
    const cnt = isInfinite ? infiniteMap.size : boardState.flat().filter(x => x !== "").length;
    if (cnt > 6) return null; // Mở rộng từ 4 lên 6 nước
    
    let book = null;
    
    if (cnt === 0) {
        // Nước đi đầu tiên
        book = openingBook.start;
    } else if (cnt === 1) {
        // Phản hồi nước đi đầu tiên của đối thủ
        const lastMove = moveHistory[moveHistory.length - 1];
        if (!lastMove) return null;
        
        const [lr, lc] = [lastMove.r, lastMove.c];
        
        // Phân tích kiểu opening của đối thủ
        if (lr === 0 && lc === 0) {
            // Đối thủ đi trung tâm
            book = openingBook.centerResponse;
        } else if (Math.abs(lr) === Math.abs(lc)) {
            // Đối thủ đi diagonal
            book = openingBook.diagonalResponse;
        } else {
            // Đối thủ đi indirect
            book = openingBook.indirectResponse;
        }
    } else {
        // Các nước tiếp theo - dùng response tương ứng
        book = openingBook.centerResponse; // Fallback
    }
    
    if (!book || book.length === 0) return null;
    
    const totalW = book.reduce((s, x) => s + x.weight, 0);
    let rand = Math.random() * totalW;
    
    for (const entry of book) {
        rand -= entry.weight;
        if (rand <= 0) {
            const cell = entry.move;
            if (isInfinite) {
                if (!infiniteMap.has(`${cell[0]},${cell[1]}`)) return { r: cell[0], c: cell[1] };
            } else {
                if (boardState[cell[0]] && boardState[cell[0]][cell[1]] === "") return { r: cell[0], c: cell[1] };
            }
        }
    }
    return null;
}

// BUG 5 FIX: Restore solo game state on page load
window.addEventListener('load', () => {
    // YC.TXT FIX: Use centralized GameModeManager for restore
    if (typeof GameModeManager !== 'undefined') {
        const restoredMode = GameModeManager.restoreMode();
        
        if (restoredMode === GameModes.SOLO) {
            const context = GameModeManager.getContext();
            const savedSoloConfig = localStorage.getItem('solo_game_config');
            
            if (savedSoloConfig) {
                try {
                    const config = JSON.parse(savedSoloConfig);
                    
                    localStorage.removeItem('current_room_id');
                    
                    const modeSelect = document.getElementById('game-mode');
                    if (modeSelect) modeSelect.value = config.gameMode;
                    
                    const winSelect = document.getElementById('win-count');
                    if (winSelect) winSelect.value = config.winCount;
                    
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
                    if (typeof lastMoveR !== 'undefined') lastMoveR = config.lastMoveR;
                    if (typeof lastMoveC !== 'undefined') lastMoveC = config.lastMoveC;
                    
                    setTimeout(() => {
                        if (typeof switchView === 'function') {
                            switchView('battle');
                        }
                        if (typeof hideTopNavigation === 'function') {
                            hideTopNavigation();
                        }
                        // YC.TXT FIX: Only render if canvas is ready
                        if (typeof renderInfiniteBoard === 'function' && typeof infCanvas !== 'undefined' && infCanvas && typeof infCtx !== 'undefined' && infCtx) {
                            renderInfiniteBoard();
                        }
                    }, 100);
                } catch(e) {
                    console.error('[LogicGame] Failed to restore solo game state:', e);
                    localStorage.removeItem('solo_game_mode');
                    localStorage.removeItem('solo_game_config');
                    GameModeManager.clearMode();
                }
            }
        }
    } else {
        // Fallback to old logic
        const savedSoloMode = localStorage.getItem('solo_game_mode');
        const savedSoloConfig = localStorage.getItem('solo_game_config');
        
        if (savedSoloMode === 'true' && savedSoloConfig) {
            try {
                const config = JSON.parse(savedSoloConfig);
                
                localStorage.removeItem('current_room_id');
                
                const modeSelect = document.getElementById('game-mode');
                if (modeSelect) modeSelect.value = config.gameMode;
                
                const winSelect = document.getElementById('win-count');
                if (winSelect) winSelect.value = config.winCount;
                
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
                if (typeof lastMoveR !== 'undefined') lastMoveR = config.lastMoveR;
                if (typeof lastMoveC !== 'undefined') lastMoveC = config.lastMoveC;
                
                setTimeout(() => {
                    if (typeof switchView === 'function') {
                        switchView('battle');
                    }
                    if (typeof hideTopNavigation === 'function') {
                        hideTopNavigation();
                    }
                    if (typeof renderInfiniteBoard === 'function') {
                        renderInfiniteBoard();
                    }
                }, 100);
            } catch(e) {
                console.error('[LogicGame] Failed to restore solo game state:', e);
                localStorage.removeItem('solo_game_mode');
                localStorage.removeItem('solo_game_config');
            }
        }
    }
});

// BUG 5 FIX: Clear solo game state when game ends
const _origCheckWin = window.checkWin;
window.checkWin = function(r, c) {
    const result = _origCheckWin ? _origCheckWin(r, c) : false;
    if (result && isSolo) {
        localStorage.removeItem('solo_game_mode');
        localStorage.removeItem('solo_game_config');
    }
    return result;
};
