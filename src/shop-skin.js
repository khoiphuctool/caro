// ══════════════════════════════════════════════════════════════════
// HỆ THỐNG SHOP SKIN QUÂN CỜ (CẶP O & X)
// ══════════════════════════════════════════════════════════════════

// ──────────────────────────────────────────────
// DANH SÁCH SKIN
// Mỗi skin là 1 CẶP quân (O + X), bán theo bộ
// ──────────────────────────────────────────────
const SHOP_SKIN_LIST = [
    {
        id: 'skin_default',
        name: 'Bộ Mặc Định',
        price: 0,
        icon_O: 'O', icon_X: 'X',
        color_O: null, color_X: null, // null = dùng màu theme
        preview_O: '⭕', preview_X: '✖️',
        rarity: 'free',
        desc: 'Bộ quân cờ cổ điển mặc định',
        free: true
    },
    {
        id: 'skin_neon',
        name: 'Bộ Kim Cương Neon',
        price: 2000,
        icon_O: '💎', icon_X: '⚡',
        color_O: '#00f5ff', color_X: '#ff00ff',
        preview_O: '💎', preview_X: '⚡',
        rarity: 'rare',
        desc: 'Quân cờ phát sáng neon rực rỡ',
        free: false
    },
    {
        id: 'skin_fire_ice',
        name: 'Bộ Lửa & Băng',
        price: 2500,
        icon_O: '🔥', icon_X: '❄️',
        color_O: '#ff6b35', color_X: '#4fc3f7',
        preview_O: '🔥', preview_X: '❄️',
        rarity: 'rare',
        desc: 'Đối lập giữa lửa rực và băng lạnh',
        free: false
    },
    {
        id: 'skin_gold',
        name: 'Bộ Hoàng Gia Gold',
        price: 5000,
        icon_O: '👑', icon_X: '🏆',
        color_O: '#ffd700', color_X: '#ff8c00',
        preview_O: '👑', preview_X: '🏆',
        rarity: 'epic',
        desc: 'Bộ cờ vương giả dành cho bậc đại gia',
        free: false
    },
    {
        id: 'skin_galaxy',
        name: 'Bộ Thiên Hà',
        price: 3500,
        icon_O: '🌟', icon_X: '🪐',
        color_O: '#c084fc', color_X: '#818cf8',
        preview_O: '🌟', preview_X: '🪐',
        rarity: 'epic',
        desc: 'Du hành giữa vũ trụ bao la',
        free: false
    },
    {
        id: 'skin_nature',
        name: 'Bộ Thiên Nhiên',
        price: 1500,
        icon_O: '🌸', icon_X: '🍀',
        color_O: '#f472b6', color_X: '#4ade80',
        preview_O: '🌸', preview_X: '🍀',
        rarity: 'common',
        desc: 'Hoa anh đào và lá cỏ may mắn',
        free: false
    },
    {
        id: 'skin_dragon',
        name: 'Bộ Thần Long',
        price: 8000,
        icon_O: '🐉', icon_X: '⚔️',
        color_O: '#f59e0b', color_X: '#ef4444',
        preview_O: '🐉', preview_X: '⚔️',
        rarity: 'legendary',
        desc: 'Sức mạnh của rồng thần huyền thoại',
        free: false
    },
    {
        id: 'skin_halloween',
        name: 'Bộ Ma Halloween',
        price: 3000,
        icon_O: '👻', icon_X: '🕷️',
        color_O: '#fbbf24', color_X: '#a855f7',
        preview_O: '👻', preview_X: '🕷️',
        rarity: 'rare',
        desc: 'Rùng rợn đêm Halloween',
        free: false
    },
    {
        id: 'skin_robot',
        name: 'Bộ Cyber Robot',
        price: 4000,
        icon_O: '🤖', icon_X: '💻',
        color_O: '#06b6d4', color_X: '#22d3ee',
        preview_O: '🤖', preview_X: '💻',
        rarity: 'epic',
        desc: 'Phong cách tương lai cyberpunk',
        free: false
    },
    {
        id: 'skin_food',
        name: 'Bộ Ẩm Thực',
        price: 1000,
        icon_O: '🍕', icon_X: '🍔',
        color_O: '#fb923c', color_X: '#84cc16',
        preview_O: '🍕', preview_X: '🍔',
        rarity: 'common',
        desc: 'Vui nhộn với pizza và burger',
        free: false
    },

    // ── Bộ O/X màu sắc đẹp (chữ O & X với màu gradient/đặc biệt) ──
    {
        id: 'skin_rose_gold',
        name: 'O X Hồng Vàng',
        price: 1200,
        icon_O: 'O', icon_X: 'X',
        color_O: '#f43f8e', color_X: '#f59e0b',
        preview_O: '⭕', preview_X: '✖️',
        rarity: 'common',
        desc: 'O hồng phấn, X vàng rực — sang trọng nhẹ nhàng',
        free: false
    },
    {
        id: 'skin_aqua',
        name: 'O X Aqua & Tím',
        price: 1200,
        icon_O: 'O', icon_X: 'X',
        color_O: '#06b6d4', color_X: '#8b5cf6',
        preview_O: '⭕', preview_X: '✖️',
        rarity: 'common',
        desc: 'O xanh ngọc, X tím oải hương',
        free: false
    },
    {
        id: 'skin_lime_coral',
        name: 'O X Xanh Chuối & San Hô',
        price: 1200,
        icon_O: 'O', icon_X: 'X',
        color_O: '#84cc16', color_X: '#f97316',
        preview_O: '⭕', preview_X: '✖️',
        rarity: 'common',
        desc: 'O xanh tươi, X cam san hô rực rỡ',
        free: false
    },
    {
        id: 'skin_neon_ox',
        name: 'O X Neon Xanh Lá & Hồng',
        price: 1800,
        icon_O: 'O', icon_X: 'X',
        color_O: '#00ff88', color_X: '#ff2d78',
        preview_O: '⭕', preview_X: '✖️',
        rarity: 'rare',
        desc: 'Neon điện quang — sáng rực trong bóng tối',
        free: false
    },
    {
        id: 'skin_sunset',
        name: 'O X Hoàng Hôn',
        price: 2000,
        icon_O: 'O', icon_X: 'X',
        color_O: '#ff6b6b', color_X: '#ffd93d',
        preview_O: '⭕', preview_X: '✖️',
        rarity: 'rare',
        desc: 'Màu ráng chiều tà — đỏ hồng và vàng ấm',
        free: false
    },
    {
        id: 'skin_ocean',
        name: 'O X Đại Dương',
        price: 2000,
        icon_O: 'O', icon_X: 'X',
        color_O: '#0ea5e9', color_X: '#10b981',
        preview_O: '⭕', preview_X: '✖️',
        rarity: 'rare',
        desc: 'O xanh biển sâu, X xanh lá san hô',
        free: false
    },
    {
        id: 'skin_candy',
        name: 'O X Kẹo Ngọt',
        price: 1500,
        icon_O: 'O', icon_X: 'X',
        color_O: '#ec4899', color_X: '#a78bfa',
        preview_O: '⭕', preview_X: '✖️',
        rarity: 'common',
        desc: 'Ngọt ngào như kẹo — hồng candy & tím lavender',
        free: false
    },
    {
        id: 'skin_gold_silver',
        name: 'O X Vàng & Bạc',
        price: 3000,
        icon_O: 'O', icon_X: 'X',
        color_O: '#fbbf24', color_X: '#030e2c',
        preview_O: '⭕', preview_X: '✖️',
        rarity: 'rare',
        desc: 'Cặp đôi kinh điển: vàng đen nguyên chất',
        free: false
    },
    {
        id: 'skin_matrix',
        name: 'O X Matrix',
        price: 3500,
        icon_O: 'O', icon_X: 'X',
        color_O: '#00ff41', color_X: '#f29b0e',
        preview_O: '⭕', preview_X: '✖️',
        rarity: 'epic',
        desc: 'Xanh lá matrix — cam',
        free: false
    },
    {
        id: 'skin_blood_moon',
        name: 'O X Trăng Máu',
        price: 4500,
        icon_O: 'O', icon_X: 'X',
        color_O: '#dc2626', color_X: '#7c3aed',
        preview_O: '⭕', preview_X: '✖️',
        rarity: 'epic',
        desc: 'Đỏ huyết & tím thẫm — huyền bí đêm khuya',
        free: false
    },
    {
        id: 'skin_ice_cream',
        name: 'O X Kem Sữa',
        price: 1000,
        icon_O: 'O', icon_X: 'X',
        color_O: '#fde68a', color_X: '#ff0303',
        preview_O: '⭕', preview_X: '✖️',
        rarity: 'common',
        desc: 'Vàng kem và xanh baby — đỏ dễ thương',
        free: false
    },
    {
        id: 'skin_rainbow',
        name: 'O X Cầu Vồng',
        price: 6000,
        icon_O: '🌈', icon_X: '✨',
        color_O: '#f43f5e', color_X: '#8b5cf6',
        preview_O: '🌈', preview_X: '✨',
        rarity: 'epic',
        desc: 'Rực rỡ bảy sắc cầu vồng lung linh',
        free: false
    },
    {
        id: 'skin_sakura',
        name: 'O X Hoa Anh Đào',
        price: 2800,
        icon_O: '🌺', icon_X: '🌿',
        color_O: '#f9a8d4', color_X: '#6ee7b7',
        preview_O: '🌺', preview_X: '🌿',
        rarity: 'rare',
        desc: 'Cánh anh đào hồng phai và lá xanh biếc',
        free: false
    },
    {
        id: 'skin_lava',
        name: 'O X Nham Thạch',
        price: 5500,
        icon_O: '🌋', icon_X: '💥',
        color_O: '#ff4500', color_X: '#ff8c00',
        preview_O: '🌋', preview_X: '💥',
        rarity: 'epic',
        desc: 'Nóng bỏng như dung nham núi lửa',
        free: false
    },
    {
        id: 'skin_midnight',
        name: 'O X Đêm Khuya',
        price: 2200,
        icon_O: '🌙', icon_X: '⭐',
        color_O: '#e90bdb', color_X: '#fde68a',
        preview_O: '🌙', preview_X: '⭐',
        rarity: 'rare',
        desc: 'Trăng lưỡi liềm và sao vàng trong đêm',
        free: false
    },
    {
        id: 'skin_emerald',
        name: 'O X Ngọc Lục Bảo',
        price: 7000,
        icon_O: 'O', icon_X: 'X',
        color_O: '#3b09c3', color_X: '#34d399',
        preview_O: '⭕', preview_X: '✖️',
        rarity: 'legendary',
        desc: 'Hai sắc xanh dương — hiếm như ngọc bảo',
        free: false
    },
    {
        id: 'skin_inferno',
        name: 'O X Địa Ngục',
        price: 9999,
        icon_O: '😈', icon_X: '🔱',
        color_O: '#ff2200', color_X: '#ff6600',
        preview_O: '😈', preview_X: '🔱',
        rarity: 'legendary',
        desc: 'Quyền năng tối thượng từ địa ngục hỏa diệm',
        free: false
    }
];

