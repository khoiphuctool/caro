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

const MEMORY_KEY     = 'caro_bot_memory_v2';
const MAX_MEMORIES   = 1500;  // tối đa bao nhiêu pattern nhớ
const PENALTY_BASE   = 600000;  // điểm phạt cơ bản cho nước đi nguy hiểm (tăng theo OX.HTML)
const MEMORY_DEPTH   = 4;     // nhớ tối đa 4 nước đi gần nhất của địch (giảm theo OX.HTML)

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

// ===== ĐƠN GIẢN - Không decay, không adaptive learning =====
// Pattern luôn giữ nguyên sức mạnh như OX.HTML

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

// ===== BỎ CONTEXT MATCHING - Pattern áp dụng mọi lúc như OX.HTML =====


// ─────────────────────────────────────────────────────────────────
// GHI NHỚ VÁN THUA
// Lưu tọa độ tuyệt đối như OX.HTML
// ─────────────────────────────────────────────────────────────────
function rememberLoss(history, enemyPiece) {
    console.log('[Memory] rememberLoss called, history length:', history?.length, 'enemyPiece:', enemyPiece);
    if (!history || history.length < 3) return;

    const enemyMoves = history.filter(m => m.player === enemyPiece);
    console.log('[Memory] enemyMoves filtered:', enemyMoves.length);

    // Lưu nhiều "window" độ dài khác nhau để nhận ra pattern sớm
    // Bắt đầu từ depth=2 để match với getMemoryPenalty
    for (let depth = 2; depth <= Math.min(MEMORY_DEPTH, enemyMoves.length); depth++) {
        const recent = enemyMoves.slice(-depth);
        if (recent.length < depth) continue;

        // Lưu tọa độ tuyệt đối như OX.HTML
        const key = JSON.stringify(recent.map(m => ({r: m.r, c: m.c})));
        if (!key) continue;

        console.log('[Memory] Saving pattern key:', key.substring(0, 50));

        if (botMemory[key]) {
            botMemory[key].hits++;
        } else {
            botMemory[key] = {
                hits: 1,
                depth,
                moves: recent.map(m => ({r: m.r, c: m.c})) // lưu tọa độ tuyệt đối
            };
        }
    }

    saveBotMemory();
    console.log(`🧠 Bot đã học! Tổng pattern: ${Object.keys(botMemory).length}`, 'Latest pattern:', enemyMoves.slice(-3).map(m => ({r: m.r, c: m.c})));
}

