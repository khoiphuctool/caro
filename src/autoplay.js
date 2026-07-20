// ===== AUTOPLAY - Chế độ huấn luyện Bot =====

let autoplayInterval       = null;
let autoplayGamesRemaining = 0;
let autoplayGamesTotal     = 0;  // tổng số ván được chọn
let autoplayWins           = 0;
let autoplayLosses         = 0;
let autoplayDraws          = 0;
let trainingBotXMode       = 'ai-medium';  // Bot X (đi trước) - level (mặc định medium)
let trainingBotOMode       = 'ai-easy';    // Bot O (đi sau) - level (mặc định easy)
let learningEnabled        = true;          // Bật learning trong training
// isAutoplayRunning được khai báo var trong trang-thai.js

// ===== LOCK TRAINING UI =====
function lockTrainingUI(locked) {
    const controlsToLock = [
        'game-mode',
        'win-count',
        'block-both-ends',
        'player-piece',
        'first-move'
    ];

    for (const id of controlsToLock) {
        const element = document.getElementById(id);
        if (element) {
            element.disabled = locked;
            element.style.opacity = locked ? '0.5' : '1';
            element.style.cursor = locked ? 'not-allowed' : 'pointer';
        }
    }

    // Also lock training-specific controls
    const trainingControls = [
        'autoplay-games',
        'autoplay-win-count',
        'training-bot-x',
        'training-bot-o'
    ];

    for (const id of trainingControls) {
        const element = document.getElementById(id);
        if (element) {
            element.disabled = locked;
            element.style.opacity = locked ? '0.5' : '1';
            element.style.cursor = locked ? 'not-allowed' : 'pointer';
        }
    }
}

function startAutoplay() {
    if (isAutoplayRunning) return;

    const totalGames       = parseInt(document.getElementById('autoplay-games').value);
    const autoplayWinCount = parseInt(document.getElementById('autoplay-win-count').value);

    autoplayGamesRemaining = totalGames;
    autoplayGamesTotal     = totalGames;
    autoplayWins  = 0;
    autoplayLosses = 0;
    autoplayDraws  = 0;
    isAutoplayRunning = true;

    // Batch size = 10 ván để học thường xuyên hơn thay vì đợi hết toàn bộ
    // → pattern được lưu nhanh hơn, rollback ít ảnh hưởng hơn
    if (typeof BatchLearning !== 'undefined') {
        BatchLearning.config.batchSize = 10;
    }

    // Hiện progress bar
    const progressEl = document.getElementById('training-progress');
    if (progressEl) progressEl.style.display = 'flex';
    updateTrainingProgress();

    // Lock training configuration
    if (typeof GameState !== 'undefined') {
        GameState.training.isRunning = true;
        GameState.lockTraining();
    }

    document.getElementById('btn-autoplay').style.display      = 'none';
    document.getElementById('btn-stop-autoplay').style.display = 'inline-block';

    // Lock UI controls during training
    lockTrainingUI(true);

    // Đọc level bot từ UI (nếu có), nếu không dùng mặc định
    const botXSelect = document.getElementById('training-bot-x');
    const botOSelect = document.getElementById('training-bot-o');
    
    if (botXSelect) trainingBotXMode = botXSelect.value;
    if (botOSelect) trainingBotOMode = botOSelect.value;

    const originalWinCount = winCount;
    winCount = autoplayWinCount;

    statusPanel.innerHTML = `🎓 TRAINING: Bot ${trainingBotXMode.toUpperCase()} vs Bot ${trainingBotOMode.toUpperCase()} (0/${autoplayGamesTotal} ván, ${autoplayWinCount} quân thắng)`;
    runAutoplayGame(originalWinCount);
}

function stopAutoplay() {
    if (autoplayInterval) { clearTimeout(autoplayInterval); autoplayInterval = null; }
    isAutoplayRunning = false;

    // Ẩn progress bar
    const progressEl = document.getElementById('training-progress');
    if (progressEl) progressEl.style.display = 'none';

    // Unlock training configuration
    if (typeof GameState !== 'undefined') {
        GameState.training.isRunning = false;
        GameState.unlockTraining();
    }

    document.getElementById('btn-autoplay').style.display      = 'inline-block';
    document.getElementById('btn-stop-autoplay').style.display = 'none';

    // Unlock UI controls
    lockTrainingUI(false);

    const memoryStats = typeof getMemoryStats === 'function' ? getMemoryStats() : { patterns: 0, totalHits: 0 };
    const batchInfo = typeof BatchLearning !== 'undefined' ? BatchLearning.getStatus() : null;
    const eloStr = batchInfo ? ` | Elo: ${batchInfo.eloCurrentModel} (Best: ${batchInfo.eloBestModel})` : '';
    statusPanel.innerHTML = `🎓 TRAINING ĐÃ DỪNG | Thắng: ${autoplayWins} | Thua: ${autoplayLosses} | Hòa: ${autoplayDraws} | Pattern học: ${memoryStats.patterns}${eloStr}`;

    // Restore gameMode về giá trị từ UI
    gameMode = modeSelect.value;
    initGame();
    
    // Force render lại board sau khi initGame
    if (isInfinite && typeof renderInfiniteBoard === 'function') {
        renderInfiniteBoard();
    }
}

