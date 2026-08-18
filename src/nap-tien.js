// ══════════════════════════════════════════════════════════════════
// HỆ THỐNG NẠP TIỀN TỰ ĐỘNG - FIREBASE DIRECT (ĐÃ TỐI ƯU 1-CLICK)
// ══════════════════════════════════════════════════════════════════

const NAP_TIEN_CONFIG = {
    RATE: 1, // 1 VNĐ = 1 Xu
    PACKAGES: [
        { amount: 10000,  coins: 10000,  label: '10.000 VNĐ',  bonus: 0 },
        { amount: 20000,  coins: 20000,  label: '20.000 VNĐ',  bonus: 0 },
        { amount: 50000,  coins: 50000,  label: '50.000 VNĐ',  bonus: 5000 },
        { amount: 100000, coins: 100000, label: '100.000 VNĐ', bonus: 15000 },
        { amount: 200000, coins: 200000, label: '200.000 VNĐ', bonus: 40000 },
        { amount: 500000, coins: 500000, label: '500.000 VNĐ', bonus: 100000 },
    ],
    MODE: 'test', // 'test' hoặc 'production'
    
    PRODUCTION_BANK: { BANK_NAME: 'BIDV', BANK_CODE: '970418', ACCOUNT_NUMBER: '4660488425', ACCOUNT_NAME: 'TOOLS' },
    TEST_BANK: { BANK_NAME: 'BIDV', BANK_CODE: '970418', ACCOUNT_NUMBER: '96247328232', ACCOUNT_NAME: 'TOOLS' },
    
    POLL_INTERVAL: 3000,  // Kiểm tra mỗi 3 giây cho nhanh
    MAX_POLLS: 200,        // Tối đa 10 phút
};

function getBankInfo() {
    return NAP_TIEN_CONFIG.MODE === 'test' ? NAP_TIEN_CONFIG.TEST_BANK : NAP_TIEN_CONFIG.PRODUCTION_BANK;
}

function _getUid() { return localStorage.getItem('current_user_id'); }
function _getDb()  { return typeof db !== 'undefined' ? db : null; }
function _getDisplayName() {
    if (typeof currentUserData !== 'undefined' && currentUserData) {
        return currentUserData.displayName || currentUserData.username || 'Unknown';
    }
    return localStorage.getItem('current_username') || 'Unknown';
}

function calculateBonus(amount) {
    if (amount >= 500000) return 100000;
    if (amount >= 200000) return 40000;
    if (amount >= 100000) return 15000;
    if (amount >= 50000) return 5000;
    return 0;
}

