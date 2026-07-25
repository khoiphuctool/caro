// ===== THANH THÔNG BÁO (NOTIFICATION TICKER) =====

// Queue thông báo
let notificationQueue = [];
let maxNotifications = 5; // Số thông báo tối đa hiển thị cùng lúc
let notificationCache = new Set(); // Cache để mỗi thông báo chỉ hiện 1 lần
let welcomeShown = false; // Flag để chỉ hiển thị thông báo chào mừng 1 lần
let tickerTimeout = null; // Timeout để tự động ẩn
const DISPLAY_TIME = 4000; // Hiển thị 4 giây

// Thêm thông báo vào queue
function addNotification(type, message) {
    // Tạo cache key để tránh trùng lặp
    const cacheKey = `${type}_${message}`;
    if (notificationCache.has(cacheKey)) return; // Bỏ qua nếu đã hiển thị rồi
    notificationCache.add(cacheKey);
    
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
    
    // Tự động ẩn sau 4 giây (chỉ reset khi thực sự có thông báo mới)
    if (tickerTimeout) clearTimeout(tickerTimeout);
    tickerTimeout = setTimeout(() => {
        const ticker = document.getElementById('notification-ticker');
        if (ticker) {
            ticker.style.display = 'none';
            notificationQueue = []; // Xóa queue sau khi ẩn
        }
    }, DISPLAY_TIME);
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
    
    // Hiển thị tất cả thông báo
    const newContent = notificationQueue.map(notif => 
        `<span class="ticker-item ${notif.type}">${notif.message}</span>`
    ).join('');
    
    content.innerHTML = newContent;
}

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
            
            // Nếu user vừa online (trong 30 giây)
            if ((Date.now() - user.lastActive) < 30000) {
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
