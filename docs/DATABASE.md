# Smart Warehouse — Database Schema

Tài liệu walkthrough chi tiết schema PostgreSQL. Nếu bạn là dev mới onboarding hoặc cần hiểu structure để viết report, đọc file này trước khi mở `init-scripts/01-complete-schema-with-fk.sql`.

## Mục lục

1. [Tổng quan](#tổng-quan)
2. [Sơ đồ ERD](#sơ-đồ-erd)
3. [Nhóm bảng](#nhóm-bảng)
4. [Chi tiết từng bảng](#chi-tiết-từng-bảng)
5. [Index & performance](#index--performance)
6. [Constraint & ràng buộc](#constraint--ràng-buộc)
7. [Migration strategy](#migration-strategy)
8. [Backup & restore](#backup--restore)
9. [Troubleshooting DB](#troubleshooting-db)

---

## Tổng quan

- **RDBMS**: PostgreSQL 15.
- **Schema**: dùng mặc định `public`, không phân schema theo module (cho đơn giản cấp MVP).
- **Charset**: UTF-8 toàn diện.
- **Timezone**: Postgres lưu `TIMESTAMP` không có TZ; Node.js serialize thành ISO UTC.
- **ID strategy**: không dùng SERIAL hoặc UUID; dùng `VARCHAR(50)` với pattern prefix `<XX><4-digit>` sinh bằng application logic để dễ đọc cho người dùng (vd `WH0001`, `CT0023`).

### Số lượng bảng (tính đến thời điểm hiện tại)

- **20+ bảng nghiệp vụ chính**.
- **5 bảng master data** (tenants, branches, users, transport_providers, transport_stations).
- **3 bảng supporting** (user_otps, notifications, audit_log — dự kiến).

### Quy ước đặt tên

| Object | Convention | Ví dụ |
|---|---|---|
| Bảng | plural snake_case | `rental_requests`, `contract_items` |
| Cột | snake_case | `warehouse_id`, `created_at` |
| Primary key | `<singular>_id` | `warehouse_id`, `contract_id` |
| Foreign key | `<referenced>_id` | `tenant_id`, `contract_id` |
| Index | `idx_<table>_<col>` | `idx_rental_requests_tenant_id` |
| Unique constraint | `uq_<table>_<col>` hoặc inline UNIQUE | `warehouse_code` UNIQUE |
| Check constraint | `chk_<table>_<col>` | `chk_contracts_status` |
| Timestamp audit | `created_at`, `updated_at` | đặt ở mọi bảng nghiệp vụ |

---

## Sơ đồ ERD

Mô tả quan hệ chính (không vẽ tất cả bảng).

```
                    ┌──────────┐
                    │ tenants  │
                    └────┬─────┘
                         │ 1:N
                ┌────────┴────────┐
                ▼                 ▼
          ┌─────────┐       ┌──────────────┐
          │  users  │       │   contracts  │◄──────┐
          └────┬────┘       └──────┬───────┘       │
               │                   │               │ 1:1
               │ 1:1 (OTP)         │ 1:N           │
               ▼                   ▼               │
         ┌──────────┐      ┌────────────────┐      │
         │user_otps │      │ contract_items │      │
         └──────────┘      └────────┬───────┘      │
                                    │              │
                                    │ N:1          │
                           ┌────────┴─────────┐    │
                           │      slots       │    │
                           └────────┬─────────┘    │
                                    │              │
                                    ▼              │
                           ┌──────────────────┐    │
                           │      levels      │    │
                           └────────┬─────────┘    │
                                    │              │
                                    ▼              │
                           ┌──────────────────┐    │
                           │      racks       │    │
                           └────────┬─────────┘    │
                                    │              │
                                    ▼              │
                           ┌──────────────────┐    │
                           │      zones       │    │
                           └────────┬─────────┘    │
                                    │              │
                                    ▼              │
                           ┌──────────────────┐    │
                           │    warehouses    │    │
                           └────────┬─────────┘    │
                                    │              │
                                    ▼              │
                           ┌──────────────────┐    │
                           │     branches     │    │
                           └──────────────────┘    │
                                                   │
       ┌─────────────────┐                         │
       │ rental_requests │◄────────────────────────┘
       └─────────────────┘
```

```
                ┌──────────────────┐
                │     contracts    │
                └─────────┬────────┘
                          │ 1:N
              ┌───────────┼───────────┐
              ▼           ▼           ▼
     ┌──────────────┐ ┌─────────┐ ┌──────────────┐
     │shipment_reqs │ │invoices │ │import_export │
     └──────┬───────┘ └────┬────┘ │   _records   │
            │              │      └──────────────┘
            ▼              ▼
     ┌──────────────┐ ┌──────────┐
     │  transport_  │ │ payments │
     │  contracts   │ └──────────┘
     └──────┬───────┘
            │
            ▼
     ┌──────────────┐
     │  shipments   │
     └──────────────┘
```

---

## Nhóm bảng

Schema được chia thành 6 nhóm logic:

1. **Identity & tenancy**: `tenants`, `users`, `user_otps`.
2. **Physical infrastructure**: `branches`, `warehouses`, `zones`, `racks`, `levels`, `slots`.
3. **Rental & contract**: `rental_requests`, `contracts`, `contract_items`.
4. **Logistics**: `shipment_requests`, `transport_contracts`, `shipments`, `transport_providers`, `transport_stations`.
5. **Inventory audit**: `import_export_records`.
6. **Finance**: `invoices`, `payments`, `pricing_rules`, `promotions`.
7. **Cross-cutting**: `notifications`.

---

## Chi tiết từng bảng

### 1. `tenants`

Doanh nghiệp thuê kho.

| Cột | Kiểu | Ràng buộc | Ghi chú |
|---|---|---|---|
| `tenant_id` | VARCHAR(50) | PK | Format `TN####` |
| `company_name` | VARCHAR(255) | NOT NULL | Tên công ty |
| `tax_code` | VARCHAR(50) | NOT NULL UNIQUE | Mã số thuế; với tenant ngầm tự tạo khi register, format `IND-<userId>` |
| `contact_email` | VARCHAR(255) | | Email liên hệ |
| `contact_phone` | VARCHAR(20) | | |
| `address` | TEXT | | |
| `is_active` | BOOLEAN | DEFAULT TRUE | |
| `created_at` | TIMESTAMP | DEFAULT NOW() | |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | |

### 2. `users`

Tài khoản đăng nhập. Dùng chung cho cả staff nội bộ lẫn tenant admin.

| Cột | Kiểu | Ràng buộc | Ghi chú |
|---|---|---|---|
| `user_id` | VARCHAR(50) | PK | `USR####` |
| `tenant_id` | VARCHAR(50) | FK → tenants, NULL | NULL cho staff nội bộ |
| `branch_id` | VARCHAR(50) | FK → branches, NULL | Warehouse staff có thể gắn với 1 branch |
| `username` | VARCHAR(100) | NOT NULL UNIQUE | Mặc định = email |
| `password_hash` | VARCHAR(255) | NOT NULL | bcrypt saltRounds=10 |
| `full_name` | VARCHAR(255) | NOT NULL | |
| `phone` | VARCHAR(20) | | |
| `email` | VARCHAR(255) | NOT NULL UNIQUE | |
| `role` | VARCHAR(50) | NOT NULL CHECK | 1 trong 4 role đã liệt kê |
| `is_active` | BOOLEAN | DEFAULT TRUE | |
| `created_at`, `updated_at` | TIMESTAMP | | |

FK: `tenant_id → tenants.tenant_id ON DELETE SET NULL`, `branch_id → branches.branch_id ON DELETE SET NULL`.

### 3. `user_otps`

OTP email cho register / forgot-password.

| Cột | Kiểu | Ràng buộc | Ghi chú |
|---|---|---|---|
| `id` | SERIAL | PK | |
| `user_id` | VARCHAR(50) | NOT NULL FK → users | CASCADE delete |
| `otp_code` | VARCHAR(10) | NOT NULL | 6 số |
| `type` | VARCHAR(50) | NOT NULL CHECK | `register` hoặc `forgot_password` |
| `expires_at` | TIMESTAMP | NOT NULL | TTL 5 phút |
| `used` | BOOLEAN | DEFAULT FALSE | |
| `created_at` | TIMESTAMP | DEFAULT NOW() | |

Index: `idx_user_otps_user_type_created` để query OTP mới nhất nhanh.

### 4. `branches`

Chi nhánh kho.

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `branch_id` | VARCHAR(50) PK | `BR####` |
| `manager_id` | VARCHAR(50) FK → users | Warehouse staff quản lý |
| `branch_code` | VARCHAR(100) NOT NULL UNIQUE | |
| `branch_name` | VARCHAR(255) NOT NULL | |
| `address` | TEXT NOT NULL | |
| `phone` | VARCHAR(20) | |
| `is_active` | BOOLEAN DEFAULT TRUE | |

### 5. `warehouses`

Kho vật lý.

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `warehouse_id` | VARCHAR(50) PK | `WH####` |
| `branch_id` | VARCHAR(50) NOT NULL FK | CASCADE delete |
| `manager_id` | VARCHAR(50) FK → users | SET NULL khi xoá user |
| `warehouse_code` | VARCHAR(100) UNIQUE | |
| `warehouse_name` | VARCHAR(255) NOT NULL | |
| `address` | TEXT NOT NULL | |
| `district` | VARCHAR(100) | |
| `operating_hours` | VARCHAR(255) | |
| `length`, `width`, `height` | DECIMAL(10,2) NOT NULL | Mét |
| `total_area` | DECIMAL(10,2) | Tự tính L×W khi tạo |
| `usable_area` | DECIMAL(10,2) | Mặc định 85% total_area |
| `occupied_percent` | DECIMAL(5,2) DEFAULT 0 | % đã thuê |
| `occupancy_status` | VARCHAR(20) CHECK | `EMPTY` / `PARTIAL` / `FULL` |

### 6. `zones`

Phân khu trong warehouse.

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `zone_id` | VARCHAR(50) PK | `ZN####` |
| `warehouse_id` | VARCHAR(50) NOT NULL FK | CASCADE |
| `zone_code` | VARCHAR(50) NOT NULL | |
| `zone_name` | VARCHAR(255) | |
| `description` | TEXT | |

Composite unique: `UNIQUE(warehouse_id, zone_code)` — cho phép code trùng ở warehouse khác nhau.

### 7. `racks`

Giá kệ trong zone.

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `rack_id` | VARCHAR(50) PK | `RK####` |
| `zone_id` | VARCHAR(50) NOT NULL FK | |
| `rack_code` | VARCHAR(50) | |
| `height` | DECIMAL(10,2) | |
| `max_levels` | INT | |
| `status` | VARCHAR(20) | `AVAILABLE` / `IN_USE` / `MAINTENANCE` |

### 8. `levels`

Tầng của rack.

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `level_id` | VARCHAR(50) PK | `LV####` |
| `rack_id` | VARCHAR(50) NOT NULL FK | |
| `level_number` | INT NOT NULL | 1, 2, 3… |
| `weight_capacity_kg` | DECIMAL(10,2) | |

UNIQUE `(rack_id, level_number)`.

### 9. `slots`

Ô chứa — đơn vị cho thuê nhỏ nhất.

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `slot_id` | VARCHAR(50) PK | `SL####` |
| `level_id` | VARCHAR(50) NOT NULL FK | |
| `slot_code` | VARCHAR(50) | |
| `length`, `width`, `height` | DECIMAL(10,2) | |
| `weight_capacity_kg` | DECIMAL(10,2) | |
| `status` | VARCHAR(20) | `AVAILABLE` / `RESERVED` / `OCCUPIED` / `MAINTENANCE` |

### 10. `rental_requests`

Yêu cầu thuê từ tenant.

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `request_id` | VARCHAR(50) PK | `RR####` |
| `customer_type` | VARCHAR(20) CHECK | `individual` / `business` |
| `tenant_id` | VARCHAR(50) NOT NULL FK | Backend resolve từ userId |
| `warehouse_id` | VARCHAR(50) NOT NULL FK | |
| `rental_type` | VARCHAR(20) DEFAULT 'RACK' CHECK | `RACK` / `LEVEL` |
| `start_date`, `end_date` | DATE NOT NULL | |
| `quantity` | INT NOT NULL | |
| `status` | VARCHAR(20) CHECK | `PENDING` / `APPROVED` / `REJECTED` |
| `approved_by` | VARCHAR(50) FK → users | |
| `rejection_reason` | TEXT | |
| `note` | TEXT | |
| `created_at`, `updated_at` | TIMESTAMP | |

### 11. `contracts`

Hợp đồng thuê kho.

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `contract_id` | VARCHAR(50) PK | `CT####` |
| `request_id` | VARCHAR(50) FK → rental_requests | SET NULL |
| `tenant_id` | VARCHAR(50) NOT NULL FK | CASCADE |
| `approved_by`, `signed_by` | FK → users | |
| `contract_code` | VARCHAR(50) NOT NULL UNIQUE | |
| `start_date`, `end_date` | DATE NOT NULL | |
| `total_amount` | DECIMAL(15,2) | |
| `deposit_amount` | DECIMAL(15,2) | |
| `status` | VARCHAR(20) CHECK | `DRAFT` / `SENT` / `SIGNED` / `ACTIVE` / `COMPLETED` / `CANCELLED` |
| `signed_at`, `activated_at`, `completed_at` | TIMESTAMP | |
| `file_url` | TEXT | Chữ ký PDF |
| `note` | TEXT | |

### 12. `contract_items`

Chi tiết slot nằm trong contract.

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `item_id` | VARCHAR(50) PK | |
| `contract_id` | VARCHAR(50) NOT NULL FK | CASCADE |
| `slot_id` | VARCHAR(50) NOT NULL FK | |
| `unit_price` | DECIMAL(15,2) NOT NULL | |
| `billing_cycle` | VARCHAR(20) CHECK | `MONTHLY` / `QUARTERLY` / `YEARLY` |
| `status` | VARCHAR(20) | `ACTIVE` / `RELEASED` |

### 13. `shipment_requests`

Yêu cầu vận chuyển từ tenant.

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `request_id` | VARCHAR(50) PK | |
| `contract_id` | VARCHAR(50) NOT NULL FK | CASCADE |
| `tenant_id` | VARCHAR(50) NOT NULL FK | |
| `shipment_type` | VARCHAR(50) CHECK | `IMPORT` / `EXPORT` |
| `from_address` | TEXT NOT NULL | |
| `to_address` | TEXT NOT NULL | |
| `scheduled_date` | DATE | |
| `item_description` | TEXT | |
| `quantity` | INT | |
| `status` | VARCHAR(20) | `PENDING` / `APPROVED` / `REJECTED` |
| `reviewed_by` | VARCHAR(50) FK → users | SET NULL |
| `shipment_id` | VARCHAR(50) FK → shipments | SET NULL |

### 14. `transport_contracts`

Hợp đồng vận chuyển (song song với contracts thuê kho).

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `transport_contract_id` | VARCHAR(50) PK | |
| `shipment_request_id` | VARCHAR(50) NOT NULL UNIQUE FK | |
| `tenant_id` | VARCHAR(50) NOT NULL FK | CASCADE |
| `contract_code` | VARCHAR(50) NOT NULL UNIQUE | |
| `provider_id` | VARCHAR(50) FK → transport_providers | |
| `total_amount` | DECIMAL(15,2) | |
| `status` | VARCHAR(20) CHECK | tương tự contracts |
| `file_url` | TEXT | |
| `sent_by`, `signed_by` | FK → users | |

### 15. `shipments`

Chuyến hàng thực tế.

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `shipment_id` | VARCHAR(50) PK | `SH####` |
| `contract_id` | VARCHAR(50) FK | |
| `transport_contract_id` | VARCHAR(50) FK | |
| `shipment_code` | VARCHAR(50) UNIQUE | |
| `status` | VARCHAR(20) | `SCHEDULED` / `PICKED_UP` / `IN_TRANSIT` / `DELIVERED` / `COMPLETED` / `CANCELLED` |
| `scheduled_at`, `picked_up_at`, `delivered_at` | TIMESTAMP | |
| `driver_name`, `driver_phone`, `vehicle_plate` | VARCHAR | |
| `note` | TEXT | |

### 16. `import_export_records`

Audit trail xuất nhập.

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `record_id` | VARCHAR(50) PK | |
| `contract_id` | VARCHAR(50) NOT NULL FK | |
| `shipment_id` | VARCHAR(50) FK | |
| `record_type` | VARCHAR(20) CHECK | `IMPORT` / `EXPORT` |
| `quantity` | INT NOT NULL | |
| `item_description` | TEXT | |
| `confirmed_by` | VARCHAR(50) NOT NULL FK → users | |
| `confirmed_at` | TIMESTAMP NOT NULL | |
| `note` | TEXT | |

**Không có UPDATE / DELETE** — append-only.

### 17. `invoices`

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `invoice_id` | VARCHAR(50) PK | `INV####` |
| `contract_id` | VARCHAR(50) NOT NULL FK | CASCADE |
| `tenant_id` | VARCHAR(50) NOT NULL FK | CASCADE |
| `invoice_code` | VARCHAR(50) NOT NULL UNIQUE | |
| `invoice_type` | VARCHAR(50) CHECK | `RENTAL` / `TRANSPORTATION` / `DEPOSIT` / `OTHER` |
| `period_start`, `period_end` | DATE | |
| `subtotal`, `tax`, `total_amount` | DECIMAL(15,2) | |
| `due_date` | DATE | |
| `status` | VARCHAR(20) | `UNPAID` / `PARTIAL` / `PAID` / `OVERDUE` |
| `issued_at`, `paid_at` | TIMESTAMP | |

### 18. `payments`

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `payment_id` | VARCHAR(50) PK | `PM####` |
| `invoice_id` | VARCHAR(50) FK | SET NULL — cho phép trả không gắn invoice |
| `contract_id` | VARCHAR(50) NOT NULL FK | |
| `tenant_id` | VARCHAR(50) NOT NULL FK | |
| `payment_code` | VARCHAR(50) UNIQUE | |
| `payment_date` | DATE NOT NULL | |
| `amount` | DECIMAL(15,2) NOT NULL | |
| `payment_method` | VARCHAR(50) | `CASH` / `BANK_TRANSFER` / `VNPAY` / … |
| `processed_by` | VARCHAR(50) FK → users | |
| `note` | TEXT | |

### 19. `notifications`

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `notification_id` | VARCHAR(50) PK | |
| `user_id` | VARCHAR(50) NOT NULL FK | CASCADE |
| `type` | VARCHAR(50) | `rental_approved`, `contract_signed`, … |
| `title`, `message` | TEXT | |
| `data` | JSONB | Payload tuỳ context |
| `is_read` | BOOLEAN DEFAULT FALSE | |
| `created_at` | TIMESTAMP | |

### 20. `pricing_rules` (chưa dùng logic, chỉ seed)

Quy tắc giá động theo loại rack / level / warehouse. Dành cho roadmap.

### 21. `promotions` (chưa dùng)

Mã khuyến mãi, % discount, điều kiện apply.

### 22. `transport_providers`

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `provider_id` | VARCHAR(50) PK | |
| `provider_name` | VARCHAR(255) NOT NULL | |
| `contact_phone`, `contact_email` | | |
| `address` | TEXT | |
| `is_active` | BOOLEAN | |

### 23. `transport_stations`

Trạm trung chuyển khi shipment cross-dock.

---

## Index & performance

Các index đã tạo sẵn để query list / filter theo tenant nhanh:

```sql
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_warehouses_branch_id ON warehouses(branch_id);
CREATE INDEX idx_zones_warehouse_id ON zones(warehouse_id);
CREATE INDEX idx_slots_status ON slots(status);
CREATE INDEX idx_contracts_tenant_id ON contracts(tenant_id);
CREATE INDEX idx_contracts_status ON contracts(status);
CREATE INDEX idx_rental_requests_tenant_id ON rental_requests(tenant_id);
CREATE INDEX idx_rental_requests_status ON rental_requests(status);
CREATE INDEX idx_shipments_contract_id ON shipments(contract_id);
CREATE INDEX idx_shipments_status ON shipments(status);
CREATE INDEX idx_shipment_requests_tenant_id ON shipment_requests(tenant_id);
CREATE INDEX idx_shipment_requests_status ON shipment_requests(status);
CREATE INDEX idx_transport_contracts_tenant_id ON transport_contracts(tenant_id);
CREATE INDEX idx_transport_contracts_status ON transport_contracts(status);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
```

### Gợi ý index thêm (roadmap)

- `idx_invoices_status_due_date` cho query overdue.
- `idx_payments_payment_date` cho báo cáo theo kỳ.
- GIN index cho `notifications.data` nếu có query theo JSONB field.

---

## Constraint & ràng buộc

### CHECK constraints

```sql
users.role IN ('admin', 'warehouse_staff', 'transport_staff', 'tenant_admin')
rental_requests.customer_type IN ('individual', 'business')
rental_requests.rental_type IN ('RACK', 'LEVEL')
rental_requests.status IN ('PENDING', 'APPROVED', 'REJECTED')
contracts.status IN ('DRAFT', 'SENT', 'SIGNED', 'ACTIVE', 'COMPLETED', 'CANCELLED')
shipment_requests.shipment_type IN ('IMPORT', 'EXPORT')
shipments.status IN ('SCHEDULED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED', 'CANCELLED')
invoices.invoice_type IN ('RENTAL', 'TRANSPORTATION', 'DEPOSIT', 'OTHER')
warehouses.occupancy_status IN ('EMPTY', 'PARTIAL', 'FULL')
slots.status IN ('AVAILABLE', 'RESERVED', 'OCCUPIED', 'MAINTENANCE')
```

### Unique constraints

```sql
users.email UNIQUE
users.username UNIQUE
tenants.tax_code UNIQUE
branches.branch_code UNIQUE
warehouses.warehouse_code UNIQUE
zones UNIQUE(warehouse_id, zone_code)
levels UNIQUE(rack_id, level_number)
contracts.contract_code UNIQUE
transport_contracts.shipment_request_id UNIQUE
transport_contracts.contract_code UNIQUE
invoices.invoice_code UNIQUE
payments.payment_code UNIQUE
shipments.shipment_code UNIQUE
```

### Foreign key ON DELETE policies

| FK | Policy | Lý do |
|---|---|---|
| `users.tenant_id → tenants` | SET NULL | Giữ user lại khi xoá tenant |
| `users.branch_id → branches` | SET NULL | |
| `user_otps.user_id → users` | CASCADE | OTP không có ý nghĩa khi user bị xoá |
| `warehouses.branch_id → branches` | CASCADE | Xoá branch thì warehouses con cũng xoá |
| `zones.warehouse_id → warehouses` | CASCADE | |
| `racks.zone_id → zones` | CASCADE | |
| `levels.rack_id → racks` | CASCADE | |
| `slots.level_id → levels` | CASCADE | |
| `rental_requests.tenant_id → tenants` | SET NULL | Lưu lại history |
| `contracts.tenant_id → tenants` | CASCADE | Xoá tenant = xoá toàn bộ contract |
| `contract_items.contract_id → contracts` | CASCADE | |

---

## Migration strategy

### Giai đoạn hiện tại (MVP)

- File SQL thô ở `init-scripts/NN-<description>.sql`.
- Postgres container tự chạy tất cả file trong thư mục này theo thứ tự alphabet khi init volume lần đầu.
- Nếu volume đã tồn tại → **KHÔNG** chạy lại.
- Migration bổ sung sau MVP: chạy tay bằng `psql` hoặc `docker compose exec postgres psql -U warehouse_admin -d smart_warehouse -f /docker-entrypoint-initdb.d/NN-xxx.sql`.

### Quy ước đánh số file

| Dải | Ý nghĩa |
|---|---|
| `00-09` | Drop legacy, init schema chính |
| `10-19` | Alter / thêm cột / thêm table sau khi đã có data |
| `20-29` | Backfill data / migration nghiệp vụ (vd 20-backfill-tenant-for-orphan-users.sql) |
| `30+` | Future |

### Idempotency

Mọi migration nên idempotent:

```sql
CREATE TABLE IF NOT EXISTS ...
ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...
CREATE INDEX IF NOT EXISTS ...
```

Hoặc bọc trong `DO $$ BEGIN IF NOT EXISTS ... END IF; END $$;`.

### Roadmap — tool migration chuẩn

Dự kiến chuyển sang [`node-pg-migrate`](https://github.com/salsita/node-pg-migrate) sau MVP để:

- Versioning chặt chẽ (bảng `pgmigrations`).
- Rollback được.
- Viết migration bằng JS / SQL linh hoạt.

---

## Backup & restore

### Backup (dev)

```bash
docker compose exec postgres pg_dump \
  -U warehouse_admin \
  -d smart_warehouse \
  --no-owner --no-acl \
  > backup_$(date +%Y%m%d).sql
```

### Restore

```bash
docker compose exec -T postgres psql \
  -U warehouse_admin \
  -d smart_warehouse \
  < backup_20260422.sql
```

### Reset clean (dev only)

```bash
docker compose down -v   # XOÁ volume Postgres
docker compose up -d     # Postgres sẽ chạy lại toàn bộ init-scripts
docker compose exec app npm run seed
```

---

## Troubleshooting DB

### `relation "xxx" does not exist`

- Init script lỗi khi chạy lần đầu → check `docker compose logs postgres`.
- Hoặc bạn thêm table mới vào `init-scripts/` mà volume Postgres đã init → phải `docker compose down -v` rồi up lại.

### `duplicate key value violates unique constraint`

- Check UNIQUE constraint trên bảng đó; thường là `email`, `username`, `warehouse_code`.

### `foreign key violation on insert`

- Reference ID không tồn tại. Check thứ tự INSERT (parent trước, child sau).

### Performance chậm trên list endpoint

- Check `EXPLAIN ANALYZE` xem có dùng index không.
- Thiếu index trên `tenant_id` / `status` là nguyên nhân phổ biến.

### Connection pool exhausted

- `pool.connect()` không release — tìm các chỗ thiếu `finally { client.release() }`.

---
