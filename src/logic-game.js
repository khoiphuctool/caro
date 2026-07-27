// ===== LOGIC GAME - initGame, makeMove, checkWin, timer =====
// boardElement, statusPanel, modeSelect Ä‘Æ°á»£c khai bĂ¡o trong index.html sau khi DOM sáºµn sĂ ng

// Helper: kiá»ƒm tra cĂ³ pháº£i cháº¿ Ä‘á»™ Ä‘áº¥u bot (báº¥t ká»³ loáº¡i bot nĂ o)
function isBotMode(mode) {
    const m = mode || (typeof gameMode !== 'undefined' ? gameMode : '');
    return m.startsWith('ai') || m === 'bot-tia-chop' || m === 'bot-toi-thuong';
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
                'LĂ¢u tháº¿, tĂ´i cĂ²n pháº£i Ä‘i Ä‘Ă¡i! đŸ½',
                'Nhanh lĂªn! Báº¯p rang cá»§a tĂ´i nguá»™i máº¥t rá»“i đŸ¿',
                'Æ  kĂ¬a, ngá»§ quĂªn Ă ? đŸ˜´',
                'TĂ´i Ä‘ang chá» Ä‘áº¥y... thá»Ÿ dĂ i nghe khĂ´ng? đŸ˜®â€đŸ’¨',
                'Báº¥m Ä‘i! BĂ n cá» khĂ´ng tá»± di chuyá»ƒn Ä‘Ă¢u nhĂ© đŸ¯',
                'CĂ²n Ä‘Ă¢y khĂ´ng? Hay Ä‘Ă£ bá» trá»‘n rá»“i? đŸ‘€',
                'Suy nghÄ© hay Ä‘ang gá»i viá»‡n binh váº­y? đŸ“',
            ];
            // CHáº¶N Lá»œI THOáº I: Náº¿u chÆ¡i Online thĂ¬ khĂ´ng cho xuáº¥t chá»¯ ra khung chat ná»¯a
            if (window.isOnlineModeActive && window.isOnlineModeActive()) {
                return; 
            }

            const randomMsg = messages[Math.floor(Math.random() * messages.length)];
            const botMessage = document.getElementById('bot-message');
            const botBubble  = document.getElementById('bot-bubble');
            if (botMessage && botBubble) {
                botMessage.textContent = randomMsg;
                botBubble.classList.add('annoying');
                setTimeout(() => botBubble.classList.remove('annoying'), 3000);
            }
        }
        if (playerTurnSeconds === 15 && isBotMode() && currentPlayer === humanPiece) {
            const messages = [
                'Trá»i Æ¡i 15 giĂ¢y rá»“i! TĂ´i chá» mĂ  sáº¯p tĂ¨ ra quáº§n rá»“i đŸ˜¤',
                'Cháº­m nhÆ° rĂ¹a! RĂ¹a cĂ²n Ä‘ang cÆ°á»i báº¡n kĂ¬a đŸ¢đŸ˜‚',
                'OK tĂ´i Ä‘i pha cĂ  phĂª Ä‘Ă¢y, xong vá» cĂ²n chÆ°a Ä‘i thĂ¬ thĂ´i â˜•',
                '15 giĂ¢y... TĂ´i Ä‘Ă£ nghÄ© xong 5 nÆ°á»›c tiáº¿p theo rá»“i Ä‘áº¥y đŸ˜',
                'Báº¡n Ä‘ang thiá»n Ă ? Thiá»n bĂ n cá» kiá»ƒu má»›i? đŸ§˜',
                'NÆ°á»›c cá» khĂ´ng pháº£i rÆ°á»£u, ngĂ¢m lĂ¢u khĂ´ng ngon hÆ¡n Ä‘Ă¢u! đŸ·',
            ];
            // CHáº¶N Lá»œI THOáº I: Náº¿u chÆ¡i Online thĂ¬ khĂ´ng cho xuáº¥t chá»¯ ra khung chat ná»¯a
            if (window.isOnlineModeActive && window.isOnlineModeActive()) {
                return; 
            }

            const randomMsg = messages[Math.floor(Math.random() * messages.length)];
            const botMessage = document.getElementById('bot-message');
            const botBubble  = document.getElementById('bot-bubble');
            if (botMessage && botBubble) {
                botMessage.textContent = randomMsg;
                botBubble.classList.add('annoying');
                setTimeout(() => botBubble.classList.remove('annoying'), 4000);
            }
        }
        if (playerTurnSeconds === 25 && isBotMode() && currentPlayer === humanPiece) {
            const messages = [
                'Æ  báº¡n váº«n cĂ²n Ä‘Ă¢y khĂ´ng?? TĂ´i tÆ°á»Ÿng báº¡n Ä‘Ă£ ngá»§ rá»“i đŸ˜‚',
                '25 giĂ¢y! Ká»· lá»¥c cháº§n chá»« má»›i! đŸ†',
                'Báº¡n Ä‘ang nhá» ChatGPT tĂ­nh nÆ°á»›c Ă ? Gian láº­n Ä‘áº¥y nhĂ© đŸ˜’',
                'ThĂ´i Ä‘Æ°á»£c rá»“i, tĂ´i sáº½ dĂ¹ng thá»i gian nĂ y há»c thĂªm 1 pattern má»›i đŸ§ ',
                'Cá»© tá»« tá»« Ä‘i, tĂ´i khĂ´ng Ä‘i Ä‘Ă¢u cáº£... ngoáº¡i trá»« lĂªn bá»¥c chiáº¿n tháº¯ng đŸ˜ˆ',
                'OK OK tĂ´i hiá»ƒu rá»“i, báº¡n Ä‘ang cá»‘ lĂ m tĂ´i máº¥t táº­p trung pháº£i khĂ´ng đŸ¤”',
            ];
            // CHáº¶N Lá»œI THOáº I: Náº¿u chÆ¡i Online thĂ¬ khĂ´ng cho xuáº¥t chá»¯ ra khung chat ná»¯a
            if (window.isOnlineModeActive && window.isOnlineModeActive()) {
                return; 
            }

            const randomMsg = messages[Math.floor(Math.random() * messages.length)];
            const botMessage = document.getElementById('bot-message');
            const botBubble  = document.getElementById('bot-bubble');
            if (botMessage && botBubble) {
                botMessage.textContent = randomMsg;
                botBubble.classList.add('annoying');
                setTimeout(() => botBubble.classList.remove('annoying'), 5000);
            }
        }
        if (playerTurnSeconds === 40 && isBotMode() && currentPlayer === humanPiece) {
            const messages = [
                '40 GIĂ‚Y!! Báº¡n á»•n khĂ´ng? Cáº§n gá»i cáº¥p cá»©u khĂ´ng? đŸ‘',
                'TĂ´i Ä‘Ă£ ngá»§ má»™t giáº¥c ngáº¯n rá»“i thá»©c dáº­y mĂ  báº¡n váº«n chÆ°a Ä‘i đŸ˜´',
                'Ká»· lá»¥c tháº¿ giá»›i vá» Ä‘á»©ng im nhĂ¬n bĂ n cá» Ä‘Ă¢y rá»“i đŸŒ',
                'Bao lĂ¢u ná»¯a? TĂ´i Ä‘áº·t háº¹n cáº¯t tĂ³c chiá»u nay rá»“i đŸ’ˆ',
                'ThĂ´i Ä‘Æ°á»£c, tĂ´i sáº½ tweet vá» tráº­n nĂ y: "Äá»‘i thá»§ Ä‘ang thiá»n Ä‘á»‹nh" đŸ¦',
            ];
            // CHáº¶N Lá»œI THOáº I: Náº¿u chÆ¡i Online thĂ¬ khĂ´ng cho xuáº¥t chá»¯ ra khung chat ná»¯a
            if (window.isOnlineModeActive && window.isOnlineModeActive()) {
                return; 
            }

            const randomMsg = messages[Math.floor(Math.random() * messages.length)];
            const botMessage = document.getElementById('bot-message');
            const botBubble  = document.getElementById('bot-bubble');
            if (botMessage && botBubble) {
                botMessage.textContent = randomMsg;
                botBubble.classList.add('annoying');
                setTimeout(() => botBubble.classList.remove('annoying'), 5000);
            }
        }
    }, 1000);
}

