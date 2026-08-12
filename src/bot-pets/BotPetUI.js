// ══════════════════════════════════════════════════════════════════
// BOT PET UI - RENDER SHOP UI & COMPANION UI
// ══════════════════════════════════════════════════════════════════

// ──────────────────────────────────────────────
// MỞ / ĐÓNG MODAL SHOP BOT PET
// ──────────────────────────────────────────────
function moShopBotPet() {
    const modal = document.getElementById('shop-bot-pet-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    renderShopBotPet();
}
window.moShopBotPet = moShopBotPet;

function dongShopBotPet() {
    const modal = document.getElementById('shop-bot-pet-modal');
    if (modal) modal.style.display = 'none';
}
window.dongShopBotPet = dongShopBotPet;

// ──────────────────────────────────────────────
// RENDER SHOP BOT PET UI
// ──────────────────────────────────────────────
function renderShopBotPet() {
    const grid = document.getElementById('shop-bot-pet-grid');
    if (!grid) return;
    
    // Reload userData từ Firebase để có dữ liệu mới nhất
    const uid = (typeof _botPetGetUid === 'function') ? _botPetGetUid() : null;
    const database = (typeof _botPetGetDb === 'function') ? _botPetGetDb() : null;
    
    if (uid && database) {
        database.ref(`users/${uid}`).once('value').then(snap => {
            const userData = snap.val() || {};
            const owned = userData.ownedBotPets || [];
            const equippedBotPetId = userData.equippedBotPet || null;
            const coins = userData.coins || 0;
            
            // Update currentUserData
            if (typeof currentUserData !== 'undefined') {
                Object.assign(currentUserData, userData);
            }
            
            renderBotPetGrid(grid, owned, equippedBotPetId, coins);
        });
    } else {
        // Fallback nếu chưa đăng nhập
        renderBotPetGrid(grid, [], null, 0);
    }
}
window.renderShopBotPet = renderShopBotPet;

function renderBotPetGrid(grid, owned, equippedBotPetId, coins) {
    const xuEl = document.getElementById('shop-bot-pet-xu-display');
    if (xuEl) xuEl.textContent = coins.toLocaleString('vi-VN') + ' Xu';
    
    grid.innerHTML = BOT_PET_CATALOG.map(botPet => {
        const isOwned = owned.includes(botPet.id);
        const isEquipped = equippedBotPetId === botPet.id;
        const rarity = BOT_PET_RARITY_LABEL[botPet.rarity] || BOT_PET_RARITY_LABEL.common;
        const canAfford = coins >= botPet.price;
        
        let btnHtml = '';
        if (isEquipped) {
            btnHtml = `
                <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;">
                    <button class="bot-pet-btn bot-pet-equipped" disabled>✅ Đang trang bị</button>
                    <button class="bot-pet-btn bot-pet-unequip" onclick="boTrangBiBotPet()">Gỡ trang bị</button>
                </div>
            `;
        } else if (isOwned) {
            btnHtml = `<button class="bot-pet-btn bot-pet-equip" onclick="trangBiBotPet('${botPet.id}')">Trang bị</button>`;
        } else {
            btnHtml = `<button class="bot-pet-btn bot-pet-buy ${canAfford ? '' : 'bot-pet-cant-afford'}" onclick="muaBotPet('${botPet.id}')">
                🛒 ${botPet.price.toLocaleString('vi-VN')} Xu
            </button>`;
        }
        
        return `<div class="bot-pet-card ${isEquipped ? 'bot-pet-card-equipped' : ''} ${!isOwned ? 'bot-pet-card-locked' : ''}">
            <div class="bot-pet-avatar">${botPet.avatar}</div>
            <div class="bot-pet-name">${botPet.name}</div>
            <div class="bot-pet-desc">${botPet.description}</div>
            <span class="bot-pet-rarity-badge" style="color:${rarity.color};background:${rarity.bg};">${rarity.label}</span>
            ${!isOwned ? '<div class="bot-pet-lock-icon">🔒</div>' : ''}
            ${btnHtml}
        </div>`;
    }).join('');
}

// ──────────────────────────────────────────────
// COMPACT BOT PET UI — inject vào player-details
// Không dùng overlay/panel lớn riêng
// ──────────────────────────────────────────────

const BOT_PET_COMPACT_ID = 'bot-pet-compact-row';

/** Tìm container .pc-body trong #bot-player-overlay để nhúng compact row */
function _getBotPetHostEl() {
    const candidates = [
        '#bot-player-overlay .bot-player-details .pc-body',
        '#bot-player-overlay .pc-body',
        '#bot-player-details .pc-body',
        '.bot-player-details .pc-body',
        '.players-panel .pc-body',
        '.player-card .pc-body',
        '.battle-player-details .pc-body',
        '#game-board .pc-body',
        '#board-wrapper .pc-body',
        '#board-panel .pc-body'
    ];

    for (const selector of candidates) {
        const el = document.querySelector(selector);
        if (el) return el;
    }

    const fallbackId = 'bot-pet-fallback-host';
    let fallback = document.getElementById(fallbackId);
    if (!fallback) {
        fallback = document.createElement('div');
        fallback.id = fallbackId;
        fallback.style.position = 'relative';
        fallback.style.zIndex = '12';
        document.body.appendChild(fallback);
    }
    return fallback;
}

/** Đảm bảo compact row tồn tại trong host, trả về element */
function _ensureBotPetCompactEl() {
    const host = _getBotPetHostEl();
    if (!host) return null;
    let row = host.querySelector('#' + BOT_PET_COMPACT_ID);
    if (!row) {
        row = document.createElement('div');
        row.id = BOT_PET_COMPACT_ID;
        row.className = 'bot-pet-compact';
        host.appendChild(row);
    }
    return row;
}

// ──────────────────────────────────────────────
// UPDATE BOT PET COMPANION UI IN MATCH
// ──────────────────────────────────────────────
function updateBotPetUI() {
    const row = _ensureBotPetCompactEl();
    if (!row) {
        if (window.DEBUG_BOT_RUNTIME) console.log('[BotPetUI] updateBotPetUI: host .pc-body not found');
        return;
    }

    const state = getMatchBotPetState();
    const botPet = getMatchBotPet();

    if (!botPet || !state.equippedBotPet) {
        // Không có pet — ẩn row, không hiện gì
        row.style.display = 'none';
        if (window.DEBUG_BOT_RUNTIME) console.log('[BotPetUI] compact hidden — no equipped pet');
        return;
    }

    row.style.display = '';
    const isActive = state.active;
    row.innerHTML = `
        <div class="bpc-info">
            <span class="bpc-icon">${botPet.avatar}</span>
            <span class="bpc-name">${botPet.name}</span>
            <span class="bpc-status ${isActive ? 'bpc-on' : 'bpc-off'}">${isActive ? '● BẬT' : '○ TẮT'}</span>
        </div>
        <button class="bpc-toggle ${isActive ? 'bpc-toggle-off' : 'bpc-toggle-on'}"
                onclick="toggleBotPetActive()">${isActive ? 'TẮT' : 'BẬT'}</button>
    `;

    if (window.DEBUG_BOT_RUNTIME) {
        console.log('[BotPetUI] compact mounted in', row.parentElement?.className,
            '| pet =', state.equippedBotPet, '| active =', state.active);
    }
}
window.updateBotPetUI = updateBotPetUI;

// ──────────────────────────────────────────────
// SHOW BOT PET COMPANION UI
// ──────────────────────────────────────────────
function showBotPetCompanion() {
    const isOnline = typeof window !== 'undefined' && typeof window.isOnlineModeActive === 'function' && window.isOnlineModeActive();
    if (isOnline) {
        if (typeof mountOnlineBotPets === 'function') mountOnlineBotPets();
        return;
    }

    initMatchBotPetState();
    const host = _getBotPetHostEl();
    if (!host) {
        if (window.DEBUG_BOT_RUNTIME) console.log('[BotPetUI] showBotPetCompanion: host not ready, retrying...');
        setTimeout(() => { initMatchBotPetState(); updateBotPetUI(); }, 300);
        return;
    }
    if (window.DEBUG_BOT_RUNTIME) console.log('[BotPetUI] battle view detected | container =', host.className);
    updateBotPetUI();
}
window.showBotPetCompanion = showBotPetCompanion;

// ──────────────────────────────────────────────
// HIDE BOT PET COMPANION UI
// ──────────────────────────────────────────────
function hideBotPetCompanion() {
    const isOnline = typeof window !== 'undefined' && typeof window.isOnlineModeActive === 'function' && window.isOnlineModeActive();
    if (isOnline) {
        if (typeof unmountOnlineBotPets === 'function') unmountOnlineBotPets();
        return;
    }

    // Remove compact rows from all possible hosts
    document.querySelectorAll('#' + BOT_PET_COMPACT_ID).forEach(el => el.remove());
    cleanupMatchBotPetState();
}
window.hideBotPetCompanion = hideBotPetCompanion;

// ══════════════════════════════════════════════════════════════════
// ONLINE PVP BOT PET UI
// Pet là companion/visual — KHÔNG thay đổi AI, gameMode, engine
// ══════════════════════════════════════════════════════════════════

const ONLINE_PET_COMPACT_PREFIX = 'bot-pet-compact-online-';

// State online riêng — KHÔNG dùng chung matchBotPetState (offline)
// runtimeProfile luôn null trong online PvP
let _onlinePetState = {
    x: { equippedPetId: null, active: false },
    o: { equippedPetId: null, active: false }
};

/** Lấy .battle-player-details của player X hoặc O trong #view-battle */
function _getOnlinePetHostEl(role) {
    const roleLC = (role || '').toLowerCase();
    const side = roleLC === 'x' ? 'left' : 'right';
    const overlay = document.getElementById('battle-player-overlay-' + side);
    if (!overlay) return null;
    return overlay.querySelector('.battle-player-details') || null;
}

/** Đảm bảo compact row tồn tại (tối đa 1 per player), trả về element */
function _ensureOnlinePetCompactEl(role) {
    const host = _getOnlinePetHostEl(role);
    if (!host) return null;
    const id = ONLINE_PET_COMPACT_PREFIX + role.toLowerCase();
    let row = host.querySelector('#' + id);
    if (!row) {
        row = document.createElement('div');
        row.id = id;
        row.className = 'bot-pet-compact';
        host.appendChild(row);
    }
    return row;
}

/** Render compact online pet cho một player (X hoặc O).
 *  equippedPetData: null → không render / ẩn
 *  Không gọi toggleBotPetActive() (offline), dùng toggleOnlinePetActive(role)
 */
function _renderOnlinePetCompact(role) {
    const roleLC = (role || '').toLowerCase();
    const state = _onlinePetState[roleLC];
    if (!state) return;

    const host = _getOnlinePetHostEl(roleLC);
    if (!host) return;

    const id = ONLINE_PET_COMPACT_PREFIX + roleLC;
    // Xóa row cũ trước khi render lại — tránh duplicate khi host bị re-render bởi Firebase
    const existing = document.getElementById(id);
    if (existing && existing.parentElement !== host) existing.remove();

    if (!state.equippedPetId) {
        // Không có pet — xóa row nếu còn
        const orphan = host.querySelector('#' + id);
        if (orphan) orphan.remove();
        return;
    }

    const botPet = (typeof getBotPetById === 'function') ? getBotPetById(state.equippedPetId) : null;
    if (!botPet) return;

    const row = _ensureOnlinePetCompactEl(roleLC);
    if (!row) return;

    const isActive = state.active;
    // Toggle chỉ bật/tắt visual — KHÔNG đổi gameMode, AI, engine
    // Chỉ host (myRole) mới được toggle pet của chính mình
    const isMyRole = (typeof myRole !== 'undefined') ? myRole.toLowerCase() === roleLC : false;
    const toggleBtn = isMyRole
        ? `<button class="bpc-toggle ${isActive ? 'bpc-toggle-off' : 'bpc-toggle-on'}"
                   onclick="toggleOnlinePetActive('${roleLC}')">${isActive ? 'TẮT' : 'BẬT'}</button>`
        : '';

    row.style.display = '';
    row.innerHTML = `
        <div class="bpc-info">
            <span class="bpc-icon">${botPet.avatar}</span>
            <span class="bpc-name">${botPet.name}</span>
            <span class="bpc-status ${isActive ? 'bpc-on' : 'bpc-off'}">${isActive ? '● BẬT' : '○ TẮT'}</span>
        </div>
        ${toggleBtn}
    `;

    if (window.DEBUG_BOT_RUNTIME) {
        console.log(`[OnlinePetUI] rendered role=${roleLC} pet=${state.equippedPetId} active=${isActive}`);
    }
}

/**
 * Toggle visual active/off cho online pet của player role.
 * KHÔNG đổi gameMode, AI, engine, runtimeProfile.
 */
function toggleOnlinePetActive(role) {
    const roleLC = (role || '').toLowerCase();
    if (!_onlinePetState[roleLC]) return;
    _onlinePetState[roleLC].active = !_onlinePetState[roleLC].active;
    // runtimeProfile luôn null trong Online PvP — đảm bảo không bị set
    _renderOnlinePetCompact(roleLC);
}
window.toggleOnlinePetActive = toggleOnlinePetActive;

/**
 * Mount Bot Pet compact vào cả 2 player overlay khi vào Online Room.
 * - Không tạo overlay mới, không fixed panel, không che bàn cờ
 * - runtimeProfile luôn null
 * - Không đổi gameMode, AIController, botMode
 * Gọi sau khi batDauGiaoDienOnline() chạy xong (DOM đã ready)
 */
function mountOnlineBotPets() {
    // Luôn cleanup trước để tránh duplicate khi rejoin
    _unmountOnlinePetRole('x');
    _unmountOnlinePetRole('o');

    // Reset state — runtimeProfile = null (luôn luôn)
    _onlinePetState = {
        x: { equippedPetId: null, active: false },
        o: { equippedPetId: null, active: false }
    };

    // Lấy pet của chính mình từ currentUserData
    const myEquipped = (typeof getEquippedBotPet === 'function') ? getEquippedBotPet() : null;
    const myRoleVal  = (typeof myRole !== 'undefined') ? (myRole || '').toLowerCase() : null;

    if (myRoleVal && myEquipped) {
        _onlinePetState[myRoleVal] = {
            equippedPetId: myEquipped.id,
            active: false  // bắt đầu ở OFF
        };
    }

    // Render sau khi DOM sẵn sàng
    const _doRender = () => {
        if (_getOnlinePetHostEl('x') || _getOnlinePetHostEl('o')) {
            _renderOnlinePetCompact('x');
            _renderOnlinePetCompact('o');
            if (window.DEBUG_BOT_RUNTIME) console.log('[OnlinePetUI] mountOnlineBotPets done', _onlinePetState);
        } else {
            setTimeout(() => {
                _renderOnlinePetCompact('x');
                _renderOnlinePetCompact('o');
            }, 400);
        }
    };
    setTimeout(_doRender, 100);
}
window.mountOnlineBotPets = mountOnlineBotPets;

/**
 * Gọi khi Firebase cập nhật thông tin đối thủ (opponent joined / room state update).
 * Đặt equippedPet của opponent nếu có — chỉ visual, không runtimeProfile.
 * role: 'X' | 'O', petId: string | null
 * Nếu role là chính mình (myRole), không overwrite — mountOnlineBotPets đã xử lý rồi.
 */
function setOpponentOnlinePet(role, petId) {
    const roleLC = (role || '').toLowerCase();
    if (!_onlinePetState[roleLC]) return;
    // Không overwrite pet của chính mình — đã được set bởi mountOnlineBotPets
    const myRoleVal = (typeof myRole !== 'undefined') ? (myRole || '').toLowerCase() : null;
    if (myRoleVal && myRoleVal === roleLC) return;
    _onlinePetState[roleLC].equippedPetId = petId || null;
    _onlinePetState[roleLC].active = false;
    // Đảm bảo không tạo runtimeProfile
    _renderOnlinePetCompact(roleLC);
}
window.setOpponentOnlinePet = setOpponentOnlinePet;

/**
 * Gọi sau mỗi lần Firebase update player info (tránh duplicate khi host bị re-render).
 * Chỉ re-render pet đã có trong state, không reset state.
 */
function refreshOnlineBotPetUI() {
    // Kiểm tra không ở offline bot room
    const currentMode = typeof GameModeManager !== 'undefined' && typeof GameModeManager.getCurrentMode === 'function'
        ? GameModeManager.getCurrentMode()
        : null;
    const isOnline = currentMode === 'online' || (typeof GameModes !== 'undefined' && currentMode === GameModes.ONLINE);
    if (!isOnline) return;

    _renderOnlinePetCompact('x');
    _renderOnlinePetCompact('o');
}
window.refreshOnlineBotPetUI = refreshOnlineBotPetUI;

/** Xóa compact row của một role */
function _unmountOnlinePetRole(role) {
    const roleLC = (role || '').toLowerCase();
    const id = ONLINE_PET_COMPACT_PREFIX + roleLC;
    document.querySelectorAll('#' + id).forEach(el => el.remove());
}

/** Cleanup toàn bộ online pet UI khi rời phòng */
function unmountOnlineBotPets() {
    _unmountOnlinePetRole('x');
    _unmountOnlinePetRole('o');
    _onlinePetState = {
        x: { equippedPetId: null, active: false },
        o: { equippedPetId: null, active: false }
    };
    if (window.DEBUG_BOT_RUNTIME) console.log('[OnlinePetUI] unmountOnlineBotPets: cleaned up');
}
window.unmountOnlineBotPets = unmountOnlineBotPets;
