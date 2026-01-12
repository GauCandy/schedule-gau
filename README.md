# schedule-gau

Thời khóa biểu đơn giản với admin tool, SQLite, API nội bộ và cache-busting tự động.

## Yêu cầu
- Node.js 18+ (có sẵn `npm`)
- SQLite đi kèm Node (tự tạo file DB)

## Cách chạy nhanh
```bash
git clone https://github.com/GauCandy/schedule-gau.git
cd schedule-gau
npm install
npm start            # mặc định cổng 3000
```

Ứng dụng tự khởi tạo DB tại `db/database.sqlite` và seed schema từ `db/schrema.sql`.

## Biến môi trường
- `PORT`: cổng web, mặc định `3000`.
- `ASSET_VERSION`: giá trị bất kỳ để bust cache (mặc định là timestamp khi khởi động).
- `SSL_ENABLED`: `true/false`, đặt `false` để tắt HTTPS ngay cả khi đã khai báo key/cert (mặc định `true`).
- `SSL_KEY_PATH`, `SSL_CERT_PATH`: đường dẫn file `.pem` để bật HTTPS. Nếu đặt đủ và `SSL_ENABLED=true`, server chạy HTTPS; nếu thiếu/fail sẽ fallback HTTP.

## SSL nhanh (tùy chọn)
Ví dụ dùng mkcert/openssl tạo cặp key/cert rồi chạy:
```bash
PORT=3443 \
SSL_ENABLED=true \
SSL_KEY_PATH=./certs/private.pem \
SSL_CERT_PATH=./certs/public.pem \
npm start
```

## Lưu ý
- File DB (`db/database.sqlite`) và các file `.pem` đã được bỏ qua khỏi git.
- `.env` hiện chỉ chứa `PORT` + cấu hình SSL, không có bí mật; bạn có thể commit hoặc tự quản lý.
- Khuyến nghị đặt sau reverse proxy (nginx/caddy) để xử lý SSL, nén, cache tĩnh, rate-limit và dễ cấu hình domain. Nếu proxy SSL, có thể đặt `SSL_ENABLED=false` và chỉ dùng HTTP nội bộ.
