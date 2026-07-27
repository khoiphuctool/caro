// ══════════════════════════════════════════════════════════════════
// HỆ THỐNG SHOP BÀN CỜ (BOARD SKINS)
// ══════════════════════════════════════════════════════════════════

// ──────────────────────────────────────────────
// DANH SÁCH BOARD SKINS
// ──────────────────────────────────────────────
const SHOP_BOARD_SKIN_LIST = [
    {
        id: 'board_default',
        name: 'Bàn Cờ Trắng Kinh Điển',
        price: 0,
        bg: '#ffffff',
        grid: '#94a3b8',
        win: '#dbeafe',
        lastMove: '#f59e0b',
        preview: '⬜',
        rarity: 'free',
        desc: 'Bàn cờ trắng sạch sẽ, dễ nhìn',
        free: true
    },
    {
        id: 'board_black',
        name: 'Bàn Cờ Đen Huyền Bí',
        price: 5000,
        bg: '#1a1a2e',
        grid: '#6b6b90',
        win: '#3730a3',
        lastMove: '#f59e0b',
        preview: '⬛',
        rarity: 'common',
        desc: 'Bàn cờ đen sang trọng, dễ chịu mắt',
        free: false
    },
    {
        id: 'board_cyber',
        name: 'Bàn Cờ Cyber Neon',
        price: 10000,
        bg: '#0f172a',
        grid: '#475569',
        win: '#0284c7',
        lastMove: '#f43f5e',
        preview: '🌐',
        rarity: 'rare',
        desc: 'Bàn cờ phong cách công nghệ tương lai',
        free: false
    },
    {
        id: 'board_wood',
        name: 'Bàn Cờ Gỗ Thượng Lưu',
        price: 15000,
        bg: '#c2996b',
        grid: '#5c3d2e',
        win: '#b08556',
        lastMove: '#ffd700',
        preview: '🪵',
        rarity: 'rare',
        desc: 'Bàn cờ gỗ sang trọng, cổ điển',
        free: false
    },
    {
        id: 'board_ocean',
        name: 'Bàn Cờ Đại Dương',
        price: 20000,
        bg: '#0c4a6e',
        grid: '#7dd3fc',
        win: '#0369a1',
        lastMove: '#38bdf8',
        preview: '🌊',
        rarity: 'epic',
        desc: 'Bàn cờ xanh biển mát mẻ, thư giãn',
        free: false
    },
    {
        id: 'board_forest',
        name: 'Bàn Cờ Rừng Sâu',
        price: 25000,
        bg: '#14532d',
        grid: '#4ade80',
        win: '#166534',
        lastMove: '#22c55e',
        preview: '🌲',
        rarity: 'epic',
        desc: 'Bàn cờ xanh rừng thiên nhiên',
        free: false
    },
    {
        id: 'board_sunset',
        name: 'Bàn Cờ Hoàng Hôn',
        price: 30000,
        bg: '#4c1d95',
        grid: '#fbbf24',
        win: '#7c3aed',
        lastMove: '#f59e0b',
        preview: '🌅',
        rarity: 'epic',
        desc: 'Bàn cờ tím vàng hoàng hôn rực rỡ',
        free: false
    },
    {
        id: 'board_dragon',
        name: 'Bàn Cờ Rồng Thần',
        price: 50000,
        bg: '#1f2937',
        grid: '#ef4444',
        win: '#dc2626',
        lastMove: '#f59e0b',
        preview: '🐉',
        rarity: 'legendary',
        desc: 'Bàn cờ rồng thần quyền lực',
        free: false
    },
    {
        id: 'board_galaxy',
        name: 'Bàn Cờ Thiên Hà',
        price: 40000,
        bg: '#0f172a',
        grid: '#c084fc',
        win: '#7c3aed',
        lastMove: '#8b5cf6',
        preview: '🌌',
        rarity: 'legendary',
        desc: 'Bàn cờ vũ trụ bao la huyền bí',
        free: false
    },
    {
        id: 'board_crystal',
        name: 'Bàn Cờ Pha Lê',
        price: 35000,
        bg: '#e0f2fe',
        grid: '#0ea5e9',
        win: '#0284c7',
        lastMove: '#38bdf8',
        preview: '💎',
        rarity: 'legendary',
        desc: 'Bàn cờ pha lê trong suốt lấp lánh',
        free: false
    },
    {
        id: 'board_lava',
        name: 'Bàn Cờ Núi Lửa',
        price: 45000,
        bg: '#1c1917',
        grid: '#f97316',
        win: '#c2410c',
        lastMove: '#fbbf24',
        preview: '🌋',
        rarity: 'legendary',
        desc: 'Bàn cờ núi lửa nóng rực',
        free: false
    },
    {
        id: 'board_aurora',
        name: 'Bàn Cờ Cực Quang',
        price: 60000,
        bg: '#022c22',
        grid: '#4ade80',
        win: '#16a34a',
        lastMove: '#22c55e',
        preview: '✨',
        rarity: 'mythic',
        desc: 'Bàn cờ cực quang huyền thoại',
        free: false
    }
];

