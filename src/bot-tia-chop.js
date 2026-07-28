// ===== BOT TIA CHỚP - Lightning Bot =====
// Ported faithfully from mevivu.com Gomoku (game.js)
// Fixes vs previous port:
//   1. mySq phải là số (-1/1), không phải string 'X'/'O'
//   2. Vòng while có bound check để không chạy vô hạn trên bàn vô hạn
//   3. findBestMove random đúng kiểu gốc (iMax/jMax array)

const BotTiaChop = {
    // ===== CONFIGURATION =====
    config: {
        winningMove : 9999999,
        openFour    : 8888888,
        twoThrees   : 7777777,
        weights     : [0, 20, 17, 15.4, 14, 10]   // w[0..5], dùng w[1..winCount]
    },

    // ================================================================
    // GET BOT MOVE — entry point
    // options: { player, opponent, winCount }
    // player / opponent là 'X' hoặc 'O' (string từ game engine)
    // ================================================================
    getBotMove(options = {}) {
        const playerStr   = options.player   ?? (typeof botPiece   !== 'undefined' ? botPiece   : 'O');
        const opponentStr = options.opponent ?? (typeof humanPiece !== 'undefined' ? humanPiece : 'X');
        const winCount    = options.winCount ?? (typeof window.winCount !== 'undefined' ? window.winCount : 5);

        // Chuyển 'X'/'O' → số nguyên như gốc mevivu
        // Bot = machSq = -1, người = userSq = 1 (gốc dùng userSq cho người)
        // Nhưng ở đây ta tính: botPlayer → machSq, humanPlayer → userSq
        const machSq = playerStr   === 'X' ? 1 : -1;
        const userSq = opponentStr === 'X' ? 1 : -1;

        // Đọc bàn cờ vào mảng 2D cố định để tránh vòng while vô hạn
        const { board, minR, minC, rows, cols } = this.readBoard();

        // Cần ít nhất 1 quân trên bàn
        const hasAnyPiece = this.boardHasPiece(board, rows, cols);
        if (!hasAnyPiece) {
            // Nước đầu tiên: đánh giữa vùng nhìn thấy
            const cr = Math.floor(rows / 2);
            const cc = Math.floor(cols / 2);
            return { r: minR + cr, c: minC + cc };
        }

        // Tạo mảng điểm (kích thước bằng board)
        const s = this.make2D(rows, cols, 0);   // điểm tấn công (bot)
        const q = this.make2D(rows, cols, 0);   // điểm phòng thủ (người)

        const maxS = this.evaluatePos(s, machSq, board, rows, cols, winCount);
        const maxQ = this.evaluatePos(q, userSq, board, rows, cols, winCount);

        const move = this.getBestMachMove(s, maxS, q, maxQ, rows, cols);

        if (move) {
            return { r: minR + move[0], c: minC + move[1] };
        }

        // Fallback: giữa bàn
        return { r: minR + Math.floor(rows / 2), c: minC + Math.floor(cols / 2) };
    },

    // ================================================================
    // READ BOARD — đọc infiniteMap → mảng 2D cố định có padding
    // ================================================================
    readBoard() {
        const MARGIN = 4;   // vùng mở rộng quanh quân đã đánh

        // Lấy tọa độ min/max từ infiniteMap
        let minR = Infinity, maxR = -Infinity;
        let minC = Infinity, maxC = -Infinity;

        const map = (typeof window !== 'undefined' && window.infiniteMap)
            ? window.infiniteMap : new Map();

        map.forEach((_, key) => {
            const [r, c] = key.split(',').map(Number);
            if (r < minR) minR = r; if (r > maxR) maxR = r;
            if (c < minC) minC = c; if (c > maxC) maxC = c;
        });

        if (minR === Infinity) {
            // Bàn trống
            minR = 0; maxR = 19; minC = 0; maxC = 19;
        }

        // Thêm margin
        minR -= MARGIN; maxR += MARGIN;
        minC -= MARGIN; maxC += MARGIN;

        const rows = maxR - minR + 1;
        const cols = maxC - minC + 1;

        // Xây mảng 2D: 0=trống, 1=X, -1=O
        const board = this.make2D(rows, cols, 0);
        map.forEach((val, key) => {
            const [r, c] = key.split(',').map(Number);
            const ri = r - minR;
            const ci = c - minC;
            if (ri >= 0 && ri < rows && ci >= 0 && ci < cols) {
                board[ri][ci] = (val === 'X') ? 1 : -1;
            }
        });

        return { board, minR, minC, rows, cols };
    },

    // ================================================================
    // HELPERS
    // ================================================================
    make2D(rows, cols, fill) {
        const a = [];
        for (let i = 0; i < rows; i++) {
            a[i] = new Array(cols).fill(fill);
        }
        return a;
    },

    boardHasPiece(board, rows, cols) {
        for (let i = 0; i < rows; i++)
            for (let j = 0; j < cols; j++)
                if (board[i][j] !== 0) return true;
        return false;
    },

    hasNeighbors(i, j, board, rows, cols) {
        const dirs = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
        for (const [dr, dc] of dirs) {
            const r = i + dr, c = j + dc;
            if (r >= 0 && r < rows && c >= 0 && c < cols && board[r][c] !== 0) return true;
        }
        return false;
    },

    f(board, rows, cols, i, j) {
        // An toàn: trả về 0 ngoài biên
        if (i < 0 || i >= rows || j < 0 || j >= cols) return 0;
        return board[i][j];
    },

    // ================================================================
    // WINNING POS — giữ nguyên logic gốc, dùng bound check hợp lệ
    // ================================================================
    winningPos(i, j, mySq, board, rows, cols, winCount) {
        const limit = winCount;
        const F = (r, c) => this.f(board, rows, cols, r, c);
        let test3 = 0, test4 = 0;
        let L, m, m1, m2, side1, side2;

        // Horizontal
        L = 1;
        m = 1; while (j + m < cols && F(i, j + m) === mySq) { L++; m++; } m1 = m;
        m = 1; while (j - m >= 0   && F(i, j - m) === mySq) { L++; m++; } m2 = m;
        if (L > limit - 1) return this.config.winningMove;
        side1 = (j + m1 < cols && F(i, j + m1) === 0);
        side2 = (j - m2 >= 0   && F(i, j - m2) === 0);
        if (L === limit - 1 && (side1 || side2)) test3++;
        if (side1 && side2) {
            if (L === limit - 1) test4 = 1;
            if (L === limit - 2) test3++;
        }

        // Vertical
        L = 1;
        m = 1; while (i + m < rows && F(i + m, j) === mySq) { L++; m++; } m1 = m;
        m = 1; while (i - m >= 0   && F(i - m, j) === mySq) { L++; m++; } m2 = m;
        if (L > limit - 1) return this.config.winningMove;
        side1 = (i + m1 < rows && F(i + m1, j) === 0);
        side2 = (i - m2 >= 0   && F(i - m2, j) === 0);
        if (L === limit - 1 && (side1 || side2)) test3++;
        if (side1 && side2) {
            if (L === limit - 1) test4 = 1;
            if (L === limit - 2) test3++;
        }

        // Diagonal \
        L = 1;
        m = 1; while (i + m < rows && j + m < cols && F(i + m, j + m) === mySq) { L++; m++; } m1 = m;
        m = 1; while (i - m >= 0   && j - m >= 0   && F(i - m, j - m) === mySq) { L++; m++; } m2 = m;
        if (L > limit - 1) return this.config.winningMove;
        side1 = (i + m1 < rows && j + m1 < cols && F(i + m1, j + m1) === 0);
        side2 = (i - m2 >= 0   && j - m2 >= 0   && F(i - m2, j - m2) === 0);
        if (L === limit - 1 && (side1 || side2)) test3++;
        if (side1 && side2) {
            if (L === limit - 1) test4 = 1;
            if (L === limit - 2) test3++;
        }

        // Diagonal /
        L = 1;
        m = 1; while (i + m < rows && j - m >= 0   && F(i + m, j - m) === mySq) { L++; m++; } m1 = m;
        m = 1; while (i - m >= 0   && j + m < cols && F(i - m, j + m) === mySq) { L++; m++; } m2 = m;
        if (L > limit - 1) return this.config.winningMove;
        side1 = (i + m1 < rows && j - m1 >= 0   && F(i + m1, j - m1) === 0);
        side2 = (i - m2 >= 0   && j + m2 < cols && F(i - m2, j + m2) === 0);
        if (L === limit - 1 && (side1 || side2)) test3++;
        if (side1 && side2) {
            if (L === limit - 1) test4 = 1;
            if (L === limit - 2) test3++;
        }

        if (test4) return this.config.openFour;
        if (test3 >= 2) return this.config.twoThrees;
        return -1;
    },

    // ================================================================
    // EVALUATE POS — giữ nguyên logic gốc, có bound check đầy đủ
    // ================================================================
    evaluatePos(a, mySq, board, rows, cols, winCount) {
        const limit = winCount;
        const w = this.config.weights;
        const F = (r, c) => this.f(board, rows, cols, r, c);
        let maxA = -1;
        const nPos = [];
        const dirA = [];

        for (let i = 0; i < rows; i++) {
            for (let j = 0; j < cols; j++) {
                if (board[i][j] !== 0) { a[i][j] = -1; continue; }
                if (!this.hasNeighbors(i, j, board, rows, cols)) { a[i][j] = -1; continue; }

                const wp = this.winningPos(i, j, mySq, board, rows, cols, winCount);
                if (wp > 0) {
                    a[i][j] = wp;
                } else {
                    // Bound limits (giống gốc mevivu)
                    const minM = Math.max(i - (limit - 1), 0);
                    const minN = Math.max(j - (limit - 1), 0);
                    const maxM = Math.min(i + limit, rows);
                    const maxN = Math.min(j + limit, cols);

                    // Horizontal
                    nPos[1] = 1; let A1 = 0;
                    let m = 1;
                    while (j + m < maxN  && F(i, j + m) !== -mySq) { nPos[1]++; A1 += w[m] * F(i, j + m); m++; }
                    if (j + m >= cols || F(i, j + m) === -mySq) A1 -= (F(i, j + m - 1) === mySq) ? (w[limit] * mySq) : 0;
                    m = 1;
                    while (j - m >= minN && F(i, j - m) !== -mySq) { nPos[1]++; A1 += w[m] * F(i, j - m); m++; }
                    if (j - m < 0     || F(i, j - m) === -mySq) A1 -= (F(i, j - m + 1) === mySq) ? (w[limit] * mySq) : 0;

                    // Vertical
                    nPos[2] = 1; let A2 = 0;
                    m = 1;
                    while (i + m < maxM  && F(i + m, j) !== -mySq) { nPos[2]++; A2 += w[m] * F(i + m, j); m++; }
                    if (i + m >= rows || F(i + m, j) === -mySq) A2 -= (F(i + m - 1, j) === mySq) ? (w[limit] * mySq) : 0;
                    m = 1;
                    while (i - m >= minM && F(i - m, j) !== -mySq) { nPos[2]++; A2 += w[m] * F(i - m, j); m++; }
                    if (i - m < 0     || F(i - m, j) === -mySq) A2 -= (F(i - m + 1, j) === mySq) ? (w[limit] * mySq) : 0;

                    // Diagonal \ 
                    nPos[3] = 1; let A3 = 0;
                    m = 1;
                    while (i + m < maxM && j + m < maxN && F(i + m, j + m) !== -mySq) { nPos[3]++; A3 += w[m] * F(i + m, j + m); m++; }
                    if (i + m >= rows || j + m >= cols || F(i + m, j + m) === -mySq) A3 -= (F(i + m - 1, j + m - 1) === mySq) ? (w[limit] * mySq) : 0;
                    m = 1;
                    while (i - m >= minM && j - m >= minN && F(i - m, j - m) !== -mySq) { nPos[3]++; A3 += w[m] * F(i - m, j - m); m++; }
                    if (i - m < 0    || j - m < 0    || F(i - m, j - m) === -mySq) A3 -= (F(i - m + 1, j - m + 1) === mySq) ? (w[limit] * mySq) : 0;

                    // Diagonal /
                    nPos[4] = 1; let A4 = 0;
                    m = 1;
                    while (i + m < maxM && j - m >= minN && F(i + m, j - m) !== -mySq) { nPos[4]++; A4 += w[m] * F(i + m, j - m); m++; }
                    if (i + m >= rows || j - m < 0    || F(i + m, j - m) === -mySq) A4 -= (F(i + m - 1, j - m + 1) === mySq) ? (w[limit] * mySq) : 0;
                    m = 1;
                    while (i - m >= minM && j + m < maxN && F(i - m, j + m) !== -mySq) { nPos[4]++; A4 += w[m] * F(i - m, j + m); m++; }
                    if (i - m < 0    || j + m >= cols || F(i - m, j + m) === -mySq) A4 -= (F(i - m + 1, j + m - 1) === mySq) ? (w[limit] * mySq) : 0;

                    dirA[1] = (nPos[1] > limit - 1) ? A1 * A1 : 0;
                    dirA[2] = (nPos[2] > limit - 1) ? A2 * A2 : 0;
                    dirA[3] = (nPos[3] > limit - 1) ? A3 * A3 : 0;
                    dirA[4] = (nPos[4] > limit - 1) ? A4 * A4 : 0;

                    // Lấy 2 hướng cao nhất (giống gốc: A1+A2 sau vòng k)
                    let top1 = 0, top2 = 0;
                    for (let k = 1; k < limit; k++) {
                        if (dirA[k] >= top1) { top2 = top1; top1 = dirA[k]; }
                        else if (dirA[k] > top2) { top2 = dirA[k]; }
                    }
                    a[i][j] = top1 + top2;
                }

                if (a[i][j] > maxA) maxA = a[i][j];
            }
        }

        return maxA;
    },

    // ================================================================
    // GET BEST MACH MOVE — giống hệt getBestMachMove() gốc mevivu
    // Dùng iMax/jMax array + random để không đánh cùng 1 chỗ
    // ================================================================
    getBestMachMove(s, maxS, q, maxQ, rows, cols) {
        const iMax = [], jMax = [];
        let nMax = 0;

        if (maxQ >= maxS) {
            // Phòng thủ quan trọng hơn: chọn ô có q === maxQ, tiebreak bằng s
            let bestSec = -1;
            for (let i = 0; i < rows; i++) {
                for (let j = 0; j < cols; j++) {
                    if (q[i][j] === maxQ) {
                        if (s[i][j] > bestSec) { bestSec = s[i][j]; nMax = 0; }
                        if (s[i][j] === bestSec) { iMax[nMax] = i; jMax[nMax] = j; nMax++; }
                    }
                }
            }
        } else {
            // Tấn công quan trọng hơn: chọn ô có s === maxS, tiebreak bằng q
            let bestSec = -1;
            for (let i = 0; i < rows; i++) {
                for (let j = 0; j < cols; j++) {
                    if (s[i][j] === maxS) {
                        if (q[i][j] > bestSec) { bestSec = q[i][j]; nMax = 0; }
                        if (q[i][j] === bestSec) { iMax[nMax] = i; jMax[nMax] = j; nMax++; }
                    }
                }
            }
        }

        if (nMax === 0) return null;

        const randomK = Math.floor(Math.random() * nMax);
        return [iMax[randomK], jMax[randomK]];
    }
};

// Export cho module system nếu cần
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BotTiaChop;
}
