// ===== EVALUATION - Scores board positions =====
// This module uses ThreatDetector results to calculate position scores
// It does NOT search for moves - that's the Search module's job

const Evaluation = {
    // ===== EVALUATE A SINGLE CELL =====
    evaluateCell(r, c, player, winCount, blockBothEnds) {
        const opponent = player === 'X' ? 'O' : 'X';
        
        // Get threat assessment
        const threat = ThreatDetector.evaluateThreat(
            r, c, player, opponent, winCount, blockBothEnds
        );

        // Calculate base score
        let score = threat.combined.score;

        // Add center bias
        const centerBias = this.calculateCenterBias(r, c);
        score += centerBias;

        // Add memory penalty (if learning is enabled)
        const memoryPenalty = this.calculateMemoryPenalty(r, c, opponent);
        score -= memoryPenalty;

        // Apply attack priority multiplier when having strong attack
        if (threat.attack.maxThreat >= ThreatDetector.THREAT.HIGH) {
            score *= 1.5;
        }

        // Winning move gets maximum score
        if (threat.attack.hasWinningMove) {
            score = 999999;
        }

        // ══════════════════════════════════════════════════════
        // NEURAL NETWORK BLEND
        // Board-level neural score được tính 1 lần bên ngoài (AIController)
        // Ở đây áp dụng neural contribution để tăng độ chính xác đánh giá
        // Weight 0.30 — đủ để neural có tác động đáng kể mà không át logic cứng
        // ══════════════════════════════════════════════════════
        if (score < 999999 && typeof neuralEvaluator !== 'undefined') {
            try {
                const rawNeural = neuralEvaluator.evaluate(player);
                const neuralContrib = neuralEvaluator.normalizeScore(rawNeural) * Math.abs(score + 1) * 0.30;
                score += neuralContrib;
            } catch (e) { /* neural không ảnh hưởng nếu lỗi */ }
        }

        return {
            r,
            c,
            score,
            threat,
            centerBias,
            memoryPenalty
        };
    },

    // ===== EVALUATE ENTIRE BOARD =====
    evaluateBoard(player, winCount, blockBothEnds) {
        const opponent = player === 'X' ? 'O' : 'X';
        let totalScore = 0;

        // Get candidate moves
        const candidates = this.getCandidateMoves(2);
        
        for (const { r, c } of candidates) {
            const evaluation = this.evaluateCell(r, c, player, winCount, blockBothEnds);
            totalScore += evaluation.score;
        }

        return totalScore;
    },

    // ===== CALCULATE CENTER BIAS =====
    calculateCenterBias(r, c) {
        const isInfinite = typeof GameState !== 'undefined' ? GameState.board.isInfinite : window.isInfinite;
        const infiniteMap = typeof GameState !== 'undefined' ? GameState.board.infiniteMap : window.infiniteMap;
        
        if (!isInfinite || infiniteMap.size === 0) return 0;

        // Calculate actual battle center
        let sr = 0, sc = 0, n = 0;
        for (const key of infiniteMap.keys()) {
            const [kr, kc] = key.split(',').map(Number);
            sr += kr;
            sc += kc;
            n++;
        }

        const cr = sr / n, cc = sc / n;
        const dist = Math.abs(r - cr) + Math.abs(c - cc);
        
        const maxBias = ScoreTable.CENTER_BIAS.MAX;
        const biasDist = ScoreTable.CENTER_BIAS.DISTANCE;

        if (dist >= biasDist) return 0;
        return Math.round(maxBias * (1 - dist / biasDist));
    },

    // ===== CALCULATE MEMORY PENALTY =====
    calculateMemoryPenalty(r, c, opponent) {
        // Use learning system if available
        if (typeof getMemoryPenalty === 'function') {
            return getMemoryPenalty(r, c, opponent);
        }
        return 0;
    },

    // ===== GET CANDIDATE MOVES =====
    getCandidateMoves(range = 2) {
        const isInfinite = typeof GameState !== 'undefined' ? GameState.board.isInfinite : window.isInfinite;
        const boardState = typeof GameState !== 'undefined' ? GameState.board.state : window.boardState;
        const boardSize = typeof GameState !== 'undefined' ? GameState.board.size : window.boardSize;
        const infiniteMap = typeof GameState !== 'undefined' ? GameState.board.infiniteMap : window.infiniteMap;

        let cells = [];

        if (isInfinite) {
            if (infiniteMap.size === 0) return [{ r: 0, c: 0 }];

            let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
            infiniteMap.forEach((v, k) => {
                const [r, c] = k.split(',').map(Number);
                if (r < minR) minR = r;
                if (r > maxR) maxR = r;
                if (c < minC) minC = c;
                if (c > maxC) maxC = c;
            });

            const margin = range;
            for (let r = minR - margin; r <= maxR + margin; r++) {
                for (let c = minC - margin; c <= maxC + margin; c++) {
                    const key = `${r},${c}`;
                    if (!infiniteMap.has(key)) {
                        if (this.hasNeighbor(r, c, range, infiniteMap)) {
                            cells.push({ r, c });
                        }
                    }
                }
            }
        } else {
            let hasAny = false;
            for (let r = 0; r < boardSize && !hasAny; r++) {
                for (let c = 0; c < boardSize; c++) {
                    if (boardState[r][c] !== "") {
                        hasAny = true;
                        break;
                    }
                }
            }

            if (!hasAny) {
                return [{ r: Math.floor(boardSize / 2), c: Math.floor(boardSize / 2) }];
            }

            for (let r = 0; r < boardSize; r++) {
                for (let c = 0; c < boardSize; c++) {
                    if (boardState[r][c] === "" && this.hasNeighbor(r, c, range)) {
                        cells.push({ r, c });
                    }
                }
            }
        }

        // Limit candidates and sort by quick score
        const MAX_CANDIDATES = 50;
        if (cells.length > MAX_CANDIDATES) {
            cells.sort((a, b) => this.quickScore(b.r, b.c) - this.quickScore(a.r, a.c));
            return cells.slice(0, MAX_CANDIDATES);
        }

        return cells;
    },

    // ===== HAS NEIGHBOR =====
    hasNeighbor(r, c, range, infiniteMap = null) {
        const getCellFn = typeof GameState !== 'undefined' ? 
            (rr, cc) => GameState.getBoardCell(rr, cc) : 
            (typeof getCell === 'function' ? getCell : null);

        if (!getCellFn) return false;

        const map = infiniteMap || (typeof GameState !== 'undefined' ? GameState.board.infiniteMap : window.infiniteMap);

        for (let dr = -range; dr <= range; dr++) {
            for (let dc = -range; dc <= range; dc++) {
                if (dr === 0 && dc === 0) continue;
                const val = getCellFn(r + dr, c + dc);
                if (val !== "" && val !== "W") return true;
            }
        }
        return false;
    },

    // ===== QUICK SCORE (for candidate sorting) =====
    quickScore(r, c) {
        // Simple heuristic for sorting candidates
        const centerBias = this.calculateCenterBias(r, c);
        return centerBias;
    },

    // ===== FIND BEST MOVE FROM CANDIDATES =====
    findBestMove(candidates, player, winCount, blockBothEnds) {
        let bestMove = null;
        let bestScore = -Infinity;
        let bestThreat = null;

        for (const { r, c } of candidates) {
            const evaluation = this.evaluateCell(r, c, player, winCount, blockBothEnds);
            
            if (evaluation.score > bestScore) {
                bestScore = evaluation.score;
                bestMove = { r, c };
                bestThreat = evaluation.threat;
            }
        }

        return {
            move: bestMove,
            score: bestScore,
            threat: bestThreat
        };
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Evaluation;
}