const SKIN_RARITY_LABEL = {
    free: { label: 'Miễn phí', color: '#6b7280', bg: '#f3f4f6' },
    common: { label: 'Thường', color: '#2563eb', bg: '#dbeafe' },
    rare: { label: 'Hiếm', color: '#7c3aed', bg: '#ede9fe' },
    epic: { label: 'Sử Thi', color: '#db2777', bg: '#fce7f3' },
    legendary: { label: 'Huyền Thoại', color: '#d97706', bg: '#fef3c7' }
};

// ──────────────────────────────────────────────
// HELPER
// ──────────────────────────────────────────────
function _skinGetUid() { return localStorage.getItem('current_user_id'); }
function _skinGetDb() { return typeof db !== 'undefined' ? db : null; }

// Lấy skin đang trang bị (trả về skin object). Luôn có fallback về default.
function getEquippedSkin() {
    const skinId = (typeof currentUserData !== 'undefined' && currentUserData)
        ? (currentUserData.equippedSkin || 'skin_default')
        : 'skin_default';
    return SHOP_SKIN_LIST.find(s => s.id === skinId) || SHOP_SKIN_LIST[0];
}
window.getEquippedSkin = getEquippedSkin;

// Lấy icon quân cờ theo skin hiện tại (trả về text/emoji)
function getSkinIcon(piece) {
    const skin = getEquippedSkin();
    return piece === 'X' ? skin.icon_X : skin.icon_O;
}
window.getSkinIcon = getSkinIcon;

