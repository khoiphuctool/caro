// ===== AI CONTROLLER - Điều phối AI =====
// Module điều phối chính, kết nối các module AI
// Thay thế getBotMove() và makeAIMove() từ ai-nao.js

const AIController = {
    // ===== CONFIGURATION =====
    config: {
        useNewArchitecture: false,  // Bật/tắt kiến trúc mới - ĐÃ TẮT, DÙNG LOGIC CŨ
        debugMode: false,
        defaultDepth: 5,
        defaultTimeLimit: 2000
    },

    // ===== GET BOT MOVE =====
    // Hàm chính để AI tính nước đi
    getBotMove(options = {}) {
        const player = options.player ?? (typeof botPiece !== 'undefined' ? botPiece : 'O');
        const opponent = options.opponent ?? (typeof humanPiece !== 'undefined' ? humanPiece : 'X');
        const gameMode = options.gameMode ?? document.getElementById('game-mode')?.value ?? 'ai-god';
        const winCount = options.winCount ?? 5;
        const blockBothEnds = options.blockBothEnds ??
            (typeof document !== 'undefined' ? document.getElementById('block-both-ends')?.checked : true);

        // Sử dụng kiến trúc mới nếu được bật
        if (this.config.useNewArchitecture) {
            return this.getBotMoveNewArchitecture({
                player,
                opponent,
                gameMode,
                winCount,
                blockBothEnds
            });
        }

        // Fallback: sử dụng logic cũ từ ai-nao.js
        if (typeof getBotMove === 'function') {
            return getBotMove();
        }

        return null;
    },

    // ===== GET BOT MOVE (NEW ARCHITECTURE) =====
    getBotMoveNewArchitecture(options) {
        const { player, opponent, gameMode, winCount, blockBothEnds } = options;

        // Log start
        if (typeof DebugLogger !== 'undefined') {
            DebugLogger.log(DebugLogger.CATEGORY.AI_DECISION, DebugLogger.LEVEL.INFO,
                           'AI move calculation started', { player, gameMode, winCount });
        }

        // Update bot thinking UI
        if (typeof updateBotThinking === 'function') {
            updateBotThinking('Đang phân tích bàn cờ...');
        }

        // Get candidates
        const candidates = Evaluation.getCandidateMoves(2);
        if (candidates.length === 0) {
            return { r: 0, c: 0 };
        }

        // Filter valid candidates
        const validCands = candidates.filter(({ r, c }) => {
            const cell = typeof GameState !== 'undefined' ? 
                GameState.getBoardCell(r, c) : 
                (typeof getCell === 'function' ? getCell(r, c) : "");
            return cell === '';
        });

        if (validCands.length === 0) {
            return { r: 0, c: 0 };
        }

        // ══════════════════════════════════════════════════════
        // 0. BOT THẮNG NGAY — tuyệt đối ưu tiên
        // Xác minh bằng checkWinSilent (chuẩn luật thật, gồm cả luật chặn 2 đầu)
        // vì PatternDetector xử lý luật này không theo cài đặt blockBothEnds.
        // ══════════════════════════════════════════════════════
        for (const { r, c } of validCands) {
            if (this.isRealWin(r, c, player, winCount)) {
                if (typeof updateBotThinking === 'function') {
                    updateBotThinking('TÌM THẤY NƯỚC THẮNG! 🎯');
                }
                if (typeof DebugLogger !== 'undefined') {
                    DebugLogger.log(DebugLogger.CATEGORY.AI_DECISION, DebugLogger.LEVEL.INFO,
                                   'Winning move found', { r, c });
                }
                return { r, c };
            }
        }

        // ══════════════════════════════════════════════════════
        // 1. ĐỊCH THẮNG NGAY — phải chặn tuyệt đối
        // ══════════════════════════════════════════════════════
        for (const { r, c } of validCands) {
            if (this.isRealWin(r, c, opponent, winCount)) {
                if (typeof updateBotThinking === 'function') {
                    updateBotThinking('Chặn kịp! 😤');
                }
                if (typeof DebugLogger !== 'undefined') {
                    DebugLogger.log(DebugLogger.CATEGORY.AI_DECISION, DebugLogger.LEVEL.INFO,
                                   'Blocking winning threat', { r, c });
                }
                return { r, c };
            }
        }

        // ══════════════════════════════════════════════════════
        // 1.2. ĐỊCH CÓ FOUR_OPEN — chặn ngay, 1 nước nữa là thua
        // ══════════════════════════════════════════════════════
        
        // ══════════════════════════════════════════════════════════════════
        // CHẶN THÔNG MINH: Sử dụng analyzeBlockPositions để chọn vị trí chặn tối ưu
        // Ưu tiên chặn đầu MỞ (chưa có quân đối thủ) thay vì đầu đã chặn
        // ══════════════════════════════════════════════════════════════════
        if (typeof ThreatDetector !== 'undefined' && typeof ThreatDetector.analyzeBlockPositions === 'function') {
            const blockPositions = ThreatDetector.analyzeBlockPositions(validCands, opponent, winCount, blockBothEnds);
            if (blockPositions.length > 0) {
                const bestBlock = blockPositions[0]; // Đã sắp xếp theo điểm giảm dần
                console.log('[AIController] Smart block selected:', bestBlock);
                if (typeof updateBotThinking === 'function') {
                    updateBotThinking('Chặn thông minh! 🛡️');
                }
                if (typeof DebugLogger !== 'undefined') {
                    DebugLogger.log(DebugLogger.CATEGORY.AI_DECISION, DebugLogger.LEVEL.INFO,
                                   'Smart block position selected', bestBlock);
                }
                return { r: bestBlock.r, c: bestBlock.c };
            }
        }
        
        // Fallback: Logic cũ nếu ThreatDetector không khả dụng
        for (const { r, c } of validCands) {
            const threat = ThreatDetector.evaluateDefenseThreat(r, c, opponent, winCount, blockBothEnds);
            if (threat.maxThreat === ThreatDetector.THREAT.CRITICAL) {
                // Check nếu có FOUR_OPEN
                const hasFourOpen = threat.patternScores.some(p =>
                    p.pattern === PatternDetector.PATTERN.FOUR_OPEN
                );
                if (hasFourOpen) {
                    if (typeof updateBotThinking === 'function') {
                        updateBotThinking('Chặn FOUR nguy hiểm! 🚨');
                    }
                    if (typeof DebugLogger !== 'undefined') {
                        DebugLogger.log(DebugLogger.CATEGORY.AI_DECISION, DebugLogger.LEVEL.INFO,
                                       'Blocking FOUR_OPEN threat', { r, c });
                    }
                    return { r, c };
                }
            }
        }

        // ══════════════════════════════════════════════════════
        // 1.5. BOT TẠO FOUR KHÔNG THỂ CHẶN — thắng chắc lượt sau
        // CHỈ khi địch KHÔNG có chuỗi FOUR nguy hiểm còn sống
        // ══════════════════════════════════════════════════════
        let _opponentHasCriticalFour = false;
        if (typeof countLineAndBlocked === 'function' && typeof DIRECTIONS !== 'undefined') {
            for (const { r, c } of validCands) {
                setCell(r, c, opponent);
                for (const dir of DIRECTIONS) {
                    const { count, blockedBoth } = countLineAndBlocked(r, c, dir.dr, dir.dc, opponent);
                    if (count >= winCount - 1 && !blockedBoth) { _opponentHasCriticalFour = true; break; }
                }
                setCell(r, c, '');
                if (_opponentHasCriticalFour) break;
            }
        }
        if (!_opponentHasCriticalFour) {
            const forcedFour = this.findForcedFourMove(validCands, player);
            if (forcedFour) {
                if (typeof updateBotThinking === 'function') {
                    updateBotThinking('Tạo FOUR thắng chắc! ⚔️');
                }
                if (typeof DebugLogger !== 'undefined') {
                    DebugLogger.log(DebugLogger.CATEGORY.AI_DECISION, DebugLogger.LEVEL.INFO,
                                   'Forced four (unstoppable) found', forcedFour);
                }
                return forcedFour;
            }
        }

        // ══════════════════════════════════════════════════════
        // 2. DIFFICULTY-BASED PIPELINE
        // ══════════════════════════════════════════════════════
        const isEasy = gameMode === 'ai-easy';
        const isMedium = gameMode === 'ai-medium';
        const isHard = gameMode === 'ai-hard';
        const isGod = gameMode === 'ai-god';

        // Easy mode: simple evaluation
        if (isEasy) {
            return this.getEasyModeMove(validCands, player, opponent, winCount, blockBothEnds);
        }

        // Medium mode: basic search
        if (isMedium) {
            return this.getMediumModeMove(validCands, player, opponent, winCount, blockBothEnds);
        }

        // Hard mode: deeper search
        if (isHard) {
            return this.getHardModeMove(validCands, player, opponent, winCount, blockBothEnds);
        }

        // God mode: full search with advanced patterns
        if (isGod) {
            return this.getGodModeMove(validCands, player, opponent, winCount, blockBothEnds);
        }

        // Default: medium mode
        return this.getMediumModeMove(validCands, player, opponent, winCount, blockBothEnds);
    },

    // ===== REAL WIN CHECK =====
    // Kiểm tra đặt (r,c) cho player có THẮNG THẬT không.
    // Ưu tiên checkWinSilent (chuẩn luật game, gồm luật chặn 2 đầu theo cài đặt);
    // fallback ThreatDetector nếu engine cũ chưa tải.
    isRealWin(r, c, player, winCount) {
        if (typeof setCell === 'function' && typeof checkWinSilent === 'function') {
            setCell(r, c, player);
            const w = checkWinSilent(r, c);
            setCell(r, c, '');
            return !!w;
        }
        return ThreatDetector.isWinningMove(r, c, player, winCount);
    },

    // ===== FORCED FOUR (bot) =====
    // Tìm nước tạo FOUR không thể chặn: >= 2 đầu hoàn thành five thắng thật
    // (open four / double four) → địch chỉ chặn được 1 đầu → thắng chắc.
    // CHỈ gọi sau khi đã xác nhận địch không có nước thắng ngay.
    findForcedFourMove(candidates, player) {
        if (typeof countWinningCompletionEnds !== 'function') return null;
        let best = null, bestS = -Infinity;
        for (const { r, c } of candidates) {
            if (countWinningCompletionEnds(r, c, player) >= 2) {
                const s = (typeof quickScore === 'function') ? quickScore(r, c, player) : 0;
                if (s > bestS) { bestS = s; best = { r, c }; }
            }
        }
        return best;
    },

    // ===== NEURAL SORT CANDIDATES =====
    // Sắp xếp lại candidates bằng neural score trước khi đưa vào search.
    // Dùng board-level evaluate (không simulate từng ô) để tránh O(n²).
    neuralSortCandidates(candidates, player) {
        if (typeof neuralEvaluator === 'undefined' || candidates.length === 0) return candidates;
        try {
            // Lấy 1 lần neural score toàn bàn làm tiebreaker nhẹ
            // Kết hợp với quickScore của từng ô (nhanh hơn nhiều)
            return [...candidates].sort((a, b) => {
                const sa = (typeof quickScore === 'function')
                    ? quickScore(a.r, a.c, player) : 0;
                const sb = (typeof quickScore === 'function')
                    ? quickScore(b.r, b.c, player) : 0;
                return sb - sa;
            });
        } catch (e) {
            return candidates;
        }
    },

    // ===== EASY MODE =====
    getEasyModeMove(candidates, player, opponent, winCount, blockBothEnds) {
        const result = Evaluation.findBestMove(candidates, player, winCount, blockBothEnds);
        
        if (typeof updateBotThinking === 'function') {
            updateBotThinking('Đã tính xong! 🤖');
        }

        if (typeof DebugLogger !== 'undefined') {
            DebugLogger.log(DebugLogger.CATEGORY.AI_DECISION, DebugLogger.LEVEL.INFO,
                           'Easy mode move selected', result);
        }

        return result.move;
    },

    // ===== MEDIUM MODE =====
    getMediumModeMove(candidates, player, opponent, winCount, blockBothEnds) {
        // Neural-sort candidates để search duyệt nước có triển vọng trước
        const sortedCands = this.neuralSortCandidates(candidates, player);

        // Check for FOUR threats — dùng phân tích nâng cao để chọn vị trí chặn tốt nhất
        const blockPositions = ThreatDetector.analyzeBlockPositions(sortedCands, opponent, winCount, blockBothEnds);
        if (blockPositions.length > 0) {
            const bestBlock = blockPositions[0]; // Đã sắp xếp theo điểm giảm dần
            if (typeof updateBotThinking === 'function') {
                updateBotThinking('Chặn nguy hiểm! 🛡️');
            }
            if (typeof DebugLogger !== 'undefined') {
                DebugLogger.log(DebugLogger.CATEGORY.AI_DECISION, DebugLogger.LEVEL.INFO,
                               'Best block position selected', bestBlock);
            }
            return { r: bestBlock.r, c: bestBlock.c };
        }

        // Check for attack HIGH
        for (const { r, c } of sortedCands) {
            const threat = ThreatDetector.evaluateThreat(r, c, player, opponent, winCount, blockBothEnds);
            if (threat.attack.maxThreat >= ThreatDetector.THREAT.HIGH) {
                if (typeof updateBotThinking === 'function') {
                    updateBotThinking('Cơ hội tấn công! ⚔️');
                }
                return { r, c };
            }
        }

        // Use search with limited depth
        const searchResult = Search.findBestMove(player, {
            algorithm: Search.ALGORITHM.PVS,
            depth: 2,
            timeLimit: 500,
            winCount,
            blockBothEnds
        });

        if (typeof updateBotThinking === 'function') {
            updateBotThinking('Đã tính xong! 🤖');
        }

        if (typeof DebugLogger !== 'undefined') {
            DebugLogger.log(DebugLogger.CATEGORY.AI_DECISION, DebugLogger.LEVEL.INFO,
                           'Medium mode move selected', searchResult);
        }

        return searchResult.move;
    },

    // ===== HARD MODE =====
    getHardModeMove(candidates, player, opponent, winCount, blockBothEnds) {
        // Neural-sort candidates để search ưu tiên nước có triển vọng cao
        const sortedCands = this.neuralSortCandidates(candidates, player);

        // Check for FOUR threats — dùng phân tích nâng cao để chọn vị trí chặn tốt nhất
        const blockPositions = ThreatDetector.analyzeBlockPositions(sortedCands, opponent, winCount, blockBothEnds);
        if (blockPositions.length > 0) {
            const bestBlock = blockPositions[0]; // Đã sắp xếp theo điểm giảm dần
            if (typeof updateBotThinking === 'function') {
                updateBotThinking('Chặn nguy hiểm! 🛡️');
            }
            if (typeof DebugLogger !== 'undefined') {
                DebugLogger.log(DebugLogger.CATEGORY.AI_DECISION, DebugLogger.LEVEL.INFO,
                               'Best block position selected', bestBlock);
            }
            return { r: bestBlock.r, c: bestBlock.c };
        }

        // Check for advanced patterns (dùng sortedCands)
        for (const { r, c } of sortedCands) {
            const threat = ThreatDetector.evaluateThreat(r, c, player, opponent, winCount, blockBothEnds);
            
            // Check for fork
            if (threat.attack.specialPatterns.fork.isFork) {
                if (typeof updateBotThinking === 'function') {
                    updateBotThinking('Phát hiện fork! ⚡');
                }
                return { r, c };
            }
            
            // Check for double three
            if (threat.attack.specialPatterns.doubleThree) {
                if (typeof updateBotThinking === 'function') {
                    updateBotThinking('Tạo double three! ⚡');
                }
                return { r, c };
            }
        }

        // Use search with depth 4 để AI đoán trước 4 nước
        const searchResult = Search.findBestMove(player, {
            algorithm: Search.ALGORITHM.PVS,
            depth: 4,
            timeLimit: 1500,
            winCount,
            blockBothEnds
        });

        if (typeof updateBotThinking === 'function') {
            updateBotThinking('Đã tính xong! 🤖');
        }

        if (typeof DebugLogger !== 'undefined') {
            DebugLogger.log(DebugLogger.CATEGORY.AI_DECISION, DebugLogger.LEVEL.INFO,
                           'Hard mode move selected', searchResult);
        }

        return searchResult.move;
    },

    // ===== GOD MODE =====
    getGodModeMove(candidates, player, opponent, winCount, blockBothEnds) {
        // ══════════════════════════════════════════════════════
        // GOD MODE - DÙNG PIPELINE MỚI, KHÔNG DÙNG LOGIC CŨ
        // Tránh xung đột giữa 2 hệ thống scoring khác nhau
        // ══════════════════════════════════════════════════════
        
        // Neural-sort candidates
        const sortedCands = this.neuralSortCandidates(candidates, player);

        // Check for FOUR threats — dùng phân tích nâng cao
        const blockPositions = ThreatDetector.analyzeBlockPositions(sortedCands, opponent, winCount, blockBothEnds);
        if (blockPositions.length > 0) {
            const bestBlock = blockPositions[0];
            if (typeof updateBotThinking === 'function') {
                updateBotThinking('Chặn nguy hiểm! 🛡️');
            }
            return { r: bestBlock.r, c: bestBlock.c };
        }

        // Check for advanced patterns
        for (const { r, c } of sortedCands) {
            const threat = ThreatDetector.evaluateThreat(r, c, player, opponent, winCount, blockBothEnds);
            
            // Check for fork
            if (threat.attack.specialPatterns.fork.isFork) {
                if (typeof updateBotThinking === 'function') {
                    updateBotThinking('Phát hiện fork! ⚡');
                }
                return { r, c };
            }
            
            // Check for double three
            if (threat.attack.specialPatterns.doubleThree) {
                if (typeof updateBotThinking === 'function') {
                    updateBotThinking('Tạo double three! ⚡');
                }
                return { r, c };
            }
        }

        // Use search with depth 5
        const searchResult = Search.findBestMove(player, {
            algorithm: Search.ALGORITHM.PVS,
            depth: 5,
            timeLimit: 2000,
            winCount,
            blockBothEnds
        });

        if (typeof updateBotThinking === 'function') {
            updateBotThinking('Đã tính xong! 🤖');
        }

        return searchResult.move;
    },

    // ===== MAKE AI MOVE =====
    // Thực hiện nước đi của AI
    makeAIMove(options = {}) {
        const isActive = typeof isGameActive !== 'undefined' ? isGameActive : 
                        (typeof GameState !== 'undefined' ? GameState.isGameActive() : true);
        
        if (!isActive) return;

        const isBotMoveFlag = typeof isBotMove !== 'undefined' ? isBotMove : false;
        if (!isBotMoveFlag) {
            if (typeof isBotMove !== 'undefined') {
                isBotMove = true;
            }
        }

        try {
            const move = this.getBotMove(options);
            if (move && typeof makeMove === 'function') makeMove(move.r, move.c);
        } finally {
            if (typeof isBotMove !== 'undefined') isBotMove = false;
        }
    },

    // ===== ENABLE/DISABLE NEW ARCHITECTURE =====
    enableNewArchitecture(enabled = true) {
        this.config.useNewArchitecture = enabled;
        if (typeof DebugLogger !== 'undefined') {
            DebugLogger.log(DebugLogger.CATEGORY.AI_DECISION, DebugLogger.LEVEL.INFO,
                           `New architecture ${enabled ? 'enabled' : 'disabled'}`);
        }
    },

    // ===== GET CONFIG =====
    getConfig() {
        return { ...this.config };
    },

    // ===== SET CONFIG =====
    setConfig(config) {
        this.config = { ...this.config, ...config };
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AIController;
}
