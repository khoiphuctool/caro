// ===== HỌC KINH NGHIỆM - Bot rút kinh nghiệm từ các ván thua =====
//
// Cách hoạt động:
// - Khi bot thua, lưu lại chuỗi nước đi tương đối (relative moves) của đối thủ
// - Chuỗi nước đi được chuẩn hóa về tọa độ gốc (0,0) để độc lập vị trí
// - Mỗi trạng thái bàn cờ (hash tương đối) được gắn nhãn "nguy hiểm"
// - Khi tính quickScore, các ô dẫn đến trạng thái nguy hiểm bị trừ điểm phạt
// ─────────────────────────────────────────────────────────────────

const MEMORY_KEY     = 'caro_bot_memory_v1';
const MAX_MEMORIES   = 200;   // tối đa bao nhiêu pattern nhớ
const PENALTY_BASE   = 3000;  // điểm phạt cơ bản cho nước đi nguy hiểm
const MEMORY_DEPTH   = 6;     // nhớ tối đa 6 nước đi gần nhất của địch

// Bộ nhớ trong RAM (load từ localStorage khi khởi động)
let botMemory = loadBotMemory();

function loadBotMemory() {
    try {
        return JSON.parse(localStorage.getItem(MEMORY_KEY)) || {};
    } catch(e) { return {}; }
}

function saveBotMemory() {
    try {
        // Giới hạn kích thước — xóa entry cũ nhất nếu vượt quá
        const keys = Object.keys(botMemory);
        if (keys.length > MAX_MEMORIES) {
            // Xóa entry có hits thấp nhất
            keys.sort((a, b) => (botMemory[a].hits || 0) - (botMemory[b].hits || 0));
            for (let i = 0; i < keys.length - MAX_MEMORIES; i++) {
                delete botMemory[keys[i]];
            }
        }
        localStorage.setItem(MEMORY_KEY, JSON.stringify(botMemory));
    } catch(e) {}
}

// ─────────────────────────────────────────────────────────────────
// Chuẩn hóa chuỗi nước đi về tọa độ tương đối (origin = nước đầu)
// Trả về chuỗi key dạng "dr1,dc1|dr2,dc2|..."
// ─────────────────────────────────────────────────────────────────
function normalizeMoveSequence(moves) {
    if (!moves || moves.length === 0) return null;
    // Lấy nước đi đầu tiên làm gốc
    const r0 = moves[0].r, c0 = moves[0].c;
    return moves.map(m => `${m.r - r0},${m.c - c0}`).join('|');
}

// Lấy chuỗi nước đi của địch (humanPiece) từ moveHistory
function getEnemyMoveSequence(history, enemyPiece, depth) {
    const enemyMoves = history.filter(m => m.player === enemyPiece);
    const recent = enemyMoves.slice(-depth); // lấy `depth` nước gần nhất
    return recent;
}

// ─────────────────────────────────────────────────────────────────
// GHI NHỚ VAN THUA
// Gọi sau khi bot thua — lưu pattern nước đi của địch
// ─────────────────────────────────────────────────────────────────
function rememberLoss(history, enemyPiece) {
    if (!history || history.length < 3) return;

    // Lưu nhiều "window" độ dài khác nhau để nhận ra pattern sớm
    for (let depth = 3; depth <= Math.min(MEMORY_DEPTH, history.length); depth++) {
        const enemyMoves = getEnemyMoveSequence(history, enemyPiece, depth);
        if (enemyMoves.length < depth) continue;

        const key = normalizeMoveSequence(enemyMoves);
        if (!key) continue;

        if (botMemory[key]) {
            botMemory[key].hits++;
            botMemory[key].lastSeen = Date.now();
        } else {
            botMemory[key] = {
                hits: 1,
                depth,
                lastSeen: Date.now(),
                winCount,
                gameMode
            };
        }
    }

    saveBotMemory();
    console.log(`🧠 Bot đã học! Tổng pattern: ${Object.keys(botMemory).length}`);
}

// ─────────────────────────────────────────────────────────────────
// KIỂM TRA XEM CHUỖI NƯỚC ĐI HIỆN TẠI CÓ KHỚP PATTERN NGUY HIỂM
// Gọi mỗi lần tính score để phạt nước đi nguy hiểm
// ─────────────────────────────────────────────────────────────────
function getMemoryPenalty(candidateR, candidateC, enemyPiece) {
    if (Object.keys(botMemory).length === 0) return 0;

    // Lấy lịch sử hiện tại của địch
    const enemyMoves = moveHistory.filter(m => m.player === enemyPiece);
    if (enemyMoves.length === 0) return 0;

    let maxPenalty = 0;

    // Thử thêm nước đi ứng viên vào cuối chuỗi địch (giả sử địch sẽ đi đây)
    // thực ra ta đang xét nước của BOT — penalty áp dụng khi bot KHÔNG chặn
    // nên ta kiểm tra: nếu địch đã đi theo pattern, bot phải tránh bỏ qua
    for (let depth = 3; depth <= Math.min(MEMORY_DEPTH, enemyMoves.length + 1); depth++) {
        const recent = enemyMoves.slice(-(depth - 1));
        // Thêm ô ứng viên như nước tiếp theo của địch
        const hypothetical = [...recent, { r: candidateR, c: candidateC, player: enemyPiece }];
        if (hypothetical.length < depth) continue;

        const key = normalizeMoveSequence(hypothetical);
        if (!key) continue;

        const entry = botMemory[key];
        if (entry) {
            // Phạt tỉ lệ với số lần pattern này xuất hiện
            const penalty = PENALTY_BASE * Math.min(entry.hits, 5) * (depth / MEMORY_DEPTH);
            if (penalty > maxPenalty) maxPenalty = penalty;
        }
    }

    return maxPenalty;
}

