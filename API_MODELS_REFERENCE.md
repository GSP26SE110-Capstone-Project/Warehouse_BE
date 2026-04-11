# NextGen Warehouse BE - API Models Reference

Base URL (local): `http://localhost:3000` (hoặc cổng `API_HOST_PORT` trong Docker)  
Swagger UI: cùng host + `/api-docs`

## Quy ước kiểu dữ liệu

- `string`: chuỗi
- `number`: số
- `integer`: số nguyên
- `boolean`: true/false
- `datetime`: ISO date string
- `array<T>`: mảng kiểu `T`
- `object`: object JSON

## 1) Auth (User Authentication)

### `POST /api/auth/register`
- **Request body** — `email`, `password`, `fullName` bắt buộc; `phone`, `role` tùy chọn (`tenant` → `tenant_admin`)

```json
{
  "email": "user@example.com",
  "phone": "0901234567",
  "password": "your-secure-password",
  "fullName": "Nguyen Van A",
  "role": "tenant_admin"
}
```

- **Response `201`**
  - `user: UserResponse`
  - `otp: string`

### `POST /api/auth/login`
- **Request body** — một trong `email` | `phone`, kèm `password`

```json
{
  "email": "user@example.com",
  hoặc "phone": "..",
  "password": "your-secure-password"
}
```

- **Response `200`**
  - `user: UserResponse`
  - `accessToken: string`

### `POST /api/auth/verify-register-otp`
- **Request body** — `otp` bắt buộc; một trong `userId` | `email` | `phone`

```json
{
  "email": "user@example.com",
  "otp": "123456"
}
```

- **Response `200`**
  - `message: string`
  - `user: UserResponse`
  - `accessToken: string`

### `POST /api/auth/resend-register-otp`
- **Request body** — một trong `email` | `phone` | `userId`

```json
{
  "email": "user@example.com"
}
```

- **Điều kiện:** user tồn tại, **chưa kích hoạt** (`status` không phải `active` / `is_active` không phải `true`), không `suspended`, có **email** để gửi OTP.
- **Hành vi:** đánh dấu hết hiệu lực mọi OTP `register` cũ (`used = true`), tạo OTP mới (hết hạn sau 10 phút), gửi email xác thực. **Cooldown 60 giây** giữa các lần gọi (HTTP `429` nếu quá sớm).
- **Response `200`**
  - `message: string`
  - `otp: string` (dev / test; production nên ẩn bớt nếu cần)

### `POST /api/auth/forgot-password`
- **Request body** — một trong `email` | `phone`

```json
{
  "email": "user@example.com"
}
```

- **Response `200`**
  - `message: string`
  - `otp: string` (dev mode)

### `POST /api/auth/reset-password`
- **Request body** — `userId`, `otp`, `newPassword`

```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "otp": "123456",
  "newPassword": "new-secure-password"
}
```

- **Response `200`**
  - `message: string`
  - `user: UserResponse`

## 2) Users (Model: `User`)

### `POST /api/users`
- **Request body** — `userId`, `email`, `passwordHash`, `fullName` bắt buộc; `phone`, `role`, `status` tùy chọn

```json
{
  "userId": "user-001",
  "email": "user@example.com",
  "passwordHash": "$2b$10$...",
  "fullName": "Nguyen Van A",
  "phone": null,
  "role": "tenant_admin",
  "status": "active"
}
```

- **Response `201`**
  - `UserResponse`

### `GET /api/users`
- **Query** — optional: `status`, `limit` (default 50), `offset` (default 0); ví dụ `?status=active&limit=20&offset=0`
- **Response `200`**
  - `array<UserResponse>`

### `GET /api/users/{id}`
- **Path** — `id` (user id)
- **Response `200`**
  - `UserResponse`

### `PATCH /api/users/{id}`
- **Path** — `id`
- **Request body** — ít nhất một field

```json
{
  "fullName": "Ten cap nhat",
  "phone": "0909999999"
}
```

- **Response `200`**
  - `UserResponse`

## 3) Tenants (Model: `Tenant`)

