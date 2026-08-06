// ===== PATTERN DETECTOR - Identifies board patterns =====
// This module is responsible for detecting patterns on the board
// It does NOT make scoring decisions - that's the Threat Detector's job

const PatternDetector = {
    // Pattern types (must match ScoreTable.PATTERN)
    PATTERN: {
        NONE: 0,
        FIVE: 1,
        FOUR_OPEN: 2,
        FOUR_BLOCKED: 3,
        THREE_OPEN: 4,
        THREE_BLOCKED: 5,
        TWO_OPEN: 6,
        TWO_BLOCKED: 7,
    },

    // ===== HELPER: Check if direction is blocked by opponent (skip empty cells) =====
    // Đồng bộ với logic-game.js isBlocked
    isBlocked(startR, startC, dr, dc, player) {
        // LUẬT CHẶN 2 ĐẦU ĐÚNG: chỉ chặn khi ô ngay sát là quân đối thủ hoặc biên.
        // Ô trống ngay cạnh = đầu vẫn mở.
        const opp = player === 'X' ? 'O' : 'X';
        const cell = this.getCell(startR, startC);
        if (cell === opp) return true;
        if (cell === 'W') return true;
        if (cell === '') return false;
        if (cell === player) return false;
        return false;
    },

    // ===== EVALUATE A SINGLE LINE =====
    // Returns pattern type for a line starting at (r,c) in direction (dr,dc)
    evalLine(r, c, dr, dc, player, winCount, blockBothEndsEnabled = false) {
        let count = 1;
        let nr = r + dr, nc = c + dc;
        
        // Count forward
        while (this.getCell(nr, nc) === player) {
            count++;
            nr += dr;
            nc += dc;
        }
        
        let headBlocked, tailBlocked;
        
        if (blockBothEndsEnabled) {
            // isBlocked mới check ngay ô tại (nr,nc)
            headBlocked = this.isBlocked(nr, nc, dr, dc, player);
            
            // Count backward
            nr = r - dr;
            nc = c - dc;
            while (this.getCell(nr, nc) === player) {
                count++;
                nr -= dr;
                nc -= dc;
            }
            tailBlocked = this.isBlocked(nr, nc, -dr, -dc, player);
        } else {
            // Logic cũ: chỉ kiểm tra ô ngay cạnh
            headBlocked = (this.getCell(nr, nc) !== "" && this.getCell(nr, nc) !== player);
            
            // Count backward
            nr = r - dr;
            nc = c - dc;
            while (this.getCell(nr, nc) === player) {
                count++;
                nr -= dr;
                nc -= dc;
            }
            tailBlocked = (this.getCell(nr, nc) !== "" && this.getCell(nr, nc) !== player);
        }

        // Determine pattern type
        if (count >= winCount) {
            if (headBlocked && tailBlocked) return this.PATTERN.NONE;
            return this.PATTERN.FIVE;
        }
        
        if (count === winCount - 1) {
            if (headBlocked && tailBlocked) return this.PATTERN.NONE;
            return (headBlocked || tailBlocked) ? this.PATTERN.FOUR_BLOCKED : this.PATTERN.FOUR_OPEN;
        }
        
        if (count === winCount - 2) {
            if (headBlocked && tailBlocked) return this.PATTERN.NONE;
            return (headBlocked || tailBlocked) ? this.PATTERN.THREE_BLOCKED : this.PATTERN.THREE_OPEN;
        }
        
        if (count === winCount - 3) {
            if (headBlocked && tailBlocked) return this.PATTERN.NONE;
            return (headBlocked || tailBlocked) ? this.PATTERN.TWO_BLOCKED : this.PATTERN.TWO_OPEN;
        }
        
        return this.PATTERN.NONE;
    },

    // ===== EVALUATE ALL DIRECTIONS FOR A CELL =====
    // Returns array of patterns in all 4 directions
    evalCell(r, c, player, winCount, blockBothEndsEnabled = false) {
        const directions = [
            { dr: 0, dc: 1 },   // Horizontal
            { dr: 1, dc: 0 },   // Vertical
            { dr: 1, dc: 1 },   // Diagonal \
            { dr: 1, dc: -1 }   // Diagonal /
        ];
        
        const patterns = [];
        for (const { dr, dc } of directions) {
            patterns.push({
                direction: { dr, dc },
                pattern: this.evalLine(r, c, dr, dc, player, winCount, blockBothEndsEnabled)
            });
        }
        
        return patterns;
    },

    // ===== HELPER: Determine what is blocking a chain end =====
    // Looks at the cell directly at (r, c) — the first cell beyond the chain end.
    // chainPlayer: the player whose chain is being evaluated (the attacker / opponent)
    // aiPlayer:    the defending player (AI), or null if unknown
    // Returns:
    //   'ai'       — cell contains aiPlayer's piece (AI already blocked this end)
    //   'opponent' — cell contains chainPlayer's own piece (self-blocked)
    //   'wall'     — cell is out of bounds
    //   null       — cell is empty (end is open, not blocked)
    getBlockedBy(r, c, chainPlayer, aiPlayer) {
        const cell = this.getCell(r, c);
        // Out of bounds is reported as "W" by the fallback getCell, or we can check bounds
        // getCell returns "W" for out-of-bounds in the boardState branch
        if (cell === "W") return 'wall';
        // Also check numeric bounds via a direct OOB test
        if (cell === '' ) return null; // empty → not blocked
        if (cell === chainPlayer) return 'opponent'; // chain player's own piece
        // Any other non-empty, non-chainPlayer cell
        if (aiPlayer !== null && aiPlayer !== undefined && cell === aiPlayer) return 'ai';
        // Cell has a piece but aiPlayer is unknown — treat as 'ai' (some blocker that isn't chainPlayer)
        return 'ai';
    },

    // ===== COUNT LINE AND BLOCKED STATUS =====
    // Returns { count, blockedBoth, headBlocked, tailBlocked, headBlockedBy, tailBlockedBy }
    // headBlockedBy / tailBlockedBy: 'ai' | 'opponent' | 'wall' | null
    //   — only populated when blockBothEndsEnabled = true AND that end is blocked
    //   — null when blockBothEndsEnabled = false OR end is not blocked
    // aiPlayer (optional): the defending player; used to distinguish 'ai' vs other blocker
    countLineAndBlocked(r, c, dr, dc, player, blockBothEndsEnabled = false, aiPlayer = null) {
        let count = 1;
        let nr = r + dr, nc = c + dc;
        
        while (this.getCell(nr, nc) === player) {
            count++;
            nr += dr;
            nc += dc;
        }
        // nr, nc is now the first cell beyond the forward end of the chain
        const headEndR = nr, headEndC = nc;
        
        let headBlocked, tailBlocked;
        
        if (blockBothEndsEnabled) {
            // isBlocked mới check ngay ô tại headEndR/headEndC
            headBlocked = this.isBlocked(headEndR, headEndC, dr, dc, player);
            
            nr = r - dr;
            nc = c - dc;
            while (this.getCell(nr, nc) === player) {
                count++;
                nr -= dr;
                nc -= dc;
            }
            tailBlocked = this.isBlocked(nr, nc, -dr, -dc, player);
        } else {
            headBlocked = (this.getCell(nr, nc) !== "" && this.getCell(nr, nc) !== player);
            
            nr = r - dr;
            nc = c - dc;
            while (this.getCell(nr, nc) === player) {
                count++;
                nr -= dr;
                nc -= dc;
            }
            tailBlocked = (this.getCell(nr, nc) !== "" && this.getCell(nr, nc) !== player);
        }
        // nr, nc is now the first cell beyond the backward end of the chain
        const tailEndR = nr, tailEndC = nc;

        // Populate headBlockedBy / tailBlockedBy only when blockBothEndsEnabled = true
        // and the respective end is blocked
        let headBlockedBy = null;
        let tailBlockedBy = null;

        if (blockBothEndsEnabled) {
            if (headBlocked) {
                headBlockedBy = this.getBlockedBy(headEndR, headEndC, player, aiPlayer);
            }
            if (tailBlocked) {
                tailBlockedBy = this.getBlockedBy(tailEndR, tailEndC, player, aiPlayer);
            }
        }
        
        return {
            count,
            blockedBoth: headBlocked && tailBlocked,
            headBlocked,
            tailBlocked,
            headBlockedBy,
            tailBlockedBy
        };
    },

    // ===== DETECT FORK PATTERNS =====
    // A fork is when a move creates multiple attack lines
    detectFork(r, c, player, winCount, blockBothEndsEnabled = false) {
        const patterns = this.evalCell(r, c, player, winCount, blockBothEndsEnabled);
        let attackLines = 0;
        let threeOpenLines = 0;
        let fourOpenLines = 0;
        
        for (const { pattern } of patterns) {
            if (pattern === this.PATTERN.FOUR_OPEN || pattern === this.PATTERN.FOUR_BLOCKED) {
                fourOpenLines++;
                attackLines++;
            } else if (pattern === this.PATTERN.THREE_OPEN) {
                threeOpenLines++;
                attackLines++;
            }
        }
        
        return {
            isFork: attackLines >= 2,
            attackLines,
            threeOpenLines,
            fourOpenLines
        };
    },

    // ===== DETECT DOUBLE THREE =====
    detectDoubleThree(r, c, player, winCount, blockBothEndsEnabled = false) {
        const patterns = this.evalCell(r, c, player, winCount, blockBothEndsEnabled);
        let threeOpenCount = 0;
        
        for (const { pattern } of patterns) {
            if (pattern === this.PATTERN.THREE_OPEN) {
                threeOpenCount++;
            }
        }
        
        return threeOpenCount >= 2;
    },

    // ===== DETECT FOUR-THREE COMBINATION =====
    detectFourThree(r, c, player, winCount, blockBothEndsEnabled = false) {
        const patterns = this.evalCell(r, c, player, winCount, blockBothEndsEnabled);
        let hasFour = false;
        let hasThreeOpen = false;
        
        for (const { pattern } of patterns) {
            if (pattern === this.PATTERN.FOUR_OPEN || pattern === this.PATTERN.FOUR_BLOCKED) {
                hasFour = true;
            } else if (pattern === this.PATTERN.THREE_OPEN) {
                hasThreeOpen = true;
            }
        }
        
        return hasFour && hasThreeOpen;
    },

    // ===== DETECT DOUBLE FOUR =====
    detectDoubleFour(r, c, player, winCount, blockBothEndsEnabled = false) {
        const patterns = this.evalCell(r, c, player, winCount, blockBothEndsEnabled);
        let fourCount = 0;
        
        for (const { pattern } of patterns) {
            if (pattern === this.PATTERN.FOUR_OPEN || pattern === this.PATTERN.FOUR_BLOCKED) {
                fourCount++;
            }
        }
        
        return fourCount >= 2;
    },

    // ===== HELPER: Get cell value =====
    getCell(r, c) {
        // Use GameState if available, otherwise fall back to global
        if (typeof GameState !== 'undefined') {
            return GameState.getBoardCell(r, c);
        }
        
        // Fallback to global functions (temporary during migration)
        if (typeof getCell === 'function') {
            return getCell(r, c);
        }
        
        // Final fallback
        if (typeof boardState !== 'undefined' && !isInfinite) {
            if (r >= 0 && r < boardSize && c >= 0 && c < boardSize) {
                return boardState[r][c];
            }
            return "W";
        }
        
        if (typeof infiniteMap !== 'undefined' && isInfinite) {
            return infiniteMap.get(`${r},${c}`) || "";
        }
        
        return "";
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PatternDetector;
}
