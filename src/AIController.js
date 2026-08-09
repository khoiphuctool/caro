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
        const rawGameMode = options.gameMode ?? (typeof gameMode !== 'undefined' ? gameMode : document.getElementById('game-mode')?.value) ?? 'ai-god';
        const equippedBotPetProfile = (typeof getMatchBotPetProfile === 'function') ? getMatchBotPetProfile() : null;
        const botPetActive = (typeof isBotPetActive === 'function') ? isBotPetActive() : false;
        const useBotPetRuntime = botPetActive && equippedBotPetProfile && typeof isValidBotPetRuntimeMode === 'function' && isValidBotPetRuntimeMode(rawGameMode);
        const gameMode = useBotPetRuntime ? equippedBotPetProfile.gameMode : rawGameMode;
        if (window.DEBUG_BOT_RUNTIME) {
            console.log('[AIController] getBotMove options:', options, 'rawGameMode:', rawGameMode, 'botPetActive:', botPetActive, 'useBotPetRuntime:', useBotPetRuntime, 'equippedBotPetProfile:', equippedBotPetProfile, 'resolvedGameMode:', gameMode);
        }
        // Resolve room rules: prefer explicit options.roomRules, then GameState.roomRules, then window.roomRules
        const resolvedRules = options.roomRules ?? (typeof GameState !== 'undefined' ? GameState.roomRules : undefined) ?? (typeof window !== 'undefined' ? window.roomRules : undefined);
        let winCount, blockBothEnds;
        if (resolvedRules && typeof resolvedRules.winCount === 'number') {
            winCount = resolvedRules.winCount;
            blockBothEnds = !!resolvedRules.chan2Dau;
        } else {
            // Fallback: allow options.winCount if explicitly provided, otherwise try legacy globals
            if (typeof options.winCount === 'number') {
                winCount = options.winCount;
            } else if (typeof winCount !== 'undefined') {
                winCount = winCount; // leave existing global if present
            } else if (typeof GameState !== 'undefined' && GameState.board && typeof GameState.board.winCount === 'number') {
                winCount = GameState.board.winCount;
            }
            blockBothEnds = (typeof options.blockBothEnds === 'boolean') ? options.blockBothEnds : (typeof document !== 'undefined' ? !!document.getElementById('block-both-ends')?.checked : true);
            console.warn('[AIController] roomRules not found in options/GameState/window — using fallback values; prefer passing roomRules to getBotMove()');
        }

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
            return getBotMove({ gameMode });
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

        if (typeof BlockBothEndsAnalyzer !== 'undefined') {
            const immediate = BlockBothEndsAnalyzer.getPriorityTacticalMove(player, opponent, winCount);
            if (immediate) return { r: immediate.r, c: immediate.c };
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
        
        // CHẶN ĐÚNG ĐẦU MỞ — dùng BlockBothEndsAnalyzer (thay analyzeBlockPositions cũ)
        if (typeof BlockBothEndsAnalyzer !== 'undefined') {
            const blockMoves = BlockBothEndsAnalyzer.getBestBlockMoves(opponent, player, winCount, winCount - 1);
            if (blockMoves.length > 0 && blockMoves[0].chainCount >= winCount - 1) {
                const best = blockMoves[0];
                console.log('[AIController] BlockBothEndsAnalyzer block:', best);
                if (typeof updateBotThinking === 'function') updateBotThinking('Chặn đúng đầu mở! 🛡️');
                return { r: best.r, c: best.c };
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
            // Truyền roomRules để áp dụng đúng luật chặn 2 đầu
            const rr = (typeof GameState !== 'undefined' && GameState.roomRules)
                ? GameState.roomRules
                : (typeof window !== 'undefined' ? window.roomRules : undefined);
            const w = checkWinSilent(r, c, rr);
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
        const sortedCands = this.neuralSortCandidates(candidates, player);

        // Chặn đúng đầu mở bằng BlockBothEndsAnalyzer
        if (typeof BlockBothEndsAnalyzer !== 'undefined') {
            const blockMoves = BlockBothEndsAnalyzer.getBestBlockMoves(opponent, player, winCount, winCount - 2);
            if (blockMoves.length > 0) {
                const best = blockMoves[0];
                if (typeof updateBotThinking === 'function') updateBotThinking('Chặn nguy hiểm! 🛡️');
                return { r: best.r, c: best.c };
            }
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
        const sortedCands = this.neuralSortCandidates(candidates, player);

        // Chặn đúng đầu mở bằng BlockBothEndsAnalyzer
        if (typeof BlockBothEndsAnalyzer !== 'undefined') {
            const blockMoves = BlockBothEndsAnalyzer.getBestBlockMoves(opponent, player, winCount, winCount - 2);
            if (blockMoves.length > 0) {
                const best = blockMoves[0];
                if (typeof updateBotThinking === 'function') updateBotThinking('Chặn nguy hiểm! 🛡️');
                return { r: best.r, c: best.c };
            }
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
        const sortedCands = this.neuralSortCandidates(candidates, player);

        // Chặn đúng đầu mở bằng BlockBothEndsAnalyzer
        if (typeof BlockBothEndsAnalyzer !== 'undefined') {
            const blockMoves = BlockBothEndsAnalyzer.getBestBlockMoves(opponent, player, winCount, winCount - 2);
            if (blockMoves.length > 0) {
                const best = blockMoves[0];
                if (typeof updateBotThinking === 'function') updateBotThinking('Chặn nguy hiểm! 🛡️');
                return { r: best.r, c: best.c };
            }
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

            // Collect debug info for DebugPanel
            if (move && typeof DebugPanel !== 'undefined') {
                const moveInfo = {
                    depth: this.config.searchDepth || options.depth || 'N/A',
                    candidates: move.candidates || 'N/A',
                    threatLevel: move.threatLevel || 'N/A',
                    evalScore: move.score || move.evalScore || 'N/A',
                    bestMove: { r: move.r, c: move.c },
                    attackScore: move.attackScore,
                    defenseScore: move.defenseScore,
                    threatInfo: move.threatInfo
                };
                DebugPanel.update(moveInfo);
                DebugPanel.show();

                // Store highlight for bot move (only if enabled in bot room or training mode)
                if (typeof window !== 'undefined') {
                    const shouldHighlight = !window.isBotRoomMode || // Always highlight in training mode
                                           (typeof BotRoomManager !== 'undefined' && BotRoomManager.showBotHighlight);
                    if (shouldHighlight) {
                        window.debugHighlightCell = { r: move.r, c: move.c };
                    } else {
                        window.debugHighlightCell = null;
                    }
                }
            }

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
