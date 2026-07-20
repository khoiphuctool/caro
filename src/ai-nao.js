// ===== AI NÃO - Toàn bộ engine AI =====

// ══════════════════════════════════════════════════════════════════
// BẢNG ĐIỂM CHUẨN — Hệ số mũ, không tuyến tính
// ══════════════════════════════════════════════════════════════════

// Điểm TẤNG CÔNG (quân của bot)
const SCORE_ATK = {
    FIVE:          150000,  // thắng ngay
    FOUR_OPEN:      10000,  // 4 mở — bắt chiến thắng
    FOUR_BLOCKED:    2000,  // 4 đóng 1 đầu
    THREE_OPEN:      6000,  // 3 mở — ưu tiên tấn công (tăng từ 1500 để > phòng thủ)
    THREE_BLOCKED:    400,  // 3 đóng 1 đầu
    TWO_OPEN:         300,  // 2 mở
    TWO_BLOCKED:       30,
};

// Điểm PHÒNG THỦ (quân của địch — phải chặn)
const SCORE_DEF = {
    FIVE:           80000,  // địch sắp thắng — BẮT BUỘC chặn
    FOUR_OPEN:       8000,  // địch 4 mở
    FOUR_BLOCKED:    1200,  // địch 4 đóng
    THREE_OPEN:      5000,  // địch 3 mở — NGUY HIỂM, chặn ngay trước khi thành 4 mở
    THREE_BLOCKED:    300,
    TWO_OPEN:         100,
    TWO_BLOCKED:       10,
};

// Bonus tấn công kép (double three / four-three)
const BONUS_DOUBLE_THREE = 15000;  // 2 hướng THREE_OPEN cùng lúc
const BONUS_FOUR_THREE   = 20000;  // có cả FOUR + THREE_OPEN
const BONUS_DOUBLE_FOUR  = 50000;  // 2 hướng FOUR cùng lúc

// Center bias — điểm thưởng cho ô gần trung tâm khu chiến đấu
const CENTER_BIAS_MAX  = 20;
const CENTER_BIAS_DIST = 5;   // bán kính tính bias

// Dữ liệu cũ TL giữ lại để không lỗi các hàm đang dùng
const TL = {
    FIVE: 5, FOUR_OPEN: 4.5, FOUR_BLOCKED: 4,
    THREE_OPEN: 3.5, THREE_BLOCKED: 3,
    TWO_OPEN: 2.5, TWO_BLOCKED: 2, NONE: 0
};

// ══════════════════════════════════════════════════════════════════
// evalLine — trả về TL.* (giữ nguyên để tương thích các hàm khác)
// ══════════════════════════════════════════════════════════════════
function evalLine(r, c, dr, dc, p) {
    let count = 1;
    let nr = r + dr, nc = c + dc;
    while (getCell(nr, nc) === p) { count++; nr += dr; nc += dc; }
    const hB = (getCell(nr, nc) !== "" && getCell(nr, nc) !== p);
    nr = r - dr; nc = c - dc;
    while (getCell(nr, nc) === p) { count++; nr -= dr; nc -= dc; }
    const tB = (getCell(nr, nc) !== "" && getCell(nr, nc) !== p);

    if (count >= winCount) {
        if (hB && tB) return TL.NONE;
        return TL.FIVE;
    }
    if (count === winCount - 1) {
        if (hB && tB) return TL.NONE;
        return (hB || tB) ? TL.FOUR_BLOCKED : TL.FOUR_OPEN;
    }
    if (count === winCount - 2) {
        if (hB && tB) return TL.NONE;
        return (hB || tB) ? TL.THREE_BLOCKED : TL.THREE_OPEN;
    }
    if (count === winCount - 3) {
        if (hB && tB) return TL.NONE;
        return (hB || tB) ? TL.TWO_BLOCKED : TL.TWO_OPEN;
    }
    return TL.NONE;
}

// ══════════════════════════════════════════════════════════════════
// centerBias — thưởng điểm cho ô gần trung tâm khu chiến
// ══════════════════════════════════════════════════════════════════
function centerBias(r, c) {
    if (!isInfinite || infiniteMap.size === 0) return 0;
    // Tính trung tâm khu chiến đấu thực tế
    let sr = 0, sc = 0, n = 0;
    for (const key of infiniteMap.keys()) {
        const [kr, kc] = key.split(',').map(Number);
        sr += kr; sc += kc; n++;
    }
    const cr = sr / n, cc = sc / n;
    const dist = Math.abs(r - cr) + Math.abs(c - cc);
    if (dist >= CENTER_BIAS_DIST) return 0;
    return Math.round(CENTER_BIAS_MAX * (1 - dist / CENTER_BIAS_DIST));
}

// ══════════════════════════════════════════════════════════════════
// scoreFromTL — chuyển TL value sang điểm thực từ bảng chuẩn
// ══════════════════════════════════════════════════════════════════
function scoreFromTL(tl, isAttack) {
    const table = isAttack ? SCORE_ATK : SCORE_DEF;
    if (tl === TL.FIVE)          return table.FIVE;
    if (tl === TL.FOUR_OPEN)     return table.FOUR_OPEN;
    if (tl === TL.FOUR_BLOCKED)  return table.FOUR_BLOCKED;
    if (tl === TL.THREE_OPEN)    return table.THREE_OPEN;
    if (tl === TL.THREE_BLOCKED) return table.THREE_BLOCKED;
    if (tl === TL.TWO_OPEN)      return table.TWO_OPEN;
    if (tl === TL.TWO_BLOCKED)   return table.TWO_BLOCKED;
    return 0;
}

// ===== getSearchCandidates =====
function getSearchCandidates() {
    let cells = [];
    const MAX_CANDIDATES = 50; // Giới hạn số lượng candidate để tránh lag
    
    if (isInfinite) {
        let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
        if (infiniteMap.size === 0) return [{ r: 0, c: 0 }];
        infiniteMap.forEach((v, k) => {
            const [r, c] = k.split(',').map(Number);
            if (r < minR) minR = r; if (r > maxR) maxR = r;
            if (c < minC) minC = c; if (c > maxC) maxC = c;
        });
        const margin = 2;
        for (let r = minR - margin; r <= maxR + margin; r++) {
            for (let c = minC - margin; c <= maxC + margin; c++) {
                if (getCell(r, c) === "") {
                    let hasNeighbor = false;
                    for (let dr = -2; dr <= 2 && !hasNeighbor; dr++)
                        for (let dc = -2; dc <= 2; dc++)
                            if ((dr !== 0 || dc !== 0) && getCell(r+dr, c+dc) !== "") { hasNeighbor = true; break; }
                    if (hasNeighbor) cells.push({ r, c });
                }
            }
        }
    } else {
        let hasAny = false;
        for (let r = 0; r < boardSize && !hasAny; r++)
            for (let c = 0; c < boardSize; c++)
                if (boardState[r][c] !== "") { hasAny = true; break; }
        if (!hasAny) return [{ r: Math.floor(boardSize/2), c: Math.floor(boardSize/2) }];
        
        // Tính vùng quét giới hạn quanh các quân cờ
        let minR = boardSize, maxR = 0, minC = boardSize, maxC = 0;
        for (let r = 0; r < boardSize; r++) {
            for (let c = 0; c < boardSize; c++) {
                if (boardState[r][c] !== "") {
                    if (r < minR) minR = r; if (r > maxR) maxR = r;
                    if (c < minC) minC = c; if (c > maxC) maxC = c;
                }
            }
        }
        
        const margin = 3; // Tăng margin lên 3 để đảm bảo không bỏ sót
        const searchMinR = Math.max(0, minR - margin);
        const searchMaxR = Math.min(boardSize - 1, maxR + margin);
        const searchMinC = Math.max(0, minC - margin);
        const searchMaxC = Math.min(boardSize - 1, maxC + margin);
        
        for (let r = searchMinR; r <= searchMaxR; r++) {
            for (let c = searchMinC; c <= searchMaxC; c++) {
                if (boardState[r][c] === "") {
                    let ok = false;
                    for (let dr = -2; dr <= 2 && !ok; dr++)
                        for (let dc = -2; dc <= 2; dc++) {
                            const nr = r+dr, nc = c+dc;
                            if (nr>=0 && nc>=0 && nr<boardSize && nc<boardSize && boardState[nr][nc] !== "") { ok = true; break; }
                        }
                    if (ok) cells.push({ r, c });
                }
            }
        }
    }
    
    // Giới hạn số lượng candidate và sắp xếp theo điểm
    if (cells.length > MAX_CANDIDATES) {
        cells.sort((a, b) => quickScore(b.r, b.c, botPiece) - quickScore(a.r, a.c, botPiece));
        return cells.slice(0, MAX_CANDIDATES);
    }
    
    return cells;
}

// ══════════════════════════════════════════════════════════════════
// quickScore — bảng điểm chuẩn + bonus tấn công kép + center bias
// ══════════════════════════════════════════════════════════════════
function quickScore(r, c, p) {
    const opp            = p === 'X' ? 'O' : 'X';
    const blockBothEnds  = document.getElementById('block-both-ends').checked;

    let atkScore = 0, defScore = 0;
    let atkFourCount = 0, atkThreeOpenCount = 0;
    let defFourCount = 0;
    let hasWinningMove = false;

    for (const { dr, dc } of DIRECTIONS) {
        // ── Tấn công ──
        const tAtk = evalLine(r, c, dr, dc, p);
        if (tAtk !== TL.NONE) {
            let dead = false;
            if (blockBothEnds && tAtk !== TL.FIVE) {
                const { blockedBoth } = countLineAndBlocked(r, c, dr, dc, p);
                if (blockedBoth) dead = true;
            }
            if (!dead) {
                atkScore += scoreFromTL(tAtk, true);
                if (tAtk === TL.FOUR_OPEN || tAtk === TL.FOUR_BLOCKED) atkFourCount++;
                if (tAtk === TL.THREE_OPEN) atkThreeOpenCount++;
                if (tAtk === TL.FIVE) hasWinningMove = true;
            }
        }

        // ── Phòng thủ ──
        const tDef = evalLine(r, c, dr, dc, opp);
        if (tDef !== TL.NONE) {
            let dead = false;
            if (blockBothEnds && tDef !== TL.FIVE) {
                const { blockedBoth } = countLineAndBlocked(r, c, dr, dc, opp);
                if (blockedBoth) dead = true;
            }
            if (!dead) {
                defScore += scoreFromTL(tDef, false);
                if (tDef === TL.FOUR_OPEN || tDef === TL.FOUR_BLOCKED) defFourCount++;
            }
        }
    }

    // ── Bonus tấn công kép (Double-Three / Four-Three / Double-Four) ──
    let bonus = 0;
    if (atkThreeOpenCount >= 2)                           bonus += BONUS_DOUBLE_THREE;
    if (atkFourCount >= 1 && atkThreeOpenCount >= 1)      bonus += BONUS_FOUR_THREE;
    if (atkFourCount >= 2)                                bonus += BONUS_DOUBLE_FOUR;

    // ── Center bias ──
    const bias = centerBias(r, c);

    // ── ƯU TIÊN TẤN CÔNG KHI CÓ CƠ HỘI THẮNG ──
    if (atkThreeOpenCount >= 1 || atkFourCount >= 1) {
        atkScore *= 2;
    }
    if (hasWinningMove) {
        return 999999;
    }

    // ── MEMORY PENALTY — trừ điểm nếu nước này tiếp tay cho chiêu nguy hiểm đã học ──
    // Chỉ áp dụng cho nước của bot (p === botPiece), bỏ qua khi tính điểm cho địch
    let memPenalty = 0;
    if (p === (typeof botPiece !== 'undefined' ? botPiece : null) &&
        typeof getMemoryPenalty === 'function' &&
        typeof humanPiece !== 'undefined') {
        memPenalty = getMemoryPenalty(r, c, humanPiece);
    }

    return atkScore + defScore + bonus + bias - memPenalty;
}