// ─────────────────────────────────────────────────────────────────
// KIỂM TRA XEM CHUỖI NƯỚC ĐI HIỆN TẠI CÓ KHỚP PATTERN
// - Loss pattern: phạt điểm (tránh bị đánh bại)
// - WIN pattern: thưởng điểm (lặp lại thế cờ thắng)
// Check tọa độ tuyệt đối như OX.HTML
// ─────────────────────────────────────────────────────────────────
function getMemoryPenalty(candidateR, candidateC, enemyPiece) {
    if (Object.keys(botMemory).length === 0) return 0;

    const enemyMoves = moveHistory.filter(m => m.player === enemyPiece);
    if (enemyMoves.length === 0) return 0;

    let maxPenalty = 0;

    // Helper function để check quân trên bàn cờ (hỗ trợ cả boardState và infiniteMap)
    function getCellAt(r, c) {
        if (typeof isInfinite !== 'undefined' && isInfinite) {
            return infiniteMap.get(`${r},${c}`);
        }
        if (boardState[r] && boardState[r][c] !== undefined) {
            return boardState[r][c];
        }
        return null;
    }

    // Debug: log số lượng pattern và sample keys
    if (Math.random() < 0.01) { // chỉ log 1% để tránh spam
        console.log('[Memory] Total patterns:', Object.keys(botMemory).length);
        const sampleKeys = Object.keys(botMemory).slice(0, 5);
        sampleKeys.forEach((key, i) => {
            console.log(`[Memory] Sample key ${i}:`, key.substring(0, 80));
        });
    }

    // Kiểm tra từng depth từ 2 đến MEMORY_DEPTH
    for (let depth = 2; depth <= Math.min(MEMORY_DEPTH, enemyMoves.length); depth++) {
        const recent = enemyMoves.slice(-depth);
        const key = JSON.stringify(recent.map(m => ({r: m.r, c: m.c})));
        if (!key) continue;

        const entry = botMemory[key];
        if (!entry) {
            // Debug: log khi không match (chỉ 1%)
            if (Math.random() < 0.01) {
                console.log('[Memory] No match for key:', key.substring(0, 60));
            }
            continue;
        }

        console.log(`[Memory] MATCHED pattern depth ${depth}, hits: ${entry.hits}`);

        // Logic OX.HTML: đếm match
        let matchCount = 0;
        recent.forEach(pMove => {
            // Kiểm tra xem nước đi này có trên bàn cờ không
            if (getCellAt(pMove.r, pMove.c) === enemyPiece) {
                matchCount++;
            }
            // Nếu candidate position nằm trong pattern, cộng thêm 1.5
            if (pMove.r === candidateR && pMove.c === candidateC) {
                matchCount += 1.5;
            }
        });

        // Nếu match >= 3, phạt 600000 (loss pattern)
        if (matchCount >= 3) {
            maxPenalty += PENALTY_BASE;
            console.log(`[Memory] PENALTY APPLIED: ${PENALTY_BASE}`);
        }
    }

    // Kiểm tra WIN pattern của bot (thưởng điểm để lặp lại)
    const botMoves = moveHistory.filter(m => m.player !== enemyPiece);
    if (botMoves.length >= 2) {
        for (let depth = 2; depth <= Math.min(MEMORY_DEPTH, botMoves.length); depth++) {
            const recent = botMoves.slice(-depth);
            const key = JSON.stringify(recent.map(m => ({r: m.r, c: m.c})));
            if (!key) continue;

            const winKey = `WIN_${key}`;
            const entry = botMemory[winKey];
            if (!entry) continue;

            // Đếm match với WIN pattern
            let matchCount = 0;
            recent.forEach(pMove => {
                if (getCellAt(pMove.r, pMove.c) !== enemyPiece && getCellAt(pMove.r, pMove.c) !== null) {
                    matchCount++;
                }
                if (pMove.r === candidateR && pMove.c === candidateC) {
                    matchCount += 1.5;
                }
            });

            // Nếu match >= 3, thưởng điểm âm (penalty âm = tăng điểm)
            if (matchCount >= 3) {
                maxPenalty -= PENALTY_BASE; // thưởng = giảm penalty
            }
        }
    }

    return maxPenalty;
}

