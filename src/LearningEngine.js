// ===== LEARNING ENGINE - Separated from AI Core =====
// This module handles all learning functionality independently
// AI can function normally even if Learning has errors

const LearningEngine = {
    // ===== CONFIGURATION =====
    config: {
        enabled: true,
        maxMemories: 1500,
        penaltyBase: 3000,
        memoryDepth: 8,
        decayDays: 30,
        minHitsThreshold: 2,
        storageKey: 'caro_bot_memory_v1'
    },

    // ===== MEMORY STORAGE =====
    memory: {},

    // ===== STATISTICS =====
    stats: {
        totalPatterns: 0,
        totalHits: 0,
        effectivePatterns: 0,
        winPatterns: 0,
        lossPatterns: 0
    },

    // ===== INITIALIZATION =====
    initialize() {
        this.loadMemory();
        this.updateStats();
    },

    // ===== LOAD MEMORY =====
    loadMemory() {
        try {
            this.memory = JSON.parse(localStorage.getItem(this.config.storageKey)) || {};
        } catch (e) {
            console.error('Failed to load learning memory:', e);
            this.memory = {};
        }
    },

    // ===== SAVE MEMORY =====
    saveMemory() {
        try {
            // Limit memory size
            const keys = Object.keys(this.memory);
            if (keys.length > this.config.maxMemories) {
                // Remove least effective patterns
                keys.sort((a, b) => {
                    const scoreA = this.calculatePatternScore(this.memory[a]);
                    const scoreB = this.calculatePatternScore(this.memory[b]);
                    return scoreA - scoreB;
                });
                for (let i = 0; i < keys.length - this.config.maxMemories; i++) {
                    delete this.memory[keys[i]];
                }
            }
            localStorage.setItem(this.config.storageKey, JSON.stringify(this.memory));
            this.updateStats();
        } catch (e) {
            console.error('Failed to save learning memory:', e);
        }
    },

    // ===== CALCULATE PATTERN SCORE =====
    calculatePatternScore(entry) {
        if (!entry) return 0;

        // Decay factor: old patterns lose importance
        const daysSinceLastSeen = entry.lastSeen ? 
            (Date.now() - entry.lastSeen) / (1000 * 60 * 60 * 24) : 0;
        const decayFactor = Math.pow(0.5, daysSinceLastSeen / this.config.decayDays);

        // Score = hits * decay * depth bonus
        const baseScore = (entry.hits || 0) * decayFactor;
        const depthBonus = (entry.depth || 3) / this.config.memoryDepth;

        return baseScore * (1 + depthBonus);
    },

    // ===== GET ADAPTIVE PENALTY =====
    getAdaptivePenalty(entry) {
        if (!entry) return 0;

        const score = this.calculatePatternScore(entry);
        const basePenalty = this.config.penaltyBase;

        // More effective patterns get stronger penalties
        const adaptiveMultiplier = Math.min(score / this.config.minHitsThreshold, 3);

        return basePenalty * adaptiveMultiplier;
    },

    // ===== NORMALIZE MOVE SEQUENCE =====
    normalizeMoveSequence(moves) {
        if (!moves || moves.length === 0) return null;
        const r0 = moves[0].r, c0 = moves[0].c;
        return moves.map(m => `${m.r - r0},${m.c - c0}`).join('|');
    },

    // ===== GET AVERAGE CENTER DISTANCE =====
    getAverageCenterDistance(moves) {
        if (!moves || moves.length === 0) return 0;

        let sumR = 0, sumC = 0;
        for (const m of moves) {
            sumR += m.r;
            sumC += m.c;
        }
        const centerR = sumR / moves.length;
        const centerC = sumC / moves.length;

        let totalDist = 0;
        for (const m of moves) {
            totalDist += Math.abs(m.r - centerR) + Math.abs(m.c - centerC);
        }

        return totalDist / moves.length;
    },

    // ===== CONTEXT MATCHING =====
    isContextMatch(entry, currentEnemyMoves) {
        if (!entry) return true;

        const currentDensity = typeof moveHistory !== 'undefined' ? moveHistory.length : 0;
        const storedDensity = entry.boardDensity || 0;

        // Only apply pattern when board density is similar (±50%)
        const densityRatio = currentDensity / (storedDensity || 1);
        if (densityRatio < 0.5 || densityRatio > 2.0) return false;

        // Check relative position
        const currentCenterDist = this.getAverageCenterDistance(currentEnemyMoves);
        const storedCenterDist = entry.centerDistance || 0;

        const distRatio = currentCenterDist / (storedCenterDist || 1);
        if (distRatio < 0.5 || distRatio > 2.0) return false;

        return true;
    },

    // ===== REMEMBER LOSS =====
    rememberLoss(history, enemyPiece) {
        if (!history || history.length < 3) return;

        // Store multiple window sizes for early pattern recognition
        for (let depth = 3; depth <= Math.min(this.config.memoryDepth, history.length); depth++) {
            const enemyMoves = history.filter(m => m.player === enemyPiece);
            const recent = enemyMoves.slice(-depth);
            if (recent.length < depth) continue;

            const key = this.normalizeMoveSequence(recent);
            if (!key) continue;

            if (this.memory[key]) {
                this.memory[key].hits++;
                this.memory[key].lastSeen = Date.now();
            } else {
                this.memory[key] = {
                    hits: 1,
                    depth,
                    lastSeen: Date.now(),
                    winCount: typeof winCount !== 'undefined' ? winCount : 5,
                    gameMode: typeof gameMode !== 'undefined' ? gameMode : 'ai-god',
                    boardDensity: typeof moveHistory !== 'undefined' ? moveHistory.length : 0,
                    centerDistance: this.getAverageCenterDistance(enemyMoves),
                    type: 'loss'
                };
            }
        }

        this.saveMemory();
        this.logLearning('rememberLoss', { enemyPiece, patterns: Object.keys(this.memory).length });
    },

    // ===== REMEMBER WIN PATTERN =====
    rememberWinPattern(history, winnerPiece) {
        if (!history || history.length < 3) return;

        for (let depth = 3; depth <= Math.min(this.config.memoryDepth, history.length); depth++) {
            const winnerMoves = history.filter(m => m.player === winnerPiece);
            const recent = winnerMoves.slice(-depth);
            if (recent.length < depth) continue;

            const key = this.normalizeMoveSequence(recent);
            if (!key) continue;

            const winKey = `WIN_${key}`;

            if (this.memory[winKey]) {
                this.memory[winKey].hits++;
                this.memory[winKey].lastSeen = Date.now();
            } else {
                this.memory[winKey] = {
                    hits: 1,
                    depth,
                    lastSeen: Date.now(),
                    winCount: typeof winCount !== 'undefined' ? winCount : 5,
                    gameMode: typeof gameMode !== 'undefined' ? gameMode : 'ai-god',
                    boardDensity: typeof moveHistory !== 'undefined' ? moveHistory.length : 0,
                    centerDistance: this.getAverageCenterDistance(winnerMoves),
                    type: 'win'
                };
            }
        }

        // Limit win patterns
        const winKeys = Object.keys(this.memory).filter(k => k.startsWith('WIN_'));
        if (winKeys.length > this.config.maxMemories / 2) {
            winKeys.sort((a, b) => this.memory[a].lastSeen - this.memory[b].lastSeen);
            const toDelete = winKeys.slice(0, winKeys.length - this.config.maxMemories / 2);
            toDelete.forEach(k => delete this.memory[k]);
        }

        this.saveMemory();
        this.logLearning('rememberWinPattern', { winnerPiece, winPatterns: winKeys.length });
    },

    // ===== GET MEMORY PENALTY =====
    getMemoryPenalty(candidateR, candidateC, enemyPiece) {
        if (Object.keys(this.memory).length === 0) return 0;

        const enemyMoves = typeof moveHistory !== 'undefined' ? 
            moveHistory.filter(m => m.player === enemyPiece) : [];
        if (enemyMoves.length === 0) return 0;

        let maxPenalty = 0;

        for (let depth = 3; depth <= Math.min(this.config.memoryDepth, enemyMoves.length + 1); depth++) {
            const recent = enemyMoves.slice(-(depth - 1));
            const hypothetical = [...recent, { r: candidateR, c: candidateC, player: enemyPiece }];
            if (hypothetical.length < depth) continue;

            const key = this.normalizeMoveSequence(hypothetical);
            if (!key) continue;

            const entry = this.memory[key];
            if (entry) {
                if (!this.isContextMatch(entry, enemyMoves)) continue;

                const adaptivePenalty = this.getAdaptivePenalty(entry);
                const depthFactor = depth / this.config.memoryDepth;
                const penalty = adaptivePenalty * depthFactor;
                if (penalty > maxPenalty) maxPenalty = penalty;
            }
        }

        return maxPenalty;
    },

    // ===== CHECK PATTERN WARNING =====
    checkPatternWarning(enemyPiece) {
        if (Object.keys(this.memory).length === 0) return { danger: false };

        const enemyMoves = typeof moveHistory !== 'undefined' ? 
            moveHistory.filter(m => m.player === enemyPiece) : [];
        if (enemyMoves.length < 2) return { danger: false };

        let maxHits = 0;
        let matched = null;

        for (let depth = 2; depth <= Math.min(this.config.memoryDepth, enemyMoves.length); depth++) {
            const recent = enemyMoves.slice(-depth);
            const key = this.normalizeMoveSequence(recent);
            if (!key) continue;

            const entry = this.memory[key];
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
                penalty: this.config.penaltyBase * Math.min(maxHits, 5)
            };
        }

        return { danger: false };
    },

    // ===== TRAINING RESULT =====
    onTrainingResult(history, result, winner) {
        if (!history || history.length < 3) return;

        const loserPiece = result === 'win' ? (winner === 'X' ? 'O' : 'X') : winner;
        const winnerPiece = result === 'win' ? winner : (winner === 'X' ? 'O' : 'X');

        // Learn from winner's patterns
        if (result === 'win' || result === 'lose') {
            this.rememberWinPattern(history, winnerPiece);
        }

        // Learn from loser's patterns
        if (result === 'lose') {
            this.rememberLoss(history, loserPiece);
        }

        this.logLearning('trainingResult', { result, winner, patterns: Object.keys(this.memory).length });
    },

    // ===== UPDATE STATS =====
    updateStats() {
        const keys = Object.keys(this.memory);
        this.stats.totalPatterns = keys.length;
        this.stats.totalHits = keys.reduce((s, k) => s + (this.memory[k].hits || 0), 0);

        let effectivePatterns = 0;
        let winPatterns = 0;
        let lossPatterns = 0;

        for (const key of keys) {
            const entry = this.memory[key];
            const score = this.calculatePatternScore(entry);
            if (score >= this.config.minHitsThreshold) effectivePatterns++;

            if (key.startsWith('WIN_')) winPatterns++;
            else lossPatterns++;
        }

        this.stats.effectivePatterns = effectivePatterns;
        this.stats.winPatterns = winPatterns;
        this.stats.lossPatterns = lossPatterns;
    },

    // ===== GET STATS =====
    getStats() {
        this.updateStats();
        return { ...this.stats };
    },

    // ===== CLEAR MEMORY =====
    clearMemory() {
        this.memory = {};
        localStorage.removeItem(this.config.storageKey);
        this.updateStats();
        this.logLearning('clearMemory', {});
    },

    // ===== EXPORT MEMORY =====
    exportMemory() {
        const stats = this.getStats();
        if (stats.totalPatterns === 0) {
            alert('🧠 Chưa có pattern nào để xuất!');
            return;
        }

        const exportData = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            patterns: stats.totalPatterns,
            totalHits: stats.totalHits,
            memory: this.memory
        };

        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `caro_bot_memory_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        this.logLearning('exportMemory', stats);
    },

    // ===== IMPORT MEMORY =====
    importMemory(input) {
        try {
            const file = input.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const importData = JSON.parse(e.target.result);

                    let memoryToImport = null;
                    if (importData.memory && typeof importData.memory === 'object') {
                        memoryToImport = importData.memory;
                    } else if (typeof importData === 'object' && Object.keys(importData).length > 0) {
                        memoryToImport = importData;
                    } else {
                        alert('❌ File không đúng định dạng!');
                        return;
                    }

                    const currentStats = this.getStats();
                    const importStats = {
                        patterns: Object.keys(memoryToImport).length,
                        totalHits: Object.values(memoryToImport).reduce((s, k) => s + (k.hits || 0), 0)
                    };

                    const confirmMsg = `Bạn có muốn nhập bộ nhớ này?\n\n` +
                        `📦 Hiện tại: ${currentStats.totalPatterns} patterns\n` +
                        `📥 File nhập: ${importStats.patterns} patterns\n\n` +
                        `Bộ nhớ hiện tại sẽ bị ghi đè!`;

                    if (confirm(confirmMsg)) {
                        this.memory = memoryToImport;
                        this.saveMemory();
                        this.logLearning('importMemory', importStats);
                        alert(`✅ Đã nhập thành công ${importStats.patterns} patterns!`);
                    }
                } catch (err) {
                    console.error('❌ Lỗi khi đọc file:', err);
                    alert('❌ File không hợp lệ hoặc bị hỏng!');
                }
            };
            reader.readAsText(file);
            input.value = '';
        } catch (e) {
            console.error('❌ Lỗi khi nhập bộ nhớ:', e);
            alert('❌ Lỗi khi nhập bộ nhớ!');
        }
    },

    // ===== LOGGING =====
    logLearning(action, data) {
        if (typeof DebugLogger !== 'undefined') {
            DebugLogger.log(DebugLogger.CATEGORY.LEARNING, DebugLogger.LEVEL.INFO, 
                           `Learning: ${action}`, data);
        }
    }
};

// Initialize on load
LearningEngine.initialize();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LearningEngine;
}
