# Smart Warehouse Backend

REST API cho hệ thống **Smart Warehouse** — SaaS B2B quản lý kho thông minh: cho thuê không gian kho (warehouse / zone / rack / level / slot), quản lý hợp đồng, yêu cầu vận chuyển, xuất nhập hàng, hoá đơn, thanh toán.

> Project thuộc đồ án capstone **SEP490 — NextGenWarehouse**.

---

## Mục lục

1. [Tech Stack](#tech-stack)
2. [Yêu cầu môi trường](#yêu-cầu-môi-trường)
3. [Cấu hình `.env`](#cấu-hình-env)
4. [Chạy với Docker Compose (khuyến nghị)](#chạy-với-docker-compose-khuyến-nghị)
5. [Chạy local không Docker](#chạy-local-không-docker)
6. [Seed dữ liệu test](#seed-dữ-liệu-test)
7. [Cấu trúc dự án](#cấu-trúc-dự-án)
8. [Danh sách API chính](#danh-sách-api-chính)
9. [Authentication (JWT)](#authentication-jwt)
10. [Tài khoản test](#tài-khoản-test)
11. [Quy ước naming](#quy-ước-naming)
12. [Troubleshooting](#troubleshooting)

---

## Tech Stack

| Lớp | Công nghệ |
|---|---|
| Runtime | Node.js 18 |
| Framework | Express 5 |
| Database | PostgreSQL 15 |
| ORM / Query | `pg` (raw SQL, không ORM) |
| Auth | JWT (`jsonwebtoken`) + bcrypt |
| API Docs | Swagger (`swagger-jsdoc` + `swagger-ui-express`) |
| Email | Nodemailer |
| Dev | Nodemon, Docker Compose |

---

## Yêu cầu môi trường

- **Docker Desktop** (khuyến nghị) — tự động dựng Node + Postgres.
- Hoặc: **Node.js ≥ 18** + **PostgreSQL ≥ 15** cài sẵn trên máy.

---

## Cấu hình `.env`

Tạo file `.env` ở root `Warehouse_BE/` (copy từ `.env.example` nếu có):

```env
# Server
PORT=3000
NODE_ENV=development

# Database (khi chạy Docker, hostname = postgres; khi chạy local, hostname = localhost)
DATABASE_URL=postgresql://warehouse_admin:SP26SE040%40%21@localhost:5432/smart_warehouse

# JWT
JWT_SECRET=sp26se040-jwt-secret-key-2026
JWT_EXPIRES_IN=7d

# Email (tùy chọn, nếu bật OTP qua email)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM="Smart Warehouse <noreply@smartwarehouse.local>"

# (Tùy chọn) cổng host mapped ra, mặc định 3000
API_HOST_PORT=3000
```

> Password Postgres chứa ký tự đặc biệt `@!` nên phải URL-encode thành `%40%21` trong `DATABASE_URL`.

---

## Chạy với Docker Compose (khuyến nghị)

```bash
# Build + chạy cả Postgres và API trong 1 lệnh
docker compose up -d --build

# Xem log
docker compose logs -f app

# Dừng (GIỮ lại data Postgres)
docker compose down

# Dừng + XOÁ data Postgres (chỉ khi muốn reset)
docker compose down -v
```

Sau khi container lên:

- API: <http://localhost:3000>
- Swagger Docs: <http://localhost:3000/api-docs>
- Health check: <http://localhost:3000/health>

### Khi build lại gặp lỗi native module (bcrypt, …)

Node native module phụ thuộc kiến trúc CPU. Nếu bạn vừa `npm install` trên Windows rồi build container Linux mà gặp `Exec format error`:

```bash
docker compose down
docker volume ls | grep node_modules
docker volume rm <tên-volume-node_modules>
docker compose build --no-cache app
docker compose up -d
```

File `.dockerignore` đã chặn `node_modules` host lọt vào image, nên sau khi rebuild không cache là sạch.

---

## Chạy local không Docker

```bash
# 1. Cài deps
npm install

# 2. Đảm bảo Postgres đang chạy, có DB 'smart_warehouse' và user 'warehouse_admin'
#    Chạy các file trong init-scripts/ theo thứ tự 00, 01, 03, 04, ...
#    (Docker tự làm việc này, còn local thì phải chạy tay:)
psql -U warehouse_admin -d smart_warehouse -f init-scripts/00-drop-legacy-tables.sql
psql -U warehouse_admin -d smart_warehouse -f init-scripts/01-complete-schema-with-fk.sql
# ... tiếp các file 03 → 19 theo thứ tự số

# 3. Chạy dev server (có auto-reload)
npm run dev

# hoặc chạy production
npm start
```

---

## Seed dữ liệu test

Sau khi DB đã có schema, chạy:

```bash
# Nếu chạy Docker
docker compose exec app npm run seed

# Nếu chạy local
npm run seed
```

Script `scripts/seed.js` **idempotent** — chạy nhiều lần không lỗi. Tạo sẵn:

- 1 tenant, 1 branch, 1 warehouse, 3 zones, 1 rack, 1 level, 2 slots
- 4 user với 4 role khác nhau
- 1 rental_request (APPROVED), 1 contract (ACTIVE), 1 contract_item
- 1 pricing_rule, 1 promotion

---

## Cấu trúc dự án

```
Warehouse_BE/
├── init-scripts/            # SQL migration chạy khi init Postgres container
│   ├── 00-drop-legacy-tables.sql
│   ├── 01-complete-schema-with-fk.sql
│   └── 03 → 19 (các migration bổ sung theo feature)
├── scripts/
│   └── seed.js              # Seed data test
├── src/
│   ├── config/
│   │   ├── db.js            # PostgreSQL pool
│   │   └── swagger.js       # Swagger config
│   ├── controllers/         # Business logic (1 controller / 1 resource)
│   ├── middlewares/
│   │   └── AuthMiddleware.js # requireAuth, requireRoles
│   ├── models/              # Schema metadata + tên bảng
│   ├── routes/              # Express routes + Swagger annotations
│   ├── services/
│   │   ├── EmailService.js
│   │   └── JwtService.js
│   └── utils/
│       └── idGenerator.js   # Sinh ID dạng prefix + số tự tăng (WH0001, ZN0001, …)
├── server.js                # Entry point
├── Dockerfile
├── docker-compose.yml
├── .dockerignore
├── .env
└── package.json
```

---

## Danh sách API chính

Đầy đủ prefix: `/api`. Xem chi tiết schema / request / response ở **Swagger**: <http://localhost:3000/api-docs>

| Group | Endpoint chính |
|---|---|
| **Auth** | `POST /auth/register`, `POST /auth/verify-register-otp`, `POST /auth/login`, `POST /auth/forgot-password`, `POST /auth/reset-password` |
| **Users** | `GET /users`, `GET /users/:id`, `PATCH /users/:id` |
| **Tenants** | `GET /tenants`, `GET /tenants/:id` |
| **Branches** | `GET /branches`, `POST /branches`, `PATCH /branches/:id` |
| **Warehouses** | `GET /warehouses`, `POST /warehouses`, `GET /warehouses/:id`, `GET /warehouses/:id/zones` |
| **Zones** | `GET /zones`, `POST /zones`, `GET /zones/:id`, `PATCH /zones/:id`, `DELETE /zones/:id` |
| **Racks / Levels / Slots** | CRUD tương tự Zones |
| **Rental Requests** | `POST /rental-requests`, `GET /rental-requests`, `PATCH /rental-requests/:id`, `POST /rental-requests/:id/approve`, `POST /rental-requests/:id/reject` |
| **Contracts** | `POST /contracts`, `GET /contracts`, `POST /contracts/:id/send`, `POST /contracts/:id/sign`, `POST /contracts/:id/activate` |
| **Contract Items** | `POST /contract-items`, `GET /contract-items` |
| **Shipments** | `GET /shipments`, `POST /shipments`, `PATCH /shipments/:id/status` |
| **Shipment Requests** | `POST /shipment-requests`, `POST /shipment-requests/:id/approve`, `POST /shipment-requests/:id/reject` |
| **Transport Contracts / Stations / Providers** | CRUD |
| **Import/Export Records** | Quản lý nhập/xuất kho theo contract |
| **Notifications** | `GET /notifications`, `PATCH /notifications/:id/read` |

---

## Authentication (JWT)

### Login

```http
POST /api/auth/login
Content-Type: application/json

{ "email": "admin@test.local", "password": "Password@123" }
```

Response:

```json
{
  "accessToken": "eyJhbGci...",
  "user": { "userId": "USR001", "role": "admin", ... }
}
```

### Dùng token

Mọi endpoint có dấu 🔒 trong Swagger cần header:

```
Authorization: Bearer <accessToken>
```

Hoặc bấm nút **Authorize** trên Swagger UI, dán token vào rồi Authorize.

### Role & quyền

4 role hợp lệ:

| Role | Ghi chú |
|---|---|
| `admin` | Toàn quyền |
| `warehouse_staff` | Quản lý kho, duyệt rental request, shipment |
| `transport_staff` | Quản lý vận chuyển |
| `tenant_admin` | Người đại diện bên thuê kho (tự đăng ký qua `register`) |

Khi `register`, role mặc định là `tenant_admin`. Backend tự tạo `tenants` ngầm để các bảng nghiệp vụ có `tenant_id` (FE không cần biết khái niệm tenant).

---

## Tài khoản test

Tất cả password: `Password@123`

| Email | Role | User ID |
|---|---|---|
| `admin@test.local` | admin | USR001 |
| `whstaff@test.local` | warehouse_staff | USR002 |
| `transport@test.local` | transport_staff | USR003 |
| `tenant@test.local` | tenant_admin (có tenant TN001) | USR004 |

---

## Quy ước naming

- **DB (Postgres)**: `snake_case` (`warehouse_id`, `created_at`).
- **API JSON**: `camelCase` (`warehouseId`, `createdAt`).
- Mỗi controller đều có hàm `mapXxxRow(row)` để chuyển từ DB row → domain object camelCase.

ID generation: pattern `<PREFIX><4-digit>` (vd `WH0001`, `ZN0005`) qua `utils/idGenerator.js`.

---

## Troubleshooting

### 1. `Error loading shared library bcrypt_lib.node: Exec format error`

`node_modules` từ Windows lọt vào image Linux. Fix:

```bash
docker compose down
docker volume rm $(docker volume ls -q | grep node_modules)
docker compose build --no-cache app && docker compose up -d
```

### 2. Login trả 401 / Forbidden

- `401 Unauthorized`: token sai / hết hạn → login lại.
- `403 Forbidden`: role không đủ quyền → decode token ở [jwt.io](https://jwt.io) check trường `role`.

### 3. POST rental-requests trả `"User chưa được gắn với tenant nào"`

User này được tạo trước khi bật auto-tạo tenant. 2 cách:
- Register account mới (sẽ tự có tenant).
- Hoặc login seed user `tenant@test.local`.
- Hoặc update tay: `UPDATE users SET tenant_id = 'TN001' WHERE user_id = '<id>';`

### 4. Port 3000 bị chiếm

Set `API_HOST_PORT=3005` trong `.env`, rồi `docker compose up -d`. Swagger sẽ ở <http://localhost:3005/api-docs>.

### 5. Postgres healthcheck fail

```bash
docker compose logs postgres
```

Thường do file SQL trong `init-scripts/` lỗi. File `02-schema-improvements.sql` đã bị disable (nằm trong `init-scripts/disabled/`) vì ALTER bảng legacy.

---

## Scripts

| Lệnh | Tác dụng |
|---|---|
| `npm start` | Chạy production |
| `npm run dev` | Chạy dev với nodemon auto-reload |
| `npm run seed` | Seed data test |

---

## License

ISC — Dự án nội bộ, mục đích học tập (SEP490).