// Lấy màu quân cờ theo skin (null = dùng màu theme)
function getSkinColor(piece) {
    const skin = getEquippedSkin();
    return piece === 'X' ? skin.color_X : skin.color_O;
}
window.getSkinColor = getSkinColor;

// Kiểm tra skin có dùng emoji icon không (khác với text O/X)
function skinUsesEmoji() {
    const skin = getEquippedSkin();
    return skin.icon_X !== 'X' || skin.icon_O !== 'O';
}
window.skinUsesEmoji = skinUsesEmoji;

// ──────────────────────────────────────────────
// MỞ / ĐÓNG MODAL SHOP SKIN
// ──────────────────────────────────────────────
function moShopSkin() {
    const modal = document.getElementById('shop-skin-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    renderShopSkin();
}
window.moShopSkin = moShopSkin;

function dongShopSkin() {
    const modal = document.getElementById('shop-skin-modal');
    if (modal) modal.style.display = 'none';
}
window.dongShopSkin = dongShopSkin;

// ──────────────────────────────────────────────
// RENDER SHOP SKIN UI
// ──────────────────────────────────────────────
function renderShopSkin() {
    const grid = document.getElementById('shop-skin-grid');
    if (!grid) return;

    const userData = (typeof currentUserData !== 'undefined' && currentUserData) ? currentUserData : {};
    const ownedSkins = userData.ownedSkins || ['skin_default'];
    const equippedSkinId = userData.equippedSkin || 'skin_default';
    const coins = typeof getMyCoins === 'function' ? getMyCoins() : 0;

    const xuEl = document.getElementById('shop-skin-xu-display');
    if (xuEl) xuEl.textContent = coins.toLocaleString('vi-VN') + ' Xu';

    grid.innerHTML = SHOP_SKIN_LIST.map(skin => {
        const isOwned = skin.free || ownedSkins.includes(skin.id);
        const isEquipped = equippedSkinId === skin.id;
        const rarity = SKIN_RARITY_LABEL[skin.rarity] || SKIN_RARITY_LABEL.common;
        const canAfford = coins >= skin.price;

        let btnHtml = '';
        if (isEquipped) {
            btnHtml = `<button class="skin-btn skin-equipped" disabled>✅ Đang dùng</button>`;
        } else if (isOwned) {
            btnHtml = `<button class="skin-btn skin-use" onclick="trangBiSkin('${skin.id}')">Trang bị</button>`;
        } else {
            btnHtml = `<button class="skin-btn skin-buy ${canAfford ? '' : 'skin-cant-afford'}" onclick="muaSkin('${skin.id}')">
                🛒 ${skin.price.toLocaleString('vi-VN')} Xu
            </button>`;
        }

        const xColor = skin.color_X ? `color:${skin.color_X};` : '';
        const oColor = skin.color_O ? `color:${skin.color_O};` : '';
        return `<div class="skin-card ${isEquipped ? 'skin-card-equipped' : ''} ${!isOwned ? 'skin-card-locked' : ''}">
            <div class="skin-preview">
                <span class="skin-piece-o" style="${oColor}">${skin.icon_O}</span>
                <span class="skin-vs">vs</span>
                <span class="skin-piece-x" style="${xColor}">${skin.icon_X}</span>
            </div>
            <div class="skin-name">${skin.name}</div>
            <div class="skin-desc">${skin.desc}</div>
            <span class="skin-rarity-badge" style="color:${rarity.color};background:${rarity.bg};">${rarity.label}</span>
            ${!isOwned ? '<div class="skin-lock-icon">🔒</div>' : ''}
            ${btnHtml}
        </div>`;
    }).join('');
}

// ──────────────────────────────────────────────
// MUA SKIN
// ──────────────────────────────────────────────
function muaSkin(skinId) {
    const uid = _skinGetUid();
    const database = _skinGetDb();
    if (!uid || !database) { alert('Bạn cần đăng nhập để mua!'); return; }

    const skin = SHOP_SKIN_LIST.find(s => s.id === skinId);
    if (!skin) return;

    const coins = typeof getMyCoins === 'function' ? getMyCoins() : 0;
    if (coins < skin.price) {
        alert(`Không đủ Xu! Cần ${skin.price.toLocaleString('vi-VN')} Xu, bạn có ${coins.toLocaleString('vi-VN')} Xu.`);
        return;
    }

    const userData = (typeof currentUserData !== 'undefined' && currentUserData) ? currentUserData : {};
    const ownedSkins = userData.ownedSkins || ['skin_default'];
    if (ownedSkins.includes(skinId)) { alert('Bạn đã sở hữu bộ skin này!'); return; }

    // Trừ xu bằng transaction (atomic), rồi thêm skin
    database.ref(`users/${uid}/coins`).transaction(cur => {
        const c = cur || 0;
        if (c < skin.price) return; // abort nếu không đủ
        return c - skin.price;
    }).then(res => {
        if (!res.committed) {
            alert('Không đủ Xu hoặc có lỗi xảy ra!');
            return;
        }
        const newOwned = [...ownedSkins, skinId];
        return database.ref(`users/${uid}/ownedSkins`).set(newOwned).then(() => {
            if (typeof showXuPopup === 'function') showXuPopup(-skin.price, `Mua skin ${skin.icon_X}${skin.icon_O}`);
            if (typeof enqueueNotification === 'function') {
                enqueueNotification('system_events', { type: 'win', message: `🛍️ Mua thành công bộ skin "${skin.name}"!` });
            }
            renderShopSkin();
        });
    });
}
window.muaSkin = muaSkin;

// ──────────────────────────────────────────────
// TRANG BỊ SKIN
// ──────────────────────────────────────────────
function trangBiSkin(skinId) {
    const uid = _skinGetUid();
    const database = _skinGetDb();
    if (!uid || !database) return;

    const skin = SHOP_SKIN_LIST.find(s => s.id === skinId);
    if (!skin) return;

    database.ref(`users/${uid}/equippedSkin`).set(skinId).then(() => {
        if (typeof enqueueNotification === 'function') {
            enqueueNotification('system_events', { type: 'win', message: `✅ Đã trang bị bộ cờ "${skin.name}" (${skin.icon_X} & ${skin.icon_O})` });
        }
        renderShopSkin();
        // Render lại bàn cờ để áp dụng skin mới ngay lập tức
        // YC.TXT FIX: Only render if canvas is ready
        if (typeof renderInfiniteBoard === 'function' && typeof infCanvas !== 'undefined' && infCanvas && typeof infCtx !== 'undefined' && infCtx) {
            renderInfiniteBoard();
        }
    });
}
window.trangBiSkin = trangBiSkin;

// ──────────────────────────────────────────────
// KHỞI TẠO: Đảm bảo skin_default luôn có trong ownedSkins
// ──────────────────────────────────────────────
function initSkinSystem(uid) {
    const database = _skinGetDb();
    if (!uid || !database) return;
    database.ref(`users/${uid}/ownedSkins`).once('value').then(snap => {
        const owned = snap.val();
        if (!owned) {
            database.ref(`users/${uid}/ownedSkins`).set(['skin_default']);
        } else if (!owned.includes('skin_default')) {
            database.ref(`users/${uid}/ownedSkins`).set(['skin_default', ...owned]);
        }
    });
}
window.initSkinSystem = initSkinSystem;

// ──────────────────────────────────────────────
// LẤY SKIN THEO ID (dùng cho skin của đối thủ online)
// ──────────────────────────────────────────────
function getSkinById(skinId) {
    return SHOP_SKIN_LIST.find(s => s.id === skinId) || SHOP_SKIN_LIST[0];
}
window.getSkinById = getSkinById;

// Lấy icon/màu quân cờ theo skinId cụ thể (không phụ thuộc skin đang trang bị của mình)
function getSkinIconById(skinId, piece) {
    const skin = getSkinById(skinId);
    return piece === 'X' ? skin.icon_X : skin.icon_O;
}
window.getSkinIconById = getSkinIconById;

function getSkinColorById(skinId, piece) {
    const skin = getSkinById(skinId);
    return piece === 'X' ? skin.color_X : skin.color_O;
}
window.getSkinColorById = getSkinColorById;

// ──────────────────────────────────────────────
// LẤY AVATAR & SKIN CỦA MÌNH ĐỂ ĐỒNG BỘ LÊN PHÒNG
// ──────────────────────────────────────────────
function getMyPublicProfile() {
    const userData = (typeof currentUserData !== 'undefined' && currentUserData) ? currentUserData : {};
    // Avatar: ưu tiên equippedAvatar (từ shop avatar), fallback avatar cũ, fallback chữ cái đầu
    let avatarId = userData.equippedAvatar || null;
    let avatarDisplay = '';
    if (avatarId && typeof SHOP_AVATAR_LIST !== 'undefined') {
        const avDef = SHOP_AVATAR_LIST.find(a => a.id === avatarId);
        if (avDef) avatarDisplay = avDef.emoji;
    }
    if (!avatarDisplay && userData.avatar) avatarDisplay = userData.avatar;
    if (!avatarDisplay) {
        const name = userData.displayName || userData.username || '?';
        avatarDisplay = name[0].toUpperCase();
    }
    return {
        avatarDisplay,
        skinId: userData.equippedSkin || 'skin_default'
    };
}
window.getMyPublicProfile = getMyPublicProfile;