// ===== PATTERN RECOGNITION FOR FORK/TRAP =====
function detectForkPatterns(p, candidates) {
    const forks = [];
    for (const { r, c } of candidates) {
        if (getCell(r, c) !== '') continue;
        
        setCell(r, c, p);
        let attackLines = 0;
        let threeOpenLines = 0;
        let fourOpenLines = 0;
        
        for (const { dr, dc } of DIRECTIONS) {
            const res = evalLine(r, c, dr, dc, p);
            if (res === TL.FOUR_OPEN || res === TL.FOUR_BLOCKED) {
                fourOpenLines++;
                attackLines++;
            } else if (res === TL.THREE_OPEN) {
                threeOpenLines++;
                attackLines++;
            }
        }
        
        setCell(r, c, '');
        
        // Fork: 2+ attack lines from one move
        if (attackLines >= 2) {
            forks.push({
                r, c,
                type: 'fork',
                attackLines,
                threeOpenLines,
                fourOpenLines,
                score: (fourOpenLines * 5000) + (threeOpenLines * 2000) + (attackLines * 1000)
            });
        }
    }
    
    return forks.sort((a, b) => b.score - a.score);
}

function detectTrapPatterns(p, candidates, opp) {
    const traps = [];
    for (const { r, c } of candidates) {
        if (getCell(r, c) !== '') continue;
        
        // Check if this move forces opponent into a bad position
        setCell(r, c, p);
        
        // Find opponent's best response
        let bestOppScore = -Infinity;
        let bestOppMove = null;
        
        for (const { r: or, c: oc } of candidates) {
            if (getCell(or, oc) !== '') continue;
            if (or === r && oc === c) continue;
            
            setCell(or, oc, opp);
            let oppScore = 0;
            
            for (const { dr, dc } of DIRECTIONS) {
                const res = evalLine(or, oc, dr, dc, opp);
                if (res === TL.FIVE) oppScore += 10000;
                else if (res === TL.FOUR_OPEN) oppScore += 5000;
                else if (res === TL.THREE_OPEN) oppScore += 1000;
            }
            
            setCell(or, oc, '');
            
            if (oppScore > bestOppScore) {
                bestOppScore = oppScore;
                bestOppMove = { r: or, c: oc };
            }
        }
        
        setCell(r, c, '');
        
        // If opponent's best response is weak, this is a trap
        if (bestOppScore < 2000 && bestOppMove) {
            traps.push({
                r, c,
                type: 'trap',
                forcedResponse: bestOppMove,
                oppScore: bestOppScore,
                score: 3000 - bestOppScore // Higher score for weaker opponent response
            });
        }
    }
    
    return traps.sort((a, b) => b.score - a.score);
}

function detectDoubleThreatPatterns(p, candidates) {
    const doubleThreats = [];
    
    for (const { r, c } of candidates) {
        if (getCell(r, c) !== '') continue;
        
        setCell(r, c, p);
        
        // Check for double three (two separate three-open lines)
        let threeOpenCount = 0;
        let threePositions = [];
        
        for (const { dr, dc } of DIRECTIONS) {
            const res = evalLine(r, c, dr, dc, p);
            if (res === TL.THREE_OPEN) {
                threeOpenCount++;
                threePositions.push({ dr, dc });
            }
        }
        
        setCell(r, c, '');
        
        if (threeOpenCount >= 2) {
            doubleThreats.push({
                r, c,
                type: 'double-three',
                threeOpenCount,
                score: 4000 + (threeOpenCount * 1000)
            });
        }
    }
    
    return doubleThreats.sort((a, b) => b.score - a.score);
}

function detectBreakthroughPatterns(p, candidates, opp) {
    const breakthroughs = [];
    
    for (const { r, c } of candidates) {
        if (getCell(r, c) !== '') continue;
        
        setCell(r, c, p);
        
        // Check if this creates an unstoppable line
        let unstoppableLines = 0;
        
        for (const { dr, dc } of DIRECTIONS) {
            const { count, blockedBoth } = countLineAndBlocked(r, c, dr, dc, p);
            
            // Line that can't be blocked
            if (count >= winCount - 1 && !blockedBoth) {
                // Check if opponent can block in next move
                let canBlock = false;
                const headR = r + dr * count;
                const headC = c + dc * count;
                const tailR = r - dr;
                const tailC = c - dc;
                
                if (getCell(headR, headC) === '' || getCell(tailR, tailC) === '') {
                    canBlock = true;
                }
                
                if (!canBlock) {
                    unstoppableLines++;
                }
            }
        }
        
        setCell(r, c, '');
        
        if (unstoppableLines >= 1) {
            breakthroughs.push({
                r, c,
                type: 'breakthrough',
                unstoppableLines,
                score: 6000 + (unstoppableLines * 2000)
            });
        }
    }
    
    return breakthroughs.sort((a, b) => b.score - a.score);
}



// ===== PVS (Principal Variation Search) =====
function pvs(depth, alpha, beta, isMaximizing, player, startTime, maxTime, currentDepth) {
    if (startTime && Date.now() - startTime > maxTime) return 0;

    const hash = generateBoardHash();
    const ttResult = ttLookup(hash, depth, alpha, beta);
    if (ttResult !== null) return ttResult;

    if (depth === 0) {
        const evalScore = evaluateBoard(player);
        ttStore(hash, depth, evalScore, 'exact');
        return evalScore;
    }

    const winner = checkBoardWinner();
    if (winner === player)  { const s =  1000000 + depth; ttStore(hash,depth,s,'exact'); return s; }
    if (winner !== null)    { const s = -1000000 - depth; ttStore(hash,depth,s,'exact'); return s; }

    const candidates = getSearchCandidates();
    if (candidates.length === 0) { ttStore(hash,depth,0,'exact'); return 0; }

    candidates.sort((a, b) => {
        const aK = isKillerMove(currentDepth||0, a.r, a.c);
        const bK = isKillerMove(currentDepth||0, b.r, b.c);
        if (aK && !bK) return -1; if (!aK && bK) return 1;
        return quickScore(b.r, b.c, player) - quickScore(a.r, a.c, player);
    });

    const maxCandidates  = Math.min(candidates.length, depth > 3 ? 6 : 10);
    const searchCands    = candidates.slice(0, maxCandidates);
    const opponent       = player === 'X' ? 'O' : 'X';

    let bestScore = isMaximizing ? -Infinity : Infinity;
    let firstMove = true;

    for (const { r, c } of searchCands) {
        const oldV = getCell(r, c);
        setCell(r, c, isMaximizing ? player : opponent);
        let score;
        if (firstMove) {
            score = pvs(depth-1, alpha, beta, !isMaximizing, player, startTime, maxTime, (currentDepth||0)+1);
            firstMove = false;
        } else if (isMaximizing) {
            score = pvs(depth-1, alpha, alpha+1, false, player, startTime, maxTime, (currentDepth||0)+1);
            if (score > alpha) score = pvs(depth-1, alpha, beta, false, player, startTime, maxTime, (currentDepth||0)+1);
        } else {
            score = pvs(depth-1, beta-1, beta, true, player, startTime, maxTime, (currentDepth||0)+1);
            if (score < beta) score = pvs(depth-1, alpha, beta, true, player, startTime, maxTime, (currentDepth||0)+1);
        }
        setCell(r, c, oldV);

        if (isMaximizing) {
            if (score > bestScore) bestScore = score;
            alpha = Math.max(alpha, score);
        } else {
            if (score < bestScore) bestScore = score;
            beta = Math.min(beta, score);
        }
        if (beta <= alpha) { addKillerMove(currentDepth||0, r, c); break; }
    }

    const flag = bestScore <= alpha ? 'upper' : bestScore >= beta ? 'lower' : 'exact';
    ttStore(hash, depth, bestScore, flag);
    return bestScore;
}


// ===== MCTS =====
class MCTSNode {
    constructor(r, c, parent = null) {
        this.r = r; this.c = c; this.parent = parent;
        this.children = []; this.wins = 0; this.visits = 0; this.untriedMoves = [];
    }
    getUCB1(e = 1.41) {
        if (this.visits === 0) return Infinity;
        return (this.wins/this.visits) + e * Math.sqrt(Math.log(this.parent.visits)/this.visits);
    }
    addChild(r, c) { const child = new MCTSNode(r, c, this); this.children.push(child); return child; }
}

