// ══════════════════════════════════════════════════════════════════
// BOT THẦN CƠ V2 - Refactored Architecture
// ══════════════════════════════════════════════════════════════════
// Kiến trúc mới: Fast Path + Deep Path
// - Fast Path: Intent Router → Context Builder → Quick Evaluator → Response Optimizer
// - Deep Path: Intent Router → Context Builder → Dynamic Planner → Tool Executor → Reflection → Response Optimizer
// ══════════════════════════════════════════════════════════════════

const BotSuperV2 = {
    // ===== CONFIGURATION =====
    config: {
        // Search depth cho Deep Path
        searchDepth: 5,
        
        // Enable/disable new architecture
        useNewArchitecture: true
    },

    // ===== MAIN GET BOT MOVE =====
    getBotMove(options = {}) {
        const player = options.player || botPiece || 'O';
        const opponent = options.opponent || humanPiece || 'X';
        
        // console.log('[BotSuperV2] getBotMove called', { player, opponent });

        // ══════════════════════════════════════════════════════════════════
        // NEW ARCHITECTURE: Intent Router → Context Builder → ...
        // ══════════════════════════════════════════════════════════════════
        const result = this.config.useNewArchitecture
            ? this.getBotMoveNewArchitecture(options)
            : this.getBotMoveOldArchitecture(options);

        return this.normalizeMove(result, options);
    },

    normalizeMove(result, options = {}) {
        const candidate = result && result.move ? result.move : result;
        if (!candidate || !Number.isInteger(candidate.r) || !Number.isInteger(candidate.c)) {
            return null;
        }

        const player = options.player || botPiece || 'O';
        const reason = result && result.reason ? result.reason : 'search';
        return {
            row: candidate.r,
            col: candidate.c,
            score: Number.isFinite(result && result.score) ? result.score : 0,
            reason,
            source: 'BotSuperV2'
        };
    },

    // ===== NEW ARCHITECTURE =====
    getBotMoveNewArchitecture(options) {
        // console.log('[BotSuperV2] Using new architecture');

        // Direct callers (for example bot-room) can enter this path without
        // passing through ai-nao.js P1/P2. Use the shared tactical preflight.
        const player = options.player || botPiece || 'O';
        const opponent = options.opponent || humanPiece || 'X';
        const rules = options.roomRules || (typeof GameState !== 'undefined' ? GameState.roomRules : undefined);
        const winCount = rules && typeof rules.winCount === 'number' ? rules.winCount : 5;
        if (typeof BlockBothEndsAnalyzer !== 'undefined') {
            const blockRules = { winCount, chan2Dau: !!(rules && rules.chan2Dau) };
            const immediate = BlockBothEndsAnalyzer.getPriorityTacticalMove(player, opponent, blockRules);
            if (immediate) {
                // console.log('[BotSuperV2] Shared immediate tactical move:', immediate);
                return { r: immediate.r, c: immediate.c, reason: immediate.reason };
            }
            const openEndBlock = BlockBothEndsAnalyzer.getOpenEndBlockMove(player, opponent, blockRules);
            if (openEndBlock) {
                // console.log('[BotSuperV2] Shared open-end block move:', openEndBlock);
                return { r: openEndBlock.r, c: openEndBlock.c, reason: openEndBlock.reason };
            }
        }

        // Step 1: Context Builder
        const context = ContextBuilder.build(options);
        
        // Check cache hit
        if (context.cacheHit) {
            // console.log('[BotSuperV2] Cache hit, returning cached move');
            SemanticCache.recordHit();
            return context.cacheHit.move;
        }
        SemanticCache.recordMiss();

        // Step 2: Intent Router
        const pipeline = IntentRouter.route(context);
        // console.log('[BotSuperV2] Pipeline selected:', pipeline);

        // Step 3: Execute based on pipeline
        let result;
        if (pipeline === 'FAST') {
            result = this.executeFastPath(context);
        } else {
            result = this.executeDeepPath(context, options);
        }

        // Step 4: Response Optimizer
        if (result && result.move) {
            const optimized = ResponseOptimizer.optimize(result.move, context, result.reason);
            if (optimized) {
                return optimized;
            }
        }

        // Fallback
        // console.warn('[BotSuperV2] New architecture failed, using fallback');
        return this.getBotMoveOldArchitecture(options);
    },

    // ===== FAST PATH =====
    executeFastPath(context) {
        // console.log('[BotSuperV2] Executing Fast Path');

        // Quick Evaluator
        const result = QuickEvaluator.evaluate(context);
        
        if (result) {
            // console.log('[BotSuperV2] Fast Path found move:', result);
            return result;
        }

        // Fast Path không tìm được move -> cần Deep Path
        // console.log('[BotSuperV2] Fast Path no move, switching to Deep Path');
        return null;
    },

    // ===== DEEP PATH =====
    executeDeepPath(context, options) {
        // console.log('[BotSuperV2] Executing Deep Path');

        const { player, opponent, rules } = context;
        const depth = options.depth || this.config.searchDepth;

        const allEmpty = typeof getAllTacticalCells === 'function' ? getAllTacticalCells() : [];
        const validCands = allEmpty.filter(({ r, c }) => getCell(r, c) === '');

        if (validCands.length === 0) {
            return null;
        }

        // Stronger-than-top-bot rule: prefer the existing god/tactical engine
        // before falling back to simplified quick scoring. This keeps SuperBot on
        // the same tactical quality as the legacy high-end engine.
        if (typeof godEngineMove === 'function') {
            try {
                const godMove = godEngineMove(player, opponent, validCands, true);
                if (godMove && godMove.move && getCell(godMove.move.r, godMove.move.c) === '') {
                    // console.log('[BotSuperV2] Selected high-end tactical move from godEngine:', godMove);
                    return { move: { r: godMove.move.r, c: godMove.move.c }, reason: godMove.reason || 'God Engine Tactical' };
                }
            } catch (e) {
                // console.warn('[BotSuperV2] godEngineMove failed:', e);
            }
        }

        // Lightning bot is also a strong tactical generator and often outperforms a
        // weak quick-scan candidate list.
        if (typeof BotTiaChop !== 'undefined' && typeof BotTiaChop.getBotMove === 'function') {
            try {
                const tiaMove = BotTiaChop.getBotMove({
                    player,
                    opponent,
                    roomRules: { winCount: rules && typeof rules.winCount === 'number' ? rules.winCount : 5, chan2Dau: !!(rules && rules.chan2Dau) }
                });
                if (tiaMove && Number.isInteger(tiaMove.r) && Number.isInteger(tiaMove.c) && getCell(tiaMove.r, tiaMove.c) === '') {
                    // console.log('[BotSuperV2] Selected Lightning tactical move:', tiaMove);
                    return { move: { r: tiaMove.r, c: tiaMove.c }, reason: 'BotTiaChop tactical' };
                }
            } catch (e) {
                // console.warn('[BotSuperV2] BotTiaChop tactical generator failed:', e);
            }
        }

        let ultimateMove = null;
        let ultimateScore = 0;
        let ultimateReason = '';

        if (typeof getBestMoveWithMinimax === 'function') {
            try {
                const minimaxMove = getBestMoveWithMinimax(depth, player);
                if (minimaxMove && getCell(minimaxMove.r, minimaxMove.c) === '') {
                    ultimateMove = minimaxMove;
                    ultimateScore = typeof quickScore === 'function' ? quickScore(minimaxMove.r, minimaxMove.c, player) : 8000;
                    ultimateReason = 'PVS Deep Search';
                }
            } catch (e) {
                // console.warn('[BotSuperV2] Minimax failed:', e);
            }
        }

        if (!ultimateMove) {
            const scored = [];
            for (const { r, c } of validCands.slice(0, 30)) {
                const res = typeof evalCellFull === 'function' ? evalCellFull(r, c, player, true) : null;
                const atk = res ? res.score : (typeof quickScore === 'function' ? quickScore(r, c, player) : 0);
                scored.push({ r, c, atk });
            }
            if (scored.length > 0) {
                scored.sort((a, b) => b.atk - a.atk);
                ultimateMove = scored[0];
                ultimateScore = scored[0].atk;
                ultimateReason = 'Quick Scoring';
            }
        }

        if (ultimateMove) {
            return { move: ultimateMove, reason: ultimateReason };
        }

        return { move: validCands[0], reason: 'Final fallback' };
    },

    // ===== OLD ARCHITECTURE (Fallback) =====
    getBotMoveOldArchitecture(options) {
        // console.log('[BotSuperV2] Using old architecture (fallback)');

        const player = options.player || botPiece || 'O';
        const opponent = options.opponent || humanPiece || 'X';
        const resolved = options.roomRules ?? (typeof GameState !== 'undefined' ? GameState.roomRules : undefined) ?? (typeof window !== 'undefined' ? window.roomRules : undefined);
        let wc;
        if (resolved && typeof resolved.winCount === 'number') wc = resolved.winCount;
        else if (typeof options.winCount === 'number') wc = options.winCount;
        else if (typeof GameState !== 'undefined' && GameState.board && typeof GameState.board.winCount === 'number') wc = GameState.board.winCount;
        else {
            // console.warn('[BotSuperV2] winCount not found in roomRules/options/GameState; bot may behave unexpectedly. Pass roomRules to getBotMove.');
            wc = typeof winCount !== 'undefined' ? winCount : undefined;
        }
        const depth = options.depth || this.config.searchDepth;

        if (typeof BlockBothEndsAnalyzer !== 'undefined') {
            const blockRules = { winCount: wc, chan2Dau: !!(resolved && resolved.chan2Dau) };
            const immediate = BlockBothEndsAnalyzer.getPriorityTacticalMove(player, opponent, blockRules);
            if (immediate) {
                // console.log('[BotSuperV2 Old] Shared immediate tactical move:', immediate);
                return immediate;
            }
        }

        // console.log('[BotSuperV2 Old] getBotMove', { player, opponent, winCount: wc, depth });

        // Layer 0: Nước đầu - random trung tâm
        const moveCount = typeof moveHistory !== 'undefined' ? moveHistory.length : 0;
        if (moveCount <= 2) {
            const allCands = typeof getSearchCandidates === 'function' ? getSearchCandidates() : [];
            if (allCands.length > 0) {
                const pool = allCands.slice(0, Math.max(1, Math.ceil(allCands.length / 2)));
                const randomMove = pool[Math.floor(Math.random() * pool.length)];
                // console.log('[BotSuperV2 Old] Early random move:', randomMove);
                return randomMove;
            }
        }

        // Layer 1: Immediate Tactical Scan
        const allEmpty = typeof getAllTacticalCells === 'function' ? getAllTacticalCells() : [];
        
        // 1a. Win Now
        for (const { r, c } of allEmpty) {
            if (getCell(r, c) !== '') continue;
            setCell(r, c, player);
            const win = checkWinSilent(r, c, (typeof GameState !== 'undefined' && GameState.roomRules) ? GameState.roomRules : window.roomRules);
            setCell(r, c, '');
            if (win) {
                // console.log('[BotSuperV2 Old] Win now:', { r, c });
                return { r, c };
            }
        }

        // 1b. Block Win
        for (const { r, c } of allEmpty) {
            if (getCell(r, c) !== '') continue;
            setCell(r, c, opponent);
            const win = checkWinSilent(r, c, (typeof GameState !== 'undefined' && GameState.roomRules) ? GameState.roomRules : window.roomRules);
            setCell(r, c, '');
            if (win) {
                // console.log('[BotSuperV2 Old] Block win:', { r, c });
                return { r, c };
            }
        }
        // NOTE: Chặn FOUR đúng đầu mở đã được P3 (BlockBothEndsAnalyzer) trong getBotMove() xử lý trước.

        // 1c. CHẶN THREE/FOUR ĐÚNG ĐẦU MỞ — dùng BlockBothEndsAnalyzer
        if (typeof BlockBothEndsAnalyzer !== 'undefined') {
            const blockRules = { winCount: wc, chan2Dau: !!(resolved && resolved.chan2Dau) };
            const blockMoves = BlockBothEndsAnalyzer.getBestBlockMoves(opponent, player, blockRules, wc - 2);
            if (blockMoves.length > 0) {
                const best = blockMoves[0];
                if (best.chainCount >= wc - 2) {
                    // console.log('[BotSuperV2 Old] BlockBothEndsAnalyzer block open end:', best);
                    return { r: best.r, c: best.c };
                }
            }
        }

        // 1d. CHECK BOT WIN OPPORTUNITY
        let bestForced = null, bestForcedS = -Infinity;
        for (const { r, c } of allEmpty) {
            setCell(r, c, player);
            let makesFour = false;
            if (typeof DIRECTIONS !== 'undefined') {
                for (const { dr, dc } of DIRECTIONS) {
                    if (typeof countLineAndBlocked === 'function') {
                        const { count, blockedBoth } = countLineAndBlocked(r, c, dr, dc, player);
                        if (count === wc - 1 && !blockedBoth) { makesFour = true; break; }
                    }
                }
            }
            setCell(r, c, '');
            if (!makesFour) continue;
            if (typeof countWinningCompletionEnds === 'function') {
                if (countWinningCompletionEnds(r, c, player) >= 2) {
                    const s = typeof quickScore === 'function' ? quickScore(r, c, player) : 0;
                    if (s > bestForcedS) { bestForcedS = s; bestForced = { r, c }; }
                }
            }
        }
        if (bestForced) {
            // console.log('[BotSuperV2 Old] Win opportunity - Forced four:', bestForced);
            return bestForced;
        }

        // Check Fork/Double Threat
        if (typeof ThreatDetector !== 'undefined') {
            for (const { r, c } of allEmpty) {
                const t = ThreatDetector.evaluateAttackThreat(r, c, player, wc, true);
                if (t.maxThreat >= ThreatDetector.THREAT.HIGH) {
                    let threatCount = 0;
                    for (const { pattern } of t.patternScores) {
                        if (pattern !== PatternDetector.PATTERN.NONE) {
                            threatCount++;
                        }
                    }
                    if (threatCount >= 2) {
                        // console.log('[BotSuperV2 Old] Win opportunity - Fork:', { r, c });
                        return { r, c };
                    }
                }
            }
        }

        // Check FOUR_OPEN
        if (typeof ThreatDetector !== 'undefined') {
            for (const { r, c } of allEmpty) {
                const t = ThreatDetector.evaluateAttackThreat(r, c, player, wc, true);
                const hasFourOpen = t.patternScores.some(p => 
                    p.pattern === PatternDetector.PATTERN.FOUR_OPEN
                );
                if (hasFourOpen) {
                    // console.log('[BotSuperV2 Old] Win opportunity - FOUR_OPEN:', { r, c });
                    return { r, c };
                }
            }
        }

        // Smart Blocking — đã được 1c xử lý bởi BlockBothEndsAnalyzer ở trên

        // Layer 2: Collect Candidates
        const candidates = [];

        // Candidate từ BotTiaChop
        if (typeof BotTiaChop !== 'undefined' && typeof BotTiaChop.getBotMove === 'function') {
            try {
                const tiaChopMove = BotTiaChop.getBotMove({
                    player: player,
                    opponent: opponent,
                    roomRules: { winCount: wc, chan2Dau: (resolved && typeof resolved.chan2Dau !== 'undefined') ? !!resolved.chan2Dau : true }
                });
                if (tiaChopMove && tiaChopMove.r !== undefined && tiaChopMove.c !== undefined) {
                    if (getCell(tiaChopMove.r, tiaChopMove.c) === '') {
                        candidates.push({
                            move: tiaChopMove,
                            source: 'Lightning',
                            score: 9500,
                            confidence: 85,
                            reason: 'BotTiaChop scoring system'
                        });
                    }
                }
            } catch (e) {
                // console.warn('[BotSuperV2 Old] BotTiaChop failed:', e);
            }
        }

        // Candidate từ Ultimate
        const validCands = allEmpty.filter(({ r, c }) => getCell(r, c) === '');
        if (validCands.length > 0) {
            let ultimateMove = null;
            let ultimateScore = 0;
            let ultimateReason = '';

            if (typeof getBestMoveWithMinimax === 'function') {
                try {
                    const minimaxMove = getBestMoveWithMinimax(depth, player);
                    if (minimaxMove && getCell(minimaxMove.r, minimaxMove.c) === '') {
                        ultimateMove = minimaxMove;
                        ultimateScore = typeof quickScore === 'function' ? quickScore(minimaxMove.r, minimaxMove.c, player) : 8000;
                        ultimateReason = 'PVS Deep Search';
                    }
                } catch (e) {
                    // console.warn('[BotSuperV2 Old] Minimax failed:', e);
                }
            }

            if (!ultimateMove) {
                const scored = [];
                for (const { r, c } of validCands.slice(0, 15)) {
                    const res = typeof evalCellFull === 'function' ? evalCellFull(r, c, player, true) : null;
                    const atk = res ? res.score : (typeof quickScore === 'function' ? quickScore(r, c, player) : 0);
                    scored.push({ r, c, atk });
                }
                if (scored.length > 0) {
                    scored.sort((a, b) => b.atk - a.atk);
                    ultimateMove = scored[0];
                    ultimateScore = scored[0].atk;
                    ultimateReason = 'Quick Scoring';
                }
            }

            if (ultimateMove) {
                candidates.push({
                    move: ultimateMove,
                    source: 'Ultimate',
                    score: ultimateScore,
                    confidence: 90,
                    reason: ultimateReason
                });
            }
        }

        // Layer 3: Simple decision (không dùng CouncilAI)
        if (candidates.length > 0) {
            // Sort by score
            candidates.sort((a, b) => b.score - a.score);
            // console.log('[BotSuperV2 Old] Selected best candidate:', candidates[0]);
            return candidates[0].move;
        }

        // Layer 4: Fallback
        if (candidates.length > 0) {
            return candidates[0].move;
        }

        // console.warn('[BotSuperV2 Old] No candidates found, returning null');
        return null;
    }
};

// Export
window.BotSuperV2 = BotSuperV2;
