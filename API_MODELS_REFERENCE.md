# NextGen Warehouse BE - API Models Reference

Base URL (local): `http://localhost:3001`  
Swagger UI: `http://localhost:3001/api-docs`

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
- **Request body**
  - `email: string` (required, dùng để nhận OTP xác thực)
  - `phone: string` (optional)
  - `password: string` (required)
  - `fullName: string` (required)
  - `role: string` (optional, default `tenant_admin`; giá trị `tenant` được map sang `tenant_admin`)
- **Response `201`**
  - `user: UserResponse`
  - `otp: string`

### `POST /api/auth/login`
- **Request body**
  - `email: string` (optional, nhưng cần `email` hoặc `phone`)
  - `phone: string` (optional, nhưng cần `email` hoặc `phone`)
  - `password: string` (required)
- **Response `200`**
  - `user: UserResponse`
  - `accessToken: string`

### `POST /api/auth/verify-register-otp`
- **Request body**
  - `otp: string` (required)
  - Một trong các định danh (required, chọn một): `userId`, `email`, hoặc `phone` — server map sang `user_id` rồi kiểm tra OTP trong `user_otps`
- **Response `200`**
  - `message: string`
  - `user: UserResponse`
  - `accessToken: string`

### `POST /api/auth/resend-register-otp`
- **Request body** (cần một trong: `userId`, `email`, hoặc `phone`)
  - `email: string` (optional)
  - `phone: string` (optional)
  - `userId: string` (optional)
- **Điều kiện:** user tồn tại, **chưa kích hoạt** (`status` không phải `active` / `is_active` không phải `true`), không `suspended`, có **email** để gửi OTP.
- **Hành vi:** đánh dấu hết hiệu lực mọi OTP `register` cũ (`used = true`), tạo OTP mới (hết hạn sau 10 phút), gửi email xác thực. **Cooldown 60 giây** giữa các lần gọi (HTTP `429` nếu quá sớm).
- **Response `200`**
  - `message: string`
  - `otp: string` (dev / test; production nên ẩn bớt nếu cần)

### `POST /api/auth/forgot-password`
- **Request body**
  - `email: string` (optional, nhưng cần `email` hoặc `phone`)
  - `phone: string` (optional, nhưng cần `email` hoặc `phone`)
- **Response `200`**
  - `message: string`
  - `otp: string` (dev mode)

### `POST /api/auth/reset-password`
- **Request body**
  - `userId: string` (required)
  - `otp: string` (required)
  - `newPassword: string` (required)
- **Response `200`**
  - `message: string`
  - `user: UserResponse`

## 2) Users (Model: `User`)

### `POST /api/users`
- **Request body**
  - `userId: string` (required)
  - `email: string` (required)
  - `passwordHash: string` (required)
  - `fullName: string` (required)
  - `phone: string | null` (optional)
  - `role: string` (optional, default `tenant_admin`; giá trị `tenant` được map sang `tenant_admin`)
  - `status: string` (optional, default `active`)
- **Response `201`**
  - `UserResponse`

### `GET /api/users`
- **Query**
  - `status: string` (optional)
  - `limit: integer` (optional, default `50`)
  - `offset: integer` (optional, default `0`)
- **Response `200`**
  - `array<UserResponse>`

### `GET /api/users/{id}`
- **Path**
  - `id: string`
- **Response `200`**
  - `UserResponse`

### `PATCH /api/users/{id}`
- **Path**
  - `id: string`
- **Request body** (ít nhất 1 field)
  - `email?: string`
  - `fullName?: string`
  - `phone?: string`
  - `role?: string`
  - `status?: string`
  - `passwordHash?: string`
- **Response `200`**
  - `UserResponse`

## 3) Tenants (Model: `Tenant`)

### `POST /api/tenants`
- **Request body**
  - `tenantId: string` (required)
  - `companyName: string` (required)
  - `taxCode: string` (required)
  - `contactEmail: string` (required)
  - `contactPhone: string` (optional)
  - `address: string` (optional)
- **Response `201`**
  - `TenantResponse`

### `GET /api/tenants`
- **Query**
  - `page: integer` (optional, default `1`)
  - `limit: integer` (optional, default `10`)
  - `search: string` (optional)
- **Response `200`**
  - `tenants: array<TenantResponse>`
  - `pagination: PaginationResponse`

### `GET /api/tenants/{id}`
- **Path**
  - `id: string`
- **Response `200`**
  - `TenantResponse`

