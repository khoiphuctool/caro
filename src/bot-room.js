// ══════════════════════════════════════════════════════════════════
// BOT ROOM MANAGER - Quản lý phòng Bot Offline
// ══════════════════════════════════════════════════════════════════

const BOT_PROFILE_SEED = {
    'ai-easy': {
        id: 'ai-easy',
        name: 'Bot Dễ',
        avatar: '🟢',
        difficulty: 'easy',
        level: 12,
        elo: 1200,
        rank: 80,
        title: 'Tốc độ',
        wins: 820,
        losses: 180,
        draws: 24,
        winRate: 78,
        thinkingSpeed: 'Chậm',
        openingBook: 'An toàn',
        style: 'Khai cuộc ổn định',
        description: 'Dành cho người mới',
        isBot: true,
    },
    'ai-medium': {
        id: 'ai-medium',
        name: 'Bot Trung Bình',
        avatar: '🟡',
        difficulty: 'medium',
        level: 24,
        elo: 1450,
        rank: 40,
        title: 'Luyện phản xạ',
        wins: 1984,
        losses: 612,
        draws: 58,
        winRate: 76,
        thinkingSpeed: 'Trung bình',
        openingBook: 'Khá linh hoạt',
        style: 'Phòng thủ – phản công',
        description: 'Luyện phản xạ',
        isBot: true,
    },
    'ai-hard': {
        id: 'ai-hard',
        name: 'Bot Khó',
        avatar: '🟠',
        difficulty: 'hard',
        level: 36,
        elo: 1750,
        rank: 15,
        title: 'Thử thách thật sự',
        wins: 3184,
        losses: 864,
        draws: 76,
        winRate: 78,
        thinkingSpeed: 'Nhanh',
        openingBook: 'Mở nhiều biến',
        style: 'Tấn công gọn',
        description: 'Thử thách thật sự',
        isBot: true,
    },
    'bot-toi-thuong': {
        id: 'bot-toi-thuong',
        name: 'Bot Tối Thượng',
        avatar: '💀',
        difficulty: 'god',
        level: 50,
        elo: 2200,
        rank: 1,
        title: 'BHX #1',
        wins: 9684,
        losses: 316,
        draws: 42,
        winRate: 96,
        thinkingSpeed: 'Rất nhanh',
        openingBook: 'Cao cấp',
        style: 'Tối ưu chiến thuật',
        description: 'Cấp Tinh Anh',
        isBot: true,
    },
    'bot-tia-chop': {
        id: 'bot-tia-chop',
        name: 'Bot Tia Chớp',
        avatar: '⚡',
        difficulty: 'speed',
        level: 42,
        elo: 2050,
        rank: 3,
        title: 'Tốc độ siêu nhanh',
        wins: 5984,
        losses: 968,
        draws: 64,
        winRate: 85,
        thinkingSpeed: 'Siêu nhanh',
        openingBook: 'Bắn tốc độ',
        style: 'Lập tức tấn công',
        description: 'Tốc độ siêu nhanh',
        isBot: true,
    },
    'bot-super': {
        id: 'bot-super',
        name: 'Bot Siêu Phẩm',
        avatar: '🌟',
        difficulty: 'super',
        level: 48,
        elo: 2800,
        rank: 2,
        title: 'BHX #2',
        wins: 8024,
        losses: 482,
        draws: 52,
        winRate: 93,
        thinkingSpeed: 'Tối ưu',
        openingBook: 'Đa dạng',
        style: 'Biến đổi chiến thuật',
        description: 'Thách thức đặc biệt (mở theo nhiệm vụ)',
        isBot: true,
    },
};

const PlayerCard = {
    normalizeProfile(profile = {}) {
        const rawWin = Number(profile.wins ?? profile.win ?? profile.totalWins ?? 0);
        const rawLose = Number(profile.losses ?? profile.lose ?? profile.totalLosses ?? 0);
        const rawDraw = Number(profile.draws ?? profile.draw ?? profile.totalDraws ?? 0);
        const totalGames = rawWin + rawLose + rawDraw;
        const derivedWinRate = totalGames > 0 ? Math.round((rawWin / totalGames) * 100) : null;
        const providedWinRate = profile.winRate ?? profile.winRatePct ?? profile.winrate;
        const displayWinRate = providedWinRate === null || providedWinRate === undefined || providedWinRate === '' || providedWinRate === '—'
            ? derivedWinRate
            : providedWinRate;
        const parsedWinRate = typeof displayWinRate === 'number'
            ? displayWinRate
            : (typeof displayWinRate === 'string'
                ? Number(String(displayWinRate).replace(/%/g, '').trim())
                : NaN);

        const eloValue = profile.elo ?? profile.eloRating ?? profile.rating ?? profile.eloScore ?? '—';
        const levelValue = profile.level ?? profile.rankLevel ?? '—';
        const titleValue = profile.title || profile.rank || profile.bhx || profile.difficulty || (profile.isBot ? 'Bot AI' : 'Người chơi');
        const hasAnyProfileStats = [eloValue, levelValue, providedWinRate, rawWin, rawLose, rawDraw].some(value => {
            if (value === undefined || value === null || value === '' || value === '—') return false;
            return true;
        });

        return {
            id: profile.id ?? profile.name ?? 'player',
            name: profile.name || '—',
            avatar: profile.avatar || (profile.isBot ? '🤖' : '🧑'),
            level: levelValue,
            elo: eloValue,
            win: rawWin,
            lose: rawLose,
            draw: rawDraw,
            winRate: Number.isFinite(parsedWinRate) ? Math.max(0, Math.min(100, parsedWinRate)) : null,
            coin: profile.coin ?? 0,
            title: titleValue,
            status: profile.status || (profile.isBot ? 'Đang tính nước đi' : 'Đang suy nghĩ'),
            isBot: !!profile.isBot,
            difficulty: profile.difficulty || '—',
            hasStats: hasAnyProfileStats,
        };
    },

    valueOrDash(value, fallback = '—') {
        if (value === null || value === undefined || value === '') return fallback;
        return value;
    },

    winRateBarColor(percent) {
        if (percent >= 95) return '#f59e0b';
        if (percent >= 80) return '#8b5cf6';
        if (percent >= 60) return '#3b82f6';
        return '#10b981';
    },

    render(profile = {}, options = {}) {
        const p = this.normalizeProfile(profile);
        const badge = this.valueOrDash(options.badge || (p.isBot ? 'Bot' : 'Human'), 'Human');
        const status = this.valueOrDash(options.status || p.status, '—');
        const avatar = this.valueOrDash(p.avatar, '—');
        const level = this.valueOrDash(p.level, '—');
        const elo = this.valueOrDash(p.elo, '—');
        const winRate = Number.isFinite(p.winRate) ? Math.max(0, Math.min(100, p.winRate)) : null;
        const title = this.valueOrDash(p.title, '—');
        const statusTone = status && status.toLowerCase().includes('đang đánh') ? '#f59e0b' : '#10b981';
        const normalizedName = this.valueOrDash(p.name, '—');
        const hasStats = !!p.hasStats && Number.isFinite(winRate) && Number.isFinite(Number(p.elo)) && Number.isFinite(Number(p.level));
        const statMarkup = hasStats ? `
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 10px;font-size:12px;color:#e2e8f0;min-width:0;">
                        <div style="min-width:0;"><strong style="color:#fff;">🏆 Elo</strong> <span style="display:inline-block;min-width:0;">${elo}</span></div>
                        <div style="min-width:0;"><strong style="color:#fff;">📈 Win</strong> <span style="display:inline-block;min-width:0;">${winRate}%</span></div>
                    </div>

                    <div style="display:flex;align-items:center;gap:8px;min-width:0;">
                        <div style="flex:1;height:10px;border-radius:999px;background:rgba(255,255,255,.14);overflow:hidden;border:1px solid rgba(255,255,255,.15);min-width:0;">
                            <div style="width:${winRate}%;height:100%;background:linear-gradient(90deg,${this.winRateBarColor(winRate)},rgba(255,255,255,.92));border-radius:999px;"></div>
                        </div>
                        <span style="font-size:11px;color:#f8fafc;font-weight:700;white-space:nowrap;">${winRate}%</span>
                    </div>
        ` : '';

        return `
            <div class="player-card-shell" style="display:grid;grid-template-columns:82px minmax(0,1fr);align-items:start;gap:12px;min-width:0;width:100%;max-width:100%;padding:10px 12px;border-radius:16px;background:linear-gradient(135deg,rgba(79,70,229,.22),rgba(99,102,241,.09));border:1px solid rgba(255,255,255,.18);backdrop-filter:blur(8px);box-sizing:border-box;">
                <div class="player-card-avatar" style="width:82px;height:82px;border-radius:18px;display:grid;place-items:center;background:linear-gradient(135deg,rgba(56,189,248,.35),rgba(167,139,250,.4));border:2px solid rgba(255,255,255,.45);font-size:30px;flex-shrink:0;box-shadow:0 8px 20px rgba(0,0,0,.18);">${avatar}</div>

                <div class="player-card-body" style="min-width:0;display:flex;flex-direction:column;gap:6px;">
                    <div class="player-card-name" style="font-weight:800;color:#fff;font-size:15px;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;">${normalizedName}</div>

                    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-width:0;">
                        <span style="font-size:10px;padding:3px 8px;border-radius:999px;background:rgba(255,255,255,.14);color:#e5e7eb;white-space:nowrap;">${badge}</span>
                        <span style="font-size:11px;color:#dbeafe;white-space:nowrap;">Lv.${level}</span>
                    </div>

                    <div style="font-size:12px;color:#fef08a;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;">${title}</div>

                    ${statMarkup}

                    <div style="padding:6px 10px;border-radius:10px;background:rgba(15,23,42,.45);color:${statusTone};font-size:11px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border:1px solid rgba(255,255,255,.1);">${status}</div>
                </div>
            </div>
        `;
    },

    hydrate(target, profile = {}, options = {}) {
        const el = typeof target === 'string' ? document.querySelector(target) : target;
        if (!el) return;
        el.innerHTML = this.render(profile, options);
    }
};

const UIStateManager = {
    currentMode: 'HOME',
    apply(mode) {
        this.currentMode = mode;
        const appHeader = document.getElementById('app-header');
        const botView = document.getElementById('view-bot-room');
        const roomView = document.getElementById('view-room');

        if (mode === 'BOT_VS_BOT') {
            if (appHeader) appHeader.style.display = 'none';
            if (typeof hideTopNavigation === 'function') hideTopNavigation();
            if (botView) botView.classList.add('active');
            if (roomView) roomView.classList.remove('active');
            return;
        }

        if (appHeader) appHeader.style.display = '';
        if (typeof showTopNavigation === 'function') showTopNavigation();
    }
};

window.UIStateManager = UIStateManager;

