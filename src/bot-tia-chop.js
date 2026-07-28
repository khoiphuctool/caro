// ===== BOT TIA CHỚP - Lightning Bot =====
// Ported from mevivu.com game.js
// Simple but effective evaluation-based AI

const BotTiaChop = {
    // ===== CONFIGURATION =====
    config: {
        winningMove: 9999999,
        openFour: 8888888,
        twoThrees: 7777777,
        weights: [0, 20, 17, 15.4, 14, 10]
    },

    // ===== GET BOT MOVE =====
    // Main function to get bot move
    getBotMove(options = {}) {
        console.log('[BotTiaChop] getBotMove called with options:', options);
        const player = options.player ?? (typeof botPiece !== 'undefined' ? botPiece : 'O');
        const opponent = options.opponent ?? (typeof humanPiece !== 'undefined' ? humanPiece : 'X');
        const winCount = options.winCount ?? 5;

        // Get board state
        const board = this.getBoardState();
        const size = this.getBoardSize();

        console.log('[BotTiaChop] board size:', size, 'board bounds:', { minR: board.minR, maxR: board.maxR, minC: board.minC, maxC: board.maxC });

        // Initialize evaluation arrays (sparse)
        const s = {}; // Attack scores
        const q = {}; // Defense scores

        // Evaluate positions
        const maxS = this.evaluatePos(s, player, board, winCount);
        const maxQ = this.evaluatePos(q, opponent, board, winCount);

        console.log('[BotTiaChop] maxS:', maxS, 'maxQ:', maxQ);

        // Find best move
        let bestMove = null;

        if (maxQ >= maxS) {
            // Defense is more important
            bestMove = this.findBestMove(s, maxQ, q, board);
        } else {
            // Attack is more important
            bestMove = this.findBestMove(q, maxS, s, board);
        }

        console.log('[BotTiaChop] bestMove:', bestMove);

        // Fallback to center if no move found
        if (!bestMove) {
            const center = Math.floor(size / 2);
            console.log('[BotTiaChop] No move found, returning center:', center);
            return { r: center, c: center };
        }

        return { r: bestMove[0], c: bestMove[1] };
    },

    // ===== GET BOARD STATE =====
    getBoardState() {
        // Use infiniteMap directly (the system uses infinite board)
        if (typeof window !== 'undefined' && window.infiniteMap) {
            // Calculate bounds from infiniteMap
            let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
            window.infiniteMap.forEach((value, key) => {
                const [r, c] = key.split(',').map(Number);
                if (r < minR) minR = r;
                if (r > maxR) maxR = r;
                if (c < minC) minC = c;
                if (c > maxC) maxC = c;
            });

            // If empty, return empty
            if (minR === Infinity) {
                return { minR: 0, maxR: 0, minC: 0, maxC: 0, map: window.infiniteMap };
            }

            // Add margin
            const margin = 5;
            minR -= margin; maxR += margin;
            minC -= margin; maxC += margin;

            return { minR, maxR, minC, maxC, map: window.infiniteMap };
        }

        // Fallback for fixed board
        if (typeof GameState !== 'undefined' && GameState.board && !GameState.board.isInfinite) {
            const board = [];
            const size = GameState.board.size;
            const state = GameState.board.state;

            for (let i = 0; i < size; i++) {
                board[i] = [];
                for (let j = 0; j < size; j++) {
                    const cell = state[i][j];
                    if (cell === 'X') board[i][j] = 1;
                    else if (cell === 'O') board[i][j] = -1;
                    else board[i][j] = 0;
                }
            }
            return { minR: 0, maxR: size - 1, minC: 0, maxC: size - 1, board };
        }

        return { minR: 0, maxR: 19, minC: 0, maxC: 19, map: new Map() };
    },

    // ===== GET BOARD SIZE =====
    getBoardSize() {
        const board = this.getBoardState();
        if (board.board) {
            return board.board.length;
        }
        // For infinite board, calculate size from bounds
        const rows = board.maxR - board.minR + 1;
        const cols = board.maxC - board.minC + 1;
        return Math.max(rows, cols, 20);
    },

    // ===== GET CELL VALUE =====
    getCellValue(r, c, board) {
        if (board.map) {
            // Infinite board
            const key = `${r},${c}`;
            const val = board.map.get(key);
            if (val === 'X') return 1;
            if (val === 'O') return -1;
            return 0;
        }
        // Fixed board
        if (r >= 0 && r < board.board.length && c >= 0 && c < board.board[0].length) {
            return board.board[r][c];
        }
        return 0;
    },

    // ===== HAS NEIGHBORS =====
    hasNeighbors(i, j, board) {
        if (board.map) {
            // Infinite board
            const neighbors = [
                [i, j-1], [i, j+1],
                [i-1, j], [i-1, j-1], [i-1, j+1],
                [i+1, j], [i+1, j-1], [i+1, j+1]
            ];
            for (const [r, c] of neighbors) {
                if (this.getCellValue(r, c, board) !== 0) return 1;
            }
            return 0;
        }
        // Fixed board
        const size = board.board.length;
        if (j > 0 && board.board[i][j - 1] !== 0) return 1;
        if (j + 1 < size && board.board[i][j + 1] !== 0) return 1;
        if (i > 0) {
            if (board.board[i - 1][j] !== 0) return 1;
            if (j > 0 && board.board[i - 1][j - 1] !== 0) return 1;
            if (j + 1 < size && board.board[i - 1][j + 1] !== 0) return 1;
        }
        if (i + 1 < size) {
            if (board.board[i + 1][j] !== 0) return 1;
            if (j > 0 && board.board[i + 1][j - 1] !== 0) return 1;
            if (j + 1 < size && board.board[i + 1][j + 1] !== 0) return 1;
        }
        return 0;
    },

    // ===== WINNING POSITION =====
    winningPos(i, j, mySq, board, winCount) {
        const limit = winCount;
        let test3 = 0;
        let test4 = 0;
        let L = 1, m, m1, m2, side1, side2;

        // Horizontal
        m = 1;
        while (this.getCellValue(i, j + m, board) === mySq) { L++; m++; }
        m1 = m;
        m = 1;
        while (this.getCellValue(i, j - m, board) === mySq) { L++; m++; }
        m2 = m;
        if (L > (limit - 1)) return this.config.winningMove;
        side1 = (this.getCellValue(i, j + m1, board) === 0);
        side2 = (this.getCellValue(i, j - m2, board) === 0);

        if (L === (limit - 1) && (side1 || side2)) test3++;
        if (side1 && side2) {
            if (L === (limit - 1)) test4 = 1;
            if (L === (limit - 2)) test3++;
        }

        // Vertical
        L = 1;
        m = 1;
        while (this.getCellValue(i + m, j, board) === mySq) { L++; m++; }
        m1 = m;
        m = 1;
        while (this.getCellValue(i - m, j, board) === mySq) { L++; m++; }
        m2 = m;
        if (L > (limit - 1)) return this.config.winningMove;
        side1 = (this.getCellValue(i + m1, j, board) === 0);
        side2 = (this.getCellValue(i - m2, j, board) === 0);
        if (L === (limit - 1) && (side1 || side2)) test3++;
        if (side1 && side2) {
            if (L === (limit - 1)) test4 = 1;
            if (L === (limit - 2)) test3++;
        }

        // Diagonal \
        L = 1;
        m = 1;
        while (this.getCellValue(i + m, j + m, board) === mySq) { L++; m++; }
        m1 = m;
        m = 1;
        while (this.getCellValue(i - m, j - m, board) === mySq) { L++; m++; }
        m2 = m;
        if (L > (limit - 1)) return this.config.winningMove;
        side1 = (this.getCellValue(i + m1, j + m1, board) === 0);
        side2 = (this.getCellValue(i - m2, j - m2, board) === 0);
        if (L === (limit - 1) && (side1 || side2)) test3++;
        if (side1 && side2) {
            if (L === (limit - 1)) test4 = 1;
            if (L === (limit - 2)) test3++;
        }

        // Diagonal /
        L = 1;
        m = 1;
        while (this.getCellValue(i + m, j - m, board) === mySq) { L++; m++; }
        m1 = m;
        m = 1;
        while (this.getCellValue(i - m, j + m, board) === mySq) { L++; m++; }
        m2 = m;
        if (L > (limit - 1)) return this.config.winningMove;
        side1 = (this.getCellValue(i + m1, j - m1, board) === 0);
        side2 = (this.getCellValue(i - m2, j + m2, board) === 0);
        if (L === (limit - 1) && (side1 || side2)) test3++;
        if (side1 && side2) {
            if (L === (limit - 1)) test4 = 1;
            if (L === (limit - 2)) test3++;
        }

        if (test4) return this.config.openFour;
        if (test3 >= 2) return this.config.twoThrees;
        return -1;
    },

    // ===== EVALUATE POSITION =====
    evaluatePos(a, mySq, board, winCount) {
        let maxA = -1;
        const limit = winCount;
        const w = this.config.weights;
        const nPos = [];
        const dirA = [];

        // Get bounds for infinite board
        const minR = board.minR || 0;
        const maxR = board.maxR || 19;
        const minC = board.minC || 0;
        const maxC = board.maxC || 19;

        for (let i = minR; i <= maxR; i++) {
            for (let j = minC; j <= maxC; j++) {
                // Skip occupied cells
                if (this.getCellValue(i, j, board) !== 0) {
                    continue;
                }

                // Skip cells without neighbors
                if (this.hasNeighbors(i, j, board) === 0) {
                    continue;
                }

                // Check for winning position
                const wp = this.winningPos(i, j, mySq, board, winCount);
                if (wp > 0) {
                    a[i] = a[i] || {};
                    a[i][j] = wp;
                } else {
                    // Calculate position score
                    const minM = i - (limit - 1);
                    const minN = j - (limit - 1);
                    const maxM = i + limit;
                    const maxN = j + limit;

                    nPos[1] = 1;
                    let A1 = 0;
                    let m = 1;
                    while (this.getCellValue(i, j + m, board) !== -mySq) {
                        nPos[1]++;
                        A1 += w[m] * this.getCellValue(i, j + m, board);
                        m++;
                    }
                    if (this.getCellValue(i, j + m, board) === -mySq) {
                        A1 -= (this.getCellValue(i, j + m - 1, board) === mySq) ? (w[limit] * mySq) : 0;
                    }
                    m = 1;
                    while (this.getCellValue(i, j - m, board) !== -mySq) {
                        nPos[1]++;
                        A1 += w[m] * this.getCellValue(i, j - m, board);
                        m++;
                    }
                    if (this.getCellValue(i, j - m, board) === -mySq) {
                        A1 -= (this.getCellValue(i, j - m + 1, board) === mySq) ? (w[limit] * mySq) : 0;
                    }

                    nPos[2] = 1;
                    let A2 = 0;
                    m = 1;
                    while (this.getCellValue(i + m, j, board) !== -mySq) {
                        nPos[2]++;
                        A2 += w[m] * this.getCellValue(i + m, j, board);
                        m++;
                    }
                    if (this.getCellValue(i + m, j, board) === -mySq) {
                        A2 -= (this.getCellValue(i + m - 1, j, board) === mySq) ? (w[limit] * mySq) : 0;
                    }
                    m = 1;
                    while (this.getCellValue(i - m, j, board) !== -mySq) {
                        nPos[2]++;
                        A2 += w[m] * this.getCellValue(i - m, j, board);
                        m++;
                    }
                    if (this.getCellValue(i - m, j, board) === -mySq) {
                        A2 -= (this.getCellValue(i - m + 1, j, board) === mySq) ? (w[limit] * mySq) : 0;
                    }

                    nPos[3] = 1;
                    let A3 = 0;
                    m = 1;
                    while (this.getCellValue(i + m, j + m, board) !== -mySq) {
                        nPos[3]++;
                        A3 += w[m] * this.getCellValue(i + m, j + m, board);
                        m++;
                    }
                    if (this.getCellValue(i + m, j + m, board) === -mySq) {
                        A3 -= (this.getCellValue(i + m - 1, j + m - 1, board) === mySq) ? (w[limit] * mySq) : 0;
                    }
                    m = 1;
                    while (this.getCellValue(i - m, j - m, board) !== -mySq) {
                        nPos[3]++;
                        A3 += w[m] * this.getCellValue(i - m, j - m, board);
                        m++;
                    }
                    if (this.getCellValue(i - m, j - m, board) === -mySq) {
                        A3 -= (this.getCellValue(i - m + 1, j - m + 1, board) === mySq) ? (w[limit] * mySq) : 0;
                    }

                    nPos[4] = 1;
                    let A4 = 0;
                    m = 1;
                    while (this.getCellValue(i + m, j - m, board) !== -mySq) {
                        nPos[4]++;
                        A4 += w[m] * this.getCellValue(i + m, j - m, board);
                        m++;
                    }
                    if (this.getCellValue(i + m, j - m, board) === -mySq) {
                        A4 -= (this.getCellValue(i + m - 1, j - m + 1, board) === mySq) ? (w[limit] * mySq) : 0;
                    }
                    m = 1;
                    while (this.getCellValue(i - m, j + m, board) !== -mySq) {
                        nPos[4]++;
                        A4 += w[m] * this.getCellValue(i - m, j + m, board);
                        m++;
                    }
                    if (this.getCellValue(i - m, j + m, board) === -mySq) {
                        A4 -= (this.getCellValue(i - m + 1, j + m - 1, board) === mySq) ? (w[limit] * mySq) : 0;
                    }

                    dirA[1] = (nPos[1] > (limit - 1)) ? A1 * A1 : 0;
                    dirA[2] = (nPos[2] > (limit - 1)) ? A2 * A2 : 0;
                    dirA[3] = (nPos[3] > (limit - 1)) ? A3 * A3 : 0;
                    dirA[4] = (nPos[4] > (limit - 1)) ? A4 * A4 : 0;

                    A1 = 0;
                    A2 = 0;
                    for (let k = 1; k < limit; k++) {
                        if (dirA[k] >= A1) { A2 = A1; A1 = dirA[k]; }
                    }
                    a[i] = a[i] || {};
                    a[i][j] = A1 + A2;
                }

                if (a[i] && a[i][j] > maxA) {
                    maxA = a[i][j];
                }
            }
        }

        return maxA;
    },

    // ===== FIND BEST MOVE =====
    findBestMove(primaryScores, primaryMax, secondaryScores, board) {
        let bestScore = -1;
        const bestMoves = [];

        // Get bounds
        const minR = board.minR || 0;
        const maxR = board.maxR || 19;
        const minC = board.minC || 0;
        const maxC = board.maxC || 19;

        for (let i = minR; i <= maxR; i++) {
            for (let j = minC; j <= maxC; j++) {
                if (primaryScores[i] && primaryScores[i][j] === primaryMax) {
                    const secScore = secondaryScores[i] ? (secondaryScores[i][j] || 0) : 0;
                    if (secScore > bestScore) {
                        bestScore = secScore;
                        bestMoves.length = 0;
                        bestMoves.push([i, j]);
                    } else if (secScore === bestScore) {
                        bestMoves.push([i, j]);
                    }
                }
            }
        }

        if (bestMoves.length === 0) return null;

        // Random selection from best moves
        const randomIndex = Math.floor(Math.random() * bestMoves.length);
        return bestMoves[randomIndex];
    }
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BotTiaChop;
}
