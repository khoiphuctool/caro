// ===== DEBUG LOGGER - AI Decision Logging System =====
// Provides detailed logging for AI decisions to help debug and understand AI behavior

const DebugLogger = {
    // Log levels
    LEVEL: {
        ERROR: 'error',
        WARN: 'warn',
        INFO: 'info',
        DEBUG: 'debug'
    },

    // Log categories
    CATEGORY: {
        AI_DECISION: 'ai_decision',
        PATTERN: 'pattern',
        THREAT: 'threat',
        SEARCH: 'search',
        EVALUATION: 'evaluation',
        LEARNING: 'learning',
        GAME_STATE: 'game_state'
    },

    // Configuration
    config: {
        enabled: false,
        logLevel: 'info',
        maxLogs: 500,
        consoleOutput: true,
        persistToStorage: false
    },

    // Log storage
    logs: [],

    // ===== INITIALIZE =====
    initialize(config = {}) {
        this.config = { ...this.config, ...config };
        
        // Load logs from storage if enabled
        if (this.config.persistToStorage) {
            this.loadFromStorage();
        }

        // Set up global debug flag in GameState
        if (typeof GameState !== 'undefined') {
            GameState.enableDebug(this.config.enabled, this.config.logLevel);
        }
    },

    // ===== LOG A MESSAGE =====
    log(category, level, message, data = null) {
        if (!this.config.enabled) return;

        // Check if this level should be logged
        if (!this.shouldLog(level)) return;

        const logEntry = {
            timestamp: new Date().toISOString(),
            category,
            level,
            message,
            data
        };

        this.logs.push(logEntry);

        // Keep only maxLogs entries
        if (this.logs.length > this.config.maxLogs) {
            this.logs.shift();
        }

        // Console output
        if (this.config.consoleOutput) {
            this.consoleLog(logEntry);
        }

        // Persist to storage
        if (this.config.persistToStorage) {
            this.saveToStorage();
        }
    },

    // ===== AI DECISION LOGGING =====
    logAIDecision(move, score, threat, searchInfo) {
        this.log(
            this.CATEGORY.AI_DECISION,
            this.LEVEL.INFO,
            `AI chose move (${move.r}, ${move.c})`,
            {
                move,
                score: score.toFixed(2),
                threat: {
                    attack: threat.attack.maxThreat,
                    defense: threat.defense.maxThreat,
                    combined: threat.combined.level
                },
                search: {
                    algorithm: searchInfo.algorithm,
                    depth: searchInfo.depth,
                    time: searchInfo.time + 'ms',
                    nodes: searchInfo.nodes
                }
            }
        );
    },

    // ===== PATTERN DETECTION LOGGING =====
    logPatternDetection(r, c, player, patterns) {
        this.log(
            this.CATEGORY.PATTERN,
            this.LEVEL.DEBUG,
            `Pattern detection at (${r}, ${c}) for ${player}`,
            {
                r, c, player,
                patterns: patterns.map(p => ({
                    direction: p.direction,
                    pattern: p.pattern
                }))
            }
        );
    },

    // ===== THREAT EVALUATION LOGGING =====
    logThreatEvaluation(r, c, player, threat) {
        this.log(
            this.CATEGORY.THREAT,
            this.LEVEL.DEBUG,
            `Threat evaluation at (${r}, ${c}) for ${player}`,
            {
                r, c, player,
                attack: {
                    maxThreat: threat.attack.maxThreat,
                    hasWinningMove: threat.attack.hasWinningMove,
                    patternCount: threat.attack.patternScores.length
                },
                defense: {
                    maxThreat: threat.defense.maxThreat,
                    isUrgent: threat.defense.isUrgent,
                    patternCount: threat.defense.patternScores.length
                },
                combined: {
                    level: threat.combined.level,
                    priority: threat.combined.priority,
                    score: threat.combined.score.toFixed(2)
                }
            }
        );
    },

    // ===== SEARCH LOGGING =====
    logSearch(algorithm, depth, candidates, result, time) {
        this.log(
            this.CATEGORY.SEARCH,
            this.LEVEL.INFO,
            `Search: ${algorithm} depth=${depth}`,
            {
                algorithm,
                depth,
                candidates: candidates.length,
                result: result.move ? `(${result.move.r}, ${result.move.c})` : 'none',
                score: result.score?.toFixed(2),
                time: time + 'ms'
            }
        );
    },

    // ===== EVALUATION LOGGING =====
    logEvaluation(r, c, player, evaluation) {
        this.log(
            this.CATEGORY.EVALUATION,
            this.LEVEL.DEBUG,
            `Evaluation at (${r}, ${c}) for ${player}`,
            {
                r, c, player,
                score: evaluation.score.toFixed(2),
                centerBias: evaluation.centerBias,
                memoryPenalty: evaluation.memoryPenalty,
                threat: {
                    attack: evaluation.threat.attack.maxThreat,
                    defense: evaluation.threat.defense.maxThreat
                }
            }
        );
    },

    // ===== LEARNING LOGGING =====
    logLearning(action, data) {
        this.log(
            this.CATEGORY.LEARNING,
            this.LEVEL.INFO,
            `Learning: ${action}`,
            data
        );
    },

    // ===== GAME STATE LOGGING =====
    logGameState(action, state) {
        this.log(
            this.CATEGORY.GAME_STATE,
            this.CATEGORY.DEBUG,
            `Game state: ${action}`,
            state
        );
    },

    // ===== CONSOLE LOGGING =====
    consoleLog(logEntry) {
        const prefix = `[${logEntry.level.toUpperCase()}] [${logEntry.category}]`;
        const message = `${prefix} ${logEntry.message}`;
        
        switch (logEntry.level) {
            case this.LEVEL.ERROR:
                console.error(message, logEntry.data || '');
                break;
            case this.LEVEL.WARN:
                console.warn(message, logEntry.data || '');
                break;
            case this.LEVEL.DEBUG:
                console.debug(message, logEntry.data || '');
                break;
            default:
                console.log(message, logEntry.data || '');
        }
    },

    // ===== CHECK IF SHOULD LOG =====
    shouldLog(level) {
        const levels = [this.LEVEL.ERROR, this.LEVEL.WARN, this.LEVEL.INFO, this.LEVEL.DEBUG];
        const currentLevelIndex = levels.indexOf(this.config.logLevel);
        const messageLevelIndex = levels.indexOf(level);
        return messageLevelIndex <= currentLevelIndex;
    },

    // ===== GET LOGS =====
    getLogs(filters = {}) {
        let filtered = [...this.logs];

        if (filters.category) {
            filtered = filtered.filter(log => log.category === filters.category);
        }

        if (filters.level) {
            filtered = filtered.filter(log => log.level === filters.level);
        }

        if (filters.since) {
            filtered = filtered.filter(log => new Date(log.timestamp) >= new Date(filters.since));
        }

        return filtered;
    },

    // ===== CLEAR LOGS =====
    clearLogs() {
        this.logs = [];
        if (this.config.persistToStorage) {
            this.saveToStorage();
        }
    },

    // ===== EXPORT LOGS =====
    exportLogs() {
        const exportData = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            totalLogs: this.logs.length,
            logs: this.logs
        };

        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `caro_debug_logs_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    },

    // ===== STORAGE HELPERS =====
    saveToStorage() {
        try {
            localStorage.setItem('caro_debug_logs', JSON.stringify(this.logs));
        } catch (e) {
            console.error('Failed to save logs to storage:', e);
        }
    },

    loadFromStorage() {
        try {
            const stored = localStorage.getItem('caro_debug_logs');
            if (stored) {
                this.logs = JSON.parse(stored);
            }
        } catch (e) {
            console.error('Failed to load logs from storage:', e);
        }
    },

    // ===== ENABLE/DISABLE =====
    enable(enabled = true) {
        this.config.enabled = enabled;
        if (typeof GameState !== 'undefined') {
            GameState.enableDebug(enabled, this.config.logLevel);
        }
    },

    setLogLevel(level) {
        this.config.logLevel = level;
        if (typeof GameState !== 'undefined') {
            GameState.enableDebug(this.config.enabled, level);
        }
    },

    // ===== GET LOG SUMMARY =====
    getSummary() {
        const summary = {
            total: this.logs.length,
            byLevel: {},
            byCategory: {}
        };

        for (const log of this.logs) {
            summary.byLevel[log.level] = (summary.byLevel[log.level] || 0) + 1;
            summary.byCategory[log.category] = (summary.byCategory[log.category] || 0) + 1;
        }

        return summary;
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DebugLogger;
}