### `POST /api/tenants`
- **Request body** — `tenantId`, `companyName`, `taxCode`, `contactEmail` bắt buộc; `contactPhone`, `address` tùy chọn

```json
{
  "tenantId": "tenant-001",
  "companyName": "Cong ty ABC",
  "taxCode": "0123456789",
  "contactEmail": "contact@abc.com",
  "contactPhone": "0281234567",
  "address": "123 Duong XYZ"
}
```

- **Response `201`**
  - `TenantResponse`

### `GET /api/tenants`
- **Query** — optional: `page` (default 1), `limit` (default 10), `search`; ví dụ `?page=1&limit=10&search=abc`
- **Response `200`**
  - `tenants: array<TenantResponse>`
  - `pagination: PaginationResponse`

### `GET /api/tenants/{id}`
- **Path** — `id` (tenant id)
- **Response `200`**
  - `TenantResponse`

### `PATCH /api/tenants/{id}`
- **Path** — `id`
- **Request body** — các field cần cập nhật (vd. `companyName`, `taxCode`, `contactEmail`, `contactPhone`, `address`, `isActive`)

```json
{
  "companyName": "Ten cong ty moi",
  "isActive": true
}
```

- **Response `200`**
  - `TenantResponse`

### `GET /api/tenants/{id}/branches`
- **Path** — `id`
- **Response `200`**
  - `branches: array<object>` (raw branch row từ DB)

### `DELETE /api/tenants/{id}`
- **Path** — `id`
- **Response `200`**
  - `message: string`

## 4) Warehouses (Model: `Warehouse`)

### `GET /api/warehouses`
- **Query** — optional: `page`, `limit`, `city`, `warehouseType`, `search`; ví dụ `?page=1&limit=10&city=HCM`
- **Response `200`**
  - `warehouses: array<WarehouseResponse>`
  - `pagination: PaginationResponse`

### `GET /api/warehouses/{id}`
- **Path** — `id`
- **Response `200`**
  - `WarehouseResponse`

### `GET /api/warehouses/{id}/zones`
- **Path** — `id`
- **Response `200`**
  - `zones: array<object>` (raw joined rows)

## 5) Zones (Model: `Zone`)

### `GET /api/zones`
- **Query** — optional: `available`, `warehouseId`, `page` (default 1), `limit` (default 20); ví dụ `?warehouseId=wh-001&page=1`
- **Response `200`**
  - `zones: array<ZoneResponse>`
  - `pagination: PaginationResponse`

### `POST /api/zones`
- **Request body** — `zoneId`, `warehouseId`, `zoneCode`, `length`, `width` bắt buộc; `zoneName`, `zoneType` tùy chọn

```json
{
  "zoneId": "zone-001",
  "warehouseId": "wh-001",
  "zoneCode": "A1",
  "zoneName": "Khu A",
  "zoneType": "normal_storage",
  "length": 50,
  "width": 30
}
```

- **Response `201`**
  - `ZoneResponse`

### `GET /api/zones/{id}`
- **Path** — `id`
- **Response `200`**
  - `ZoneResponse`

### `PATCH /api/zones/{id}`
- **Path** — `id`
- **Request body** — ít nhất một field hợp lệ

```json
{
  "zoneName": "Khu A (cap nhat)",
  "isRented": false
}
```

- **Response `200`**
  - `ZoneResponse`

### `DELETE /api/zones/{id}`
- **Path** — `id`
- **Response `200`**
  - `message: string`

## 6) Rental Requests (Model: `RentalRequest`, `RentalRequestZone`)

### `POST /api/rental-requests`
- **Request body** — `requestId`, `tenantId`, `warehouseId`, `requestedStartDate`, `durationDays` (≥ 15) bắt buộc; `notes`, `selectedZones` tùy chọn

```json
{
  "requestId": "rr-001",
  "tenantId": "tenant-001",
  "warehouseId": "wh-001",
  "requestedStartDate": "2026-05-01T00:00:00.000Z",
  "durationDays": 30,
  "notes": "Can bo sung zone",
  "selectedZones": ["zone-id-1", "zone-id-2"]
}
```

