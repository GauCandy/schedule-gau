-- =========================
-- BẢNG LỚP (CLASS)
-- =========================
CREATE TABLE IF NOT EXISTS classes (
    uid INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Ví dụ: 10A1, CNTT-K19...
    class_name TEXT NOT NULL UNIQUE,

    -- Mật khẩu chỉnh sửa (SHA-256, lưu dạng hex string)
    password_hash TEXT,

    -- ===== CỘT MỐC TUẦN HỌC =====

    -- Ngày mốc (ISO format: YYYY-MM-DD)
    base_date DATE NOT NULL,

    -- Tuần tương ứng với ngày mốc (vd: 2, 4, 10...)
    base_week INTEGER NOT NULL,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Tên môn học
    subject_name TEXT NOT NULL,

    -- Giáo viên dạy
    teacher TEXT,

    -- Phòng học
    room TEXT,

    -- Gắn với lớp
    class_uid INTEGER NOT NULL,

    -- Tuần bắt đầu / kết thúc môn
    start_week INTEGER NOT NULL,
    end_week INTEGER NOT NULL,

    -- Thứ trong tuần: 1 = CN, 2 = T2, ... 7 = T7
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),

    -- Buổi học: 1 = sáng, 0 = chiều (boolean)
    is_morning INTEGER NOT NULL CHECK (is_morning IN (0, 1)),

    -- Các tuần nghỉ, dạng text: ví dụ "22,23"
    off_weeks TEXT,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (class_uid) REFERENCES classes(uid)
);

CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Gắn với lớp
    class_uid INTEGER NOT NULL,

    -- Tuần áp dụng note
    week INTEGER NOT NULL,

    -- Thứ trong tuần: 1 = CN, 2 = T2, ... 7 = T7
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),

    -- Buổi: 1 = sáng, 0 = chiều
    is_morning INTEGER NOT NULL CHECK (is_morning IN (0, 1)),

    -- Nội dung ghi chú
    content TEXT NOT NULL,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (class_uid) REFERENCES classes(uid)
);
