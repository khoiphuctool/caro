// ===== SCORE TABLE - Single Source of Truth for AI Scoring =====
// This is the ONLY place where scoring values are defined.
// All AI modules must use this table to ensure consistency.

const ScoreTable = {
    // ===== ATTACK SCORES (Bot's pieces) =====
    ATTACK: {
        FIVE: 150000,           // Win immediately
        FOUR_OPEN: 10000,       // 4 in a row, both ends open - winning threat
        FOUR_BLOCKED: 2000,     // 4 in a row, one end blocked
        THREE_OPEN: 6000,       // 3 in a row, both ends open - high attack priority
        THREE_BLOCKED: 400,     // 3 in a row, one end blocked
        TWO_OPEN: 300,          // 2 in a row, both ends open
        TWO_BLOCKED: 30,        // 2 in a row, one end blocked
    },

    // ===== DEFENSE SCORES (Opponent's pieces) =====
    DEFENSE: {
        FIVE: 80000,            // Opponent about to win - MUST block
        FOUR_OPEN: 8000,        // Opponent has 4 open
        FOUR_BLOCKED: 1200,     // Opponent has 4 blocked
        THREE_OPEN: 5000,       // Opponent has 3 open - DANGEROUS, block immediately
        THREE_BLOCKED: 300,     // Opponent has 3 blocked
        TWO_OPEN: 100,          // Opponent has 2 open
        TWO_BLOCKED: 10,        // Opponent has 2 blocked
    },

    // ===== BONUS SCORES for special patterns =====
    BONUS: {
        DOUBLE_THREE: 15000,    // Two THREE_OPEN lines simultaneously
        FOUR_THREE: 20000,      // Has both FOUR and THREE_OPEN
        DOUBLE_FOUR: 50000,     // Two FOUR lines simultaneously
    },

    // ===== POSITIONAL BONUS =====
    CENTER_BIAS: {
        MAX: 20,                // Maximum center bias score
        DISTANCE: 5,            // Radius for center bias calculation
    },

    // ===== THREAT LEVELS =====
    THREAT: {
        NONE: 0,
        LOW: 1,
        MEDIUM: 2,
        HIGH: 3,
        CRITICAL: 4,
        WINNING: 5,
    },

    // ===== PATTERN TYPES =====
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

    // ===== Helper: Get score by pattern type and role =====
    getScore(patternType, isAttack) {
        const table = isAttack ? this.ATTACK : this.DEFENSE;
        switch (patternType) {
            case this.PATTERN.FIVE: return table.FIVE;
            case this.PATTERN.FOUR_OPEN: return table.FOUR_OPEN;
            case this.PATTERN.FOUR_BLOCKED: return table.FOUR_BLOCKED;
            case this.PATTERN.THREE_OPEN: return table.THREE_OPEN;
            case this.PATTERN.THREE_BLOCKED: return table.THREE_BLOCKED;
            case this.PATTERN.TWO_OPEN: return table.TWO_OPEN;
            case this.PATTERN.TWO_BLOCKED: return table.TWO_BLOCKED;
            default: return 0;
        }
    },

    // ===== Helper: Get threat level by pattern type =====
    getThreatLevel(patternType, isAttack) {
        if (patternType === this.PATTERN.FIVE) return this.THREAT.WINNING;
        if (patternType === this.PATTERN.FOUR_OPEN) return this.THREAT.CRITICAL;
        if (patternType === this.PATTERN.FOUR_BLOCKED) return this.THREAT.HIGH;
        if (patternType === this.PATTERN.THREE_OPEN) return isAttack ? this.THREAT.HIGH : this.THREAT.CRITICAL;
        if (patternType === this.PATTERN.THREE_BLOCKED) return this.THREAT.MEDIUM;
        if (patternType === this.PATTERN.TWO_OPEN) return this.THREAT.LOW;
        return this.THREAT.NONE;
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ScoreTable;
}
