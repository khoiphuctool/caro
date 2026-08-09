// Sole runtime gateway: V2 is primary, V1 is an explicit temporary fallback.
const BotSuperAdapter = {
    stats: {
        v2Calls: 0,
        v2Success: 0,
        v2Invalid: 0,
        v2Exception: 0,
        v2Timeout: 0,
        v1Fallback: 0,
        v1FallbackSuccess: 0,
        v1FallbackFailure: 0
    },

    getBotMove(options = {}) {
        const startedAt = Date.now();
        const timeLimit = options.timeLimit || 2000;
        let fallbackReason = null;

        this.stats.v2Calls++;

        if (typeof BotSuperV2 !== 'undefined' && typeof BotSuperV2.getBotMove === 'function') {
            try {
                const v2Move = BotSuperV2.getBotMove(options);
                const normalized = this.normalize(v2Move, options, 'BotSuperV2');
                if (normalized && Date.now() - startedAt <= timeLimit) {
                    this.stats.v2Success++;
                    return normalized;
                }
                if (Date.now() - startedAt > timeLimit) {
                    this.stats.v2Timeout++;
                    fallbackReason = 'TIMEOUT';
                } else {
                    this.stats.v2Invalid++;
                    fallbackReason = 'INVALID_MOVE';
                }
            } catch (error) {
                this.stats.v2Exception++;
                fallbackReason = 'EXCEPTION';
                console.warn('[BotSuperAdapter] V2 exception; using V1', error);
            }
        } else {
            this.stats.v2Invalid++;
            fallbackReason = 'V2_UNAVAILABLE';
        }

        if (typeof BotSuperV1 !== 'undefined' && typeof BotSuperV1.getBotMove === 'function') {
            const v1Move = BotSuperV1.getBotMove(options);
            const normalized = this.normalize(v1Move, options, 'BotSuperV1');
            this.stats.v1Fallback++;
            console.warn('[BotSuperAdapter] FALLBACK', {
                reason: fallbackReason || 'V2_UNAVAILABLE',
                v1Fallback: this.stats.v1Fallback
            });
            if (normalized) {
                this.stats.v1FallbackSuccess++;
                return normalized;
            }
            this.stats.v1FallbackFailure++;
        }

        return null;
    },

    getStats() {
        return { ...this.stats };
    },

    resetStats() {
        for (const key of Object.keys(this.stats)) this.stats[key] = 0;
    },

    normalize(result, options = {}, defaultSource = 'BotSuperV2') {
        const candidate = result && result.row !== undefined
            ? result
            : result && result.move
                ? result.move
                : result;
        if (!candidate || !Number.isInteger(candidate.row ?? candidate.r) || !Number.isInteger(candidate.col ?? candidate.c)) {
            return null;
        }

        const row = candidate.row ?? candidate.r;
        const col = candidate.col ?? candidate.c;
        if (typeof getCell === 'function' && getCell(row, col) !== '') return null;
        if (options.boardSize && (row < 0 || col < 0 || row >= options.boardSize || col >= options.boardSize)) return null;

        return {
            r: row,
            c: col,
            score: Number.isFinite(candidate.score) ? candidate.score : 0,
            reason: candidate.reason || 'search',
            source: candidate.source || defaultSource
        };
    }
};

window.BotSuperAdapter = BotSuperAdapter;