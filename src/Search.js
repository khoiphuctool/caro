// ===== SEARCH - Finds best move using various algorithms =====
// This module uses Evaluation results to search for the best move
// It implements different search algorithms (PVS, MCTS, Minimax, etc.)

const Search = {
    // Search algorithms
    ALGORITHM: {
        PVS: 'pvs',           // Principal Variation Search
        MCTS: 'mcts',         // Monte Carlo Tree Search
        MINIMAX: 'minimax',   // Standard Minimax
        ALPHA_BETA: 'alphabeta' // Alpha-Beta Pruning
    },

    // ===== SEARCH FOR BEST MOVE =====
    findBestMove(player, options = {}) {
        const {
            algorithm = this.ALGORITHM.PVS,
            depth = 5,
            timeLimit = 2000,
            winCount = 5,
            blockBothEnds = true
        } = options;

        // Log search start
        this.logSearchStart(algorithm, depth, timeLimit);

        const startTime = Date.now();
        let result;

        switch (algorithm) {
            case this.ALGORITHM.PVS:
                result = this.pvsSearch(player, depth, timeLimit, winCount, blockBothEnds);
                break;
            case this.ALGORITHM.MCTS:
                result = this.mctsSearch(player, timeLimit, winCount, blockBothEnds);
                break;
            case this.ALGORITHM.MINIMAX:
                result = this.minimaxSearch(player, depth, timeLimit, winCount, blockBothEnds);
                break;
            case this.ALGORITHM.ALPHA_BETA:
                result = this.alphaBetaSearch(player, depth, timeLimit, winCount, blockBothEnds);
                break;
            default:
                result = this.pvsSearch(player, depth, timeLimit, winCount, blockBothEnds);
        }

        const endTime = Date.now();
        const searchTime = endTime - startTime;

        // Log search result
        this.logSearchResult(result, searchTime, algorithm);

        return result;
    },

    // ===== PRINCIPAL VARIATION SEARCH =====
    pvsSearch(player, depth, timeLimit, winCount, blockBothEnds) {
        const startTime = Date.now();
        const candidates = Evaluation.getCandidateMoves(2);
        
        if (candidates.length === 0) {
            return { move: { r: 0, c: 0 }, score: 0, algorithm: this.ALGORITHM.PVS };
        }

        // Sort candidates by quick evaluation
        candidates.sort((a, b) => 
            Evaluation.evaluateCell(b.r, b.c, player, winCount, blockBothEnds).score -
            Evaluation.evaluateCell(a.r, a.c, player, winCount, blockBothEnds).score
        );

        const maxCandidates = Math.min(candidates.length, depth > 3 ? 6 : 10);
        const searchCandidates = candidates.slice(0, maxCandidates);

        let bestMove = null;
        let bestScore = -Infinity;

        for (const { r, c } of searchCandidates) {
            if (Date.now() - startTime > timeLimit) break;

            // Simulate move
            const oldValue = this.simulateMove(r, c, player);
            
            // Search
            const score = this.pvs(depth - 1, -Infinity, Infinity, false, player, 
                                    startTime, timeLimit, 1, winCount, blockBothEnds);
            
            // Undo move
            this.undoMove(r, c, oldValue);

            if (score > bestScore) {
                bestScore = score;
                bestMove = { r, c };
            }

            // If we found a winning move, return immediately
            if (score >= 1000000) break;
        }

        return {
            move: bestMove || searchCandidates[0],
            score: bestScore,
            algorithm: this.ALGORITHM.PVS
        };
    },

    // ===== PVS RECURSIVE =====
    pvs(depth, alpha, beta, isMaximizing, player, startTime, timeLimit, currentDepth, winCount, blockBothEnds) {
        if (Date.now() - startTime > timeLimit) return 0;

        // Check transposition table
        const hash = this.getBoardHash();
        const ttResult = this.ttLookup(hash, depth, alpha, beta);
        if (ttResult !== null) return ttResult;

        // Terminal conditions
        if (depth === 0) {
            const evalScore = Evaluation.evaluateBoard(player, winCount, blockBothEnds);
            this.ttStore(hash, depth, evalScore, 'exact');
            return evalScore;
        }

        const winner = this.checkWinner();
        if (winner === player) {
            const s = 1000000 + depth;
            this.ttStore(hash, depth, s, 'exact');
            return s;
        }
        if (winner !== null) {
            const s = -1000000 - depth;
            this.ttStore(hash, depth, s, 'exact');
            return s;
        }

        const candidates = Evaluation.getCandidateMoves(2);
        if (candidates.length === 0) {
            this.ttStore(hash, depth, 0, 'exact');
            return 0;
        }

        // Sort candidates with killer moves
        this.sortCandidates(candidates, player, currentDepth, winCount, blockBothEnds);

        const maxCandidates = Math.min(candidates.length, depth > 3 ? 6 : 10);
        const searchCandidates = candidates.slice(0, maxCandidates);
        const opponent = player === 'X' ? 'O' : 'X';

        let bestScore = isMaximizing ? -Infinity : Infinity;
        let firstMove = true;

        for (const { r, c } of searchCandidates) {
            const oldValue = this.simulateMove(r, c, isMaximizing ? player : opponent);
            
            let score;
            if (firstMove) {
                score = this.pvs(depth - 1, alpha, beta, !isMaximizing, player, 
                                startTime, timeLimit, currentDepth + 1, winCount, blockBothEnds);
                firstMove = false;
            } else if (isMaximizing) {
                score = this.pvs(depth - 1, alpha, alpha + 1, false, player, 
                                startTime, timeLimit, currentDepth + 1, winCount, blockBothEnds);
                if (score > alpha) {
                    score = this.pvs(depth - 1, alpha, beta, false, player, 
                                    startTime, timeLimit, currentDepth + 1, winCount, blockBothEnds);
                }
            } else {
                score = this.pvs(depth - 1, beta - 1, beta, true, player, 
                                startTime, timeLimit, currentDepth + 1, winCount, blockBothEnds);
                if (score < beta) {
                    score = this.pvs(depth - 1, alpha, beta, true, player, 
                                    startTime, timeLimit, currentDepth + 1, winCount, blockBothEnds);
                }
            }

            this.undoMove(r, c, oldValue);

            if (isMaximizing) {
                if (score > bestScore) bestScore = score;
                alpha = Math.max(alpha, score);
            } else {
                if (score < bestScore) bestScore = score;
                beta = Math.min(beta, score);
            }

            if (beta <= alpha) {
                this.addKillerMove(currentDepth, r, c);
                break;
            }
        }

        const flag = bestScore <= alpha ? 'upper' : bestScore >= beta ? 'lower' : 'exact';
        this.ttStore(hash, depth, bestScore, flag);
        return bestScore;
    },

    // ===== MCTS SEARCH =====
    mctsSearch(player, timeLimit, winCount, blockBothEnds) {
        const startTime = Date.now();
        const candidates = Evaluation.getCandidateMoves(2);
        
        if (candidates.length === 0) {
            return { move: { r: 0, c: 0 }, score: 0, algorithm: this.ALGORITHM.MCTS };
        }

        const searchCandidates = candidates.slice(0, Math.min(candidates.length, 12));
        const root = this.createMCTSRoot(searchCandidates);
        
        let iterations = 0;
        while (Date.now() - startTime < timeLimit && iterations < 10000) {
            this.mctsIteration(root, player, winCount);
            iterations++;
        }

        const bestChild = this.selectBestMCTSChild(root);
        const move = bestChild ? { r: bestChild.r, c: bestChild.c } : searchCandidates[0];

        return {
            move,
            score: bestChild ? bestChild.wins / bestChild.visits : 0,
            algorithm: this.ALGORITHM.MCTS,
            iterations
        };
    },

    // ===== MCTS ITERATION =====
    mctsIteration(root, player, winCount) {
        const path = [root];
        const pathMoves = [];
        let node = root;
        let currentPlayer = player;

        // Selection
        while (node.children.length > 0 && node.untriedMoves.length === 0) {
            node = this.selectUCB1Child(node);
            path.push(node);
            if (node.r !== null) {
                this.simulateMove(node.r, node.c, currentPlayer);
                pathMoves.push({ r: node.r, c: node.c });
                currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
            }
        }

        // Expansion
        if (node.untriedMoves.length > 0) {
            const moveIdx = Math.floor(Math.random() * node.untriedMoves.length);
            const move = node.untriedMoves.splice(moveIdx, 1)[0];
            this.simulateMove(move.r, move.c, currentPlayer);
            pathMoves.push({ r: move.r, c: move.c });
            const childNode = this.createMCTSNode(move.r, move.c, node);
            node.children.push(childNode);
            path.push(childNode);
            node = childNode;
        }

        // Simulation
        const result = this.simulateRandomPlayout(currentPlayer, winCount);

        // Backpropagation
        for (const pathNode of path) {
            pathNode.visits++;
            if (result === player) pathNode.wins++;
        }

        // Undo moves
        for (let i = pathMoves.length - 1; i >= 0; i--) {
            this.undoMove(pathMoves[i].r, pathMoves[i].c, '');
        }
    },

    // ===== SIMULATE RANDOM PLAYOUT =====
    simulateRandomPlayout(player, winCount) {
        let moves = 0;
        const simMoves = [];
        let currentPlayer = player;

        while (moves < 50) {
            const candidates = Evaluation.getCandidateMoves(2);
            if (candidates.length === 0) break;

            const move = candidates[Math.floor(Math.random() * candidates.length)];
            this.simulateMove(move.r, move.c, currentPlayer);
            simMoves.push({ r: move.r, c: move.c });

            if (ThreatDetector.isWinningMove(move.r, move.c, currentPlayer, winCount)) {
                // Undo all simulation moves
                for (const m of simMoves) {
                    this.undoMove(m.r, m.c, '');
                }
                return currentPlayer;
            }

            currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
            moves++;
        }

        // Undo all simulation moves
        for (const m of simMoves) {
            this.undoMove(m.r, m.c, '');
        }
        return null;
    },

    // ===== MCTS NODE HELPERS =====
    createMCTSRoot(candidates) {
        return {
            r: null,
            c: null,
            children: [],
            wins: 0,
            visits: 0,
            untriedMoves: [...candidates]
        };
    },

    createMCTSNode(r, c, parent) {
        return {
            r,
            c,
            parent,
            children: [],
            wins: 0,
            visits: 0,
            untriedMoves: []
        };
    },

    selectUCB1Child(node) {
        let bestChild = null;
        let bestUCB = -Infinity;

        for (const child of node.children) {
            const ucb = child.visits === 0 ? Infinity :
                       (child.wins / child.visits) + 
                       1.41 * Math.sqrt(Math.log(node.visits) / child.visits);
            if (ucb > bestUCB) {
                bestUCB = ucb;
                bestChild = child;
            }
        }
        return bestChild;
    },

    selectBestMCTSChild(root) {
        let bestChild = null;
        let bestVisits = -1;

        for (const child of root.children) {
            if (child.visits > bestVisits) {
                bestVisits = child.visits;
                bestChild = child;
            }
        }
        return bestChild;
    },

    // ===== MINIMAX SEARCH =====
    minimaxSearch(player, depth, timeLimit, winCount, blockBothEnds) {
        return this.pvsSearch(player, depth, timeLimit, winCount, blockBothEnds);
    },

    // ===== ALPHA-BETA SEARCH =====
    alphaBetaSearch(player, depth, timeLimit, winCount, blockBothEnds) {
        return this.pvsSearch(player, depth, timeLimit, winCount, blockBothEnds);
    },

    // ===== BOARD HELPERS =====
    simulateMove(r, c, player) {
        const oldValue = this.getCellValue(r, c);
        this.setCellValue(r, c, player);
        return oldValue;
    },

    undoMove(r, c, oldValue) {
        this.setCellValue(r, c, oldValue);
    },

    getCellValue(r, c) {
        if (typeof GameState !== 'undefined') {
            return GameState.getBoardCell(r, c);
        }
        if (typeof getCell === 'function') {
            return getCell(r, c);
        }
        return "";
    },

    setCellValue(r, c, value) {
        if (typeof GameState !== 'undefined') {
            GameState.setBoardState(r, c, value);
        } else if (typeof setCell === 'function') {
            setCell(r, c, value);
        }
    },

    getBoardHash() {
        if (typeof generateBoardHash === 'function') {
            return generateBoardHash();
        }
        return 0;
    },

    checkWinner() {
        if (typeof checkBoardWinner === 'function') {
            return checkBoardWinner();
        }
        return null;
    },

    // ===== TRANSPOSITION TABLE HELPERS =====
    ttLookup(hash, depth, alpha, beta) {
        if (typeof ttLookup === 'function') {
            return ttLookup(hash, depth, alpha, beta);
        }
        return null;
    },

    ttStore(hash, depth, value, flag) {
        if (typeof ttStore === 'function') {
            ttStore(hash, depth, value, flag);
        }
    },

    // ===== KILLER MOVE HELPERS =====
    addKillerMove(depth, r, c) {
        if (typeof addKillerMove === 'function') {
            addKillerMove(depth, r, c);
        }
    },

    sortCandidates(candidates, player, depth, winCount, blockBothEnds) {
        candidates.sort((a, b) => {
            const aKiller = this.isKillerMove(depth, a.r, a.c);
            const bKiller = this.isKillerMove(depth, b.r, b.c);
            if (aKiller && !bKiller) return -1;
            if (!aKiller && bKiller) return 1;
            
            const aScore = Evaluation.evaluateCell(a.r, a.c, player, winCount, blockBothEnds).score;
            const bScore = Evaluation.evaluateCell(b.r, b.c, player, winCount, blockBothEnds).score;
            return bScore - aScore;
        });
    },

    isKillerMove(depth, r, c) {
        if (typeof isKillerMove === 'function') {
            return isKillerMove(depth, r, c);
        }
        return false;
    },

    // ===== LOGGING HELPERS =====
    logSearchStart(algorithm, depth, timeLimit) {
        if (typeof GameState !== 'undefined' && GameState.debug.enabled) {
            GameState.log('info', `Search started: ${algorithm}, depth=${depth}, timeLimit=${timeLimit}ms`);
        }
    },

    logSearchResult(result, searchTime, algorithm) {
        if (typeof GameState !== 'undefined' && GameState.debug.enabled) {
            GameState.log('info', `Search completed: move=(${result.move?.r},${result.move?.c}), score=${result.score?.toFixed(2)}, time=${searchTime}ms, algorithm=${algorithm}`);
        }
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Search;
}
