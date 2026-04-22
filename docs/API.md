# Smart Warehouse — API Reference

Tài liệu chi tiết cho REST API của backend Smart Warehouse. Đây là tài liệu "con người đọc" — với mô tả nghiệp vụ, ví dụ request / response, mã lỗi, và edge cases — bổ sung cho Swagger UI tự sinh (`/api-docs`).

> Mọi endpoint đều có prefix `/api`. Request / response luôn là JSON (`Content-Type: application/json`). Encoding UTF-8. Timestamp trả về theo chuẩn ISO 8601 (UTC).

## Mục lục

1. [Quy ước chung](#quy-ước-chung)
2. [Auth](#auth)
3. [Users](#users)
4. [Tenants](#tenants)
5. [Branches](#branches)
6. [Warehouses](#warehouses)
7. [Zones](#zones)
8. [Racks / Levels / Slots](#racks--levels--slots)
9. [Rental Requests](#rental-requests)
10. [Contracts & Contract Items](#contracts--contract-items)
11. [Shipment Requests](#shipment-requests)
12. [Transport Contracts](#transport-contracts)
13. [Shipments](#shipments)
14. [Import/Export Records](#importexport-records)
15. [Invoices & Payments](#invoices--payments)
16. [Notifications](#notifications)
17. [Mã lỗi chuẩn](#mã-lỗi-chuẩn)
18. [Đổi log](#đổi-log)

---

## Quy ước chung

### Base URL

- Local dev: `http://localhost:3000/api`
- Staging: `https://staging.smartwarehouse.local/api`
- Production: `https://api.smartwarehouse.local/api`

### Authentication header

Hầu hết endpoint yêu cầu JWT token:

```
Authorization: Bearer <accessToken>
```

Nếu thiếu hoặc token hết hạn → `401 Unauthorized`.
Nếu role không đủ → `403 Forbidden`.

### Pagination

Các endpoint list đều hỗ trợ:

| Query param | Mặc định | Tối đa | Ghi chú |
|---|---|---|---|
| `limit` | 50 | 200 | Số record / page |
| `offset` | 0 | — | Vị trí bắt đầu |

Response trả về là **mảng phẳng**; client tự suy paging theo số phần tử.

### Date / Time

- Input: chấp nhận `YYYY-MM-DD` (cho date) hoặc ISO 8601 full `YYYY-MM-DDTHH:mm:ssZ` (cho timestamp).
- Output: luôn ISO 8601 UTC.

### ID format

Tất cả primary key đều là chuỗi `<PREFIX><4-digit>` (xem bảng trong README.md mục "Mô hình dữ liệu chính").

### Naming

- Request body: `camelCase` (`warehouseId`, `startDate`).
- Response body: `camelCase`.
- Không bao giờ thấy `snake_case` trong API payload.

### Content negotiation

Server chỉ hỗ trợ `application/json` cho cả request và response. Gửi `Content-Type` khác → 415 (hoặc Express sẽ tự parse sai).

---

## Auth

### `POST /auth/register`

Tạo tài khoản mới (luôn là `tenant_admin`). Phải xác thực OTP qua email trước khi login được.

**Body**:

```json
{
  "email": "kh1@congty.com",
  "password": "Password@123",
  "fullName": "Nguyễn Văn A",
  "phone": "0900000001"
}
```

**Response 201**:

```json
{
  "message": "Đã gửi OTP đến email, vui lòng xác thực",
  "userId": "USR0012"
}
```

**Lỗi**:

- `400` — thiếu field bắt buộc.
- `409` — email đã được dùng.
- `500` — gửi email thất bại.

**Nghiệp vụ**:

1. Validate email format, password ≥ 6 ký tự.
2. Hash password bằng bcrypt saltRounds=10.
3. Insert `users` với `is_active = FALSE` (chưa active).
4. Sinh OTP 6 số, TTL 5 phút, insert `user_otps` với `type = 'register'`.
5. Gửi email OTP qua Nodemailer.

### `POST /auth/verify-register-otp`

Xác thực OTP, kích hoạt tài khoản, tự tạo tenant ngầm (nếu role = tenant_admin), trả về JWT.

**Body**:

```json
{
  "userId": "USR0012",
  "otp": "123456"
}
```

**Response 200**:

```json
{
  "message": "Xác thực thành công",
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "userId": "USR0012",
    "email": "kh1@congty.com",
    "fullName": "Nguyễn Văn A",
    "role": "tenant_admin",
    "tenantId": "TN0005",
    "isActive": true
  }
}
```

**Lỗi**:

- `400` — OTP sai / hết hạn / đã dùng.
- `404` — không tìm thấy user.

**Nghiệp vụ**:

1. Tìm OTP mới nhất chưa dùng của user với `type = 'register'`.
2. So sánh code + check `expires_at > NOW()`.
3. Mark OTP `used = TRUE`.
4. Nếu user là tenant_admin và `tenant_id IS NULL` → call `createImplicitTenantForUser` trong cùng transaction:
   - Sinh `tenant_id` kiểu `TN####` sequential.
   - Insert tenants với `company_name = user.fullName`, `tax_code = 'IND-<userId>'`, `contact_email = user.email`.
   - Update `users SET tenant_id = <new>`.
5. Set `is_active = TRUE`.
6. Sinh JWT payload `{ userId, email, role, tenantId }`, trả về.

### `POST /auth/login`

**Body**:

```json
{
  "email": "kh1@congty.com",
  "password": "Password@123"
}
```

**Response 200**: giống verify-register-otp (trả user + accessToken).

**Lỗi**:

- `400` — thiếu field.
- `401` — sai email hoặc password.
- `403` — tài khoản bị vô hiệu hoá (`is_active = FALSE`).

### `POST /auth/forgot-password`

Gửi OTP reset password về email.

**Body**: `{ "email": "kh1@congty.com" }`.

**Response 200**: `{ "message": "Đã gửi OTP reset password" }` (luôn trả success dù email không tồn tại — chống enumeration attack).

### `POST /auth/reset-password`

**Body**:

```json
{
  "email": "kh1@congty.com",
  "otp": "987654",
  "newPassword": "NewPass@456"
}
```

**Response 200**: `{ "message": "Đổi mật khẩu thành công" }`.

---

## Users

### `POST /users` — Admin tạo staff nội bộ

🔒 **Auth**: JWT admin.

**Body**:

```json
{
  "email": "whstaff2@congty.com",
  "password": "Password@123",
  "fullName": "Trần Thị B",
  "role": "warehouse_staff",
  "phone": "0900000002"
}
```

**Role whitelist**: `admin`, `warehouse_staff`, `transport_staff`. Không cho tạo `tenant_admin` (end-user phải tự register).

**Response 201**: user object (không có `passwordHash`).

**Lỗi**:

- `400` — thiếu field, role không hợp lệ.
- `401` / `403` — chưa đăng nhập / không phải admin.
- `409` — email / username trùng.

### `GET /users`

**Query**:

- `status` — `active` | `inactive` (filter `is_active`).
- `limit`, `offset`.

**Response 200**: `[User]`.

### `GET /users/:id`

**Response 200**: `User`. `404` nếu không tồn tại.

### `PATCH /users/:id`

🔒 **Auth**: JWT admin.

**Body** (tối thiểu 1 field):

```json
{
  "email": "new@email.com",
  "fullName": "Nguyễn Văn C",
  "phone": "0900000003",
  "role": "warehouse_staff"
}
```

**Không dùng để**: đổi mật khẩu (dùng `forgot-password` / `reset-password`), hoặc toggle active (dùng DELETE / restore).

**Lỗi**:

- `400` — body rỗng / role không hợp lệ.
- `401` / `403`.
- `404`.

### `POST /users/:id/restore`

🔒 **Auth**: JWT admin.

Kích hoạt lại user đã bị DELETE soft.

**Response 200**: `{ message, user }`. **409** nếu user đang active.

### `DELETE /users/:id`

🔒 **Auth**: JWT admin.

Soft deactivate (set `is_active = FALSE`).

**Response 200**: `{ message: "Account deactivated successfully", user }`.

---

## Tenants

### `GET /tenants`

🔒 Admin / warehouse_staff.

**Response**: `[Tenant]`.

### `GET /tenants/:id`

Tenant admin chỉ được xem tenant của chính mình. Admin / staff xem tất cả.

### `PATCH /tenants/:id`

🔒 Tenant admin (chỉ tenant của mình) hoặc admin.

**Body**:

```json
{
  "companyName": "Công ty TNHH XYZ",
  "taxCode": "0123456789",
  "contactEmail": "contact@xyz.com",
  "contactPhone": "0912345678",
  "address": "123 Nguyễn Văn A, Q.1, HCM"
}
```

---

## Branches

### `GET /branches`

**Query**: `limit`, `offset`.

### `POST /branches`

🔒 Admin.

**Body**:

```json
{
  "branchCode": "BR-BD-01",
  "branchName": "Chi nhánh Bình Dương",
  "address": "Số 1 Đại lộ Bình Dương, Thủ Dầu Một",
  "managerId": "USR0002"
}
```

### `PATCH /branches/:id`

🔒 Admin / warehouse_staff.

### `DELETE /branches/:id`

🔒 Admin.

---

## Warehouses

### `GET /warehouses`

**Query**:

- `branchId` — filter theo chi nhánh.
- `occupancyStatus` — `EMPTY` | `PARTIAL` | `FULL`.
- `limit`, `offset`.

### `GET /warehouses/:id`

### `GET /warehouses/:id/zones`

Trả tất cả zone của 1 warehouse kèm `totalSlots`.

**Response 200**:

```json
[
  {
    "zoneId": "ZN0001",
    "zoneCode": "A",
    "zoneName": "Hàng khô",
    "warehouseId": "WH0001",
    "totalSlots": 48,
    "createdAt": "2026-01-10T03:20:11.000Z"
  }
]
```

### `POST /warehouses`

🔒 Admin / warehouse_staff.

**Body**:

```json
{
  "branchId": "BR0001",
  "warehouseCode": "WH-A1",
  "warehouseName": "Kho A1",
  "address": "Số 10 Đường Kho A",
  "district": "Thủ Đức",
  "operatingHours": "07:00 - 22:00",
  "length": 50.0,
  "width": 30.0,
  "height": 8.0
}
```

Backend tự tính `total_area = length * width`, `usable_area` mặc định = 85% total (có thể override).

### `PATCH /warehouses/:id`

### `DELETE /warehouses/:id`

⚠️ Cascade xoá zones → racks → levels → slots. Cẩn thận nếu có contract_item đang tham chiếu.

---

## Zones

### `GET /zones`

**Query**:

- `warehouseId` — filter.
- `limit`, `offset`.

### `POST /zones`

🔒 Admin / warehouse_staff.

**Body**:

```json
{
  "warehouseId": "WH0001",
  "zoneCode": "A",
  "zoneName": "Hàng khô",
  "description": "Khu vực chứa hàng không cần làm lạnh"
}
```

**Ràng buộc**: `(warehouseId, zoneCode)` UNIQUE. Zone code có thể trùng ở các warehouse khác nhau.

**Lỗi**:

- `400` — warehouse không tồn tại.
- `409` — zone_code đã tồn tại trong warehouse này.

### `GET /zones/:id` / `PATCH /zones/:id` / `DELETE /zones/:id`

CRUD chuẩn. DELETE cascade xuống racks.

---

## Racks / Levels / Slots

Cấu trúc URL song song với Zones:

- `/racks` — CRUD rack trong zone.
- `/levels` — CRUD level trong rack.
- `/slots` — CRUD slot trong level.

Mỗi endpoint có query filter theo parent ID (`zoneId`, `rackId`, `levelId`).

### Slot status transitions

| Từ | Sang | Lý do |
|---|---|---|
| `AVAILABLE` | `RESERVED` | contract SIGNED nhưng chưa ACTIVE |
| `RESERVED` | `OCCUPIED` | contract ACTIVE + hàng đã nhập |
| `OCCUPIED` | `AVAILABLE` | contract COMPLETED + hàng xuất hết |
| bất kỳ | `MAINTENANCE` | admin mark bảo trì |

---

## Rental Requests

### `POST /rental-requests`

🔒 Tenant admin (có `tenantId`).

**Body**:

```json
{
  "userId": "USR0012",
  "warehouseId": "WH0001",
  "rentalType": "RACK",
  "startDate": "2026-05-01",
  "endDate": "2026-11-01",
  "quantity": 2,
  "customerType": "business",
  "note": "Cần 2 rack ở zone A"
}
```

**Backend tự resolve `tenantId`** từ `userId` — FE không phải gửi.

**Rental type**:

- `RACK` — thuê nguyên rack (quantity = số rack).
- `LEVEL` — thuê nguyên level (quantity = số level).

### `GET /rental-requests`

**Query**:

- `userId` — filter theo chủ request.
- `status` — `PENDING` | `APPROVED` | `REJECTED`.
- `warehouseId`.
- `limit`, `offset`.

Tenant admin tự động filter theo `tenant_id` từ JWT; admin / staff không bị filter.

### `POST /rental-requests/:id/approve`

🔒 Admin / warehouse_staff.

**Body** (optional): `{ "note": "OK, assign zone A" }`.

**Response**: request + contract mới vừa tạo (DRAFT).

### `POST /rental-requests/:id/reject`

🔒 Admin / warehouse_staff.

**Body**: `{ "reason": "Không còn rack zone A" }` (bắt buộc).

---

## Contracts & Contract Items

### `GET /contracts`

**Query**: `status`, `tenantId` (admin only), `warehouseId`.

### `POST /contracts/:id/send`

Chuyển DRAFT → SENT. Gửi email notify tenant.

### `POST /contracts/:id/sign`

🔒 Tenant admin (chỉ contract của tenant mình).

**Body**: `{ "fileUrl": "https://s3.../signature.pdf" }`.

### `POST /contracts/:id/activate`

🔒 Admin / warehouse_staff.

Chuyển SIGNED → ACTIVE. Insert các `contract_items`, đổi slot status sang `RESERVED` hoặc `OCCUPIED`.

### `POST /contracts/:id/complete`

🔒 Admin / warehouse_staff.

### `POST /contracts/:id/cancel`

🔒 Admin / warehouse_staff hoặc tenant admin (owner).

### `POST /contract-items`

**Body**:

```json
{
  "contractId": "CT0001",
  "slotId": "SL0010",
  "unitPrice": 500000,
  "billingCycle": "MONTHLY"
}
```

---

## Shipment Requests

### `POST /shipment-requests`

🔒 Tenant admin.

**Body**:

```json
{
  "userId": "USR0012",
  "contractId": "CT0001",
  "shipmentType": "IMPORT",
  "fromAddress": "Kho Nhà cung cấp, Q.12, HCM",
  "toAddress": "Kho A1 Smart Warehouse",
  "scheduledDate": "2026-05-05",
  "itemDescription": "100 thùng giấy in A4",
  "quantity": 100
}
```

### `POST /shipment-requests/:id/approve` / `/reject`

🔒 Admin / transport_staff.

---

## Transport Contracts

Tương tự Contracts, nhưng cho vận chuyển.

### State machine

`DRAFT → SENT → SIGNED → ACTIVE → COMPLETED/CANCELLED`

### Endpoint giống Contracts.

---

## Shipments

### `GET /shipments`

**Query**: `status`, `contractId`, `shipmentRequestId`.

### `PATCH /shipments/:id/status`

🔒 Admin / transport_staff.

**Body**: `{ "status": "IN_TRANSIT", "note": "..." }`.

State transitions xem mục "Vòng đời trạng thái" trong README.

---

## Import/Export Records

### `POST /import-export-records`

🔒 Admin / warehouse_staff.

**Body**:

```json
{
  "contractId": "CT0001",
  "shipmentId": "SH0001",
  "recordType": "IMPORT",
  "quantity": 100,
  "itemDescription": "100 thùng giấy",
  "note": "Nhập đủ"
}
```

⚠️ **Không có DELETE / PATCH** — audit trail append-only. Nếu sai thì tạo record đối ứng.

### `GET /import-export-records`

**Query**: `contractId`, `recordType`, từ/đến date.

---

## Invoices & Payments

### `POST /invoices`

🔒 Admin / warehouse_staff.

### `GET /invoices`

**Query**: `tenantId`, `status`, `invoiceType`.

### `POST /payments`

🔒 Admin / warehouse_staff hoặc tenant admin (tự nộp).

**Body**:

```json
{
  "contractId": "CT0001",
  "invoiceId": "INV0001",
  "paymentCode": "PAY-20260510-001",
  "paymentDate": "2026-05-10",
  "amount": 1500000,
  "paymentMethod": "BANK_TRANSFER",
  "note": "Chuyển khoản Vietcombank"
}
```

---

## Notifications

### `GET /notifications`

🔒 Bất kỳ user đăng nhập — chỉ thấy notification của chính mình.

### `PATCH /notifications/:id/read`

Đánh dấu đã đọc.

### `POST /notifications/mark-all-read`

Đánh dấu tất cả đã đọc.

---

## Mã lỗi chuẩn

Backend trả về response body lỗi thống nhất:

```json
{
  "message": "Mô tả lỗi tiếng Việt"
}
```

Hoặc với lỗi validate nhiều field:

```json
{
  "message": "Validation failed",
  "errors": [
    { "field": "email", "reason": "Invalid format" },
    { "field": "password", "reason": "Too short" }
  ]
}
```

### HTTP Status reference

| Code | Khi nào dùng |
|---|---|
| `200` | OK — GET / PATCH / action thành công |
| `201` | Created — POST thành công |
| `204` | No Content — DELETE thành công không có body |
| `400` | Bad Request — body sai format, thiếu field, vi phạm business rule |
| `401` | Unauthorized — không có token hoặc token hỏng |
| `403` | Forbidden — role không đủ quyền |
| `404` | Not Found — resource không tồn tại |
| `409` | Conflict — unique constraint hoặc state transition sai |
| `415` | Unsupported Media Type — gửi content-type khác json |
| `422` | Unprocessable Entity — dự phòng, chưa dùng |
| `429` | Too Many Requests — rate limit (roadmap) |
| `500` | Internal Server Error — bug backend, cần log |

---

## Đổi log

| Phiên bản | Ngày | Thay đổi |
|---|---|---|
| v0.1 | 2026-01-15 | Khởi tạo API doc đầu tiên: Auth, Users, Warehouse. |
| v0.2 | 2026-02-10 | Thêm Rental Requests, Contracts, Contract Items. |
| v0.3 | 2026-03-05 | Thêm Shipment, Transport, Import/Export Records. |
| v0.4 | 2026-04-01 | Thêm Invoices, Payments. |
| v0.5 | 2026-04-15 | Refactor Rental Request: dùng `userId` thay `tenantId` trong body; auto-resolve tenant. |
| v0.6 | 2026-04-22 | Refactor Users: hash password server-side, role whitelist, tách endpoint restore. |
