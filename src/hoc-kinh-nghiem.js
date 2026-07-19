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
const MAX_MEMORIES   = 1500;  // tối đa bao nhiêu pattern nhớ (tăng từ 500)
const PENALTY_BASE   = 3000;  // điểm phạt cơ bản cho nước đi nguy hiểm
const MEMORY_DEPTH   = 8;     // nhớ tối đa 8 nước đi gần nhất của địch (tăng từ 6)
const DECAY_DAYS     = 30;    // số ngày để pattern giảm 50% importance
const MIN_HITS_THRESHOLD = 2; // hits tối thiểu để pattern được coi là hiệu quả

// Bộ nhớ trong RAM (load từ localStorage khi khởi động)
let botMemory = loadBotMemory();

function loadBotMemory() {
    try {
        const data = JSON.parse(localStorage.getItem(MEMORY_KEY)) || {};
        console.log(`[Memory] Loaded ${Object.keys(data).length} patterns`);
        return data;
    } catch(e) {
        console.error('[Memory] Failed to load:', e);
        return {};
    }
}

function saveBotMemory() {
    try {
        const keys = Object.keys(botMemory);
        if (keys.length > MAX_MEMORIES) {
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
        // Cập nhật UI sau mỗi lần save (lấy từ LearningEngine)
        if (typeof updateMemoryDisplay === 'function') updateMemoryDisplay();
    } catch(e) {
        console.error('[Memory] Failed to save:', e);
    }
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
    const hits  = entry.hits || 1;

    // Hits 1 → penalty = PENALTY_BASE (đủ mạnh ngay từ ván đầu)
    // Hits tăng → penalty tăng, cap ở 3x
    const adaptiveMultiplier = Math.min(1 + (hits - 1) * 0.5, 3);
    
    return PENALTY_BASE * adaptiveMultiplier;
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
    if (!entry) return true;
    // Bỏ context matching nghiêm ngặt — gây bỏ sót pattern đúng
    // Chỉ check depth hợp lệ
    return true;
}


// ─────────────────────────────────────────────────────────────────
// GHI NHỚ VAN THUA
// Gọi sau khi bot thua — lưu pattern nước đi của địch
// ─────────────────────────────────────────────────────────────────
function rememberLoss(history, enemyPiece) {
    if (!history || history.length < 3) return;

    // Lưu nhiều "window" độ dài khác nhau để nhận ra pattern sớm
    for (let depth = 3; depth <= Math.min(MEMORY_DEPTH, history.length); depth++) {
        const enemyMoves = history.filter(m => m.player === enemyPiece).slice(-depth);
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

    const enemyMoves = moveHistory.filter(m => m.player === enemyPiece);
    if (enemyMoves.length === 0) return 0;

    let maxPenalty = 0;

    for (let depth = 2; depth <= Math.min(MEMORY_DEPTH, enemyMoves.length); depth++) {
        const recent = enemyMoves.slice(-depth);
        const key = normalizeMoveSequence(recent);
        if (!key) continue;

        const entry = botMemory[key];
        if (!entry) continue;

        // Pattern khớp → địch đang đi theo thế nguy hiểm đã học
        // Penalty = phạt nếu candidate KHÔNG phải ô sát cạnh chuỗi địch
        // (vì bot nên ở gần đó để chặn nước tiếp theo)
        const adaptivePenalty = getAdaptivePenalty(entry);
        const depthFactor = depth / MEMORY_DEPTH;

        // Tìm ô đầu/cuối chuỗi địch để biết bot cần chặn chỗ nào
        // Ô nguy hiểm = ô liền kề hai đầu của chuỗi địch hiện tại
        let minR = recent[0].r, maxR = recent[0].r;
        let minC = recent[0].c, maxC = recent[0].c;
        for (const m of recent) {
            minR = Math.min(minR, m.r); maxR = Math.max(maxR, m.r);
            minC = Math.min(minC, m.c); maxC = Math.max(maxC, m.c);
        }

        // Khoảng cách từ candidate đến bounding box của chuỗi địch
        const distR = Math.max(0, minR - candidateR, candidateR - maxR);
        const distC = Math.max(0, minC - candidateC, candidateC - maxC);
        const dist  = distR + distC;

        // Nếu candidate nằm SÁT chuỗi (dist <= 2): không phạt — đây là ô chặn tốt
        // Nếu xa hơn: phạt tỷ lệ với khoảng cách
        if (dist <= 2) continue;

        const distanceFactor = Math.min((dist - 2) / 3, 2);
        const penalty = adaptivePenalty * depthFactor * distanceFactor;
        if (penalty > maxPenalty) maxPenalty = penalty;
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

    if (maxHits >= 1) {
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
// (fallback khi BatchLearning chưa load)
function onTrainingResult(history, result, winner) {
    if (!history || history.length < 3) return;
    if (result === 'draw' || !winner) return; // bỏ qua hòa

    const winnerPiece = winner; // winner là 'X' hoặc 'O'
    const loserPiece  = winner === 'X' ? 'O' : 'X';

    rememberWinPattern(history, winnerPiece);
    rememberLoss(history, loserPiece);

    // Train neural network with game result
    if (typeof neuralEvaluator !== 'undefined' && neuralEvaluator.isTrainingEnabled) {
        const features = neuralEvaluator.extractFeatures(winnerPiece);
        const targetValue = 10000;
        neuralEvaluator.addTrainingSample(features, targetValue);
        if (Math.random() < 0.1) {
            neuralEvaluator.train(5);
        }
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
            // Cập nhật context
            botMemory[winKey].winCount = winCount;
            botMemory[winKey].gameMode = gameMode;
        } else {
            botMemory[winKey] = {
                hits: 1,
                depth,
                lastSeen: Date.now(),
                winCount,
                gameMode,
                type: 'win', // đánh dấu là pattern thắng
                // Thêm context
                boardDensity: moveHistory.length,
                centerDistance: getAverageCenterDistance(winnerMoves)
            };
        }
    }

    // Giới hạn số lượng WIN patterns để tránh memory bloat
    const winKeys = Object.keys(botMemory).filter(k => k.startsWith('WIN_'));
    if (winKeys.length > MAX_MEMORIES / 2) {
        // Xóa các WIN patterns cũ nhất
        winKeys.sort((a, b) => botMemory[a].lastSeen - botMemory[b].lastSeen);
        const toDelete = winKeys.slice(0, winKeys.length - MAX_MEMORIES / 2);
        toDelete.forEach(k => delete botMemory[k]);
    }

    saveBotMemory();
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
    if (typeof BatchLearning !== 'undefined') BatchLearning.reset();
    updateMemoryDisplay();
    console.log('🗑️ Đã reset bộ nhớ bot');
}

// Tính decay factor (dùng bởi checkWinPattern)
function calculateDecay(lastSeen) {
    if (!lastSeen) return 1;
    const daysSince = (Date.now() - lastSeen) / (1000 * 60 * 60 * 24);
    return Math.pow(0.5, daysSince / DECAY_DAYS);
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

    // Cập nhật Elo display
    if (typeof BatchLearning !== 'undefined') {
        const eloStatus = BatchLearning.getStatus();
        const eloCurrent = document.getElementById('elo-current');
        const eloBest    = document.getElementById('elo-best');
        if (eloCurrent) eloCurrent.textContent = eloStatus.eloCurrentModel;
        if (eloBest)    eloBest.textContent    = eloStatus.eloBestModel;
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
