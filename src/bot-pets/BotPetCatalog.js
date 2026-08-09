// ══════════════════════════════════════════════════════════════════
// BOT PET CATALOG - HỆ THỐNG CATALOG BOT THÚ CƯNG
// Mapping Bot Pet ↔ AI Profile cho tính năng Top 4 Moves tương lai
// ══════════════════════════════════════════════════════════════════

// ──────────────────────────────────────────────
// DANH SÁCH BOT THÚ CƯNG
// Giá: 800.000 - 2.000.000 Xu
// Mỗi Bot Pet tương ứng với 1 AI Profile cụ thể
// ──────────────────────────────────────────────
const BOT_PET_CATALOG = [
    {
        id: 'bot_pet_easy',
        name: 'Bot Dễ',
        aiProfile: 'EASY',
        botProfileId: 'ai-easy',
        botMode: 'ai-easy',
        gameMode: 'ai-easy',
        description: 'Bot AI cấp độ Dễ - phù hợp người mới bắt đầu',
        price: 800000,
        avatar: '🐣',
        icon: '🐣',
        rarity: 'common'
    },
    {
        id: 'bot_pet_medium',
        name: 'Bot Trung Bình',
        aiProfile: 'MEDIUM',
        botProfileId: 'ai-medium',
        botMode: 'ai-medium',
        gameMode: 'ai-medium',
        description: 'Bot AI cấp độ Trung Bình - thách thức vừa phải',
        price: 1000000,
        avatar: '❄️',
        icon: '❄️',
        rarity: 'common'
    },
    {
        id: 'bot_pet_hard',
        name: 'Bot Khó',
        aiProfile: 'HARD',
        botProfileId: 'ai-hard',
        botMode: 'ai-hard',
        gameMode: 'ai-hard',
        description: 'Bot AI cấp độ Khó - đòi hỏi tư duy chiến thuật',
        price: 1200000,
        avatar: '⚔️',
        icon: '⚔️',
        rarity: 'rare'
    },
    {
        id: 'bot_pet_ultimate',
        name: 'Bot Tối Thượng',
        aiProfile: 'ULTIMATE',
        botProfileId: 'bot-toi-thuong',
        botMode: 'bot-toi-thuong',
        gameMode: 'bot-toi-thuong',
        description: 'Bot AI cấp độ Tối Thượng - thử thách cao nhất',
        price: 1500000,
        avatar: '👑',
        icon: '👑',
        rarity: 'rare'
    },
    {
        id: 'bot_pet_lightning',
        name: 'Bot Tia Chớp',
        aiProfile: 'LIGHTNING',
        botProfileId: 'bot-tia-chop',
        botMode: 'bot-tia-chop',
        gameMode: 'bot-tia-chop',
        description: 'Bot AI Tia Chớp - tốc độ 2000x tính toán',
        price: 1800000,
        avatar: '⚡',
        icon: '⚡',
        rarity: 'epic'
    },
    {
        id: 'bot_pet_superhuman',
        name: 'Bot Siêu Phàm',
        aiProfile: 'SUPERHUMAN',
        botProfileId: 'bot-super',
        botMode: 'bot-super',
        gameMode: 'bot-super',
        description: 'Bot AI Siêu Phàm - sức mạnh 1500x vượt trội',
        price: 2000000,
        avatar: '🌟',
        icon: '🌟',
        rarity: 'legendary'
    }
];

const BOT_PET_RUNTIME_MODES = new Set([
    'ai-easy',
    'ai-medium',
    'ai-hard',
    'bot-toi-thuong',
    'bot-tia-chop',
    'bot-super'
]);

function resolveBotPetProfile(botPetId) {
    const botPet = getBotPetById(botPetId);
    if (!botPet) return null;

    const botProfileId = botPet.botProfileId || botPet.botMode || botPet.gameMode;
    const botMode = botPet.botMode || botPet.botProfileId || botPet.gameMode;
    const gameMode = botPet.gameMode || botPet.botMode || botPet.botProfileId;

    if (!botProfileId || !BOT_PET_RUNTIME_MODES.has(botProfileId)) {
        return null;
    }

    if (botMode !== botProfileId || gameMode !== botProfileId) {
        return null;
    }

    return {
        botPetId: botPet.id,
        botProfileId,
        botMode,
        gameMode,
        aiProfile: botPet.aiProfile
    };
}

function isValidBotPetRuntimeMode(mode) {
    return BOT_PET_RUNTIME_MODES.has(mode);
}

function getEquippedBotPetProfile() {
    if (typeof getEquippedBotPet !== 'function') return null;
    const botPet = getEquippedBotPet();
    if (!botPet) return null;
    return resolveBotPetProfile(botPet.id);
}

// ──────────────────────────────────────────────
// RARITY LABELS
// ──────────────────────────────────────────────
const BOT_PET_RARITY_LABEL = {
    common: { label: 'Thường', color: '#22c55e', bg: '#dcfce7' },
    rare: { label: 'Hiếm', color: '#3b82f6', bg: '#dbeafe' },
    epic: { label: 'Sử Thi', color: '#a855f7', bg: '#ede9fe' },
    legendary: { label: 'Huyền Thoại', color: '#f59e0b', bg: '#fef3c7' }
};

// ──────────────────────────────────────────────
// HELPER FUNCTIONS
// ──────────────────────────────────────────────

// Lấy Bot Pet theo ID
function getBotPetById(botPetId) {
    return BOT_PET_CATALOG.find(bp => bp.id === botPetId) || null;
}

// Lấy AI Profile từ Bot Pet ID (cho tính năng Top 4 Moves tương lai)
function getAiProfileFromBotPet(botPetId) {
    const botPet = getBotPetById(botPetId);
    return botPet ? botPet.aiProfile : null;
}

function getBotPetRuntimeProfile(botPetId) {
    return resolveBotPetProfile(botPetId);
}

function isValidBotPetRuntimeMode(mode) {
    return BOT_PET_RUNTIME_MODES.has(mode);
}

// Kiểm tra giá hợp lệ (800.000 - 2.000.000)
function isValidBotPetPrice(price) {
    return price >= 800000 && price <= 2000000;
}

// Lấy tất cả Bot Pets
function getAllBotPets() {
    return BOT_PET_CATALOG;
}

// Export functions to window
window.getBotPetById = getBotPetById;
window.getAiProfileFromBotPet = getAiProfileFromBotPet;
window.getBotPetRuntimeProfile = getBotPetRuntimeProfile;
window.getEquippedBotPetProfile = getEquippedBotPetProfile;
window.resolveBotPetProfile = resolveBotPetProfile;
window.isValidBotPetRuntimeMode = isValidBotPetRuntimeMode;
window.isValidBotPetPrice = isValidBotPetPrice;
window.getAllBotPets = getAllBotPets;
window.BOT_PET_CATALOG = BOT_PET_CATALOG;
window.BOT_PET_RUNTIME_MODES = BOT_PET_RUNTIME_MODES;
window.BOT_PET_RARITY_LABEL = BOT_PET_RARITY_LABEL;