const BotRoomManager = {
    BOT_ROOMS: [
        { id: 1, name: 'Bot Dễ',        emoji: '🟢', color: '#10b981', gameMode: 'ai-easy',        description: 'Dành cho người mới' },
        { id: 2, name: 'Bot Trung Bình', emoji: '🟡', color: '#f59e0b', gameMode: 'ai-medium',      description: 'Luyện phản xạ' },
        { id: 3, name: 'Bot Khó',        emoji: '🟠', color: '#f97316', gameMode: 'ai-hard',        description: 'Thử thách thật sự' },
        { id: 4, name: 'Bot Tối Thượng', emoji: '💀', color: '#ef4444', gameMode: 'bot-toi-thuong', description: 'Cấp Tinh Anh' },
        { id: 5, name: 'Bot Tia Chớp',  emoji: '⚡', color: '#3b82f6', gameMode: 'bot-tia-chop',   description: 'Tốc độ siêu nhanh' },
        { id: 6, name: 'Bot Siêu Phàm',  emoji: '🌟', color: '#8b5cf6', gameMode: 'bot-super',       description: 'Thách thức đặc biệt (mở theo nhiệm vụ)' },
        { id: 7, name: 'Bot vs Bot',     emoji: '🤖', color: '#8b5cf6', gameMode: 'bot-vs-bot',      description: 'Chọn 2 bot cho X/O, trận đấu tự động' },
        { id: 8, name: 'Auto Bot',       emoji: '⚔️', color: '#ec4899', gameMode: 'auto-bot',        description: 'Mô phỏng nhiều trận giữa 2 bot tự động' },
        { id: 9, name: 'Sắp ra mắt',    emoji: '🔒', color: '#94a3b8', gameMode: null,             description: 'Mở khóa theo nhiệm vụ' }
    ],

    resolveBotMetaByMode: function(gameMode) {
        const roomMeta = this.BOT_ROOMS.find(room => room.gameMode === gameMode) || {
            id: -1,
            name: gameMode || 'Bot',
            emoji: '🤖',
            color: '#6366f1',
            gameMode,
            description: 'Bot tùy chọn'
        };

        const profileSeed = BOT_PROFILE_SEED[gameMode] || {};
        return {
            ...roomMeta,
            ...profileSeed,
            id: profileSeed.id || roomMeta.id,
            name: profileSeed.name || roomMeta.name,
            avatar: profileSeed.avatar || roomMeta.emoji,
            description: profileSeed.description || roomMeta.description,
            difficulty: profileSeed.difficulty || roomMeta.description,
            gameMode,
        };
    },

    currentBotRoom: null,
    isBotRoomMode:  false,
    botVsBotState:  null,
    isBotVsBotMode: false,
    // ══ Thống kê Bot vs Bot ══════════════════════════════════════════════════════════════════
    botVsBotStats: null,

    // ══ Auto Bot State ══════════════════════════════════════════════════════════════════
    autoBotState: null,
    autoBotStats: null,
    autoBotInterval: null,

    // ══ Hiển thị thống kê Bot vs Bot ══════════════════════════════════════════════════════════════════
    displayBotVsBotStats: function() {
        if (!this.botVsBotStats) return;
        
        const state = this.botVsBotState;
        if (!state) return;
        
        const statsKey = `${state.botXMode}_vs_${state.botOMode}`;
        const stats = this.botVsBotStats[statsKey];
        
        if (!stats) return;
        
        // Tính tỷ lệ thắng
        const winRateX = stats.totalMatches > 0 ? ((stats.winsX / stats.totalMatches) * 100).toFixed(1) : 0;
        const winRateO = stats.totalMatches > 0 ? ((stats.winsO / stats.totalMatches) * 100).toFixed(1) : 0;
        const drawRate = stats.totalMatches > 0 ? ((stats.draws / stats.totalMatches) * 100).toFixed(1) : 0;
        
        console.log(`[BotVsBot] ${stats.botXLabel} vs ${stats.botOLabel}:`);
        console.log(`  Tổng trận: ${stats.totalMatches}`);
        console.log(`  ${stats.botXLabel} thắng: ${stats.winsX} (${winRateX}%)`);
        console.log(`  ${stats.botOLabel} thắng: ${stats.winsO} (${winRateO}%)`);
        console.log(`  Hòa: ${stats.draws} (${drawRate}%)`);
        
        // Hiển thị UI thống kê (nếu có container)
        const statsContainer = document.getElementById('bot-vs-bot-stats');
        if (statsContainer) {
            statsContainer.innerHTML = `
                <div style="background:#f8fafc;border-radius:8px;padding:12px;margin-top:12px;font-size:13px;">
                    <div style="font-weight:bold;margin-bottom:8px;color:#64748b;">📊 Thống kê Bot vs Bot</div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                        <div style="background:#e0f2fe;padding:8px;border-radius:6px;">
                            <div style="font-weight:bold;color:#0284c7;">${stats.botXLabel}</div>
                            <div style="color:#0369a1;">Thắng: ${stats.winsX} (${winRateX}%)</div>
                        </div>
                        <div style="background:#fce7f3;padding:8px;border-radius:6px;">
                            <div style="font-weight:bold;color:#be185d;">${stats.botOLabel}</div>
                            <div style="color:#9d174d;">Thắng: ${stats.winsO} (${winRateO}%)</div>
                        </div>
                    </div>
                    <div style="margin-top:8px;color:#64748b;">
                        Tổng: ${stats.totalMatches} trận | Hòa: ${stats.draws} (${drawRate}%)
                    </div>
                </div>
            `;
        }
    },

    // ══ Danh sách phòng bot trong lobby ══════════════════════════
    openBotLobby: function() {
        const container = document.getElementById('room-list');
        if (!container) return;
        container.innerHTML = '';

        this.BOT_ROOMS.forEach(room => {
            const el = document.createElement('div');
            if (!room.gameMode) {
                // Phòng khóa
                el.style.cssText = 'padding:12px;margin:8px 0;border:1px dashed #cbd5e1;border-radius:8px;background:#f8fafc;display:flex;justify-content:space-between;align-items:center;opacity:0.6;';
                el.innerHTML = `
                    <div>
                        <div style="font-weight:bold;font-size:14px;color:#64748b;">${room.emoji} ${room.name}</div>
                        <div style="font-size:12px;color:#94a3b8;margin-top:2px;">${room.description}</div>
                    </div>
                    <span style="font-size:12px;color:#94a3b8;">🔒</span>
                `;
            } else {
                el.style.cssText = `padding:12px;margin:8px 0;border:2px solid ${room.color};border-radius:8px;background:linear-gradient(135deg,#f0fdf4 0%,#dcfce7 100%);display:flex;justify-content:space-between;align-items:center;cursor:pointer;transition:all 0.2s;`;
                el.onmouseover = function() { this.style.transform = 'scale(1.02)'; };
                el.onmouseout  = function() { this.style.transform = 'scale(1)'; };
                el.onclick = () => this.enterBotRoom(room);
                el.innerHTML = `
                    <div>
                        <div style="font-weight:bold;font-size:14px;color:${room.color};">${room.emoji} ${room.name}</div>
                        <div style="font-size:12px;color:#555;margin-top:2px;">${room.description}</div>
                    </div>
                    <button style="padding:6px 14px;background:${room.color};color:white;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">Thách đấu</button>
                `;
            }
            container.appendChild(el);
        });
    },

    // ══ Vào màn hình chờ phòng ═══════════════════════════════════
    enterBotRoom: function(botConfig) {
        this.currentBotRoom = botConfig;
        this.isBotRoomMode  = true;

        // YC.TXT FIX: DISABLED - Do NOT save BOT mode to GameModeManager
        // BOT mode restore is disabled to prevent "Phòng Ma" and mode conflicts
        // if (typeof GameModeManager !== 'undefined') {
        //     GameModeManager.setMode(GameModes.BOT_ROOM, { botConfig: botConfig });
        // }

        // Chuyển view-room, dùng classList trực tiếp (không qua switchView
        // để tránh các hook online như moveBoardToBattle chạy sớm)
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        const vr = document.getElementById('view-room');
        if (vr) vr.classList.add('active');

        this.renderBotRoomView(botConfig);
    },

    // ══ Màn hình phòng: hiện cài đặt, người dùng tự bấm Bắt Đầu ═
    renderBotRoomView: function(botConfig) {
        const roomLayout = document.querySelector('.room-layout');
        if (!roomLayout) return;

        const username = localStorage.getItem('current_username') || 'Bạn';
        const botOptions = this.BOT_ROOMS
            .filter(r => r.gameMode && r.gameMode !== 'bot-vs-bot')
            .map(r => `<option value="${r.gameMode}">${r.emoji} ${r.name}</option>`)
            .join('');

        if (botConfig.gameMode === 'bot-vs-bot') {
            roomLayout.innerHTML = `
            <div class="room-header-card" style="background:linear-gradient(135deg,#6366f1 0%,#4f46e5 100%);">
                <div class="room-header-title">🤖 Phòng ${botConfig.name}</div>
                <button class="btn-leave-room" onclick="BotRoomManager.exitBotRoom()">← Thoát phòng</button>
            </div>

            <div class="versus-row">
                <div class="player-slot-card">
                    <div class="avatar-circle-lg player-x">X</div>
                    <div class="player-name">Bot X</div>
                    <div class="pc-info"><span class="badge badge-green">Bot</span></div>
                </div>
                <div class="vs-badge">VS</div>
                <div class="player-slot-card">
                    <div class="avatar-circle-lg player-o"
                         style="background:#eef2ff;border-color:#6366f1;color:#4338ca;font-size:26px;">O</div>
                    <div class="player-name">Bot O</div>
                    <div class="pc-info">
                        <span class="badge" style="background:#6366f1;color:white;">Bot</span>
                    </div>
                </div>
            </div>

            <!-- Cài đặt Bot Đấu Bot -->
            <div class="card" style="background:#eef2ff;border:1px solid #6366f1;">
                <div class="card-body" style="padding:16px;">
                    <div style="font-weight:700;color:#312e81;margin-bottom:12px;">⚙️ Cài đặt đối đầu</div>
                    <div style="display:flex;flex-wrap:wrap;gap:16px;align-items:center;">
                        <label style="display:flex;flex-direction:column;gap:6px;font-size:14px;flex:1;min-width:200px;">
                            <span>Bot X (đi trước)</span>
                            <select id="bot-vs-bot-x-mode"
                                    style="padding:8px;border-radius:8px;border:1px solid #c7d2fe;background:#fff;font-size:14px;">
                                ${botOptions}
                            </select>
                        </label>
                        <label style="display:flex;flex-direction:column;gap:6px;font-size:14px;flex:1;min-width:200px;">
                            <span>Bot O (đi sau)</span>
                            <select id="bot-vs-bot-o-mode"
                                    style="padding:8px;border-radius:8px;border:1px solid #c7d2fe;background:#fff;font-size:14px;">
                                ${botOptions}
                            </select>
                        </label>
                        <label style="display:flex;flex-direction:column;gap:6px;font-size:14px;flex:1;min-width:200px;">
                            <span>Số quân thắng</span>
                            <select id="bot-vs-bot-win-count"
                                    style="padding:8px;border-radius:8px;border:1px solid #c7d2fe;background:#fff;font-size:14px;">
                                <option value="3">3 quân</option>
                                <option value="4">4 quân</option>
                                <option value="5" selected>5 quân</option>
                                <option value="6">6 quân</option>
                                <option value="7">7 quân</option>
                            </select>
                        </label>
                    </div>
                    <label style="display:flex;align-items:center;gap:8px;margin-top:12px;font-size:14px;cursor:pointer;">
                        <input type="checkbox" id="bot-vs-bot-block-both" checked
                               style="width:16px;height:16px;accent-color:#6366f1;">
                        🛡️ Chặn 2 đầu
                    </label>
                </div>
            </div>

            <!-- Container thống kê -->
            <div id="bot-vs-bot-stats"></div>

            <button id="btn-bot-start"
                    onclick="BotRoomManager.startBotBattle()"
                    style="padding:16px;background:#6366f1;color:white;border:none;border-radius:8px;font-size:18px;font-weight:bold;cursor:pointer;width:100%;transition:all 0.2s;"
                    onmouseover="this.style.background='#4f46e5'"
                    onmouseout="this.style.background='#6366f1'">
                ⚔️ Bắt Đầu Bot vs Bot
            </button>
        `;
            return;
        }

        if (botConfig.gameMode === 'auto-bot') {
            // Load stats từ localStorage
            const savedStats = localStorage.getItem('autoBotStats');
            if (savedStats) {
                try {
                    this.autoBotStats = JSON.parse(savedStats);
                } catch (e) {
                    console.error('[AutoBot] Failed to load stats from localStorage:', e);
                    this.autoBotStats = null;
                }
            }

            roomLayout.innerHTML = `
            <div class="room-header-card" style="background:linear-gradient(135deg,#ec4899 0%,#db2777 100%);">
                <div class="room-header-title">🔄 Phòng ${botConfig.name}</div>
                <button class="btn-leave-room" onclick="BotRoomManager.exitBotRoom()">← Thoát phòng</button>
            </div>

            <!-- Container thống kê Auto Bot -->
            <div id="auto-bot-stats-container"></div>

            <!-- Cài đặt Auto Bot -->
            <div class="card" style="background:#fce7f3;border:1px solid #ec4899;">
                <div class="card-body" style="padding:16px;">
                    <div style="font-weight:700;color:#831843;margin-bottom:12px;">⚙️ Cài đặt Auto Bot</div>
                    <div style="display:flex;flex-wrap:wrap;gap:16px;align-items:center;">
                        <label style="display:flex;flex-direction:column;gap:6px;font-size:14px;flex:1;min-width:200px;">
                            <span>Bot X</span>
                            <select id="auto-bot-x-mode"
                                    style="padding:8px;border-radius:8px;border:1px solid #fbcfe8;background:#fff;font-size:14px;">
                                ${botOptions}
                            </select>
                        </label>
                        <label style="display:flex;flex-direction:column;gap:6px;font-size:14px;flex:1;min-width:200px;">
                            <span>Bot O</span>
                            <select id="auto-bot-o-mode"
                                    style="padding:8px;border-radius:8px;border:1px solid #fbcfe8;background:#fff;font-size:14px;">
                                ${botOptions}
                            </select>
                        </label>
                        <label style="display:flex;flex-direction:column;gap:6px;font-size:14px;flex:1;min-width:150px;">
                            <span>Đi trước</span>
                            <select id="auto-bot-first-move"
                                    style="padding:8px;border-radius:8px;border:1px solid #fbcfe8;background:#fff;font-size:14px;">
                                <option value="X" selected>X (Bot X)</option>
                                <option value="O">O (Bot O)</option>
                            </select>
                        </label>
                        <label style="display:flex;flex-direction:column;gap:6px;font-size:14px;flex:1;min-width:150px;">
                            <span>Số trận</span>
                            <input type="number" id="auto-bot-games" value="100" min="1" max="10000"
                                   style="padding:8px;border-radius:8px;border:1px solid #fbcfe8;background:#fff;font-size:14px;">
                        </label>
                        <label style="display:flex;flex-direction:column;gap:6px;font-size:14px;flex:1;min-width:150px;">
                            <span>Số quân thắng</span>
                            <select id="auto-bot-win-count"
                                    style="padding:8px;border-radius:8px;border:1px solid #fbcfe8;background:#fff;font-size:14px;">
                                <option value="3">3 quân</option>
                                <option value="4">4 quân</option>
                                <option value="5" selected>5 quân</option>
                                <option value="6">6 quân</option>
                                <option value="7">7 quân</option>
                            </select>
                        </label>
                    </div>
                    <label style="display:flex;align-items:center;gap:8px;margin-top:12px;font-size:14px;cursor:pointer;">
                        <input type="checkbox" id="auto-bot-block-both" checked
                               style="width:16px;height:16px;accent-color:#ec4899;">
                        🛡️ Chặn 2 đầu
                    </label>
                </div>
            </div>

            <!-- Nút điều khiển -->
            <div style="display:flex;gap:10px;">
                <button id="btn-auto-bot-start"
                        onclick="BotRoomManager.startAutoBot()"
                        style="flex:1;padding:14px;background:#ec4899;color:white;border:none;border-radius:8px;font-size:16px;font-weight:bold;cursor:pointer;transition:all 0.2s;"
                        onmouseover="this.style.background='#db2777'"
                        onmouseout="this.style.background='#ec4899'">
                    ▶️ Bắt Đầu
                </button>
                <button id="btn-auto-bot-stop"
                        onclick="BotRoomManager.stopAutoBot()"
                        style="flex:1;padding:14px;background:#ef4444;color:white;border:none;border-radius:8px;font-size:16px;font-weight:bold;cursor:pointer;transition:all 0.2s;"
                        onmouseover="this.style.background='#dc2626'"
                        onmouseout="this.style.background='#ef4444'"
                        disabled>
                    ⏸️ Dừng
                </button>
                <button id="btn-auto-bot-resume"
                        onclick="BotRoomManager.resumeAutoBot()"
                        style="flex:1;padding:14px;background:#f59e0b;color:white;border:none;border-radius:8px;font-size:16px;font-weight:bold;cursor:pointer;transition:all 0.2s;"
                        onmouseover="this.style.background='#d97706'"
                        onmouseout="this.style.background='#f59e0b'"
                        disabled>
                    ▶️ Tiếp tục
                </button>
                <button id="btn-auto-bot-clear"
                        onclick="BotRoomManager.clearAutoBotStats()"
                        style="flex:1;padding:14px;background:#6b7280;color:white;border:none;border-radius:8px;font-size:16px;font-weight:bold;cursor:pointer;transition:all 0.2s;"
                        onmouseover="this.style.background='#4b5563'"
                        onmouseout="this.style.background='#6b7280'">
                    🗑️ Xóa kết quả
                </button>
            </div>

            <!-- Bảng xếp hạng Bot vs Bot -->
            <div id="auto-bot-leaderboard-container" style="margin-top:16px;"></div>
        `;
            
            // Render bảng xếp hạng ngay khi vào phòng
            setTimeout(() => this.renderAutoBotLeaderboard(), 100);
            return;
        }

        roomLayout.innerHTML = `
            <div class="room-header-card" style="background:linear-gradient(135deg,#10b981 0%,#059669 100%);">
                <div class="room-header-title">🤖 Phòng ${botConfig.name}</div>
                <button class="btn-leave-room" onclick="BotRoomManager.exitBotRoom()">← Thoát phòng</button>
            </div>

            <div class="versus-row">
                <div class="player-slot-card">
                    <div class="avatar-circle-lg player-x">X</div>
                    <div class="player-name">${username}</div>
                    <div class="pc-info"><span class="badge badge-green">Người chơi</span></div>
                </div>
                <div class="vs-badge">VS</div>
                <div class="player-slot-card">
                    <div class="avatar-circle-lg player-o"
                         style="background:#fef3c7;border-color:#f59e0b;color:#d97706;font-size:26px;">🤖</div>
                    <div class="player-name">${botConfig.name}</div>
                    <div class="pc-info">
                        <span class="badge" style="background:#ef4444;color:white;">BOT AI</span>
                    </div>
                </div>
            </div>

            <!-- Cài đặt luật — người dùng tự chọn -->
            <div class="card" style="background:#f0fdf4;border:1px solid #10b981;">
                <div class="card-body" style="padding:16px;">
                    <div style="font-weight:700;color:#065f46;margin-bottom:12px;">⚙️ Cài đặt ván đấu</div>
                    <div style="display:flex;flex-wrap:wrap;gap:16px;align-items:center;">

                        <label style="display:flex;align-items:center;gap:8px;font-size:14px;">
                            🎯 Số quân thắng:
                            <select id="bot-room-win-count"
                                    style="padding:4px 8px;border-radius:6px;border:1px solid #a7f3d0;background:#fff;font-size:14px;">
                                <option value="3">3 quân</option>
                                <option value="4">4 quân</option>
                                <option value="5" selected>5 quân</option>
                                <option value="6">6 quân</option>
                                <option value="7">7 quân</option>
                            </select>
                        </label>

                        <label style="display:flex;align-items:center;gap:8px;font-size:14px;cursor:pointer;">
                            <input type="checkbox" id="bot-room-block-both" checked
                                   style="width:16px;height:16px;accent-color:#10b981;">
                            🛡️ Chặn 2 đầu
                        </label>

                        <label style="display:flex;align-items:center;gap:8px;font-size:14px;cursor:pointer;">
                            <input type="checkbox" id="position-editor-checkbox"
                                   onchange="BotRoomManager.togglePositionEditorMode()"
                                   style="width:16px;height:16px;accent-color:#8b5cf6;">
                            🎨 Tạo thế cờ
                        </label>

                        <label style="display:flex;align-items:center;gap:8px;font-size:14px;">
                            ⚡ Đi trước:
                            <select id="bot-room-first-move"
                                    style="padding:4px 8px;border-radius:6px;border:1px solid #a7f3d0;background:#fff;font-size:14px;">
                                <option value="X" selected>Bạn (X)</option>
                                <option value="O">Bot (O)</option>
                            </select>
                        </label>
                    </div>
                    <div style="margin-top:10px;color:#64748b;font-size:12px;">
                        🎮 Chế độ luyện tập · Không cược Xu
                    </div>
                </div>
            </div>

            <!-- Nút Bắt đầu: người dùng tự bấm, KHÔNG tự động đếm ngược -->
            <button id="btn-bot-start"
                    onclick="BotRoomManager.startBotBattle()"
                    style="padding:16px;background:#10b981;color:white;border:none;border-radius:8px;font-size:18px;font-weight:bold;cursor:pointer;width:100%;transition:all 0.2s;"
                    onmouseover="this.style.background='#059669'"
                    onmouseout="this.style.background='#10b981'">
                ⚔️ Bắt Đầu Đấu!
            </button>

            <!-- Nút Bắt đầu dựng (ẩn mặc định) -->
            <button id="btn-start-editor"
                    onclick="BotRoomManager.startPositionEditor()"
                    style="padding:16px;background:#8b5cf6;color:white;border:none;border-radius:8px;font-size:18px;font-weight:bold;cursor:pointer;width:100%;transition:all 0.2s;display:none;"
                    onmouseover="this.style.background='#7c3aed'"
                    onmouseout="this.style.background='#8b5cf6'">
                🎨 Bắt đầu dựng
            </button>
        `;
    },

    // ══ Chuyển sang bot room view và khởi game (YC.TXT Board First) ═════════════════════
    startBotBattle: function() {
        if (!this.currentBotRoom) return;

        // Đọc cài đặt người dùng đã chọn
        const wcEl = document.getElementById('bot-room-win-count');
        const bbEl = document.getElementById('bot-room-block-both');
        const fmEl = document.getElementById('bot-room-first-move');
        const wc   = wcEl ? wcEl.value   : '5';
        const bb   = bbEl ? bbEl.checked : true;
        const fm   = fmEl ? fmEl.value   : 'X';

        window.isBotRoomMode    = true;
        window.currentBotConfig = this.currentBotRoom;

        // Sync bot room rules into GameState.roomRules so AI uses the correct rules
        try {
            const parsedWc = parseInt(wc, 10);
            const rules = { winCount: isNaN(parsedWc) ? undefined : parsedWc, chan2Dau: !!bb, firstTurn: fm };
            if (typeof GameState !== 'undefined') {
                GameState.roomRules = rules;
                if (!GameState.board) GameState.board = {};
                if (typeof rules.winCount === 'number') GameState.board.winCount = rules.winCount;
            }
            window.roomRules = rules;
        } catch (e) { console.warn('[BotRoom] failed to sync roomRules to GameState', e); }

        // Áp cài đặt vào engine
        const modeEl = document.getElementById('game-mode');
        if (modeEl) {
            if (this.currentBotRoom.gameMode === 'bot-vs-bot') {
                const wxEl = document.getElementById('bot-vs-bot-x-mode');
                modeEl.value = wxEl && wxEl.value ? wxEl.value : 'bot-toi-thuong';
                console.log('[BotRoom] bot-vs-bot initial gameMode set to', modeEl.value);
            } else {
                modeEl.value = this.currentBotRoom.gameMode;
            }
        }

        const winSelect = document.getElementById('win-count');
        if (winSelect) winSelect.value = wc;

        if (this.currentBotRoom.gameMode === 'bot-vs-bot') {
            window.isBotRoomMode   = true;
            window.isBotVsBotMode  = true;
            window.currentBotConfig = this.currentBotRoom;
        } else {
            window.isBotRoomMode   = true;
            window.isBotVsBotMode  = false;
            window.currentBotConfig = this.currentBotRoom;

            const playerPiece = document.getElementById('player-piece');
            if (playerPiece) playerPiece.value = 'X';   // người luôn X

            const firstMoveEl = document.getElementById('first-move');
            if (firstMoveEl) firstMoveEl.value = fm;

            const blockBothEnds = document.getElementById('block-both-ends');
            if (blockBothEnds) blockBothEnds.checked = bb;
        }

        // Cập nhật currentRoomId lên Firebase để người khác biết đang bận (bot room)
        const myId = localStorage.getItem('current_user_id');
        if (myId && typeof db !== 'undefined') {
            db.ref(`users/${myId}/currentRoomId`).set('bot-room');
        }

        // YC.TXT: Switch to new view-bot-room instead of battle view
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        const viewBotRoom = document.getElementById('view-bot-room');
        if (viewBotRoom) {
            viewBotRoom.classList.add('active');
        }

        UIStateManager.apply('BOT_VS_BOT');

        // Initialize canvas in the new bot room container
        this.initBotRoomCanvas();

        // YC.TXT FIX: Log infCanvas.id after initBotRoomCanvas
        console.log('[BOT ROOM] enterBotRoom - infCanvas.id:', typeof infCanvas !== 'undefined' && infCanvas ? infCanvas.id : 'null');

        // Initialize GameState before initGame - ensures single source of truth is ready
        if (typeof GameState !== 'undefined' && typeof GameState.initialize === 'function') {
            GameState.initialize();
            console.log('[BOT ROOM] GameState initialized');
        }

        // Khởi tạo game
        if (typeof initGame === 'function') initGame();

        // YC.TXT FIX: Call renderInfiniteBoard() AFTER initGame() to ensure GameState.board.infiniteMap is initialized
        if (typeof renderInfiniteBoard === 'function') {
            renderInfiniteBoard();
        }

        if (this.currentBotRoom.gameMode === 'bot-vs-bot') {
            this.startBotVsBot();
        }

        // Update overlay UI
        setTimeout(() => this.updateBotRoomOverlays(), 120);
    },

    // ══ Initialize canvas for BOT ROOM (YC.TXT - SharedBoardUI Migration) ═════════════════════
    initBotRoomCanvas: function() {
        console.log('[BOT ROOM] initBotRoomCanvas - Using SharedBoardUI');

        // Use SharedBoardUI for unified canvas initialization
        if (typeof SharedBoardUI !== 'undefined') {
            const success = SharedBoardUI.init('bot');
            if (!success) {
                console.error('[BOT ROOM] SharedBoardUI.init failed, falling back to old logic');
                this.initBotRoomCanvasFallback();
            }
        } else {
            console.warn('[BOT ROOM] SharedBoardUI not loaded, using fallback logic');
            this.initBotRoomCanvasFallback();
        }

        // YC.TXT FIX: renderInfiniteBoard() will be called AFTER initGame() in startBotBattle()
        // to ensure GameState.board.infiniteMap is properly initialized
    },

    // ══ Fallback canvas initialization (old logic) ═════════════════════
    initBotRoomCanvasFallback: function() {
        // YC.TXT FIX: Use the existing inf-canvas-bot canvas in HTML instead of moving canvas
        const canvas = document.getElementById('inf-canvas-bot');
        const botContainer = document.getElementById('shared-board-bot');

        console.log('[BOT ROOM] initBotRoomCanvasFallback - canvas element:', {
            canvasId: canvas ? canvas.id : 'null',
            canvasWidth: canvas ? canvas.width : 'null',
            canvasHeight: canvas ? canvas.height : 'null',
            botContainerId: botContainer ? botContainer.id : 'null'
        });

        if (canvas && botContainer) {
            // YC.TXT FIX: Use container dimensions instead of window dimensions
            // Container dimensions reflect the actual available space
            const containerRect = botContainer.getBoundingClientRect();
            const containerWidth = containerRect.width || window.innerWidth;
            const containerHeight = containerRect.height || window.innerHeight;

            // Set canvas internal dimensions to match container
            canvas.width = containerWidth;
            canvas.height = containerHeight;
            canvas.style.width = '100%';
            canvas.style.height = '100%';

            console.log('[BOT ROOM] initBotRoomCanvasFallback dimensions:', {
                containerWidth: containerRect.width,
                containerHeight: containerRect.height,
                canvasWidth: canvas.width,
                canvasHeight: canvas.height
            });
        }

        // Update infCanvasW/infCanvasH BEFORE calling initInfCanvas
        if (typeof infCanvasW !== 'undefined' && typeof infCanvasH !== 'undefined') {
            infCanvasW = canvas.width;
            infCanvasH = canvas.height;
        }

        // YC.TXT: Ensure constant CELL_SIZE (32px) - don't resize cells
        if (typeof INF_CS !== 'undefined') {
            INF_CS = 32; // Bot room uses constant 32px
        }

        // BUG.TXT FIX: Reset viewport offset to center (0,0) at middle of screen
        if (typeof vRowF !== 'undefined' && typeof vColF !== 'undefined' &&
            typeof infCanvasW !== 'undefined' && typeof infCanvasH !== 'undefined') {
            vRowF = -Math.floor(infCanvasH / INF_CS / 2);
            vColF = -Math.floor(infCanvasW / INF_CS / 2);
        }

        // Initialize canvas with fullscreen size - pass canvas element to avoid hardcode
        if (typeof initInfCanvas === 'function') {
            initInfCanvas(canvas);
        }

        // Initialize camera to center of viewport
        if (typeof camera !== 'undefined') {
            camera.x = canvas.width / 2;
            camera.y = canvas.height / 2;
        }

        // Add resize listener for bot room
        this.addBotRoomResizeListener();
    },

    // ══ Add resize listener for BOT ROOM ═════════════════════
    addBotRoomResizeListener: function() {
        // Remove existing listener if any
        if (this.botRoomResizeHandler) {
            window.removeEventListener('resize', this.botRoomResizeHandler);
        }

        let resizeTimeout = null;
        this.botRoomResizeHandler = () => {
            if (!this.isBotRoomMode) return;

            // Debounce resize to avoid jitter
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                // YC.TXT FIX: Use inf-canvas-bot instead of inf-canvas for Bot Room mode
                const canvas = document.getElementById('inf-canvas-bot');
                const botContainer = document.getElementById('shared-board-bot');
                
                if (canvas && botContainer) {
                    // Use container dimensions instead of window dimensions
                    const containerRect = botContainer.getBoundingClientRect();
                    const containerWidth = containerRect.width || window.innerWidth;
                    const containerHeight = containerRect.height || window.innerHeight;

                    canvas.width = containerWidth;
                    canvas.height = containerHeight;
                    canvas.style.width = containerWidth + 'px';
                    canvas.style.height = containerHeight + 'px';

                    // Update infCanvasW/infCanvasH for renderer
                    if (typeof infCanvasW !== 'undefined' && typeof infCanvasH !== 'undefined') {
                        infCanvasW = canvas.width;
                        infCanvasH = canvas.height;
                    }

                    // Re-render board
                    if (typeof renderInfiniteBoard === 'function') {
                        renderInfiniteBoard();
                    }
                }
            }, 100);
        };

        window.addEventListener('resize', this.botRoomResizeHandler);
    },

    // ══ Remove resize listener when exiting BOT ROOM ═════════════════════
    removeBotRoomResizeListener: function() {
        if (this.botRoomResizeHandler) {
            window.removeEventListener('resize', this.botRoomResizeHandler);
            this.botRoomResizeHandler = null;
        }
    },

    // ══ Bắt đầu Bot vs Bot tự động khi phòng bot-vs-bot được chọn
    startBotVsBot: function() {
        const wxEl = document.getElementById('bot-vs-bot-x-mode');
        const woEl = document.getElementById('bot-vs-bot-o-mode');
        const wcEl = document.getElementById('bot-vs-bot-win-count');
        const bbEl = document.getElementById('bot-vs-bot-block-both') || document.getElementById('bot-room-block-both');

        const botXMode = wxEl ? wxEl.value : 'bot-toi-thuong';
        const botOMode = woEl ? woEl.value : 'bot-tia-chop';
        const winCount = wcEl ? parseInt(wcEl.value, 10) : 5;
        const blockBoth = bbEl ? bbEl.checked : true;

        const botXMeta = this.resolveBotMetaByMode(botXMode);
        const botOMeta = this.resolveBotMetaByMode(botOMode);

        this.botVsBotState = {
            botXMode,
            botOMode,
            botXLabel: `${botXMeta.emoji} ${botXMeta.name}`,
            botOLabel: `${botOMeta.emoji} ${botOMeta.name}`,
            winCount,
            blockBoth,
            currentPlayer: 'X'
        };

        // ══════════════════════════════════════════════════════════════════
        // Khởi tạo thống kê cho cặp bot này
        // ══════════════════════════════════════════════════════════════════
        const statsKey = `${botXMode}_vs_${botOMode}`;
        
        // Load thống kê từ localStorage
        const savedStats = localStorage.getItem('botVsBotStats');
        if (savedStats) {
            try {
                this.botVsBotStats = JSON.parse(savedStats);
            } catch (e) {
                console.warn('[BotVsBot] Failed to load stats from localStorage:', e);
                this.botVsBotStats = {};
            }
        } else {
            this.botVsBotStats = {};
        }
        
        if (!this.botVsBotStats[statsKey]) {
            this.botVsBotStats[statsKey] = {
                botXMode,
                botOMode,
                botXLabel: `${botXMeta.emoji} ${botXMeta.name}`,
                botOLabel: `${botOMeta.emoji} ${botOMeta.name}`,
                totalMatches: 0,
                winsX: 0,
                winsO: 0,
                draws: 0,
                matchHistory: []
            };
        }

        // Khởi tạo game mode và cài đặt board
        if (typeof modeSelect !== 'undefined') modeSelect.value = botXMode;
        if (typeof document !== 'undefined') {
            const winSelect = document.getElementById('win-count');
            if (winSelect) winSelect.value = winCount;
            const blockBothEnds = document.getElementById('block-both-ends');
            if (blockBothEnds) blockBothEnds.checked = blockBoth;
        }

        // Set state để đếm lượt tự động
        isSolo = false;
        gameMode = botXMode;
        botPiece = 'O';
        humanPiece = 'X';
        currentPlayer = 'X';
        isGameActive = true;

        // Start automatic bot-vs-bot play regardless of X/O order
        setTimeout(() => this.performBotVsBotMove(), 100);
    },

    performBotVsBotMove: function() {
        if (!this.botVsBotState || !this.isBotRoomMode || !this.currentBotRoom) return;
        if (!isGameActive) return;

        const state = this.botVsBotState;
        const botMode = state.currentPlayer === 'X' ? state.botXMode : state.botOMode;

        this.updateBotRoomOverlays();

        // Set gameMode cho makeAIMove / getBotMove
        const originalGameMode = gameMode;
        gameMode = botMode;

        const originalBotPiece = botPiece;
        const originalHumanPiece = humanPiece;
        const originalIsSolo = isSolo;

        isSolo = false;
        botPiece = state.currentPlayer;
        humanPiece = state.currentPlayer === 'X' ? 'O' : 'X';

        const thinkTime = botMode === 'ai-god' || botMode === 'bot-toi-thuong' ? 500 :
                          botMode === 'bot-tia-chop' ? 200 : 300;

        setTimeout(() => {
            if (!isGameActive) return;
            console.log('[performBotVsBotMove] currentPlayer=', state.currentPlayer, 'botMode=', botMode, 'gameMode=', gameMode, 'botPiece=', botPiece, 'humanPiece=', humanPiece);
            const move = getBotMove();
            console.log('[performBotVsBotMove] move=', move);
            if (move) {
                const originalIsBotMove = isBotMove;
                isBotMove = true;
                makeMove(move.r, move.c);
                isBotMove = originalIsBotMove;
            }

            // Restore original mode values for board updates
            gameMode = originalGameMode;
            botPiece = originalBotPiece;
            humanPiece = originalHumanPiece;
            isSolo = originalIsSolo;

            state.currentPlayer = state.currentPlayer === 'X' ? 'O' : 'X';
            const winner = typeof currentPlayer !== 'undefined' ? currentPlayer : null;
            if (isGameActive) {
                setTimeout(() => this.performBotVsBotMove(), 180);
            }
        }, thinkTime);
    },

    // ══ Update BOT ROOM overlay UI (YC.TXT) ═════════════════════
    updateBotRoomOverlays: function() {
        const username = localStorage.getItem('current_username') || 'Bạn';
        const playerIndicator = document.getElementById('bot-player-indicator');
        const botIndicator = document.getElementById('bot-bot-indicator');

        const playerDetails = document.querySelector('#bot-player-overlay .bot-player-details');
        const botDetails = document.querySelector('#bot-bot-overlay .bot-player-details');

        const humanProfile = PlayerCard.normalizeProfile({
            id: 'human',
            name: username,
            avatar: '🧑',
            level: 25,
            elo: 1500,
            win: 0,
            lose: 0,
            draw: 0,
            winRate: '—',
            coin: 25000,
            title: 'Người chơi',
            status: 'Đang suy nghĩ',
            isBot: false,
        });

        const botMeta = this.resolveBotMetaByMode(this.currentBotRoom?.gameMode);
        const botProfile = PlayerCard.normalizeProfile({
            id: botMeta.id || 'bot',
            name: botMeta.name || 'Bot',
            avatar: botMeta.avatar || botMeta.emoji || '🤖',
            level: botMeta.level,
            elo: botMeta.elo,
            wins: botMeta.wins,
            losses: botMeta.losses,
            draws: botMeta.draws,
            winRate: botMeta.winRate,
            coin: botMeta.coin || 0,
            title: botMeta.title || botMeta.description || 'Bot AI',
            status: 'Đang tính nước đi',
            isBot: true,
            difficulty: botMeta.difficulty || botMeta.description || 'Bot AI',
        });

        // Update avatar circle
        const botAvatarCircle = document.querySelector('#bot-bot-overlay .bot-avatar-circle');
        if (botAvatarCircle) botAvatarCircle.textContent = botMeta.avatar || botMeta.emoji || '🤖';

        if (playerDetails) {
            PlayerCard.hydrate(playerDetails, humanProfile, {
                badge: 'Human',
                status: this.currentBotRoom && this.currentBotRoom.gameMode === 'bot-vs-bot' && this.botVsBotState
                    ? (this.botVsBotState.currentPlayer === 'X' ? 'Đang đánh' : 'Đang chờ')
                    : 'Đang suy nghĩ'
            });
        }

        if (botDetails) {
            PlayerCard.hydrate(botDetails, botProfile, {
                badge: 'Bot',
                status: this.currentBotRoom && this.currentBotRoom.gameMode === 'bot-vs-bot' && this.botVsBotState
                    ? (this.botVsBotState.currentPlayer === 'O' ? 'Đang đánh' : 'Đang chờ')
                    : 'Đang tính nước đi'
            });
        }

        if (playerIndicator) playerIndicator.textContent = this.currentBotRoom && this.currentBotRoom.gameMode === 'bot-vs-bot' && this.botVsBotState
            ? (this.botVsBotState.currentPlayer === 'X' ? 'Đang đánh • Bot X' : 'Đang chờ • Bot X')
            : 'Lượt của bạn';

        if (botIndicator) botIndicator.textContent = this.currentBotRoom && this.currentBotRoom.gameMode === 'bot-vs-bot' && this.botVsBotState
            ? (this.botVsBotState.currentPlayer === 'O' ? 'Đang đánh • Bot O' : 'Đang chờ • Bot O')
            : 'Đang chờ';

        if (this.currentBotRoom && this.currentBotRoom.gameMode === 'bot-vs-bot' && this.botVsBotState) {
            const xMeta = this.resolveBotMetaByMode(this.botVsBotState.botXMode || 'bot-toi-thuong');
            const oMeta = this.resolveBotMetaByMode(this.botVsBotState.botOMode || 'bot-tia-chop');

            const botXProfile = PlayerCard.normalizeProfile({
                id: xMeta.id || xMeta.gameMode,
                name: `${xMeta.avatar || xMeta.emoji} ${xMeta.name}`,
                avatar: xMeta.avatar || xMeta.emoji,
                level: xMeta.level,
                elo: xMeta.elo,
                wins: xMeta.wins,
                losses: xMeta.losses,
                draws: xMeta.draws,
                winRate: xMeta.winRate,
                coin: xMeta.coin || 0,
                title: xMeta.title || xMeta.description,
                status: this.botVsBotState.currentPlayer === 'X' ? 'Đang đánh' : 'Đang chờ',
                isBot: true,
                difficulty: xMeta.difficulty || xMeta.description,
            });

            const botOProfile = PlayerCard.normalizeProfile({
                id: oMeta.id || oMeta.gameMode,
                name: `${oMeta.avatar || oMeta.emoji} ${oMeta.name}`,
                avatar: oMeta.avatar || oMeta.emoji,
                level: oMeta.level,
                elo: oMeta.elo,
                wins: oMeta.wins,
                losses: oMeta.losses,
                draws: oMeta.draws,
                winRate: oMeta.winRate,
                coin: oMeta.coin || 0,
                title: oMeta.title || oMeta.description,
                status: this.botVsBotState.currentPlayer === 'O' ? 'Đang đánh' : 'Đang chờ',
                isBot: true,
                difficulty: oMeta.difficulty || oMeta.description,
            });

            if (playerDetails) {
                PlayerCard.hydrate(playerDetails, botXProfile, { badge: 'Bot', status: this.botVsBotState.currentPlayer === 'X' ? 'Đang đánh' : 'Đang chờ' });
            }
            if (botDetails) {
                PlayerCard.hydrate(botDetails, botOProfile, { badge: 'Bot', status: this.botVsBotState.currentPlayer === 'O' ? 'Đang đánh' : 'Đang chờ' });
            }
        }
    },


    // ══ Chơi lại (YC.TXT - Updated for new view) ═════════════════════
    replayBotBattle: function() {
        if (!this.currentBotRoom) return;

        // Xóa state restore khi chơi lại để tránh dùng state cũ
        localStorage.removeItem('bot_room_mode');
        localStorage.removeItem('bot_room_config');

        UIStateManager.apply('BOT_VS_BOT');

        // Re-initialize board/game state only; do not reset UI mode
        if (typeof initGame === 'function') initGame();

        if (this.currentBotRoom.gameMode === 'bot-vs-bot') {
            this.startBotVsBot();
        }

        // Update overlay UI
        setTimeout(() => this.updateBotRoomOverlays(), 80);

        // Show bot speech
        this.showBotSpeech('Ván mới bắt đầu! Đấu tiếp nhé!');
    },

    // ══ Hiện bubble thoại bot (YC.TXT - Updated for new overlay) ═════════════════════
    showBotSpeech: function(msg) {
        const chatBubble = document.getElementById('bot-chat-message');
        if (!chatBubble) return;
        chatBubble.textContent = `💬 "${msg}"`;
        
        // Add animation
        const overlay = document.getElementById('bot-chat-bubble');
        if (overlay) {
            overlay.style.animation = 'none';
            overlay.offsetHeight; // Trigger reflow
            overlay.style.animation = 'botChatBubble 0.3s ease-out';
        }
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            if (overlay) {
                overlay.style.animation = 'botChatBubbleFade 0.3s ease-out forwards';
            }
        }, 5000);
    },

    // ══ Xử lý kết thúc ván (YC.TXT - Updated for new popup) ═════════════════════
    handleGameEnd: function(winner) {
        if (winner === 'X' && typeof window.updateUserStats === 'function') {
            window.updateUserStats('winBot', 1);
        }
        // Cộng Xu khi thắng bot - dùng hệ thống thống nhất từ xu-nhiem-vu.js
        if (winner === 'X' && typeof window.onWinBotXu === 'function') {
            const gameMode = this.currentBotRoom.gameMode;
            const winCount = (typeof GameState !== 'undefined' && GameState.roomRules && typeof GameState.roomRules.winCount === 'number') ? GameState.roomRules.winCount : 5;
            window.onWinBotXu(gameMode, winCount);
        }

        if (winner === 'X') {
            if (typeof showWinOverlay === 'function') {
                showWinOverlay('X', false, '', '🏆');
            }
            this.showBotSpeech('Bạn thắng rồi! Đáng nể đấy! Thử ván nữa không?');
        } else if (winner === 'O') {
            if (typeof showWinOverlay === 'function') {
                showWinOverlay('O', true, '', '💀');
            }
            this.showBotSpeech('Tôi đã bảo rồi! Còn lâu mới thắng được tôi! 😈');
        } else {
            if (typeof showWinOverlay === 'function') {
                showWinOverlay('draw', false, 'Trận đấu hòa! Lần sau sẽ thắng được đâu!', '🤝');
            }
            this.showBotSpeech('Hòa! Lần sau sẽ thắng được đâu!');
        }
    },

    // ══ Undo move trong phòng bot ═════════════════════════════════
    undoBotRoomMove: function() {
        if (!this.isBotRoomMode || !this.currentBotRoom) {
            alert('Chỉ có thể undo khi đang trong phòng bot!');
            return;
        }

        if (typeof moveHistory === 'undefined' || !moveHistory || moveHistory.length < 2) {
            alert('Cần ít nhất 2 nước (người + bot) để undo!');
            return;
        }

        if (typeof infiniteMap === 'undefined') {
            alert('Bàn cờ chưa khởi tạo!');
            return;
        }

        // Undo 2 nước: bot move + player move
        const botMove = moveHistory.pop();
        const playerMove = moveHistory.pop();

        if (!botMove || !playerMove) {
            alert('Lỗi lịch sử nước đi!');
            return;
        }

        // Xóa quân khỏi bàn cờ
        infiniteMap.delete(`${botMove.r},${botMove.c}`);
        infiniteMap.delete(`${playerMove.r},${playerMove.c}`);

        // Giảm moveCount
        if (typeof moveCount !== 'undefined') {
            moveCount -= 2;
        }

        // Reset về lượt người
        if (typeof currentPlayer !== 'undefined') {
            currentPlayer = 'X';
        }

        // Reset last move
        if (typeof lastMoveR !== 'undefined' && typeof lastMoveC !== 'undefined') {
            if (moveHistory.length > 0) {
                const prevMove = moveHistory[moveHistory.length - 1];
                lastMoveR = prevMove.r;
                lastMoveC = prevMove.c;
            } else {
                lastMoveR = null;
                lastMoveC = null;
            }
        }

        // Render lại bàn cờ
        if (typeof renderInfiniteBoard === 'function') {
            renderInfiniteBoard();
        }

        // Bot sẽ không tự đánh vì currentPlayer đã được set về 'X' (lượt người)
    },

    // ══ Đầu hàng trong BOT ROOM (YC.TXT) ═════════════════════════════════
    surrenderBotGame: function() {
        if (!this.isBotRoomMode || !this.currentBotRoom) {
            alert('Chỉ có thể đầu hàng khi đang trong phòng bot!');
            return;
        }

        if (confirm('Bạn có chắc muốn đầu hàng? Bot sẽ thắng.')) {
            // Stop AI
            if (typeof stopAI === 'function') {
                stopAI();
            }

            // End game state
            if (typeof isGameActive !== 'undefined') {
                isGameActive = false;
            }

            // Show shared win overlay for bot victory
            if (typeof showWinOverlay === 'function') {
                showWinOverlay('O', true, 'Bạn đã đầu hàng. Bot thắng ván này!', '😈');
            }

            // Update bot chat
            this.showBotSpeech('Bạn đã đầu hàng! Tôi thắng rồi! 😈');
        }
    },

    // ══ Thoát phòng bot (YC.TXT - Updated for new view) ═════════════════════
    exitBotRoom: function() {
        // Dừng Auto Bot nếu đang chạy
        if (this.autoBotInterval) {
            this.stopAutoBot();
        }
        
        if (!this.isBotRoomMode) {
            console.warn('[BotRoom] Exit called but not in bot room');
            return;
        }
        
        const shouldReload = confirm('Bạn đang thoát phòng BOT offline. Trang sẽ tải lại để xóa trạng thái phòng ma và trở về chế độ chính.\n\nBấm OK để thoát và load lại trang, Cancel để chỉ trở về menu.');
        console.log('[BotRoom] Exit Start - Full cleanup, reload=', shouldReload);
        
        this.isBotRoomMode  = false;
        this.currentBotRoom = null;
        window.isBotRoomMode    = false;
        window.currentBotConfig = null;

        // YC.TXT FIX: Destroy SharedBoardUI FIRST (same as Online Room)
        if (typeof SharedBoardUI !== 'undefined') {
            console.log('[BotRoom] Destroying SharedBoardUI');
            SharedBoardUI.destroy();
        }

        // Remove resize listener (fallback cleanup)
        this.removeBotRoomResizeListener();

        window.isBotVsBotMode = false;

        // YC.TXT FIX: Clear mode from GameModeManager (same as Online Room)
        if (typeof GameModeManager !== 'undefined') {
            console.log('[BotRoom] Clearing GameModeManager');
            GameModeManager.clearMode();
        }

        // YC.TXT FIX: Clear ALL BOT Restore State from localStorage
        localStorage.removeItem('bot_room_mode');
        localStorage.removeItem('bot_room_config');
        localStorage.removeItem('game_mode_current');
        localStorage.removeItem('game_mode_context');
        localStorage.removeItem('current_room_id');
        sessionStorage.removeItem('bot_session');

        // Xóa currentRoomId khỏi Firebase khi thoát bot room
        const myId = localStorage.getItem('current_user_id');
        if (myId && typeof db !== 'undefined') {
            console.log('[BotRoom] Removing user currentRoomId from Firebase');
            db.ref(`users/${myId}/currentRoomId`).remove();
        }

        // Restore canvas to original location
        this.restoreCanvas();

        // Restore các element đã ẩn khi vào bot room
        const betInfo  = document.getElementById('battle-bet-info');
        if (betInfo)   betInfo.style.display = '';
        const roomInfo = document.querySelector('.battle-room-info-card');
        if (roomInfo)  roomInfo.style.display = '';

        // Restore practice-layout nếu đã ẩn
        const pl = document.querySelector('.practice-layout');
        if (pl) { pl.style.visibility = ''; pl.style.display = ''; }

        // YC.TXT FIX: Exit bot room must return to normal home UI once
        UIStateManager.apply('HOME');

        // YC.TXT FIX: Reset game state (same as Online Room)
        if (typeof isGameActive !== 'undefined') {
            isGameActive = false;
        }
        if (typeof infiniteMap !== 'undefined') {
            infiniteMap.clear();
        }
        if (typeof moveHistory !== 'undefined') {
            moveHistory.length = 0;
        }

        // switchView('home') sẽ gọi returnBoardToTraining() và restore shared-board-online
        if (typeof switchView === 'function') {
            console.log('[BotRoom] Switching to home view');
            switchView('home');
        } else {
            document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
            const vh = document.getElementById('view-home');
            if (vh) vh.classList.add('active');
        }

        // YC.TXT FIX: KHÔNG tự động quay lại tab Bot sau khi thoát
        // Để user tự chọn tab (Bot/Normal/VIP) sau khi thoát
        // if (typeof switchRoomTab === 'function') switchRoomTab('bot');
        
        console.log('[BotRoom] Exit Complete - Full cleanup done');

        if (shouldReload) {
            console.log('[BotRoom] Reloading page after bot exit to clear offline room state');
            window.location.reload();
            return;
        }
    },

    // ══ Restore canvas to original location (YC.TXT) ═════════════════════
    restoreCanvas: function() {
        // Move canvas back to original container WITHOUT changing id
        const botCanvas = document.getElementById('inf-canvas');
        const originalContainer = document.getElementById('inf-resizable');

        if (botCanvas && originalContainer) {
            // YC.TXT FIX: Don't change canvas id - just move it back
            // botCanvas.id = 'inf-canvas'; // REMOVED - don't change id
            originalContainer.appendChild(botCanvas);

            // Reset canvas size
            botCanvas.style.width = '';
            botCanvas.style.height = '';
        }
    },

    // ══ Auto Bot Functions ══════════════════════════════════════════════════════════════════
    startAutoBot: function() {
        const botXMode = document.getElementById('auto-bot-x-mode').value;
        const botOMode = document.getElementById('auto-bot-o-mode').value;
        const firstMove = document.getElementById('auto-bot-first-move').value;
        const totalGames = parseInt(document.getElementById('auto-bot-games').value) || 100;
        const winCount = parseInt(document.getElementById('auto-bot-win-count').value) || 5;
        const blockBoth = document.getElementById('auto-bot-block-both').checked;

        const botXMeta = this.resolveBotMetaByMode(botXMode);
        const botOMeta = this.resolveBotMetaByMode(botOMode);

        // Khởi tạo state
        this.autoBotState = {
            botXMode,
            botOMode,
            botXLabel: botXMeta.name,
            botOLabel: botOMeta.name,
            firstMove,
            totalGames,
            currentGame: 0,
            winCount,
            blockBoth,
            isRunning: true,
            isPaused: false
        };

        // Khởi tạo stats nếu chưa có
        const statsKey = `${botXMode}_vs_${botOMode}`;
        if (!this.autoBotStats) {
            this.autoBotStats = {};
        }
        if (!this.autoBotStats[statsKey]) {
            this.autoBotStats[statsKey] = {
                winsX: 0,
                winsO: 0,
                draws: 0,
                totalMatches: 0
            };
        }

        // Update UI buttons
        document.getElementById('btn-auto-bot-start').disabled = true;
        document.getElementById('btn-auto-bot-stop').disabled = false;
        document.getElementById('btn-auto-bot-resume').disabled = true;

        // Hiển thị thống kê ban đầu
        this.renderAutoBotStats();

        // Hiển thị bảng xếp hạng
        this.renderAutoBotLeaderboard();

        // Bắt đầu vòng lặp
        this.runAutoBotLoop();
    },

    runAutoBotLoop: function() {
        if (!this.autoBotState || !this.autoBotState.isRunning || this.autoBotState.isPaused) {
            return;
        }

        if (this.autoBotState.currentGame >= this.autoBotState.totalGames) {
            this.stopAutoBot();
            return;
        }

        // Chạy batch trận synchronous (headless simulation)
        const batchSize = Math.min(10, this.autoBotState.totalGames - this.autoBotState.currentGame);
        
        for (let i = 0; i < batchSize; i++) {
            if (!this.autoBotState.isRunning || this.autoBotState.isPaused) break;
            
            // Tạo và chạy một trận headless
            const result = this.runSingleAutoBotGameHeadless();
            
            // Cập nhật thống kê
            const statsKey = `${this.autoBotState.botXMode}_vs_${this.autoBotState.botOMode}`;
            const stats = this.autoBotStats[statsKey];
            
            if (result === 'X') {
                stats.winsX++;
            } else if (result === 'O') {
                stats.winsO++;
            } else {
                stats.draws++;
            }
            stats.totalMatches++;
            this.autoBotState.currentGame++;
        }

        // Update UI sau khi hoàn thành batch
        this.renderAutoBotStats();
        this.renderAutoBotLeaderboard();
        
        // Lưu stats vào localStorage
        localStorage.setItem('autoBotStats', JSON.stringify(this.autoBotStats));

        // Tiếp tục batch tiếp theo với setTimeout để không block UI
        if (this.autoBotState.currentGame < this.autoBotState.totalGames && this.autoBotState.isRunning && !this.autoBotState.isPaused) {
            this.autoBotInterval = setTimeout(() => this.runAutoBotLoop(), 50);
        } else if (this.autoBotState.currentGame >= this.autoBotState.totalGames) {
            this.stopAutoBot();
        }
    },

    runSingleAutoBotGameHeadless: function() {
        const state = this.autoBotState;
        
        // Tạo instance headless game
        const game = new AutoBotGameHeadless({
            botXMode: state.botXMode,
            botOMode: state.botOMode,
            firstMove: state.firstMove,
            winCount: state.winCount,
            blockBoth: state.blockBoth
        });
        
        // Chạy synchronous và trả về kết quả
        return game.run();
    },

    renderAutoBotStats: function() {
        const state = this.autoBotState;
        if (!state) return;

        const statsKey = `${state.botXMode}_vs_${state.botOMode}`;
        const stats = this.autoBotStats[statsKey];
        
        if (!stats) return;

        // Tính tỷ lệ
        const winRateX = stats.totalMatches > 0 ? ((stats.winsX / stats.totalMatches) * 100).toFixed(1) : 0;
        const winRateO = stats.totalMatches > 0 ? ((stats.winsO / stats.totalMatches) * 100).toFixed(1) : 0;
        const drawRate = stats.totalMatches > 0 ? ((stats.draws / stats.totalMatches) * 100).toFixed(1) : 0;
        const progress = ((state.currentGame / state.totalGames) * 100).toFixed(1);

        const container = document.getElementById('auto-bot-stats-container');
        if (container) {
            container.innerHTML = `
                <div style="background:#f8fafc;border-radius:8px;padding:16px;margin-top:12px;font-size:14px;">
                    <div style="font-weight:bold;margin-bottom:12px;color:#831843;">📊 Thống kê Auto Bot</div>
                    
                    <!-- Progress Bar -->
                    <div style="margin-bottom:16px;">
                        <div style="display:flex;justify-content:space-between;margin-bottom:4px;color:#64748b;">
                            <span>Tiến độ: ${state.currentGame}/${state.totalGames} trận</span>
                            <span>${progress}%</span>
                        </div>
                        <div style="width:100%;height:20px;background:#e5e7eb;border-radius:10px;overflow:hidden;">
                            <div style="width:${progress}%;height:100%;background:linear-gradient(90deg,#ec4899,#db2777);transition:width 0.3s;"></div>
                        </div>
                    </div>

                    <!-- Bot Stats -->
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                        <div style="background:#e0f2fe;padding:12px;border-radius:8px;border:2px solid #0284c7;">
                            <div style="font-weight:bold;color:#0284c7;font-size:16px;">${state.botXLabel} (X)</div>
                            <div style="color:#0369a1;margin-top:4px;">Thắng: ${stats.winsX} (${winRateX}%)</div>
                            <div style="width:100%;height:8px;background:#bae6fd;border-radius:4px;margin-top:6px;overflow:hidden;">
                                <div style="width:${winRateX}%;height:100%;background:#0284c7;"></div>
                            </div>
                        </div>
                        <div style="background:#fce7f3;padding:12px;border-radius:8px;border:2px solid #be185d;">
                            <div style="font-weight:bold;color:#be185d;font-size:16px;">${state.botOLabel} (O)</div>
                            <div style="color:#9d174d;margin-top:4px;">Thắng: ${stats.winsO} (${winRateO}%)</div>
                            <div style="width:100%;height:8px;background:#fbcfe8;border-radius:4px;margin-top:6px;overflow:hidden;">
                                <div style="width:${winRateO}%;height:100%;background:#be185d;"></div>
                            </div>
                        </div>
                    </div>

                    <!-- Total Stats -->
                    <div style="margin-top:12px;padding:10px;background:#f1f5f9;border-radius:6px;color:#475569;">
                        <div style="display:flex;justify-content:space-between;">
                            <span>Tổng trận: ${stats.totalMatches}</span>
                            <span>Hòa: ${stats.draws} (${drawRate}%)</span>
                        </div>
                    </div>

                    <!-- Status -->
                    <div style="margin-top:12px;text-align:center;font-weight:bold;color:${state.isRunning && !state.isPaused ? '#10b981' : '#f59e0b'};">
                        ${state.isRunning && !state.isPaused ? '▶️ Đang chạy...' : state.isPaused ? '⏸️ Đã tạm dừng' : '⏹️ Đã dừng'}
                    </div>
                </div>
            `;
        }
    },

    stopAutoBot: function() {
        if (this.autoBotInterval) {
            clearTimeout(this.autoBotInterval);
            this.autoBotInterval = null;
        }

        if (this.autoBotState) {
            this.autoBotState.isRunning = false;
            this.autoBotState.isPaused = true; // Set to paused instead of false to allow resume
        }

        // Update UI buttons
        document.getElementById('btn-auto-bot-start').disabled = false;
        document.getElementById('btn-auto-bot-stop').disabled = true;
        document.getElementById('btn-auto-bot-resume').disabled = false;

        this.renderAutoBotStats();
    },

    resumeAutoBot: function() {
        if (!this.autoBotState || this.autoBotState.currentGame >= this.autoBotState.totalGames) {
            return;
        }

        this.autoBotState.isRunning = true;
        this.autoBotState.isPaused = false;

        // Update UI buttons
        document.getElementById('btn-auto-bot-start').disabled = true;
        document.getElementById('btn-auto-bot-stop').disabled = false;
        document.getElementById('btn-auto-bot-resume').disabled = true;

        this.runAutoBotLoop();
    },

    clearAutoBotStats: function() {
        if (this.autoBotInterval) {
            this.stopAutoBot();
        }

        this.autoBotState = null;
        this.autoBotStats = null;

        // Xóa stats khỏi localStorage
        localStorage.removeItem('autoBotStats');

        // Clear UI
        const container = document.getElementById('auto-bot-stats-container');
        if (container) {
            container.innerHTML = '';
        }

        // Clear leaderboard UI
        const leaderboardContainer = document.getElementById('auto-bot-leaderboard-container');
        if (leaderboardContainer) {
            leaderboardContainer.innerHTML = '';
        }

        // Reset form
        document.getElementById('auto-bot-games').value = 100;
    },

    renderAutoBotLeaderboard: function() {
        if (!this.autoBotStats) return;

        const container = document.getElementById('auto-bot-leaderboard-container');
        if (!container) return;

        // Duyệt qua tất cả các cặp đấu
        const matchups = [];
        
        for (const statsKey in this.autoBotStats) {
            const stats = this.autoBotStats[statsKey];
            const [botXMode, botOMode] = statsKey.split('_vs_');
            
            const botXMeta = this.resolveBotMetaByMode(botXMode);
            const botOMeta = this.resolveBotMetaByMode(botOMode);
            
            const winRateX = stats.totalMatches > 0 ? ((stats.winsX / stats.totalMatches) * 100).toFixed(1) : 0;
            const winRateO = stats.totalMatches > 0 ? ((stats.winsO / stats.totalMatches) * 100).toFixed(1) : 0;
            
            matchups.push({
                botXMode,
                botOMode,
                botXName: botXMeta.name,
                botOName: botOMeta.name,
                botXEmoji: botXMeta.emoji,
                botOEmoji: botOMeta.emoji,
                botXColor: botXMeta.color,
                botOColor: botOMeta.color,
                winsX: stats.winsX,
                winsO: stats.winsO,
                draws: stats.draws,
                totalMatches: stats.totalMatches,
                winRateX,
                winRateO
            });
        }

        // Sắp xếp theo tổng số trận giảm dần
        matchups.sort((a, b) => b.totalMatches - a.totalMatches);

        if (matchups.length === 0) {
            container.innerHTML = `
                <div style="background:#f8fafc;border-radius:8px;padding:16px;border:1px solid #e2e8f0;text-align:center;color:#64748b;">
                    <div style="font-weight:bold;margin-bottom:8px;color:#831843;">🏆 Bảng Xếp Hạng Bot vs Bot</div>
                    <div>Chưa có dữ liệu trận đấu</div>
                </div>
            `;
            return;
        }

        // Render bảng xếp hạng theo cặp đấu
        let html = `
            <div style="background:#f8fafc;border-radius:8px;padding:16px;border:1px solid #e2e8f0;">
                <div style="font-weight:bold;margin-bottom:12px;color:#831843;">🏆 Bảng Xếp Hạng Bot vs Bot</div>
                <div style="display:flex;flex-direction:column;gap:8px;">
        `;

        matchups.forEach((matchup, index) => {
            html += `
                <div style="background:#fff;border-radius:8px;padding:12px;border:1px solid #e2e8f0;">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
                        <div style="display:flex;align-items:center;gap:8px;flex:1;">
                            <div style="font-size:20px;">${matchup.botXEmoji}</div>
                            <div style="font-weight:bold;color:${matchup.botXColor};">${matchup.botXName}</div>
                        </div>
                        <div style="font-weight:bold;color:#64748b;">VS</div>
                        <div style="display:flex;align-items:center;gap:8px;flex:1;text-align:right;">
                            <div style="font-weight:bold;color:${matchup.botOColor};">${matchup.botOName}</div>
                            <div style="font-size:20px;">${matchup.botOEmoji}</div>
                        </div>
                    </div>
                    
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                        <div style="background:${matchup.botXColor}15;padding:8px;border-radius:6px;border:1px solid ${matchup.botXColor}40;">
                            <div style="font-size:12px;color:#64748b;">Thắng: ${matchup.winsX}/${matchup.totalMatches}</div>
                            <div style="font-weight:bold;font-size:16px;color:${matchup.botXColor};">${matchup.winRateX}%</div>
                            <div style="width:100%;height:6px;background:#e2e8f0;border-radius:3px;margin-top:4px;overflow:hidden;">
                                <div style="width:${matchup.winRateX}%;height:100%;background:${matchup.botXColor};"></div>
                            </div>
                        </div>
                        <div style="background:${matchup.botOColor}15;padding:8px;border-radius:6px;border:1px solid ${matchup.botOColor}40;">
                            <div style="font-size:12px;color:#64748b;text-align:right;">Thắng: ${matchup.winsO}/${matchup.totalMatches}</div>
                            <div style="font-weight:bold;font-size:16px;color:${matchup.botOColor};text-align:right;">${matchup.winRateO}%</div>
                            <div style="width:100%;height:6px;background:#e2e8f0;border-radius:3px;margin-top:4px;overflow:hidden;">
                                <div style="width:${matchup.winRateO}%;height:100%;background:${matchup.botOColor};"></div>
                            </div>
                        </div>
                    </div>
                    
                    <div style="margin-top:8px;text-align:center;font-size:12px;color:#64748b;">
                        Tổng: ${matchup.totalMatches} trận | Hòa: ${matchup.draws}
                    </div>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;

        container.innerHTML = html;
    },

    // ══ Toggle Position Editor Mode ══════════════════════════════════════════════════════════════════
    togglePositionEditorMode: function() {
        const checkbox = document.getElementById('position-editor-checkbox');
        const btnStart = document.getElementById('btn-bot-start');
        const btnEditor = document.getElementById('btn-start-editor');

        if (!checkbox || !btnStart || !btnEditor) return;

        if (checkbox.checked) {
            btnStart.style.display = 'none';
            btnEditor.style.display = 'block';
            console.log('[BotRoom] Position editor mode enabled');
        } else {
            btnStart.style.display = 'block';
            btnEditor.style.display = 'none';
            console.log('[BotRoom] Position editor mode disabled');
        }
    },

    // ══ Vào editor từ ván đang chơi (giữ nguyên bàn cờ) ═══════════════════
    enterEditorFromGame: function() {
        if (!this.currentBotRoom) return;

        // Dừng game hiện tại
        if (typeof isGameActive !== 'undefined') isGameActive = false;

        // Hiện toolbar editor với bàn cờ hiện tại (không xóa quân)
        if (typeof PositionEditor !== 'undefined') {
            // Xóa toolbar cũ nếu có
            const oldToolbar = document.getElementById('position-editor-toolbar');
            if (oldToolbar) oldToolbar.remove();

            PositionEditor.enterWithCurrentBoard();
            this.renderPositionEditorToolbar();
            this.hookCanvasClickForEditor();
            this.updateBotRoomOverlays();
        } else {
            console.error('[BotRoom] PositionEditor not available');
        }
    },

    // ══ Start Position Editor ══════════════════════════════════════════════════════════════════
    startPositionEditor: function() {
        if (!this.currentBotRoom) return;

        const wcEl = document.getElementById('bot-room-win-count');
        const bbEl = document.getElementById('bot-room-block-both');
        const fmEl = document.getElementById('bot-room-first-move');
        const wc   = wcEl ? wcEl.value   : '5';
        const bb   = bbEl ? bbEl.checked : true;
        const fm   = fmEl ? fmEl.value   : 'X';

        window.isBotRoomMode    = true;
        window.currentBotConfig = this.currentBotRoom;

        try {
            const parsedWc = parseInt(wc, 10);
            const rules = { winCount: isNaN(parsedWc) ? undefined : parsedWc, chan2Dau: !!bb, firstTurn: fm };
            if (typeof GameState !== 'undefined') {
                GameState.roomRules = rules;
                if (!GameState.board) GameState.board = {};
                if (typeof rules.winCount === 'number') GameState.board.winCount = rules.winCount;
            }
            window.roomRules = rules;
        } catch (e) { console.warn('[BotRoom] failed to sync roomRules to GameState', e); }

        const modeEl = document.getElementById('game-mode');
        if (modeEl) {
            modeEl.value = this.currentBotRoom.gameMode;
        }

        const winSelect = document.getElementById('win-count');
        if (winSelect) winSelect.value = wc;

        const playerPiece = document.getElementById('player-piece');
        if (playerPiece) playerPiece.value = 'X';

        const firstMoveEl = document.getElementById('first-move');
        if (firstMoveEl) firstMoveEl.value = fm;

        const blockBothEnds = document.getElementById('block-both-ends');
        if (blockBothEnds) blockBothEnds.checked = bb;

        // Switch to bot room view
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        const viewBotRoom = document.getElementById('view-bot-room');
        if (viewBotRoom) {
            viewBotRoom.classList.add('active');
        }

        UIStateManager.apply('BOT_VS_BOT');

        // Initialize canvas
        this.initBotRoomCanvas();

        // Initialize GameState.board structure if needed (but don't reset the Map)
        if (typeof GameState !== 'undefined') {
            if (!GameState.board) GameState.board = {};
            if (!GameState.board.infiniteMap) GameState.board.infiniteMap = new Map();
            GameState.board.isInfinite = true;
        }

        // DO NOT call GameState.initialize() here - it will create a new empty Map
        // PositionEditor.enter() will clear the board instead
        // GameState will be fully initialized when user clicks "Bắt đầu" in toolbar (initGameFromPosition)

        // DO NOT call initGame() here - game will be initialized when user clicks "Bắt đầu" in toolbar

        setTimeout(() => {
            if (typeof PositionEditor !== 'undefined') {
                PositionEditor.enter();
                this.renderPositionEditorToolbar();
                // Hook canvas click after toolbar is rendered
                this.hookCanvasClickForEditor();
                // Cập nhật overlay đúng bot của phòng hiện tại
                this.updateBotRoomOverlays();
            } else {
                console.error('[BotRoom] PositionEditor not available');
            }
        }, 200);
    },

    // ══ Render Position Editor Toolbar ══════════════════════════════════════════════════════════════════
    renderPositionEditorToolbar: function() {
        const botView = document.getElementById('view-bot-room');
        if (!botView) return;

        if (document.getElementById('position-editor-toolbar')) return;

        const toolbar = document.createElement('div');
        toolbar.id = 'position-editor-toolbar';
        toolbar.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(30, 41, 59, 0.95);
            border: 2px solid #8b5cf6;
            border-radius: 12px;
            padding: 12px 16px;
            display: flex;
            gap: 8px;
            z-index: 1000;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        `;

        toolbar.innerHTML = `
            <button onclick="PositionEditor.setTool('X'); BotRoomManager.updateEditorToolButtons('X')"
                    class="editor-tool-btn" data-tool="X"
                    style="padding:8px 16px;background:#3b82f6;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">
                X
            </button>
            <button onclick="PositionEditor.setTool('O'); BotRoomManager.updateEditorToolButtons('O')"
                    class="editor-tool-btn" data-tool="O"
                    style="padding:8px 16px;background:#ef4444;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">
                O
            </button>
            <button onclick="PositionEditor.setTool('Erase'); BotRoomManager.updateEditorToolButtons('Erase')"
                    class="editor-tool-btn" data-tool="Erase"
                    style="padding:8px 16px;background:#6b7280;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">
                🧹 Xóa
            </button>
            <div style="width:1px;background:rgba(255,255,255,0.2);margin:0 4px;"></div>
            <button onclick="PositionEditor.undo()"
                    style="padding:8px 16px;background:#f59e0b;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">
                ↩️ Undo
            </button>
            <button onclick="PositionEditor.redo()"
                    style="padding:8px 16px;background:#10b981;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">
                ↪️ Redo
            </button>
            <button onclick="PositionEditor.clear()"
                    style="padding:8px 16px;background:#ef4444;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">
                🗑️ Clear
            </button>
            <div style="width:1px;background:rgba(255,255,255,0.2);margin:0 4px;"></div>
            <button id="btn-editor-start" onclick="PositionEditor.lock(); PositionEditor.initGameFromPosition(); BotRoomManager.hideEditorToolbar();"
                    style="padding:8px 16px;background:#8b5cf6;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">
                ▶️ Bắt đầu
            </button>
            <button onclick="BotRoomManager.exitPositionEditor()"
                    style="padding:8px 16px;background:#6b7280;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">
                ❌ Thoát
            </button>
        `;

        botView.appendChild(toolbar);
        this.updateEditorToolButtons('X');
        // hookCanvasClickForEditor is called in startPositionEditor after enter()
    },

    // ══ Update Editor Tool Buttons ══════════════════════════════════════════════════════════════════
    updateEditorToolButtons: function(activeTool) {
        const buttons = document.querySelectorAll('.editor-tool-btn');
        buttons.forEach(btn => {
            const tool = btn.getAttribute('data-tool');
            if (tool === activeTool) {
                btn.style.boxShadow = '0 0 0 3px rgba(255, 255, 255, 0.5)';
                btn.style.transform = 'scale(1.05)';
            } else {
                btn.style.boxShadow = 'none';
                btn.style.transform = 'scale(1)';
            }
        });
    },

    // ══ Hide Editor Toolbar ══════════════════════════════════════════════════════════════════
    hideEditorToolbar: function() {
        const toolbar = document.getElementById('position-editor-toolbar');
        if (toolbar) {
            toolbar.style.display = 'none';
        }
    },

    // ══ Exit Position Editor ══════════════════════════════════════════════════════════════════
    exitPositionEditor: function() {
        if (typeof PositionEditor !== 'undefined') {
            PositionEditor.disable();
            PositionEditor.reset();
        }
        this.hideEditorToolbar();
        this.exitBotRoom();
    },

    // ══ Hook Canvas Click for Editor Mode ══════════════════════════════════════════════════════════════════
    hookCanvasClickForEditor: function() {
        const canvas = document.getElementById('inf-canvas-bot');
        if (!canvas) return;

        // Hook into infOnClick function
        if (typeof infOnClick !== 'undefined' && !infOnClick._editorHooked) {
            const originalInfOnClick = infOnClick;
            infOnClick._editorHooked = true;

            window.infOnClick = function(e) {
                console.log('[BotRoom] infOnClick - PositionEditor:', typeof PositionEditor !== 'undefined' ? { active: PositionEditor.active, enabled: PositionEditor.enabled } : 'undefined');
                if (typeof PositionEditor !== 'undefined' && PositionEditor.active) {
                    const rect = canvas.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    console.log('[BotRoom] Click coords:', { x, y, canvasId: canvas.id });

                    if (typeof canvasPixelToCell === 'function') {
                        const grid = canvasPixelToCell(x, y);
                        console.log('[BotRoom] Grid result:', grid);
                        if (grid) {
                            PositionEditor.placePiece(grid.r, grid.c);
                            return; // Don't call original handler
                        } else {
                            console.warn('[BotRoom] canvasPixelToCell returned null');
                        }
                    } else {
                        console.warn('[BotRoom] canvasPixelToCell function not available');
                    }
                }
                // Call original handler if not in editor mode or if editor mode failed
                return originalInfOnClick.call(this, e);
            };

            // Also update canvas.onclick to point to the new function
            // because SharedBoardUI.bindEvents() already set it to the old reference
            canvas.onclick = window.infOnClick;

            console.log('[BotRoom] infOnClick hooked for editor mode, canvas.onclick updated');
        } else {
            console.warn('[BotRoom] infOnClick not available or already hooked');
        }
    },

};

// ══════════════════════════════════════════════════════════════════
// AUTO BOT GAME HEADLESS - Chạy trận đấu thật giữa 2 bot (không render UI)
// ══════════════════════════════════════════════════════════════════
class AutoBotGameHeadless {
    constructor(options) {
        this.botXMode = options.botXMode;
        this.botOMode = options.botOMode;
        this.firstMove = options.firstMove || 'X';
        this.winCount = options.winCount || 5;
        this.blockBoth = options.blockBoth !== false;
        
        this.board = new Map(); // key: "r,c", value: "X" or "O"
        this.currentPlayer = this.firstMove;
        this.moveCount = 0;
        this.maxMoves = 225; // 15x15 board
    }

    run() {
        // Chạy synchronous until game over
        while (this.moveCount < this.maxMoves) {
            const botMode = this.currentPlayer === 'X' ? this.botXMode : this.botOMode;
            const move = this.getBotMove(botMode, this.currentPlayer);
            
            if (!move) {
                return 'draw';
            }

            const key = `${move.r},${move.c}`;
            if (this.board.has(key)) {
                // Ô đã có quân, bỏ qua
                continue;
            }

            this.board.set(key, this.currentPlayer);
            this.moveCount++;

            if (this.checkWin(move.r, move.c, this.currentPlayer)) {
                return this.currentPlayer;
            }

            this.currentPlayer = this.currentPlayer === 'X' ? 'O' : 'X';
        }

        return 'draw';
    }

    getBotMove(botMode, player) {
        const candidates = this.getCandidateMoves();

        if (candidates.length === 0) {
            return { r: 7, c: 7 };
        }

        const depth = this.getSearchDepth(botMode);
        let bestMove = null;
        let bestScore = -Infinity;

        for (const { r, c } of candidates) {
            const key = `${r},${c}`;
            this.board.set(key, player);
            
            const score = this.minimax(depth - 1, false, player, -Infinity, Infinity);
            
            this.board.delete(key);
            
            if (score > bestScore) {
                bestScore = score;
                bestMove = { r, c };
            }
        }

        return bestMove;
    }

    minimax(depth, isMaximizing, player, alpha, beta) {
        const result = this.checkGameState();
        if (result !== null) {
            return result === player ? 10000 : -10000;
        }

        if (depth === 0) {
            return this.evaluateBoard(player);
        }

        const currentPlayer = isMaximizing ? player : (player === 'X' ? 'O' : 'X');
        const candidates = this.getCandidateMoves();

        if (isMaximizing) {
            let maxScore = -Infinity;
            for (const { r, c } of candidates) {
                const key = `${r},${c}`;
                if (this.board.has(key)) continue;
                
                this.board.set(key, currentPlayer);
                const score = this.minimax(depth - 1, false, player, alpha, beta);
                this.board.delete(key);
                
                maxScore = Math.max(maxScore, score);
                alpha = Math.max(alpha, score);
                if (beta <= alpha) break;
            }
            return maxScore;
        } else {
            let minScore = Infinity;
            for (const { r, c } of candidates) {
                const key = `${r},${c}`;
                if (this.board.has(key)) continue;
                
                this.board.set(key, currentPlayer);
                const score = this.minimax(depth - 1, true, player, alpha, beta);
                this.board.delete(key);
                
                minScore = Math.min(minScore, score);
                beta = Math.min(beta, score);
                if (beta <= alpha) break;
            }
            return minScore;
        }
    }

    checkGameState() {
        for (const key of this.board.keys()) {
            const [r, c] = key.split(',').map(Number);
            const player = this.board.get(key);
            
            if (this.checkWin(r, c, player)) {
                return player;
            }
        }
        
        if (this.moveCount >= this.maxMoves) {
            return 'draw';
        }
        
        return null;
    }

    evaluateBoard(player) {
        let score = 0;
        const opponent = player === 'X' ? 'O' : 'X';
        const candidates = this.getCandidateMoves();
        
        for (const { r, c } of candidates) {
            const attackScore = this.evaluatePosition(r, c, player);
            score += attackScore;
            
            const defenseScore = this.evaluatePosition(r, c, opponent) * 0.9;
            score += defenseScore;
        }

        return score;
    }

    evaluatePosition(r, c, player) {
        let score = 0;
        const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];

        for (const [dr, dc] of directions) {
            const pattern = this.analyzePattern(r, c, player, dr, dc);
            score += this.getPatternScore(pattern);
        }

        return score;
    }

    analyzePattern(r, c, player, dr, dc) {
        let count = 1;
        let openEnds = 0;
        let blocked = 0;

        for (let i = 1; i < this.winCount; i++) {
            const nr = r + dr * i;
            const nc = c + dc * i;
            const key = `${nr},${nc}`;
            
            if (nr < 0 || nr >= 15 || nc < 0 || nc >= 15) {
                blocked++;
                break;
            }
            
            if (this.board.has(key)) {
                if (this.board.get(key) === player) {
                    count++;
                } else {
                    blocked++;
                    break;
                }
            } else {
                openEnds++;
                break;
            }
        }

        for (let i = 1; i < this.winCount; i++) {
            const nr = r - dr * i;
            const nc = c - dc * i;
            const key = `${nr},${nc}`;
            
            if (nr < 0 || nr >= 15 || nc < 0 || nc >= 15) {
                blocked++;
                break;
            }
            
            if (this.board.has(key)) {
                if (this.board.get(key) === player) {
                    count++;
                } else {
                    blocked++;
                    break;
                }
            } else {
                openEnds++;
                break;
            }
        }

        return { count, openEnds, blocked };
    }

    getPatternScore(pattern) {
        const { count, openEnds, blocked } = pattern;
        
        if (this.blockBoth && blocked === 2) {
            return 0;
        }

        if (count >= this.winCount) return 100000;
        if (count === this.winCount - 1) {
            if (openEnds === 2) return 10000;
            if (openEnds === 1) return 1000;
        }
        if (count === this.winCount - 2) {
            if (openEnds === 2) return 1000;
            if (openEnds === 1) return 100;
        }
        if (count === this.winCount - 3) {
            if (openEnds === 2) return 100;
            if (openEnds === 1) return 10;
        }
        
        return count;
    }

    getSearchDepth(botMode) {
        const depths = {
            'ai-easy': 1,
            'ai-medium': 2,
            'ai-hard': 3,
            'bot-toi-thuong': 4,
            'bot-tia-chop': 3,
            'bot-super': 5
        };
        return depths[botMode] || 2;
    }

    getCandidateMoves() {
        const candidates = [];
        const checked = new Set();

        if (this.board.size === 0) {
            return [{ r: 7, c: 7 }];
        }

        for (const key of this.board.keys()) {
            const [r, c] = key.split(',').map(Number);
            
            for (let dr = -2; dr <= 2; dr++) {
                for (let dc = -2; dc <= 2; dc++) {
                    if (dr === 0 && dc === 0) continue;
                    
                    const nr = r + dr;
                    const nc = c + dc;
                    const nkey = `${nr},${nc}`;
                    
                    if (nr >= 0 && nr < 15 && nc >= 0 && nc < 15 && !this.board.has(nkey) && !checked.has(nkey)) {
                        checked.add(nkey);
                        candidates.push({ r: nr, c: nc });
                    }
                }
            }
        }

        return candidates;
    }

    checkWin(r, c, player) {
        const directions = [
            [1, 0], [0, 1], [1, 1], [1, -1]
        ];

        for (const [dr, dc] of directions) {
            let count = 1;
            
            for (let i = 1; i < this.winCount; i++) {
                const nr = r + dr * i;
                const nc = c + dc * i;
                const key = `${nr},${nc}`;
                
                if (nr < 0 || nr >= 15 || nc < 0 || nc >= 15) break;
                if (this.board.get(key) !== player) break;
                count++;
            }
            
            for (let i = 1; i < this.winCount; i++) {
                const nr = r - dr * i;
                const nc = c - dc * i;
                const key = `${nr},${nc}`;
                
                if (nr < 0 || nr >= 15 || nc < 0 || nc >= 15) break;
                if (this.board.get(key) !== player) break;
                count++;
            }
            
            if (count >= this.winCount) {
                if (this.blockBoth) {
                    const blocked1 = this.isBlocked(r, c, dr, dc, player);
                    const blocked2 = this.isBlocked(r, c, -dr, -dc, player);
                    if (blocked1 && blocked2) {
                        continue;
                    }
                }
                return true;
            }
        }
        
        return false;
    }

    isBlocked(r, c, dr, dc, player) {
        for (let i = 1; i <= this.winCount; i++) {
            const nr = r + dr * i;
            const nc = c + dc * i;
            const key = `${nr},${nc}`;

            if (nr < 0 || nr >= 15 || nc < 0 || nc >= 15) return true;
            if (this.board.has(key)) {
                return this.board.get(key) !== player;
            }
        }
        return false;
    }
}

window.BotRoomManager = BotRoomManager;

// ══ Xử lý reload trang khi đang ở bot room ══════════════════════
// YC.TXT FIX: DISABLED - Do NOT restore BOT mode on page load
// BOT mode restore is disabled to prevent "Phòng Ma" and mode conflicts
// When F5 in BOT mode, always return to Menu BOT instead of restoring the battle
(function() {
    // Always clear any leftover BOT state on page load
    localStorage.removeItem('bot_room_mode');
    localStorage.removeItem('bot_room_config');
    localStorage.removeItem('current_room_id'); // Prevent Online reconnect from leftover state
    
    // Reset BOT flags
    window.isBotRoomMode    = false;
    window.isBotVsBotMode  = false;
    window.currentBotConfig = null;
})();
