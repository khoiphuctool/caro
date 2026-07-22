// ===== AI CONTROLLER - Điều phối AI =====
// Module điều phối chính, kết nối các module AI
// Thay thế getBotMove() và makeAIMove() từ ai-nao.js

const AIController = {
    // ===== CONFIGURATION =====
    config: {
        useNewArchitecture: true,  // Bật/tắt kiến trúc mới
        debugMode: false,
        defaultDepth: 5,
        defaultTimeLimit: 2000
    },

    // ===== GET BOT MOVE =====
    // Hàm chính để AI tính nước đi
    getBotMove(options = {}) {
        const {
            player = typeof botPiece !== 'undefined' ? botPiece : 'O',
            opponent = typeof humanPiece !== 'undefined' ? humanPiece : 'X',
            gameMode = typeof window.gameMode !== 'undefined' ? window.gameMode : 'ai-god',
            winCount = typeof winCount !== 'undefined' ? winCount : 5,
            blockBothEnds = typeof document !== 'undefined' ? 
                document.getElementById('block-both-ends')?.checked : true
        } = options;

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
        // ══════════════════════════════════════════════════════
        for (const { r, c } of validCands) {
            if (ThreatDetector.isWinningMove(r, c, player, winCount)) {
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
            if (ThreatDetector.blocksWinningThreat(r, c, opponent, winCount)) {
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

        // Check for FOUR threats — phòng thủ CRITICAL ưu tiên hơn tấn công HIGH
        for (const { r, c } of sortedCands) {
            const threat = ThreatDetector.evaluateThreat(r, c, player, opponent, winCount, blockBothEnds);
            if (threat.defense.maxThreat >= ThreatDetector.THREAT.CRITICAL) {
                if (typeof updateBotThinking === 'function') {
                    updateBotThinking('Chặn nguy hiểm! 🛡️');
                }
                return { r, c };
            }
        }
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
            depth: 3,
            timeLimit: 1000,
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

        // Use search with medium depth
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

        if (typeof DebugLogger !== 'undefined') {
            DebugLogger.log(DebugLogger.CATEGORY.AI_DECISION, DebugLogger.LEVEL.INFO,
                           'Hard mode move selected', searchResult);
        }

        return searchResult.move;
    },

    // ===== GOD MODE =====
    getGodModeMove(candidates, player, opponent, winCount, blockBothEnds) {
        // God mode dùng thẳng getBotMove() cũ (ai-nao.js) — pipeline đầy đủ nhất:
        // earlyGameDefense, lookahead, trap, WIN_ pattern, MCTS, PVS depth 6-8
        // AIController chỉ lo win/block-win (bước 0 & 1) rồi nhường lại.
        if (typeof getBotMove === 'function') {
            const move = getBotMove();
            if (move) return move;
        }

        // Fallback nếu getBotMove không khả dụng: dùng Search PVS depth 7
        const searchResult = Search.findBestMove(player, {
            algorithm: Search.ALGORITHM.PVS,
            depth: 7,
            timeLimit: 3000,
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
    makeAIMove() {
        const isActive = typeof isGameActive !== 'undefined' ? isGameActive : 
                        (typeof GameState !== 'undefined' ? GameState.isGameActive() : true);
        
        if (!isActive) return;

        const isBotMoveFlag = typeof isBotMove !== 'undefined' ? isBotMove : false;
        if (!isBotMoveFlag) {
            if (typeof isBotMove !== 'undefined') {
                isBotMove = true;
            }
        }

        const move = this.getBotMove();
        if (move && typeof makeMove === 'function') {
            makeMove(move.r, move.c);
        }

        if (typeof isBotMove !== 'undefined') {
            isBotMove = false;
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
