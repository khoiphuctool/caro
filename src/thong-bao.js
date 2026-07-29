// ===== THANH THÔNG BÁO TOÀN CỤC (GLOBAL NOTIFICATION TICKER) =====
// Ticker cố định ở top màn hình, hiển thị mọi lúc kể cả trong trận

let notificationQueue = [];
let notificationCache = new Map();
let notificationListenersStarted = false;
let welcomeShown = false;

const DEDUPE_TIME = 20000; // không lặp cùng nội dung trong 20 giây
const MAX_QUEUE = 8;

// ── Thêm thông báo vào queue và cập nhật ticker ──
function addNotification(type, message) {
    console.log('[TICKER-DEBUG] addNotification() called:', { type, message, timestamp: Date.now() });
    
    if (!message) return;
    const cacheKey = `${type}_${message}`;
    const now = Date.now();

    // Dedup
    const lastShown = notificationCache.get(cacheKey) || 0;
    if (now - lastShown < DEDUPE_TIME) {
        console.log('[TICKER-DEBUG] addNotification() - DEDUP SKIPPED:', { cacheKey, timeSinceLast: now - lastShown });
        return;
    }
    notificationCache.set(cacheKey, now);

    // Dọn cache cũ
    for (const [k, t] of notificationCache) {
        if (now - t > DEDUPE_TIME) notificationCache.delete(k);
    }

    notificationQueue.push({ type, message });
    if (notificationQueue.length > MAX_QUEUE) notificationQueue.shift();

    console.log('[TICKER-DEBUG] addNotification() - Queue state:', { 
        length: notificationQueue.length, 
        queue: notificationQueue.map(n => ({ type: n.type, msg: n.message.substring(0, 30) + '...' }))
    });
    
    _renderTicker();
}

// ── Render ticker marquee ──
function _renderTicker() {
    console.log('[TICKER-DEBUG] _renderTicker() called:', { queueLength: notificationQueue.length });
    
    const ticker  = document.getElementById('notification-ticker');
    const content = document.getElementById('ticker-content');
    if (!ticker || !content) {
        console.log('[TICKER-DEBUG] _renderTicker() - Elements not found:', { ticker: !!ticker, content: !!content });
        return;
    }

    if (notificationQueue.length === 0) {
        console.log('[TICKER-DEBUG] _renderTicker() - Queue empty, removing has-content');
        ticker.classList.remove('has-content');
        document.body.classList.remove('ticker-on');
        return;
    }

    // Build nội dung: các item cách nhau bằng dấu phân cách
    const fragment = document.createDocumentFragment();
    notificationQueue.forEach((notif, i) => {
        const span = document.createElement('span');
        span.className = `ticker-item ${notif.type}`;
        span.textContent = notif.message;
        fragment.appendChild(span);

        // Dấu phân cách giữa các item
        if (i < notificationQueue.length - 1) {
            const sep = document.createElement('span');
            sep.className = 'ticker-sep';
            sep.textContent = ' ✦ ';
            fragment.appendChild(sep);
        }
    });
    content.replaceChildren(fragment);

    // Điều chỉnh tốc độ scroll theo độ dài nội dung
    const charCount = notificationQueue.reduce((s, n) => s + n.message.length, 0);
    const duration = Math.max(15, Math.min(50, charCount * 0.25));

    console.log('[TICKER-DEBUG] _renderTicker() - Resetting animation before setting new duration:', { 
        charCount, 
        newDuration: `${duration}s`,
        oldAnimation: content.style.animation
    });

    // RESET ANIMATION TRƯỚC KHI CHẠY LƯỢT MỚI
    content.style.animation = 'none';
    void content.offsetWidth; // Mẹo ép trình duyệt nhận diện việc reset

    // Nạp nội dung mới và kích hoạt chạy
    content.style.animation = `ticker-scroll ${duration}s linear forwards`;

    console.log('[TICKER-DEBUG] _renderTicker() - Animation set:', { 
        animation: content.style.animation,
        duration: content.style.animationDuration,
        contentHTML: content.innerHTML.substring(0, 100) + '...'
    });

    ticker.classList.add('has-content');
    document.body.classList.add('ticker-on');
    
    console.log('[TICKER-DEBUG] _renderTicker() - Classes added:', { 
        hasContent: ticker.classList.contains('has-content'),
        tickerOn: document.body.classList.contains('ticker-on')
    });
}

// ── Listeners ──

function setupOnlineNotificationListener() {
    if (typeof db === 'undefined' || !db) return;
    const myId = localStorage.getItem('current_user_id');
    if (!myId) return;

    db.ref('online_users').on('child_added', snap => {
        if (snap.key === myId) return;
        const user = snap.val();
        if (!user || Date.now() - user.lastActive >= 30000) return;
        const name = user.displayName || user.username || 'Người chơi';
        addNotification('online', `🟢 ${name} vừa trực tuyến`);
    });
}