function mctsSearch(iterations = 1000, timeLimit = 2000) {
    const startTime = Date.now();
    const candidates = getSearchCandidates();
    if (candidates.length === 0) return { r: 0, c: 0 };
    const searchCands = candidates.slice(0, Math.min(candidates.length, 12));
    const root = new MCTSNode(null, null);
    root.untriedMoves = [...searchCands];
    let iterCount = 0;
    while (iterCount < iterations && Date.now() - startTime < timeLimit) {
        let node = root;
        const path = [node];
        const pathPlayers = []; // lưu player của từng bước

        // Selection
        let currentMctsPlayer = botPiece;
        while (node.children.length > 0 && node.untriedMoves.length === 0) {
            let bestChild = null, bestUCB = -Infinity;
            for (const child of node.children) { const u = child.getUCB1(); if (u > bestUCB) { bestUCB = u; bestChild = child; } }
            if (bestChild) {
                node = bestChild;
                path.push(node);
                if (node.r !== null) {
                    setCell(node.r, node.c, currentMctsPlayer);
                    pathPlayers.push({ r: node.r, c: node.c });
                    currentMctsPlayer = currentMctsPlayer === 'X' ? 'O' : 'X';
                }
            } else break;
        }

        // Expansion
        if (node.untriedMoves.length > 0) {
            const moveIdx = Math.floor(Math.random() * node.untriedMoves.length);
            const move = node.untriedMoves.splice(moveIdx, 1)[0];
            setCell(move.r, move.c, currentMctsPlayer);
            pathPlayers.push({ r: move.r, c: move.c });
            const childNode = node.addChild(move.r, move.c);
            path.push(childNode);
            node = childNode;
        }

        // Simulation
        const simResult = simulateRandomPlayout();

        // Backpropagation
        for (const pathNode of path) {
            pathNode.visits++;
            if (simResult === botPiece) pathNode.wins++;
        }

        // Undo path moves
        for (let i = pathPlayers.length - 1; i >= 0; i--) {
            setCell(pathPlayers[i].r, pathPlayers[i].c, '');
        }

        iterCount++;
    }
    let bestChild = null, bestVisits = -1;
    for (const child of root.children) if (child.visits > bestVisits) { bestVisits = child.visits; bestChild = child; }
    return bestChild ? { r: bestChild.r, c: bestChild.c } : searchCands[0];
}

function simulateRandomPlayout() {
    let player = botPiece === 'X' ? 'O' : 'X';
    let moves = 0;
    const simMoves = []; // lưu lại để undo sau simulation
    while (moves < 50) {
        const candidates = getSearchCandidates();
        if (candidates.length === 0) break;
        const move = selectRandomMoveWithBias(candidates, player);
        setCell(move.r, move.c, player);
        simMoves.push({ r: move.r, c: move.c });
        if (checkWinSilent(move.r, move.c)) {
            // Undo tất cả simulation moves
            for (const m of simMoves) setCell(m.r, m.c, '');
            return player;
        }
        player = player === 'X' ? 'O' : 'X';
        moves++;
    }
    // Undo tất cả simulation moves
    for (const m of simMoves) setCell(m.r, m.c, '');
    return null;
}

function selectRandomMoveWithBias(candidates, player) {
    if (Math.random() < 0.7 && candidates.length > 5) {
        const sorted = [...candidates].sort((a, b) => quickScore(b.r, b.c, player) - quickScore(a.r, a.c, player));
        const top5 = sorted.slice(0, 5);
        return top5[Math.floor(Math.random() * top5.length)];
    }
    return candidates[Math.floor(Math.random() * candidates.length)];
}

// ===== NEURAL EVALUATOR =====
class NeuralEvaluator {
    constructor() {
        this.featureWeights = {
            fiveOpen:5000, fourOpen:2000, fourBlocked:800, threeOpen:300, threeBlocked:100, twoOpen:40,
            centerControl:150, edgePenalty:-50, cornerPenalty:-30,
            forkPotential:1200, doubleThreat:2500, connectivity:80, mobility:60, territory:40
        };
        this.layer1Weights = [[1.2,0.8,0.5,0.3],[1.0,0.9,0.4,0.2],[0.7,1.1,0.6,0.3],[0.9,0.7,1.0,0.4]];
        this.layer2Weights = [1.3,1.1,0.9,0.7];
        this.bias = 0.1;
        
        // Training parameters
        this.learningRate = 0.01;
        this.trainingData = [];
        this.isTrainingEnabled = true;
    }
    countNeighbors(r, c, player) {
        let count = 0;
        for (let dr = -1; dr <= 1; dr++)
            for (let dc = -1; dc <= 1; dc++)
                if (!(dr===0&&dc===0) && getCell(r+dr,c+dc)===player) count++;
        return count;
    }
    detectForkPotential(player, candidates) {
        let forkCount = 0;
        for (const { r, c } of candidates) {
            if (getCell(r,c) !== player) continue;
            let tc = 0;
            for (const { dr, dc } of DIRECTIONS) {
                const e = evalLine(r,c,dr,dc,player);
                if (e === TL.THREE_OPEN || e === TL.FOUR_OPEN) tc++;
            }
            if (tc >= 2) forkCount++;
        }
        return forkCount;
    }
    detectDoubleThreat(player, candidates) {
        let count = 0;
        for (const { r, c } of candidates) {
            if (getCell(r,c) !== "") continue;
            setCell(r,c,player);
            let tc = 0;
            for (const { dr, dc } of DIRECTIONS) {
                const e = evalLine(r,c,dr,dc,player);
                if (e === TL.THREE_OPEN || e === TL.FOUR_OPEN) tc++;
            }
            setCell(r,c,"");
            if (tc >= 2) count++;
        }
        return count;
    }
    extractFeatures(player) {
        const opp = player==='X'?'O':'X';
        const candidates = getSearchCandidates();
        let pFive=0,pFourO=0,pFourB=0,pThreeO=0,pThreeB=0,pTwoO=0;
        let oFive=0,oFourO=0,oFourB=0,oThreeO=0,oThreeB=0,oTwoO=0;
        let centerControl=0,edgeCount=0,cornerCount=0,connectivity=0,territory=0;
        for (const { r, c } of candidates) {
            const cell = getCell(r,c);
            if (cell === player) {
                for (const { dr, dc } of DIRECTIONS) {
                    const e = evalLine(r,c,dr,dc,player);
                    if (e===TL.FIVE) pFive++; else if (e===TL.FOUR_OPEN) pFourO++;
                    else if (e===TL.FOUR_BLOCKED) pFourB++; else if (e===TL.THREE_OPEN) pThreeO++;
                    else if (e===TL.THREE_BLOCKED) pThreeB++; else if (e===TL.TWO_OPEN) pTwoO++;
                }
                if (Math.abs(r)+Math.abs(c)<=2) centerControl++;
                territory += this.countNeighbors(r,c,player);
                connectivity += this.countNeighbors(r,c,player);
            } else if (cell === opp) {
                for (const { dr, dc } of DIRECTIONS) {
                    const e = evalLine(r,c,dr,dc,opp);
                    if (e===TL.FIVE) oFive++; else if (e===TL.FOUR_OPEN) oFourO++;
                    else if (e===TL.FOUR_BLOCKED) oFourB++; else if (e===TL.THREE_OPEN) oThreeO++;
                    else if (e===TL.THREE_BLOCKED) oThreeB++; else if (e===TL.TWO_OPEN) oTwoO++;
                }
            }
            if (Math.abs(r)>10||Math.abs(c)>10) edgeCount++;
            if (Math.abs(r)>10&&Math.abs(c)>10) cornerCount++;
        }
        return {
            playerFive:pFive, playerFourOpen:pFourO, playerFourBlocked:pFourB,
            playerThreeOpen:pThreeO, playerThreeBlocked:pThreeB, playerTwoOpen:pTwoO,
            oppFive:oFive, oppFourOpen:oFourO, oppFourBlocked:oFourB,
            oppThreeOpen:oThreeO, oppThreeBlocked:oThreeB, oppTwoOpen:oTwoO,
            centerControl, edgeCount, cornerCount,
            forkPotential: this.detectForkPotential(player, candidates),
            doubleThreat:  this.detectDoubleThreat(player, candidates),
            connectivity, mobility: candidates.length, territory
        };
    }
    forwardPass(f) {
        const fw = this.featureWeights;
        const attack = f.playerFive*fw.fiveOpen + f.playerFourOpen*fw.fourOpen + f.playerFourBlocked*fw.fourBlocked + f.playerThreeOpen*fw.threeOpen + f.playerThreeBlocked*fw.threeBlocked + f.playerTwoOpen*fw.twoOpen;
        const defense= f.oppFive*fw.fiveOpen    + f.oppFourOpen*fw.fourOpen    + f.oppFourBlocked*fw.fourBlocked    + f.oppThreeOpen*fw.threeOpen    + f.oppThreeBlocked*fw.threeBlocked    + f.oppTwoOpen*fw.twoOpen;
        const positional = f.centerControl*fw.centerControl + f.edgeCount*fw.edgePenalty + f.cornerCount*fw.cornerPenalty;
        const tactical   = f.forkPotential*fw.forkPotential + f.doubleThreat*fw.doubleThreat + f.connectivity*fw.connectivity;
        const strategic  = f.mobility*fw.mobility + f.territory*fw.territory;
        const layer1 = [
            Math.max(0, attack*this.layer1Weights[0][0]    + defense*this.layer1Weights[0][1]),
            Math.max(0, attack*this.layer1Weights[1][0]    + defense*this.layer1Weights[1][1]),
            Math.max(0, positional*this.layer1Weights[2][0]+ tactical*this.layer1Weights[2][1]),
            Math.max(0, strategic*this.layer1Weights[3][0] + f.mobility*this.layer1Weights[3][1])
        ];
        return layer1.reduce((s,v,i)=>s+v*this.layer2Weights[i],0) + this.bias;
    }
    
    // ===== BACKPROPAGATION TRAINING =====
    addTrainingSample(features, targetValue) {
        if (!this.isTrainingEnabled) return;
        this.trainingData.push({ features, target: targetValue });
        if (this.trainingData.length > 1000) {
            this.trainingData.shift(); // Keep only last 1000 samples
        }
    }
    
    train(epochs = 10) {
        if (!this.isTrainingEnabled || this.trainingData.length === 0) return;
        
        for (let epoch = 0; epoch < epochs; epoch++) {
            let totalError = 0;
            
            for (const sample of this.trainingData) {
                const prediction = this.forwardPass(sample.features);
                const error = sample.target - prediction;
                totalError += error * error;
                
                // Backpropagation - simplified gradient descent
                const gradient = error * this.learningRate;
                
                // Update layer2 weights
                for (let i = 0; i < this.layer2Weights.length; i++) {
                    this.layer2Weights[i] += gradient * 0.1;
                }
                
                // Update layer1 weights
                for (let i = 0; i < this.layer1Weights.length; i++) {
                    for (let j = 0; j < this.layer1Weights[i].length; j++) {
                        this.layer1Weights[i][j] += gradient * 0.05;
                    }
                }
                
                // Update bias
                this.bias += gradient * 0.01;
            }
            
            if (epoch % 5 === 0) {
                console.log(`🧠 Neural Training - Epoch ${epoch}, Error: ${(totalError / this.trainingData.length).toFixed(4)}`);
            }
        }
    }
    
