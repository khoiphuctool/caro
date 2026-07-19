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

    // ===== EVALUATE A SINGLE LINE =====
    // Returns pattern type for a line starting at (r,c) in direction (dr,dc)
    evalLine(r, c, dr, dc, player, winCount) {
        let count = 1;
        let nr = r + dr, nc = c + dc;
        
        // Count forward
        while (this.getCell(nr, nc) === player) {
            count++;
            nr += dr;
            nc += dc;
        }
        
        const headBlocked = (this.getCell(nr, nc) !== "" && this.getCell(nr, nc) !== player);
        
        // Count backward
        nr = r - dr;
        nc = c - dc;
        while (this.getCell(nr, nc) === player) {
            count++;
            nr -= dr;
            nc -= dc;
        }
        
        const tailBlocked = (this.getCell(nr, nc) !== "" && this.getCell(nr, nc) !== player);

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
    evalCell(r, c, player, winCount) {
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
                pattern: this.evalLine(r, c, dr, dc, player, winCount)
            });
        }
        
        return patterns;
    },

    // ===== COUNT LINE AND BLOCKED STATUS =====
    // Returns { count, blockedBoth, headBlocked, tailBlocked }
    countLineAndBlocked(r, c, dr, dc, player) {
        let count = 1;
        let nr = r + dr, nc = c + dc;
        
        while (this.getCell(nr, nc) === player) {
            count++;
            nr += dr;
            nc += dc;
        }
        
        const headBlocked = (this.getCell(nr, nc) !== "" && this.getCell(nr, nc) !== player);
        
        nr = r - dr;
        nc = c - dc;
        while (this.getCell(nr, nc) === player) {
            count++;
            nr -= dr;
            nc -= dc;
        }
        
        const tailBlocked = (this.getCell(nr, nc) !== "" && this.getCell(nr, nc) !== player);
        
        return {
            count,
            blockedBoth: headBlocked && tailBlocked,
            headBlocked,
            tailBlocked
        };
    },

    // ===== DETECT FORK PATTERNS =====
    // A fork is when a move creates multiple attack lines
    detectFork(r, c, player, winCount) {
        const patterns = this.evalCell(r, c, player, winCount);
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
    detectDoubleThree(r, c, player, winCount) {
        const patterns = this.evalCell(r, c, player, winCount);
        let threeOpenCount = 0;
        
        for (const { pattern } of patterns) {
            if (pattern === this.PATTERN.THREE_OPEN) {
                threeOpenCount++;
            }
        }
        
        return threeOpenCount >= 2;
    },

    // ===== DETECT FOUR-THREE COMBINATION =====
    detectFourThree(r, c, player, winCount) {
        const patterns = this.evalCell(r, c, player, winCount);
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
    detectDoubleFour(r, c, player, winCount) {
        const patterns = this.evalCell(r, c, player, winCount);
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