// ===== INIT GAME =====
function initGame() {
    // Cháº·n restart khi Ä‘ang chÆ¡i online
    if (window.isOnlineModeActive && window.isOnlineModeActive()) {
        alert("Báº¡n Ä‘ang trong tráº­n Ä‘áº¥u Online, khĂ´ng thá»ƒ tá»± lĂ m má»›i vĂ¡n cá»!");
        return;
    }
    
    isInfinite = true;
    gameMode   = modeSelect.value;

    const winSelect = document.getElementById('win-count');
    winCount = parseInt(winSelect.value);
    if (winCount < 3) winCount = 3;

    isSolo = gameMode === 'solo';
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

    infiniteMap = new Map();
    // Äá»“ng bá»™ vá»›i GameState
    if (typeof GameState !== 'undefined' && GameState.board) {
        GameState.board.infiniteMap = infiniteMap;
        GameState.board.isInfinite = true;
    }
    // KHĂ”NG reset infCanvas vá» null khi Ä‘ang á»Ÿ online mode (sáº½ phĂ¡ há»§y canvas Ä‘ang dĂ¹ng)
    if (!window.isOnlineModeActive || !window.isOnlineModeActive()) {
        infCanvas   = null;
        infCanvasInitialized = false;
    }
    vRowF = 0; vColF = 0;
    infHoverR = null; infHoverC = null;

    zobristHash = 0;

    // Sá»­ dá»¥ng requestAnimationFrame Ä‘á»ƒ render mÆ°á»£t hÆ¡n
    requestAnimationFrame(() => {
        renderInfiniteBoard();
        updateStatus();

        if (isGameActive && !isSolo && isBotMode() && currentPlayer === botPiece) {
            const thinkTime = gameMode === 'ai-god' || gameMode === 'bot-toi-thuong' ? 500 :
                            gameMode === 'bot-tia-chop' ? 200 :
                            gameMode === 'ai-hard' ? 300 : 180;
            statusPanel.innerHTML = `đŸ¤– <span style="opacity:0.7">Äang tĂ­nh toĂ¡n</span> <span class="think-dots">...</span>`;
            setTimeout(makeAIMove, thinkTime);
        }
    });
}