// ─────────────────────────────────────────────────────────────────
// KIỂM TRA CẢNH BÁO SỚM — Bot nhận ra đang bị "chiêu quen"
// Trả về { danger: true/false, message, penalty }
// ─────────────────────────────────────────────────────────────────
function checkPatternWarning(enemyPiece) {
    if (Object.keys(botMemory).length === 0) return { danger: false };

    const enemyMoves = moveHistory.filter(m => m.player === enemyPiece);
    if (enemyMoves.length < 2) return { danger: false };

    let maxHits = 0;
    let matched = null;

    for (let depth = 2; depth <= Math.min(MEMORY_DEPTH, enemyMoves.length); depth++) {
        const recent = enemyMoves.slice(-depth);
        const key = normalizeMoveSequence(recent);
        if (!key) continue;

        const entry = botMemory[key];
        if (entry && entry.hits > maxHits) {
            maxHits = entry.hits;
            matched = entry;
        }
    }

    if (maxHits >= 2) {
        return {
            danger: true,
            hits: maxHits,
            message: `Đã nhận ra chiêu này! Đã thấy ${maxHits} lần rồi 😤`,
            penalty: PENALTY_BASE * Math.min(maxHits, 5)
        };
    }

    return { danger: false };
}

// ─────────────────────────────────────────────────────────────────
// TÍCH HỢP VÀO quickScore — thêm penalty cho nước đi nguy hiểm
// ─────────────────────────────────────────────────────────────────
function getMemoryAwareScore(r, c, p, baseScore) {
    // Chỉ áp dụng cho nước của bot (penalty khi bot bỏ qua chặn pattern nguy hiểm)
    if (p !== botPiece) return baseScore;

    const warning = checkPatternWarning(humanPiece);
    if (!warning.danger) return baseScore;

    // Tăng điểm PHÒNG THỦ nếu đang bị chiêu quen
    // (tức là các nước chặn sẽ được ưu tiên hơn)
    const penalty = getMemoryPenalty(r, c, humanPiece);
    return baseScore - penalty + (warning.danger ? warning.penalty * 0.5 : 0);
}

// ─────────────────────────────────────────────────────────────────
// API PUBLIC
// ─────────────────────────────────────────────────────────────────

// Gọi từ logic-game.js khi bot thua
function onBotLoss(history, enemyPiece) {
    rememberLoss(history, enemyPiece);
    const total = Object.keys(botMemory).length;
    const msg = total === 1
        ? 'Tôi sẽ nhớ chiêu này! 😠'
        : `Đã học ${total} pattern! Lần sau khác rồi! 🧠`;
    updateBotThinking(msg);
}

// Gọi từ autoplay.js khi training - học từ cả thắng và thua
function onTrainingResult(history, result, winner) {
    if (!history || history.length < 3) return;

    // Xác định bot nào thắng/thua để học pattern tương ứng
    const loserPiece = result === 'win' ? (winner === 'X' ? 'O' : 'X') : winner;
    const winnerPiece = result === 'win' ? winner : (winner === 'X' ? 'O' : 'X');

    // Học từ pattern của người thắng (để bot biết cách thắng)
    if (result === 'win' || result === 'lose') {
        rememberWinPattern(history, winnerPiece);
    }

    // Học từ pattern của người thua (để bot tránh lỗi tương tự)
    if (result === 'lose') {
        rememberLoss(history, loserPiece);
    }
}

// ─────────────────────────────────────────────────────────────────
// GHI NHỚ PATTERN THẮNG
// Lưu pattern của người thắng để bot học cách thắng
// ─────────────────────────────────────────────────────────────────
function rememberWinPattern(history, winnerPiece) {
    if (!history || history.length < 3) return;

    for (let depth = 3; depth <= Math.min(MEMORY_DEPTH, history.length); depth++) {
        const winnerMoves = history.filter(m => m.player === winnerPiece);
        const recent = winnerMoves.slice(-depth);
        if (recent.length < depth) continue;

        const key = normalizeMoveSequence(recent);
        if (!key) continue;

        // Sử dụng prefix khác để phân biệt pattern thắng vs thua
        const winKey = `WIN_${key}`;

        if (botMemory[winKey]) {
            botMemory[winKey].hits++;
            botMemory[winKey].lastSeen = Date.now();
        } else {
            botMemory[winKey] = {
                hits: 1,
                depth,
                lastSeen: Date.now(),
                winCount,
                gameMode,
                type: 'win' // đánh dấu là pattern thắng
            };
        }
    }

    saveBotMemory();
}

// Gọi từ getBotMove để điều chỉnh ứng viên dựa trên bộ nhớ
function applyMemoryToScore(r, c, baseScore) {
    return getMemoryAwareScore(r, c, botPiece, baseScore);
}

// Hiển thị thống kê bộ nhớ (dùng để debug)
function getMemoryStats() {
    const keys = Object.keys(botMemory);
    const totalHits = keys.reduce((s, k) => s + (botMemory[k].hits || 0), 0);
    return { patterns: keys.length, totalHits };
}

// Xóa bộ nhớ (reset học)
function clearBotMemory() {
    botMemory = {};
    localStorage.removeItem(MEMORY_KEY);
    console.log('🗑️ Đã xóa bộ nhớ bot');
}

// Reset bộ nhớ - gọi từ UI
function resetMemory() {
    clearBotMemory();
    updateMemoryDisplay();
    console.log('🗑️ Đã reset bộ nhớ bot');
}

// Cập nhật hiển thị số lượng pattern
function updateMemoryDisplay() {
    const stats = getMemoryStats();
    const display = document.getElementById('memory-patterns');
    if (display) {
        display.textContent = stats.patterns;
    }
}
