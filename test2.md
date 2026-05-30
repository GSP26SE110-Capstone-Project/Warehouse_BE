# Hướng dẫn thực hiện từng Function (Manual Test Guide)

> **Mục đích**: Hướng dẫn từng bước làm / test 66 function trong `docs/all_role_func.md`.
> **Phiên bản**: 1.0 — 2026-05-30.
> **Tham chiếu**: `docs/all_role_func.md`, `docs/request.md`, Swagger `http://localhost:3000/api-docs`.

---

## Chuẩn bị môi trường

### 1. Chạy project

```bash
# Terminal 1 — Backend
cd Warehouse_BE_V2
npm run dev          # http://localhost:3000

# Terminal 2 — Frontend
cd Warehouse_Web_FE
npm run dev          # http://localhost:5173 (hoặc port Vite báo)
```

### 2. Tài khoản test mặc định

| Role | Email | Password |
|------|-------|----------|
| System Admin | `admin@warehouse.local` | `admin12345` |
| Warehouse Admin | `whadmin@warehouse.local` | `WhAdmin@12345` |
| Tenant Admin | `tenant1admin@brand.local` | `Tenant1@12345` |
| Warehouse Staff | Tạo bởi WH Admin (#17) | (tự đặt) |
| Warehouse Transporter | Tạo bởi WH Admin (#18) | (tự đặt) |
| Tenant Staff | Tạo bởi Tenant Admin (#37) | (tự đặt) |

Seed admin lần đầu: `npm run seed:admin` (trong BE).

### 3. Đăng nhập & lấy token

**FE**: Vào `/login` → nhập email/password → hệ thống tự lưu token.

**API / Swagger**:

```http
POST /api/auth/login
Content-Type: application/json

{ "email": "admin@warehouse.local", "password": "admin12345" }
```

Copy `data.accessToken` → Swagger **Authorize** → `Bearer <token>`.

### 4. Ký hiệu trạng thái

| Icon | Ý nghĩa |
|------|---------|
| ✅ | FE + BE đã có, test được ngay |
| ⏳ | BE có / FE một phần — làm qua Swagger hoặc màn hình chưa hoàn thiện |
| ❌ | Chưa implement — ghi chú trong doc |

### 5. Thứ tự test gợi ý (end-to-end)

```
Onboarding (1–21, 30–32, 37–38)
  → SKU (40–41)
  → Inbound (43, 33, 29, 65–66 hoặc 48, 49–51)
  → Inventory (45, 55)
  → Outbound (44, 35, 52–53)
  → Billing (46, 24) — khi API sẵn sàng
```

---

# SYSTEM ADMIN (1–11)

---

### #1 Create Warehouse ✅

| | |
|---|---|
| **Role** | System Admin |
| **Login** | `admin@warehouse.local` |

**Điều kiện**: Không.

**FE**:
1. Đăng nhập System Admin → **Quản lý kho** (`/admin/warehouse`)
2. Chọn nút **TẠO KHO**
3. Nhập **Mã kho**, **Tên kho**, **Địa chỉ**, **Tỉnh/Thành phố**, **Quận/Huyện**
4. Bấm **Tạo kho**

**API**:
```http
POST /api/warehouses
{ "warehouseCode": "WH-HCM-01", "warehouseName": "Kho HCM Trung tâm", "city": "TP.HCM", "district": "Quận 7" }
```

**Kết quả**: Warehouse mới xuất hiện trong list, status `ACTIVE`.

---

### #2 Update Warehouse ✅

| | |
|---|---|
| **Role** | System Admin |
| **Login** | `admin@warehouse.local` |

**Điều kiện**: Warehouse đã tồn tại.

**FE**:
1. `/admin/warehouse` → chọn nút **Chỉnh sửa** (icon edit) trên một kho
2. Sửa: `warehouseName`, `address`, `city`, `district`, `totalAreaM2`, `usableAreaM2`, `status`
3. **Lưu ý**: `warehouseCode` **không sửa được** khi edit (field disabled)
4. Bấm **Cập nhật** → thông báo **"Cập nhật thành công"**

**API**:
```http
PATCH /api/warehouses/{warehouseId}
{
  "warehouseName": "HCM Central Warehouse Updated",
  "address": "District 7, HCMC",
  "city": "Ho Chi Minh City",
  "district": "District 7",
  "totalAreaM2": 5000,
  "usableAreaM2": 4500,
  "status": "ACTIVE"
}
```

**Kết quả**: Thông tin kho cập nhật; `warehouseCode` giữ nguyên.

**Lỗi thường gặp**:

| Lỗi | Nguyên nhân |
|-----|-------------|
| `warehouseName cannot be empty` | Tên kho để trống |
| `AREA_EXCEEDS_TOTAL` | `usableAreaM2` > `totalAreaM2` |
| `ZONE_AREA_EXCEEDS_USABLE` | Giảm `usableAreaM2` nhỏ hơn tổng diện tích zone đã tạo |
| `Warehouse not found` | Sai `warehouseId` |
| `No valid fields to update` | Body PATCH rỗng |

---

### #2b Delete Warehouse ✅

| | |
|---|---|
| **Role** | System Admin only |
| **Login** | `admin@warehouse.local` |

**Điều kiện**: Chỉ System Admin thấy nút **Xóa** (icon thùng rác).

**FE**:
1. `/admin/warehouse` → chọn nút **Xóa** trên kho cần xóa
2. Xác nhận hộp thoại **"Bạn có chắc muốn xóa kho ...?"**
3. Success: **"Xóa thành công"**

**API**:
```http
DELETE /api/warehouses/{warehouseId}
```

**Kết quả**: Warehouse biến mất khỏi list.

**Lỗi thường gặp**:

| Lỗi | Nguyên nhân |
|-----|-------------|
| `SYSTEM_ADMIN only` | WH Admin / role khác gọi DELETE |
| `Warehouse not found` | ID không tồn tại |
| `FK_VIOLATION` | Kho còn zone, contract, user, inbound… tham chiếu — xóa child trước hoặc dùng kho test trống |

**WH Admin**: Không có nút xóa; chỉ sửa kho được gán (`PATCH`).

---

### #3 Create Warehouse Admin Account ✅

| | |
|---|---|
| **Role** | System Admin |

**FE**: `/admin/accounts` → **Thêm tài khoản** → Role = `WH_ADMIN` → chọn `warehouseId` → Bấm **Lưu thay đổi**

**API**:
```http
POST /api/users
{
  "fullName": "Kho trưởng HCM",
  "email": "whadmin2@warehouse.local",
  "password": "WhAdmin@12345",
  "role": "WH_ADMIN",
  "warehouseId": "<uuid-warehouse>"
}
```

**Kết quả**: User `WH_ADMIN` login được, gắn đúng warehouse.

---

### #4 Create Tenant Admin Account ✅

| | |
|---|---|
| **Role** | System Admin |

**FE**: `/admin/accounts` → Role = `TENANT_ADMIN` → chọn `tenantId` → Bấm **Lưu thay đổi**

**API**:
```http
POST /api/users
{
  "fullName": "Tenant Admin A",
  "email": "tenantadmin@brand.local",
  "password": "Tenant1@12345",
  "role": "TENANT_ADMIN",
  "tenantId": "<uuid-tenant>"
}
```

**Kết quả**: Tenant Admin login → redirect `/staff/products`.

---

### #5 Manage Master Data (Category / Season) ⏳

| | |
|---|---|
| **Role** | System Admin |

**Điều kiện**: Thường seed sẵn qua script DB.

**API**:
```http
GET  /api/categories
GET  /api/seasons
POST /api/categories    { "categoryName": "Áo", "categoryCode": "AO" }
POST /api/seasons       { "seasonCode": "SS26", "seasonName": "Spring Summer 2026" }
```

**FE**: Chưa có màn admin riêng — dùng Swagger hoặc seed SQL.

**Kết quả**: Tenant tạo SKU (#40) chọn được category/season trong dropdown.

---

### #6 Approve Rental Request ✅

| | |
|---|---|
| **Role** | System Admin hoặc WH Admin |

**Điều kiện**: Có rental request status `PENDING` hoặc `UNDER_REVIEW` (guest/tenant gửi từ landing).

**FE**:
1. `/admin/requests` (hoặc rental request list)
2. Mở request → chọn **Duyệt & tiếp** / chuyển status → `APPROVED`

**API**:
```http
PATCH /api/rental-requests/{rentalRequestId}
{ "status": "APPROVED", "reviewNotes": "OK" }
```

**Kết quả**: Request `APPROVED`, sẵn sàng tạo contract (#30).

---

### #7 Reject Rental Request ✅

| | |
|---|---|
| **Role** | System Admin / WH Admin |

**FE/API**: Giống #6 nhưng `{ "status": "REJECTED", "rejectionReason": "..." }`.

**Kết quả**: Request dừng, không tạo contract.

---

### #8 View All Tenants ✅

| | |
|---|---|
| **Role** | System Admin |

**FE**: `/admin/requests` hoặc trang quản lý tenant (nếu có).

**API**: `GET /api/tenant-companies?page=1&limit=20`

**Kết quả**: List tất cả brand/tenant.

---

### #9 View All Contracts ✅

| | |
|---|---|
| **Role** | System Admin |

**FE**: `/admin/contract`

**API**: `GET /api/contracts?page=1&limit=20`

**Kết quả**: List hợp đồng mọi tenant/kho.

---

### #10 View All Invoices ❌

| | |
|---|---|
| **Role** | System Admin |

**Trạng thái**: Model DB có (`invoices`), API route chưa expose.

**Tạm thời**: Xem trực tiếp bảng `invoices` trong PostgreSQL hoặc chờ sprint billing.

---

### #11 View All Reports ⏳

| | |
|---|---|
| **Role** | System Admin |

**FE**: `/admin/reports` — UI có, dữ liệu có thể mock/chưa nối API đầy đủ.

**Kết quả**: Chọn loại báo cáo + filter date range → preview/export.

---

# WAREHOUSE ADMIN (12–36)

> Login: `whadmin@warehouse.local` / `WhAdmin@12345`

---

### #12 Create Warehouse Zone ✅

**FE**: `/admin/zones` → **Thêm zone** → chọn warehouse, nhập `zoneCode`, `zoneName`, `zoneType` → Bấm **Lưu thay đổi**

**API**:
```http
POST /api/zones
{ "warehouseId": "<uuid>", "zoneCode": "ZONE-A", "zoneName": "Ambient A", "zoneType": "SHARED" }
```

---

### #13 Create Rack ✅

**FE**: `/admin/racks` → chọn zone → tạo rack.

**API**: `POST /api/racks` — body có `zoneId`, `rackCode`, `rackName`.

---

### #14 Create Rack Level ✅

**API**: `POST /api/rack-levels` — body có `rackId`, `levelNumber`, `levelCode`.

**FE**: Trong flow quản lý rack layout `/admin/racks`.

---

### #15 Create Bin ✅

**API**:
```http
POST /api/bins
{
  "rackLevelId": "<uuid>",
  "binCode": "BIN-A01-2-01",
  "boxType": "MEDIUM",
  "volumeUnits": 2,
  "maxLpnCount": 4
}
```

**FE**: `/admin/racks` hoặc `/warehouses/:id` → tab Bins.

---

### #16 Update Warehouse Structure ✅

**FE/API**: PATCH tương ứng resource đã tạo ở #12–15.

```http
PATCH /api/zones/{zoneId}      { "zoneName": "..." }
PATCH /api/racks/{rackId}      { "status": "ACTIVE" }
PATCH /api/bins/{binId}        { "status": "BLOCKED" }
```

**Lưu ý**: Không xóa bin đang chứa hàng.

---

### #17 Create Warehouse Staff Account ✅

**FE**: `/admin/accounts` → Role `WH_STAFF` → không cần nhập warehouseId (tự gán).

**API**:
```http
POST /api/users
{ "fullName": "NV Kho A", "email": "staff@warehouse.local", "password": "Staff@12345", "role": "WH_STAFF" }
```

**Test tiếp**: Login staff → vào `/staff/inbound-ops`.

---

### #18 Create Transporter Account ✅

**FE**: `/admin/accounts` → Role `WH_TRANSPORTER`.

**API**: Giống #17, `"role": "WH_TRANSPORTER"`.

**Test tiếp**: Login transporter → `/staff/my-deliveries`.

---

### #19 Review Rental Request ✅

**FE**: `/admin/requests` → mở request → chuyển `UNDER_REVIEW`, xem thông tin brand, volume, contract type.

**API**: `PATCH /api/rental-requests/{id}` `{ "status": "UNDER_REVIEW" }`

---

### #20 Approve Rental Request ✅

Giống System Admin #6 — WH Admin chỉ thấy request thuộc warehouse/khu vực mình.

---

### #21 Reject Rental Request ✅

Giống #7.

---

### #22 View Occupancy Dashboard ⏳

**FE**: `/admin/dashboard` — widget occupancy (nếu đã nối).

**API**: Snapshot qua `occupancy_snapshots` — endpoint expose sau.

**Test tạm**: Xem `bins.used_volume_units` vs capacity trong DB.

---

### #23 View Warehouse Inventory ✅

**FE**: `/admin/inventory`

**API**: `GET /api/inventories?warehouseId=<uuid>`

**Kết quả**: Tồn theo SKU/bin/LPN trong kho của WH Admin.

---

### #24 View & Send Invoice ❌

**Trạng thái**: Chưa có API invoice. Ghi doc: WH Admin review invoice trên FE khi billing sprint xong.

---

### #25 View Warehouse Reports ⏳

**FE**: `/admin/reports` — filter theo warehouse.

---

### #26 View Tenant Company Info ✅

**FE**: Trong chi tiết rental request / contract.

**API**: `GET /api/tenant-companies/{tenantId}`

---

### #27 View Inbound Request List ✅

**FE**: `/admin/inbound`

**API**: `GET /api/inbound-requests?warehouseId=<uuid>&status=PENDING`

---

### #28 View Outbound Request List ⏳

**FE**: Chưa có route riêng — dùng Swagger.

**API**: `GET /api/outbound-requests?warehouseId=<uuid>`

---

### #29 Assign Transporter to Inbound Trip ✅

**Điều kiện**:
- Inbound `deliveryMode = WAREHOUSE_TRANSPORT`
- Status `PENDING` / `APPROVED` / `ARRIVED`
- Đã có tài khoản WH_TRANSPORTER (#18)

**FE**:
1. `/admin/inbound/:id` → section **Vận chuyển**
2. Chọn tài xế trong dropdown → **Lưu vận chuyển**

**API**:
```http
PUT /api/inbound-requests/{inboundRequestId}/delivery
{ "assignedDriverUserId": "<uuid-transporter>", "vehiclePlate": "51A-12345" }
```

**Kết quả**: Transporter thấy chuyến trong `/staff/my-deliveries`.

---

### #30 Create Contract ✅

**Điều kiện**: Rental request `APPROVED`.

**FE**: `/admin/contract` → **Tạo hợp đồng** → chọn rental request, tenant, warehouse, ngày, contract type.

**API**:
```http
POST /api/contracts
{
  "rentalRequestId": "<uuid>",
  "tenantId": "<uuid>",
  "warehouseId": "<uuid>",
  "contractType": "SHARED_STORAGE",
  "startDate": "2026-06-01",
  "endDate": "2027-05-31",
  "status": "DRAFT"
}
```

**Kết quả**: Contract tạo → kích hoạt `ACTIVE` (#31) trước khi inbound.

---

### #31 Update Contract ✅

**FE**: `/admin/contract` → sửa → đổi status sang `ACTIVE`.

**API**: `PATCH /api/contracts/{contractId}` `{ "status": "ACTIVE" }`

**Kết quả**: Tenant được phép tạo inbound/outbound.

---

### #32 Assign Storage Reservation ✅

**Điều kiện**: Contract `ACTIVE`.

**FE**: Tab storage trong contract detail.

**API**:
```http
POST /api/storage-reservations
{
  "contractId": "<uuid>",
  "tenantId": "<uuid>",
  "warehouseId": "<uuid>",
  "storageLevel": "BIN",
  "binId": "<uuid>",
  "reservationType": "SHARED",
  "quantity": 1,
  "startDate": "2026-06-01",
  "endDate": "2027-05-31"
}
```

**Lưu ý**: Chỉ điền **1** FK trong: `warehouseId` / `zoneId` / `rackId` / `rackLevelId` / `binId`.

---

### #33 Approve Inbound Request ✅

**Điều kiện**: Inbound status `PENDING`, contract `ACTIVE`.

**FE**: `/admin/inbound/:id` → **Approve**

**API**: `PATCH /api/inbound-requests/{id}` `{ "status": "APPROVED" }`

---

### #34 Reject Inbound Request ✅

**API/FE**: `{ "status": "CANCELLED" }` (hoặc reject với lý do trên UI).

---

### #35 Approve Outbound Request ⏳

**API**: `PATCH /api/outbound-requests/{id}` `{ "status": "APPROVED" }`

**FE**: Chưa có trang outbound admin — test Swagger.

**Kết quả**: System reserve inventory (FIFO) → `RESERVED`.

---

### #36 Reject Outbound Request ⏳

**API**: `PATCH /api/outbound-requests/{id}` `{ "status": "CANCELLED" }`

---

# TENANT ADMIN (37–47)

> Login: `tenant1admin@brand.local` / `Tenant1@12345`

---

### #37 Create Tenant Staff Account ✅

**FE**: `/staff/accounts` → Role `TENANT_STAFF` → Bấm **Lưu thay đổi**

**API**:
```http
POST /api/users
{ "fullName": "NV Brand", "email": "tenantstaff@brand.local", "password": "Staff@12345", "role": "TENANT_STAFF" }
```

---

### #38 View & Sign Contract ✅

**FE**: `/staff/contracts` → xem chi tiết hợp đồng ACTIVE.

**API**: `GET /api/contracts?tenantId=<uuid>`

**Sign**: PATCH contract status nếu flow ký digital có trên UI; nếu không, WH Admin kích hoạt ACTIVE (#31).

---

### #39 Create New Rental Request ✅

**Điều kiện**: Tenant muốn thuê thêm kho / gia hạn.

**FE**: `/staff/rental-requests` hoặc landing page `/` (guest flow).

**API**:
```http
POST /api/rental-requests
{
  "companyName": "Brand X",
  "contactEmail": "brand@x.com",
  "estimatedVolume": 50,
  "contractType": "SHARED_STORAGE",
  "preferredCity": "TP.HCM"
}
```

---

### #40 Create SKU ✅

**FE**: `/staff/products` → **Thêm SKU** → điền code, tên, category, collection, season → Bấm **Lưu thay đổi**

**API**:
```http
POST /api/skus
{
  "tenantId": "<uuid>",
  "skuCode": "AT-DO-M",
  "productName": "Áo thun đỏ M",
  "categoryId": "<uuid>",
  "movementCategory": "FAST_MOVING"
}
```

---

### #41 Update SKU ✅

**FE**: `/staff/products` → chọn SKU → Sửa.

**API**: `PATCH /api/skus/{skuId}` `{ "productName": "...", "movementCategory": "SLOW_MOVING" }`

---

### #42 Delete SKU ✅

**FE**: Nút xóa / soft disable trên product page.

**API**: `DELETE /api/skus/{skuId}` (soft disable `isActive=false`).

**Lưu ý**: Không xóa được SKU đã có inventory.

---

### #43 Create Inbound Request ✅

**Điều kiện**: Contract `ACTIVE`, đã có SKU.

**FE**:
1. `/staff/inbound` → **Tạo mới**
2. Chọn contract, ngày dự kiến, `deliveryMode` (`TENANT_SELF` hoặc `WAREHOUSE_TRANSPORT`)
3. Thêm items: SKU + expected quantity
4. **Submit** → status `PENDING`

**API**:
```http
POST /api/inbound-requests
{
  "contractId": "<uuid>",
  "expectedArrivalDate": "2026-06-15",
  "deliveryMode": "TENANT_SELF",
  "status": "PENDING",
  "items": [{ "skuId": "<uuid>", "expectedQuantity": 100 }]
}
```

---

### #44 Create Outbound Request ⏳

**Điều kiện**: Có tồn kho đủ.

**API**:
```http
POST /api/outbound-requests
{
  "contractId": "<uuid>",
  "requestedShipDate": "2026-06-20",
  "status": "PENDING",
  "items": [{ "skuId": "<uuid>", "requestedQuantity": 30 }]
}
```

**FE**: Route `/staff/outbound` chưa có — dùng Swagger hoặc Import/Export page nếu đã nối.

---

### #45 View Inventory ✅

**FE**: `/staff/inventory`

**API**: `GET /api/inventories?tenantId=<uuid>`

---

### #46 View Invoice ❌

API chưa có — xem DB table `invoices` hoặc chờ sprint billing.

---

### #47 View Reports ⏳

**FE**: Chưa có `/staff/reports` — tenant admin có thể xem dashboard tóm tắt tại `/staff/dashboard`.

---

# WAREHOUSE STAFF (48–55)

> Login: tài khoản tạo ở #17, ví dụ `staff@warehouse.local`

---

### #48 Mark Inbound Arrived ✅

**Điều kiện**:
- Inbound `APPROVED`
- `deliveryMode = TENANT_SELF` (tenant tự ship tới kho)
- Đã lưu thông tin delivery (biển số xe)

**FE**: `/staff/inbound-ops/:id` → cập nhật delivery → đổi status **ARRIVED** (hoặc nút tương đương).

**API**:
```http
PATCH /api/inbound-requests/{id}
{ "status": "ARRIVED", "actualArrivalAt": "2026-06-15T08:00:00.000Z" }
```

**Lưu ý**: Nếu `WAREHOUSE_TRANSPORT`, bước này do **Transporter #66** làm, không phải WH Staff.

---

### #49 Receive Inbound & Record Quantity ✅

**Điều kiện**: Status `ARRIVED` hoặc `APPROVED` (tùy flow).

**FE**: `/staff/inbound-ops/:id`:
1. **Start receiving** → status `RECEIVING`
2. Nhập `receivedQuantity` từng dòng SKU
3. Ghi discrepancy nếu lệch

**API**:
```http
POST /api/inbound-requests/{id}/start-receiving

PATCH /api/inbound-requests/{inboundRequestId}/items/{itemId}
{ "receivedQuantity": 98, "discrepancyReason": "2 damaged" }
```

---

### #50 Create Batch & LPN ✅

**FE**: Trong inbound detail (warehouse mode):
1. **Tạo batch** — nhập `batchCode`
2. **Tạo LPN** — chọn box type, thêm SKU + qty vào carton

**API**:
```http
POST /api/batches
{ "inboundRequestId": "<uuid>", "batchCode": "BATCH-001" }

POST /api/lpns
{ "batchId": "<uuid>", "boxType": "MEDIUM", "volumeUnits": 2 }

POST /api/lpn-details
{ "lpnId": "<uuid>", "skuId": "<uuid>", "quantity": 50 }
```

---

### #51 Put-Away LPN to Bin ✅

**FE**: Inbound detail → chọn LPN → scan/chọn bin đích → confirm put-away.

**API**:
```http
PATCH /api/lpns/{lpnId}
{ "currentBinId": "<uuid-bin>", "status": "STORED" }

# Hoặc bulk:
POST /api/inbound-requests/{id}/bulk-putaway
POST /api/inbound-requests/{id}/auto-putaway
```

**Kết quả**: Inventory tăng, bin `usedVolumeUnits` cập nhật.

---

### #52 Execute Outbound Picking ⏳

**Điều kiện**: Outbound status `RESERVED` hoặc `PICKING`.

**API** (khi picking task API sẵn sàng): cập nhật outbound → `PICKING`, confirm từng item.

**FE**: Chưa có `/staff/picking` — test qua Swagger PATCH outbound status.

---

### #53 Pack & Create Shipment ⏳

**API**:
```http
PATCH /api/outbound-requests/{id}   { "status": "PACKING" }
PATCH /api/outbound-requests/{id}   { "status": "SHIPPED" }
POST /api/shipments                 { "outboundRequestId": "...", "trackingNumber": "..." }
```

---

### #54 Report Damaged Inventory ❌

**Trạng thái**: Flow 13 trong spec — API/UI chưa có.

**Test tạm**: Ghi discrepancy lúc receiving (#49).

---

### #55 View Warehouse Inventory ✅

**FE**: `/staff/inventory-ops`

**API**: `GET /api/inventories?warehouseId=<uuid>`

---

# TENANT STAFF (56–62)

> Login: tài khoản tạo ở #37, ví dụ `tenantstaff@brand.local`

> Các bước **giống Tenant Admin** tương ứng, nhưng **không** vào `/staff/accounts`, **không** xóa SKU.

---

### #56 Create Inbound Request ✅

Làm giống **#43** — `/staff/inbound/new`.

---

### #57 Create Outbound Request ⏳

Làm giống **#44** — API Swagger (FE chưa có route).

---

### #58 View Inbound & Outbound Status ✅

**FE**:
- Inbound: `/staff/inbound` → click vào request → xem timeline status
- Outbound: khi có `/staff/outbound` hoặc xem qua API `GET /api/outbound-requests?tenantId=`

---

### #59 Create SKU ✅

Làm giống **#40** — `/staff/products`.

---

### #60 Update SKU ✅

Làm giống **#41**.

**Không được**: Delete SKU (#42).

---

### #61 View Inventory ✅

Làm giống **#45** — `/staff/inventory`.

---

### #62 View Invoice ❌

Làm giống **#46** — chờ API billing.

---

# WAREHOUSE TRANSPORTER (63–66)

> Login: tài khoản tạo ở #18

> Chỉ áp dụng inbound `deliveryMode = WAREHOUSE_TRANSPORT` **đã được WH Admin gán** (#29).

---

### #63 View Assigned Delivery Trips ✅

**FE**: Login transporter → tự redirect `/staff/my-deliveries`

**API**:
```http
GET /api/inbound-requests?assignedToMe=true&includeDelivery=true
```

**Kết quả**: Chỉ thấy chuyến gán cho mình.

---

### #64 View Inbound Trip Detail ✅

**FE**: `/staff/my-deliveries` → click mã inbound → `/staff/my-deliveries/:inboundRequestId`

**API**: `GET /api/inbound-requests/{id}` + `GET /api/inbound-requests/{id}/delivery`

---

### #65 Update Vehicle & Driver Info ✅

**Điều kiện**: Inbound status = `APPROVED`, đã được assign.

**FE**: Trong trip detail → nhập biển số, tên/SĐT tài xế → **Lưu thông tin xe**

**API**:
```http
PUT /api/inbound-requests/{id}/delivery
{
  "vehiclePlate": "51A-12345",
  "driverName": "Nguyễn Văn A",
  "driverPhone": "0901234567",
  "carrierName": "NEXSPACE Transport"
}
```

**Lưu ý**: Transporter **không** được đổi `assignedDriverUserId`.

---

### #66 Report Arrival at Warehouse ✅

**Điều kiện**:
- Status `APPROVED`
- Đã có `vehiclePlate` (#65)

**FE**: Trip detail → **Báo xe đến kho**

**API**:
```http
POST /api/inbound-requests/{id}/report-arrival
```

**Kết quả**: Status → `ARRIVED`, `actualArrivalAt` ghi nhận → WH Staff tiếp tục #49.

---

## Checklist demo Capstone (15 phút)

| Bước | Function # | Ai làm | Màn hình |
|------|------------|--------|----------|
| 1 | Guest submit rental | Guest | `/` |
| 2 | #20, #30, #31 | WH Admin | `/admin/requests`, `/admin/contract` |
| 3 | #40, #43 | Tenant Admin | `/staff/products`, `/staff/inbound` |
| 4 | #33 | WH Admin | `/admin/inbound` |
| 5 | #48–51 hoặc #29,65–66 + #49–51 | WH Staff / Transporter | `/staff/inbound-ops` |
| 6 | #45 | Tenant | `/staff/inventory` |
| 7 | #44, #35, #52–53 | Tenant + WH | Swagger nếu FE chưa xong |

---

## Troubleshooting nhanh

| Lỗi | Nguyên nhân | Cách xử lý |
|-----|-------------|------------|
| `403 Forbidden` | Sai role / sai scope | Login đúng account, check JWT role |
| `Contract must be ACTIVE` | Hợp đồng chưa active | WH Admin PATCH contract #31 |
| `INSUFFICIENT_INVENTORY` | Xuất quá tồn | Nhập inbound trước (#43→#51) |
| `Trip is not assigned to you` | Transporter chưa được gán | WH Admin làm #29 |
| `vehiclePlate is required` | Chưa nhập biển số | Transporter #65 trước #66 |
| Dropdown SKU trống | Chưa tạo SKU | Tenant #40 |

---

> **Cập nhật file này** khi thêm route FE (outbound, invoice, picking) hoặc expose API mới — đổi icon ⏳/❌ → ✅.

---

# Test Case Specification (English) — All Roles

> **Reference**: `docs/all_role_func.md` (#1–#66)  
> **Version**: 1.1 — 2026-05-30  
> **Test environment**: FE `http://localhost:5173` · BE `http://localhost:3000` · Swagger `http://localhost:3000/api-docs`

### Global test accounts

| Role | Email | Password |
|------|-------|----------|
| System Admin | `admin@warehouse.local` | `admin12345` |
| Warehouse Admin | `whadmin@warehouse.local` | `WhAdmin@12345` |
| Tenant Admin | `tenant1admin@brand.local` | `Tenant1@12345` |
| Warehouse Staff | Created by WH Admin | (custom) |
| Warehouse Transporter | Created by WH Admin | (custom) |
| Tenant Staff | Created by Tenant Admin | (custom) |

### Test Case Procedure convention

- **Test Case Description**, **Expected Results**, **Pre-conditions**: English.
- **UI labels** on the web (buttons, dialogs, field labels, toast messages): Vietnamese — e.g. Click **TẠO KHO**, not Click **Create**.
- **API steps**: keep endpoint / method names.
- Example: *Click **Chỉnh sửa** on an existing warehouse* → expected toast: **"Cập nhật thành công."**

---

# System Admin — Test Cases (#1–#11)

> **Role**: `SYSTEM_ADMIN`

## **Create Warehouse** (#1)

| Test Case ID | Test Case Description | Test Case Procedure | Expected Results | Pre-conditions |
|--------------|----------------------|---------------------|------------------|----------------|
| TC_SYS_001 | Create warehouse successfully | 1. Log in as System Admin.<br>2. Navigate to `/admin/warehouse`.<br>3. Click **TẠO KHO**.<br>4. In the **Tạo kho** dialog, enter **Mã kho**, **Tên kho**, **Tỉnh/Thành phố**, **Quận/Huyện**, and area fields (if any).<br>5. Click **Tạo kho**. | • Success message: **"Tạo kho thành công."**<br>• New warehouse appears in the list with status `ACTIVE`. | • System Admin account is `ACTIVE`. |
| TC_SYS_002 | Create warehouse fails with duplicate code | 1. Log in as System Admin.<br>2. Click **TẠO KHO** and enter an existing **Mã kho**.<br>3. Click **Tạo kho**. | • HTTP `409 Conflict`, code `DUPLICATE`.<br>• Error message indicates duplicate warehouse code.<br>• No duplicate record is created. | • A warehouse with the same `warehouseCode` already exists. |
| TC_SYS_002E | Create warehouse fails — missing required fields | 1. Log in as System Admin.<br>2. Open **Tạo kho** dialog, leave **Mã kho** or **Tên kho** empty.<br>3. Click **Tạo kho**. | • HTTP `400 Bad Request`.<br>• Message: **"warehouseCode is required"** or **"warehouseName is required"**. | • System Admin is logged in. |
| TC_SYS_002F | Non–System Admin cannot create warehouse | 1. Log in as WH Admin.<br>2. Call `POST /api/warehouses` via Swagger. | • HTTP `403 Forbidden`.<br>• Message: **"SYSTEM_ADMIN only"**. | • WH Admin account is `ACTIVE`. |

---

## **Update Warehouse** (#2)

| Test Case ID | Test Case Description | Test Case Procedure | Expected Results | Pre-conditions |
|--------------|----------------------|---------------------|------------------|----------------|
| TC_Update_Warehouse_001 | Update warehouse information successfully | 1. Log in as System Admin.<br>2. Navigate to `/admin/warehouse`.<br>3. Click **Chỉnh sửa** (edit icon) on an existing warehouse row.<br>4. In the **Chỉnh sửa kho** dialog, update **Tên kho**, **Địa chỉ**, **Tỉnh/Thành phố**, **Quận/Huyện**.<br>5. Click **Cập nhật**. | • Success message: **"Cập nhật thành công."**<br>• Updated data appears after page refresh.<br>• **Mã kho** remains unchanged. | • Target warehouse exists. |
| TC_Update_Warehouse_002 | Update warehouse status and area fields | 1. Log in as System Admin.<br>2. Click **Chỉnh sửa** on a warehouse.<br>3. Change **Trạng thái** to **Bảo trì** (`MAINTENANCE`).<br>4. Enter **Tổng diện tích** = 5000, **Diện tích sử dụng** = 4500 (m²).<br>5. Click **Cập nhật**. | • Status and area fields are saved.<br>• `PATCH /api/warehouses/{id}` returns updated record. | • Warehouse exists.<br>• Total zone area ≤ 4500 m² (if zones exist). |
| TC_Update_Warehouse_003 | Warehouse code is read-only on edit | 1. Log in as System Admin.<br>2. Click **Chỉnh sửa** on a warehouse.<br>3. Observe the **Mã kho** field in **Chỉnh sửa kho** dialog.<br>4. Update other fields and click **Cập nhật**. | • **Mã kho** field is **disabled** (read-only).<br>• After save, **Mã kho** in the list is unchanged. | • Warehouse with known code exists. |
| TC_Update_Warehouse_004 | Update fails — empty warehouse name | 1. Log in as System Admin.<br>2. Click **Chỉnh sửa** → clear **Tên kho**.<br>3. Click **Cập nhật**. | • HTTP `400 Bad Request`.<br>• Message: **"warehouseName cannot be empty"**.<br>• Warehouse data is unchanged. | • Warehouse exists. |
| TC_Update_Warehouse_005 | Update fails — usable area exceeds total area | 1. Log in as System Admin.<br>2. Call `PATCH /api/warehouses/{id}` with `{ "totalAreaM2": 1000, "usableAreaM2": 1500 }`. | • HTTP `400`, code `AREA_EXCEEDS_TOTAL`.<br>• Usable area cannot exceed total area.<br>• No update applied. | • Warehouse exists. |
| TC_Update_Warehouse_006 | Update fails — usable area less than existing zone area | 1. Use a warehouse with total zone area = 800 m².<br>2. Call `PATCH` with `{ "usableAreaM2": 500 }`. | • HTTP `400`, code `ZONE_AREA_EXCEEDS_USABLE`.<br>• Total zone area exceeds new usable area.<br>• `usableAreaM2` is not reduced. | • Warehouse has zones totaling 800 m². |
| TC_Update_Warehouse_007 | Update fails — warehouse not found | 1. Log in as System Admin.<br>2. Call `PATCH /api/warehouses/00000000-0000-4000-8000-000000000099`. | • HTTP `404 Not Found`.<br>• Message: **"Warehouse not found"**. | • Invalid `warehouseId`. |
| TC_Update_Warehouse_008 | Update fails — empty PATCH body | 1. Log in as System Admin.<br>2. Call `PATCH /api/warehouses/{id}` with body `{}`. | • HTTP `400 Bad Request`.<br>• Message: **"No valid fields to update"**. | • Valid warehouse exists. |

---

## **Delete Warehouse** (System Admin)

| Test Case ID | Test Case Description | Test Case Procedure | Expected Results | Pre-conditions |
|--------------|----------------------|---------------------|------------------|----------------|
| TC_Delete_Warehouse_001 | Delete warehouse successfully | 1. Log in as System Admin.<br>2. Create a test warehouse with **no** zones, contracts, or assigned users.<br>3. On `/admin/warehouse`, click **Xóa** (trash icon) on the test warehouse.<br>4. Confirm dialog **"Bạn có chắc muốn xóa kho ...?"**. | • Success message: **"Xóa thành công"**.<br>• Warehouse removed from list.<br>• `GET /api/warehouses/{id}` returns `404`. | • Test warehouse has no dependent data. |
| TC_Delete_Warehouse_002 | Delete fails — warehouse has related data | 1. Log in as System Admin.<br>2. Click **Xóa** on a warehouse that has zones / contracts / WH Admin.<br>3. Confirm deletion. | • HTTP `400`, code `FK_VIOLATION`.<br>• Error indicates related data still exists.<br>• Warehouse remains in list. | • Warehouse has zone / contract / user. |
| TC_Delete_Warehouse_003 | Delete fails — warehouse not found | 1. Log in as System Admin.<br>2. Call `DELETE /api/warehouses/00000000-0000-4000-8000-000000000099`. | • HTTP `404 Not Found`.<br>• Message: **"Warehouse not found"**. | • Invalid `warehouseId`. |
| TC_Delete_Warehouse_004 | WH Admin cannot delete warehouse | 1. Log in as WH Admin.<br>2. Navigate to `/admin/warehouse` — verify **Xóa** button is not shown.<br>3. Call `DELETE /api/warehouses/{id}` via Swagger. | • FE: no delete icon displayed.<br>• API: HTTP `403 Forbidden` — **"SYSTEM_ADMIN only"**. | • WH Admin account is `ACTIVE`. |
| TC_Delete_Warehouse_005 | WH Admin cannot delete warehouse via API | 1. Log in as WH Admin.<br>2. Call `DELETE` on any `warehouseId`. | • HTTP `403 Forbidden`.<br>• Warehouse is not deleted. | • WH Admin account is `ACTIVE`. |

---

## **User Management** (#3, #4)

| Test Case ID | Test Case Description | Test Case Procedure | Expected Results | Pre-conditions |
|--------------|----------------------|---------------------|------------------|----------------|
| TC_SYS_004 | Create Warehouse Admin account successfully | 1. Log in as System Admin.<br>2. Navigate to `/admin/accounts`.<br>3. Click **Thêm tài khoản** → select role **Quản trị kho** → select warehouse.<br>4. Click **Tạo tài khoản**. | • Success message: **"Tạo tài khoản thành công."**<br>• New WH Admin can log in and access `/admin` for the assigned warehouse. | • At least one warehouse exists. |
| TC_SYS_005 | Create Tenant Admin account successfully | 1. Log in as System Admin.<br>2. Navigate to `/admin/accounts`.<br>3. Click **Thêm tài khoản** → select role **Quản trị tenant** → select tenant.<br>4. Click **Tạo tài khoản**. | • Success message confirms account created.<br>• Tenant Admin redirects to `/staff/products` after login. | • Tenant company record exists. |
| TC_SYS_006 | WH Admin cannot create another WH Admin | 1. Log in as Warehouse Admin.<br>2. Attempt `POST /api/users` with role `WH_ADMIN`. | • HTTP `403 Forbidden`.<br>• User is not created. | • WH Admin account is `ACTIVE`. |

## **Master Data** (#5)

| Test Case ID | Test Case Description | Test Case Procedure | Expected Results | Pre-conditions |
|--------------|----------------------|---------------------|------------------|----------------|
| TC_SYS_007 | View categories and seasons | 1. Log in as System Admin.<br>2. Call `GET /api/categories` and `GET /api/seasons` via Swagger. | • Both endpoints return HTTP `200`.<br>• Response contains at least one category and one season (seed data). | • Database seeded. |
| TC_SYS_008 | Create category successfully | 1. Log in as System Admin.<br>2. `POST /api/categories` with valid `categoryCode` and `categoryName`. | • HTTP `201 Created`.<br>• Category appears in subsequent GET list. | • System Admin token valid. |

## **Rental Request** (#6, #7)

| Test Case ID | Test Case Description | Test Case Procedure | Expected Results | Pre-conditions |
|--------------|----------------------|---------------------|------------------|----------------|
| TC_SYS_009 | Approve rental request successfully | 1. Ensure a rental request exists with status `PENDING`.<br>2. Log in as System Admin.<br>3. Navigate to `/admin/requests`.<br>4. Open request detail → click **Duyệt & tiếp** (onboarding wizard). | • Status changes to `APPROVED`.<br>• Success message displayed.<br>• Request is ready for contract creation. | • Pending rental request exists. |
| TC_SYS_010 | Reject rental request successfully | 1. Open a rental request with status `PENDING`.<br>2. Click **Từ chối** and enter rejection reason. | • Status changes to `REJECTED`.<br>• Rejection reason is saved. | • Pending rental request exists. |

## **View All Data** (#8–#11)

| Test Case ID | Test Case Description | Test Case Procedure | Expected Results | Pre-conditions |
|--------------|----------------------|---------------------|------------------|----------------|
| TC_SYS_011 | View all tenants | 1. Log in as System Admin.<br>2. Call `GET /api/tenant-companies`. | • HTTP `200`.<br>• List includes all tenant companies in system. | • At least one tenant exists. |
| TC_SYS_012 | View all contracts | 1. Log in as System Admin.<br>2. Navigate to `/admin/contract`. | • Contract list loads for all tenants/warehouses.<br>• Filters work by status. | • At least one contract exists. |
| TC_SYS_013 | View all reports | 1. Log in as System Admin.<br>2. Navigate to `/admin/reports`. | • Reports page loads without error.<br>• User can select report type and date range. | • System Admin account is `ACTIVE`. |
| TC_SYS_014 | View all invoices (API pending) | 1. Log in as System Admin.<br>2. Attempt invoice list via API/UI. | • Document as **Not yet implemented** — verify via DB table `invoices` if needed for demo. | • Billing module not exposed yet. |

---

# Warehouse Admin — Test Cases (#12–#36)

> **Role**: `WH_ADMIN` · Login: `whadmin@warehouse.local`

## **Warehouse Structure** (#12–#16)

| Test Case ID | Test Case Description | Test Case Procedure | Expected Results | Pre-conditions |
|--------------|----------------------|---------------------|------------------|----------------|
| TC_WHAD_001 | Create warehouse zone successfully | 1. Log in as WH Admin.<br>2. Navigate to `/admin/zones`.<br>3. Click **TẠO ZONE** → enter **Mã zone**, **Tên zone**, **Loại zone**.<br>4. Click **Tạo zone**. | • Success message: **"Tạo zone thành công"**.<br>• Zone appears in the assigned warehouse list. | • WH Admin linked to warehouse. |
| TC_WHAD_002 | Create rack successfully | 1. Select a zone from the list.<br>2. Navigate to `/admin/racks`.<br>3. Click **Thêm rack** → enter **Mã rack**, **Tên rack**.<br>4. Click **Lưu**. | • Rack created and linked to zone. | • Zone exists in WH Admin's warehouse. |
| TC_WHAD_003 | Create rack level successfully | 1. Select a rack.<br>2. Create rack level with **Số tầng**, **Mã tầng** (in rack layout flow). | • Rack level created under selected rack. | • Rack exists. |
| TC_WHAD_004 | Create bin successfully | 1. Select a rack level.<br>2. Click **Tạo bin** or **Tạo bin hàng loạt** → enter **Mã bin**, box type, volume.<br>3. Click **Tạo bin**. | • Bin created with status `AVAILABLE`. | • Rack level exists. |
| TC_WHAD_005 | Update warehouse structure successfully | 1. Click **Chỉnh sửa** on a zone/rack/bin.<br>2. Update name or status → click **Cập nhật** / **Lưu**.<br>3. Refresh the list. | • Changes persisted.<br>• Success message shown. | • Structure entity exists. |
| TC_WHAD_006 | WH Staff cannot create zone | 1. Log in as WH Staff.<br>2. Attempt `POST /api/zones`. | • HTTP `403 Forbidden`. | • WH Staff account is `ACTIVE`. |

## **Account Management** (#17, #18)

| Test Case ID | Test Case Description | Test Case Procedure | Expected Results | Pre-conditions |
|--------------|----------------------|---------------------|------------------|----------------|
| TC_WHAD_007 | Create Warehouse Staff account | 1. Log in as WH Admin.<br>2. Navigate to `/admin/accounts`.<br>3. Click **Thêm tài khoản** → select role **Nhân viên kho** (`WH_STAFF`).<br>4. Click **Tạo tài khoản** (no warehouse selection needed — auto-assigned). | • Success message confirms account created.<br>• Staff can log in → `/staff/inbound-ops`. | • WH Admin is `ACTIVE`. |
| TC_WHAD_008 | Create Transporter account | 1. Log in as WH Admin.<br>2. Navigate to `/admin/accounts` → **Thêm tài khoản** → role **Tài xế kho** (`WH_TRANSPORTER`).<br>3. Click **Tạo tài khoản**. | • Transporter created in same warehouse.<br>• Login redirects to **Chuyến vận chuyển của tôi** (`/staff/my-deliveries`). | • WH Admin is `ACTIVE`. |

## **Rental Request & Contract** (#19–#21, #30–#31)

| Test Case ID | Test Case Description | Test Case Procedure | Expected Results | Pre-conditions |
|--------------|----------------------|---------------------|------------------|----------------|
| TC_WHAD_009 | Review rental request | 1. Navigate to `/admin/requests`.<br>2. Open request detail → change status to **Đang xem xét** (`UNDER_REVIEW`). | • Status updated.<br>• Review notes saved if provided. | • Pending rental request exists. |
| TC_WHAD_010 | Approve rental request | 1. Open a reviewed request.<br>2. Click **Duyệt & tiếp** in the onboarding wizard. | • Status = `APPROVED`. | • Request in reviewable state. |
| TC_WHAD_011 | Reject rental request | 1. Open rental request detail.<br>2. Click **Từ chối** and enter reason. | • Status = `REJECTED`. | • Pending request exists. |
| TC_WHAD_012 | Create contract successfully | 1. Navigate to `/admin/contract`.<br>2. In onboarding wizard, complete step **Tạo hợp đồng** from approved request.<br>3. Enter start/end dates and contract type. | • Contract created with status `DRAFT` or `ACTIVE`.<br>• Linked to tenant and warehouse. | • Approved rental request exists. |
| TC_WHAD_013 | Activate contract | 1. PATCH contract status to `ACTIVE`. | • Tenant can create inbound/outbound.<br>• Success message shown. | • Contract in `DRAFT`. |

## **Storage Reservation** (#32)

| Test Case ID | Test Case Description | Test Case Procedure | Expected Results | Pre-conditions |
|--------------|----------------------|---------------------|------------------|----------------|
| TC_WHAD_014 | Assign storage reservation to bin | 1. `POST /api/storage-reservations` with `contractId`, `binId`, `storageLevel=BIN`. | • Reservation created.<br>• Only one FK (bin) populated. | • Active contract exists.<br>• Available bin exists. |
| TC_WHAD_015 | Storage reservation fails with multiple FKs | 1. POST reservation with both `zoneId` and `binId`. | • HTTP `400 Validation Error`.<br>• Message indicates only one storage FK allowed. | • Active contract exists. |

## **Inbound / Outbound Approval** (#27–#29, #33–#36)

| Test Case ID | Test Case Description | Test Case Procedure | Expected Results | Pre-conditions |
|--------------|----------------------|---------------------|------------------|----------------|
| TC_WHAD_016 | View inbound request list | 1. Navigate to `/admin/inbound`.<br>2. Filter by status `PENDING`. | • List shows inbound for WH Admin's warehouse only. | • Pending inbound exists. |
| TC_WHAD_017 | Approve inbound request | 1. Open inbound detail (`/admin/inbound/{id}`).<br>2. Click **Duyệt** and confirm the dialog. | • Status → `APPROVED`.<br>• Tenant notified (if email enabled). | • Inbound `PENDING`, contract `ACTIVE`. |
| TC_WHAD_018 | Reject inbound request | 1. Open inbound detail → click **Hủy yêu cầu** / reject. | • Status → `CANCELLED`. | • Inbound `PENDING`. |
| TC_WHAD_019 | Assign transporter to inbound trip | 1. Open inbound detail with **Kho đi lấy hàng** type (`WAREHOUSE_TRANSPORT`).<br>2. In the delivery section, select driver from dropdown.<br>3. Click **Lưu vận chuyển**. | • `assignedDriverUserId` saved.<br>• Transporter sees trip at **Chuyến vận chuyển của tôi** (`/staff/my-deliveries`). | • Transporter account exists.<br>• Inbound approved. |
| TC_WHAD_024 | View tenant company info | 1. Open rental request or contract detail.<br>2. View linked tenant information. | • Tenant name, tax code, contact displayed. | • Tenant linked to contract/request. |
| TC_WHAD_020 | View outbound request list | 1. `GET /api/outbound-requests?warehouseId=` via Swagger. | • HTTP `200` with outbound list scoped to warehouse. | • Outbound request exists. |
| TC_WHAD_021 | Approve outbound request | 1. PATCH outbound status to `APPROVED`. | • Status → `APPROVED` then system reserves inventory (`RESERVED`). | • Sufficient inventory available. |
| TC_WHAD_022 | Reject outbound request | 1. PATCH outbound to `CANCELLED`. | • Outbound cancelled.<br>• No inventory locked. | • Outbound in `PENDING`. |

## **Monitoring & Billing** (#22–#26)

| Test Case ID | Test Case Description | Test Case Procedure | Expected Results | Pre-conditions |
|--------------|----------------------|---------------------|------------------|----------------|
| TC_WHAD_023 | View warehouse inventory | 1. Navigate to `/admin/inventory`. | • Inventory list scoped to WH Admin warehouse.<br>• SKU, bin, quantity visible. | • Inventory records exist. |
| TC_WHAD_025 | View occupancy dashboard | 1. Open `/admin/dashboard`. | • Occupancy widgets load (or placeholder if API pending). | • Bins with usage data exist. |
| TC_WHAD_026 | View warehouse reports | 1. Open `/admin/reports`. | • Reports page accessible for WH Admin. | • WH Admin is `ACTIVE`. |
| TC_WHAD_027 | View and send invoice (API pending) | 1. Attempt invoice list/send. | • Document as **Not yet implemented** until billing API available. | • Invoice module pending. |

---

# Tenant Admin — Test Cases (#37–#47)

> **Role**: `TENANT_ADMIN` · Login: `tenant1admin@brand.local`

## **Account & Onboarding** (#37–#39, #38)

| Test Case ID | Test Case Description | Test Case Procedure | Expected Results | Pre-conditions |
|--------------|----------------------|---------------------|------------------|----------------|
| TC_TAD_001 | Create Tenant Staff account | 1. Log in as Tenant Admin.<br>2. Navigate to `/staff/accounts`.<br>3. Click **Thêm tài khoản** → select role **Nhân viên tenant** (`TENANT_STAFF`).<br>4. Click **Tạo tài khoản**. | • Staff created with same `tenantId`.<br>• Staff can log in to `/staff/dashboard`. | • Tenant Admin is `ACTIVE`. |
| TC_TAD_002 | Tenant Staff cannot access account management | 1. Log in as Tenant Staff.<br>2. Navigate to `/staff/accounts`. | • Access denied or redirect.<br>• HTTP `403` on account create API. | • Tenant Staff account exists. |
| TC_TAD_003 | View contract successfully | 1. Log in as Tenant Admin.<br>2. Navigate to `/staff/contracts`.<br>3. Click a contract row to view detail. | • Active contract details shown.<br>• Contract type, dates, warehouse visible. | • Active contract for tenant. |
| TC_TAD_004 | Create new rental request | 1. Navigate to `/staff/rental-requests` or landing `/`.<br>2. Fill **Tạo yêu cầu thuê mới** form (volume, contract type).<br>3. Click **Tạo yêu cầu**. | • Rental request created with status `PENDING`.<br>• Success confirmation shown. | • Tenant Admin is `ACTIVE`. |

## **SKU Management** (#40–#42)

| Test Case ID | Test Case Description | Test Case Procedure | Expected Results | Pre-conditions |
|--------------|----------------------|---------------------|------------------|----------------|
| TC_TAD_005 | Create SKU successfully | 1. Navigate to `/staff/products`.<br>2. Click **THÊM SKU** → enter **Mã SKU**, name, category, season.<br>3. Click **Lưu**. | • Success message: **"Đã thêm SKU"**.<br>• SKU appears in product list.<br>• `skuCode` unique within tenant. | • Categories/seasons seeded.<br>• Contract active. |
| TC_TAD_006 | Create SKU fails with duplicate code | 1. Click **THÊM SKU** and enter an existing **Mã SKU** in the same tenant. | • HTTP `409` or validation error.<br>• **"SKU code already exists in this tenant."** | • Duplicate skuCode exists. |
| TC_TAD_007 | Update SKU successfully | 1. Click **Sửa SKU** on an existing SKU.<br>2. Update name or movement category → click **Lưu**. | • Success message: **"Đã cập nhật SKU"**.<br>• Changes persisted. | • SKU exists, no delete constraint. |
| TC_TAD_008 | Delete SKU successfully (soft disable) | 1. Click **Xóa** on a SKU with zero inventory. | • SKU `isActive = false`.<br>• Removed from active list. | • SKU has no inventory. |
| TC_TAD_009 | Delete SKU blocked when inventory exists | 1. Attempt to click **Xóa** on a SKU with stock. | • HTTP `400`.<br>• **"Cannot delete SKU with existing inventory."** | • SKU has inventory > 0. |

## **Inbound & Outbound** (#43–#44)

| Test Case ID | Test Case Description | Test Case Procedure | Expected Results | Pre-conditions |
|--------------|----------------------|---------------------|------------------|----------------|
| TC_TAD_010 | Create inbound request successfully | 1. Navigate to `/staff/inbound/new`.<br>2. Select active contract, SKUs, and quantities.<br>3. Submit the form. | • Inbound status = `PENDING`.<br>• Items saved correctly. | • Active contract.<br>• SKUs exist. |
| TC_TAD_011 | Create inbound fails without active contract | 1. Attempt to create inbound when no ACTIVE contract exists. | • HTTP `400`.<br>• **"Contract must be ACTIVE."** | • No active contract. |
| TC_TAD_012 | Create outbound request successfully | 1. `POST /api/outbound-requests` with valid items (Swagger). | • Outbound status = `PENDING`. | • Active contract.<br>• Sufficient inventory. |
| TC_TAD_013 | Create outbound fails — insufficient inventory | 1. Request quantity > available stock. | • HTTP `400`.<br>• **"INSUFFICIENT_INVENTORY"**. | • Low or zero stock for SKU. |

## **View Data** (#45–#47)

| Test Case ID | Test Case Description | Test Case Procedure | Expected Results | Pre-conditions |
|--------------|----------------------|---------------------|------------------|----------------|
| TC_TAD_014 | View tenant inventory | 1. `/staff/inventory`. | • Shows only current tenant's stock.<br>• Cannot see other tenant data. | • Inventory exists for tenant. |
| TC_TAD_015 | View invoice (API pending) | 1. Attempt invoice view. | • **Not yet implemented** — document for future sprint. | • Billing API pending. |
| TC_TAD_016 | View tenant reports | 1. Open dashboard or reports (if available). | • Tenant-scoped summary visible. | • Tenant Admin is `ACTIVE`. |
| TC_TAD_017 | Tenant Admin cannot approve own inbound | 1. PATCH inbound to `APPROVED` as Tenant Admin. | • HTTP `403 Forbidden`. | • Pending inbound exists. |

---

# Warehouse Staff — Test Cases (#48–#55)

> **Role**: `WH_STAFF`

## **Inbound Operations** (#48–#51)

| Test Case ID | Test Case Description | Test Case Procedure | Expected Results | Pre-conditions |
|--------------|----------------------|---------------------|------------------|----------------|
| TC_WHST_001 | Mark inbound arrived (tenant self-delivery) | 1. Log in as WH Staff.<br>2. Open inbound detail (`/staff/inbound-ops/{id}`) for **Tự giao** (`TENANT_SELF`) inbound with status `APPROVED`.<br>3. Enter vehicle plate → click **Báo đã đến kho**. | • Status → `ARRIVED`.<br>• `actualArrivalAt` recorded. | • Inbound approved.<br>• Delivery info saved. |
| TC_WHST_002 | Start receiving and record quantity | 1. Click **Bắt đầu nhận hàng**.<br>2. Enter **Số lượng thực nhận** for each SKU line.<br>3. Click **Hoàn tất kiểm đếm**. | • Status → `RECEIVING`.<br>• Quantities saved.<br>• Discrepancy flagged if mismatch. | • Inbound `ARRIVED` or `APPROVED`. |
| TC_WHST_003 | Create batch successfully | 1. Enter **Mã batch**.<br>2. Create batch for the inbound being received. | • Batch linked to inbound.<br>• `warehouseReceivedAt` set. | • Inbound in receiving state. |
| TC_WHST_004 | Create LPN and add SKU details | 1. Create LPN with box type.<br>2. Add SKU quantities to LPN. | • LPN code generated.<br>• LPN status `RECEIVING`. | • Batch exists. |
| TC_WHST_005 | Put-away LPN to bin successfully | 1. Select LPN to put away.<br>2. Select target bin in **Putaway** section.<br>3. Click **Putaway 1 LPN (thủ công)** or **Putaway tự động**. | • LPN `currentBinId` updated.<br>• LPN status → `STORED`.<br>• Inventory increased.<br>• Bin volume updated. | • LPN created.<br>• Available bin exists. |
| TC_WHST_006 | Complete inbound after all put-away | 1. Put away all LPNs.<br>2. Click **Hoàn tất inbound**. | • Inbound status → `COMPLETED`. | • All LPNs stored. |

## **Outbound Operations** (#52–#53)

| Test Case ID | Test Case Description | Test Case Procedure | Expected Results | Pre-conditions |
|--------------|----------------------|---------------------|------------------|----------------|
| TC_WHST_007 | Execute outbound picking | 1. Open outbound detail in `RESERVED`/`PICKING` status.<br>2. Confirm pick quantities per task (API/UI). | • Status → `PICKING`.<br>• Picked qty recorded. | • Outbound approved and reserved. |
| TC_WHST_008 | Pack and create shipment | 1. Mark outbound `PACKING` then `SHIPPED`.<br>2. Enter tracking number. | • Status → `SHIPPED`.<br>• Shipment record created. | • Picking completed. |

## **Inventory & Damage** (#54–#55)

| Test Case ID | Test Case Description | Test Case Procedure | Expected Results | Pre-conditions |
|--------------|----------------------|---------------------|------------------|----------------|
| TC_WHST_009 | View warehouse inventory | 1. `/staff/inventory-ops`. | • Full warehouse inventory visible (all tenants in WH). | • Inventory records exist. |
| TC_WHST_010 | Report damaged inventory (pending) | 1. Attempt damage report flow. | • **Not yet implemented** — use discrepancy on receive (#49) as workaround. | • Damage module pending. |
| TC_WHST_011 | WH Staff cannot approve inbound | 1. PATCH inbound to `APPROVED` as WH Staff. | • HTTP `403 Forbidden`. | • Pending inbound exists. |
| TC_WHST_012 | WH Staff cannot create SKU | 1. `POST /api/skus` as WH Staff. | • HTTP `403 Forbidden`. | • WH Staff is `ACTIVE`. |

---

# Tenant Staff — Test Cases (#56–#62)

> **Role**: `TENANT_STAFF`

## **Inbound & Outbound** (#56–#58)

| Test Case ID | Test Case Description | Test Case Procedure | Expected Results | Pre-conditions |
|--------------|----------------------|---------------------|------------------|----------------|
| TC_TST_001 | Create inbound request successfully | 1. Log in as Tenant Staff.<br>2. Navigate to `/staff/inbound/new` → submit form. | • Same result as TC_TAD_010.<br>• Status `PENDING`. | • Active contract.<br>• SKUs exist. |
| TC_TST_002 | Create outbound request (API) | 1. Tenant Staff calls `POST /api/outbound-requests`. | • Outbound created if inventory sufficient. | • Same as TC_TAD_012. |
| TC_TST_003 | View inbound and outbound status | 1. Navigate to `/staff/inbound` → open detail → check timeline.<br>2. List outbounds via API. | • Status timeline visible.<br>• Read-only — no approve buttons. | • Requests exist for tenant. |
| TC_TST_004 | Tenant Staff cannot access account page | 1. Navigate to `/staff/accounts`. | • Access denied. | • Tenant Staff is `ACTIVE`. |

## **SKU Management** (#59–#60)

| Test Case ID | Test Case Description | Test Case Procedure | Expected Results | Pre-conditions |
|--------------|----------------------|---------------------|------------------|----------------|
| TC_TST_005 | Create SKU successfully | 1. Navigate to `/staff/products` → click **THÊM SKU**. | • SKU created (same as TC_TAD_005). | • Categories seeded. |
| TC_TST_006 | Update SKU successfully | 1. Click **Sửa SKU** on products page → click **Lưu**. | • Update persisted. | • SKU exists. |
| TC_TST_007 | Tenant Staff cannot delete SKU | 1. Attempt `DELETE /api/skus/{id}` as Tenant Staff. | • HTTP `403 Forbidden` (if restricted) OR UI hides delete — per product policy.<br>• SKU remains active. | • SKU exists.<br>• *Note: align with BE policy — Tenant Staff typically has no delete.* |

## **View Data** (#61–#62)

| Test Case ID | Test Case Description | Test Case Procedure | Expected Results | Pre-conditions |
|--------------|----------------------|---------------------|------------------|----------------|
| TC_TST_008 | View tenant inventory | 1. `/staff/inventory`. | • Tenant-scoped inventory only. | • Inventory exists. |
| TC_TST_009 | View invoice (API pending) | 1. Attempt invoice view. | • **Not yet implemented**. | • Billing pending. |
| TC_TST_010 | Tenant Staff cannot create rental request | 1. `POST /api/rental-requests` as Tenant Staff. | • HTTP `403` or UI not available for this role. | • Tenant Staff is `ACTIVE`. |
| TC_TST_011 | Tenant Staff cannot manage warehouse inbound ops | 1. Navigate to `/staff/inbound-ops`. | • No receive/put-away actions or access denied for warehouse ops mode. | • Tenant Staff is `ACTIVE`. |

---

# Warehouse Transporter — Test Cases (#63–#66)

> **Role**: `WH_TRANSPORTER` (Warehouse Transporter)

### Test data setup (transporter)

| Item | Value |
|------|-------|
| Warehouse Admin | `whadmin@warehouse.local` / `WhAdmin@12345` |
| Warehouse Transporter | Created by WH Admin — e.g. `transporter@warehouse.local` |
| Tenant Admin | `tenant1admin@brand.local` / `Tenant1@12345` |
| Inbound type | `deliveryMode = WAREHOUSE_TRANSPORT` |
| Trip assignment | WH Admin assigns transporter via inbound delivery (#29) |

---

## **View Assigned Delivery Trips** (Function #63)

| Test Case ID | Test Case Description | Test Case Procedure | Expected Results | Pre-conditions |
|--------------|----------------------|---------------------|------------------|----------------|
| TC_WHTR_001 | View assigned delivery trips successfully | 1. Log in as Warehouse Transporter.<br>2. System redirects to **Chuyến vận chuyển của tôi** (`/staff/my-deliveries`).<br>3. Observe the trip list. | • Page title: **Chuyến vận chuyển của tôi**.<br>• Only inbounds assigned to the logged-in transporter are shown.<br>• Each row shows inbound code, expected arrival date, and status. | • Transporter account exists and is `ACTIVE`.<br>• At least one inbound with `deliveryMode = WAREHOUSE_TRANSPORT` is assigned to this transporter.<br>• Inbound status is `APPROVED` or later. |
| TC_WHTR_002 | Empty state when no trips are assigned | 1. Log in as a newly created Transporter (no trips assigned).<br>2. Navigate to **Chuyến vận chuyển của tôi** (`/staff/my-deliveries`). | • Empty message: **"Chưa có chuyến nào được gán."**<br>• No inbound rows displayed. | • Transporter account exists and is `ACTIVE`.<br>• No inbound delivery record has `assignedDriverUserId` = this user. |
| TC_WHTR_003 | Non-transporter cannot use assigned-to-me filter | 1. Log in as Warehouse Staff.<br>2. Call API `GET /api/inbound-requests?assignedToMe=true` (via Swagger or network tab). | • System returns HTTP `403 Forbidden`.<br>• Error message: **"assignedToMe requires WH_TRANSPORTER"**. | • WH Staff account exists and is `ACTIVE`. |
| TC_WHTR_004 | Transporter cannot see unassigned warehouse-transport trips | 1. Log in as Transporter A.<br>2. WH Admin assigns a `WAREHOUSE_TRANSPORT` inbound to Transporter B only.<br>3. Transporter A opens **Chuyến vận chuyển của tôi**. | • Inbound assigned to Transporter B does **not** appear in Transporter A's list. | • Two transporter accounts exist in the same warehouse.<br>• One inbound is assigned only to Transporter B. |

---

## **View Inbound Trip Detail** (Function #64)

| Test Case ID | Test Case Description | Test Case Procedure | Expected Results | Pre-conditions |
|--------------|----------------------|---------------------|------------------|----------------|
| TC_WHTR_005 | View inbound trip detail successfully | 1. Log in as Warehouse Transporter.<br>2. On **Chuyến vận chuyển của tôi**, click an inbound code.<br>3. Review the detail page. | • Detail page opens at `/staff/my-deliveries/{inboundRequestId}`.<br>• Inbound code, status, expected arrival, SKU lines, and delivery section are shown.<br>• Delivery info reflects data saved by WH Admin or transporter. | • Trip is assigned to the logged-in transporter.<br>• Inbound `deliveryMode = WAREHOUSE_TRANSPORT`. |
| TC_WHTR_006 | Access denied for trip not assigned to transporter | 1. Log in as Transporter A.<br>2. Manually navigate to `/staff/my-deliveries/{inboundRequestId}` of a trip assigned to Transporter B. | • HTTP `403 Forbidden` or access denied on UI.<br>• Error message: **"Trip is not assigned to you"**. | • Inbound exists and is assigned to another transporter. |
| TC_WHTR_007 | Transporter cannot open tenant-self inbound trip | 1. Tenant creates inbound with **Tự giao** type (`TENANT_SELF`).<br>2. Log in as Warehouse Transporter.<br>3. Attempt to open that inbound detail URL directly. | • Trip does not appear in assigned list.<br>• Direct API access returns error: **"This inbound is not warehouse transport"** (if delivery record exists). | • Inbound `deliveryMode = TENANT_SELF`.<br>• Inbound is not assigned to transporter. |

---

## **Update Vehicle & Driver Info** (Function #65)

| Test Case ID | Test Case Description | Test Case Procedure | Expected Results | Pre-conditions |
|--------------|----------------------|---------------------|------------------|----------------|
| TC_WHTR_008 | Update vehicle and driver info successfully | 1. Log in as assigned Transporter.<br>2. Open trip detail (status `APPROVED`).<br>3. Enter **Biển số xe**, driver name/phone, carrier.<br>4. Click **Lưu thông tin xe**. | • Success message: **"Đã lưu thông tin vận chuyển"**.<br>• Vehicle info saved.<br>• Inbound status remains `APPROVED`. | • Trip assigned to logged-in transporter.<br>• Inbound status = `APPROVED`. |
| TC_WHTR_009 | Save fails when vehicle plate is empty | 1. Log in as assigned Transporter.<br>2. Open trip detail (`APPROVED`).<br>3. Clear **Biển số xe** field.<br>4. Click **Lưu thông tin xe**. | • Error message: **"Nhập biển số xe trước khi lưu"** (or equivalent).<br>• Delivery record is not updated. | • Trip assigned to logged-in transporter.<br>• Inbound status = `APPROVED`. |
| TC_WHTR_010 | Transporter cannot reassign driver to another user | 1. Log in as assigned Transporter.<br>2. Call `PUT /api/inbound-requests/{id}/delivery` with `{ "assignedDriverUserId": "<other-user-uuid>" }`. | • HTTP `403 Forbidden`.<br>• Error message: **"Transporter cannot reassign driver"**. | • Trip assigned to logged-in transporter. |
| TC_WHTR_011 | Update blocked when inbound status is not APPROVED | 1. Log in as assigned Transporter.<br>2. Open trip detail already in `ARRIVED` or `RECEIVING` status.<br>3. Attempt to edit and click **Lưu thông tin xe**. | • HTTP `400 Bad Request`.<br>• Error indicates invalid inbound status for delivery update.<br>• Delivery fields are not changed. | • Trip was previously reported as arrived (#66). |
| TC_WHTR_012 | Inactive transporter cannot be assigned (WH Admin side) | 1. System Admin deactivates transporter via **Vô hiệu hóa** on `/admin/accounts`.<br>2. WH Admin opens inbound detail → delivery section → attempts to assign that transporter. | • HTTP `400 Bad Request`.<br>• Error message: **"Transporter account is not active"**. | • Transporter user exists with status `INACTIVE`. |

---

## **Report Arrival at Warehouse** (Function #66)

| Test Case ID | Test Case Description | Test Case Procedure | Expected Results | Pre-conditions |
|--------------|----------------------|---------------------|------------------|----------------|
| TC_WHTR_013 | Report arrival at warehouse successfully | 1. Log in as assigned Transporter.<br>2. Open trip detail (`APPROVED`) with vehicle plate saved (#65).<br>3. Click **Báo đã đến kho**. | • Success message displayed.<br>• Inbound status: `APPROVED` → `ARRIVED`.<br>• `actualArrivalAt` recorded.<br>• WH Staff can continue receiving (#49). | • Trip assigned to logged-in transporter.<br>• Inbound status = `APPROVED`.<br>• Vehicle plate is saved on delivery record. |
| TC_WHTR_014 | Report arrival fails without vehicle plate | 1. Log in as assigned Transporter.<br>2. Open trip detail without saved vehicle plate.<br>3. Click **Báo đã đến kho**. | • HTTP `400 Bad Request`.<br>• Error indicates vehicle plate must be saved first.<br>• Inbound status remains `APPROVED`. | • Trip assigned to logged-in transporter.<br>• Delivery record has no `vehiclePlate`. |
| TC_WHTR_015 | Report arrival fails when status is not APPROVED | 1. Log in as assigned Transporter.<br>2. Open trip detail already in `ARRIVED` status.<br>3. Call `POST /api/inbound-requests/{id}/report-arrival` again. | • HTTP `400 Bad Request`.<br>• Error indicates invalid status transition.<br>• Status stays `ARRIVED`. | • Arrival was already reported once. |
| TC_WHTR_016 | Warehouse Staff cannot use report-arrival endpoint | 1. Log in as Warehouse Staff.<br>2. Call `POST /api/inbound-requests/{id}/report-arrival` for a TENANT_SELF inbound. | • System returns HTTP `403 Forbidden`.<br>• Error message: **"WH_TRANSPORTER only"**. | • WH Staff account is `ACTIVE`.<br>• Valid inbound exists. |
| TC_WHTR_017 | Unassigned transporter cannot report arrival | 1. Log in as Transporter A.<br>2. Call report-arrival API for inbound assigned to Transporter B. | • System returns HTTP `403 Forbidden`.<br>• Error message: **"Trip is not assigned to you"**. | • Inbound assigned to a different transporter. |

---

## **Authentication & Navigation**

| Test Case ID | Test Case Description | Test Case Procedure | Expected Results | Pre-conditions |
|--------------|----------------------|---------------------|------------------|----------------|
| TC_WHTR_018 | Transporter login redirects to my deliveries | 1. Navigate to `/login`.<br>2. Enter Transporter email/password.<br>3. Click login. | • Login succeeds.<br>• Redirects to `/staff/my-deliveries`.<br>• Sidebar shows **Chuyến vận chuyển của tôi**. | • Transporter account exists and is `ACTIVE`. |
| TC_WHTR_019 | Transporter cannot access admin pages | 1. Log in as Warehouse Transporter.<br>2. Manually navigate to `/admin/inbound` or `/admin/accounts`. | • System redirects to login or shows **403 / Access denied**.<br>• Admin pages are not accessible. | • Transporter account is `ACTIVE`. |

---

## **End-to-end flow (happy path)**

| Test Case ID | Test Case Description | Test Case Procedure | Expected Results | Pre-conditions |
|--------------|----------------------|---------------------|------------------|----------------|
| TC_WHTR_E2E_001 | Complete warehouse-transport inbound pickup flow | 1. Tenant Admin creates inbound with `WAREHOUSE_TRANSPORT` (#43).<br>2. WH Admin approves inbound (#33).<br>3. WH Admin assigns transporter (#29).<br>4. Transporter updates vehicle info (#65).<br>5. Transporter reports arrival (#66).<br>6. WH Staff starts receiving (#49). | • Step 4: delivery info saved.<br>• Step 5: inbound status = `ARRIVED`.<br>• Step 6: WH Staff can receive goods without transporter involvement.<br>• Full chain completes without permission errors. | • Active contract exists.<br>• SKU and transporter account exist.<br>• WH Admin, Transporter, and WH Staff accounts are `ACTIVE`. |

---

## **Full system end-to-end (all roles)**

| Test Case ID | Test Case Description | Test Case Procedure | Expected Results | Pre-conditions |
|--------------|----------------------|---------------------|------------------|----------------|
| TC_E2E_001 | Complete inbound-to-inventory flow | 1. Guest/Tenant submits rental → WH Admin approves → contract ACTIVE (#20, #30, #31).<br>2. Tenant Admin creates SKU (#40) and inbound (#43).<br>3. WH Admin approves inbound (#33).<br>4. WH Staff receives, creates LPN, put-away (#49–#51).<br>5. Tenant views inventory (#45). | • Inbound `COMPLETED`.<br>• Inventory reflects received quantities.<br>• Tenant sees updated stock. | • All role accounts `ACTIVE`. |
| TC_E2E_002 | Complete outbound flow | 1. After TC_E2E_001 inventory exists.<br>2. Tenant creates outbound (#44).<br>3. WH Admin approves (#35).<br>4. WH Staff picks and ships (#52–#53).<br>5. Tenant views reduced inventory. | • Outbound reaches `SHIPPED` or `COMPLETED`.<br>• Inventory decreased accordingly. | • Sufficient stock from prior inbound. |

---

# User Account Status — Active / Inactive User

> **Actor**: `SYSTEM_ADMIN` (toggle on FE); `PATCH /api/users/:userId` with `{ "status": "ACTIVE" \| "INACTIVE" }`  
> **Screen**: `/admin/accounts` (System Admin only — activate/deactivate icon)  
> **Reference**: `src/services/user.service.js`, `src/services/auth.service.js`, `ManageAccount.tsx`

---

## **Inactive User**

| Test Case ID | Test Case Description | Test Case Procedure | Expected Results | Pre-conditions |
|--------------|----------------------|---------------------|------------------|----------------|
| TC_Inactive_User_001 | Deactivate active user successfully | 1. Log in as System Admin.<br>2. Navigate to `/admin/accounts`.<br>3. Find an **Đang hoạt động** user (not yourself).<br>4. Click **Vô hiệu hóa** icon (`person_off`).<br>5. Confirm dialog **Vô hiệu hóa tài khoản**. | • Success message: **"Đã vô hiệu hóa tài khoản {name}."**<br>• Status badge → **Vô hiệu hóa** / `INACTIVE`.<br>• **Đang hoạt động** count decreases by 1. | • System Admin account is `ACTIVE`.<br>• Target user exists with status `ACTIVE`.<br>• Target user is not the logged-in admin. |
| TC_Inactive_User_002 | Deactivated user cannot log in | 1. Complete TC_Inactive_User_001.<br>2. Log out System Admin.<br>3. Attempt to log in with the deactivated user's email and password. | • Login fails with HTTP `403 Forbidden`.<br>• Error message: **"Account is not active"** (`ACCOUNT_INACTIVE`).<br>• No access token is issued. | • Target user status = `INACTIVE` after step 001. |
| TC_Inactive_User_003 | Admin cannot deactivate own account | 1. Log in as System Admin.<br>2. On `/admin/accounts`, find your own row.<br>3. Attempt to click **Vô hiệu hóa** or call API `PATCH` with status `INACTIVE`. | • FE: warning **"Bạn không thể tự vô hiệu hóa tài khoản của chính mình."** (or button hidden).<br>• API: HTTP `403` — **"Cannot deactivate your own account"**.<br>• Admin remains `ACTIVE`. | • System Admin is logged in. |
| TC_Inactive_User_004 | Non–System Admin cannot deactivate users | 1. Log in as WH Admin or Tenant Admin.<br>2. Navigate to `/admin/accounts` or `/staff/accounts`.<br>3. Observe action buttons on user rows. | • **Vô hiệu hóa** / **Kích hoạt** icons are **not displayed** (System Admin only).<br>• Direct API call for out-of-scope user: HTTP `404` — **"User not found"**. | • WH Admin or Tenant Admin account is `ACTIVE`. |
| TC_Inactive_User_005 | Deactivate non-existent user returns error | 1. Log in as System Admin.<br>2. Call `PATCH /api/users/00000000-0000-4000-8000-000000000099` with `{ "status": "INACTIVE" }`. | • HTTP `404 Not Found`.<br>• Error message: **"User not found"**.<br>• No user record is modified. | • Invalid or non-existent `userId`. |

---

## **Active User**

| Test Case ID | Test Case Description | Test Case Procedure | Expected Results | Pre-conditions |
|--------------|----------------------|---------------------|------------------|----------------|
| TC_Active_User_001 | Reactivate inactive user successfully | 1. Log in as System Admin.<br>2. Navigate to `/admin/accounts`.<br>3. Find a **Vô hiệu hóa** user (`INACTIVE`).<br>4. Click **Kích hoạt** icon (`how_to_reg`).<br>5. Confirm dialog **Kích hoạt tài khoản**. | • Success message: **"Đã kích hoạt tài khoản {name}."**<br>• Badge → **Đang hoạt động** / `ACTIVE`. | • Target user exists with status `INACTIVE`.<br>• System Admin is logged in. |
| TC_Active_User_002 | Reactivated user can log in successfully | 1. Complete TC_Active_User_001.<br>2. Log out System Admin.<br>3. Log in with the reactivated user's email and password. | • Login succeeds.<br>• User is redirected to the home page for their role.<br>• Valid `accessToken` is returned. | • Target user status = `ACTIVE` after step 001. |
| TC_Active_User_003 | Reactivate non-existent user returns error | 1. Log in as System Admin.<br>2. Call `PATCH /api/users/00000000-0000-4000-8000-000000000099` with `{ "status": "ACTIVE" }`. | • HTTP `404 Not Found`.<br>• Error message: **"User not found"**. | • Invalid or non-existent `userId`. |
| TC_Active_User_004 | WH Admin cannot reactivate BLOCKED user | 1. Ensure a user has status `BLOCKED` (set via DB or System Admin if supported).<br>2. Log in as Warehouse Admin.<br>3. Attempt `PATCH /api/users/{blockedUserId}` with `{ "status": "ACTIVE" }` for a user in WH Admin scope. | • HTTP `403 Forbidden`.<br>• Error message: **"Cannot reactivate blocked user"**.<br>• User status remains `BLOCKED`. | • User exists with status `BLOCKED`.<br>• WH Admin has scope over that user. |
| TC_Active_User_005 | Inactive transporter cannot be assigned after deactivation | 1. Deactivate a WH_TRANSPORTER user (TC_Inactive_User_001) via **Vô hiệu hóa**.<br>2. Log in as WH Admin.<br>3. Open inbound detail → delivery section → attempt to assign that transporter. | • HTTP `400 Bad Request`.<br>• Error message: **"Transporter account is not active"**.<br>• Transporter is not saved on delivery record. | • Transporter was `ACTIVE` then set to `INACTIVE`.<br>• WAREHOUSE_TRANSPORT inbound exists. |

---

## Test case index summary

| Role / Module | ID prefix | Count | Functions covered |
|---------------|-----------|-------|-------------------|
| System Admin | `TC_SYS_` | 15 | #1, #5–#11 |
| **Update Warehouse** | `TC_Update_Warehouse_` | 8 | #2 — System Admin |
| **Delete Warehouse** | `TC_Delete_Warehouse_` | 5 | Delete — System Admin only |
| Warehouse Admin | `TC_WHAD_` | 27 | #12–#36 |
| Tenant Admin | `TC_TAD_` | 17 | #37–#47 |
| Warehouse Staff | `TC_WHST_` | 12 | #48–#55 |
| Tenant Staff | `TC_TST_` | 11 | #56–#62 |
| Warehouse Transporter | `TC_WHTR_` | 20 | #63–#66 |
| **Inactive User** | `TC_Inactive_User_` | 5 | Deactivate account |
| **Active User** | `TC_Active_User_` | 5 | Reactivate account |
| End-to-end | `TC_E2E_` / `TC_*_E2E_` | 3 | Cross-role flows |
| **Total** | | **128** | **#1–#66 + warehouse CRUD + account status** |

> Cases marked **Not yet implemented** cover invoice (#10, #24, #46, #62), damage (#54), and partial outbound UI — update to full pass criteria when APIs/screens are ready.