    evaluate(player) { 
        const features = this.extractFeatures(player);
        const score = this.forwardPass(features);
        return score;
    }

    // ===== ĐÁNH GIÁ TỪNG Ô CỤ THỂ =====
    // Giả lập đặt quân vào (r,c) rồi tính neural score của trạng thái đó
    evaluateCellNeural(r, c, player) {
        try {
            // Simulate placing piece
            const prev = (typeof getCell === 'function') ? getCell(r, c) : '';
            if (prev !== '') return 0; // ô đã có quân
            if (typeof setCell === 'function') setCell(r, c, player);

            const features = this.extractFeatures(player);
            const score = this.forwardPass(features);

            // Undo
            if (typeof setCell === 'function') setCell(r, c, '');
            return score;
        } catch (e) {
            return 0;
        }
    }

    // ===== NORMALIZE neural score về khoảng [-1, 1] để blend an toàn =====
    normalizeScore(rawScore, scale = 50000) {
        return Math.tanh(rawScore / scale);
    }
}

const neuralEvaluator = new NeuralEvaluator();

// ===== evaluateBoard =====
function evaluateBoard(player) {
    const opponent = player==='X'?'O':'X';
    let score = 0;
    const candidates = getSearchCandidates();
    for (const { r, c } of candidates) {
        score += enhancedHeuristicScore(r,c,player,DIRECTIONS);
        score -= enhancedHeuristicScore(r,c,opponent,DIRECTIONS) * 0.9;
    }
    score += evaluateBoardPatterns(player, opponent, DIRECTIONS);
    return score;
}

function enhancedHeuristicScore(r, c, player, dirs) {
    let score = 0;
    const blockBothEnds = document.getElementById('block-both-ends').checked;
    let fourCount = 0, threeOpenCount = 0;

    for (const { dr, dc } of dirs) {
        const lv = evalLine(r, c, dr, dc, player);
        if (lv === TL.NONE) continue;
        if (blockBothEnds && lv !== TL.FIVE) {
            const { blockedBoth } = countLineAndBlocked(r, c, dr, dc, player);
            if (blockedBoth) continue;
        }
        score += scoreFromTL(lv, true);
        if (lv === TL.FOUR_OPEN || lv === TL.FOUR_BLOCKED) fourCount++;
        if (lv === TL.THREE_OPEN) threeOpenCount++;
    }

    // Bonus tấn công kép
    if (threeOpenCount >= 2)               score += BONUS_DOUBLE_THREE;
    if (fourCount >= 1 && threeOpenCount >= 1) score += BONUS_FOUR_THREE;
    if (fourCount >= 2)                    score += BONUS_DOUBLE_FOUR;

    return score;
}

function evaluateBoardPatterns(player, opponent, dirs) {
    let score = 0;
    let pFourO=0, pThreeO=0, oFourO=0, oThreeO=0;
    const candidates = getSearchCandidates();
    for (const { r, c } of candidates) {
        const cell = getCell(r,c);
        if (cell === player)   for (const { dr,dc } of dirs) { const e=evalLine(r,c,dr,dc,player);   if(e===TL.FOUR_OPEN)pFourO++;  else if(e===TL.THREE_OPEN)pThreeO++; }
        else if (cell===opponent) for (const { dr,dc } of dirs) { const e=evalLine(r,c,dr,dc,opponent); if(e===TL.FOUR_OPEN)oFourO++; else if(e===TL.THREE_OPEN)oThreeO++; }
    }
    score += pFourO*30000 + pThreeO*5000 - oFourO*25000 - oThreeO*4000;
    if (pFourO>=2) score+=50000;
    if (pThreeO>=2) score+=15000;
    return score;
}

function checkBoardWinner() {
    const candidates = getSearchCandidates();
    for (const { r, c } of candidates) {
        const cell = getCell(r,c);
        if (cell !== '' && checkWinSilent(r,c)) return cell;
    }
    return null;
}

function getBestMoveWithMinimax(depth, player) {
    const candidates = getSearchCandidates();
    if (candidates.length === 0) return { r: 0, c: 0 };
    clearTranspositionTable(); clearKillerMoves();
    let bestMove = candidates[0], bestScore = -Infinity;
    candidates.sort((a,b) => quickScore(b.r,b.c,player) - quickScore(a.r,a.c,player));
    const searchCands = candidates.slice(0, Math.min(candidates.length, 8));
    const startTime = Date.now(), maxTime = 3000;
    window.isMinimaxRunning = true;
    for (let d = 1; d <= depth; d++) {
        if (Date.now() - startTime > maxTime * 0.8) break;
        let currentBestMove = null, currentBestScore = -Infinity;
        for (const { r, c } of searchCands) {
            const oldV = getCell(r,c);
            setCell(r,c,player);
            const score = pvs(d-1, -Infinity, Infinity, false, player, startTime, maxTime, 0);
            setCell(r,c,oldV);
            if (score > currentBestScore) { currentBestScore = score; currentBestMove = {r,c}; }
        }
        if (currentBestMove) { bestMove = currentBestMove; bestScore = currentBestScore; }
    }
    window.isMinimaxRunning = false;
    const ttTotal = ttHits + ttMisses;
    const ttHitRate = ttTotal > 0 ? ((ttHits/ttTotal)*100).toFixed(1) : 0;
    console.log(`📊 TT Stats: ${ttHits} hits, ${ttMisses} misses (${ttHitRate}% hit rate)`);
    return bestMove;
}

// ═══════════════════════════════════════════════════════════════════
// findLiveFourThreats — quét bàn cờ tìm các đầu thoáng của chuỗi p
// có độ dài count == targetCount VÀ chưa bị chặn 2 đầu.
// Trả về danh sách ô trống cần chặn ngay.
// ═══════════════════════════════════════════════════════════════════
function findLiveThreats(p, targetCount) {
    const opp           = p === 'X' ? 'O' : 'X';
    const blockBothEnds = document.getElementById('block-both-ends').checked;
    const threats       = new Set(); // dùng Set để tránh trùng

    const cells = isInfinite
        ? [...infiniteMap.entries()].filter(([, v]) => v === p).map(([k]) => {
              const [r, c] = k.split(',').map(Number); return { r, c };
          })
        : (() => {
              const res = [];
              for (let r = 0; r < boardSize; r++)
                  for (let c = 0; c < boardSize; c++)
                      if (boardState[r][c] === p) res.push({ r, c });
              return res;
          })();

    for (const { r: pr, c: pc } of cells) {
        for (const { dr, dc } of DIRECTIONS) {
            // Chỉ xử lý hướng "xuôi" để tránh đếm 2 lần
            // (kiểm tra ô trước có phải cùng p không — nếu có thì chuỗi này đã được xử lý)
            if (getCell(pr - dr, pc - dc) === p) continue;

            // Đếm chuỗi liên tiếp từ (pr,pc) theo hướng (dr,dc)
            let len = 0;
            while (getCell(pr + dr * len, pc + dc * len) === p) len++;
            // len = số quân liên tiếp bắt đầu từ (pr,pc)

            if (len !== targetCount) continue;

            // Đầu sau (head): ô tiếp theo sau chuỗi
            const headR = pr + dr * len, headC = pc + dc * len;
            const headCell = getCell(headR, headC);
            // Đầu trước (tail): ô trước chuỗi
            const tailR = pr - dr, tailC = pc - dc;
            const tailCell = getCell(tailR, tailC);

            const headOpen   = headCell === '';
            const tailOpen   = tailCell === '';
            const headBlocked = headCell === opp;
            const tailBlocked = tailCell === opp;

            // Nếu cả 2 đầu bị chặn và luật đang bật → chết, bỏ qua
            if (blockBothEnds && headBlocked && tailBlocked) continue;

            // Thêm các đầu thoáng vào danh sách cần chặn
            if (headOpen) threats.add(`${headR},${headC}`);
            if (tailOpen) threats.add(`${tailR},${tailC}`);
        }
    }

    return [...threats].map(k => {
        const [r, c] = k.split(',').map(Number);
        return { r, c };
    });
}

// ═══════════════════════════════════════════════════════════════════
// countLineAndBlocked — giữ lại cho các hàm khác dùng
// ═══════════════════════════════════════════════════════════════════
function countLineAndBlocked(r, c, dr, dc, p) {
    const opp = p === 'X' ? 'O' : 'X';
    let fwd = 0, bwd = 0;
    while (getCell(r + dr*(fwd+1), c + dc*(fwd+1)) === p) fwd++;
    while (getCell(r - dr*(bwd+1), c - dc*(bwd+1)) === p) bwd++;

    const headCell    = getCell(r + dr*(fwd+1), c + dc*(fwd+1));
    const tailCell    = getCell(r - dr*(bwd+1), c - dc*(bwd+1));
    const headBlocked = (headCell === opp);
    const tailBlocked = (tailCell === opp);

    return {
        count: 1 + fwd + bwd,
        blockedBoth: headBlocked && tailBlocked,
        headBlocked,
        tailBlocked
    };
}

// Kiểm tra xem việc đặt quân `p` vào (r,c) có tạo ra mối đe dọa thực sự không
// (loại bỏ các chuỗi đã bị chặn 2 đầu → bot khỏi lãng phí nước chặn vô ích)
function hasRealThreat(r, c, p, minCount) {
    const opp = p === 'X' ? 'O' : 'X';
    const blockBothEnds = document.getElementById('block-both-ends').checked;

    for (const { dr, dc } of DIRECTIONS) {
        const { count, blockedBoth } = countLineAndBlocked(r, c, dr, dc, p);
        if (count < minCount) continue;
        // Nếu luật chặn 2 đầu đang bật và chuỗi đã bị chặn 2 đầu → không nguy hiểm
        if (blockBothEnds && blockedBoth) continue;
        return true;
    }
    return false;
}