// ===== STATUS =====
function updateStatus() {
    if (!isGameActive) return;
    if (isBotMode() && currentPlayer === botPiece) {
        statusPanel.innerHTML = `đŸ¤– SiĂªu NĂ£o AI Ä‘ang phong tá»a cĂ¡c hÆ°á»›ng Ä‘i...`;
    } else {
        statusPanel.innerHTML = `LÆ°á»£t cá»§a báº¡n: <span class="turn-${currentPlayer}">${currentPlayer}</span>`;
    }
}

// ===== MAKE MOVE =====
function makeMove(r, c) {
    console.log('[DEBUG-BOARD] makeMove called:', {
        r, c,
        isGameActive,
        currentPlayer,
        gameMode,
        isOnlineMode: window.isOnlineModeActive ? window.isOnlineModeActive() : false,
        myOnlineRole: window.myOnlineRole,
        currentTurn: typeof currentTurn !== 'undefined' ? currentTurn : 'undefined'
    });

    // Náº¾U ÄANG CHÆ I ONLINE
    if (window.isOnlineModeActive && window.isOnlineModeActive()) {
        // Chá»‰ cho gá»­i má»™t nÆ°á»›c Ä‘i táº¡i má»™t thá»i Ä‘iá»ƒm. Náº¿u khĂ´ng, ngÆ°á»i chÆ¡i cĂ³
        // thá»ƒ click nhanh nhiá»u Ă´ trÆ°á»›c khi Firebase pháº£n há»“i vĂ  lĂ m lá»‡ch bĂ n cá» local.
        if (window.onlineMovePending) {
            console.warn('[DEBUG-BOARD] makeMove blocked: onlineMovePending is true');
            return;
        }
        const quanToi = window.myOnlineRole;

        // Cháº·n: viewer hoáº·c chÆ°a cĂ³ gháº¿ thĂ¬ khĂ´ng Ä‘Æ°á»£c Ä‘Ă¡nh
        if (!quanToi || quanToi === 'viewer') {
            console.warn('[DEBUG-BOARD] makeMove blocked: role=', quanToi);
            return;
        }

        // Cháº·n: khĂ´ng pháº£i lÆ°á»£t mĂ¬nh thĂ¬ khĂ´ng Ä‘Æ°á»£c Ä‘Ă¡nh
        if (typeof currentTurn !== 'undefined' && currentTurn !== quanToi) {
            console.warn('[DEBUG-BOARD] makeMove blocked: currentTurn=', currentTurn, 'myRole=', quanToi);
            return;
        }

        // Váº½ quĂ¢n lĂªn bĂ n trÆ°á»›c (optimistic update)
        moveCount++;
        setCell(r, c, quanToi);
        moveHistory.push({ r, c, player: quanToi });
        
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

        // Gá»­i lĂªn Firebase SAU KHI Ä‘Ă£ setCell (Ä‘á»ƒ kiá»ƒm tra tháº¯ng Ä‘á»c Ä‘Ăºng board).
        // Káº¿t quáº£ tháº¯ng chá»‰ Ä‘Æ°á»£c chá»‘t sau khi transaction Ä‘Æ°á»£c Firebase xĂ¡c nháº­n.
        const isWinningMove = checkWin(r, c);
        if (window.guiNuocDiLenFirebase) {
            window.onlineMovePending = true;
            Promise.resolve(window.guiNuocDiLenFirebase(r, c))
                .then(hopLe => {
                    if (hopLe) {
                        if (isWinningMove) {
                            isGameActive = false;
                            statusPanel.innerHTML = `đŸ† <strong>${quanToi}</strong> chiáº¿n tháº¯ng!`;
                            if (gameTotalTimer) clearInterval(gameTotalTimer);
                            if (playerTurnTimer) clearInterval(playerTurnTimer);
                        }
                        return;
                    }

                    // Firebase tá»« chá»‘i nÆ°á»›c Ä‘i (sai lÆ°á»£t/Ă´ Ä‘Ă£ cĂ³ quĂ¢n/káº¿t ná»‘i lá»—i).
                    // HoĂ n tĂ¡c nÆ°á»›c optimistic Ä‘á»ƒ bĂ n cá» local luĂ´n khá»›p server.
                    setCell(r, c, '');
                    moveHistory.pop();
                    moveCount--;
                    if (isInfinite) renderInfiniteBoard();
                    else {
                        const rollbackCell = document.querySelector(`[data-row='${r}'][data-col='${c}']`);
                        if (rollbackCell) rollbackCell.classList.remove(quanToi, 'last-move');
                    }
                })
                .catch(() => {
                    setCell(r, c, '');
                    moveHistory.pop();
                    moveCount--;
                    if (isInfinite) renderInfiniteBoard();
                })
                .finally(() => { window.onlineMovePending = false; });
        }

        // NÆ°á»›c tháº¯ng chá» Firebase xĂ¡c nháº­n; trĂ¡nh hiá»ƒn thá»‹ tháº¯ng giáº£ khi transaction bá»‹ tá»« chá»‘i.
        if (isWinningMove) return;

        // Chuyá»ƒn lÆ°á»£t local (Firebase sáº½ sync láº¡i Ä‘Ăºng)
        currentPlayer = quanToi === 'X' ? 'O' : 'X';
        updateCursorByTurn();
        updateStatus();
        return;
    }
    // --- GIá»® NGUYĂN LOGIC Äáº¤U BOT Tá»° Äá»˜NG CÅ¨ Cá»¦A ANH á» DÆ¯á»I ÄĂ‚Y ---
    
    moveCount++;
    setCell(r, c, currentPlayer);
    moveHistory.push({ r, c, player: currentPlayer });

    // Invalidate neural cache khi board state thay Ä‘á»•i
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
        const boardLabel = 'â™¾ï¸ VĂ´ Háº¡n';

        // LÆ°u káº¿t quáº£ cho autoplay
        if (typeof autoplayLastWinner !== 'undefined') {
            autoplayLastWinner = currentPlayer;
        }

        // Náº¿u Ä‘ang autoplay thĂ¬ bá» qua pháº§n UI popup
        if (isAutoplayRunning) {
            // autoplayLastWinner Ä‘Ă£ Ä‘Æ°á»£c set á»Ÿ trĂªn
            // KHĂ”NG gá»i onBotLoss á»Ÿ Ä‘Ă¢y â€” autoplayMove sáº½ xá»­ lĂ½ learning sau vĂ¡n
            return;
        }

        if (gameMode === 'solo') {
            statusPanel.innerHTML = `đŸ† NgÆ°á»i <strong>${currentPlayer}</strong> chiáº¿n tháº¯ng!`;
            recordMatch('win', currentPlayer);
            setTimeout(() => {
                showWinOverlay(currentPlayer, false, '', '');
                if (gameTotalTimer) clearInterval(gameTotalTimer);
                if (playerTurnTimer) clearInterval(playerTurnTimer);
                const timerPanel = document.getElementById('timer-panel');
                if (timerPanel) timerPanel.style.display = 'none';
                setTimeout(() => promptRankName(moveCount, gameMode, winCount, boardLabel, `NgÆ°á»i ${currentPlayer}`, playerDangerScore, gameTotalSeconds), 600);
            }, 500);
        } else {
            if (isBotWin) {
                let tauntMessage = '', tauntEmoji = '';
                if (lossStreak === 2) {
                    const t = ['Thua 2 vĂ¡n rá»“i! Cáº§n luyá»‡n thĂªm nhĂ©! đŸ˜…','2 vĂ¡n liĂªn tiáº¿p! Báº¡n Ä‘ang gáº·p khĂ³ khÄƒn Ä‘áº¥y! đŸ¤”','Thua 2 láº§n! Äá»«ng náº£n, cá»‘ lĂªn! đŸ˜'];
                    tauntMessage = t[Math.floor(Math.random() * t.length)]; tauntEmoji = 'đŸ˜…';
                } else if (lossStreak === 3) {
                    const t = ['3 vĂ¡n liĂªn tiáº¿p! Gá»«ng cĂ ng giĂ  cĂ ng cay! đŸ”¥','Thua 3 vĂ¡n! BOT Ä‘ang lĂªn hÆ°Æ¡ng Ä‘áº¥y! đŸ˜','3 láº§n thua! Báº¡n cĂ³ muá»‘n thá»­ cháº¿ Ä‘á»™ Dá»… khĂ´ng? đŸ¤­'];
                    tauntMessage = t[Math.floor(Math.random() * t.length)]; tauntEmoji = 'đŸ˜';
                } else if (lossStreak >= 4) {
                    const t = [
                        `${lossStreak} vĂ¡n liĂªn tiáº¿p! Báº¡n Ä‘ang táº¡o ká»· lá»¥c Ä‘áº¥y! đŸ†`,
                        `Thua ${lossStreak} vĂ¡n! BOT Tá»I THÆ¯á»¢NG khĂ´ng thá»ƒ bá»‹ Ä‘Ă¡nh báº¡i! đŸ’€`,
                        `${lossStreak} láº§n! CĂ³ láº½ nĂªn nghá»‰ ngÆ¡i má»™t chĂºt? đŸ˜‚`,
                        `Ká»· lá»¥c ${lossStreak} vĂ¡n! Báº¡n ráº¥t kiĂªn trĂ¬! đŸ–ï¸`,
                        `${lossStreak} vĂ¡n thua! BOT cáº£m tháº¥y báº¥t lá»±c... vĂ¬ báº¡n quĂ¡ yáº¿u! đŸ˜œ`
                    ];
                    tauntMessage = t[Math.floor(Math.random() * t.length)]; tauntEmoji = 'đŸ’€';
                } else {
                    tauntMessage = 'Gá»«ng cĂ ng giĂ  cĂ ng cay â€” bĂ³ tay thĂ¬ gáº·p anh Cháº§n!'; tauntEmoji = 'đŸ’€';
                }
                statusPanel.innerHTML = `đŸ’€ BOT Tá»I THÆ¯á»¢NG ÄĂƒ THáº®NG! ${tauntMessage}`;
                recordMatch('lose', botPiece);
                // Bot tháº¯ng â†’ nhá»› pattern tháº¯ng Ä‘á»ƒ láº·p láº¡i
                if (typeof onBotWin === 'function') {
                    onBotWin([...moveHistory], botPiece);
                }
                // Bot cÅ©ng há»c pattern cá»§a ngÆ°á»i tháº¯ng Ä‘á»ƒ trĂ¡nh bá»‹ Ä‘Ă¡nh báº¡i tÆ°Æ¡ng tá»±
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
                statusPanel.innerHTML = `đŸ† KINH ÄIá»‚M! Báº¡n Ä‘Ă£ chiáº¿n tháº¯ng BOT cá»§a PRO PRO, báº¡n ráº¥t lĂ  kinh, bĂ¡i phá»¥c`;
                recordMatch('win', humanPiece);
                // Cáº­p nháº­t thá»‘ng kĂª winBot cho user náº¿u Ä‘Ă£ Ä‘Äƒng nháº­p - chá»‰ tĂ­nh khi winCount >= 5
                if (typeof window.updateUserStats === 'function' && winCount >= 5) {
                    window.updateUserStats('winBot', 1);
                } else if (winCount < 5) {
                    console.log("Tráº­n tháº¯ng Bot á»Ÿ cháº¿ Ä‘á»™ dÆ°á»›i 5 quĂ¢n khĂ´ng Ä‘Æ°á»£c tĂ­nh vĂ o Ä‘iá»ƒm Rank!");
                }
                // Cá»™ng Xu khi tháº¯ng bot (cĂ³ giá»›i háº¡n ngĂ y)
                if (typeof window.onWinBotXu === 'function') {
                    window.onWinBotXu(gameMode);
                }
                // NgÆ°á»i tháº¯ng â†’ bot há»c pattern cá»§a ngÆ°á»i tháº¯ng Ä‘á»ƒ trĂ¡nh bá»‹ Ä‘Ă¡nh báº¡i tÆ°Æ¡ng tá»±
                if (typeof onBotLoss === 'function') {
                    onBotLoss([...moveHistory], humanPiece);
                }
                setTimeout(() => {
                    if (gameTotalTimer) clearInterval(gameTotalTimer);
                    if (playerTurnTimer) clearInterval(playerTurnTimer);
                    const timerPanel = document.getElementById('timer-panel');
                    if (timerPanel) timerPanel.style.display = 'none';
                    promptRankName(moveCount, gameMode, winCount, boardLabel, `NgÆ°á»i tháº¯ng Bot ${MODE_LABELS[gameMode]}`, playerDangerScore, gameTotalSeconds);
                    setTimeout(() => showWinOverlay(humanPiece, false, '', ''), 100);
                }, 500);
            }
        }
        return;
    }

    currentPlayer = currentPlayer === "X" ? "O" : "X";
    updateCursorByTurn();

    if (isBotMode() && !isBotMove) evaluatePlayerMove(r, c);
    if (isGameActive && isBotMode() && currentPlayer === humanPiece) startPlayerTurnTimer();

    updateStatus();
    if (isGameActive && isBotMode() && currentPlayer === botPiece) {
        const thinkTime = gameMode === 'ai-god' || gameMode === 'bot-toi-thuong' ? 500 :
                        gameMode === 'bot-tia-chop' ? 200 :
                        gameMode === 'ai-hard' ? 300 : 180;
        statusPanel.innerHTML = `đŸ¤– <span style="opacity:0.7">Äang tĂ­nh toĂ¡n</span> <span class="think-dots">...</span>`;
        setTimeout(makeAIMove, thinkTime);
    }
}

