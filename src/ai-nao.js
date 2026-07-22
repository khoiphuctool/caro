// ===== AI NÃO - Toàn bộ engine AI =====

// ════════════════════════════════════════════════════════════════════════════
// BẢNG ĐIỂM — proxy vào ScoreTable (single source of truth)
// ════════════════════════════════════════════════════════════════════════════
const SCORE_ATK = new Proxy({}, {
    get(_, key) {
        return (typeof ScoreTable !== 'undefined') ? ScoreTable.ATTACK[key] : ({
            FIVE:150000, FOUR_OPEN:12000, FOUR_BLOCKED:2500,
            THREE_OPEN:7500, THREE_BLOCKED:450, TWO_OPEN:300, TWO_BLOCKED:30
        })[key];
    }
});
const SCORE_DEF = new Proxy({}, {
    get(_, key) {
        return (typeof ScoreTable !== 'undefined') ? ScoreTable.DEFENSE[key] : ({
            FIVE:90000, FOUR_OPEN:9000, FOUR_BLOCKED:1200,
            THREE_OPEN:4500, THREE_BLOCKED:300, TWO_OPEN:100, TWO_BLOCKED:10
        })[key];
    }
});

function getBonusDoubleThree() { return (typeof ScoreTable !== 'undefined') ? ScoreTable.BONUS.DOUBLE_THREE : 20000; }
function getBonusFourThree()   { return (typeof ScoreTable !== 'undefined') ? ScoreTable.BONUS.FOUR_THREE   : 25000; }
function getBonusDoubleFour()  { return (typeof ScoreTable !== 'undefined') ? ScoreTable.BONUS.DOUBLE_FOUR  : 60000; }

Object.defineProperty(window, 'BONUS_DOUBLE_THREE', { get: getBonusDoubleThree });
Object.defineProperty(window, 'BONUS_FOUR_THREE',   { get: getBonusFourThree });
Object.defineProperty(window, 'BONUS_DOUBLE_FOUR',  { get: getBonusDoubleFour });
Object.defineProperty(window, 'CENTER_BIAS_MAX',  { get() { return (typeof ScoreTable !== 'undefined') ? ScoreTable.CENTER_BIAS.MAX      : 20; } });
Object.defineProperty(window, 'CENTER_BIAS_DIST', { get() { return (typeof ScoreTable !== 'undefined') ? ScoreTable.CENTER_BIAS.DISTANCE  : 5;  } });

// Dữ liệu cũ TL giữ lại để không lỗi các hàm đang dùng
const TL = {
    FIVE: 5, FOUR_OPEN: 4.5, FOUR_BLOCKED: 4,
    THREE_OPEN: 3.5, THREE_BLOCKED: 3,
    TWO_OPEN: 2.5, TWO_BLOCKED: 2, NONE: 0
};

// ════════════════════════════════════════════════════════════════════════════
// evalLine — trả về TL.* (giữ nguyên để tương thích các hàm khác)
// ════════════════════════════════════════════════════════════════════════════
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

// ════════════════════════════════════════════════════════════════════════════
// THREAT LEVEL mở rộng — nhận diện BROKEN patterns và thế nguy hiểm nâng cao
// Trả về mảng { tlLevel, score, blockPoints[] } cho tất cả thế trên 1 hướng
// ════════════════════════════════════════════════════════════════════════════
const TL_EXT = {
    // Broken Four: 4 quân có 1 lỗ, điền vào là thắng ngay
    BROKEN_FOUR_OPEN:    4.4,  // _OO_OO_ hoặc _O_OOO_ (2 đầu thoáng)
    BROKEN_FOUR_BLOCKED: 4.1,  // XOO_OO_ hoặc tương tự (1 đầu bị chặn)
    // Broken Three: 3 quân có lỗ, nguy hiểm cao
    BROKEN_THREE_OPEN:   3.4,  // _O_OO_ hoặc _OO_O_
    BROKEN_THREE_BLOCKED:3.1,
    // Triple Threat: 3 hướng cùng đe dọa từ 1 ô
    TRIPLE_THREAT:       4.8,
    // Sleeping Four: OOOO_ (1 đầu thoáng, 1 đầu biên/chặn) — cần chặn ngay
    SLEEPING_FOUR:       4.0,
};

/**
 * Quét 1 hướng (dr,dc) từ ô (r,c) — tìm tất cả thế nguy hiểm kể cả broken.
 * Trả về { level, blockPoints } hoặc null nếu không có.
 * level dùng để so sánh ưu tiên, blockPoints là các ô cần đặt để chặn/hoàn thành.
 */
function evalLineFull(r, c, dr, dc, p) {
    const opp = p === 'X' ? 'O' : 'X';
    const results = [];

    // Quét một cửa sổ đủ rộng (winCount + 1 mỗi chiều) quanh (r,c) theo hướng (dr,dc)
    // Tập hợp các ô trong cửa sổ: từ -(winCount-1) đến +(winCount-1)
    const W = winCount - 1;
    const window = [];
    for (let i = -W; i <= W; i++) {
        const wr = r + dr * i, wc = c + dc * i;
        const cell = getCell(wr, wc);
        window.push({ r: wr, c: wc, v: cell, i });
    }

    // Trượt cửa sổ winCount ô
    for (let start = 0; start + winCount - 1 < window.length; start++) {
        const slice = window.slice(start, start + winCount);

        // Đếm quân p, quân opp, và ô trống trong slice
        let pCount = 0, oppCount = 0, emptyIndices = [];
        for (let k = 0; k < slice.length; k++) {
            if (slice[k].v === p)   pCount++;
            else if (slice[k].v === opp) oppCount++;
            else emptyIndices.push(k);
        }

        // Nếu có quân địch trong slice → không thể hoàn thành → bỏ qua
        if (oppCount > 0) continue;

        // Kiểm tra 2 đầu ngoài slice
        const outerHead = window[start - 1];
        const outerTail = window[start + winCount];
        const headBlocked = outerHead ? outerHead.v === opp : true; // biên = bị chặn
        const tailBlocked = outerTail ? outerTail.v === opp : true;
        const headOpen    = outerHead ? outerHead.v === '' : false;
        const tailOpen    = outerTail ? outerTail.v === '' : false;

        const bothBlocked = headBlocked && tailBlocked;
        if (bothBlocked) continue; // chuỗi chết hoàn toàn

        const blockPts = emptyIndices.map(k => ({ r: slice[k].r, c: slice[k].c }));

        if (pCount === winCount) {
            // Không thể xảy ra (ô (r,c) chưa đặt) nhưng bảo vệ
            results.push({ level: TL.FIVE, blockPts: [] });
        } else if (pCount === winCount - 1 && emptyIndices.length === 1) {
            // FOUR: thiếu 1 ô, điền vào là thắng
            if (!headBlocked && !tailBlocked) {
                // Broken Four 2 đầu thoáng (lỗ nằm trong)
                results.push({ level: TL_EXT.BROKEN_FOUR_OPEN, blockPts });
            } else {
                results.push({ level: TL_EXT.BROKEN_FOUR_BLOCKED, blockPts });
            }
        } else if (pCount === winCount - 2 && emptyIndices.length === 2) {
            // THREE: thiếu 2 ô
            // Phân biệt Broken Three (lỗ bên trong) vs Three thường (2 đầu trống)
            const inner = emptyIndices.filter(k => k > 0 && k < winCount - 1);
            if (inner.length >= 1) {
                // Ít nhất 1 lỗ bên trong → Broken Three
                const level = (!headBlocked && !tailBlocked)
                    ? TL_EXT.BROKEN_THREE_OPEN
                    : TL_EXT.BROKEN_THREE_BLOCKED;
                results.push({ level, blockPts });
            }
        }
    }

    // Trả về kết quả nguy hiểm nhất tìm được
    if (results.length === 0) return null;
    results.sort((a, b) => b.level - a.level);
    return results[0];
}