// Tính số đầu bị chặn thực sự của chuỗi địch tại (r,c) - dùng để lọc evalLine
function getEffectiveThreatLevel(r, c, p) {
    const blockBothEnds = document.getElementById('block-both-ends').checked;
    let maxThreat = TL.NONE;

    for (const { dr, dc } of DIRECTIONS) {
        const lineVal = evalLine(r, c, dr, dc, p);
        if (lineVal === TL.NONE) continue;

        // Nếu luật chặn 2 đầu bật, kiểm tra xem chuỗi thực có bị chặn cả 2 đầu không
        if (blockBothEnds) {
            const { blockedBoth } = countLineAndBlocked(r, c, dr, dc, p);
            if (blockedBoth) continue; // chuỗi đã chết → bỏ qua
        }

        if (lineVal > maxThreat) maxThreat = lineVal;
    }
    return maxThreat;
}

// ══════════════════════════════════════════════════════════════
// lookaheadDangerous — mô phỏng: bot đi (r,c) → địch phản công tốt nhất
// → địch có tạo FOUR không? Nếu có → bot move này nguy hiểm.
// ══════════════════════════════════════════════════════════════
function lookaheadDangerous(r, c, bp, hp) {
    const blockBothEnds = document.getElementById('block-both-ends').checked;
    
    // 1. Giả lập bot đi vào (r,c)
    setCell(r, c, bp);
    
    // 2. Tìm nước phản công tốt nhất của địch
    const cands = getSearchCandidates();
    let enemyBestMove = null;
    let enemyBestScore = -Infinity;
    
    for (const { r: er, c: ec } of cands) {
        if (getCell(er, ec) !== '') continue;
        
        // Đánh giá điểm nếu địch đi vào đây
        let score = 0;
        setCell(er, ec, hp);
        
        for (const { dr, dc } of DIRECTIONS) {
            const { count, blockedBoth } = countLineAndBlocked(er, ec, dr, dc, hp);
            if (blockBothEnds && blockedBoth) continue;
            
            if (count >= winCount) score += 100000; // Địch thắng ngay
            else if (count === winCount - 1) score += SCORE_DEF.FOUR_OPEN;
            else if (count === winCount - 2) score += SCORE_DEF.THREE_OPEN;
        }
        
        setCell(er, ec, '');
        
        if (score > enemyBestScore) {
            enemyBestScore = score;
            enemyBestMove = { r: er, c: ec };
        }
    }
    
    // 3. Nếu địch có nước đi tạo FOUR → bot move này nguy hiểm
    setCell(r, c, ''); // Hoàn tác bot move
    
    if (enemyBestMove && enemyBestScore >= SCORE_DEF.FOUR_OPEN) {
        return { dangerous: true, enemyResponse: enemyBestMove };
    }
    
    return { dangerous: false, enemyResponse: null };
}

// ══════════════════════════════════════════════════════════════
// findSafeMoveWithLookahead — tìm nước đi an toàn: sau khi bot đi,
// địch không thể tạo FOUR ngay lập tức
// ══════════════════════════════════════════════════════════════
function findSafeMoveWithLookahead(cands, bp, hp) {
    let safeMove = null;
    let safeScore = -Infinity;
    
    for (const { r, c } of cands) {
        if (getCell(r, c) !== '') continue;
        
        // Kiểm tra xem move này có nguy hiểm không
        const { dangerous } = lookaheadDangerous(r, c, bp, hp);
        
        if (!dangerous) {
            // Move an toàn → tính điểm để chọn tốt nhất
            const score = quickScore(r, c, bp);
            if (score > safeScore) {
                safeScore = score;
                safeMove = { r, c };
            }
        }
    }
    
    return safeMove;
}

// ===== makeAIMove & getBotMove =====
// ══════════════════════════════════════════════════════════════
// EARLY GAME DEFENSE — Đầu game bot chủ động áp sát, chặn lan rộng
//
// Khi số nước đi còn ít (moveCount ≤ EARLY_GAME_THRESHOLD) và
// không có mối đe dọa cấp cao nào, bot ưu tiên ô gần quân người
// chơi nhất để ngăn họ spread thoải mái tạo nước đôi/ba.
// ══════════════════════════════════════════════════════════════
const EARLY_GAME_THRESHOLD = 8; // số quân mỗi bên ≤ này = đầu game

function earlyGameDefense(validCands, bp, hp) {
    // Thêm randomization để tránh trùng thế cờ
    // Lấy danh sách ô của người chơi
    const humanCells = [];
    if (isInfinite) {
        infiniteMap.forEach((v, k) => {
            if (v === hp) {
                const [r, c] = k.split(',').map(Number);
                humanCells.push({ r, c });
            }
        });
    } else {
        for (let r = 0; r < boardSize; r++)
            for (let c = 0; c < boardSize; c++)
                if (boardState[r][c] === hp) humanCells.push({ r, c });
    }

    if (humanCells.length === 0) return null;

    // Tính điểm cho mỗi ô ứng viên: proximity tới quân người + quickScore
    let bestMoves = [], bestScore = -Infinity;

    for (const { r, c } of validCands) {
        // Khoảng cách Chebyshev tới quân người chơi gần nhất
        let minDist = Infinity;
        for (const hc of humanCells) {
            const d = Math.max(Math.abs(r - hc.r), Math.abs(c - hc.c));
            if (d < minDist) minDist = d;
        }

        // Chỉ xét ô trong bán kính 3 của quân người chơi
        if (minDist > 3) continue;

        // Đánh giá các hướng mở rộng của người chơi từ ô này
        let expansionBlock = 0;
        setCell(r, c, hp);
        for (const { dr, dc } of DIRECTIONS) {
            const lv = evalLine(r, c, dr, dc, hp);
            if (lv !== TL.NONE) {
                // Ô này nếu người chơi đi sẽ tạo pattern → ưu tiên chặn
                expansionBlock += scoreFromTL(lv, false);
            }
        }
        setCell(r, c, '');

        // Điểm tổng: chặn lan rộng + proximity bonus + quick score thường + random noise
        const proximityBonus = (4 - minDist) * 150; // gần hơn = điểm cao hơn
        const baseScore = quickScore(r, c, bp);
        const randomNoise = Math.random() * 500; // random noise để tránh trùng thế cờ
        const totalScore = expansionBlock + proximityBonus + baseScore + randomNoise;

        if (totalScore > bestScore) {
            bestScore = totalScore;
            bestMoves = [{ r, c }];
        } else if (totalScore >= bestScore - 500 && totalScore > 0) {
            // Chấp nhận các nước đi có điểm tương đương (chênh lệch <= 500)
            bestMoves.push({ r, c });
        }
    }

    // Random chọn 1 trong các nước đi tốt nhất
    return bestMoves.length > 0 ? bestMoves[Math.floor(Math.random() * bestMoves.length)] : null;
}

function makeAIMove() {
    if (!isGameActive) return;
    isBotMove = true;
    const move = getBotMove();
    if (move) makeMove(move.r, move.c);
    isBotMove = false;
}

// ══════════════════════════════════════════════════════════════
// Tính điểm mối đe dọa SỐNG (loại bỏ chuỗi đã bị chặn 2 đầu)
// Trả về { attackScore, defendScore, bestAttackMove, bestDefendMove }
// ══════════════════════════════════════════════════════════════
function assessThreats(cands, bp, hp) {
    const blockBothEnds = document.getElementById('block-both-ends').checked;

    let attackScore = 0, defendScore = 0;
    let bestAttackMoves = [], bestAttackVal = -Infinity;
    let bestDefendMoves = [], bestDefendVal = -Infinity;

    for (const { r, c } of cands) {
        // --- Đánh giá nếu BOT đi vào đây ---
        let aVal = 0;
        setCell(r, c, bp);
        let aFour = 0, aThreeOpen = 0;
        for (const { dr, dc } of DIRECTIONS) {
            const lv = evalLine(r, c, dr, dc, bp);
            if (lv === TL.NONE) continue;
            if (blockBothEnds) {
                const { blockedBoth } = countLineAndBlocked(r, c, dr, dc, bp);
                if (blockedBoth) continue;
            }
            aVal += scoreFromTL(lv, true);
            if (lv === TL.FOUR_OPEN || lv === TL.FOUR_BLOCKED) aFour++;
            if (lv === TL.THREE_OPEN) aThreeOpen++;
        }
        setCell(r, c, '');
        // Bonus tấn công kép
        if (aThreeOpen >= 2)              aVal += BONUS_DOUBLE_THREE;
        if (aFour >= 1 && aThreeOpen >= 1) aVal += BONUS_FOUR_THREE;
        if (aFour >= 2)                   aVal += BONUS_DOUBLE_FOUR;
        aVal += centerBias(r, c);

        // Thêm random noise để tạo sự khác biệt
        aVal += Math.random() * 1000;

        attackScore = Math.max(attackScore, aVal);
        if (aVal > bestAttackVal) {
            bestAttackVal = aVal;
            bestAttackMoves = [{ r, c, score: aVal }];
        } else if (aVal >= bestAttackVal - 1000 && aVal > 0) {
            // Chấp nhận các nước đi có điểm tương đương (chênh lệch <= 1000)
            bestAttackMoves.push({ r, c, score: aVal });
        }

        // --- Đánh giá nếu ĐỊCH đi vào đây ---
        let dVal = 0;
        setCell(r, c, hp);
        for (const { dr, dc } of DIRECTIONS) {
            const lv = evalLine(r, c, dr, dc, hp);
            if (lv === TL.NONE) continue;
            if (blockBothEnds) {
                const { blockedBoth } = countLineAndBlocked(r, c, dr, dc, hp);
                if (blockedBoth) continue;
            }
            dVal += scoreFromTL(lv, false);
        }
        setCell(r, c, '');

        // Thêm random noise để tạo sự khác biệt
        dVal += Math.random() * 1000;

        defendScore = Math.max(defendScore, dVal);
        if (dVal > bestDefendVal) {
            bestDefendVal = dVal;
            bestDefendMoves = [{ r, c, score: dVal }];
        } else if (dVal >= bestDefendVal - 1000 && dVal > 0) {
            // Chấp nhận các nước đi có điểm tương đương (chênh lệch <= 1000)
            bestDefendMoves.push({ r, c, score: dVal });
        }
    }

    // Random chọn 1 trong các nước đi tốt nhất
    const bestAttackMove = bestAttackMoves.length > 0
        ? bestAttackMoves[Math.floor(Math.random() * bestAttackMoves.length)]
        : null;
    const bestDefendMove = bestDefendMoves.length > 0
        ? bestDefendMoves[Math.floor(Math.random() * bestDefendMoves.length)]
        : null;

    // Debug log để xem randomization có hoạt động không
    if (Math.random() < 0.05) { // chỉ log 5% để tránh spam
        console.log(`[Random] bestAttackMoves: ${bestAttackMoves.length}, bestDefendMoves: ${bestDefendMoves.length}`);
        console.log(`[Random] bestAttackMove:`, bestAttackMove, 'bestDefendMove:', bestDefendMove);
    }

    return { attackScore, defendScore, bestAttackMove, bestDefendMove };
}