function runAutoplayGame(originalWinCount) {
    if (!isAutoplayRunning || autoplayGamesRemaining <= 0) { stopAutoplay(); return; }

    // Tạm set gameMode = 'solo' TRƯỚC khi initGame để tránh initGame kích hoạt makeAIMove
    const savedMode = modeSelect.value;
    modeSelect.value = 'solo';

    initGame();

    // Restore gameMode thực sau initGame
    modeSelect.value = savedMode;
    gameMode = trainingBotXMode; // dùng mode của bot X làm default

    winCount       = parseInt(document.getElementById('autoplay-win-count').value);
    currentPlayer  = 'X';
    isGameActive   = true;
    isSolo         = false; // autoplay không phải solo

    // ── RANDOMIZE OPENING ────────────────────────────────────────
    const flipFirst = Math.random() < 0.5;
    if (flipFirst) currentPlayer = 'O';

    const seedR = Math.round((Math.random() - 0.5) * 6);
    const seedC = Math.round((Math.random() - 0.5) * 6);
    const seedKey = `${seedR},${seedC}`;
    if (!infiniteMap.has(seedKey)) {
        setCell(seedR, seedC, currentPlayer);
        moveHistory.push({ r: seedR, c: seedC, player: currentPlayer });
        moveCount++;
        currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
        if (typeof renderInfiniteBoard === 'function') renderInfiniteBoard();
    }
    // ─────────────────────────────────────────────────────────────

    const botXSelect = document.getElementById('training-bot-x');
    const botOSelect = document.getElementById('training-bot-o');
    if (botXSelect) trainingBotXMode = botXSelect.value;
    if (botOSelect) trainingBotOMode = botOSelect.value;

    const gamesPlayed = autoplayGamesTotal - autoplayGamesRemaining;
    statusPanel.innerHTML = `🎓 TRAINING: Bot ${trainingBotXMode.toUpperCase()} vs Bot ${trainingBotOMode.toUpperCase()} (${gamesPlayed}/${autoplayGamesTotal}) | Thắng: ${autoplayWins} | Thua: ${autoplayLosses}`;

    setTimeout(() => autoplayMove(originalWinCount), 100);
}

// ===== CẬP NHẬT PROGRESS BAR TRONG KHUNG HUẤN LUYỆN =====
function updateTrainingProgress() {
    const played = autoplayGamesTotal - autoplayGamesRemaining;
    const pct    = autoplayGamesTotal > 0 ? (played / autoplayGamesTotal) * 100 : 0;

    const textEl = document.getElementById('training-progress-text');
    const barEl  = document.getElementById('training-progress-bar');
    const wrEl   = document.getElementById('training-progress-wr');

    if (textEl) textEl.textContent = `${played}/${autoplayGamesTotal}`;
    if (barEl)  barEl.style.width  = `${pct.toFixed(1)}%`;
    if (wrEl)   wrEl.textContent   = `W:${autoplayWins} L:${autoplayLosses}`;
}

// Lưu kết quả autoplay khi makeMove phát hiện thắng
var autoplayLastWinner = null;

