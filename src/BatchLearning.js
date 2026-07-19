// ===== BATCH LEARNING - Chống Oscillation =====
//
// Giải quyết vấn đề oscillation (dao động) bằng cách:
// 1. Replay Buffer: lưu N ván gần nhất, học từ tổng hợp chứ không từng ván
// 2. Best Model: chỉ ghi nhận kiến thức khi Win Rate > WIN_RATE_THRESHOLD
// 3. Elo Rating: theo dõi sức mạnh thực tế của từng phiên bản bot
// ─────────────────────────────────────────────────────────────────

const BatchLearning = {

    // ===== CẤU HÌNH =====
    config: {
        replayBufferSize: 500,        // lưu tối đa N ván
        batchSize: 100,               // học sau mỗi N ván (batch)
        winRateThreshold: 0.55,       // cần thắng > 55% mới chấp nhận model mới
        evaluationGames: 100,         // đánh N ván để đánh giá model mới
        eloK: 32,                     // hệ số K cho Elo
        storageKey: 'batch_learning_v1'
    },

    // ===== REPLAY BUFFER =====
    // Mỗi entry: { history, result, winner, timestamp }
    replayBuffer: [],

    // ===== BEST MODEL =====
    bestModel: null,        // snapshot của botMemory tốt nhất
    currentModel: null,     // snapshot model đang dùng (trước batch hiện tại)

    // ===== ELO =====
    elo: {
        current: 1500,
        best: 1500,
        history: []         // [{version, elo, timestamp}]
    },

    // ===== THỐNG KÊ BATCH HIỆN TẠI =====
    batchStats: {
        gamesInBatch: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        startTime: null
    },

    // ===== THỐNG KÊ ĐÁNH GIÁ MODEL MỚI =====
    evaluation: {
        active: false,
        games: 0,
        wins: 0,
        pendingMemory: null,   // memory chờ được đánh giá
        pendingElo: 1500
    },

    // ===== KHỞI TẠO =====
    initialize() {
        this.load();
        if (!this.bestModel) {
            // Lần đầu: dùng botMemory hiện tại làm Best Model
            this.bestModel = this._cloneMemory();
        }
        console.log('[BatchLearning] Initialized. Buffer:', this.replayBuffer.length,
                    'Elo:', this.elo.current);
    },

    // ===== THÊM VÁN VÀO REPLAY BUFFER =====
    addGame(history, result, winner) {
        if (!history || history.length < 3) return;

        this.replayBuffer.push({
            history: history.map(m => ({ ...m })), // deep copy
            result,
            winner,
            timestamp: Date.now()
        });

        // Giới hạn buffer
        if (this.replayBuffer.length > this.config.replayBufferSize) {
            this.replayBuffer.shift();
        }

        // Cập nhật batch stats
        this.batchStats.gamesInBatch++;
        if (winner === 'X') this.batchStats.wins++;
        else if (winner === 'O') this.batchStats.losses++;
        else this.batchStats.draws++;

        // Cập nhật Elo sau mỗi ván
        this._updateElo(result, winner);

        // Kiểm tra xem có đủ để chạy batch chưa
        if (this.batchStats.gamesInBatch >= this.config.batchSize) {
            this._runBatch();
        }
    },

    // ===== CHẠY BATCH LEARNING =====
    _runBatch() {
        console.log('[BatchLearning] Running batch on', this.replayBuffer.length, 'games...');

        // Bắt đầu từ bestModel hiện tại (không từ {} rỗng)
        // → giữ lại knowledge tích lũy, chỉ bổ sung thêm từ replay buffer
        const tempMemory = this._cloneMemory(this.bestModel || {});

        for (const game of this.replayBuffer) {
            this._learnFromGame(tempMemory, game.history, game.result, game.winner);
        }

        // Tính win rate trong batch
        const total = this.batchStats.wins + this.batchStats.losses + this.batchStats.draws;
        const winRate = total > 0 ? this.batchStats.wins / total : 0.5;

        console.log(`[BatchLearning] Batch WinRate: ${(winRate * 100).toFixed(1)}%`,
                    `Wins: ${this.batchStats.wins}, Losses: ${this.batchStats.losses}`);

        // Kiểm tra win rate — nếu đủ tốt thì bắt đầu evaluation
        if (winRate >= this.config.winRateThreshold) {
            this.evaluation.active = true;
            this.evaluation.games = 0;
            this.evaluation.wins = 0;
            this.evaluation.pendingMemory = tempMemory;
            this.evaluation.pendingElo = this.elo.current;
            console.log('[BatchLearning] Win rate OK! Starting evaluation phase...');
        } else {
            // Win rate không đủ — rollback về best model
            console.log('[BatchLearning] Win rate too low. Rolling back to best model.');
            this._rollbackToBestModel();
        }

        // Reset batch stats
        this.batchStats = { gamesInBatch: 0, wins: 0, losses: 0, draws: 0, startTime: Date.now() };
        this.save();
    },

    // ===== HỌC TỪ MỘT VÁN (không ghi vào botMemory ngay) =====
    _learnFromGame(tempMemory, history, result, winner) {
        if (!history || history.length < 3) return;
        if (result === 'draw' || !winner) return; // bỏ qua hòa

        const winnerPiece = winner;
        const loserPiece  = winner === 'X' ? 'O' : 'X';

        this._accumulatePattern(tempMemory, history, winnerPiece, 'win');
        this._accumulatePattern(tempMemory, history, loserPiece, 'loss');
    },

    // ===== TÍCH LŨY PATTERN VÀO tempMemory =====
    _accumulatePattern(tempMemory, history, piece, type) {
        const MEMORY_DEPTH = 8;
        const moves = history.filter(m => m.player === piece);

        for (let depth = 3; depth <= Math.min(MEMORY_DEPTH, moves.length); depth++) {
            const recent = moves.slice(-depth);
            if (recent.length < depth) continue;

            const key = this._normalizeKey(recent);
            if (!key) continue;

            const finalKey = type === 'win' ? `WIN_${key}` : key;

            if (tempMemory[finalKey]) {
                tempMemory[finalKey].hits++;
                tempMemory[finalKey].lastSeen = Date.now();
            } else {
                tempMemory[finalKey] = {
                    hits: 1,
                    depth,
                    lastSeen: Date.now(),
                    type,
                    boardDensity: history.length,
                    centerDistance: 0
                };
            }
        }
    },

    // ===== CHUẨN HÓA KEY =====
    _normalizeKey(moves) {
        if (!moves || moves.length === 0) return null;
        const r0 = moves[0].r, c0 = moves[0].c;
        return moves.map(m => `${m.r - r0},${m.c - c0}`).join('|');
    },

    // ===== ĐÁNH GIÁ MODEL MỚI (gọi sau mỗi ván trong evaluation phase) =====
    onEvaluationGame(winner) {
        if (!this.evaluation.active) return;

        this.evaluation.games++;
        if (winner === 'X') this.evaluation.wins++;

        if (this.evaluation.games >= this.config.evaluationGames) {
            const evalWinRate = this.evaluation.wins / this.evaluation.games;
            console.log(`[BatchLearning] Evaluation done. WinRate: ${(evalWinRate * 100).toFixed(1)}%`);

            if (evalWinRate >= this.config.winRateThreshold) {
                // Model mới tốt hơn → chấp nhận
                console.log('[BatchLearning] New model accepted! Updating best model.');
                this._acceptNewModel(this.evaluation.pendingMemory, this.evaluation.pendingElo);
            } else {
                // Model mới không đủ tốt → giữ best model
                console.log('[BatchLearning] New model rejected. Keeping best model.');
                this._rollbackToBestModel();
            }

            this.evaluation.active = false;
            this.evaluation.pendingMemory = null;
            this.save();
        }
    },

    // ===== CHẤP NHẬN MODEL MỚI =====
    _acceptNewModel(newMemory, newElo) {
        // Ghi vào botMemory
        if (typeof botMemory !== 'undefined') {
            // Merge: giữ lại pattern cũ có hits cao, thêm pattern mới
            for (const [key, val] of Object.entries(newMemory)) {
                if (!botMemory[key] || botMemory[key].hits < val.hits) {
                    botMemory[key] = val;
                }
            }
        }

        // Cập nhật best model snapshot
        this.bestModel = this._cloneMemory();
        this.elo.best = newElo;

        // Lưu Elo history
        this.elo.history.push({
            version: this.elo.history.length + 1,
            elo: newElo,
            timestamp: Date.now()
        });
        // Giới hạn history
        if (this.elo.history.length > 50) this.elo.history.shift();

        // Lưu xuống localStorage
        if (typeof saveBotMemory === 'function') saveBotMemory();

        console.log(`[BatchLearning] Best model updated. Elo: ${newElo}`);
    },

    // ===== ROLLBACK VỀ BEST MODEL =====
    _rollbackToBestModel() {
        if (!this.bestModel) return;

        if (typeof botMemory !== 'undefined') {
            // Restore botMemory từ bestModel snapshot
            Object.keys(botMemory).forEach(k => delete botMemory[k]);
            Object.assign(botMemory, this._cloneMemory(this.bestModel));
        }

        this.elo.current = this.elo.best;
        if (typeof saveBotMemory === 'function') saveBotMemory();

        console.log('[BatchLearning] Rolled back to best model. Elo:', this.elo.best);
    },

    // ===== CẬP NHẬT ELO =====
    _updateElo(result, winner) {
        // Simplified Elo: X là "current model", O là opponent
        const K = this.config.eloK;
        const expectedScore = 1 / (1 + Math.pow(10, (1500 - this.elo.current) / 400));

        let actualScore;
        if (winner === 'X') actualScore = 1;
        else if (winner === 'O') actualScore = 0;
        else actualScore = 0.5;

        this.elo.current = Math.round(this.elo.current + K * (actualScore - expectedScore));
    },

    // ===== CLONE MEMORY =====
    _cloneMemory(source) {
        const src = source || (typeof botMemory !== 'undefined' ? botMemory : {});
        return JSON.parse(JSON.stringify(src));
    },

    // ===== LẤY TRẠNG THÁI =====
    getStatus() {
        const total = this.batchStats.wins + this.batchStats.losses + this.batchStats.draws;
        return {
            replayBufferSize: this.replayBuffer.length,
            batchProgress: `${this.batchStats.gamesInBatch}/${this.config.batchSize}`,
            batchWinRate: total > 0 ? ((this.batchStats.wins / total) * 100).toFixed(1) + '%' : 'N/A',
            eloCurrentModel: this.elo.current,
            eloBestModel: this.elo.best,
            evaluating: this.evaluation.active,
            evalProgress: this.evaluation.active
                ? `${this.evaluation.games}/${this.config.evaluationGames}`
                : 'idle'
        };
    },

    // ===== LƯU / TẢI STATE =====
    save() {
        try {
            const data = {
                replayBuffer: this.replayBuffer.slice(-200), // chỉ lưu 200 ván gần nhất
                bestModel: this.bestModel,
                elo: this.elo
            };
            localStorage.setItem(this.config.storageKey, JSON.stringify(data));
        } catch (e) {
            console.warn('[BatchLearning] Save failed:', e.message);
        }
    },

    load() {
        try {
            const raw = localStorage.getItem(this.config.storageKey);
            if (!raw) return;
            const data = JSON.parse(raw);
            if (data.replayBuffer) this.replayBuffer = data.replayBuffer;
            if (data.bestModel)    this.bestModel    = data.bestModel;
            if (data.elo)          this.elo          = data.elo;
        } catch (e) {
            console.warn('[BatchLearning] Load failed:', e.message);
        }
    },

    // ===== RESET HOÀN TOÀN =====
    reset() {
        this.replayBuffer = [];
        this.bestModel = null;
        this.currentModel = null;
        this.elo = { current: 1500, best: 1500, history: [] };
        this.batchStats = { gamesInBatch: 0, wins: 0, losses: 0, draws: 0, startTime: null };
        this.evaluation = { active: false, games: 0, wins: 0, pendingMemory: null, pendingElo: 1500 };
        localStorage.removeItem(this.config.storageKey);
        console.log('[BatchLearning] Reset done.');
    }
};

// Khởi tạo sau khi DOM load
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => BatchLearning.initialize());
}