function getBotMove() {
    const cands = getSearchCandidates();
    if (cands.length === 0) return { r: 0, c: 0 };
    
    // Lọc bỏ các ô đã có quân (tránh đi vào ô đã có)
    const validCands = cands.filter(({ r, c }) => getCell(r, c) === '');
    if (validCands.length === 0) return { r: 0, c: 0 };
    
    const bp = botPiece, hp = humanPiece;
    const blockBothEnds = document.getElementById('block-both-ends').checked;

    // ══════════════════════════════════════════════════════
    // DIFFICULTY-BASED PIPELINE - Điều chỉnh theo level bot
    // ══════════════════════════════════════════════════════
    const isEasy = gameMode === 'ai-easy';
    const isMedium = gameMode === 'ai-medium';
    const isHard = gameMode === 'ai-hard';
    const isGod = gameMode === 'ai-god';

    updateBotThinking('Đang phân tích bàn cờ...');

    // ══════════════════════════════════════════════════════
    // 0. BOT THẮNG NGAY — tuyệt đối ưu tiên
    // ══════════════════════════════════════════════════════
    for (const { r, c } of validCands) {
        setCell(r, c, bp);
        const win = checkWinSilent(r, c);
        setCell(r, c, '');
        if (win) { updateBotThinking('TÌM THẤY NƯỚC THẮNG! 🎯'); return { r, c }; }
    }

    // ══════════════════════════════════════════════════════
    // 0.3. PROACTIVE PATTERN BLOCK — RÚT KINH NGHIỆM THỰC CHIẾN
    //
    // Kiểm tra xem địch đang đi theo chuỗi nước đã từng thắng bot không.
    // Nếu có pattern khớp trong botMemory → dự đoán nước tiếp theo của địch
    // và chặn ngay, không chờ địch thực sự tạo FOUR.
    //
    // Ưu tiên sau win-ngay nhưng TRƯỚC mọi logic khác vì đây là kinh nghiệm
    // đã học được từ thua — phải được áp dụng sớm nhất có thể.
    // ══════════════════════════════════════════════════════
    if (!isEasy && typeof botMemory !== 'undefined' && Object.keys(botMemory).length > 0) {
        const enemyMoves = moveHistory.filter(m => m.player === hp);
        if (enemyMoves.length >= 2) {
            // Tìm pattern dài nhất khớp với chuỗi nước địch hiện tại
            let matchedPattern = null;
            let matchDepth = 0;

            for (let depth = Math.min(MEMORY_DEPTH, enemyMoves.length); depth >= 2; depth--) {
                const recent = enemyMoves.slice(-depth);
                const key = normalizeMoveSequence(recent);
                if (!key) continue;
                const entry = botMemory[key];
                if (entry && entry.hits >= 1) {
                    matchedPattern = { key, entry, recent };
                    matchDepth = depth;
                    break; // lấy pattern dài nhất khớp
                }
            }

            if (matchedPattern) {
                // Dự đoán nước tiếp theo: tìm ô trống tốt nhất gần chuỗi địch
                // để chặn trước khi họ hoàn thành thế cờ đã biết
                const { recent } = matchedPattern;

                // Lấy hướng chủ đạo của chuỗi (vector từ nước đầu đến nước cuối)
                const r0 = recent[0].r, c0 = recent[0].c;
                const rLast = recent[recent.length - 1].r;
                const cLast = recent[recent.length - 1].c;

                // Tìm ô ứng viên tốt nhất để chặn: ưu tiên ô sát chuỗi địch
                // có điểm phòng thủ cao nhất
                let bestBlockMove = null, bestBlockScore = -Infinity;

                for (const { r, c } of validCands) {
                    // Khoảng cách Chebyshev đến chuỗi địch gần nhất
                    let minDist = Infinity;
                    for (const m of recent) {
                        const d = Math.max(Math.abs(r - m.r), Math.abs(c - m.c));
                        if (d < minDist) minDist = d;
                    }
                    if (minDist > 3) continue; // chỉ xét ô gần chuỗi địch

                    // Tính điểm chặn: phòng thủ + tấn công kết hợp
                    let blockScore = 0;
                    setCell(r, c, hp); // giả lập địch đi tiếp
                    for (const { dr, dc } of DIRECTIONS) {
                        const lv = evalLine(r, c, dr, dc, hp);
                        if (lv !== TL.NONE) {
                            const { blockedBoth } = countLineAndBlocked(r, c, dr, dc, hp);
                            if (!blockBothEnds || !blockedBoth) {
                                blockScore += scoreFromTL(lv, false) * 2; // x2 vì đây là pattern đã học
                            }
                        }
                    }
                    setCell(r, c, '');

                    // Thêm proximity bonus: gần chuỗi địch hơn = ưu tiên hơn
                    blockScore += (4 - minDist) * 500;
                    // Thêm hits bonus: pattern xuất hiện nhiều lần = nguy hiểm hơn
                    blockScore += (matchedPattern.entry.hits || 1) * 200;

                    if (blockScore > bestBlockScore) {
                        bestBlockScore = blockScore;
                        bestBlockMove = { r, c };
                    }
                }

                if (bestBlockMove) {
                    const hits = matchedPattern.entry.hits || 1;
                    updateBotThinking(`Nhớ chiêu này rồi! Chặn trước! 🧠 (${hits} lần)`);
                    console.log(`🧠 Pattern block: depth=${matchDepth}, hits=${hits}, move=(${bestBlockMove.r},${bestBlockMove.c})`);
                    return bestBlockMove;
                }
            }
        }
    }

    // ══════════════════════════════════════════════════════
    // 0.5. BOT CÓ FOUR ĐỂ THẮNG (winCount-1) — ưu tiên tấn công
    // ══════════════════════════════════════════════════════
    // Nếu bot có FOUR (winCount-1) → ưu tiên tấn công hơn chặn
    let botWinningMove = null;
    let enemyFour = null; // Lưu FOUR của địch để dùng sau
    
    // Tìm FOUR của bot
    for (const { r, c } of validCands) {
        setCell(r, c, bp);
        let hasFour = false;
        for (const { dr, dc } of DIRECTIONS) {
            const { count, blockedBoth } = countLineAndBlocked(r, c, dr, dc, bp);
            if (count === winCount - 1 && !blockedBoth) {
                hasFour = true;
                break;
            }
        }
        setCell(r, c, '');
        if (hasFour) {
            botWinningMove = { r, c };
            break;
        }
    }
    
    // Tìm FOUR của địch để dùng sau
    for (const { r, c } of validCands) {
        setCell(r, c, hp);
        let hasFour = false;
        for (const { dr, dc } of DIRECTIONS) {
            const { count, blockedBoth } = countLineAndBlocked(r, c, dr, dc, hp);
            if (count === winCount - 1 && !blockedBoth) {
                hasFour = true;
                break;
            }
        }
        setCell(r, c, '');
        if (hasFour) {
            enemyFour = { r, c };
            break;
        }
    }
    
    // Nếu bot có FOUR để thắng → ưu tiên tấn công
    if (botWinningMove) {
        // Chỉ chặn nếu địch CŨNG có FIVE (thắng ngay lập tức)
        let enemyHasFive = false;
        for (const { r, c } of validCands) {
            setCell(r, c, hp);
            const win = checkWinSilent(r, c);
            setCell(r, c, '');
            if (win) {
                enemyHasFive = true;
                break;
            }
        }
        
        if (!enemyHasFive) {
            updateBotThinking('Cơ hội thắng! Tấn công! ⚔️');
            return botWinningMove;
        }
    }

    // ══════════════════════════════════════════════════════
    // 1. ĐỊCH THẮNG NGAY (FIVE) — phải chặn tuyệt đối
    // ══════════════════════════════════════════════════════
    // Dùng findLiveThreats để tìm đúng đầu thoáng của chuỗi winCount-1
    const enemyFiveThreats = findLiveThreats(hp, winCount - 1);
    for (const { r, c } of enemyFiveThreats) {
        if (getCell(r, c) === '') {
            updateBotThinking('Chặn kịp! 😤');
            return { r, c };
        }
    }
    // Fallback: kiểm tra thêm bằng setCell/checkWinSilent
    for (const { r, c } of validCands) {
        setCell(r, c, hp);
        const win = checkWinSilent(r, c);
        setCell(r, c, '');
        if (win) { updateBotThinking('Chặn kịp! 😤'); return { r, c }; }
    }

    // ══════════════════════════════════════════════════════
    // 2. CHẶN FOUR ĐỊCH (chuỗi winCount-1 còn sống)
    //    findLiveThreats quét từ quân X đã có, tìm đúng đầu thoáng
    //    → không bao giờ bỏ sót dù ô trống ở đầu hay cuối chuỗi
    // ══════════════════════════════════════════════════════
    // Easy mode bỏ qua bước này
    if (!isEasy) {
        const enemyFourThreats = findLiveThreats(hp, winCount - 1);
        // findLiveThreats(winCount-1) đã bao gồm cả FIVE ở bước trên,
        // nhưng ở đây địch chưa đủ winCount nên count=winCount-1 → đúng
        // Lấy thêm trường hợp winCount-1 từ cả 2 hướng
        if (enemyFourThreats.length > 0) {
            // Chọn ô có quickScore cao nhất trong danh sách cần chặn
            let best = null, bestS = -Infinity;
            for (const { r, c } of enemyFourThreats) {
                if (getCell(r, c) !== '') continue;
                const s = quickScore(r, c, bp);
                if (s > bestS) { bestS = s; best = { r, c }; }
            }
            // Nếu bot CŨNG có FOUR để thắng → ưu tiên tấn công
            if (botWinningMove && best) {
                updateBotThinking('Cả 2 có 4! Tấn công trước! ⚔️');
                return botWinningMove;
            }
            // Nếu chỉ địch có FOUR → chặn
            if (best && !botWinningMove) { 
                updateBotThinking('Chặn 4 địch! 🛡️'); 
                return best; 
            }
        }
    }

    // ══════════════════════════════════════════════════════
    // 2.5. NHÌN TRƯỚC — địch sẽ tạo FOUR nếu bot không chặn ngay?
    //
    //  Duyệt tất cả ô trống: nếu địch đi vào đó lượt này thì
    //  lượt sau địch sẽ có chuỗi winCount-1 còn sống không?
    //  Nếu CÓ → chặn ô đó ngay (không chờ địch thực sự tạo FOUR).
    //
    //  Đây là cách phát hiện "X sắp tạo FOUR từ THREE" và
    //  "double threat" (2 hướng tấn công cùng lúc).
    // ══════════════════════════════════════════════════════
    // Medium/Hard/God mode mới dùng lookahead
    if (!isEasy) {
        let preFourBlock = null, preFourScore = -Infinity;
        let preDoubleThree = null, preDTScore = -Infinity;

        for (const { r, c } of validCands) {
            if (getCell(r, c) !== '') continue;

            // Giả lập địch đi vào ô này
            setCell(r, c, hp);

            // Kiểm tra: sau nước đi này địch có FOUR nào còn sống không?
            let liveFourCount   = 0;
            let liveThreeCount  = 0;

            for (const { dr, dc } of DIRECTIONS) {
                const { count, blockedBoth } = countLineAndBlocked(r, c, dr, dc, hp);
                if (blockBothEnds && blockedBoth) continue;

                if (count === winCount - 1) liveFourCount++;
                if (count === winCount - 2) liveThreeCount++;
            }

            setCell(r, c, '');

            // Địch tạo FOUR → cực nguy hiểm, phải chặn ngay
            if (liveFourCount >= 1) {
                const s = quickScore(r, c, bp);
                if (s > preFourScore) { preFourScore = s; preFourBlock = { r, c }; }
            }
            // Địch tạo double THREE → cũng rất nguy hiểm (sẽ thành fork)
            else if (liveThreeCount >= 2) {
                const s = quickScore(r, c, bp);
                if (s > preDTScore) { preDTScore = s; preDoubleThree = { r, c }; }
            }
        }

        if (preFourBlock) {
            updateBotThinking('Chặn trước khi địch tạo 4! 🔮');
            return preFourBlock;
        }
        if (preDoubleThree) {
            updateBotThinking('Chặn fork trước! 🔮');
            return preDoubleThree;
        }
    }

    //    attackScore  = điểm tốt nhất bot có thể tạo ra
    //    defendScore  = điểm nguy hiểm nhất địch sẽ tạo ra
    // ══════════════════════════════════════════════════════
    const { attackScore, defendScore, bestAttackMove, bestDefendMove } =
        assessThreats(validCands, bp, hp);

    // Bot có lợi thế rõ ràng (≥ địch) → tấn công
    // Địch nguy hiểm hơn               → phòng thủ
    // God mode: ưu tiên tấn công hơn, chỉ phòng thủ khi địch cực kỳ nguy hiểm
    let shouldAttack = attackScore >= defendScore;
    if (isGod) {
        // God mode: ưu tiên tấn công nhiều hơn
        shouldAttack = attackScore >= defendScore * 0.8; // Chỉ phòng thủ khi địch nguy hiểm hơn 25%
    }

    console.log(`🎯 Attack=${attackScore} | Defend=${defendScore} | ${shouldAttack ? 'ATTACK' : 'DEFEND'}`);

    // ══════════════════════════════════════════════════════
    // 3. FOUR — đã tìm ở bước 0.5, dùng lại kết quả
    // ══════════════════════════════════════════════════════
    // botWinningMove và enemyFour đã được tìm ở bước 0.5
    
    if (botWinningMove && enemyFour) {
        // Cả 2 đều có FOUR → đánh của bot trước (tấn công thắng phòng thủ)
        updateBotThinking('Cả 2 có 4! Tấn công trước! ⚔️');
        return botWinningMove;
    }
    if (botWinningMove) { updateBotThinking('Cơ hội 4 mở! ⚔️'); return botWinningMove; }
    if (enemyFour)   { updateBotThinking('Chặn 4 địch! 🛡️'); return enemyFour; }

    // ══════════════════════════════════════════════════════
    // 4. DOUBLE THREE — so sánh rồi quyết định
    // ══════════════════════════════════════════════════════
    let botDoubleThree = null, enemyDoubleThree = null;
    let botDTScore = -Infinity, enemyDTScore = -Infinity;

    for (const { r, c } of validCands) {
        // Bot tạo double three
        setCell(r, c, bp);
        let bThree = 0;
        for (const { dr, dc } of DIRECTIONS) {
            const { count, blockedBoth } = countLineAndBlocked(r, c, dr, dc, bp);
            if (count !== winCount - 2) continue;
            if (blockBothEnds && blockedBoth) continue;
            bThree++;
        }
        setCell(r, c, '');
        if (bThree >= 2) {
            const s = quickScore(r, c, bp);
            if (s > botDTScore) { botDTScore = s; botDoubleThree = { r, c }; }
        }

        // Địch tạo double three
        setCell(r, c, hp);
        let eThree = 0;
        for (const { dr, dc } of DIRECTIONS) {
            const { count, blockedBoth } = countLineAndBlocked(r, c, dr, dc, hp);
            if (count !== winCount - 2) continue;
            if (blockBothEnds && blockedBoth) continue;
            eThree++;
        }
        setCell(r, c, '');
        if (eThree >= 2) {
            const s = quickScore(r, c, bp);
            if (s > enemyDTScore) { enemyDTScore = s; enemyDoubleThree = { r, c }; }
        }
    }

    if (botDoubleThree && enemyDoubleThree) {
        // Địch có double three → luôn chặn, bất kể shouldAttack
        updateBotThinking('Chặn double three địch! 🔥'); return enemyDoubleThree;
    }
    if (botDoubleThree)   { updateBotThinking('Tạo double three! ⚡'); return botDoubleThree; }
    if (enemyDoubleThree) { updateBotThinking('Chặn double three địch! 🔥'); return enemyDoubleThree; }

    // ══════════════════════════════════════════════════════
    // 4.5. EARLY GAME DEFENSE — đầu game áp sát, ngăn người chơi
    //      spread thoải mái tạo nước đôi/ba
    //      Kích hoạt khi số nước còn ít VÀ không có mối đe dọa cao
    // ══════════════════════════════════════════════════════
    if (!isEasy) {
        const humanMoveCount = moveHistory.filter(m => m.player === hp).length;
        if (humanMoveCount <= EARLY_GAME_THRESHOLD) {
            const earlyMove = earlyGameDefense(validCands, bp, hp);
            if (earlyMove) {
                updateBotThinking('Áp sát, ngăn lan rộng! 🛡️');
                return earlyMove;
            }
        }
    }

    // ══════════════════════════════════════════════════════
    // 5. ADVANCED PATTERN RECOGNITION (God mode only)
    // ══════════════════════════════════════════════════════
    if (isGod) {
        // Check for breakthrough patterns (unstoppable lines)
        const botBreakthroughs = detectBreakthroughPatterns(bp, validCands, hp);
        if (botBreakthroughs.length > 0) {
            updateBotThinking('Phát hiện breakthrough! 🚀');
            return botBreakthroughs[0];
        }
        
        // Check for trap patterns (force opponent into weak position)
        const botTraps = detectTrapPatterns(bp, validCands, hp);
        if (botTraps.length > 0 && shouldAttack) {
            updateBotThinking('Bẫy địch! 🎯');
            return botTraps[0];
        }
        
        // Check enemy traps and block them — luôn chặn bất kể shouldAttack
        const enemyTraps = detectTrapPatterns(hp, validCands, bp);
        if (enemyTraps.length > 0) {
            updateBotThinking('Phát hiện bẫy địch! 🛡️');
            return enemyTraps[0].forcedResponse;
        }
        
        // Check for double threat patterns
        const botDoubleThreats = detectDoubleThreatPatterns(bp, validCands);
        if (botDoubleThreats.length > 0 && shouldAttack) {
            updateBotThinking('Tạo double threat! ⚡');
            return botDoubleThreats[0];
        }
        
        // Địch có double threat → luôn chặn
        const enemyDoubleThreats = detectDoubleThreatPatterns(hp, validCands);
        if (enemyDoubleThreats.length > 0) {
            updateBotThinking('Chặn double threat địch! 🔥');
            return enemyDoubleThreats[0];
        }
        
        // Check for fork patterns using new detection
        const botForks = detectForkPatterns(bp, validCands);
        const enemyForks = detectForkPatterns(hp, validCands);
        
        // Địch có fork → luôn chặn trước
        if (enemyForks.length > 0) {
            updateBotThinking('Chặn fork địch! 🛡️');
            return enemyForks[0];
        }
        if (shouldAttack && botForks.length > 0) {
            updateBotThinking('Tạo fork! ⚡');
            return botForks[0];
        }
    }
    
    // ══════════════════════════════════════════════════════
    // 5.5. FORK — dựa vào shouldAttack để ưu tiên (Hard mode fallback)
    // ══════════════════════════════════════════════════════
    // Hard mode dùng detectForkPatterns
    if (isHard && !isGod) {
        const botForks = detectForkPatterns(bp, validCands);
        const enemyForks = detectForkPatterns(hp, validCands);

        // Địch có fork → luôn chặn, không phụ thuộc shouldAttack
        if (enemyForks.length > 0) { updateBotThinking('Chặn fork địch! 🛡️'); return enemyForks[0]; }
        if (botForks.length > 0)   { updateBotThinking('Tạo fork! ⚡');        return botForks[0]; }
    }

    // ══════════════════════════════════════════════════════
    // 5.5. LOOKAHEAD — tránh nước đi cho địch tạo FOUR
    //    Kiểm tra: nếu bot đi đây → địch phản công → địch có FOUR không?
    //    Nếu có → chọn nước đi an toàn khác
    // ══════════════════════════════════════════════════════
    // God mode mới dùng lookahead
    if (isGod) {
        const safeMove = findSafeMoveWithLookahead(validCands, bp, hp);
        if (safeMove) {
            updateBotThinking('Tránh nước nguy hiểm! 🔮'); return safeMove;
        }
    }

    // ══════════════════════════════════════════════════════
    // 5.9. WIN PATTERN — áp dụng thế thắng đã học
    //      Tìm nước tiếp theo khớp với pattern thắng trong botMemory
    // ══════════════════════════════════════════════════════
    if (typeof botMemory !== 'undefined' && Object.keys(botMemory).length > 0) {
        const botMoves = moveHistory.filter(m => m.player === bp);
        if (botMoves.length >= 2) {
            let bestWinMove = null, bestWinScore = -1;
            for (const { r, c } of validCands) {
                // Thử đặt nước này và kiểm tra chuỗi mới có khớp WIN_ pattern không
                const hypothetical = [...botMoves, { r, c, player: bp }];
                for (let depth = 3; depth <= Math.min(8, hypothetical.length); depth++) {
                    const recent = hypothetical.slice(-depth);
                    if (recent.length < depth) continue;
                    const key = 'WIN_' + normalizeMoveSequence(recent);
                    const entry = botMemory[key];
                    if (entry && entry.hits >= 1) { // dùng pattern ngay từ lần học đầu tiên
                        const score = entry.hits * (depth / 8);
                        if (score > bestWinScore) { bestWinScore = score; bestWinMove = { r, c }; }
                    }
                }
            }
            if (bestWinMove) {
                updateBotThinking('Áp dụng thế thắng đã học! 🏆');
                return bestWinMove;
            }
        }
    }

    // ══════════════════════════════════════════════════════
    // 6. BEST MOVE THEO assessThreats + MEMORY
    //    — dùng bestAttackMove / bestDefendMove đã tính sẵn
    //    — kết hợp bộ nhớ kinh nghiệm để tránh lặp pattern thua
    // ══════════════════════════════════════════════════════

    // Cảnh báo sớm nếu bot nhận ra đang bị "chiêu quen"
    const warning = checkPatternWarning(hp);
    if (warning.danger) {
        updateBotThinking(warning.message);
        // Khi nhận ra chiêu quen: chọn nước có điểm cao nhất SAU KHI trừ memory penalty
        // Thay vì trả về bestDefendMove cứng, tìm nước tốt nhất với penalty đã áp dụng
        const memoryAwareCands = validCands
            .map(({ r, c }) => ({
                r, c,
                score: quickScore(r, c, bp) // quickScore đã tích hợp getMemoryPenalty
            }))
            .sort((a, b) => b.score - a.score);
        if (memoryAwareCands.length > 0) {
            updateBotThinking(`${warning.message} → Chọn nước tối ưu! 🧠`);
            return memoryAwareCands[0];
        }
    }

    if (shouldAttack && bestAttackMove) {
        updateBotThinking('Tấn công chiến lược! ⚔️'); return bestAttackMove;
    }
    if (!shouldAttack && bestDefendMove) {
        updateBotThinking('Phòng thủ chiến lược! 🛡️'); return bestDefendMove;
    }

    // ══════════════════════════════════════════════════════
    // 7. ADVANCED AI: MCTS + Minimax (hard/god)
    // ══════════════════════════════════════════════════════
    if (isHard || isGod) {
        updateBotThinking('Đang tính toán sâu... 🧠');
        if (isGod && moveCount > 5) {
            const mctsIterations = winCount >= 6 ? 5000 : 3000;
            const mctsMove = mctsSearch(mctsIterations, 2000);
            if (mctsMove) {
                console.log(`🧠 Neural: ${neuralEvaluator.evaluate(bp).toFixed(0)}`);
                updateBotThinking('MCTS đã tìm ra nước đi! 🚀');
                return mctsMove;
            }
        }
        let depth;
        if (isGod) {
            if (winCount >= 8) depth = 8;
            else if (winCount >= 6) depth = 7;
            else if (winCount === 5) depth = 6;
            else if (winCount === 4) depth = 5;
            else depth = 4; // winCount = 3
        } else {
            depth = winCount >= 6 ? 4 : 3;
        }
        if (moveCount >= 15) depth = Math.max(2, depth - 1);
        const minimaxMove = getBestMoveWithMinimax(depth, bp);
        if (minimaxMove) {
            console.log(`🧠 Neural: ${neuralEvaluator.evaluate(bp).toFixed(0)}`);
            updateBotThinking('PVS đã tìm ra nước đi! ⚡');
            return minimaxMove;
        }
    }

    // Fallback
    const scored = validCands.map(({ r, c }) => ({ r, c, score: quickScore(r, c, bp) }));
    scored.sort((a, b) => b.score - a.score);
    return scored[0] || validCands[0];
}

