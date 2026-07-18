// ===== LOGIC GAME - initGame, makeMove, checkWin, timer =====
// boardElement, statusPanel, modeSelect được khai báo trong index.html sau khi DOM sẵn sàng

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

        if (playerTurnSeconds === 10 && gameMode.startsWith('ai') && currentPlayer === humanPiece) {
            const messages = [
                'lâu thế , nhanh tôi còn đi đái',
                'Nhanh lên nào, nghĩ lâu thế!',
                'Tôi đang chờ đấy...',
                'Đi đi, đừng để tôi chờ!'
            ];
            const randomMsg = messages[Math.floor(Math.random() * messages.length)];
            const botMessage = document.getElementById('bot-message');
            const botBubble  = document.getElementById('bot-bubble');
            if (botMessage && botBubble) {
                botMessage.textContent = randomMsg;
                botBubble.classList.add('annoying');
                setTimeout(() => botBubble.classList.remove('annoying'), 3000);
            }
        }
        if (playerTurnSeconds === 15 && gameMode.startsWith('ai') && currentPlayer === humanPiece) {
            const botMessage = document.getElementById('bot-message');
            const botBubble  = document.getElementById('bot-bubble');
            if (botMessage && botBubble) {
                botMessage.textContent = 'quá lâu cho đội bạn , tôi chờ mà sắp tè ra quần rồi 😤';
                botBubble.classList.add('annoying');
                setTimeout(() => botBubble.classList.remove('annoying'), 3000);
            }
        }
    }, 1000);
}

// ===== INIT GAME =====
function initGame() {
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
    infCanvas   = null;
    vRowF = 0; vColF = 0;
    infHoverR = null; infHoverC = null;

    zobristHash = 0;

    renderInfiniteBoard();
    updateStatus();

    if (isGameActive && !isSolo && gameMode.startsWith('ai') && currentPlayer === botPiece) {
        const thinkTime = gameMode === 'ai-god' ? 500 : gameMode === 'ai-hard' ? 300 : 180;
        statusPanel.innerHTML = `🤖 <span style="opacity:0.7">Đang tính toán</span> <span class="think-dots">...</span>`;
        setTimeout(makeAIMove, thinkTime);
    }
}

// ===== STATUS =====
function updateStatus() {
    if (!isGameActive) return;
    if (gameMode.startsWith('ai') && currentPlayer === botPiece) {
        statusPanel.innerHTML = `🤖 Siêu Não AI đang phong tỏa các hướng đi...`;
    } else {
        statusPanel.innerHTML = `Lượt của bạn: <span class="turn-${currentPlayer}">${currentPlayer}</span>`;
    }
}

// ===== MAKE MOVE =====
function makeMove(r, c) {
    moveCount++;
    setCell(r, c, currentPlayer);
    moveHistory.push({ r, c, player: currentPlayer });

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
        const isBotWin   = gameMode.startsWith('ai') && currentPlayer === botPiece;
        const boardLabel = '♾️ Vô Hạn';

        if (gameMode.startsWith('ai') && moveHistory.length > 0) {
            const winner = currentPlayer;
            const loser  = winner === 'X' ? 'O' : 'X';
            console.log(`🎮 Game ended: ${winner} won against ${loser}`);
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
                // Bot thua → học kinh nghiệm từ nước đi của người thắng
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

    if (gameMode.startsWith('ai') && !isBotMove) evaluatePlayerMove(r, c);
    if (isGameActive && gameMode.startsWith('ai') && currentPlayer === humanPiece) startPlayerTurnTimer();

    updateStatus();
    if (isGameActive && gameMode.startsWith('ai') && currentPlayer === botPiece) {
        const thinkTime = gameMode === 'ai-god' ? 500 : gameMode === 'ai-hard' ? 300 : 180;
        statusPanel.innerHTML = `🤖 <span style="opacity:0.7">Đang tính toán</span> <span class="think-dots">...</span>`;
        setTimeout(makeAIMove, thinkTime);
    }
}

// ===== CHECK WIN =====
function checkWin(r, c) {
    const directions = [{ dr:0,dc:1 },{ dr:1,dc:0 },{ dr:1,dc:1 },{ dr:1,dc:-1 }];
    const player = getCell(r, c);
    const opp    = player === "X" ? "O" : "X";
    const blockBothEndsEnabled = document.getElementById('block-both-ends').checked;

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

// checkWinSilent: dùng cho AI
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

function highlightWinners(winningCells) {
    if (isInfinite) winningCellCoords = winningCells.slice();
    winningCells.forEach(([r, c]) => {
        const cell = document.querySelector(`[data-row='${r}'][data-col='${c}']`);
        if (cell) cell.classList.add('winning-cell');
    });
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
    start: [{ moves: [], move: [0, 0], weight: 10 }],
    center: (() => {
        const mid = 0; // bàn vô hạn dùng origin
        return [
            { moves: [[mid,mid]], move: [mid-1, mid-1], weight: 8 },
            { moves: [[mid,mid]], move: [mid-1, mid+1], weight: 8 },
            { moves: [[mid,mid]], move: [mid+1, mid-1], weight: 8 },
            { moves: [[mid,mid]], move: [mid+1, mid+1], weight: 8 },
            { moves: [[mid,mid]], move: [mid-2, mid],   weight: 4 },
            { moves: [[mid,mid]], move: [mid+2, mid],   weight: 4 },
            { moves: [[mid,mid]], move: [mid, mid-2],   weight: 4 },
            { moves: [[mid,mid]], move: [mid, mid+2],   weight: 4 },
        ];
    })()
};

function getOpeningMove() {
    const cnt = isInfinite ? infiniteMap.size : boardState.flat().filter(x => x !== "").length;
    if (cnt > 4) return null;
    const book = cnt === 0 ? openingBook.start : openingBook.center;
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