// ──────────────────────────────────────────────
// HELPER FUNCTIONS (giống shop-skin.js)
// ──────────────────────────────────────────────
function _skinGetUid() { return localStorage.getItem('current_user_id'); }
function _skinGetDb() { return typeof db !== 'undefined' ? db : null; }
function _skinGetUserData() {
    const uid = _skinGetUid();
    if (!uid) return {};
    const database = _skinGetDb();
    if (!database) return {};
    // Trả về currentUserData nếu có (không cần check uid vì currentUserData luôn là của user hiện tại)
    if (typeof currentUserData !== 'undefined' && currentUserData) {
        return currentUserData;
    }
    // Nếu không có currentUserData, reload từ Firebase
    database.ref(`users/${uid}`).once('value').then(snap => {
        const data = snap.val();
        if (data && typeof currentUserData !== 'undefined') {
            Object.assign(currentUserData, data);
        }
    });
    return {};
}

// ──────────────────────────────────────────────
// LẤY SKIN ĐANG TRANG BỊ
// ──────────────────────────────────────────────
function getEquippedBoardSkin() {
    const userData = (typeof _skinGetUserData === 'function') ? _skinGetUserData() : {};
    console.log('[DEBUG-BOARD-SKIN] getEquippedBoardSkin - userData:', userData);
    const equippedId = userData.equippedBoardSkin || 'board_default';
    console.log('[DEBUG-BOARD-SKIN] getEquippedBoardSkin - equippedId:', equippedId);
    const skin = getBoardSkinById(equippedId) || SHOP_BOARD_SKIN_LIST[0];
    console.log('[DEBUG-BOARD-SKIN] getEquippedBoardSkin - returned skin:', skin);
    return skin;
}
window.getEquippedBoardSkin = getEquippedBoardSkin;

// ──────────────────────────────────────────────
// LẤY BOARD SKIN THEO ID
// ──────────────────────────────────────────────
function getBoardSkinById(skinId) {
    return SHOP_BOARD_SKIN_LIST.find(s => s.id === skinId) || SHOP_BOARD_SKIN_LIST[0];
}
window.getBoardSkinById = getBoardSkinById;

// ──────────────────────────────────────────────
// KIỂM TRA ĐÃ SỞ HỮU SKIN CHƯA
// ──────────────────────────────────────────────
function hasBoardSkin(skinId) {
    // Kiểm tra trực tiếp từ currentUserData (đã được cập nhật sau khi mua)
    if (typeof currentUserData !== 'undefined' && currentUserData) {
        const owned = currentUserData.ownedBoardSkins || [];
        if (owned.includes(skinId) || skinId === 'board_default') return true;
    }
    // Fallback: kiểm tra từ _skinGetUserData
    const userData = (typeof _skinGetUserData === 'function') ? _skinGetUserData() : {};
    const owned = userData.ownedBoardSkins || [];
    return owned.includes(skinId) || skinId === 'board_default';
}
window.hasBoardSkin = hasBoardSkin;