// ──────────────────────────────────────────────
// UI: HIỂN THỊ MODAL NẠP TIỀN
// ──────────────────────────────────────────────
function showNapTienModal() {
    const uid = _getUid();
    if (!uid) { alert('Bạn cần đăng nhập để nạp tiền!'); return; }

    const nhiemVuModal = document.getElementById('nhiem-vu-modal');
    if (nhiemVuModal) nhiemVuModal.style.display = 'none';

    let modal = document.getElementById('nap-tien-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'nap-tien-modal';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.6); display: none; z-index: 9999;
            justify-content: center; align-items: center;
        `;
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <style>
            .nap-pkg-btn {
                padding: 12px; border: 2px solid #E5E7EB; border-radius: 10px;
                background: white; cursor: pointer; transition: all 0.2s; text-align: left;
            }
            .nap-pkg-btn:hover { border-color: #2563EB; background: #F3F4F6; }
            .nap-pkg-btn.selected {
                border-color: #2563EB !important; background: #EFF6FF !important;
                box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
            }
        </style>
        <div style="
            background: white; border-radius: 16px; padding: 24px;
            width: 90%; max-width: 420px; max-height: 90vh; overflow-y: auto;
            box-shadow: 0 10px 40px rgba(0,0,0,0.3);
        ">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <h2 style="margin: 0; color: #2563EB; font-size: 20px;">💰 Nạp Tiền Tự Động</h2>
                <button onclick="closeNapTienModal()" style="
                    background: none; border: none; font-size: 24px; cursor: pointer; color: #6B7280;
                ">✕</button>
            </div>

            <div style="margin-bottom: 12px;">
                <label style="display: block; margin-bottom: 8px; color: #374151; font-weight: 500;">Chọn gói nạp:</label>
                <div id="nap-packages" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
                    ${NAP_TIEN_CONFIG.PACKAGES.map((pkg, idx) => `
                        <button onclick="selectAndGenerateQR(${idx})" data-idx="${idx}" class="nap-pkg-btn">
                            <div style="font-weight: bold; color: #111827;">${pkg.label}</div>
                            <div style="font-size: 13px; color: #6B7280;">+${pkg.coins.toLocaleString('vi-VN')} Xu</div>
                            ${pkg.bonus > 0 ? `<div style="font-size: 11px; color: #22C55E; margin-top: 2px;">🎁 +${pkg.bonus.toLocaleString('vi-VN')} Bonus</div>` : ''}
                        </button>
                    `).join('')}
                </div>
            </div>

            <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 6px; color: #374151; font-weight: 500;">Hoặc nhập số tiền khác:</label>
                <div style="display: flex; gap: 8px;">
                    <input type="number" id="custom-amount" placeholder="Nhập số tiền..." style="
                        flex: 1; padding: 10px; border: 2px solid #E5E7EB; border-radius: 8px; font-size: 14px; outline: none;
                    ">
                    <button onclick="submitCustomAmount()" style="
                        padding: 10px 16px; background: #2563EB; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer;
                    ">Tạo QR</button>
                </div>
            </div>

            <!-- Khu vực hiển thị mã QR & Trạng thái -->
            <div id="nap-qr-section" style="display: none; border-top: 2px dashed #E5E7EB; padding-top: 16px; text-align: center;">
                <div id="nap-qr-code" style="
                    width: 220px; height: 220px; margin: 0 auto 10px;
                    background: #F3F4F6; border-radius: 8px; display: flex; align-items: center; justify-content: center;
                ">
                    Đang tạo QR...
                </div>
                <div id="nap-qr-details" style="font-size: 13px; color: #4B5563; line-height: 1.5; margin-bottom: 12px;"></div>

                <div id="nap-polling-status" style="background: #FFFBEB; border: 1px solid #FCD34D; padding: 10px; border-radius: 8px;">
                    <p id="nap-status-text" style="color: #D97706; font-weight: bold; margin: 0 0 4px 0;">⏳ Đang chờ quét mã...</p>
                    <p id="nap-countdown" style="color: #B45309; font-size: 12px; margin: 0;">Tự động cộng xu ngay khi nhận chuyển khoản</p>
                </div>
            </div>
        </div>
    `;

    modal.style.display = 'flex';
}
window.showNapTienModal = showNapTienModal;

function closeNapTienModal() {
    if (window.napPollingInterval) clearInterval(window.napPollingInterval);
    const modal = document.getElementById('nap-tien-modal');
    if (modal) modal.style.display = 'none';
}
window.closeNapTienModal = closeNapTienModal;

// ──────────────────────────────────────────────
// CHỌN GÓI / NHẬP TIỀN -> TỰ TẠO ĐƠN & QR TỨC THÌ
// ──────────────────────────────────────────────
async function selectAndGenerateQR(idx) {
    document.querySelectorAll('#nap-packages button').forEach((btn, i) => {
        if (i === idx) btn.classList.add('selected');
        else btn.classList.remove('selected');
    });

    // Xóa trắng ô nhập tiền tự do khi chọn gói nạp sẵn
    const customAmountInput = document.getElementById('custom-amount');
    if (customAmountInput) customAmountInput.value = '';

    const pkg = NAP_TIEN_CONFIG.PACKAGES[idx];
    await processPaymentOrder(pkg.amount, pkg.coins, pkg.bonus);
}
window.selectAndGenerateQR = selectAndGenerateQR;

async function submitCustomAmount() {
    const input = document.getElementById('custom-amount');
    const amount = parseInt(input.value);
    if (!amount || amount < 1000) {
        alert('Vui lòng nhập số tiền hợp lệ (tối thiểu 1.000 VNĐ)');
        return;
    }
    document.querySelectorAll('#nap-packages button').forEach(btn => btn.classList.remove('selected'));
    
    const coins = amount * NAP_TIEN_CONFIG.RATE;
    const bonus = calculateBonus(amount);
    await processPaymentOrder(amount, coins, bonus);
}
window.submitCustomAmount = submitCustomAmount;

function copyTransferContent(content) {
    navigator.clipboard.writeText(content).then(() => {
        alert('Đã sao chép nội dung chuyển khoản!');
    }).catch(err => {
        // Fallback cho các trình duyệt cũ
        const textArea = document.createElement('textarea');
        textArea.value = content;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('Đã sao chép nội dung chuyển khoản!');
    });
}
window.copyTransferContent = copyTransferContent;

// ──────────────────────────────────────────────
// TẠO TRANSACTION TRÊN FIREBASE & HIỂN THỊ QR
// ──────────────────────────────────────────────
async function processPaymentOrder(amount, coins, bonus) {
    const uid = _getUid();
    const displayName = _getDisplayName();
    const database = _getDb();

    if (!uid || !database) {
        alert('Lỗi kết nối hoặc chưa đăng nhập!');
        return;
    }

    const totalCoins = coins + bonus;
    // Tạo mã đơn ngắn gọn không dấu: CARO + 6 số ngẫu nhiên (VD: CARO482910)
    const transactionId = `CARO${Math.floor(100000 + Math.random() * 900000)}`;
    const bankInfo = getBankInfo();

    // Nội dung chuyển khoản chính là Mã đơn nạp
    const transferContent = transactionId;

    const firebaseData = {
        uid: uid,
        displayName: displayName,
        amount: amount,
        coins: coins,
        bonus: bonus,
        totalCoins: totalCoins,
        status: 'pending',
        createdAt: Date.now(),
        transactionId: transactionId
    };

    try {
        // Lưu vào Firebase với key chính là transactionId
        await database.ref(`transactions/${transactionId}`).set(firebaseData);

        const qrSection = document.getElementById('nap-qr-section');
        const qrCode = document.getElementById('nap-qr-code');
        const qrDetails = document.getElementById('nap-qr-details');

        const qrUrl = `https://img.vietqr.io/image/${bankInfo.BANK_CODE}-${bankInfo.ACCOUNT_NUMBER}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(transferContent)}&accountName=${bankInfo.ACCOUNT_NAME}`;

        qrCode.innerHTML = `<img src="${qrUrl}" alt="QR Code" style="width: 100%; height: 100%; border-radius: 8px;">`;
        qrDetails.innerHTML = `
            <strong>STK:</strong> ${bankInfo.ACCOUNT_NUMBER} (${bankInfo.BANK_NAME})<br>
            <strong>Nội dung CK:</strong> 
            <span style="color: #2563EB; font-size: 16px; font-weight: bold;">${transferContent}</span>
            <button onclick="copyTransferContent('${transferContent}')" style="
                margin-left: 8px; padding: 4px 10px; background: #2563EB; color: white; 
                border: none; border-radius: 6px; font-size: 12px; font-weight: bold; cursor: pointer;
            ">Sao chép</button><br>
            <strong>Số tiền:</strong> ${amount.toLocaleString('vi-VN')} VNĐ (${totalCoins.toLocaleString('vi-VN')} Xu)
        `;

        qrSection.style.display = 'block';

        // 3. Lập tức kích hoạt Lắng nghe (Realtime Observer) Firebase
        startFirebaseListener(transactionId);

    } catch (err) {
        alert('Lỗi tạo đơn nạp: ' + err.message);
    }
}

// ──────────────────────────────────────────────
// ĐỌC REALTIME TỪ FIREBASE (KHÔNG CẦN POLLING THỦ CÔNG)
// ──────────────────────────────────────────────
function startFirebaseListener(transactionId) {
    const database = _getDb();
    if (!database) return;

    if (window.activeTxRef) {
        window.activeTxRef.off(); // Hủy nghe đơn cũ nếu có
    }

    const statusText = document.getElementById('nap-status-text');
    const countdown = document.getElementById('nap-countdown');

    if (statusText) statusText.textContent = '⏳ Đang chờ nhận tiền chuyển khoản...';
    if (countdown) countdown.textContent = 'Trạng thái sẽ cập nhật tự động';

    // Đăng ký lắng nghe sự thay đổi của TransactionId này trên Firebase
    window.activeTxRef = database.ref(`transactions/${transactionId}`);
    window.activeTxRef.on('value', (snap) => {
        if (!snap.exists()) return;
        const t = snap.val();

        if (t.status === 'completed') {
            window.activeTxRef.off(); // Tắt listener khi đã hoàn tất
            if (statusText) statusText.textContent = '✅ Thanh toán thành công!';
            
            alert(`✅ Nạp thành công!\n\n+${(t.totalCoins || 0).toLocaleString('vi-VN')} Xu đã được cộng vào tài khoản.`);
            closeNapTienModal();

            // Cập nhật số xu hiển thị trên UI
            const uid = t.uid || _getUid();
            database.ref(`users/${uid}/coins`).once('value').then(s => {
                if (typeof updateCoinDisplay === 'function') updateCoinDisplay(s.val());
            });

            if (typeof showXuPopup === 'function') {
                showXuPopup(t.totalCoins, 'Nạp tiền 💰');
            }
        }
    });
}