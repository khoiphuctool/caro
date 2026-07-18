// ===== HỌC KINH NGHIỆM - Bot rút kinh nghiệm từ các ván thua =====
//
// Cách hoạt động:
// - Khi bot thua, lưu lại chuỗi nước đi tương đối (relative moves) của đối thủ
// - Chuỗi nước đi được chuẩn hóa về tọa độ gốc (0,0) để độc lập vị trí
// - Mỗi trạng thái bàn cờ (hash tương đối) được gắn nhãn "nguy hiểm"
// - Khi tính quickScore, các ô dẫn đến trạng thái nguy hiểm bị trừ điểm phạt
// - Adaptive learning: điều chỉnh penalty dựa trên hiệu quả thực tế
// - Decay mechanism: pattern cũ giảm dần importance
// ─────────────────────────────────────────────────────────────────

const MEMORY_KEY     = 'caro_bot_memory_v1';
const MAX_MEMORIES   = 500;   // tối đa bao nhiêu pattern nhớ (tăng từ 200)
const PENALTY_BASE   = 3000;  // điểm phạt cơ bản cho nước đi nguy hiểm
const MEMORY_DEPTH   = 8;     // nhớ tối đa 8 nước đi gần nhất của địch (tăng từ 6)
const DECAY_DAYS     = 30;    // số ngày để pattern giảm 50% importance
const MIN_HITS_THRESHOLD = 2; // hits tối thiểu để pattern được coi là hiệu quả

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
            // Xóa entry có score hiệu quả thấp nhất (hits * decay factor)
            keys.sort((a, b) => {
                const scoreA = calculatePatternScore(botMemory[a]);
                const scoreB = calculatePatternScore(botMemory[b]);
                return scoreA - scoreB;
            });
            for (let i = 0; i < keys.length - MAX_MEMORIES; i++) {
                delete botMemory[keys[i]];
            }
        }
        localStorage.setItem(MEMORY_KEY, JSON.stringify(botMemory));
    } catch(e) {}
}

// ===== DECAY MECHANISM - Tính toán hiệu quả thực tế của pattern =====
function calculatePatternScore(entry) {
    if (!entry) return 0;
    
    // Decay factor: pattern cũ giảm importance
    const daysSinceLastSeen = entry.lastSeen ? (Date.now() - entry.lastSeen) / (1000 * 60 * 60 * 24) : 0;
    const decayFactor = Math.pow(0.5, daysSinceLastSeen / DECAY_DAYS);
    
    // Score = hits * decay * depth (pattern dài hơn có giá trị cao hơn)
    const baseScore = (entry.hits || 0) * decayFactor;
    const depthBonus = (entry.depth || 3) / MEMORY_DEPTH;
    
    return baseScore * (1 + depthBonus);
}