// ─────────────────────────────────────────────────────────────────
// KIỂM TRA CẢNH BÁO SỚM — Bot nhận ra đang bị "chiêu quen"
// Check tọa độ tuyệt đối như OX.HTML
// ─────────────────────────────────────────────────────────────────
function checkPatternWarning(enemyPiece) {
    if (Object.keys(botMemory).length === 0) return { danger: false };

    const enemyMoves = moveHistory.filter(m => m.player === enemyPiece);
    if (enemyMoves.length < 2) return { danger: false };

    let maxHits = 0;
    let matched = null;

    for (let depth = 2; depth <= Math.min(MEMORY_DEPTH, enemyMoves.length); depth++) {
        const recent = enemyMoves.slice(-depth);
        const key = JSON.stringify(recent.map(m => ({r: m.r, c: m.c})));
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

// Gọi từ logic-game.js khi bot thắng - bot nhớ pattern thắng để lặp lại
function onBotWin(history, botPiece) {
    rememberWinPattern(history, botPiece);
    const total = Object.keys(botMemory).filter(k => k.startsWith('WIN_')).length;
    const msg = total === 1
        ? 'Đã nhớ thế cờ thắng này! 🎯'
        : `Đã nhớ ${total} thế cờ thắng! Sẽ lặp lại! 🏆`;
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
// Lưu tọa độ tuyệt đối như OX.HTML
// ─────────────────────────────────────────────────────────────────
function rememberWinPattern(history, winnerPiece) {
    if (!history || history.length < 3) return;

    for (let depth = 3; depth <= Math.min(MEMORY_DEPTH, history.length); depth++) {
        const winnerMoves = history.filter(m => m.player === winnerPiece).slice(-depth);
        if (winnerMoves.length < depth) continue;

        // Lưu tọa độ tuyệt đối như OX.HTML
        const key = JSON.stringify(winnerMoves.map(m => ({r: m.r, c: m.c})));
        if (!key) continue;

        // Sử dụng prefix khác để phân biệt pattern thắng vs thua
        const winKey = `WIN_${key}`;

        if (botMemory[winKey]) {
            botMemory[winKey].hits++;
        } else {
            botMemory[winKey] = {
                hits: 1,
                depth,
                type: 'win',
                moves: winnerMoves.map(m => ({r: m.r, c: m.c})) // lưu tọa độ tuyệt đối
            };
        }
    }

    // Giới hạn số lượng WIN patterns để tránh memory bloat
    const winKeys = Object.keys(botMemory).filter(k => k.startsWith('WIN_'));
    if (winKeys.length > MAX_MEMORIES / 2) {
        // Xóa các WIN patterns có hits thấp nhất
        winKeys.sort((a, b) => (botMemory[a].hits || 0) - (botMemory[b].hits || 0));
        const toDelete = winKeys.slice(0, winKeys.length - MAX_MEMORIES / 2);
        toDelete.forEach(k => delete botMemory[k]);
    }

    saveBotMemory();
}



// Hiển thị thống kê bộ nhớ (dùng để debug)
function getMemoryStats() {
    const keys = Object.keys(botMemory);
    const totalHits = keys.reduce((s, k) => s + (botMemory[k].hits || 0), 0);
    
    // Đơn giản hóa: pattern có hits >= 1 là hiệu quả
    let effectivePatterns = 0;
    let winPatterns = 0;
    let lossPatterns = 0;
    
    for (const key of keys) {
        if (botMemory[key].hits >= 1) effectivePatterns++;
        
        if (key.startsWith('WIN_')) winPatterns++;
        else lossPatterns++;
    }
    
    return { 
        patterns: keys.length, 
        totalHits,
        effectivePatterns,
        avgScore: totalHits / (keys.length || 1),
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

// ===== BỎ DECAY - Không còn tính decay factor =====

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
        `📈 Điểm trung bình: ${stats.avgScore.toFixed(2)}\n` +
        `🏆 Pattern thắng: ${stats.winPatterns}\n` +
        `💀 Pattern thua: ${stats.lossPatterns}\n` +
        `🎯 Tổng hits: ${stats.totalHits}\n\n` +
        `💡 Pattern hiệu quả = pattern có hits >= 1\n` +
        `📉 Pattern không giảm importance (đã bỏ decay)`;
    
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
                    `Chọn "OK" để CỘNG DỒN (merge) pattern\n` +
                    `Chọn "Cancel" để GHI ĐÈ hoàn toàn`;
                
                const shouldMerge = confirm(confirmMsg);
                
                if (shouldMerge) {
                    // MERGE - cộng dồn pattern
                    let mergedCount = 0;
                    let updatedCount = 0;
                    
                    for (const [key, importEntry] of Object.entries(memoryToImport)) {
                        if (botMemory[key]) {
                            // Pattern đã tồn tại → cộng hits và cập nhật lastSeen
                            const oldHits = botMemory[key].hits || 0;
                            const importHits = importEntry.hits || 0;
                            botMemory[key].hits = oldHits + importHits;
                            botMemory[key].lastSeen = Date.now();
                            // Giữ lại depth lớn hơn
                            if (importEntry.depth > (botMemory[key].depth || 0)) {
                                botMemory[key].depth = importEntry.depth;
                            }
                            updatedCount++;
                        } else {
                            // Pattern mới → thêm vào
                            botMemory[key] = importEntry;
                            botMemory[key].lastSeen = Date.now();
                            mergedCount++;
                        }
                    }
                    
                    saveBotMemory();
                    updateMemoryDisplay();
                    
                    const finalStats = getMemoryStats();
                    console.log('📥 Đã merge bộ nhớ:', mergedCount, 'mới,', updatedCount, 'cập nhật');
                    alert(`✅ Đã merge thành công!\n\n+ ${mergedCount} pattern mới\n+ ${updatedCount} pattern cập nhật\n→ Tổng: ${finalStats.patterns} patterns`);
                } else {
                    // GHI ĐÈ - thay thế hoàn toàn
                    botMemory = memoryToImport;
                    saveBotMemory();
                    updateMemoryDisplay();
                    
                    console.log('📥 Đã ghi đè bộ nhớ bot:', importStats.patterns, 'patterns');
                    alert(`✅ Đã ghi đè thành công ${importStats.patterns} patterns!`);
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