function updateBotThinking(message) {
    if (statusPanel) statusPanel.innerHTML = `🤖 <span style="opacity:0.7">${message}</span> <span class="think-dots">...</span>`;
    const botMessage = document.getElementById('bot-message');
    if (botMessage) botMessage.textContent = message;
}

// ===== ĐÁNH GIÁ NƯỚC ĐI NGƯỜI CHƠI =====
function evaluateOverallBoardDanger(playerPiece) {
    let fiveCount=0, fourOpenCount=0, fourBlockedCount=0, threeOpenCount=0, threeBlockedCount=0, twoOpenCount=0;
    const cands = getSearchCandidates();
    for (const { r, c } of cands) {
        if (getCell(r,c) === playerPiece) {
            for (const { dr, dc } of DIRECTIONS) {
                const res = evalLine(r,c,dr,dc,playerPiece);
                if (res===TL.FIVE)          fiveCount++;
                else if (res===TL.FOUR_OPEN)    fourOpenCount++;
                else if (res===TL.FOUR_BLOCKED) fourBlockedCount++;
                else if (res===TL.THREE_OPEN)   threeOpenCount++;
                else if (res===TL.THREE_BLOCKED) threeBlockedCount++;
                else if (res===TL.TWO_OPEN)     twoOpenCount++;
            }
        }
    }
    let overallDanger = fiveCount*15 + fourOpenCount*8 + fourBlockedCount*3 + threeOpenCount*2 + threeBlockedCount*1 + twoOpenCount*0.5;
    if (fourOpenCount>=2) overallDanger+=10;
    if (threeOpenCount>=2) overallDanger+=5;
    if (fourOpenCount>=1 && threeOpenCount>=1) overallDanger+=7;
    return { overallDanger, fiveCount, fourOpenCount, fourBlockedCount, threeOpenCount, threeBlockedCount, twoOpenCount };
}

