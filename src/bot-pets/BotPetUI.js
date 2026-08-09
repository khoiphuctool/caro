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
            btnHtml = `<button class="bot-pet-btn bot-pet-equipped" disabled>✅ Đang trang bị</button>`;
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
// UPDATE BOT PET COMPANION UI IN MATCH
// ──────────────────────────────────────────────
function updateBotPetUI() {
    const overlay = document.getElementById('battle-bot-pet-overlay');
    const avatarEl = document.getElementById('battle-bot-pet-avatar');
    const nameEl = document.getElementById('battle-bot-pet-name');
    const statusEl = document.getElementById('battle-bot-pet-status');
    const toggleBtn = document.getElementById('battle-bot-pet-toggle');
    
    if (!overlay || !avatarEl || !nameEl || !statusEl || !toggleBtn) return;
    
    const state = getMatchBotPetState();
    const botPet = getMatchBotPet();
    
    if (!botPet || !state.equippedBotPet) {
        overlay.style.display = 'none';
        return;
    }
    
    // Show/hide based on active state
    overlay.style.display = state.active ? 'block' : 'none';
    
    // Update content
    avatarEl.textContent = botPet.avatar;
    // Display both Bot Pet name and AI Profile
    nameEl.innerHTML = `<div style="font-weight:700;font-size:0.9rem;">${botPet.name.toUpperCase()}</div><div style="font-weight:400;font-size:0.7rem;color:var(--text-secondary);">BOT ${botPet.aiProfile}</div>`;
    statusEl.textContent = state.active ? '● ĐANG HOẠT ĐỘNG' : '○ ĐÃ TẮT';
    statusEl.style.color = state.active ? 'var(--color-success)' : 'var(--text-secondary)';
    toggleBtn.textContent = state.active ? 'TẮT' : 'BẬT';
    toggleBtn.style.background = state.active ? 'var(--color-danger)' : 'var(--color-success)';
}
window.updateBotPetUI = updateBotPetUI;

// ──────────────────────────────────────────────
// SHOW BOT PET COMPANION UI
// ──────────────────────────────────────────────
function showBotPetCompanion() {
    const overlay = document.getElementById('battle-bot-pet-overlay');
    if (!overlay) return;
    
    initMatchBotPetState();
    updateBotPetUI();
}
window.showBotPetCompanion = showBotPetCompanion;

// ──────────────────────────────────────────────
// HIDE BOT PET COMPANION UI
// ──────────────────────────────────────────────
function hideBotPetCompanion() {
    const overlay = document.getElementById('battle-bot-pet-overlay');
    if (overlay) overlay.style.display = 'none';
    
    cleanupMatchBotPetState();
}
window.hideBotPetCompanion = hideBotPetCompanion;
