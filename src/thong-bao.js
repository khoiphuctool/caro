// ===== THANH THÔNG BÁO TOÀN CỤC (GLOBAL NOTIFICATION TICKER) =====
// Ticker cố định ở top màn hình, hiển thị mọi lúc kể cả trong trận

let notificationQueue = [];
let notificationCache = new Map();
let notificationListenersStarted = false;
let welcomeShown = false;
let tickerInitialized = false;
let isAnimating = false;

// ===== HỆ THỐNG REGISTRY NGUỒN THÔNG BÁO =====
// Quản lý nhiều nguồn thông báo chạy tuần tự

const notificationRegistry = {};
let sourceQueue = [];
let currentSource = null;

// Đăng ký nguồn thông báo mới
function registerNotificationSource(sourceId, config) {
    notificationRegistry[sourceId] = {
        name: config.name,
        priority: config.priority || 2,
        enabled: true,
        listener: null,
        queue: [],
        isProcessing: false,
        callback: config.callback
    };
    // console.log('[REGISTRY] Registered source:', sourceId, config.name);
}

// Thêm thông báo vào queue của nguồn
function enqueueNotification(sourceId, notification) {
    const source = notificationRegistry[sourceId];
    if (!source || !source.enabled) {
        // console.log('[REGISTRY] Source not found or disabled:', sourceId);
        return;
    }
    
    source.queue.push(notification);
    // console.log('[REGISTRY] Enqueued to', sourceId, ':', notification.message.substring(0, 30) + '...');
    
    // Nếu nguồn chưa trong global queue, thêm vào
    if (!sourceQueue.includes(sourceId)) {
        sourceQueue.push(sourceId);
        // console.log('[REGISTRY] Added to source queue:', sourceId);
    }
    
    // Nếu không có nguồn đang chạy, bắt đầu xử lý
    if (!currentSource) {
        // console.log('[REGISTRY] No current source, starting processing');
        processNextSource();
    }
}

// Xử lý nguồn tiếp theo trong hàng đợi
function processNextSource() {
    // Sắp xếp theo priority (1=cao nhất)
    sourceQueue.sort((a, b) => {
        return notificationRegistry[a].priority - notificationRegistry[b].priority;
    });
    
    if (sourceQueue.length === 0) {
        // console.log('[REGISTRY] Source queue empty, stopping');
        currentSource = null;
        return;
    }
    
    currentSource = sourceQueue.shift();
    const source = notificationRegistry[currentSource];
    
    // console.log('[REGISTRY] Processing source:', currentSource, 'Queue length:', source.queue.length);
    
    if (source.queue.length > 0) {
        processSourceQueue(currentSource);
    } else {
        // Queue rỗng, chuyển sang nguồn tiếp theo
        // console.log('[REGISTRY] Source queue empty, moving to next');
        processNextSource();
    }
}

// Xử lý queue của một nguồn
function processSourceQueue(sourceId) {
    const source = notificationRegistry[sourceId];
    source.isProcessing = true;
    
    if (source.queue.length === 0) {
        source.isProcessing = false;
        // console.log('[REGISTRY] Source queue finished:', sourceId);
        processNextSource();
        return;
    }
    
    const notification = source.queue.shift();
    // console.log('[REGISTRY] Processing notification from', sourceId, ':', notification.message.substring(0, 30) + '...');
    
    // Thêm vào global queue (sử dụng logic addNotification nhưng bypass isAnimating check)
    const cacheKey = `${notification.type}_${notification.message}`;
    const now = Date.now();
    
    // Dedup
    const lastShown = notificationCache.get(cacheKey) || 0;
    if (now - lastShown < DEDUPE_TIME) {
        // console.log('[REGISTRY] DEDUP SKIPPED:', { cacheKey, timeSinceLast: now - lastShown });
        // Chuyển sang notification tiếp theo
        processSourceQueue(sourceId);
        return;
    }
    notificationCache.set(cacheKey, now);
    
    notificationQueue.push({ type: notification.type, message: notification.message });
    if (notificationQueue.length > MAX_QUEUE) notificationQueue.shift();
    
    // Render nếu không đang animating
    if (!isAnimating) {
        _renderTicker();
    }
}