### `PATCH /api/tenants/{id}`
- **Path**
  - `id: string`
- **Request body** (dynamic fields)
  - Ví dụ: `companyName?: string`, `taxCode?: string`, `contactEmail?: string`, `contactPhone?: string`, `address?: string`, `isActive?: boolean`
- **Response `200`**
  - `TenantResponse`

### `GET /api/tenants/{id}/branches`
- **Path**
  - `id: string`
- **Response `200`**
  - `branches: array<object>` (raw branch row từ DB)

### `DELETE /api/tenants/{id}`
- **Path**
  - `id: string`
- **Response `200`**
  - `message: string`

## 4) Warehouses (Model: `Warehouse`)

### `GET /api/warehouses`
- **Query**
  - `page: integer` (optional, default `1`)
  - `limit: integer` (optional, default `10`)
  - `city: string` (optional)
  - `warehouseType: string` (optional)
  - `search: string` (optional)
- **Response `200`**
  - `warehouses: array<WarehouseResponse>`
  - `pagination: PaginationResponse`

### `GET /api/warehouses/{id}`
- **Path**
  - `id: string`
- **Response `200`**
  - `WarehouseResponse`

### `GET /api/warehouses/{id}/zones`
- **Path**
  - `id: string`
- **Response `200`**
  - `zones: array<object>` (raw joined rows)

## 5) Zones (Model: `Zone`)

### `GET /api/zones`
- **Query**
  - `available: boolean` (optional)
  - `warehouseId: string` (optional)
  - `page: integer` (optional, default `1`)
  - `limit: integer` (optional, default `20`)
- **Response `200`**
  - `zones: array<ZoneResponse>`
  - `pagination: PaginationResponse`

### `POST /api/zones`
- **Request body**
  - `zoneId: string` (required)
  - `warehouseId: string` (required)
  - `zoneCode: string` (required)
  - `zoneName: string | null` (optional)
  - `zoneType: string | null` (optional)
  - `length: number` (required)
  - `width: number` (required)
- **Response `201`**
  - `ZoneResponse`

### `GET /api/zones/{id}`
- **Path**
  - `id: string`
- **Response `200`**
  - `ZoneResponse`

### `PATCH /api/zones/{id}`
- **Path**
  - `id: string`
- **Request body** (ít nhất 1 field hợp lệ)
  - `warehouseId?: string`
  - `zoneCode?: string`
  - `zoneName?: string`
  - `zoneType?: string`
  - `length?: number`
  - `width?: number`
  - `isRented?: boolean`
- **Response `200`**
  - `ZoneResponse`

### `DELETE /api/zones/{id}`
- **Path**
  - `id: string`
- **Response `200`**
  - `message: string`

## 6) Rental Requests (Model: `RentalRequest`, `RentalRequestZone`)

### `POST /api/rental-requests`
- **Request body**
  - `requestId: string` (required)
  - `tenantId: string` (required)
  - `warehouseId: string` (required)
  - `requestedStartDate: datetime` (required)
  - `durationDays: integer` (required, min `15`)
  - `notes: string` (optional)
  - `selectedZones: array<string>` (optional)
- **Response `201`**
  - `RentalRequestResponse & { selectedZones: array<string> }`

### `GET /api/rental-requests`
- **Query**
  - `page: integer` (optional, default `1`)
  - `limit: integer` (optional, default `10`)
  - `status: string` (optional)
  - `tenantId: string` (optional)
- **Response `200`**
  - `requests: array<RentalRequestResponse>`
  - `pagination: PaginationResponse`

### `GET /api/rental-requests/{id}`
- **Path**
  - `id: string`
- **Response `200`**
  - `RentalRequestResponse & { selectedZones: array<object> }`

### `PATCH /api/rental-requests/{id}`
- **Path**
  - `id: string`
- **Request body** (dynamic, trừ `selectedZones`)
  - Ví dụ: `requestedStartDate?: datetime`, `durationDays?: integer`, `notes?: string`, `warehouseId?: string`
- **Response `200`**
  - `RentalRequestResponse`

### `POST /api/rental-requests/{id}/approve`
- **Path**
  - `id: string`
- **Request body**
  - `approvedBy: string` (required)
- **Response `200`**
  - `RentalRequestResponse` (`status = APPROVED`)

### `POST /api/rental-requests/{id}/reject`
- **Path**
  - `id: string`
- **Request body**
  - `approvedBy: string` (optional theo code hiện tại)
  - `rejectedReason: string` (optional theo code hiện tại)
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