function evaluatePlayerMove(r, c) {
    const hp = humanPiece, bp = botPiece;
    const playerScore = quickScore(r, c, hp);
    const cands = getSearchCandidates();
    let bestBotScore = -Infinity;
    for (const cand of cands) { const s = quickScore(cand.r, cand.c, bp); if (s > bestBotScore) bestBotScore = s; }

    const boardDanger = evaluateOverallBoardDanger(hp);
    let hasThreat = false, currentDangerScore = 0;
    for (const { dr, dc } of DIRECTIONS) {
        const tTa = evalLine(r, c, dr, dc, hp);
        if (tTa === TL.FIVE)      { hasThreat = true; currentDangerScore += 10; }
        else if (tTa === TL.FOUR_OPEN)  { hasThreat = true; currentDangerScore += 5; }
        else if (tTa === TL.THREE_OPEN) currentDangerScore += 2;
    }
    playerDangerScore += currentDangerScore + (boardDanger.overallDanger * 0.1);

    let blocksBot = false;
    for (const { dr, dc } of DIRECTIONS) {
        const tDich = evalLine(r, c, dr, dc, bp);
        if (tDich === TL.FOUR_OPEN || tDich === TL.FIVE) { blocksBot = true; break; }
    }

    const excellentMoves = ['Ui da! Đã đọc được nước cờ này rồi nhé! 🧠','Wow! Nước đi này quá đỉnh! 📝','Chất lượng! Nước đi này khiến tôi phải suy nghĩ lại! 🤔','Xuất sắc! Bạn đã tìm được điểm yếu của tôi! 💡','Đáng sợ! Nước đi này rất nguy hiểm! 😱'];
    const dangerousMoves = ['Uầy! Nước đi nguy hiểm quá! 😱','Cẩn thận! Đòn này rất mạnh! ⚠️','Ác thật! Bạn đang tạo áp lực lớn! 😰','Gớm! Nước này khiến tôi lo lắng! 😨','Nghệ thuật! Nước đi rất cá tính! 🎨'];
    const blockMessages  = ['Chặn khéo léo đấy! 👏','Khá lắm! Đã chặn được nước của tôi! 🛡️','Thông minh! Bạn biết cách phòng thủ! 🧠','Hay! Chặn đúng chỗ! 🎯','Khôn khéo! Không dễ gì đánh bại bạn! 😏'];
    const goodMoves      = ['Wow! Nước đi xuất sắc! 🌟','Tốt! Cố lên! 😊','Khá! Tiếp tục nhé! 👍','Được! Nước đi ổn! ✅','Không tệ! Cố gắng hơn! 💪'];
    const averageMoves   = ['Bình thường, có thể tốt hơn 🤔','Cơ bản! Cần sáng tạo hơn! 🤷','Được thôi! Nhưng chưa đủ! 😐','Tạm ổn! Cần chiến thuật! 📋','Vừa phải! Cải thiện đi! 🔄'];
    const poorMoves      = ['Hmm, nước đi này chưa tối ưu lắm 😅','Thôi! Cần suy nghĩ kỹ hơn! 🤔','Tệ! Đừng đi như thế! 😅','Không! Nước này không tốt! 🙅','Lỗi! Cần thay đổi chiến thuật! ❌'];

    let message, emoji;
    const pick = arr => arr[Math.floor(Math.random()*arr.length)];
    if (hasThreat && currentDangerScore >= 5)   { message = pick(dangerousMoves); emoji = '⚠️'; }
    else if (playerScore > bestBotScore * 0.9)  { message = pick(excellentMoves); emoji = '🌟'; }
    else if (blocksBot)                          { message = pick(blockMessages);  emoji = '🛡️'; }
    else if (playerScore > bestBotScore * 0.8)  { message = pick(goodMoves);      emoji = '👍'; }
    else if (playerScore > bestBotScore * 0.5)  { message = pick(goodMoves);      emoji = '😊'; }
    else if (playerScore > bestBotScore * 0.3)  { message = pick(averageMoves);   emoji = '🤔'; }
    else                                         { message = pick(poorMoves);      emoji = '💭'; }

    setTimeout(() => {
        if (statusPanel && isGameActive) statusPanel.innerHTML = `${emoji} ${message}`;
        const botMessage = document.getElementById('bot-message');
        if (botMessage) botMessage.textContent = message;
    }, 500);

    window.lastPlayerEvaluation = { message, emoji, playerScore, bestBotScore };
}