/**
 * Tính điểm đầy đủ cho ô (r,c) của quân p, bao gồm broken patterns.
 * Trả về { score, brokenFourCount, brokenThreeCount, blockPts[] }
 */
function evalCellFull(r, c, p, isAttack) {
    const opp = p === 'X' ? 'O' : 'X';
    let score = 0;
    let brokenFourCount = 0, brokenThreeCount = 0;
    const allBlockPts = new Set();

    for (const { dr, dc } of DIRECTIONS) {
        const res = evalLineFull(r, c, dr, dc, p);
        if (!res) continue;

        const { level, blockPts } = res;
        blockPts.forEach(bp => allBlockPts.add(`${bp.r},${bp.c}`));

        // Dùng scoreFromTL để scale đúng theo winCount (single source of truth)
        if (level === TL_EXT.BROKEN_FOUR_OPEN) {
            score += scoreFromTL(TL.FOUR_OPEN, isAttack) * 0.9;
            brokenFourCount++;
        } else if (level === TL_EXT.BROKEN_FOUR_BLOCKED) {
            score += scoreFromTL(TL.FOUR_BLOCKED, isAttack) * 0.85;
            brokenFourCount++;
        } else if (level === TL_EXT.BROKEN_THREE_OPEN) {
            score += scoreFromTL(TL.THREE_OPEN, isAttack) * 0.8;
            brokenThreeCount++;
        } else if (level === TL_EXT.BROKEN_THREE_BLOCKED) {
            score += scoreFromTL(TL.THREE_BLOCKED, isAttack) * 0.75;
            brokenThreeCount++;
        }
    }

    // Bonus kép broken
    if (brokenFourCount >= 2)                          score += BONUS_DOUBLE_FOUR * 0.8;
    if (brokenFourCount >= 1 && brokenThreeCount >= 1) score += BONUS_FOUR_THREE * 0.7;
    if (brokenThreeCount >= 2)                         score += BONUS_DOUBLE_THREE * 0.6;

    return {
        score,
        brokenFourCount,
        brokenThreeCount,
        blockPts: [...allBlockPts].map(k => { const [r,c] = k.split(',').map(Number); return {r,c}; })
    };
}

/**
 * Tìm tất cả thế cờ nguy hiểm của địch — bao gồm broken patterns.
 * Trả về mảng { r, c, level, blockPts, label } sắp xếp theo mức độ nguy hiểm.
 */
function findAllEnemyThreats(hp, validCands) {
    const opp = hp === 'X' ? 'O' : 'X';
    const blockBothEnds = getBlockBothEnds();
    const threatMap = new Map(); // key = "r,c" của ô cần chặn → { score, label }

    const cells = isInfinite
        ? [...infiniteMap.entries()].filter(([,v]) => v === hp).map(([k]) => { const [r,c] = k.split(',').map(Number); return {r,c}; })
        : (() => { const a = []; for(let r=0;r<boardSize;r++) for(let c=0;c<boardSize;c++) if(boardState[r][c]===hp) a.push({r,c}); return a; })();

    for (const { r: pr, c: pc } of cells) {
        for (const { dr, dc } of DIRECTIONS) {
            // Bỏ qua hướng ngược (để tránh đếm 2 lần)
            if (getCell(pr - dr, pc - dc) === hp) continue;

            const res = evalLineFull(pr, pc, dr, dc, hp);
            if (!res) continue;

            const { level, blockPts } = res;
            if (blockBothEnds && level < TL.FOUR_OPEN) {
                // Với luật chặn 2 đầu, THREE_BLOCKED / BROKEN_THREE_BLOCKED ít quan trọng
                const { blockedBoth } = countLineAndBlocked(pr, pc, dr, dc, hp);
                if (blockedBoth) continue;
            }

            // Tính điểm ưu tiên cho mỗi ô cần chặn
            let priority = 0, label = '';
            if      (level >= TL.FIVE)                       { priority = 1000000; label = 'FIVE'; }
            else if (level >= TL_EXT.TRIPLE_THREAT)          { priority = 500000;  label = 'TRIPLE_THREAT'; }
            else if (level >= TL.FOUR_OPEN)                  { priority = 200000;  label = 'FOUR_OPEN'; }
            else if (level >= TL_EXT.BROKEN_FOUR_OPEN)       { priority = 180000;  label = 'BROKEN_FOUR_OPEN'; }
            else if (level >= TL.FOUR_BLOCKED)               { priority = 100000;  label = 'FOUR_BLOCKED'; }
            else if (level >= TL_EXT.BROKEN_FOUR_BLOCKED)    { priority = 90000;   label = 'BROKEN_FOUR_BLOCKED'; }
            else if (level >= TL_EXT.SLEEPING_FOUR)          { priority = 85000;   label = 'SLEEPING_FOUR'; }
            else if (level >= TL.THREE_OPEN)                 { priority = 50000;   label = 'THREE_OPEN'; }
            else if (level >= TL_EXT.BROKEN_THREE_OPEN)      { priority = 40000;   label = 'BROKEN_THREE_OPEN'; }
            else if (level >= TL.THREE_BLOCKED)              { priority = 10000;   label = 'THREE_BLOCKED'; }
            else if (level >= TL_EXT.BROKEN_THREE_BLOCKED)   { priority = 8000;    label = 'BROKEN_THREE_BLOCKED'; }
            else                                             { priority = 1000;    label = 'TWO'; }

            for (const bp of blockPts) {
                const key = `${bp.r},${bp.c}`;
                const cur = threatMap.get(key) || { score: 0, label: '' };
                if (priority > cur.score) {
                    threatMap.set(key, { score: priority, label, r: bp.r, c: bp.c });
                } else {
                    // Cộng dồn khi nhiều mối đe dọa cùng trỏ vào 1 ô
                    threatMap.set(key, { ...cur, score: cur.score + priority * 0.5 });
                }
            }
        }
    }

    // Lọc chỉ những ô thuộc validCands (ô trống hợp lệ)
    const validSet = new Set(validCands.map(({r,c}) => `${r},${c}`));
    return [...threatMap.values()]
        .filter(t => validSet.has(`${t.r},${t.c}`))
        .sort((a, b) => b.score - a.score);
}

// ════════════════════════════════════════════════════════════════════════════
// centerBias — thưởng điểm cho ô gần trung tâm khu chiến
// ════════════════════════════════════════════════════════════════════════════
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