// ===== CHECK WIN =====
function checkWin(r, c) {
    const directions = [{ dr:0,dc:1 },{ dr:1,dc:0 },{ dr:1,dc:1 },{ dr:1,dc:-1 }];
    const player = getCell(r, c);
    const opp    = player === "X" ? "O" : "X";
    // Online pháº£i tuĂ¢n theo luáº­t Ä‘Ă£ lÆ°u trong phĂ²ng, khĂ´ng dĂ¹ng checkbox local.
    const isOnline = window.isOnlineModeActive && window.isOnlineModeActive();
    const blockBothEndsEnabled = isOnline
        ? (typeof currentRule !== 'undefined' && currentRule === 'chan_2_dau')
        : !!document.getElementById('block-both-ends')?.checked;

    for (let { dr, dc } of directions) {
        const cells = [[r, c]];
        let fwd = 0, bwd = 0;
        while (getCell(r+dr*(fwd+1), c+dc*(fwd+1)) === player) { fwd++; cells.push([r+dr*fwd, c+dc*fwd]); }
        while (getCell(r-dr*(bwd+1), c-dc*(bwd+1)) === player) { bwd++; cells.push([r-dr*bwd, c-dc*bwd]); }
        if (cells.length < winCount) continue;

        if (blockBothEndsEnabled) {
            let headBlocked = false, headDist = 1;
            while (!headBlocked && headDist <= 50) {
                const val = getCell(r + dr*(fwd+headDist), c + dc*(fwd+headDist));
                if (val === opp) { headBlocked = true; break; }
                if (val === player) break;
                headDist++;
            }
            let tailBlocked = false, tailDist = 1;
            while (!tailBlocked && tailDist <= 50) {
                const val = getCell(r - dr*(bwd+tailDist), c - dc*(tailDist+bwd));
                if (val === opp) { tailBlocked = true; break; }
                if (val === player) break;
                tailDist++;
            }
            if (headBlocked && tailBlocked) continue;
        }
        highlightWinners(cells);
        return true;
    }
    return false;
}

