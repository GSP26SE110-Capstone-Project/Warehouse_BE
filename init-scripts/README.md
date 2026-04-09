# Init Scripts cho PostgreSQL

## 📝 Mục đích

Thư mục này chứa các file SQL sẽ được PostgreSQL tự động chạy khi database được khởi tạo **lần đầu tiên**.

## ⚠️ Lưu ý quan trọng

- **Chỉ chạy khi database MỚI**: Các script này chỉ chạy khi database được tạo lần đầu
- **Không chạy lại**: Nếu database đã tồn tại, các script này sẽ KHÔNG chạy
- **Thứ tự chạy**: PostgreSQL chạy các file theo thứ tự alphabet (01, 02, 03...)

## 📁 Cấu trúc đề xuất

```
init-scripts/
├── 01-schema.sql          # Tạo tables, indexes
├── 02-seed-data.sql       # Insert dữ liệu mẫu
├── 03-constraints.sql     # Foreign keys, constraints
└── README.md              # File này
```

## 🔄 Cách sử dụng

### 1. Tạo schema (tables)
Tạo file `01-schema.sql` với các lệnh CREATE TABLE:

```sql
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 2. Tạo seed data (dữ liệu mẫu)
Tạo file `02-seed-data.sql` với các lệnh INSERT:

```sql
INSERT INTO users (username, email) VALUES
('admin', 'admin@example.com'),
('user1', 'user1@example.com');
```

### 3. Reset database để chạy lại scripts
Nếu muốn chạy lại init scripts:

```bash
# Xóa database và tạo lại
docker-compose down -v
docker-compose up -d
```

## ✅ Lợi ích

1. **Mọi người có cùng schema**: Khi pull code và chạy `docker-compose up`, mọi người sẽ có cùng cấu trúc database
2. **Có dữ liệu mẫu**: Mọi người có thể test với cùng dữ liệu mẫu
3. **Tự động hóa**: Không cần chạy SQL thủ công

## 🚫 Hạn chế

- **Chỉ chạy lần đầu**: Nếu database đã có data, scripts không chạy
- **Không update**: Scripts không update data đã tồn tại
- **Local data**: Data thực tế mỗi người vẫn riêng biệt

## 💡 Best Practice

1. **Đặt tên file có số thứ tự**: `01-`, `02-`, `03-` để đảm bảo thứ tự chạy
2. **Dùng IF NOT EXISTS**: Tránh lỗi nếu table đã tồn tại
3. **Commit vào Git**: Để mọi người có cùng schema và seed data