// ──────────────────────────────────────────────
// MUA BOARD SKIN
// ──────────────────────────────────────────────
function muaBoardSkin(skinId) {
    const skin = getBoardSkinById(skinId);
    if (!skin) return;
    
    if (skin.free) {
        alert('Skin này miễn phí!');
        return;
    }
    
    if (hasBoardSkin(skinId)) {
        alert('Bạn đã sở hữu skin này rồi!');
        return;
    }
    
    // Sử dụng cách lấy uid giống shop-skin.js
    const uid = (typeof _skinGetUid === 'function') ? _skinGetUid() : null;
    const database = (typeof _skinGetDb === 'function') ? _skinGetDb() : null;
    if (!uid || !database) {
        alert('Bạn cần đăng nhập để mua skin!');
        return;
    }
    
    const price = skin.price;
    const currentXu = typeof getMyCoins === 'function' ? getMyCoins() : 0;
    
    if (currentXu < price) {
        alert(`Bạn không đủ xu! Cần ${price.toLocaleString('vi-VN')} Xu.`);
        return;
    }
    
    if (!confirm(`Mua "${skin.name}" với giá ${price.toLocaleString('vi-VN')} Xu?`)) {
        return;
    }
    
    // Transaction Firebase để trừ xu và thêm skin
    const userRef = database.ref(`users/${uid}`);
    userRef.transaction((currentData) => {
        if (!currentData) return null;
        if ((currentData.coins || 0) < price) return; // Không đủ xu
        
        currentData.coins = (currentData.coins || 0) - price;
        if (!currentData.ownedBoardSkins) currentData.ownedBoardSkins = [];
        if (!currentData.ownedBoardSkins.includes(skinId)) {
            currentData.ownedBoardSkins.push(skinId);
        }
        return currentData;
    }, (error, committed, snapshot) => {
        if (error) {
            alert('Lỗi khi mua skin: ' + error.message);
        } else if (!committed) {
            alert('Không đủ xu hoặc lỗi transaction!');
        } else {
            const newData = snapshot.val();
            if (typeof currentUserData !== 'undefined') {
                currentUserData.coins = newData.coins;
                currentUserData.ownedBoardSkins = newData.ownedBoardSkins || [];
            }
            if (typeof updateCoinDisplay === 'function') updateCoinDisplay();
            if (typeof showXuPopup === 'function') {
                showXuPopup(-price, `Mua ${skin.name} 🎨`);
            }
            alert(`Đã mua "${skin.name}" thành công!`);
            // Render UI trực tiếp với dữ liệu mới
            const grid = document.getElementById('shop-board-skin-grid');
            if (grid) {
                renderBoardSkinGrid(grid, newData.ownedBoardSkins || [], newData.equippedBoardSkin || 'board_default', newData.coins || 0);
            }
        }
    });
}
window.muaBoardSkin = muaBoardSkin;

// ──────────────────────────────────────────────
// TRANG BỊ BOARD SKIN
// ──────────────────────────────────────────────
function equipBoardSkin(skinId) {
    if (!hasBoardSkin(skinId)) {
        alert('Bạn chưa sở hữu skin này!');
        return;
    }
    
    // Sử dụng cách lấy uid giống shop-skin.js
    const uid = (typeof _skinGetUid === 'function') ? _skinGetUid() : null;
    const database = (typeof _skinGetDb === 'function') ? _skinGetDb() : null;
    if (!uid || !database) {
        alert('Bạn cần đăng nhập để trang bị skin!');
        return;
    }
    
    const userRef = database.ref(`users/${uid}`);
    userRef.update({
        equippedBoardSkin: skinId
    }, (error) => {
        if (error) {
            alert('Lỗi khi trang bị skin: ' + error.message);
        } else {
            if (typeof currentUserData !== 'undefined') {
                currentUserData.equippedBoardSkin = skinId;
            }
            alert('Đã trang bị skin thành công!');
            // Render UI trực tiếp
            const grid = document.getElementById('shop-board-skin-grid');
            if (grid && typeof currentUserData !== 'undefined') {
                renderBoardSkinGrid(grid, currentUserData.ownedBoardSkins || [], skinId, currentUserData.coins || 0);
            }
            // Apply board skin to engine
            applyBoardSkinToEngine();
            // Re-render bàn cờ với skin mới
            if (typeof renderInfiniteBoard === 'function') renderInfiniteBoard();
        }
    });
}
window.equipBoardSkin = equipBoardSkin;

// ──────────────────────────────────────────────
// ÁP DỤNG BOARD SKIN VÀO SHARED BOARD ENGINE
// ──────────────────────────────────────────────
function applyBoardSkinToEngine() {
    const skin = getEquippedBoardSkin();
    console.log('[DEBUG-BOARD-SKIN] applyBoardSkinToEngine - skin:', skin);
    
    // Áp dụng cho SharedBoardEngine (nếu có và đã khởi tạo)
    if (typeof SharedBoardEngine !== 'undefined' && SharedBoardEngine.Renderer) {
        // Chỉ render nếu renderer đã được khởi tạo với canvas
        if (SharedBoardEngine.Renderer.canvas && SharedBoardEngine.Renderer.ctx) {
            SharedBoardEngine.Renderer.setBoardSkin(skin);
            SharedBoardEngine.Renderer.render();
        } else {
            console.log('[DEBUG-BOARD-SKIN] SharedBoardEngine.Renderer not initialized, skipping');
        }
    }
    
    // Áp dụng cho hệ thống cũ renderInfiniteBoard (online mode dùng cái này)
    if (typeof renderInfiniteBoard === 'function') {
        renderInfiniteBoard();
    }
}
window.applyBoardSkinToEngine = applyBoardSkinToEngine;

