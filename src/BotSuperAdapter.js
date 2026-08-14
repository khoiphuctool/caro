// Single canonical runtime for the super bot.
// The legacy V1 implementation is intentionally not used at runtime.
const BotSuperAdapter = {
    stats: {
        v2Calls: 0,
        v2Success: 0,
        v2Invalid: 0,
        v2Exception: 0,
        v2Timeout: 0
    },

    getBotMove(options = {}) {
        this.stats.v2Calls++;

        if (typeof BotSuperV2 === 'undefined' || typeof BotSuperV2.getBotMove !== 'function') {
            this.stats.v2Invalid++;
            // console.warn('[BotSuperAdapter] Canonical BotSuperV2 is unavailable.');
            return null;
        }

        try {
            const move = BotSuperV2.getBotMove(options);
            const normalized = this.normalize(move, options, 'BotSuperV2');
            if (normalized) {
                this.stats.v2Success++;
                return normalized;
            }
            this.stats.v2Invalid++;
            return null;
        } catch (error) {
            this.stats.v2Exception++;
            // console.warn('[BotSuperAdapter] Canonical BotSuperV2 exception:', error);
            return null;
        }
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