// checkWinSilent: dĂ¹ng cho AI
function checkWinSilent(r, c) {
    const player = getCell(r, c);
    const opp    = player === "X" ? "O" : "X";
    const blockBothEndsEnabled = document.getElementById('block-both-ends').checked;

    for (let { dr, dc } of DIRECTIONS) {
        let fwd = 0, bwd = 0;
        while (getCell(r+dr*(fwd+1), c+dc*(fwd+1)) === player) fwd++;
        while (getCell(r-dr*(bwd+1), c-dc*(bwd+1)) === player) bwd++;
        const count = 1 + fwd + bwd;
        if (count < winCount) continue;

        if (blockBothEndsEnabled) {
            let headBlocked = false, headDist = 1;
            while (!headBlocked && headDist <= 50) {
                const val = getCell(r + dr*(fwd+headDist), c + dc*(fwd+headDist));
                if (val === opp) { headBlocked = true; break; }
                if (val === player) break;
                headDist++;
            }
            let tailBlocked = false, tailDist = 1;
            while (!tailBlocked && tailDist <= 50) {
                const val = getCell(r - dr*(bwd+tailDist), c - dc*(tailDist+bwd));
                if (val === opp) { tailBlocked = true; break; }
                if (val === player) break;
                tailDist++;
            }
            if (headBlocked && tailBlocked) continue;
        }
        return true;
    }
    return false;
}