// ════════════════════════════════════════════════════════════════════════════
// scoreFromTL — chuyển TL value sang điểm thực, scale theo winCount
// ════════════════════════════════════════════════════════════════════════════
function scoreFromTL(tl, isAttack) {
    if (typeof ScoreTable !== 'undefined' && ScoreTable.getScaledScore) {
        const tlToPattern = {
            [TL.FIVE]: 1, [TL.FOUR_OPEN]: 2, [TL.FOUR_BLOCKED]: 3,
            [TL.THREE_OPEN]: 4, [TL.THREE_BLOCKED]: 5,
            [TL.TWO_OPEN]: 6, [TL.TWO_BLOCKED]: 7
        };
        const pt = tlToPattern[tl];
        if (pt) return ScoreTable.getScaledScore(pt, isAttack, winCount);
        return 0;
    }
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
        if (infiniteMap.size === 0) {
            // Nước đầu tiên bàn vô hạn: random quanh tâm
            const offsets = [-1, 0, 1];
            const candidates = [];
            for (const dr of offsets)
                for (const dc of offsets)
                    candidates.push({ r: dr, c: dc });
            return [candidates[Math.floor(Math.random() * candidates.length)]];
        }
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
        if (!hasAny) {
            // Nước đầu tiên: random trong vùng 3x3 quanh trung tâm
            // Tránh cho người chơi đoán được vị trí và tạo thế cờ cố định
            const mid = Math.floor(boardSize / 2);
            const offsets = [-1, 0, 1];
            const candidates = [];
            for (const dr of offsets)
                for (const dc of offsets)
                    candidates.push({ r: mid + dr, c: mid + dc });
            return [candidates[Math.floor(Math.random() * candidates.length)]];
        }
        
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

// ════════════════════════════════════════════════════════════════════════════
// Cache DOM lookups — tránh query DOM mỗi lần gọi quickScore trong search
// ════════════════════════════════════════════════════════════════════════════
let _cachedBlockBothEnds = false;
let _blockBothEndsDirty = true;
function getBlockBothEnds() {
    if (_blockBothEndsDirty) {
        const el = document.getElementById('block-both-ends');
        _cachedBlockBothEnds = el ? el.checked : false;
        _blockBothEndsDirty = false;
    }
    return _cachedBlockBothEnds;
}
// Gọi khi người dùng đổi checkbox
function invalidateBlockBothEndsCache() { _blockBothEndsDirty = true; }

// ════════════════════════════════════════════════════════════════════════════
// quickScore — bảng điểm chuẩn + bonus tấn công kép + center bias
// KHÔNG gọi evalCellFull để giữ tốc độ — broken patterns chỉ dùng trong evaluateBoard
// ════════════════════════════════════════════════════════════════════════════
function quickScore(r, c, p) {
    const opp           = p === 'X' ? 'O' : 'X';
    const blockBothEnds = getBlockBothEnds();

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

    // ── MEMORY PENALTY ──
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

    // Move ordering: killer moves trước, sau đó sort bằng evalLine (nhẹ hơn quickScore)
    const cd = currentDepth || 0;
    candidates.sort((a, b) => {
        const aK = isKillerMove(cd, a.r, a.c);
        const bK = isKillerMove(cd, b.r, b.c);
        if (aK && !bK) return -1;
        if (!aK && bK) return 1;
        // Dùng evalLine thay quickScore để tăng tốc — nhanh hơn ~5x
        let sa = 0, sb = 0;
        for (const { dr, dc } of DIRECTIONS) {
            const la = evalLine(a.r, a.c, dr, dc, player); if (la !== TL.NONE) sa += la;
            const lb = evalLine(b.r, b.c, dr, dc, player); if (lb !== TL.NONE) sb += lb;
        }
        return sb - sa;
    });

    // Giới hạn candidates chặt hơn ở depth thấp để cắt nhanh
    const maxCands = depth >= 4 ? 6 : depth >= 2 ? 8 : 12;
    const searchCands = candidates.slice(0, Math.min(candidates.length, maxCands));
    const opponent    = player === 'X' ? 'O' : 'X';

    let bestScore = isMaximizing ? -Infinity : Infinity;
    let firstMove = true;

    for (const { r, c } of searchCands) {
        const oldV = getCell(r, c);
        setCell(r, c, isMaximizing ? player : opponent);
        let score;
        if (firstMove) {
            score = pvs(depth-1, alpha, beta, !isMaximizing, player, startTime, maxTime, cd+1);
            firstMove = false;
        } else if (isMaximizing) {
            score = pvs(depth-1, alpha, alpha+1, false, player, startTime, maxTime, cd+1);
            if (score > alpha) score = pvs(depth-1, alpha, beta, false, player, startTime, maxTime, cd+1);
        } else {
            score = pvs(depth-1, beta-1, beta, true, player, startTime, maxTime, cd+1);
            if (score < beta) score = pvs(depth-1, alpha, beta, true, player, startTime, maxTime, cd+1);
        }
        setCell(r, c, oldV);

        if (isMaximizing) {
            if (score > bestScore) bestScore = score;
            alpha = Math.max(alpha, score);
        } else {
            if (score < bestScore) bestScore = score;
            beta = Math.min(beta, score);
        }
        if (beta <= alpha) { addKillerMove(cd, r, c); break; }
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
    const opponent = player === 'X' ? 'O' : 'X';
    const blockBothEnds = getBlockBothEnds();
    let score = 0;

    // Duyệt tất cả ô đang có quân để đánh giá
    const cells = isInfinite
        ? [...infiniteMap.entries()].map(([k, v]) => { const [r,c] = k.split(',').map(Number); return {r,c,v}; })
        : (() => { const a=[]; for(let r=0;r<boardSize;r++) for(let c=0;c<boardSize;c++) if(boardState[r][c]!=='') a.push({r,c,v:boardState[r][c]}); return a; })();

    // Đếm patterns cho cả 2 bên
    let pFive=0, pFourOpen=0, pFourBlocked=0, pThreeOpen=0, pThreeBlocked=0, pTwoOpen=0;
    let oFive=0, oFourOpen=0, oFourBlocked=0, oThreeOpen=0, oThreeBlocked=0, oTwoOpen=0;
    // Broken patterns
    let pBrokenFourOpen=0, pBrokenFourBlocked=0, pBrokenThreeOpen=0;
    let oBrokenFourOpen=0, oBrokenFourBlocked=0, oBrokenThreeOpen=0;

    const counted = new Set(); // tránh đếm 2 lần cùng chuỗi

    for (const { r, c, v } of cells) {
        const isPlayer = v === player;
        const p = isPlayer ? player : opponent;

        for (const { dr, dc } of DIRECTIONS) {
            // Chỉ đếm từ đầu chuỗi (tránh đếm 2 lần)
            if (getCell(r - dr, c - dc) === p) continue;

            // --- Chuỗi liên tiếp (evalLine) ---
            let len = 0;
            while (getCell(r + dr * len, c + dc * len) === p) len++;
            const headR = r + dr * len, headC = c + dc * len;
            const tailR = r - dr, tailC = c - dc;
            const hCell = getCell(headR, headC), tCell = getCell(tailR, tailC);
            const hOpen = hCell === '', tOpen = tCell === '';
            const hBlock = hCell !== '' && hCell !== p, tBlock = tCell !== '' && tCell !== p;
            const bothBlocked = hBlock && tBlock;

            if (blockBothEnds && bothBlocked) { /* bỏ qua chuỗi chết */ }
            else if (len >= winCount) {
                isPlayer ? pFive++ : oFive++;
            } else if (len === winCount - 1) {
                if (!bothBlocked) {
                    const isOpen = !hBlock && !tBlock;
                    if (isPlayer) { isOpen ? pFourOpen++ : pFourBlocked++; }
                    else          { isOpen ? oFourOpen++ : oFourBlocked++; }
                }
            } else if (len === winCount - 2) {
                if (!bothBlocked) {
                    const isOpen = !hBlock && !tBlock;
                    if (isPlayer) { isOpen ? pThreeOpen++ : pThreeBlocked++; }
                    else          { isOpen ? oThreeOpen++ : oThreeBlocked++; }
                }
            } else if (len === winCount - 3) {
                if (!bothBlocked) {
                    const isOpen = !hBlock && !tBlock;
                    if (isPlayer) { isOpen ? pTwoOpen++ : 0; }
                    else          { isOpen ? oTwoOpen++ : 0; }
                }
            }

            // --- Broken patterns trong cửa sổ winCount ---
            const W = winCount;
            for (let start = -(W-1); start <= 0; start++) {
                const sliceStart = { r: r + dr*start, c: c + dc*start };
                let pCnt = 0, oCnt = 0, gaps = [];
                for (let k = 0; k < W; k++) {
                    const sr = sliceStart.r + dr*k, sc = sliceStart.c + dc*k;
                    const sv = getCell(sr, sc);
                    if (sv === p)             pCnt++;
                    else if (sv === opponent) { oCnt++; break; }
                    else                      gaps.push(k);
                }
                if (oCnt > 0) continue; // địch trong slice → không dùng được
                const outerH = getCell(sliceStart.r + dr*W, sliceStart.c + dc*W);
                const outerT = getCell(sliceStart.r - dr,   sliceStart.c - dc);
                const sliceBothBlocked = (outerH !== '' && outerH !== p) && (outerT !== '' && outerT !== p);
                if (blockBothEnds && sliceBothBlocked) continue;
                const sliceOpen = (outerH === '' || outerH === p) && (outerT === '' || outerT === p);

                const ckey = `${sliceStart.r},${sliceStart.c},${dr},${dc},${p}`;
                if (counted.has(ckey)) continue;

                if (pCnt === W - 1 && gaps.length === 1 && gaps[0] > 0 && gaps[0] < W-1) {
                    // Broken Four: W-1 quân, 1 lỗ bên trong
                    counted.add(ckey);
                    if (isPlayer) { sliceOpen ? pBrokenFourOpen++ : pBrokenFourBlocked++; }
                    else          { sliceOpen ? oBrokenFourOpen++ : oBrokenFourBlocked++; }
                } else if (pCnt === W - 2 && gaps.length === 2) {
                    // Broken Three: W-2 quân, 2 lỗ, ít nhất 1 lỗ bên trong
                    const innerGaps = gaps.filter(k => k > 0 && k < W-1);
                    if (innerGaps.length >= 1) {
                        counted.add(ckey);
                        if (isPlayer) { sliceOpen ? pBrokenThreeOpen++ : 0; }
                        else          { sliceOpen ? oBrokenThreeOpen++ : 0; }
                    }
                }
            }
        }
    }

    // Tính điểm tổng
    const A = SCORE_ATK, D = SCORE_DEF;

    // Thắng/thua tức thì
    if (pFive > 0) return 2000000;
    if (oFive > 0) return -2000000;

    // Điểm tấn công của bot (player)
    score += pFourOpen    * A.FOUR_OPEN;
    score += pFourBlocked * A.FOUR_BLOCKED;
    score += pThreeOpen   * A.THREE_OPEN;
    score += pThreeBlocked* A.THREE_BLOCKED;
    score += pTwoOpen     * A.TWO_OPEN;
    score += pBrokenFourOpen    * A.FOUR_OPEN    * 0.9;
    score += pBrokenFourBlocked * A.FOUR_BLOCKED * 0.85;
    score += pBrokenThreeOpen   * A.THREE_OPEN   * 0.8;

    // Điểm phòng thủ (trừ đi điểm địch)
    score -= oFourOpen    * D.FOUR_OPEN    * 1.1; // phòng thủ được ưu tiên hơn tấn công 1 chút
    score -= oFourBlocked * D.FOUR_BLOCKED * 1.1;
    score -= oThreeOpen   * D.THREE_OPEN   * 1.2; // THREE_OPEN địch rất nguy hiểm
    score -= oThreeBlocked* D.THREE_BLOCKED;
    score -= oTwoOpen     * D.TWO_OPEN;
    score -= oBrokenFourOpen    * D.FOUR_OPEN    * 1.0;
    score -= oBrokenFourBlocked * D.FOUR_BLOCKED * 0.95;
    score -= oBrokenThreeOpen   * D.THREE_OPEN   * 0.9;

    // Bonus combo
    if (pFourOpen >= 2 || pFourBlocked >= 2)              score += BONUS_DOUBLE_FOUR;
    if (pFourOpen >= 1 && pThreeOpen >= 1)                score += BONUS_FOUR_THREE;
    if (pThreeOpen >= 2)                                  score += BONUS_DOUBLE_THREE;
    if (pBrokenFourOpen >= 1 && pThreeOpen >= 1)          score += BONUS_FOUR_THREE * 0.7;
    if (pBrokenFourOpen >= 2)                             score += BONUS_DOUBLE_FOUR * 0.7;

    // Penalty địch combo
    if (oFourOpen >= 2 || (oFourOpen >= 1 && oFourBlocked >= 1)) score -= BONUS_DOUBLE_FOUR * 1.2;
    if (oFourOpen >= 1 && oThreeOpen >= 1)                       score -= BONUS_FOUR_THREE  * 1.2;
    if (oThreeOpen >= 2)                                         score -= BONUS_DOUBLE_THREE * 1.3;
    if (oBrokenFourOpen >= 1 && oThreeOpen >= 1)                 score -= BONUS_FOUR_THREE  * 0.9;

    return score;
}

function enhancedHeuristicScore(r, c, player, dirs) {
    let score = 0;
    const blockBothEnds = getBlockBothEnds();
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

    // Sắp xếp candidates theo quickScore để alpha-beta cắt tốt hơn
    candidates.sort((a, b) => quickScore(b.r, b.c, player) - quickScore(a.r, a.c, player));

    // Số candidates tùy depth: depth lớn thì phải giới hạn để tránh timeout
    const maxCands = depth >= 5 ? 10 : depth >= 4 ? 14 : 20;
    const searchCands = candidates.slice(0, Math.min(candidates.length, maxCands));

    const startTime = Date.now();
    // Time budget: depth cao hơn thì cho nhiều thời gian hơn
    const maxTime = depth >= 5 ? 4000 : depth >= 4 ? 2500 : 1500;

    let bestMove = searchCands[0], bestScore = -Infinity;
    window.isMinimaxRunning = true;

    // Iterative deepening: tìm từ depth=1 đến depth tối đa
    // Kết quả của lượt trước dùng để sắp xếp lại candidates (move ordering)
    let orderedCands = [...searchCands];

    for (let d = 1; d <= depth; d++) {
        if (Date.now() - startTime > maxTime * 0.7) break;

        let iterBestMove = null, iterBestScore = -Infinity;
        const iterScores = [];

        for (const { r, c } of orderedCands) {
            if (getCell(r, c) !== '') continue;
            if (Date.now() - startTime > maxTime) break;

            setCell(r, c, player);
            const score = pvs(d - 1, -Infinity, Infinity, false, player, startTime, maxTime, 0);
            setCell(r, c, '');

            iterScores.push({ r, c, score });
            if (score > iterBestScore) {
                iterBestScore = score;
                iterBestMove = { r, c };
            }
        }

        if (iterBestMove) {
            bestMove = iterBestMove;
            bestScore = iterBestScore;
            // Sắp xếp lại theo điểm của lượt này để lượt sau alpha-beta cắt tốt hơn
            iterScores.sort((a, b) => b.score - a.score);
            orderedCands = iterScores.map(({ r, c }) => ({ r, c }));
        }

        // Nếu đã tìm thấy nước thắng chắc chắn → dừng sớm
        if (bestScore >= 1000000) break;
    }

    window.isMinimaxRunning = false;
    const ttTotal = ttHits + ttMisses;
    const ttHitRate = ttTotal > 0 ? ((ttHits / ttTotal) * 100).toFixed(1) : 0;
    console.log(`[Minimax d=${depth}] best=(${bestMove?.r},${bestMove?.c}) score=${bestScore} TT=${ttHitRate}% hit time=${Date.now()-startTime}ms`);
    return bestMove;
}

// ════════════════════════════════════════════════════════════════════════════
// findLiveThreats — quét bàn cờ tìm các đầu thoáng của chuỗi p
// có độ dài count == targetCount VÀ chưa bị chặn 2 đầu.
// Trả về danh sách ô trống cần chặn ngay.
// ════════════════════════════════════════════════════════════════════════════
function findLiveThreats(p, targetCount) {
    const opp           = p === 'X' ? 'O' : 'X';
    const blockBothEnds = getBlockBothEnds();
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

// ════════════════════════════════════════════════════════════════════════════
// countLineAndBlocked — giữ lại cho các hàm khác dùng
// ════════════════════════════════════════════════════════════════════════════
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
    const blockBothEnds = getBlockBothEnds();

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
    const blockBothEnds = getBlockBothEnds();
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

// ════════════════════════════════════════════════════════════════════════════
// lookaheadDangerous — mô phỏng: bot đi (r,c) → địch phản công tốt nhất
// → địch có tạo FOUR không? Nếu có → bot move này nguy hiểm.
// ════════════════════════════════════════════════════════════════════════════
function lookaheadDangerous(r, c, bp, hp) {
    const blockBothEnds = getBlockBothEnds();
    
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

// ════════════════════════════════════════════════════════════════════════════
// findSafeMoveWithLookahead — tìm nước đi an toàn: sau khi bot đi,
// địch không thể tạo FOUR ngay lập tức
// ════════════════════════════════════════════════════════════════════════════
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
// ════════════════════════════════════════════════════════════════════════════
// EARLY GAME DEFENSE — Đầu game bot chủ động áp sát, chặn lan rộng
//
// Khi số nước đi còn ít (moveCount ≤ EARLY_GAME_THRESHOLD) và
// không có mối đe dọa cấp cao nào, bot ưu tiên ô gần quân người
// chơi nhất để ngăn họ spread thoải mái tạo nước đôi/ba.
// ════════════════════════════════════════════════════════════════════════════
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

// ════════════════════════════════════════════════════════════════════════════
// Tính điểm mối đe dọa SỐNG (loại bỏ chuỗi đã bị chặn 2 đầu)
// Trả về { attackScore, defendScore, bestAttackMove, bestDefendMove }
// ════════════════════════════════════════════════════════════════════════════
function assessThreats(cands, bp, hp) {
    const blockBothEnds = getBlockBothEnds();
    const isEarlyGame = moveHistory.length <= 4; // 2 quân mỗi bên

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

        // Thêm random noise chỉ ở đầu game (1-2 quân đầu) để tránh trùng thế cờ
        // Sau đó chơi chính xác để chặn đúng vị trí
        if (isEarlyGame) {
            aVal += Math.random() * 100; // nhỏ hơn để không ảnh hưởng chặn
        }

        attackScore = Math.max(attackScore, aVal);
        if (aVal > bestAttackVal) {
            bestAttackVal = aVal;
            bestAttackMoves = [{ r, c, score: aVal }];
        } else if (aVal >= bestAttackVal - 100 && aVal > 0 && isEarlyGame) {
            // Chấp nhận các nước đi có điểm tương đương chỉ ở đầu game
            bestAttackMoves.push({ r, c, score: aVal });
        }

        // --- Đánh giá nếu ĐỊCH đi vào đây ---
        let dVal = 0;
        let threeOpenCount = 0, fourOpenCount = 0;
        setCell(r, c, hp);
        for (const { dr, dc } of DIRECTIONS) {
            const lv = evalLine(r, c, dr, dc, hp);
            if (lv === TL.NONE) continue;
            if (blockBothEnds) {
                const { blockedBoth } = countLineAndBlocked(r, c, dr, dc, hp);
                if (blockedBoth) continue;
            }
            // Ưu tiên chặn nước đi mở (chưa bị chặn 2 đầu)
            const score = scoreFromTL(lv, false);
            // Bonus cho nước đi mở (THREE_OPEN, FOUR_OPEN) - tăng để chặn double threat
            if (lv === TL.THREE_OPEN) {
                dVal += score * 3; // 3x cho THREE_OPEN
                threeOpenCount++;
            } else if (lv === TL.FOUR_OPEN) {
                dVal += score * 4; // 4x cho FOUR_OPEN
                fourOpenCount++;
            } else {
                dVal += score;
            }
        }
        setCell(r, c, '');

        // Debug log để xem double threat
        if ((threeOpenCount >= 2 || fourOpenCount >= 1) && Math.random() < 0.1) {
            console.log(`[Double Threat] r=${r}, c=${c}, THREE_OPEN=${threeOpenCount}, FOUR_OPEN=${fourOpenCount}, dVal=${dVal}`);
        }

        // Thêm random noise chỉ ở đầu game (1-2 quân đầu) để tránh trùng thế cờ
        // Sau đó chơi chính xác để chặn đúng vị trí
        if (isEarlyGame) {
            dVal += Math.random() * 100; // nhỏ hơn để không ảnh hưởng chặn
        }

        defendScore = Math.max(defendScore, dVal);
        if (dVal > bestDefendVal) {
            bestDefendVal = dVal;
            bestDefendMoves = [{ r, c, score: dVal }];
        } else if (dVal >= bestDefendVal - 100 && dVal > 0 && isEarlyGame) {
            // Chấp nhận các nước đi có điểm tương đương chỉ ở đầu game
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

function makeAIMove() {
    if (!isGameActive) return;
    isBotMove = true;
    window.cellScores = {};
    const move = getBotMove();

    // Luôn điền cellScores cho tất cả candidates để hiển thị điểm ô
    // Dùng quickScore vì nó nhanh và phản ánh đúng giá trị từng ô
    const showScores = document.getElementById('show-cell-scores');
    if (showScores && showScores.checked) {
        const cands2 = getSearchCandidates().filter(({r,c}) => getCell(r,c) === '');
        for (const {r, c} of cands2) {
            const key = `${r},${c}`;
            window.cellScores[key] = quickScore(r, c, botPiece);
        }
    }

    if (move) makeMove(move.r, move.c);
    if (typeof renderCellScoresDOM === 'function') renderCellScoresDOM();
    isBotMove = false;
}

function getBotMove() {
    try {
    const cands = getSearchCandidates();
    if (cands.length === 0) return { r: 0, c: 0 };
    const validCands = cands.filter(({ r, c }) => getCell(r, c) === '');
    if (validCands.length === 0) return { r: 0, c: 0 };

    const bp = botPiece, hp = humanPiece;
    const blockBothEnds = getBlockBothEnds();

    // ════════════════════════════════════════════════════════════════════════════
    // DIFFICULTY-BASED PIPELINE - Điều chỉnh theo level bot
    // ════════════════════════════════════════════════════════════════════════════
    const isEasy   = gameMode === 'ai-easy';
    const isMedium = gameMode === 'ai-medium';
    const isHard   = gameMode === 'ai-hard';
    const isGod    = gameMode === 'ai-god';

    updateBotThinking('Đang phân tích bàn cờ...');

    // ══ 1. BOT THẮNG NGAY ══
    for (const { r, c } of validCands) {
        setCell(r, c, bp);
        const win = checkWinSilent(r, c);
        setCell(r, c, '');
        if (win) { updateBotThinking('TÌM THẤY NƯỚC THẮNG! 🎯'); return { r, c }; }
    }

    // ══ 2. ĐỊCH THẮNG NGAY (FIVE) ══
    const enemyFiveThreats = findLiveThreats(hp, winCount);
    for (const { r, c } of enemyFiveThreats) {
        if (getCell(r, c) === '') { updateBotThinking('Chặn kịp! 😤'); return { r, c }; }
    }
    for (const { r, c } of validCands) {
        setCell(r, c, hp); const win = checkWinSilent(r, c); setCell(r, c, '');
        if (win) { updateBotThinking('Chặn kịp! 😤'); return { r, c }; }
    }

    // ══ M. MINIMAX — Hard/God dùng Minimax làm quyết định chính ══
    if (isHard || isGod) {
        const moveCount = moveHistory.length;

        // Nước đầu (bàn gần trống) — random thay vì Minimax để tránh bị predict
        // moveCount=0: bot đi trước (đã xử lý bằng random ở getSearchCandidates)
        // moveCount=1: người chơi đánh trước, bot đánh nước đầu tiên
        // moveCount=2: bot đã đi 1 nước, người chơi vừa phản → còn quá sớm để Minimax
        if (moveCount <= 2) {
            // Lấy tất cả candidates lân cận quân người chơi rồi random 1 ô
            const earlyCands = getSearchCandidates().filter(({ r, c }) => getCell(r, c) === '');
            if (earlyCands.length > 0) {
                // Chọn random trong top half để vẫn hợp lý về mặt vị trí
                const pool = earlyCands.slice(0, Math.max(1, Math.ceil(earlyCands.length / 2)));
                const pick = pool[Math.floor(Math.random() * pool.length)];
                updateBotThinking('Nước đầu game ⚡');
                return pick;
            }
        }

        // ── Kiểm tra THẮNG NGAY đầy đủ trước Minimax ──
        const botFourThreats = findLiveThreats(bp, winCount - 1);
        for (const { r, c } of botFourThreats) {
            if (getCell(r, c) !== '') continue;
            setCell(r, c, bp);
            const win = checkWinSilent(r, c);
            setCell(r, c, '');
            if (win) { updateBotThinking('TÌM THẤY NƯỚC THẮNG! 🎯'); return { r, c }; }
        }
        // Quét thêm từ candidates để bắt broken four
        const allCands = getSearchCandidates();
        for (const { r, c } of allCands) {
            if (getCell(r, c) !== '') continue;
            setCell(r, c, bp);
            const win = checkWinSilent(r, c);
            setCell(r, c, '');
            if (win) { updateBotThinking('TÌM THẤY NƯỚC THẮNG! 🎯'); return { r, c }; }
        }

        // ── Chặn FOUR địch (cả FOUR_OPEN lẫn FOUR_BLOCKED) TRƯỚC Minimax ──
        const enemyFourBlocks = findLiveThreats(hp, winCount - 1);
        if (enemyFourBlocks.length > 0) {
            let bestBlock = null, bestBlockScore = -Infinity;
            for (const { r, c } of enemyFourBlocks) {
                if (getCell(r, c) !== '') continue;
                setCell(r, c, hp);
                let s = 0;
                for (const { dr, dc } of DIRECTIONS)
                    s += scoreFromTL(evalLine(r, c, dr, dc, hp), false);
                setCell(r, c, '');
                if (s > bestBlockScore) { bestBlockScore = s; bestBlock = { r, c }; }
            }
            if (bestBlock) {
                updateBotThinking('Chặn FOUR địch! 🛡️');
                return bestBlock;
            }
        }

        // ── Lookahead 1 lượt: địch sẽ tạo FOUR hoặc Double Three lượt sau? ──
        // O(n) rất nhanh, chặn trước Minimax để không bị override bởi tấn công
        {
            let preFour = null, preFourS = -Infinity;
            let preDT = null, preDTS = -Infinity;
            for (const { r, c } of validCands) {
                setCell(r, c, hp);
                let liveFour = 0, liveThreeOpen = 0;
                for (const { dr, dc } of DIRECTIONS) {
                    const { count, blockedBoth } = countLineAndBlocked(r, c, dr, dc, hp);
                    if (blockBothEnds && blockedBoth) continue;
                    if (count === winCount - 1) liveFour++;
                    if (count === winCount - 2) {
                        // chỉ đếm THREE_OPEN (2 đầu thoáng)
                        const hR = r + dr * (count - 0), hC = c + dc * (count - 0);
                        const tR = r - dr, tC = c - dc;
                        // đầu trước và sau chuỗi
                        let fwd = 0; while (getCell(r + dr*(fwd+1), c + dc*(fwd+1)) === hp) fwd++;
                        let bwd = 0; while (getCell(r - dr*(bwd+1), c - dc*(bwd+1)) === hp) bwd++;
                        const hOpen = getCell(r + dr*(fwd+1), c + dc*(fwd+1)) === '';
                        const tOpen = getCell(r - dr*(bwd+1), c - dc*(bwd+1)) === '';
                        if (hOpen && tOpen) liveThreeOpen++;
                    }
                }
                setCell(r, c, '');
                if (liveFour >= 1) {
                    // địch sẽ tạo FOUR lượt sau nếu đi vào đây
                    let s = 0;
                    setCell(r, c, hp);
                    for (const { dr, dc } of DIRECTIONS) s += scoreFromTL(evalLine(r, c, dr, dc, hp), false);
                    setCell(r, c, '');
                    if (s > preFourS) { preFourS = s; preFour = { r, c }; }
                } else if (liveThreeOpen >= 2) {
                    let s = 0;
                    setCell(r, c, hp);
                    for (const { dr, dc } of DIRECTIONS) s += scoreFromTL(evalLine(r, c, dr, dc, hp), false);
                    setCell(r, c, '');
                    if (s > preDTS) { preDTS = s; preDT = { r, c }; }
                }
            }
            if (preFour) { updateBotThinking('Chặn trước khi địch tạo 4! 🔮'); return preFour; }
            if (preDT)   { updateBotThinking('Chặn Double Three trước! 🔮');    return preDT; }
        }
        // ── Bước M1: Minimax nhanh depth 2 — phát hiện nguy hiểm cực kỳ rõ ràng ──
        // Nếu depth 2 trả về nước có score rất cao (tức thắng/chặn thắng/chặn Four)
        // thì dùng ngay, không cần search sâu
        updateBotThinking('Kiểm tra nhanh... ⚡');
        const quickMove = getBestMoveWithMinimax(2, bp);
        if (quickMove) {
            // Đánh giá xem nước này có "cực kỳ rõ ràng" không
            setCell(quickMove.r, quickMove.c, bp);
            const quickWin = checkWinSilent(quickMove.r, quickMove.c);
            setCell(quickMove.r, quickMove.c, '');
            if (quickWin) {
                updateBotThinking('Nước thắng rõ ràng! 🎯');
                return quickMove;
            }

            // Kiểm tra địch có FOUR không → depth 2 đủ để thấy và chặn
            const shallowScore = evaluateBoard(bp);
            // Score rất âm = đang bị đe dọa nghiêm trọng → tin tưởng depth 2
            // Score rất dương = bot đang thắng rõ → tin tưởng depth 2
            if (Math.abs(shallowScore) >= SCORE_DEF.FOUR_OPEN * 0.8) {
                updateBotThinking('Tình huống rõ ràng! ⚡');
                return quickMove;
            }
        }

        // ── Bước M2: Minimax sâu — tình huống phức tạp cần tính xa ──
        // Mấy nước đầu (< 8 quân trên bàn) không cần search sâu, depth 2 là đủ
        if (moveCount < 8) {
            if (quickMove) { updateBotThinking('Nước đầu game ⚡'); return quickMove; }
        }

        updateBotThinking('Đang tính toán sâu (Minimax)... 🧠');
        let mmDepth;
        if (isGod) {
            mmDepth = moveCount < 20 ? 5 : 6;
        } else {
            mmDepth = moveCount < 20 ? 4 : 5;
        }
        const mmMove = getBestMoveWithMinimax(mmDepth, bp);
        if (mmMove) {
            updateBotThinking(`Minimax d=${mmDepth}! 🚀`);
            return mmMove;
        }
    }
    // ══ 3. BOT CÓ FOUR ══
    let botWinningMove = null;
    for (const { r, c } of validCands) {
        setCell(r, c, bp);
        let has = false;
        for (const { dr, dc } of DIRECTIONS) {
            const { count, blockedBoth } = countLineAndBlocked(r, c, dr, dc, bp);
            if (count === winCount - 1 && !blockedBoth) { has = true; break; }
        }
        setCell(r, c, '');
        if (has) { botWinningMove = { r, c }; break; }
    }

    // ══ 4. ĐỊCH CÓ FOUR — tìm đầu thoáng đúng ══
    let enemyFour = null;
    if (!isEasy) {
        const threats = findLiveThreats(hp, winCount - 1);
        if (threats.length > 0) {
            let best = null, bestS = -Infinity;
            for (const { r, c } of threats) {
                if (getCell(r, c) !== '') continue;
                setCell(r, c, hp);
                let s = 0;
                for (const { dr, dc } of DIRECTIONS) s += scoreFromTL(evalLine(r, c, dr, dc, hp), false);
                setCell(r, c, '');
                if (s > bestS) { bestS = s; best = { r, c }; }
            }
            enemyFour = best;
        }
        if (!enemyFour) {
            for (const { r, c } of validCands) {
                setCell(r, c, hp);
                let has = false;
                for (const { dr, dc } of DIRECTIONS) {
                    const { count, blockedBoth } = countLineAndBlocked(r, c, dr, dc, hp);
                    if (count === winCount - 1 && !blockedBoth) { has = true; break; }
                }
                setCell(r, c, '');
                if (has) { enemyFour = { r, c }; break; }
            }
        }
    }

    // Quyết định FOUR
    if (botWinningMove && enemyFour) { updateBotThinking('Cả 2 có 4! Tấn công! ⚔️'); return botWinningMove; }
    if (botWinningMove)              { updateBotThinking('Tạo FOUR! ⚔️');              return botWinningMove; }
    if (enemyFour)                   { updateBotThinking('Chặn 4 địch! 🛡️');          return enemyFour; }

    // ══ 4b. PHÂN TÍCH ĐẦY ĐỦ TẤT CẢ MỐI ĐE DỌA NGUY HIỂM (kể cả broken patterns) ══
    if (!isEasy) {
        const allThreats = findAllEnemyThreats(hp, validCands);

        if (allThreats.length > 0) {
            const topThreat = allThreats[0];

            // Kiểm tra bot có FOUR không — nếu có thì tấn công trước (đã xử lý ở bước 3)
            // Ở đây chỉ cần chặn nếu mối đe dọa đủ nguy hiểm

            // Broken Four (tương đương FOUR_BLOCKED) — chặn ngay
            if (topThreat.score >= 85000) {
                updateBotThinking(`Chặn ${topThreat.label}! 🛡️`);
                return { r: topThreat.r, c: topThreat.c };
            }

            // THREE_OPEN hoặc BROKEN_THREE_OPEN — chặn ngay (không cho phép địch tạo FOUR)
            if (topThreat.score >= 40000) {
                // Nhưng nếu bot cũng đang có THREE_OPEN tấn công thì cân nhắc
                let botHasThreeOpen = false;
                for (const { r, c } of validCands) {
                    setCell(r, c, bp);
                    for (const { dr, dc } of DIRECTIONS) {
                        const lv = evalLine(r, c, dr, dc, bp);
                        if (lv === TL.THREE_OPEN) { botHasThreeOpen = true; break; }
                    }
                    setCell(r, c, '');
                    if (botHasThreeOpen) break;
                }
                // Với God mode: tấn công nếu bot cũng có THREE_OPEN mạnh
                // Với các mode khác: luôn chặn THREE_OPEN địch
                if (!isGod || !botHasThreeOpen) {
                    updateBotThinking(`Chặn ${topThreat.label}! 🛡️`);
                    return { r: topThreat.r, c: topThreat.c };
                }
            }

            // Nhiều mối đe dọa tầm trung cùng lúc (tổng nguy hiểm cao)
            const dangerSum = allThreats.slice(0, 3).reduce((s, t) => s + t.score, 0);
            if (dangerSum >= 60000) {
                updateBotThinking('Chặn đa mối đe dọa! 🛡️🔥');
                return { r: topThreat.r, c: topThreat.c };
            }
        }
    }

    // ══ 5. DOUBLE THREE / FORK ══
    let botDT = null, enemyDT = null, botDTScore = -Infinity, enemyDTScore = -Infinity;
    for (const { r, c } of validCands) {
        setCell(r, c, bp);
        let bThree = 0;
        for (const { dr, dc } of DIRECTIONS) {
            const { count, blockedBoth } = countLineAndBlocked(r, c, dr, dc, bp);
            if (count === winCount - 2 && !(blockBothEnds && blockedBoth)) bThree++;
        }
        setCell(r, c, '');
        if (bThree >= 2) { const s = quickScore(r, c, bp); if (s > botDTScore) { botDTScore = s; botDT = { r, c }; } }

        setCell(r, c, hp);
        let eThree = 0;
        for (const { dr, dc } of DIRECTIONS) {
            const { count, blockedBoth } = countLineAndBlocked(r, c, dr, dc, hp);
            if (count === winCount - 2 && !(blockBothEnds && blockedBoth)) eThree++;
        }
        setCell(r, c, '');
        if (eThree >= 2) {
            setCell(r, c, hp);
            let s = 0;
            for (const { dr, dc } of DIRECTIONS) s += scoreFromTL(evalLine(r, c, dr, dc, hp), false);
            setCell(r, c, '');
            if (s > enemyDTScore) { enemyDTScore = s; enemyDT = { r, c }; }
        }
    }
    if (enemyDT) { updateBotThinking('Chặn double three địch! 🔥'); return enemyDT; }

    // ══ 6. LOOKAHEAD — địch sẽ tạo FOUR lượt sau? ══
    if (!isEasy) {
        let preFour = null, preFourS = -Infinity, preDT = null, preDTS = -Infinity;
        for (const { r, c } of validCands) {
            setCell(r, c, hp);
            let liveFour = 0, liveThree = 0;
            for (const { dr, dc } of DIRECTIONS) {
                const { count, blockedBoth } = countLineAndBlocked(r, c, dr, dc, hp);
                if (blockBothEnds && blockedBoth) continue;
                if (count === winCount - 1) liveFour++;
                if (count === winCount - 2) liveThree++;
            }
            setCell(r, c, '');
            if (liveFour >= 1) {
                setCell(r, c, hp);
                let s = 0;
                for (const { dr, dc } of DIRECTIONS) s += scoreFromTL(evalLine(r, c, dr, dc, hp), false);
                setCell(r, c, '');
                if (s > preFourS) { preFourS = s; preFour = { r, c }; }
            } else if (liveThree >= 2) {
                setCell(r, c, hp);
                let s = 0;
                for (const { dr, dc } of DIRECTIONS) s += scoreFromTL(evalLine(r, c, dr, dc, hp), false);
                setCell(r, c, '');
                if (s > preDTS) { preDTS = s; preDT = { r, c }; }
            }
        }
        if (preFour) { updateBotThinking('Chặn trước khi địch tạo 4! 🔮'); return preFour; }
        if (preDT)   { updateBotThinking('Chặn fork trước! 🔮'); return preDT; }
    }

    // ══ 7. assessThreats — tính điểm combo ══
    const { attackScore, defendScore, bestAttackMove, bestDefendMove, bestComboMove } =
        assessThreats(validCands, bp, hp);
    const shouldAttack = isGod ? attackScore >= defendScore * 0.8 : attackScore >= defendScore;

    // ══ 8. PATTERN BLOCK — kinh nghiệm đã học (ưu tiên TRƯỚC bot double three) ══
    // Lý do: nếu địch đang lặp chiêu nguy hiểm thì phải chặn dù bot đang có double three
    if (!isEasy && typeof botMemory !== 'undefined' && Object.keys(botMemory).length > 0) {
        const enemyMoves = moveHistory.filter(m => m.player === hp);
        if (enemyMoves.length >= 2) {
            let matched = null, matchDepth = 0;
            for (let d = Math.min(MEMORY_DEPTH, enemyMoves.length); d >= 2; d--) {
                const recent = enemyMoves.slice(-d);
                const key = normalizeMoveSequence(recent);
                if (!key) continue;
                const entry = botMemory[key];
                if (entry && entry.hits >= 1) { matched = { entry, recent }; matchDepth = d; break; }
            }
            if (matched) {
                let bestBlock = null, bestBlockS = -Infinity;
                for (const { r, c } of validCands) {
                    let minDist = Infinity;
                    for (const m of matched.recent) {
                        const d = Math.max(Math.abs(r - m.r), Math.abs(c - m.c));
                        if (d < minDist) minDist = d;
                    }
                    if (minDist > 3) continue;
                    let s = 0;
                    setCell(r, c, hp);
                    for (const { dr, dc } of DIRECTIONS) {
                        const lv = evalLine(r, c, dr, dc, hp);
                        if (lv !== TL.NONE) {
                            const { blockedBoth } = countLineAndBlocked(r, c, dr, dc, hp);
                            if (!blockBothEnds || !blockedBoth) s += scoreFromTL(lv, false) * 2;
                        }
                    }
                    setCell(r, c, '');
                    s += (4 - minDist) * 500 + (matched.entry.hits || 1) * 200;
                    if (s > bestBlockS) { bestBlockS = s; bestBlock = { r, c }; }
                }
                if (bestBlock) { updateBotThinking(`Nhớ chiêu này rồi! 🧠 (${matched.entry.hits||1} lần)`); return bestBlock; }
            }
        }
    }

    // ══ 9. BOT DOUBLE THREE (sau pattern block) ══
    if (botDT && shouldAttack) { updateBotThinking('Tạo double three! ⚡'); return botDT; }

    // ══ 10. ADVANCED PATTERNS (God/Hard) ══
    if (isGod || isHard) {
        const enemyForks = detectForkPatterns(hp, validCands);
        if (enemyForks.length > 0) { updateBotThinking('Chặn fork địch! 🛡️'); return enemyForks[0]; }
        if (isGod) {
            const botBTs = detectBreakthroughPatterns(bp, validCands, hp);
            if (botBTs.length > 0 && shouldAttack) { updateBotThinking('Breakthrough! 🚀'); return botBTs[0]; }
            const enemyTraps = detectTrapPatterns(hp, validCands, bp);
            if (enemyTraps.length > 0 && enemyTraps[0].forcedResponse) { updateBotThinking('Phát hiện bẫy! 🛡️'); return enemyTraps[0].forcedResponse; }
            const enemyDTs2 = detectDoubleThreatPatterns(hp, validCands);
            if (enemyDTs2.length > 0) { updateBotThinking('Chặn double threat! 🔥'); return enemyDTs2[0]; }
            const botDTs2 = detectDoubleThreatPatterns(bp, validCands);
            if (botDTs2.length > 0 && shouldAttack) { updateBotThinking('Tạo double threat! ⚡'); return botDTs2[0]; }
        }
        const botForks = detectForkPatterns(bp, validCands);
        if (botForks.length > 0 && shouldAttack) { updateBotThinking('Tạo fork! ⚡'); return botForks[0]; }
    }

    // ══ 11. WIN PATTERN — thế thắng đã học ══
    if (typeof botMemory !== 'undefined' && Object.keys(botMemory).length > 0) {
        const botMoves = moveHistory.filter(m => m.player === bp);
        if (botMoves.length >= 2) {
            let bestWin = [], bestWinS = -1;
            for (const { r, c } of validCands) {
                const hyp = [...botMoves, { r, c, player: bp }];
                for (let d = 3; d <= Math.min(8, hyp.length); d++) {
                    const key = 'WIN_' + normalizeMoveSequence(hyp.slice(-d));
                    const entry = botMemory[key];
                    if (entry && entry.hits >= 1) {
                        const s = entry.hits * (d / 8);
                        if (s > bestWinS) { bestWinS = s; bestWin = [{ r, c }]; }
                        else if (s >= bestWinS - 0.1) bestWin.push({ r, c });
                    }
                }
            }
            if (bestWin.length > 0) { updateBotThinking('Áp dụng thế thắng đã học! 🏆'); return bestWin[Math.floor(Math.random() * bestWin.length)]; }
        }
    }

    // ══ 12. EARLY GAME DEFENSE ══
    if (!isEasy) {
        const humanMoveCount = moveHistory.filter(m => m.player === hp).length;
        if (humanMoveCount <= EARLY_GAME_THRESHOLD) {
            const earlyMove = earlyGameDefense(validCands, bp, hp);
            if (earlyMove) { updateBotThinking('Áp sát, ngăn lan rộng! 🛡️'); return earlyMove; }
        }
    }

    // ══ 13. LOOKAHEAD AN TOÀN (God) ══
    if (isGod) {
        const safeMove = findSafeMoveWithLookahead(validCands, bp, hp);
        if (safeMove) { updateBotThinking('Tránh nước nguy hiểm! 🔮'); return safeMove; }
    }

    // ══ 14. COMBO MOVE ══
    if ((isGod || isHard) && bestComboMove) {
        const aOnly = bestAttackMove?.score || 0, dOnly = bestDefendMove?.score || 0;
        const cs = bestComboMove.score;
        if (shouldAttack && aOnly > cs * 1.15)  { updateBotThinking('Tấn công quyết định! ⚔️'); return bestAttackMove; }
        if (!shouldAttack && dOnly > cs * 1.15) { updateBotThinking('Phòng thủ chiến lược! 🛡️'); return bestDefendMove; }
        updateBotThinking(bestComboMove.aVal > bestComboMove.dVal ? 'Nước toàn diện! ⚔️🛡️' : 'Chặn và tạo thế! 🛡️⚔️');
        return bestComboMove;
    }

    // ══ 15. MCTS (Easy/Medium fallback — Hard/God đã dùng Minimax ở bước M) ══
    if (!isHard && !isGod) {
        if (moveHistory.length > Math.floor(winCount / 2)) {
            const mctsIter = isMedium ? 1500 : 800;
            const mctsMove = mctsSearch(mctsIter, 1000);
            if (mctsMove) { updateBotThinking('MCTS! 🚀'); return mctsMove; }
        }
    }

    // ══ 16. FALLBACK ══
    if (shouldAttack && bestAttackMove) { updateBotThinking('Tấn công! ⚔️'); return bestAttackMove; }
    if (bestDefendMove)                  { updateBotThinking('Phòng thủ! 🛡️'); return bestDefendMove; }
    const scored = validCands.map(({ r, c }) => ({ r, c, score: quickScore(r, c, bp) }));
    scored.sort((a, b) => b.score - a.score);
    return scored[0] || validCands[0];

    } catch (e) {
        console.error('getBotMove error:', e);
        return validCands?.[0] || { r: 0, c: 0 };
    }
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

    const excellentMoves = [
        'Ui da! Đã đọc được nước cờ này rồi nhé! 🧠',
        'Wow! Nước đi này quá đỉnh! 📝',
        'Chất lượng! Nước đi này khiến tôi phải suy nghĩ lại! 🤔',
        'Xuất sắc! Bạn đã tìm được điểm yếu của tôi! 💡',
        'Đáng sợ! Nước đi này rất nguy hiểm! 😱'
    ];

    const dangerousMoves = [
        'Uầy! Nước đi nguy hiểm quá! 😱',
        'Cẩn thận! Đòn này rất mạnh! ⚠️',
        'Ác thật! Bạn đang tạo áp lực lớn! 😰',
        'Gớm! Nước này khiến tôi lo lắng! 😨',
        'Nghệ thuật! Nước đi rất cá tính! 🎨'
    ];

    const blockMessages = [
        'Chặn khéo léo đấy! 👏',
        'Khá lắm! Đã chặn được nước của tôi! 🛡️',
        'Thông minh! Bạn biết cách phòng thủ! 🧠',
        'Hay! Chặn đúng chỗ! 🎯',
        'Khôn khéo! Không dễ gì đánh bại bạn! 😏'
    ];

    const goodMoves = [
        'Wow! Nước đi xuất sắc! 🌟',
        'Tốt! Cố lên! 😊',
        'Khá! Tiếp tục nhé! 👍',
        'Được! Nước đi ổn! ✅',
        'Không tệ! Cố gắng hơn! 💪'
    ];

    const averageMoves = [
        'Bình thường, có thể tốt hơn 🤔',
        'Cơ bản! Cần sáng tạo hơn! 🤷',
        'Được thôi! Nhưng chưa đủ! 😐',
        'Tạm ổn! Cần chiến thuật! 📋',
        'Vừa phải! Cải thiện đi! 🔄'
    ];

    const poorMoves = [
        'Hmm, nước đi này chưa tối ưu lắm 😅',
        'Thôi! Cần suy nghĩ kỹ hơn! 🤔',
        'Tệ! Đừng đi như thế! 😅',
        'Không! Nước này không tốt! 🙅',
        'Lỗi! Cần thay đổi chiến thuật! ❌'
    ];
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