# Caro Server

Backend lưu lịch sử và bảng xếp hạng cho tất cả người chơi.

## Cài đặt

```bash
cd server
npm install
npm start
```

Server chạy tại `http://localhost:3000`

## Deploy lên Render.com (miễn phí)

1. Tạo tài khoản tại https://render.com
2. New → Web Service → kết nối GitHub repo
3. Root Directory: `server`
4. Build Command: `npm install`
5. Start Command: `node server.js`
6. Copy URL sau khi deploy (vd: `https://caro-abc123.onrender.com`)

## Kết nối game với server

Mở `ox-v8.html`, tìm dòng:
```js
const API_URL = '';
```
Đổi thành URL server của bạn:
```js
const API_URL = 'https://caro-abc123.onrender.com';
```

## API

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | /api/rank | Lấy toàn bộ bảng xếp hạng |
| POST | /api/rank | Thêm kỷ lục mới |
| DELETE | /api/rank | Xóa bảng xếp hạng |
| GET | /api/history | Lấy lịch sử đấu (200 ván gần nhất) |
| POST | /api/history | Thêm ván mới |
| DELETE | /api/history | Xóa lịch sử |

## Lưu ý

- `data.json` lưu tất cả dữ liệu — backup file này định kỳ
- Render free tier ngủ sau 15 phút không có request, lần đầu vào sẽ chậm ~30s
- Nếu cần persistent storage trên Render, dùng Disk hoặc chuyển sang MongoDB Atlas (miễn phí 512MB)
