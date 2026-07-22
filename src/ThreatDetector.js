// ===== THREAT DETECTOR - Evaluates danger level of patterns =====
// This module uses PatternDetector results and ScoreTable to determine threat levels
// It does NOT decide moves - that's the Evaluation module's job

const ThreatDetector = {
    // ===== THREAT LEVELS =====
    THREAT: {
        NONE: 0,
        LOW: 1,
        MEDIUM: 2,
        HIGH: 3,
        CRITICAL: 4,
        WINNING: 5,
    },

    // ===== EVALUATE THREAT FOR A CELL =====
    // Returns threat assessment for a potential move
    evaluateThreat(r, c, player, opponent, winCount, blockBothEnds) {
        const threat = {
            attack: this.evaluateAttackThreat(r, c, player, winCount, blockBothEnds),
            defense: this.evaluateDefenseThreat(r, c, opponent, winCount, blockBothEnds),
            combined: 0
        };

        // Calculate combined threat
        threat.combined = this.combineThreats(threat.attack, threat.defense);

        return threat;
    },

    // ===== EVALUATE ATTACK THREAT =====
    evaluateAttackThreat(r, c, player, winCount, blockBothEnds) {
        const patterns = PatternDetector.evalCell(r, c, player, winCount);
        
        let maxThreat = this.THREAT.NONE;
        let patternScores = [];
        
        for (const { direction, pattern } of patterns) {
            if (pattern === PatternDetector.PATTERN.NONE) continue;
            
            // Check if blocked both ends
            let isDead = false;
            if (blockBothEnds && pattern !== PatternDetector.PATTERN.FIVE) {
                const { blockedBoth } = PatternDetector.countLineAndBlocked(
                    r, c, direction.dr, direction.dc, player
                );
                if (blockedBoth) isDead = true;
            }
            
            if (!isDead) {
                const threatLevel = this.getThreatLevel(pattern, true);
                const score = this.getScore(pattern, true);
                
                patternScores.push({
                    pattern,
                    threatLevel,
                    score,
                    direction
                });
                
                if (threatLevel > maxThreat) {
                    maxThreat = threatLevel;
                }
            }
        }

        // Check for special patterns (forks, double three, etc.)
        const specialPatterns = this.detectSpecialPatterns(r, c, player, winCount);
        
        return {
            maxThreat,
            patternScores,
            specialPatterns,
            hasWinningMove: maxThreat === this.THREAT.WINNING
        };
    },

    // ===== EVALUATE DEFENSE THREAT =====
    evaluateDefenseThreat(r, c, opponent, winCount, blockBothEnds) {
        const patterns = PatternDetector.evalCell(r, c, opponent, winCount);
        
        let maxThreat = this.THREAT.NONE;
        let patternScores = [];
        
        for (const { direction, pattern } of patterns) {
            if (pattern === PatternDetector.PATTERN.NONE) continue;
            
            // Check if blocked both ends
            let isDead = false;
            if (blockBothEnds && pattern !== PatternDetector.PATTERN.FIVE) {
                const { blockedBoth } = PatternDetector.countLineAndBlocked(
                    r, c, direction.dr, direction.dc, opponent
                );
                if (blockedBoth) isDead = true;
            }
            
            if (!isDead) {
                const threatLevel = this.getThreatLevel(pattern, false);
                const score = this.getScore(pattern, false);
                
                patternScores.push({
                    pattern,
                    threatLevel,
                    score,
                    direction
                });
                
                if (threatLevel > maxThreat) {
                    maxThreat = threatLevel;
                }
            }
        }

        return {
            maxThreat,
            patternScores,
            isUrgent: maxThreat >= this.THREAT.CRITICAL
        };
    },

    // ===== DETECT SPECIAL PATTERNS =====
    detectSpecialPatterns(r, c, player, winCount) {
        return {
            fork: PatternDetector.detectFork(r, c, player, winCount),
            doubleThree: PatternDetector.detectDoubleThree(r, c, player, winCount),
            fourThree: PatternDetector.detectFourThree(r, c, player, winCount),
            doubleFour: PatternDetector.detectDoubleFour(r, c, player, winCount)
        };
    },

    // ===== COMBINE THREATS =====
    combineThreats(attack, defense) {
        let combined = {
            level: this.THREAT.NONE,
            score: 0,
            priority: 'none'
        };

        // Defense is usually higher priority than attack
        if (defense.maxThreat >= this.THREAT.CRITICAL) {
            combined.level = defense.maxThreat;
            combined.priority = 'defense_critical';
        } else if (attack.hasWinningMove) {
            combined.level = this.THREAT.WINNING;
            combined.priority = 'attack_winning';
        } else if (attack.maxThreat >= this.THREAT.HIGH) {
            combined.level = attack.maxThreat;
            combined.priority = 'attack_high';
        } else if (defense.maxThreat >= this.THREAT.HIGH) {
            combined.level = defense.maxThreat;
            combined.priority = 'defense_high';
        } else {
            combined.level = Math.max(attack.maxThreat, defense.maxThreat);
            combined.priority = 'balanced';
        }

        // Calculate combined score
        const attackScore = this.calculateAttackScore(attack);
        const defenseScore = this.calculateDefenseScore(defense);
        combined.score = attackScore + defenseScore;

        return combined;
    },

    // ===== CALCULATE ATTACK SCORE =====
    calculateAttackScore(attack) {
        let score = 0;
        
        for (const { pattern } of attack.patternScores) {
            score += this.getScore(pattern, true);
        }

        // Add bonuses for special patterns
        if (attack.specialPatterns.doubleThree) {
            score += ScoreTable.BONUS.DOUBLE_THREE;
        }
        if (attack.specialPatterns.fourThree) {
            score += ScoreTable.BONUS.FOUR_THREE;
        }
        if (attack.specialPatterns.doubleFour) {
            score += ScoreTable.BONUS.DOUBLE_FOUR;
        }

        // Priority multiplier when having winning move
        if (attack.hasWinningMove) {
            score *= 2;
        }

        return score;
    },

    // ===== CALCULATE DEFENSE SCORE =====
    calculateDefenseScore(defense) {
        let score = 0;
        
        for (const { pattern } of defense.patternScores) {
            score += this.getScore(pattern, false);
        }

        // Defense urgency multiplier
        if (defense.isUrgent) {
            score *= 1.5;
        }

        return score;
    },

    // ===== GET THREAT LEVEL =====
    getThreatLevel(patternType, isAttack) {
        // Use ScoreTable if available
        if (typeof ScoreTable !== 'undefined') {
            return ScoreTable.getThreatLevel(patternType, isAttack);
        }

        // Fallback logic
        if (patternType === PatternDetector.PATTERN.FIVE) return this.THREAT.WINNING;
        if (patternType === PatternDetector.PATTERN.FOUR_OPEN) return this.THREAT.CRITICAL;
        if (patternType === PatternDetector.PATTERN.FOUR_BLOCKED) return this.THREAT.HIGH;
        if (patternType === PatternDetector.PATTERN.THREE_OPEN) {
            return isAttack ? this.THREAT.HIGH : this.THREAT.CRITICAL;
        }
        if (patternType === PatternDetector.PATTERN.THREE_BLOCKED) return this.THREAT.MEDIUM;
        if (patternType === PatternDetector.PATTERN.TWO_OPEN) return this.THREAT.LOW;
        return this.THREAT.NONE;
    },

    // ===== GET SCORE =====
    getScore(patternType, isAttack) {
        // Dùng ScoreTable.getScaledScore nếu có (scale theo winCount)
        if (typeof ScoreTable !== 'undefined') {
            if (ScoreTable.getScaledScore && typeof winCount !== 'undefined') {
                return ScoreTable.getScaledScore(patternType, isAttack, winCount);
            }
            return ScoreTable.getScore(patternType, isAttack);
        }

        // Fallback to legacy scoring (temporary during migration)
        if (typeof SCORE_ATK !== 'undefined' && typeof SCORE_DEF !== 'undefined') {
            const table = isAttack ? SCORE_ATK : SCORE_DEF;
            switch (patternType) {
                case PatternDetector.PATTERN.FIVE: return table.FIVE;
                case PatternDetector.PATTERN.FOUR_OPEN: return table.FOUR_OPEN;
                case PatternDetector.PATTERN.FOUR_BLOCKED: return table.FOUR_BLOCKED;
                case PatternDetector.PATTERN.THREE_OPEN: return table.THREE_OPEN;
                case PatternDetector.PATTERN.THREE_BLOCKED: return table.THREE_BLOCKED;
                case PatternDetector.PATTERN.TWO_OPEN: return table.TWO_OPEN;
                case PatternDetector.PATTERN.TWO_BLOCKED: return table.TWO_BLOCKED;
                default: return 0;
            }
        }

        return 0;
    },

    // ===== CHECK IF MOVE IS WINNING =====
    isWinningMove(r, c, player, winCount) {
        const threat = this.evaluateAttackThreat(r, c, player, winCount, false);
        return threat.hasWinningMove;
    },

    // ===== CHECK IF MOVE BLOCKS WINNING THREAT =====
    blocksWinningThreat(r, c, opponent, winCount) {
        const threat = this.evaluateDefenseThreat(r, c, opponent, winCount, false);
        return threat.maxThreat >= this.THREAT.WINNING;
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ThreatDetector;
}
