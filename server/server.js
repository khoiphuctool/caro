const express = require('express');
const fs      = require('fs');
const path    = require('path');
const cors    = require('cors');

const app  = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..'))); // serve ox-v8.html

// ===== Đọc/ghi data =====
function readData() {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            const init = { rank: {}, history: [] };
            fs.writeFileSync(DATA_FILE, JSON.stringify(init, null, 2));
            return init;
        }
        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch(e) {
        console.error('Lỗi đọc data:', e);
        return { rank: {}, history: [] };
    }
}
function writeData(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch(e) {
        console.error('Lỗi ghi data:', e);
    }
}

// ===== API BẢNG XẾP HẠNG =====

// GET /api/rank — lấy toàn bộ rank
app.get('/api/rank', (req, res) => {
    const { rank } = readData();
    res.json(rank);
});

// POST /api/rank — thêm entry mới
// body: { key, name, moves, date }
app.post('/api/rank', (req, res) => {
    const { key, name, moves, date } = req.body;
    if (!key || !name || moves == null) return res.status(400).json({ error: 'Thiếu dữ liệu' });

    const data = readData();
    if (!data.rank[key]) data.rank[key] = [];

    data.rank[key].push({ name: String(name).slice(0, 20), moves: Number(moves), date: String(date || '') });
    data.rank[key].sort((a, b) => a.moves - b.moves);
    data.rank[key] = data.rank[key].slice(0, 20);

    writeData(data);
    res.json({ ok: true, entries: data.rank[key] });
});

// DELETE /api/rank — xóa toàn bộ rank
app.delete('/api/rank', (req, res) => {
    const data = readData();
    data.rank = {};
    writeData(data);
    res.json({ ok: true });
});

// ===== API LỊCH SỬ =====

// GET /api/history — lấy lịch sử (tối đa 200 ván gần nhất)
app.get('/api/history', (req, res) => {
    const { history } = readData();
    res.json(history.slice(0, 200));
});

// POST /api/history — thêm ván mới
// body: { result, winner, mode, modeLabel, winCount, boardLabel, moves, humanPiece, botPiece, time }
app.post('/api/history', (req, res) => {
    const entry = req.body;
    if (!entry || !entry.result) return res.status(400).json({ error: 'Thiếu dữ liệu' });

    const data = readData();
    data.history.unshift({
        result:     String(entry.result),
        winner:     entry.winner ? String(entry.winner) : null,
        mode:       String(entry.mode || ''),
        modeLabel:  String(entry.modeLabel || ''),
        winCount:   Number(entry.winCount || 5),
        boardLabel: String(entry.boardLabel || ''),
        moves:      Number(entry.moves || 0),
        humanPiece: entry.humanPiece ? String(entry.humanPiece) : null,
        botPiece:   entry.botPiece   ? String(entry.botPiece)   : null,
        time:       entry.time ? String(entry.time) : new Date().toISOString()
    });
    data.history = data.history.slice(0, 500); // giữ 500 ván gần nhất
    writeData(data);
    res.json({ ok: true });
});

// DELETE /api/history — xóa lịch sử
app.delete('/api/history', (req, res) => {
    const data = readData();
    data.history = [];
    writeData(data);
    res.json({ ok: true });
});

// GET /api/history/wins — chỉ lấy các ván thắng (người thắng bot)
app.get('/api/history/wins', (req, res) => {
    const { history } = readData();
    const wins = history
        .filter(h => h.result === 'win' && h.mode && h.mode !== 'solo')
        .slice(0, 100);
    res.json(wins);
});

app.listen(PORT, () => {
    console.log(`Server chạy tại http://localhost:${PORT}`);
});
