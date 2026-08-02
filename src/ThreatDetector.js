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

        // WINNING MOVE luôn là ưu tiên cao nhất - bot phải thắng trước khi chặn
        if (attack.hasWinningMove) {
            combined.level = this.THREAT.WINNING;
            combined.priority = 'attack_winning';
        } else if (defense.maxThreat >= this.THREAT.CRITICAL) {
            combined.level = defense.maxThreat;
            combined.priority = 'defense_critical';
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

        // Ưu tiên chặn đầu mở (chưa có quân đối thủ) hơn đầu đã chặn
        // Kiểm tra nếu pattern có đầu mở thì tăng điểm
        for (const { pattern } of defense.patternScores) {
            if (pattern === PatternDetector.PATTERN.FOUR_OPEN) {
                score *= 1.3; // Tăng điểm cho chặn FOUR_OPEN
            }
        }

        return score;
    },

    // ===== ANALYZE BLOCK POSITIONS FOR FOUR_OPEN =====
    // Phân tích các vị trí chặn FOUR_OPEN để biết chặn đầu nào quan trọng hơn
    analyzeBlockPositions(candidates, opponent, winCount, blockBothEnds) {
        const blockPositions = [];

        for (const { r, c } of candidates) {
            const threat = this.evaluateDefenseThreat(r, c, opponent, winCount, blockBothEnds);
            
            // Chỉ quan tâm FOUR_OPEN
            if (threat.maxThreat !== this.THREAT.CRITICAL) continue;
            
            const hasFourOpen = threat.patternScores.some(p => 
                p.pattern === PatternDetector.PATTERN.FOUR_OPEN
            );
            if (!hasFourOpen) continue;

            // Phân tích chi tiết vị trí chặn
            const analysis = this.analyzeBlockPosition(r, c, opponent, winCount);
            blockPositions.push({
                r, c,
                threat,
                analysis,
                score: this.calculateBlockScore(threat, analysis)
            });
        }

        // Sắp xếp theo điểm giảm dần
        blockPositions.sort((a, b) => b.score - a.score);
        return blockPositions;
    },

    // ===== ANALYZE SINGLE BLOCK POSITION =====
    analyzeBlockPosition(r, c, opponent, winCount) {
        const analysis = {
            blocksMultipleThreats: false,
            createsAttack: false,
            strategicPosition: false,
            nearCenter: false,
            // Thêm thông tin chi tiết về việc chặn đầu nào
            blocksOpenEnd: false,
            blocksBlockedEnd: false,
            openEndCount: 0,
            blockedEndCount: 0,
            // ══════════════════════════════════════════════════════════════════
            // THÊM: Đánh giá lợi thế chiến lược sau khi chặn
            // ══════════════════════════════════════════════════════════════════
            attackScore: 0,
            createsThreeOpen: false,
            createsFourOpen: false,
            createsFork: false,
            distanceFromCenter: 0,
            // ══════════════════════════════════════════════════════════════════
            // THÊM: Kiểm tra chặn đầu mở cách 1 ô (quan trọng cho luật chặn 2 đầu)
            // ══════════════════════════════════════════════════════════════════
            blocksOpenEndGap1: false,
            openEndGap1Count: 0
        };

        // Kiểm tra xem chặn này có ngăn được nhiều đe dọa khác không
        const patterns = PatternDetector.evalCell(r, c, opponent, winCount);
        let threatCount = 0;
        for (const { pattern } of patterns) {
            if (pattern !== PatternDetector.PATTERN.NONE) {
                threatCount++;
            }
        }
        analysis.blocksMultipleThreats = threatCount > 1;

        // Kiểm tra xem chặn này có tạo đe dọa cho đối thủ không
        const player = opponent === 'X' ? 'O' : 'X';
        const attackPatterns = PatternDetector.evalCell(r, c, player, winCount);
        for (const { pattern } of attackPatterns) {
            if (pattern === PatternDetector.PATTERN.THREE_OPEN || 
                pattern === PatternDetector.PATTERN.FOUR_OPEN) {
                analysis.createsAttack = true;
                break;
            }
        }

        // ══════════════════════════════════════════════════════════════════
        // PHÂN TÍCH CHI TIẾT: Chặn đầu mở vs đầu đã chặn
        // ══════════════════════════════════════════════════════════════════
        for (const { direction, pattern } of patterns) {
            if (pattern === PatternDetector.PATTERN.NONE) continue;
            
            const { headBlocked, tailBlocked } = PatternDetector.countLineAndBlocked(
                r, c, direction.dr, direction.dc, opponent
            );
            
            // Nếu chặn ở đầu mở (chưa bị chặn) → rất quan trọng
            if (!headBlocked) {
                analysis.blocksOpenEnd = true;
                analysis.openEndCount++;
            }
            // Nếu chặn ở đầu đã chặn → ít quan trọng hơn
            if (headBlocked) {
                analysis.blocksBlockedEnd = true;
                analysis.blockedEndCount++;
            }
            
            // Kiểm tra cả 2 đầu
            if (!tailBlocked) {
                analysis.blocksOpenEnd = true;
                analysis.openEndCount++;
            }
            if (tailBlocked) {
                analysis.blocksBlockedEnd = true;
                analysis.blockedEndCount++;
            }
        }

        // ══════════════════════════════════════════════════════════════════
        // KIỂM TRA CHẶN ĐẦU MỞ CÁCH 1 Ô (QUAN TRỌNG CHO LUẬT CHẶN 2 ĐẦU)
        // ══════════════════════════════════════════════════════════════════
        // Với luật chặn 2 đầu, nếu đầu bị chặn cách 1 ô trống, nên chặn đầu kia
        // Ví dụ: X X X _ _ (đầu mở ở vị trí _ cách 1 ô)
        const directions = [
            { dr: 0, dc: 1 },
            { dr: 1, dc: 0 },
            { dr: 1, dc: 1 },
            { dr: 1, dc: -1 }
        ];
        
        for (const { dr, dc } of directions) {
            // Check forward direction
            let gap1Open = false;
            let gap1Blocked = false;
            
            // Check ô ngay cạnh
            const nr1 = r + dr;
            const nc1 = c + dc;
            const cell1 = PatternDetector.getCell(nr1, nc1);
            
            if (cell1 === '') {
                // Ô trống ngay cạnh → check ô cách 1 ô
                const nr2 = r + dr * 2;
                const nc2 = c + dc * 2;
                const cell2 = PatternDetector.getCell(nr2, nc2);
                
                if (cell2 === '') {
                    // Cả 2 ô đều trống → đây là đầu mở cách 1 ô
                    gap1Open = true;
                } else if (cell2 !== '' && cell2 !== opponent) {
                    // Ô cách 1 ô bị chặn bởi quân khác → đây là đầu mở cách 1 ô
                    gap1Open = true;
                }
            } else if (cell1 === opponent) {
                // Ô ngay cạnh đã có quân đối thủ → check ô cách 1 ô
                const nr2 = r + dr * 2;
                const nc2 = c + dc * 2;
                const cell2 = PatternDetector.getCell(nr2, nc2);
                
                if (cell2 === '') {
                    // Ô cách 1 ô trống → đây là đầu mở cách 1 ô
                    gap1Open = true;
                }
            }
            
            if (gap1Open) {
                analysis.blocksOpenEndGap1 = true;
                analysis.openEndGap1Count++;
            }
            
            // Check backward direction
            gap1Open = false;
            const br1 = r - dr;
            const bc1 = c - dc;
            const bcell1 = PatternDetector.getCell(br1, bc1);
            
            if (bcell1 === '') {
                const br2 = r - dr * 2;
                const bc2 = c - dc * 2;
                const bcell2 = PatternDetector.getCell(br2, bc2);
                
                if (bcell2 === '' || (bcell2 !== '' && bcell2 !== opponent)) {
                    gap1Open = true;
                }
            } else if (bcell1 === opponent) {
                const br2 = r - dr * 2;
                const bc2 = c - dc * 2;
                const bcell2 = PatternDetector.getCell(br2, bc2);
                
                if (bcell2 === '') {
                    gap1Open = true;
                }
            }
            
            if (gap1Open) {
                analysis.blocksOpenEndGap1 = true;
                analysis.openEndGap1Count++;
            }
        }

        // ══════════════════════════════════════════════════════════════════
        // ĐÁNH GIÁ LỢI THẾ CHIẾN LƯỢC SAU KHI CHẶN
        // ══════════════════════════════════════════════════════════════════
        
        // Đánh giá đòn tấn công sau khi chặn
        for (const { pattern } of attackPatterns) {
            if (pattern === PatternDetector.PATTERN.THREE_OPEN) {
                analysis.createsThreeOpen = true;
                analysis.attackScore += 5000;
            }
            if (pattern === PatternDetector.PATTERN.FOUR_OPEN) {
                analysis.createsFourOpen = true;
                analysis.attackScore += 20000;
            }
            if (pattern === PatternDetector.PATTERN.FIVE) {
                analysis.attackScore += 100000;
            }
        }

        // Kiểm tra fork (nhiều đe dọa cùng lúc)
        let attackThreatCount = 0;
        for (const { pattern } of attackPatterns) {
            if (pattern !== PatternDetector.PATTERN.NONE) {
                attackThreatCount++;
            }
        }
        if (attackThreatCount >= 2) {
            analysis.createsFork = true;
            analysis.attackScore += 10000;
        }

        // Kiểm tra vị trí chiến lược (gần trung tâm)
        const isInfinite = typeof GameState !== 'undefined' && GameState.board ? GameState.board.isInfinite : false;
        const infiniteMap = typeof GameState !== 'undefined' && GameState.board ? GameState.board.infiniteMap : null;
        if (isInfinite && infiniteMap && infiniteMap.size > 0) {
            let sr = 0, sc = 0, n = 0;
            for (const key of infiniteMap.keys()) {
                const [kr, kc] = key.split(',').map(Number);
                sr += kr;
                sc += kc;
                n++;
            }
            const cr = sr / n, cc = sc / n;
            const dist = Math.abs(r - cr) + Math.abs(c - cc);
            analysis.distanceFromCenter = dist;
            analysis.nearCenter = dist < 5;
            analysis.strategicPosition = analysis.nearCenter;
            
            // Bonus cho vị trí gần trung tâm
            if (dist < 3) analysis.attackScore += 3000;
            else if (dist < 5) analysis.attackScore += 2000;
            else if (dist < 8) analysis.attackScore += 1000;
        }

        return analysis;
    },

    // ===== CALCULATE BLOCK SCORE =====
    calculateBlockScore(threat, analysis) {
        let score = 0;

        // Base score từ threat
        for (const { pattern } of threat.patternScores) {
            score += this.getScore(pattern, false);
        }

        // ══════════════════════════════════════════════════════════════════
        // QUAN TRỌNG NHẤT: Ưu tiên chặn đầu MỞ (chưa có quân đối thủ)
        // Chặn đầu mở quan trọng hơn nhiều so với đầu đã chặn
        // ══════════════════════════════════════════════════════════════════
        if (analysis.blocksOpenEnd) {
            // Chặn đầu mở → multiplier rất cao
            score *= 3.0;
            
            // Bonus thêm cho mỗi đầu mở chặn được
            score += analysis.openEndCount * 5000;
        }
        
        // ══════════════════════════════════════════════════════════════════
        // ƯU TIÊN CAO: Chặn đầu mở cách 1 ô (quan trọng cho luật chặn 2 đầu)
        // ══════════════════════════════════════════════════════════════════
        if (analysis.blocksOpenEndGap1) {
            // Chặn đầu mở cách 1 ô → multiplier cực cao
            score *= 5.0;
            
            // Bonus rất lớn cho mỗi đầu mở cách 1 ô chặn được
            score += analysis.openEndGap1Count * 10000;
        }
        
        // Chặn đầu đã chặn → penalty (ít quan trọng)
        if (analysis.blocksBlockedEnd && !analysis.blocksOpenEnd && !analysis.blocksOpenEndGap1) {
            // Nếu chỉ chặn đầu đã chặn → giảm điểm mạnh
            score *= 0.3;
            score -= analysis.blockedEndCount * 2000;
        }

        // ══════════════════════════════════════════════════════════════════
        // ĐÁNH GIÁ LỢI THẾ CHIẾN LƯỢC SAU KHI CHẶN
        // Với luật chặn 2 đầu, đối thủ sẽ không thắng → ưu tiên chặn tạo thế cờ tốt
        // ══════════════════════════════════════════════════════════════════
        
        // Thêm attackScore từ analysis (đánh giá đòn tấn công sau khi chặn)
        score += analysis.attackScore;
        
        // Bonus lớn nếu chặn tạo THREE_OPEN (tạo thế cờ tấn công)
        if (analysis.createsThreeOpen) {
            score += 8000;
        }
        
        // Bonus rất lớn nếu chặn tạo FOUR_OPEN (gần thắng)
        if (analysis.createsFourOpen) {
            score += 25000;
        }
        
        // Bonus cực lớn nếu chặn tạo fork (nhiều đe dọa)
        if (analysis.createsFork) {
            score += 15000;
        }

        // Urgency multiplier
        if (threat.isUrgent) {
            score *= 1.5;
        }

        // FOUR_OPEN multiplier
        const hasFourOpen = threat.patternScores.some(p => 
            p.pattern === PatternDetector.PATTERN.FOUR_OPEN
        );
        if (hasFourOpen) {
            score *= 1.3;
        }

        // Bonus cho chặn nhiều đe dọa
        if (analysis.blocksMultipleThreats) {
            score *= 1.4;
        }

        // Bonus cho tạo đe dọa cho đối thủ (đã được tính trong attackScore)
        if (analysis.createsAttack) {
            score *= 1.2;
        }

        // Bonus cho vị trí chiến lược (đã được tính trong attackScore)
        if (analysis.strategicPosition) {
            score *= 1.1;
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
