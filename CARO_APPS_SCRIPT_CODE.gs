// ──────────────────────────────────────────────
// GOOGLE APPS SCRIPT DÙNG TRANSACTION ID
// ──────────────────────────────────────────────
const FIREBASE_DB_URL = 'https://caro-fa824-default-rtdb.asia-southeast1.firebasedatabase.app';

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return responseJSON('error', 'Empty post data');
    }

    const data = JSON.parse(e.postData.contents);

    // Xử lý callback từ SePay
    if (data.id && data.content && (data.transferAmount !== undefined || data.amount !== undefined)) {
      return handleSePayCallback(data);
    } 
    return responseJSON('error', 'Unknown request format');

  } catch (error) {
    return responseJSON('error', error.toString());
  }
}

// Thêm doGet để test và tránh redirect
function doGet(e) {
  return responseJSON('success', 'Webhook is active', { timestamp: Date.now() });
}

function handleSePayCallback(data) {
  const amount = parseInt(data.transferAmount !== undefined ? data.transferAmount : data.amount) || 0;
  const content = (data.content || '').toString().toLowerCase();

  // Đọc danh sách đơn pending trên Firebase
  const pendingTx = findPendingTransactionInFirebase(content, amount);

  if (pendingTx) {
    const totalCoins = parseInt(pendingTx.totalCoins) || 0;
    const uid = pendingTx.uid;
    const transactionId = pendingTx.transactionId;

    approveTransactionInFirebase(transactionId, uid, totalCoins, data.id);

    return responseJSON('success', 'Approved successfully', { transactionId, sepayId: data.id });
  } else {
    return responseJSON('not_found', 'No matching pending transaction found');
  }
}

function findPendingTransactionInFirebase(content, amount) {
  const url = `${FIREBASE_DB_URL}/transactions.json?orderBy="status"&equalTo="pending"`;

  try {
    const res = UrlFetchApp.fetch(url, { method: 'get', muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return null;

    const data = JSON.parse(res.getContentText());
    if (!data) return null;

    for (const tid in data) {
      const t = data[tid];
      const txAmount = parseInt(t.amount) || 0;
      const searchId = tid.toLowerCase(); // Mã transactionId

      // So sánh: Nội dung CK chứa transactionId VÀ số tiền khớp
      if (content.includes(searchId) && txAmount === amount) {
        return { transactionId: tid, ...t };
      }
    }
  } catch (e) {
    // Error
  }
  return null;
}

function approveTransactionInFirebase(transactionId, uid, totalCoins, sepayId) {
  if (!uid) return;

  // 1. Lấy xu hiện tại
  const coinsUrl = `${FIREBASE_DB_URL}/users/${uid}/coins.json`;
  const coinsRes = UrlFetchApp.fetch(coinsUrl, { method: 'get', muteHttpExceptions: true });
  const currentCoins = parseInt(coinsRes.getContentText()) || 0;
  const newCoins = currentCoins + totalCoins;

  // 2. Cập nhật xu
  UrlFetchApp.fetch(coinsUrl, {
    method: 'put',
    contentType: 'application/json',
    payload: JSON.stringify(newCoins),
    muteHttpExceptions: true
  });

  // 3. Chuyển trạng thái đơn sang completed
  const txUrl = `${FIREBASE_DB_URL}/transactions/${transactionId}.json`;
  UrlFetchApp.fetch(txUrl, {
    method: 'patch',
    contentType: 'application/json',
    payload: JSON.stringify({
      status: 'completed',
      sepayTransactionId: sepayId,
      processedAt: Date.now(),
      processedBy: 'sepay-webhook'
    }),
    muteHttpExceptions: true
  });
}

function responseJSON(status, message, extraData = {}) {
  const res = Object.assign({ status, message }, extraData);
  return ContentService.createTextOutput(JSON.stringify(res))
    .setMimeType(ContentService.MimeType.JSON);
}
