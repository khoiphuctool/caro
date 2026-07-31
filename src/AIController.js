// ===== AI CONTROLLER - Điều phối AI =====
// Module điều phối chính, kết nối các module AI
// Thay thế getBotMove() và makeAIMove() từ ai-nao.js

const AIController = {
    // ===== CONFIGURATION =====
    config: {
        useNewArchitecture: true,  // Bật/tắt kiến trúc mới - ĐÃ BẬT, DÙNG PIPELINE SP2
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
            (typeof getBlockBothEnds === 'function' ? getBlockBothEnds() : true);

        // Nếu chế độ bot-super, ưu tiên dùng BotSuper riêng để giữ logic mở đầu và bảng chiến thuật cũ
        if (gameMode === 'bot-super' && typeof BotSuper !== 'undefined' && typeof BotSuper.getBotMove === 'function') {
            console.log('[AIController] Routing bot-super to BotSuper.getBotMove');
            return BotSuper.getBotMove({ player, opponent, winCount, depth: this.config.defaultDepth });
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
            return getBotMove();
        }

        return null;
    },

    // ===== GET BOT MOVE (NEW ARCHITECTURE) =====
    getBotMoveNewArchitecture(options) {
        const { player, opponent, gameMode, winCount, blockBothEnds } = options;

        if (typeof DebugLogger !== 'undefined') {
            DebugLogger.log(DebugLogger.CATEGORY.AI_DECISION, DebugLogger.LEVEL.INFO,
                           'AI pipeline start', { player, gameMode, winCount });
        }

        if (typeof updateBotThinking === 'function') {
            updateBotThinking('Đang phân tích bàn cờ...');
        }

        const candidates = Evaluation.getCandidateMoves(2);
        if (candidates.length === 0) {
            return { r: 0, c: 0 };
        }

        const validCands = candidates.filter(({ r, c }) => {
            const cell = typeof GameState !== 'undefined' ?
                GameState.getBoardCell(r, c) :
                (typeof getCell === 'function' ? getCell(r, c) : "");
            return cell === '';
        });

        if (validCands.length === 0) {
            return { r: 0, c: 0 };
        }

        const legalCands = (typeof ThreatEngine !== 'undefined')
            ? ThreatEngine.filterForbiddenMoves(validCands, player, winCount)
            : validCands;
        const evalCands = legalCands.length > 0 ? legalCands : validCands;

        let forcedMove = null;
        if (typeof ThreatEngine !== 'undefined') {
            const forced = ThreatEngine.getForcedMove(player, opponent, winCount, blockBothEnds);
            if (forced && forced.move) {
                forcedMove = forced.move;

                // Thêm thoại hay từ ai-nao.js
                if (typeof updateBotThinking === 'function') {
                    if (forced.reason === 'Win Now') {
                        updateBotThinking('TÌM THẤY NƯỚC THẮNG! 🎯');
                    } else if (forced.reason === 'Block Win' || forced.reason === 'Block THREE_OPEN') {
                        updateBotThinking('Chặn kịp! 😤');
                    } else if (forced.reason === 'Forced Four') {
                        updateBotThinking('Tạo FOUR thắng chắc! ⚔️');
                    } else if (forced.reason === 'Block Forced Four') {
                        updateBotThinking('Chặn FOUR nguy hiểm! 🚨');
                    } else if (forced.reason === 'Double Threat') {
                        updateBotThinking('Phát hiện fork! ⚡');
                    } else {
                        updateBotThinking('Tìm thấy nước đi tốt! 🎯');
                    }
                }

                const logLine = `Threat Engine → Move (${forcedMove.r},${forcedMove.c}) ${forced.reason} FINAL → (${forcedMove.r},${forcedMove.c})`;
                console.log(logLine);
                if (typeof DebugLogger !== 'undefined') {
                    DebugLogger.log(DebugLogger.CATEGORY.AI_DECISION, DebugLogger.LEVEL.INFO,
                                   'Threat Engine forced move', { move: forcedMove, reason: forced.reason });
                }
                return forcedMove;
            }
        }

        const evaluatedCands = evalCands.map(({ r, c }) => {
            const evaluation = Evaluation.evaluateCell(r, c, player, winCount, blockBothEnds);
            return {
                move: { r, c },
                score: evaluation.score,
                threat: evaluation.threat
            };
        });
        evaluatedCands.sort((a, b) => b.score - a.score);
        const topEvaluations = evaluatedCands.slice(0, Math.min(evaluatedCands.length, 5));

        const searchDepth = this.config.defaultDepth;
        const searchTimeLimit = this.config.defaultTimeLimit;
        const searchResult = Search.findBestMove(player, {
            algorithm: Search.ALGORITHM.PVS,
            depth: searchDepth,
            timeLimit: searchTimeLimit,
            winCount,
            blockBothEnds
        });

        const councilCandidates = topEvaluations.map(c => CouncilAI.createCandidate(
            c.move,
            'Evaluation',
            c.score,
            70,
            'Evaluation'
        ));
        councilCandidates.push(CouncilAI.createCandidate(
            searchResult.move,
            'Search',
            searchResult.score || 0,
            90,
            'Search'
        ));

        // Thêm thoại cho Search
        if (typeof updateBotThinking === 'function') {
            updateBotThinking(`PVS d=${searchDepth} + Quiescence... 🧠`);
        }

        const finalDecision = CouncilAI.decide(councilCandidates, {
            player,
            opponent,
            winCount,
            depth: 3
        });

        const finalMove = finalDecision && finalDecision.move ? finalDecision.move : searchResult.move;
        const evaluationMove = topEvaluations.length > 0 ? topEvaluations[0].move : { r: 0, c: 0 };
        const searchMove = searchResult.move || { r: 0, c: 0 };

        const logLine = `Threat Engine → No Forced Move Evaluation → Move (${evaluationMove.r},${evaluationMove.c}) Score ${Math.round(topEvaluations.length > 0 ? topEvaluations[0].score : 0)} Search → Move (${searchMove.r},${searchMove.c}) PV +${Math.round(searchResult.score || 0)} Council → Verified → Choose (${finalMove.r},${finalMove.c}) FINAL → (${finalMove.r},${finalMove.c})`;
        console.log(logLine);

        if (typeof DebugLogger !== 'undefined') {
            DebugLogger.log(DebugLogger.CATEGORY.AI_DECISION, DebugLogger.LEVEL.INFO,
                           'AI pipeline final decision', {
                               evaluation: topEvaluations,
                               search: searchResult,
                               final: finalMove
                           });
        }

        return finalMove;
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