// Gọi khi trang load
window.addEventListener('load', () => {
    setTimeout(applyBoardSkinToEngine, 1000);
    // Khởi tạo board skin system
    const uid = _skinGetUid();
    if (uid) initBoardSkinSystem(uid);
});

// ──────────────────────────────────────────────
// KHỞI TẠO: Đảm bảo board_default luôn có trong ownedBoardSkins
// ──────────────────────────────────────────────
function initBoardSkinSystem(uid) {
    const database = _skinGetDb();
    if (!uid || !database) return;
    database.ref(`users/${uid}/ownedBoardSkins`).once('value').then(snap => {
        const owned = snap.val();
        if (!owned || !owned.includes('board_default')) {
            database.ref(`users/${uid}/ownedBoardSkins`).set(['board_default']);
        }
    });
}
window.initBoardSkinSystem = initBoardSkinSystem;

// ──────────────────────────────────────────────
// MỞ / ĐÓNG MODAL SHOP BOARD SKIN
// ──────────────────────────────────────────────
function moShopBoardSkin() {
    const modal = document.getElementById('shop-board-skin-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    renderShopBoardSkin();
}
window.moShopBoardSkin = moShopBoardSkin;

function dongShopBoardSkin() {
    const modal = document.getElementById('shop-board-skin-modal');
    if (modal) modal.style.display = 'none';
}
window.dongShopBoardSkin = dongShopBoardSkin;

// ──────────────────────────────────────────────
// RENDER SHOP BOARD SKIN UI
// ──────────────────────────────────────────────
function renderShopBoardSkin() {
    const grid = document.getElementById('shop-board-skin-grid');
    if (!grid) return;
    
    // Reload userData từ Firebase để có dữ liệu mới nhất
    const uid = _skinGetUid();
    const database = _skinGetDb();
    
    if (uid && database) {
        database.ref(`users/${uid}`).once('value').then(snap => {
            const userData = snap.val() || {};
            const owned = userData.ownedBoardSkins || [];
            const equippedSkinId = userData.equippedBoardSkin || 'board_default';
            const coins = userData.coins || 0;
            
            // Update currentUserData
            if (typeof currentUserData !== 'undefined') {
                Object.assign(currentUserData, userData);
            }
            
            renderBoardSkinGrid(grid, owned, equippedSkinId, coins);
        });
    } else {
        // Fallback nếu chưa đăng nhập
        renderBoardSkinGrid(grid, [], 'board_default', 0);
    }
}

function renderBoardSkinGrid(grid, owned, equippedSkinId, coins) {
    const xuEl = document.getElementById('shop-board-skin-xu-display');
    if (xuEl) xuEl.textContent = coins.toLocaleString('vi-VN') + ' Xu';
    
    grid.innerHTML = SHOP_BOARD_SKIN_LIST.map(skin => {
        const isOwned = owned.includes(skin.id) || skin.free;
        const isEquipped = equippedSkinId === skin.id;
        
        const rarityColors = {
            'free': '#6b7280',
            'common': '#22c55e',
            'rare': '#3b82f6',
            'epic': '#a855f7',
            'legendary': '#f59e0b',
            'mythic': '#ef4444'
        };
        
        const rarityColor = rarityColors[skin.rarity] || '#6b7280';
        
        return `
            <div class="shop-board-skin-card" data-id="${skin.id}">
                <div class="shop-board-skin-preview" style="background:${skin.bg}; border:2px solid ${skin.grid};">
                    <span style="font-size:32px;">${skin.preview}</span>
                </div>
                <div class="shop-board-skin-info">
                    <div class="shop-board-skin-name">${skin.name}</div>
                    <div class="shop-board-skin-rarity" style="color:${rarityColor};">${skin.rarity.toUpperCase()}</div>
                    <div class="shop-board-skin-desc">${skin.desc}</div>
                </div>
                <div class="shop-board-skin-actions">
                    ${isEquipped 
                        ? `<button class="shop-board-skin-btn equipped" disabled>Đang dùng</button>`
                        : isOwned 
                            ? `<button class="shop-board-skin-btn equip" onclick="equipBoardSkin('${skin.id}')">Trang bị</button>`
                            : `<button class="shop-board-skin-btn buy" onclick="muaBoardSkin('${skin.id}')">${skin.price.toLocaleString('vi-VN')} Xu</button>`
                    }
                </div>
            </div>
        `;
    }).join('');
}
window.renderShopBoardSkin = renderShopBoardSkin;
