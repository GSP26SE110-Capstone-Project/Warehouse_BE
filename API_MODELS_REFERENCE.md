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
- **Request body** — `email`, `phone`, `password`, `fullName` bắt buộc; `role` tùy chọn (`tenant` → `tenant_admin`). OTP gửi qua **email**. **Validate:** email dạng `a@b.cc`; phone **10 chữ số VN** (`0` + 9 số, vd `0901234567`) hoặc `+84`/`84` đầu số (chuẩn hóa trước khi lưu).

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
  "password": "your-secure-password"
}
```

(Hoặc dùng `phone` thay cho `email`, cùng `password`.)

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

### `DELETE /api/users/{id}`
- **Auth** — `Bearer token`, role: `admin`
- **Path** — `id`
- **Hành vi** — deactivate account (`status = inactive`), không xóa cứng bản ghi user
- **Response `200`**
  - `message: string`
  - `user: UserResponse`

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

### `POST /api/warehouses`
- **Auth** — `Bearer token`, role: `admin` hoặc `warehouse_manager`
- **Request body** — `warehouseId`, `branchId`, `warehouseCode`, `warehouseName`, `warehouseType`, `address`, `length`, `width`, `height` bắt buộc; các field còn lại tùy chọn

```json
{
  "warehouseId": "wh-001",
  "branchId": "branch-001",
  "managerId": "user-warehouse-manager-001",
  "warehouseCode": "WH-HCM-01",
  "warehouseName": "Kho Thu Duc",
  "warehouseType": "normal_storage",
  "warehouseSize": "large",
  "address": "123 Xa Lo Ha Noi",
  "city": "HCM",
  "district": "Thu Duc",
  "operatingHours": "08:00-17:30",
  "length": 120,
  "width": 80,
  "height": 12,
  "totalCapacity": 5000
}
```

- **Response `201`**
  - `WarehouseResponse`

### `GET /api/warehouses`
- **Query** — optional: `page` (default 1), `limit` (default 10), `city`, `warehouseType`, `search`; ví dụ `?page=1&limit=10&city=HCM&warehouseType=normal_storage`
- **Response `200`**
  - `warehouses: array<WarehouseResponse>`
  - `pagination: PaginationResponse`

### `GET /api/warehouses/{id}`
- **Path** — `id`
- **Response `200`**
  - `WarehouseResponse`

### `PATCH /api/warehouses/{id}`
- **Auth** — `Bearer token`, role: `admin` hoặc `warehouse_manager`
- **Path** — `id`
- **Request body** — ít nhất 1 field hợp lệ; không cho cập nhật `warehouseId`, `createdAt`, `updatedAt`

```json
{
  "warehouseName": "Kho Thu Duc (cap nhat)",
  "managerId": "user-warehouse-manager-002",
  "length": 140,
  "width": 85,
  "isActive": true
}
```

- **Response `200`**
  - `WarehouseResponse`

### `DELETE /api/warehouses/{id}`
- **Auth** — `Bearer token`, role: `admin` hoặc `warehouse_manager`
- **Path** — `id`
- **Hành vi** — soft delete (`is_active = false`)
- **Response `200`**
  - `message: string`

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

## 6) Contracts (Model: `Contract`)

### `POST /api/contracts`
- **Auth** — `Bearer token`, role: `admin` hoặc `warehouse_manager`
- **Request body** — `contractId`, `tenantId`, `contractCode`, `startDate`, `endDate`, `totalRentalFee` bắt buộc; các field còn lại tùy chọn

```json
{
  "contractId": "contract-001",
  "requestId": "rr-001",
  "tenantId": "tenant-001",
  "approvedBy": "user-admin-001",
  "contractCode": "CTR-2026-0001",
  "startDate": "2026-05-01",
  "endDate": "2026-08-01",
  "billingCycle": "MONTH",
  "rentalDurationDays": 92,
  "totalRentalFee": 120000000,
  "status": "ACTIVE"
}
```

- **Response `201`**
  - `ContractResponse`

### `GET /api/contracts`
- **Auth** — `Bearer token`, role: `admin` hoặc `warehouse_manager` hoặc `tenant_admin`
- **Query** — optional: `page` (default 1), `limit` (default 10), `tenantId`, `status`, `search`; ví dụ `?page=1&limit=10&status=ACTIVE`
- **Response `200`**
  - `contracts: array<ContractResponse>`
  - `pagination: PaginationResponse`

### `GET /api/contracts/{id}`
- **Auth** — `Bearer token`, role: `admin` hoặc `warehouse_manager` hoặc `tenant_admin`
- **Path** — `id`
- **Response `200`**
  - `ContractResponse`

### `PATCH /api/contracts/{id}`
- **Auth** — `Bearer token`, role: `admin` hoặc `warehouse_manager`
- **Path** — `id`
- **Request body** — ít nhất 1 field hợp lệ; không cho cập nhật `contractId`, `createdAt`, `updatedAt`

```json
{
  "billingCycle": "QUARTER",
  "totalRentalFee": 125000000,
  "status": "ACTIVE"
}
```

- **Response `200`**
  - `ContractResponse`

### `DELETE /api/contracts/{id}`
- **Auth** — `Bearer token`, role: `admin` hoặc `warehouse_manager`
- **Path** — `id`
- **Hành vi** — soft delete/hủy hợp đồng (`status = CANCELLED`)
- **Response `200`**
  - `message: string`
  - `contract: ContractResponse`

## 7) Contract Items (Model: `ContractItem`)

### `POST /api/contract-items`
- **Auth** — `Bearer token`, role: `admin` hoặc `warehouse_manager`
- **Request body** — `itemId`, `contractId`, `rentType`, `unitPrice` bắt buộc
- **Rule theo `rentType`**
  - `ENTIRE_WAREHOUSE` -> bắt buộc `warehouseId`
  - `ZONE` -> bắt buộc `zoneId`
  - `SLOT` -> bắt buộc `slotId`

```json
{
  "itemId": "ci-001",
  "contractId": "contract-001",
  "rentType": "ZONE",
  "zoneId": "zone-001",
  "unitPrice": 30000000
}
```

- **Response `201`**
  - `ContractItemResponse`

### `GET /api/contract-items`
- **Auth** — `Bearer token`, role: `admin` hoặc `warehouse_manager` hoặc `tenant_admin`
- **Query** — optional: `contractId`, `rentType`, `page` (default 1), `limit` (default 20)
- **Response `200`**
  - `items: array<ContractItemResponse>`
  - `pagination: PaginationResponse`

### `GET /api/contract-items/{id}`
- **Auth** — `Bearer token`, role: `admin` hoặc `warehouse_manager` hoặc `tenant_admin`
- **Path** — `id`
- **Response `200`**
  - `ContractItemResponse`

### `PATCH /api/contract-items/{id}`
- **Auth** — `Bearer token`, role: `admin` hoặc `warehouse_manager`
- **Path** — `id`
- **Request body** — ít nhất 1 field hợp lệ; không cho cập nhật `itemId`, `createdAt`, `updatedAt`
- **Rule theo `rentType`** vẫn được enforce sau khi merge dữ liệu cũ + mới

```json
{
  "unitPrice": 32000000
}
```

- **Response `200`**
  - `ContractItemResponse`

### `DELETE /api/contract-items/{id}`
- **Auth** — `Bearer token`, role: `admin` hoặc `warehouse_manager`
- **Path** — `id`
- **Response `200`**
  - `message: string`

## 8) Transportation Providers (Model: `TransportationProvider`)

### `POST /api/transportation-providers`
- **Auth** — `Bearer token`, role: `admin` hoặc `warehouse_manager`
- **Request body** — `providerId`, `name` bắt buộc; `providerType`, `contactInfo`, `isActive` tùy chọn

```json
{
  "providerId": "tp-001",
  "name": "Fast Logistics",
  "providerType": "EXTERNAL",
  "contactInfo": "hotline: 1900xxxx",
  "isActive": true
}
```

- **Response `201`**
  - `TransportationProviderResponse`

### `GET /api/transportation-providers`
- **Auth** — `Bearer token`, role: `admin` hoặc `warehouse_manager` hoặc `transport_staff`
- **Query** — optional: `page` (default 1), `limit` (default 10), `providerType`, `isActive`, `search`
- **Response `200`**
  - `providers: array<TransportationProviderResponse>`
  - `pagination: PaginationResponse`

### `GET /api/transportation-providers/{id}`
- **Auth** — `Bearer token`, role: `admin` hoặc `warehouse_manager` hoặc `transport_staff`
- **Path** — `id`
- **Response `200`**
  - `TransportationProviderResponse`

### `PATCH /api/transportation-providers/{id}`
- **Auth** — `Bearer token`, role: `admin` hoặc `warehouse_manager`
- **Path** — `id`
- **Request body** — các field hợp lệ: `name`, `providerType`, `contactInfo`, `isActive`
- **Response `200`**
  - `TransportationProviderResponse`

### `DELETE /api/transportation-providers/{id}`
- **Auth** — `Bearer token`, role: `admin` hoặc `warehouse_manager`
- **Path** — `id`
- **Hành vi** — soft delete (`is_active = false`)
- **Response `200`**
  - `message: string`
  - `provider: TransportationProviderResponse`

## 9) Shipments (Model: `Shipment`)

### `POST /api/shipments`
- **Auth** — `Bearer token`, role: `admin` hoặc `warehouse_manager` hoặc `transport_staff`
- **Request body** — `shipmentId`, `contractId`, `shipmentType`, `fromAddress`, `toAddress` bắt buộc

```json
{
  "shipmentId": "ship-001",
  "contractId": "contract-001",
  "shipmentType": "IMPORT",
  "providerId": "tp-001",
  "driverId": "user-driver-001",
  "supervisorId": "user-wh-manager-001",
  "fromAddress": "Cang Cat Lai, HCM",
  "toAddress": "Kho Thu Duc, HCM",
  "scheduledTime": "2026-06-01T08:00:00.000Z",
  "totalWeight": 1800,
  "totalDistance": 25.5,
  "shippingFee": 3500000,
  "status": "SCHEDULING"
}
```

- **Response `201`**
  - `ShipmentResponse`

### `GET /api/shipments`
- **Auth** — `Bearer token`, role: `admin` hoặc `warehouse_manager` hoặc `transport_staff`
- **Query** — optional: `page` (default 1), `limit` (default 10), `contractId`, `status`, `shipmentType`, `providerId`
- **Response `200`**
  - `shipments: array<ShipmentResponse>`
  - `pagination: PaginationResponse`

### `GET /api/shipments/{id}`
- **Auth** — `Bearer token`, role: `admin` hoặc `warehouse_manager` hoặc `transport_staff`
- **Path** — `id`
- **Response `200`**
  - `ShipmentResponse`

### `PATCH /api/shipments/{id}`
- **Auth** — `Bearer token`, role: `admin` hoặc `warehouse_manager` hoặc `transport_staff`
- **Path** — `id`
- **Request body** — các field hợp lệ của shipment trừ `shipmentId`, `createdAt`, `updatedAt`
- **Response `200`**
  - `ShipmentResponse`

### `DELETE /api/shipments/{id}`
- **Auth** — `Bearer token`, role: `admin` hoặc `warehouse_manager`
- **Path** — `id`
- **Hành vi** — soft delete/hủy shipment (`status = CANCELLED`)
- **Response `200`**
  - `message: string`
  - `shipment: ShipmentResponse`

## 10) Rental Requests (Model: `RentalRequest`, `RentalRequestZone`)

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
  "warehouseSize": "small | medium | large | extra_large | null",
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

### `ContractResponse`
```json
{
  "contractId": "string",
  "requestId": "string | null",
  "tenantId": "string",
  "approvedBy": "string | null",
  "contractCode": "string",
  "startDate": "datetime",
  "endDate": "datetime",
  "billingCycle": "QUARTER | MONTH | YEAR | CUSTOM | null",
  "rentalDurationDays": "integer | null",
  "totalRentalFee": "number",
  "status": "ACTIVE | EXPIRED | CANCELLED",
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

### `ContractItemResponse`
```json
{
  "itemId": "string",
  "contractId": "string",
  "rentType": "ENTIRE_WAREHOUSE | ZONE | SLOT",
  "warehouseId": "string | null",
  "zoneId": "string | null",
  "slotId": "string | null",
  "unitPrice": "number",
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

### `TransportationProviderResponse`
```json
{
  "providerId": "string",
  "name": "string",
  "providerType": "INTERNAL | EXTERNAL | null",
  "contactInfo": "string | null",
  "isActive": "boolean",
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

### `ShipmentResponse`
```json
{
  "shipmentId": "string",
  "contractId": "string",
  "shipmentType": "IMPORT | EXPORT",
  "providerId": "string | null",
  "driverId": "string | null",
  "supervisorId": "string | null",
  "fromAddress": "string",
  "toAddress": "string",
  "scheduledTime": "datetime | null",
  "actualStartTime": "datetime | null",
  "actualEndTime": "datetime | null",
  "totalWeight": "number | null",
  "totalDistance": "number | null",
  "shippingFee": "number | null",
  "status": "SCHEDULING | IN_TRANSIT | DELIVERED | CANCELLED",
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