// Bật/tắt nguồn thông báo
function toggleNotificationSource(sourceId, enabled) {
    if (notificationRegistry[sourceId]) {
        notificationRegistry[sourceId].enabled = enabled;
        // console.log('[REGISTRY] Toggled source:', sourceId, 'enabled:', enabled);
        
        // Nếu tắt và đang trong queue, xóa đi
        if (!enabled) {
            const idx = sourceQueue.indexOf(sourceId);
            if (idx > -1) {
                sourceQueue.splice(idx, 1);
                // console.log('[REGISTRY] Removed disabled source from queue:', sourceId);
            }
        }
    }
}

const DEDUPE_TIME = 20000; // không lặp cùng nội dung trong 20 giây
const MAX_QUEUE = 8;

// ── Thêm thông báo vào queue và cập nhật ticker ──
function addNotification(type, message) {
    // console.log('[TICKER-DEBUG] addNotification() called:', { type, message, timestamp: Date.now() });
    
    if (!message) return;
    const cacheKey = `${type}_${message}`;
    const now = Date.now();

    // Dedup
    const lastShown = notificationCache.get(cacheKey) || 0;
    if (now - lastShown < DEDUPE_TIME) {
        // console.log('[TICKER-DEBUG] addNotification() - DEDUP SKIPPED:', { cacheKey, timeSinceLast: now - lastShown });
        return;
    }
    notificationCache.set(cacheKey, now);

    // Dọn cache cũ
    for (const [k, t] of notificationCache) {
        if (now - t > DEDUPE_TIME) notificationCache.delete(k);
    }

    notificationQueue.push({ type, message });
    if (notificationQueue.length > MAX_QUEUE) notificationQueue.shift();

    // console.log('[TICKER-DEBUG] addNotification() - Queue state:', { length: notificationQueue.length, isAnimating });
    
    // Chỉ render nếu không đang animating
    if (!isAnimating) {
        _renderTicker();
    }
}

// ── Render ticker marquee ──
function _renderTicker() {
    // console.log('[TICKER-DEBUG] _renderTicker() called:', { queueLength: notificationQueue.length });
    
    const ticker  = document.getElementById('notification-ticker');
    const content = document.getElementById('ticker-content');
    if (!ticker || !content) {
        // console.log('[TICKER-DEBUG] _renderTicker() - Elements not found:', { ticker: !!ticker, content: !!content });
        return;
    }

    if (notificationQueue.length === 0) {
        // console.log('[TICKER-DEBUG] _renderTicker() - Queue empty, removing has-content');
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

    // console.log('[TICKER-DEBUG] _renderTicker() - Resetting animation before setting new duration:', { charCount, newDuration: `${duration}s` });

    // RESET ANIMATION TRƯỚC KHI CHẠY LƯỢT MỚI
    content.style.animation = 'none';
    void content.offsetWidth; // Mẹo ép trình duyệt nhận diện việc reset

    // Nạp nội dung mới và kích hoạt chạy
    content.style.animation = `ticker-scroll ${duration}s linear forwards`;

    // console.log('[TICKER-DEBUG] _renderTicker() - Animation set:', { animation: content.style.animation });

    ticker.classList.add('has-content');
    document.body.classList.add('ticker-on');
    
    // Đánh dấu đang animating
    isAnimating = true;
    
    // console.log('[TICKER-DEBUG] _renderTicker() - Classes added:', { hasContent, tickerOn });
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
        enqueueNotification('online_users', { type: 'online', message: `🟢 ${name} vừa trực tuyến` });
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
            enqueueNotification('match_results', { type: 'win', message: res.msg });
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
            enqueueNotification('match_results', { type: 'win', message: `🏆 ${winnerName} vừa xuất sắc vượt qua ${loserName}!` });
        }
    });
}

