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
        { id: 6, name: 'Bot Siêu Phẩm',  emoji: '🌟', color: '#8b5cf6', gameMode: 'bot-super',       description: 'Thách thức đặc biệt (mở theo nhiệm vụ)' },
        { id: 7, name: 'Bot vs Bot',     emoji: '🤖', color: '#8b5cf6', gameMode: 'bot-vs-bot',      description: 'Chọn 2 bot cho X/O, trận đấu tự động' },
        { id: 8, name: 'Sắp ra mắt',    emoji: '🔒', color: '#94a3b8', gameMode: null,             description: 'Mở khóa theo nhiệm vụ' },
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
            window.onWinBotXu(gameMode);
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
    }
};

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