function setupWinNotificationListener() {
    if (typeof db === 'undefined' || !db) return;

    // Lắng nghe node match_results (broadcast từ firebase-online.js khi kết thúc trận)
    const startTs = Date.now();
    db.ref('match_results').orderByChild('ts').limitToLast(5)
        .on('child_added', snap => {
            const res = snap.val();
            if (!res || !res.msg || res.ts < startTs) return;
            addNotification('win', res.msg);
        });

    // Lắng nghe history chỉ cho thắng bot (tránh trùng với match_results cho trận online)
    db.ref('history').limitToLast(5).on('child_added', snap => {
        const match = snap.val();
        if (!match || !match.timestamp) return;
        if (Date.now() - match.timestamp > 60000) return; // chỉ kết quả trong 1 phút

        const xWon = match.winner === 'X';
        const winnerName = xWon ? match.playerX : match.playerO;
        const loserName  = xWon ? match.playerO : match.playerX;
        if (!winnerName || !loserName) return;

        // Chỉ thông báo khi thắng bot (bỏ qua PvP vì match_results đã xử lý)
        const isBot = loserName.startsWith('🤖') || loserName.toLowerCase().includes('bot');
        if (isBot) {
            addNotification('win', `🏆 ${winnerName} vừa xuất sắc vượt qua ${loserName}!`);
        }
    });
}

// ── Khởi tạo ──
function initNotificationTicker() {
    // Setup animation listeners for ticker-content
    const content = document.getElementById('ticker-content');
    if (content) {
        content.addEventListener('animationstart', () => {
            console.log('[TICKER-DEBUG] animationstart - Animation started:', {
                animationDuration: content.style.animationDuration,
                innerHTML: content.innerHTML.substring(0, 100) + '...'
            });
        });

        content.addEventListener('animationend', (event) => {
            // Chỉ xử lý animation ticker-scroll, bỏ qua các animation khác
            if (event.animationName !== 'ticker-scroll') {
                console.log('[TICKER-DEBUG] animationend - Ignored animation:', event.animationName);
                return;
            }

            console.log('[TICKER-DEBUG] animationend - ticker-scroll ended, starting cleanup:', {
                timestamp: Date.now(),
                queueLength: notificationQueue.length,
                queue: notificationQueue.map(n => ({ type: n.type, msg: n.message.substring(0, 30) + '...' })),
                innerHTML: content.innerHTML,
                textContent: content.textContent
            });

            // 1. Xóa thông báo cũ đã chạy xong
            if (notificationQueue.length > 0) {
                const removed = notificationQueue.shift();
                console.log('[TICKER-DEBUG] animationend - Removed from queue:', { type: removed.type, msg: removed.message.substring(0, 30) + '...' });
            }

            // 2. Kiểm tra hàng đợi để chạy tiếp hoặc ẩn đi
            if (notificationQueue.length > 0) {
                console.log('[TICKER-DEBUG] animationend - Queue not empty, rendering next:', { 
                    remaining: notificationQueue.length,
                    nextItem: notificationQueue[0].message.substring(0, 30) + '...'
                });
                _renderTicker();
            } else {
                console.log('[TICKER-DEBUG] animationend - Queue empty, cleaning up ticker');
                const ticker = document.getElementById('notification-ticker');
                if (ticker) {
                    ticker.classList.remove('has-content');
                    document.body.classList.remove('ticker-on');
                }
                content.innerHTML = '';
                content.style.animation = 'none';
            }

            const ticker = document.getElementById('notification-ticker');
            if (ticker) {
                console.log('[TICKER-DEBUG] animationend - Final ticker state:', {
                    classList: Array.from(ticker.classList),
                    hasContent: ticker.classList.contains('has-content'),
                    display: window.getComputedStyle(ticker).display,
                    offsetHeight: ticker.offsetHeight
                });
            }
        });
    }

    const myId = localStorage.getItem('current_user_id');

    if (!myId) {
        if (!welcomeShown) {
            addNotification('online', '🎮 Chào mừng đến Caro Online! Đăng nhập để chơi và nhận thưởng.');
            welcomeShown = true;
        }
        return;
    }

    if (typeof db !== 'undefined' && db && !notificationListenersStarted) {
        notificationListenersStarted = true;
        setupOnlineNotificationListener();
        setupWinNotificationListener();
    }
}

// Gọi lại initNotificationTicker sau khi đăng nhập thành công
function reinitTickerAfterLogin(displayName) {
    welcomeShown = true; // Đã đăng nhập rồi, không cần hiển thị welcome cho guest nữa
    notificationListenersStarted = false;
    const name = displayName || 'bạn';
    addNotification('welcome', `🎉 Chào mừng ${name} đã quay lại! Chúc ${name} một ngày vui vẻ!`);
    initNotificationTicker();
}

// Export
window.addNotification      = addNotification;
window.initNotificationTicker = initNotificationTicker;
window.reinitTickerAfterLogin = reinitTickerAfterLogin;

window.addEventListener('load', () => setTimeout(initNotificationTicker, 800));