// ===== ADAPTIVE LEARNING - Điều chỉnh penalty dựa trên hiệu quả =====
function getAdaptivePenalty(entry) {
    if (!entry) return 0;
    
    const score = calculatePatternScore(entry);
    const basePenalty = PENALTY_BASE;
    
    // Pattern hiệu quả cao → penalty mạnh hơn
    const adaptiveMultiplier = Math.min(score / MIN_HITS_THRESHOLD, 3);
    
    return basePenalty * adaptiveMultiplier;
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

// ===== CONTEXT AWARE - Tính khoảng cách trung bình đến trung tâm =====
function getAverageCenterDistance(moves) {
    if (!moves || moves.length === 0) return 0;
    
    // Tính trung tâm của bàn cờ hiện tại
    let sumR = 0, sumC = 0;
    for (const m of moves) {
        sumR += m.r;
        sumC += m.c;
    }
    const centerR = sumR / moves.length;
    const centerC = sumC / moves.length;
    
    // Tính khoảng cách trung bình
    let totalDist = 0;
    for (const m of moves) {
        totalDist += Math.abs(m.r - centerR) + Math.abs(m.c - centerC);
    }
    
    return totalDist / moves.length;
}

// ===== CONTEXT MATCHING - Kiểm tra xem pattern có phù hợp context hiện tại =====
function isContextMatch(entry, currentEnemyMoves) {
    if (!entry) return true; // Không có context → luôn match
    
    const currentDensity = moveHistory.length;
    const storedDensity = entry.boardDensity || 0;
    
    // Chỉ áp dụng pattern khi mật độ quân tương đồng (±50%)
    const densityRatio = currentDensity / (storedDensity || 1);
    if (densityRatio < 0.5 || densityRatio > 2.0) return false;
    
    // Kiểm tra vị trí tương đối
    const currentCenterDist = getAverageCenterDistance(currentEnemyMoves);
    const storedCenterDist = entry.centerDistance || 0;
    
    const distRatio = currentCenterDist / (storedCenterDist || 1);
    if (distRatio < 0.5 || distRatio > 2.0) return false;
    
    return true;
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
            // Cập nhật context
            botMemory[key].winCount = winCount;
            botMemory[key].gameMode = gameMode;
        } else {
            botMemory[key] = {
                hits: 1,
                depth,
                lastSeen: Date.now(),
                winCount,
                gameMode,
                // Thêm context: số quân trên bàn cờ khi pattern xuất hiện
                boardDensity: moveHistory.length,
                // Thêm context: vị trí tương đối so với trung tâm
                centerDistance: getAverageCenterDistance(enemyMoves)
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
            // Kiểm tra context match trước khi áp dụng penalty
            if (!isContextMatch(entry, enemyMoves)) continue;
            
            // Sử dụng adaptive penalty thay vì penalty cố định
            const adaptivePenalty = getAdaptivePenalty(entry);
            const depthFactor = depth / MEMORY_DEPTH;
            const penalty = adaptivePenalty * depthFactor;
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
    
    // Tính thống kê nâng cao
    let effectivePatterns = 0;
    let avgScore = 0;
    let winPatterns = 0;
    let lossPatterns = 0;
    
    for (const key of keys) {
        const entry = botMemory[key];
        const score = calculatePatternScore(entry);
        if (score >= MIN_HITS_THRESHOLD) effectivePatterns++;
        avgScore += score;
        
        if (key.startsWith('WIN_')) winPatterns++;
        else lossPatterns++;
    }
    
    avgScore = keys.length > 0 ? avgScore / keys.length : 0;
    
    return { 
        patterns: keys.length, 
        totalHits,
        effectivePatterns,
        avgScore: avgScore.toFixed(2),
        winPatterns,
        lossPatterns
    };
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
    const effectiveDisplay = document.getElementById('memory-effective');
    if (display) {
        display.textContent = stats.patterns;
    }
    if (effectiveDisplay) {
        effectiveDisplay.textContent = stats.effectivePatterns;
    }
}

// ===== HIỂN THỊ THỐNG KÊ CHI TIẾT =====
function showMemoryStats() {
    const stats = getMemoryStats();
    
    const message = `📊 THỐNG KÊ BỘ NHỚ BOT\n\n` +
        `🧠 Tổng pattern: ${stats.patterns}\n` +
        `✅ Pattern hiệu quả: ${stats.effectivePatterns}\n` +
        `📈 Điểm trung bình: ${stats.avgScore}\n` +
        `🏆 Pattern thắng: ${stats.winPatterns}\n` +
        `💀 Pattern thua: ${stats.lossPatterns}\n` +
        `🎯 Tổng hits: ${stats.totalHits}\n\n` +
        `💡 Pattern hiệu quả = pattern có score >= ${MIN_HITS_THRESHOLD}\n` +
        `📉 Pattern cũ giảm importance sau ${DECAY_DAYS} ngày`;
    
    alert(message);
}

// ===== XUẤT BỘ NHỚ BOT =====
function exportBotMemory() {
    try {
        const stats = getMemoryStats();
        if (stats.patterns === 0) {
            alert('🧠 Chưa có pattern nào để xuất!');
            return;
        }

        const exportData = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            patterns: stats.patterns,
            totalHits: stats.totalHits,
            memory: botMemory
        };

        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `caro_bot_memory_${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        console.log('📤 Đã xuất bộ nhớ bot:', stats.patterns, 'patterns');
    } catch(e) {
        console.error('❌ Lỗi khi xuất bộ nhớ:', e);
        alert('❌ Lỗi khi xuất bộ nhớ!');
    }
}

// ===== NHẬP BỘ NHỚ BOT =====
function importBotMemory(input) {
    try {
        const file = input.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const importData = JSON.parse(e.target.result);
                
                // Hỗ trợ định dạng mới (có field memory) và cũ (direct object)
                let memoryToImport = null;
                
                if (importData.memory && typeof importData.memory === 'object') {
                    // Định dạng mới
                    memoryToImport = importData.memory;
                } else if (typeof importData === 'object' && Object.keys(importData).length > 0) {
                    // Định dạng cũ hoặc direct object
                    memoryToImport = importData;
                } else {
                    alert('❌ File không đúng định dạng!');
                    return;
                }

                // Hỏi xác nhận
                const currentStats = getMemoryStats();
                const importStats = {
                    patterns: Object.keys(memoryToImport).length,
                    totalHits: Object.values(memoryToImport).reduce((s, k) => s + (k.hits || 0), 0)
                };

                const confirmMsg = `Bạn có muốn nhập bộ nhớ này?\n\n` +
                    `📦 Hiện tại: ${currentStats.patterns} patterns\n` +
                    `📥 File nhập: ${importStats.patterns} patterns\n\n` +
                    `Bộ nhớ hiện tại sẽ bị ghi đè!`;
                
                if (confirm(confirmMsg)) {
                    // Nhập bộ nhớ
                    botMemory = memoryToImport;
                    saveBotMemory();
                    updateMemoryDisplay();
                    
                    console.log('📥 Đã nhập bộ nhớ bot:', importStats.patterns, 'patterns');
                    alert(`✅ Đã nhập thành công ${importStats.patterns} patterns!`);
                }
            } catch(err) {
                console.error('❌ Lỗi khi đọc file:', err);
                alert('❌ File không hợp lệ hoặc bị hỏng!');
            }
        };
        reader.readAsText(file);
        
        // Reset input để có thể chọn lại file
        input.value = '';
    } catch(e) {
        console.error('❌ Lỗi khi nhập bộ nhớ:', e);
        alert('❌ Lỗi khi nhập bộ nhớ!');
    }
}
