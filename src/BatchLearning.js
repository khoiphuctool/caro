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
        winRateThreshold: 0.40,       // cần thắng > 40% mới chấp nhận model mới (giảm mạnh để học nhanh hơn)
        evaluationGames: 50,          // giảm xuống 50 ván để đánh giá nhanh hơn
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

        // Tính win rate trong batch để tracking Elo
        const total = this.batchStats.wins + this.batchStats.losses + this.batchStats.draws;
        const winRate = total > 0 ? this.batchStats.wins / total : 0.5;

        console.log(`[BatchLearning] Batch WinRate: ${(winRate * 100).toFixed(1)}%`,
                    `Wins: ${this.batchStats.wins}, Losses: ${this.batchStats.losses}`);

        // BatchLearning chỉ tracking Elo — không đụng vào botMemory
        // botMemory được quản lý hoàn toàn bởi hoc-kinh-nghiem.js (rememberLoss/rememberWinPattern)
        this.elo.best = Math.max(this.elo.best, this.elo.current);

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
        // Evaluation phase đã bị loại bỏ — BatchLearning chỉ tracking Elo
        this.evaluation.active = false;
    },

    // ===== CHẤP NHẬN MODEL MỚI =====
    _acceptNewModel(newMemory, newElo) {
        // Không dùng nữa — botMemory do hoc-kinh-nghiem.js quản lý
        this.elo.best = Math.max(this.elo.best, newElo);
        if (typeof saveBotMemory === 'function') saveBotMemory();
        console.log(`[BatchLearning] Elo updated: ${newElo}`);
    },

    // ===== ROLLBACK VỀ BEST MODEL =====
    _rollbackToBestModel() {
        // Không rollback botMemory nữa — tránh xung đột với hoc-kinh-nghiem.js
        // Chỉ reset Elo về best
        this.elo.current = this.elo.best;
        console.log('[BatchLearning] Elo reset to best:', this.elo.best);
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