// ── Khởi tạo ──
function initNotificationTicker(force = false) {
    // Ngăn khởi tạo trùng lặp (trừ khi force=true)
    if (tickerInitialized && !force) {
        // console.log('[TICKER-DEBUG] initNotificationTicker() - Already initialized, skipping');
        return;
    }
    
    // Đăng ký các nguồn thông báo mặc định
    registerNotificationSource('online_users', {
        name: 'Người dùng trực tuyến',
        priority: 2
    });
    
    registerNotificationSource('match_results', {
        name: 'Kết quả trận đấu',
        priority: 1
    });
    
    registerNotificationSource('chat_messages', {
        name: 'Tin nhắn chat',
        priority: 3
    });
    
    registerNotificationSource('system_events', {
        name: 'Sự kiện hệ thống',
        priority: 1
    });
    
    // Setup animation listeners for ticker-content
    const content = document.getElementById('ticker-content');
    if (content) {
        content.addEventListener('animationstart', () => {
            // console.log('[TICKER-DEBUG] animationstart - Animation started');
        });

        content.addEventListener('animationend', (event) => {
            // Chỉ xử lý animation ticker-scroll, bỏ qua các animation khác
            if (event.animationName !== 'ticker-scroll') {
                // console.log('[TICKER-DEBUG] animationend - Ignored animation:', event.animationName);
                return;
            }

            // console.log('[TICKER-DEBUG] animationend - ticker-scroll ended, starting cleanup');

            // 1. Xóa thông báo cũ đã chạy xong
            if (notificationQueue.length > 0) {
                const removed = notificationQueue.shift();
                // console.log('[TICKER-DEBUG] animationend - Removed from queue:', { type: removed.type, msg: removed.message.substring(0, 30) + '...' });
            }

            // 2. Kiểm tra hàng đợi để chạy tiếp hoặc ẩn đi
            if (notificationQueue.length > 0) {
                // console.log('[TICKER-DEBUG] animationend - Queue not empty, rendering next');
                // Reset flag trước khi render lượt tiếp theo
                isAnimating = false;
                _renderTicker();
            } else {
                // console.log('[TICKER-DEBUG] animationend - Queue empty, cleaning up ticker');
                const ticker = document.getElementById('notification-ticker');
                if (ticker) {
                    ticker.classList.remove('has-content');
                    document.body.classList.remove('ticker-on');
                }
                content.innerHTML = '';
                content.style.animation = 'none';
                // Reset flag khi queue rỗng
                isAnimating = false;
                
                // Nếu đang xử lý registry, chuyển sang nguồn tiếp theo
                if (currentSource) {
                    // console.log('[REGISTRY] Animation ended, continuing source processing');
                    // Reset isAnimating trước khi process tiếp
                    isAnimating = false;
                    processSourceQueue(currentSource);
                }
            }

            const ticker = document.getElementById('notification-ticker');
            if (ticker) {
                // console.log('[TICKER-DEBUG] animationend - Final ticker state');
            }
        });
    }

    const myId = localStorage.getItem('current_user_id');

    if (!myId) {
        if (!welcomeShown) {
            enqueueNotification('system_events', { type: 'online', message: '🎮 Chào mừng đến Caro Online! Đăng nhập để chơi và nhận thưởng.' });
            welcomeShown = true;
        }
        return;
    }

    if (typeof db !== 'undefined' && db && !notificationListenersStarted) {
        notificationListenersStarted = true;
        setupOnlineNotificationListener();
        setupWinNotificationListener();
    }
    
    tickerInitialized = true;
    // console.log('[TICKER-DEBUG] initNotificationTicker() - Initialized successfully');
}

// Gọi lại initNotificationTicker sau khi đăng nhập thành công
function reinitTickerAfterLogin(displayName) {
    welcomeShown = true; // Đã đăng nhập rồi, không cần hiển thị welcome cho guest nữa
    notificationListenersStarted = false;
    tickerInitialized = false; // Reset flag để cho phép reinit sau đăng nhập
    const name = displayName || 'bạn';
    enqueueNotification('system_events', { type: 'welcome', message: `🎉 Chào mừng ${name} đã quay lại! Chúc ${name} một ngày vui vẻ!` });
    initNotificationTicker();
}

// Export
window.addNotification      = addNotification;
window.initNotificationTicker = initNotificationTicker;
window.reinitTickerAfterLogin = reinitTickerAfterLogin;
window.registerNotificationSource = registerNotificationSource;
window.enqueueNotification = enqueueNotification;
window.toggleNotificationSource = toggleNotificationSource;

window.addEventListener('load', () => setTimeout(initNotificationTicker, 800));