// Äá»NH NGHÄ¨A HĂ€M XĂ“A Sáº CH BĂ€N Cá»œ CHO VĂN Má»I TINH
window.xoaBanCoCu = function() {
    // Online mode luĂ´n dĂ¹ng infinite canvas â€” Ä‘áº£m báº£o flag Ä‘Ăºng
    if (window.isOnlineModeActive && window.isOnlineModeActive()) {
        isInfinite = true;
    }
    // Reset máº£ng dá»¯ liá»‡u logic cá»
    if (typeof infiniteMap !== 'undefined') infiniteMap.clear();
    if (typeof moveHistory !== 'undefined') moveHistory.length = 0;
    if (typeof lastMoveR   !== 'undefined') { lastMoveR = null; lastMoveC = null; }
    if (typeof currentPlayer !== 'undefined') currentPlayer = 'X';
    if (typeof winningCellCoords !== 'undefined') winningCellCoords.length = 0;
    if (typeof isGameActive !== 'undefined') isGameActive = true;
    // Reset hover Ä‘á»ƒ khĂ´ng cĂ²n cháº¥m xanh
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

// checkWinLogicOld: HĂ m kiá»ƒm tra tháº¯ng thua há»— trá»£ cáº£ Online vĂ  Offline vá»›i tham sá»‘ luáº­t chÆ¡i tĂ¹y chá»‰nh
window.checkWinLogicOld = function(row, col, playerRole, customRule, customWinCount) {
    const directions = [{ dr:0,dc:1 },{ dr:1,dc:0 },{ dr:1,dc:1 },{ dr:1,dc:-1 }];
    const player = playerRole || getCell(row, col);
    const opp    = player === "X" ? "O" : "X";
    
    // 1. XĂ¡c Ä‘á»‹nh luáº­t chÆ¡i Ä‘ang Ă¡p dá»¥ng
    let blockBothEndsEnabled = false;
    let currentWinCount = winCount; // Máº·c Ä‘á»‹nh dĂ¹ng biáº¿n global
    
    if (window.isOnlineModeActive && window.isOnlineModeActive()) {
        // Náº¿u Ä‘ang chÆ¡i Online: Láº¥y luáº­t tá»« Firebase truyá»n sang
        blockBothEndsEnabled = (customRule === 'chan_2_dau');
        if (customWinCount) currentWinCount = customWinCount;
    } else {
        // Náº¿u Ä‘ang Ä‘áº¥u Bot: Láº¥y luáº­t tá»« Ă´ Checkbox trĂªn giao diá»‡n cÅ© cá»§a anh
        const checkboxCu = document.getElementById('block-both-ends');
        blockBothEndsEnabled = checkboxCu ? checkboxCu.checked : false;
    }

    for (let { dr, dc } of directions) {
        const cells = [[row, col]];
        let fwd = 0, bwd = 0;
        while (getCell(row+dr*(fwd+1), col+dc*(fwd+1)) === player) { fwd++; cells.push([row+dr*fwd, col+dc*fwd]); }
        while (getCell(row-dr*(bwd+1), col-dc*(bwd+1)) === player) { bwd++; cells.push([row-dr*bwd, col-dc*bwd]); }
        if (cells.length < currentWinCount) continue;

        if (blockBothEndsEnabled) {
            let headBlocked = false, headDist = 1;
            while (!headBlocked && headDist <= 50) {
                const val = getCell(row + dr*(fwd+headDist), col + dc*(fwd+headDist));
                if (val === opp) { headBlocked = true; break; }
                if (val === player) break;
                headDist++;
            }
            let tailBlocked = false, tailDist = 1;
            while (!tailBlocked && tailDist <= 50) {
                const val = getCell(row - dr*(bwd+tailDist), col - dc*(tailDist+bwd));
                if (val === opp) { tailBlocked = true; break; }
                if (val === player) break;
                tailDist++;
            }
            if (headBlocked && tailBlocked) continue;
        }
        highlightWinners(cells);
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
    // NÆ°á»›c Ä‘i Ä‘áº§u tiĂªn - má»Ÿ rá»™ng vá»›i diagonal vĂ  indirect openings
    start: [
        { moves: [], move: [0, 0], weight: 10 },        // Center (tá»‘t nháº¥t)
        { moves: [], move: [-2, -2], weight: 3 },      // Diagonal opening
        { moves: [], move: [2, 2], weight: 3 },
        { moves: [], move: [-2, 2], weight: 3 },
        { moves: [], move: [2, -2], weight: 3 },
        { moves: [], move: [-3, 0], weight: 2 },        // Indirect opening
        { moves: [], move: [3, 0], weight: 2 },
        { moves: [], move: [0, -3], weight: 2 },
        { moves: [], move: [0, 3], weight: 2 },
    ],
    // Response khi Ä‘á»‘i thá»§ Ä‘i trung tĂ¢m
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
    // Response khi Ä‘á»‘i thá»§ Ä‘i diagonal
    diagonalResponse: (() => {
        return [
            { pattern: 'diagonal', move: [0, 0], weight: 10 },       // Cháº·n trung tĂ¢m
            { pattern: 'diagonal', move: [-1, 1], weight: 8 },       // Counter diagonal
            { pattern: 'diagonal', move: [1, -1], weight: 8 },
            { pattern: 'diagonal', move: [-2, 0], weight: 5 },        // Indirect
            { pattern: 'diagonal', move: [2, 0], weight: 5 },
            { pattern: 'diagonal', move: [0, -2], weight: 5 },
            { pattern: 'diagonal', move: [0, 2], weight: 5 },
        ];
    })(),
    // Response khi Ä‘á»‘i thá»§ Ä‘i indirect
    indirectResponse: (() => {
        return [
            { pattern: 'indirect', move: [0, 0], weight: 10 },       // Láº¥y trung tĂ¢m
            { pattern: 'indirect', move: [-1, -1], weight: 8 },      // Táº¡o diagonal
            { pattern: 'indirect', move: [-1, 1], weight: 8 },
            { pattern: 'indirect', move: [1, -1], weight: 8 },
            { pattern: 'indirect', move: [1, 1], weight: 8 },
            { pattern: 'indirect', move: [-2, -1], weight: 5 },      // Káº¿t ná»‘i
            { pattern: 'indirect', move: [-2, 1], weight: 5 },
            { pattern: 'indirect', move: [2, -1], weight: 5 },
            { pattern: 'indirect', move: [2, 1], weight: 5 },
        ];
    })()
};

function getOpeningMove() {
    const cnt = isInfinite ? infiniteMap.size : boardState.flat().filter(x => x !== "").length;
    if (cnt > 6) return null; // Má»Ÿ rá»™ng tá»« 4 lĂªn 6 nÆ°á»›c
    
    let book = null;
    
    if (cnt === 0) {
        // NÆ°á»›c Ä‘i Ä‘áº§u tiĂªn
        book = openingBook.start;
    } else if (cnt === 1) {
        // Pháº£n há»“i nÆ°á»›c Ä‘i Ä‘áº§u tiĂªn cá»§a Ä‘á»‘i thá»§
        const lastMove = moveHistory[moveHistory.length - 1];
        if (!lastMove) return null;
        
        const [lr, lc] = [lastMove.r, lastMove.c];
        
        // PhĂ¢n tĂ­ch kiá»ƒu opening cá»§a Ä‘á»‘i thá»§
        if (lr === 0 && lc === 0) {
            // Äá»‘i thá»§ Ä‘i trung tĂ¢m
            book = openingBook.centerResponse;
        } else if (Math.abs(lr) === Math.abs(lc)) {
            // Äá»‘i thá»§ Ä‘i diagonal
            book = openingBook.diagonalResponse;
        } else {
            // Äá»‘i thá»§ Ä‘i indirect
            book = openingBook.indirectResponse;
        }
    } else {
        // CĂ¡c nÆ°á»›c tiáº¿p theo - dĂ¹ng response tÆ°Æ¡ng á»©ng
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
