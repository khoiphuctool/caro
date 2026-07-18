// ===== AUTOPLAY - Chế độ huấn luyện Bot =====

let autoplayInterval       = null;
let autoplayGamesRemaining = 0;
let autoplayWins           = 0;
let autoplayLosses         = 0;
let autoplayDraws          = 0;
let trainingBotXMode       = 'ai-god';  // Bot X (đi trước) - level
let trainingBotOMode       = 'ai-hard'; // Bot O (đi sau) - level
let learningEnabled        = true;      // Bật learning trong training
// isAutoplayRunning được khai báo var trong trang-thai.js

function startAutoplay() {
    if (isAutoplayRunning) return;

    const totalGames       = parseInt(document.getElementById('autoplay-games').value);
    const autoplayWinCount = parseInt(document.getElementById('autoplay-win-count').value);

    autoplayGamesRemaining = totalGames;
    autoplayWins  = 0;
    autoplayLosses = 0;
    autoplayDraws  = 0;
    isAutoplayRunning = true;

    document.getElementById('btn-autoplay').style.display      = 'none';
    document.getElementById('btn-stop-autoplay').style.display = 'inline-block';

    // Luân phiên level để đa dạng hóa training
    trainingBotXMode = 'ai-god';
    trainingBotOMode = 'ai-hard';

    const originalWinCount = winCount;
    winCount = autoplayWinCount;

    statusPanel.innerHTML = `🎓 TRAINING: Bot ${trainingBotXMode.toUpperCase()} vs Bot ${trainingBotOMode.toUpperCase()} (${autoplayGamesRemaining}/${totalGames} ván, ${autoplayWinCount} quân thắng)`;
    runAutoplayGame(originalWinCount);
}

function stopAutoplay() {
    if (autoplayInterval) { clearTimeout(autoplayInterval); autoplayInterval = null; }
    isAutoplayRunning = false;

    document.getElementById('btn-autoplay').style.display      = 'inline-block';
    document.getElementById('btn-stop-autoplay').style.display = 'none';

    const memoryStats = typeof getMemoryStats === 'function' ? getMemoryStats() : { patterns: 0, totalHits: 0 };
    statusPanel.innerHTML = `🎓 TRAINING ĐÃ DỪNG | Thắng: ${autoplayWins} | Thua: ${autoplayLosses} | Hòa: ${autoplayDraws} | Pattern học: ${memoryStats.patterns}`;

    gameMode = 'ai-god';
    initGame();
}

function runAutoplayGame(originalWinCount) {
    if (!isAutoplayRunning || autoplayGamesRemaining <= 0) { stopAutoplay(); return; }

    initGame();
    winCount       = parseInt(document.getElementById('autoplay-win-count').value);
    currentPlayer  = 'X';
    
    // Training mode: 2 bot đấu nhau
    // Bot X dùng trainingBotXMode, Bot O dùng trainingBotOMode
    // Mỗi lượt sẽ set gameMode tương ứng
    isGameActive   = true;

    // Luân phiên level mỗi 10 ván để đa dạng hóa
    if (autoplayGamesRemaining % 20 === 0) {
        trainingBotXMode = 'ai-god';
        trainingBotOMode = 'ai-hard';
    } else if (autoplayGamesRemaining % 20 === 10) {
        trainingBotXMode = 'ai-hard';
        trainingBotOMode = 'ai-god';
    }

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
        } else {
            isGameActive = false;
        }
    } catch(e) {
        console.error('Autoplay move error:', e);
        isGameActive = false;
    }

    setTimeout(() => autoplayMove(originalWinCount), 300);
}