- **Response `201`**
  - `RentalRequestResponse & { selectedZones: array<string> }`

### `GET /api/rental-requests`
- **Query** — optional: `page`, `limit`, `status`, `tenantId`; ví dụ `?page=1&limit=10&status=PENDING`
- **Response `200`**
  - `requests: array<RentalRequestResponse>`
  - `pagination: PaginationResponse`

### `GET /api/rental-requests/{id}`
- **Path** — `id`
- **Response `200`**
  - `RentalRequestResponse & { selectedZones: array<object> }`

### `PATCH /api/rental-requests/{id}`
- **Path** — `id`
- **Request body** — field động (không `selectedZones` trong PATCH); ví dụ `notes`, `durationDays`, `warehouseId`, `requestedStartDate`

```json
{
  "notes": "Cap nhat ghi chu",
  "durationDays": 45
}
```

- **Response `200`**
  - `RentalRequestResponse`

### `POST /api/rental-requests/{id}/approve`
- **Path** — `id`
- **Request body** — `approvedBy`

```json
{
  "approvedBy": "user-id-admin"
}
```

- **Response `200`**
  - `RentalRequestResponse` (`status = APPROVED`)

### `POST /api/rental-requests/{id}/reject`
- **Path** — `id`
- **Request body** — `approvedBy`, `rejectedReason` (tùy theo rule BE hiện tại)

```json
{
  "approvedBy": "user-id-admin",
  "rejectedReason": "Het cho trong ky nay"
}
```

- **Response `200`**
  - `RentalRequestResponse` (`status = REJECTED`)

## Shared Response Types

### `UserResponse`
```json
{
  "userId": "string",
  "email": "string | null",
  "fullName": "string",
  "phone": "string | null",
  "role": "string",
  "status": "string",
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

### `TenantResponse`
```json
{
  "tenantId": "string",
  "companyName": "string",
  "taxCode": "string",
  "contactEmail": "string",
  "contactPhone": "string | null",
  "address": "string | null",
  "isActive": "boolean",
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

### `WarehouseResponse`
```json
{
  "warehouseId": "string",
  "branchId": "string | null",
  "managerId": "string | null",
  "warehouseCode": "string",
  "warehouseName": "string",
  "warehouseType": "string | null",
  "warehouseSize": "number | null",
  "address": "string | null",
  "city": "string | null",
  "district": "string | null",
  "operatingHours": "string | null",
  "length": "number | null",
  "width": "number | null",
  "height": "number | null",
  "totalArea": "number | null",
  "totalCapacity": "number | null",
  "isActive": "boolean",
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

### `ZoneResponse`
```json
{
  "zoneId": "string",
  "warehouseId": "string",
  "zoneCode": "string",
  "zoneName": "string | null",
  "zoneType": "string | null",
  "length": "number",
  "width": "number",
  "totalArea": "number",
  "isRented": "boolean",
  "warehouseName": "string | null",
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

### `RentalRequestResponse`
```json
{
  "requestId": "string",
  "tenantId": "string",
  "status": "PENDING | APPROVED | REJECTED | string",
  "requestedStartDate": "datetime",
  "durationDays": "integer",
  "notes": "string | null",
  "approvedBy": "string | null",
  "rejectedReason": "string | null",
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

### `PaginationResponse`
```json
{
  "page": "integer",
  "limit": "integer",
  "total": "integer",
  "totalPages": "integer"
}
```

## Models hiện chưa có API route/controller riêng

Hiện trong `src/models` có một số model chưa được expose endpoint trực tiếp (chưa thấy route/controller tương ứng), gồm:

- `Promotion`
- `Level`
- `ContractItem`
- `Invoice`
- `Contract`
- `PricingRule`
- `Branch`
- `Payment`
- `QrTag`
- `Notification`
- `AuditLog`
- `Shipment`
- `Rack`
- `TransportStation`
- `Slot`
- `TransportationProvider`

Nếu bạn muốn, mình có thể tạo tiếp tài liệu phase 2: đề xuất CRUD endpoint chuẩn REST cho nhóm model này luôn.