function autoplayMove(originalWinCount) {
    if (!isAutoplayRunning) return;

    if (!isGameActive) {
        autoplayGamesRemaining--;

        // Dùng autoplayLastWinner thay vì parse statusPanel text
        let result = 'draw', winner = autoplayLastWinner;
        autoplayLastWinner = null;

        if (winner === 'X') {
            autoplayWins++; result = 'win';
        } else if (winner === 'O') {
            autoplayLosses++; result = 'lose';
        } else {
            autoplayDraws++; result = 'draw';
        }

        // Learning: thêm ván vào Replay Buffer thay vì học ngay từng ván
        // BatchLearning sẽ tự quyết định khi nào chạy batch và có chấp nhận model mới không
        if (learningEnabled) {
            // ── GHI PATTERN TRỰC TIẾP SAU MỖI VÁN ──────────────────────
            // Không chờ batch/evaluation — pattern tăng ngay lập tức
            if (winner && winner !== 'draw') {
                const loser = winner === 'X' ? 'O' : 'X';
                if (typeof rememberWinPattern === 'function') rememberWinPattern(moveHistory, winner);
                if (typeof rememberLoss === 'function') rememberLoss(moveHistory, loser);
            }
            // ─────────────────────────────────────────────────────────────

            if (typeof BatchLearning !== 'undefined') {
                // BatchLearning chỉ tracking Elo — không gọi evaluation nữa
                BatchLearning.addGame(moveHistory, result, winner);
            }
            
            // Neural Network Training - học từ kết quả ván
            if (typeof neuralEvaluator !== 'undefined' && neuralEvaluator.isTrainingEnabled) {
                // Train neural network với features từ người thắng
                if (winner && winner !== 'draw') {
                    const winnerFeatures = neuralEvaluator.extractFeatures(winner);
                    const targetValue = winner === 'X' ? 10000 : -10000;
                    neuralEvaluator.addTrainingSample(winnerFeatures, targetValue);
                    
                    // Train sau mỗi 10 ván để tránh quá tải
                    const totalPlayed = autoplayWins + autoplayLosses + autoplayDraws;
                    if (totalPlayed % 10 === 0) {
                        neuralEvaluator.train(5); // Train 5 epochs
                        console.log(`🧠 Neural Training - Epoch 5, Total games: ${totalPlayed}`);
                    }
                }
            }
        }

        recordMatch(result, winner);
        updateTrainingProgress();

        const gamesPlayed = autoplayGamesTotal - autoplayGamesRemaining;
        const memoryStats = typeof getMemoryStats === 'function' ? getMemoryStats() : { patterns: 0 };
        const batchInfo = typeof BatchLearning !== 'undefined'
            ? BatchLearning.getStatus()
            : null;
        const batchStr = batchInfo
            ? ` | Batch: ${batchInfo.batchProgress} | Elo: ${batchInfo.eloCurrentModel}${batchInfo.evaluating ? ' 🔬Eval' : ''}`
            : '';
        statusPanel.innerHTML = `🎓 TRAINING: Bot ${trainingBotXMode.toUpperCase()} vs Bot ${trainingBotOMode.toUpperCase()} (${gamesPlayed}/${autoplayGamesTotal}) | Thắng: ${autoplayWins} | Thua: ${autoplayLosses} | Pattern: ${memoryStats.patterns}${batchStr}`;

        if (autoplayGamesRemaining > 0) {
            autoplayInterval = setTimeout(() => runAutoplayGame(originalWinCount), 500);
        } else {
            stopAutoplay();
        }
        return;
    }

    try {
        // Set gameMode theo bot hiện tại
        const currentBotMode = currentPlayer === 'X' ? trainingBotXMode : trainingBotOMode;
        const originalMode = gameMode;
        gameMode = currentBotMode;

        // Set bot/human piece cho getBotMove
        const originalBotPiece = botPiece;
        const originalHumanPiece = humanPiece;
        const originalIsSolo = isSolo;

        isSolo = false;
        botPiece = currentPlayer;
        humanPiece = currentPlayer === 'X' ? 'O' : 'X';

        // ── DRAW DETECTION: ván quá dài → tính hòa ──────────────
        if (moveCount > 300) {
            isGameActive = false;
            autoplayLastWinner = null; // draw
            gameMode = originalMode;
            botPiece = originalBotPiece;
            humanPiece = originalHumanPiece;
            isSolo = originalIsSolo;
            setTimeout(() => autoplayMove(originalWinCount), 50);
            return;
        }
        // ─────────────────────────────────────────────────────────

        // ── EXPLORATION NOISE ──────────────────────────────────────
        // Trong training mode, thỉnh thoảng chọn ngẫu nhiên từ top-N
        // thay vì luôn đi best move → tránh replay cùng 1 thế cờ mãi.
        // Epsilon giảm dần theo số ván đã chơi (epsilon-greedy decay).
        const totalPlayed = autoplayWins + autoplayLosses + autoplayDraws;
        const totalGamesTarget = parseInt(document.getElementById('autoplay-games').value) || 50;
        // epsilon bắt đầu 0.25, giảm dần về 0.05 khi gần hết training
        const epsilon = Math.max(0.05, 0.25 * (1 - totalPlayed / totalGamesTarget));

        let move;
        if (Math.random() < epsilon) {
            // Exploration: chọn ngẫu nhiên từ top-5 candidates theo quickScore
            const cands = getSearchCandidates().filter(({ r, c }) => getCell(r, c) === '');
            if (cands.length > 0) {
                const scored = cands
                    .map(({ r, c }) => ({ r, c, score: quickScore(r, c, botPiece) }))
                    .sort((a, b) => b.score - a.score);
                // Không chọn random hoàn toàn — chỉ trong top 5 để không đi nước quá tệ
                const topN = scored.slice(0, Math.min(5, scored.length));
                move = topN[Math.floor(Math.random() * topN.length)];
            } else {
                move = getBotMove();
            }
        } else {
            // Exploitation: dùng getBotMove bình thường
            move = getBotMove();
        }
        // ─────────────────────────────────────────────────────────

        // Restore original values
        gameMode = originalMode;
        botPiece = originalBotPiece;
        humanPiece = originalHumanPiece;
        isSolo = originalIsSolo;

        if (move) {
            const originalIsBotMove = isBotMove;
            isBotMove = true;
            makeMove(move.r, move.c);
            isBotMove = originalIsBotMove;
            
            // Force render lại board để đảm bảo hiển thị đúng
            if (isInfinite && typeof renderInfiniteBoard === 'function') {
                renderInfiniteBoard();
            }
        } else {
            isGameActive = false;
        }
    } catch(e) {
        console.error('Autoplay move error:', e);
        isGameActive = false;
    }

    setTimeout(() => autoplayMove(originalWinCount), 300);
}
