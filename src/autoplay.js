// ===== AUTOPLAY - Chế độ huấn luyện Bot =====

let autoplayInterval       = null;
let autoplayGamesRemaining = 0;
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
    autoplayWins  = 0;
    autoplayLosses = 0;
    autoplayDraws  = 0;
    isAutoplayRunning = true;

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

    statusPanel.innerHTML = `🎓 TRAINING: Bot ${trainingBotXMode.toUpperCase()} vs Bot ${trainingBotOMode.toUpperCase()} (${autoplayGamesRemaining}/${totalGames} ván, ${autoplayWinCount} quân thắng)`;
    runAutoplayGame(originalWinCount);
}

function stopAutoplay() {
    if (autoplayInterval) { clearTimeout(autoplayInterval); autoplayInterval = null; }
    isAutoplayRunning = false;

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
    statusPanel.innerHTML = `🎓 TRAINING ĐÃ DỪNG | Thắng: ${autoplayWins} | Thua: ${autoplayLosses} | Hòa: ${autoplayDraws} | Pattern học: ${memoryStats.patterns}`;

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

    initGame();
    winCount       = parseInt(document.getElementById('autoplay-win-count').value);
    currentPlayer  = 'X'; // Reset về X cho mỗi ván mới
    
    // Training mode: 2 bot đấu nhau
    // Bot X dùng trainingBotXMode, Bot O dùng trainingBotOMode
    // Mỗi lượt sẽ set gameMode tương ứng
    isGameActive   = true;

    // Đọc level bot từ UI (nếu có), nếu không dùng mặc định
    const botXSelect = document.getElementById('training-bot-x');
    const botOSelect = document.getElementById('training-bot-o');
    
    if (botXSelect) trainingBotXMode = botXSelect.value;
    if (botOSelect) trainingBotOMode = botOSelect.value;

    const totalGames = parseInt(document.getElementById('autoplay-games').value);
    statusPanel.innerHTML = `🎓 TRAINING: Bot ${trainingBotXMode.toUpperCase()} vs Bot ${trainingBotOMode.toUpperCase()} (${autoplayGamesRemaining}/${totalGames}) | Thắng: ${autoplayWins} | Thua: ${autoplayLosses}`;

    setTimeout(() => autoplayMove(originalWinCount), 100);
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

        // Learning: học từ cả thắng và thua
        if (learningEnabled && typeof onTrainingResult === 'function') {
            onTrainingResult(moveHistory, result, winner);
        }

        recordMatch(result, winner);

        const totalGames = parseInt(document.getElementById('autoplay-games').value);
        const memoryStats = typeof getMemoryStats === 'function' ? getMemoryStats() : { patterns: 0 };
        statusPanel.innerHTML = `🎓 TRAINING: Bot ${trainingBotXMode.toUpperCase()} vs Bot ${trainingBotOMode.toUpperCase()} (${autoplayGamesRemaining}/${totalGames}) | Thắng: ${autoplayWins} | Thua: ${autoplayLosses} | Pattern: ${memoryStats.patterns}`;

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
        // Trong autoplay, cả X và O đều là bot
        // currentPlayer là quân sẽ đi, nên botPiece = currentPlayer
        botPiece = currentPlayer;
        humanPiece = currentPlayer === 'X' ? 'O' : 'X';

        // Sử dụng getBotMove để bot quyết định theo level của nó
        const move = getBotMove();

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
