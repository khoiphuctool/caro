// ═══════════════════════════════════════════════════════════════════════════
// BLOCK BOTH ENDS ANALYZER - Phân tích luật chặn 2 đầu
// ═══════════════════════════════════════════════════════════════════════════
// Phân tích các nước đi tạo ra 4 quân mở 2 đầu (FOUR_OPEN) 
// và trả về danh sách các ô cần chặn ngay lập tức

const BlockBothEndsAnalyzer = {
    /**
     * Phân tích tất cả các nước đi nguy hiểm của đối thủ khi luật chan2Dau = true
     * Trả về mảng các ô cần chặn, sắp xếp theo độ ưu tiên
     * 
     * @param {string} opponent - 'X' hoặc 'O'
     * @param {number} winCount - số quân để thắng (5, 6, 7...)
     * @param {boolean} blockBothEnds - có áp dụng luật chặn 2 đầu
     * @returns {Array} mảng [{r, c, priority, threat}] sắp xếp ưu tiên giảm dần
     */
    findBlockPositions(opponent, winCount, blockBothEnds) {
        if (!blockBothEnds) return [];

        const player = opponent === 'X' ? 'O' : 'X';
        const directions = [[0,1], [1,0], [1,1], [1,-1]];  // →, ↓, ↘, ↙
        const threats = [];
        const threatsMap = new Map(); // key = "r,c" để tránh trùng

        // Quét toàn bộ bàn cờ để tìm các nước đi nguy hiểm của đối thủ
        if (typeof infiniteMap !== 'undefined') {
            // Online mode: dùng infiniteMap
            for (const [key, cell] of infiniteMap) {
                if (cell.player === opponent) {
                    const [r, c] = key.split(',').map(Number);
                    this._analyzePosition(r, c, opponent, player, directions, winCount, threats, threatsMap);
                }
            }
        } else {
            // Fallback: quét vùng xung quanh board
            const cells = (typeof GameState !== 'undefined' && GameState.board && GameState.board.infiniteMap) ? GameState.board.infiniteMap : null;
            if (!cells) return [];
            
            for (const [key, cell] of cells) {
                if (cell.player === opponent) {
                    const [r, c] = key.split(',').map(Number);
                    this._analyzePosition(r, c, opponent, player, directions, winCount, threats, threatsMap);
                }
            }
        }

        // Sắp xếp theo độ ưu tiên (threat level cao nhất trước)
        return threats.sort((a, b) => b.priority - a.priority);
    },

    /**
     * Phân tích một vị trí (r,c) của đối thủ — tìm các hướng tạo FOUR_OPEN
     */
    _analyzePosition(r, c, opponent, player, directions, winCount, threats, threatsMap) {
        const opp = opponent;
        
        for (const [dr, dc] of directions) {
            // Quét 2 chiều (thuận & ngược) từ (r,c)
            const forward = this._countInDirection(r, c, dr, dc, opp, winCount);
            const backward = this._countInDirection(r, c, -dr, -dc, opp, winCount);
            
            // Tính tổng quân liên tiếp trong hướng này (qua (r,c))
            const totalCount = forward.count + backward.count + 1;  // +1 là chính (r,c)
            
            // Nếu đã có 4+ quân liên tiếp → kiểm tra FOUR_OPEN
            if (totalCount === winCount - 1) {
                // Là FOUR (4 quân, thiếu 1 ô để thắng)
                const blockPos = this._findFourOpenBlockPosition(
                    r, c, dr, dc, opp, forward, backward, winCount, player
                );
                if (blockPos) {
                    const key = `${blockPos.r},${blockPos.c}`;
                    if (!threatsMap.has(key)) {
                        threats.push(blockPos);
                        threatsMap.set(key, true);
                    } else {
                        // Tăng priority nếu cùng ô bị đe dọa từ nhiều hướng
                        const existingThreat = threats.find(t => t.r === blockPos.r && t.c === blockPos.c);
                        if (existingThreat) {
                            existingThreat.priority += blockPos.priority;
                            existingThreat.threat += 1;
                        }
                    }
                }
            }
        }
    },

    /**
     * Đếm số quân opponent liên tiếp từ (r,c) theo hướng (dr,dc)
     * Trả về {count, blocked} — blocked = true nếu gặp quân player hoặc biên
     */
    _countInDirection(r, c, dr, dc, opponent, winCount) {
        let count = 0;
        let nr = r + dr, nc = c + dc;
        
        for (let i = 0; i < winCount; i++) {
            const cell = typeof getCell === 'function' ? getCell(nr, nc) : this._getCellFallback(nr, nc);
            
            if (cell === opponent) {
                count++;
                nr += dr;
                nc += dc;
            } else {
                break;
            }
        }
        
        return { count, blocked: cell !== '' };
    },

    /**
     * Tìm ô cần chặn khi tạo FOUR_OPEN từ (r,c) theo hướng (dr,dc)
     * FOUR_OPEN = 4 quân mở 2 đầu → chỉ cần chặn 1 đầu
     */
    _findFourOpenBlockPosition(r, c, dr, dc, opp, forward, backward, winCount, player) {
        // Vị trí đầu mở phía trước
        const frontR = r + (forward.count + 1) * dr;
        const frontC = c + (forward.count + 1) * dc;
        
        // Vị trí đầu mở phía sau
        const backR = r - (backward.count + 1) * dr;
        const backC = c - (backward.count + 1) * dc;
        
        // Kiểm tra 2 đầu có thực sự mở (không bị chặn)
        const frontCell = typeof getCell === 'function' ? getCell(frontR, frontC) : this._getCellFallback(frontR, frontC);
        const backCell = typeof getCell === 'function' ? getCell(backR, backC) : this._getCellFallback(backR, backC);
        
        const frontOpen = frontCell === '';  // ô trống = mở
        const backOpen = backCell === '';    // ô trống = mở
        
        // Chỉ là FOUR_OPEN nếu cả 2 đầu đều mở
        if (!frontOpen || !backOpen) {
            return null;  // Là FOUR_BLOCKED, không cần chặn ngay
        }
        
        // Chặn 1 đầu bất kỳ → ưu tiên chặn đầu gần center hơn
        const center = typeof (window.BOARD_CENTER) !== 'undefined' ? window.BOARD_CENTER : {r: 0, c: 0};
        const frontDist = Math.abs(frontR - center.r) + Math.abs(frontC - center.c);
        const backDist = Math.abs(backR - center.r) + Math.abs(backC - center.c);
        
        const blockR = frontDist <= backDist ? frontR : backR;
        const blockC = frontDist <= backDist ? frontC : backC;
        
        return {
            r: blockR,
            c: blockC,
            priority: 9000,  // Rất cao — FOUR_OPEN là đe dọa trực tiếp
            threat: 1,
            reason: 'BLOCK_FOUR_OPEN'
        };
    },

    /**
     * Fallback để lấy cell khi getCell không khả dụng
     */
    _getCellFallback(r, c) {
        if (typeof infiniteMap !== 'undefined') {
            const cell = infiniteMap.get(`${r},${c}`);
            return cell ? cell.player : '';
        }
        if (typeof GameState !== 'undefined' && GameState.board && GameState.board.infiniteMap) {
            const cell = GameState.board.infiniteMap.get(`${r},${c}`);
            return cell ? cell.player : '';
        }
        return '';
    },

    /**
     * Kiểm tra xem nước đi (r,c) của player có tạo FOUR_OPEN không
     * Dùng để AI tự đánh giá nước đi
     */
    isFourOpen(r, c, player, winCount, blockBothEnds) {
        if (!blockBothEnds) return false;

        const opponent = player === 'X' ? 'O' : 'X';
        const directions = [[0,1], [1,0], [1,1], [1,-1]];

        for (const [dr, dc] of directions) {
            const forward = this._countInDirection(r, c, dr, dc, player, winCount);
            const backward = this._countInDirection(r, c, -dr, -dc, player, winCount);
            const totalCount = forward.count + backward.count + 1;

            if (totalCount === winCount - 1) {
                // Là FOUR — kiểm tra 2 đầu
                const frontR = r + (forward.count + 1) * dr;
                const frontC = c + (forward.count + 1) * dc;
                const backR = r - (backward.count + 1) * dr;
                const backC = c - (backward.count + 1) * dc;

                const frontCell = typeof getCell === 'function' ? getCell(frontR, frontC) : this._getCellFallback(frontR, frontC);
                const backCell = typeof getCell === 'function' ? getCell(backR, backC) : this._getCellFallback(backR, backC);

                const frontOpen = frontCell === '';
                const backOpen = backCell === '';

                // FOUR_OPEN = cả 2 đầu mở
                if (frontOpen && backOpen) {
                    return true;
                }
            }
        }

        return false;
    }
};

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BlockBothEndsAnalyzer;
}
