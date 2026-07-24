// ===== THANH THÔNG BÁO CHẠY (NOTIFICATION TICKER) =====

// Queue thông báo
let notificationQueue = [];
let maxNotifications = 5; // Số thông báo tối đa hiển thị cùng lúc
let onlineUsersCache = new Set(); // Cache để tránh thông báo trùng lặp
let tickerTimeout = null; // Timeout để tự động ẩn ticker
const ANIMATION_DURATION = 20000; // Animation scroll 20s
const CHAR_TIME = 50; // 50ms mỗi ký tự
let welcomeShown = false; // Flag để chỉ hiển thị thông báo chào mừng 1 lần

// Tính thời gian hiển thị dựa trên số lượng chữ
function calculateDisplayTime() {
    const totalChars = notificationQueue.reduce((sum, n) => sum + n.message.length, 0);
    const charTime = totalChars * CHAR_TIME;
    const totalTime = ANIMATION_DURATION + charTime + 2000; // +2s buffer
    return Math.max(totalTime, 25000); // Tối thiểu 25s
}

// Thêm thông báo vào queue
function addNotification(type, message) {
    const notification = {
        type: type, // 'online', 'win', 'chat'
        message: message,
        timestamp: Date.now()
    };
    
    notificationQueue.push(notification);
    
    // Giới hạn số lượng thông báo
    if (notificationQueue.length > maxNotifications) {
        notificationQueue.shift();
    }
    
    updateTicker();
    
    // Tính thời gian hiển thị dựa trên số lượng chữ
    if (tickerTimeout) clearTimeout(tickerTimeout);
    const displayTime = calculateDisplayTime();
    tickerTimeout = setTimeout(() => {
        const ticker = document.getElementById('notification-ticker');
        if (ticker) ticker.style.display = 'none';
    }, displayTime);
}

// Cập nhật nội dung ticker
function updateTicker() {
    const ticker = document.getElementById('notification-ticker');
    const content = document.getElementById('ticker-content');
    
    if (!ticker || !content) return;
    
    if (notificationQueue.length === 0) {
        ticker.style.display = 'none';
        return;
    }
    
    ticker.style.display = 'block';
    
    // Kiểm tra xem nội dung đã thay đổi chưa
    const currentContent = content.innerHTML;
    const newContent = notificationQueue.map(notif => 
        `<span class="ticker-item ${notif.type}">${notif.message}</span>`
    ).join('');
    
    // Chỉ cập nhật nếu nội dung thực sự thay đổi
    if (currentContent !== newContent) {
        content.innerHTML = newContent;
    }
}

// Xóa thông báo cũ (sau 5 phút)
function cleanupOldNotifications() {
    const fiveMinutesAgo = Date.now() - 300000;
    notificationQueue = notificationQueue.filter(n => n.timestamp > fiveMinutesAgo);
    updateTicker();
}

// Chạy cleanup mỗi phút
setInterval(cleanupOldNotifications, 60000);

// ===== LISTENER CHO ONLINE/OFFLINE =====
function setupOnlineNotificationListener() {
    // Sử dụng db từ firebase-online.js (global variable)
    if (typeof db === 'undefined' || !db) return;
    
    const myId = localStorage.getItem('current_user_id');
    if (!myId) return;
    
    // Theo dõi thay đổi trong online_users
    db.ref('online_users').on('value', snap => {
        const users = snap.val();
        if (!users) return;
        
        for (const uid in users) {
            if (uid === myId) continue; // Bỏ qua chính mình
            
            const user = users[uid];
            const displayName = user.displayName || user.username || 'Unknown';
            const cacheKey = `${uid}_${displayName}`;
            
            // Nếu user mới online và chưa có trong cache
            if (!onlineUsersCache.has(cacheKey) && (Date.now() - user.lastActive) < 30000) {
                onlineUsersCache.add(cacheKey);
                addNotification('online', `🟢 ${displayName} vừa online!`);
            }
        }
    });
}

// ===== LISTENER CHO THẮNG/THUA =====
function setupWinNotificationListener() {
    // Sử dụng db từ firebase-online.js
    if (typeof db === 'undefined' || !db) return;
    
    // Theo dõi lịch sử trận đấu online
    db.ref('online_history').limitToLast(10).on('child_added', snap => {
        const match = snap.val();
        if (!match) return;
        
        // Chỉ hiển thị trận đấu kết thúc trong 1 phút
        if (Date.now() - match.timestamp > 60000) return;
        
        const winnerName = match.winnerName || 'Unknown';
        const loserName = match.loserName || 'Unknown';
        const winCount = match.winCount || 5;
        
        addNotification('win', `🏆 ${winnerName} thắng ${loserName} (${winCount} quân)`);
    });
}

// ===== LISTENER CHO CHAT THẾ GIỚI =====
function setupWorldChatNotificationListener() {
    // Sử dụng db từ firebase-online.js
    if (typeof db === 'undefined' || !db) return;
    
    // Theo dõi chat thế giới
    db.ref('world_chat').limitToLast(5).on('child_added', snap => {
        const msg = snap.val();
        if (!msg) return;
        
        // Chỉ hiển thị tin nhắn trong 30 giây
        if (Date.now() - msg.timestamp > 30000) return;
        
        const sender = msg.username || msg.displayName || 'Unknown';
        const text = msg.text || '';
        
        // Giới hạn độ dài tin nhắn
        const displayText = text.length > 30 ? text.substring(0, 30) + '...' : text;
        
        addNotification('chat', `💬 ${sender}: ${displayText}`);
    });
}

// ===== KHỞI TẠO =====
function initNotificationTicker() {
    const myId = localStorage.getItem('current_user_id');
    
    if (!myId) {
        // Người chưa đăng nhập - chỉ hiển thị thông báo chung 1 lần
        if (!welcomeShown) {
            addNotification('online', '🎮 Chào mừng đến với Caro! Đăng nhập để chơi online và nhận thông báo.');
            welcomeShown = true;
        }
        return;
    }
    
    // Người đã đăng nhập - setup các listener (cần Firebase)
    if (typeof db !== 'undefined' && db) {
        setupOnlineNotificationListener();
        setupWinNotificationListener();
        setupWorldChatNotificationListener();
    }
}

// Export functions để gọi từ nơi khác
window.addNotification = addNotification;
window.initNotificationTicker = initNotificationTicker;

// Gọi ngay khi trang load (không cần đợi Firebase)
window.addEventListener('load', () => {
    setTimeout(initNotificationTicker, 1000);
});
