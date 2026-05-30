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

### Quy ước cột **Test Case Procedure** (FE tiếng Việt)

- **Test Case Description** và **Expected Results**: tiếng Anh (chuẩn doc).
- **Thao tác trên FE**: dùng đúng **nhãn tiếng Việt** (nút, menu, popup, toast).
- **Thao tác API**: giữ tên endpoint / method.
- Ví dụ: *Chọn nút **Chỉnh sửa*** thay vì *Click **Edit***; kỳ vọng: **"Cập nhật thành công."**

---

# System Admin — Test Cases (#1–#11)

> **Role**: `SYSTEM_ADMIN`

## **Create Warehouse** (#1)

| Test Case ID | Test Case Description | Test Case Procedure | Expected Results | Pre-conditions |
|--------------|----------------------|---------------------|------------------|----------------|
| TC_SYS_001 | Create warehouse successfully | 1. Đăng nhập bằng tài khoản System Admin.<br>2. Truy cập trang **Quản lý kho** (`/admin/warehouse`).<br>3. Chọn nút **TẠO KHO**.<br>4. Trong popup **Tạo kho**, nhập **Mã kho**, **Tên kho**, **Tỉnh/Thành phố**, **Quận/Huyện**, diện tích (nếu có).<br>5. Bấm **Tạo kho**. | • Thông báo: **"Tạo kho thành công."**<br>• Kho mới hiển thị trong danh sách, trạng thái `ACTIVE`. | • Tài khoản System Admin đang `ACTIVE`. |
| TC_SYS_002 | Create warehouse fails with duplicate code | 1. Đăng nhập System Admin.<br>2. Chọn **TẠO KHO** và nhập **Mã kho** đã tồn tại.<br>3. Bấm **Tạo kho**. | • HTTP `409 Conflict`, code `DUPLICATE`.<br>• Thông báo lỗi: mã kho đã tồn tại.<br>• Không tạo bản ghi trùng. | • Đã có kho với cùng `warehouseCode`. |
| TC_SYS_002E | Create warehouse fails — missing required fields | 1. Đăng nhập System Admin.<br>2. Mở popup **Tạo kho**, để trống **Mã kho** hoặc **Tên kho**.<br>3. Bấm **Tạo kho**. | • HTTP `400 Bad Request`.<br>• Thông báo: **"warehouseCode is required"** hoặc **"warehouseName is required"**. | • System Admin đã đăng nhập. |
| TC_SYS_002F | Non–System Admin cannot create warehouse | 1. Đăng nhập WH Admin.<br>2. Gọi API `POST /api/warehouses` (Swagger). | • HTTP `403 Forbidden`.<br>• Thông báo: **"SYSTEM_ADMIN only"**. | • WH Admin đang `ACTIVE`. |

---

## **Update Warehouse** (#2)

| Test Case ID | Test Case Description | Test Case Procedure | Expected Results | Pre-conditions |
|--------------|----------------------|---------------------|------------------|----------------|
| TC_Update_Warehouse_001 | Update warehouse information successfully | 1. Đăng nhập bằng tài khoản System Admin.<br>2. Truy cập trang **Quản lý kho** (`/admin/warehouse`).<br>3. Chọn nút **Chỉnh sửa** (icon edit) trên một kho trong danh sách.<br>4. Trong popup **Chỉnh sửa kho**, sửa **Tên kho**, **Địa chỉ**, **Tỉnh/Thành phố**, **Quận/Huyện**.<br>5. Bấm **Cập nhật**. | • Thông báo: **"Cập nhật thành công."**<br>• Dữ liệu mới hiển thị sau khi tải lại trang.<br>• **Mã kho** không đổi. | • Kho đích đã tồn tại. |
| TC_Update_Warehouse_002 | Update warehouse status and area fields | 1. Đăng nhập System Admin.<br>2. Chọn **Chỉnh sửa** trên một kho.<br>3. Đổi **Trạng thái** sang **Bảo trì** (`MAINTENANCE`).<br>4. Nhập **Tổng diện tích** = 5000, **Diện tích sử dụng** = 4500 (m²).<br>5. Bấm **Cập nhật**. | • Trạng thái và diện tích được lưu.<br>• API `PATCH /api/warehouses/{id}` trả về bản ghi đã cập nhật. | • Kho tồn tại.<br>• Tổng diện tích zone ≤ 4500 m² (nếu đã có zone). |
| TC_Update_Warehouse_003 | Warehouse code is read-only on edit | 1. Đăng nhập System Admin.<br>2. Chọn **Chỉnh sửa** trên một kho.<br>3. Quan sát trường **Mã kho** trong popup **Chỉnh sửa kho**.<br>4. Sửa các trường khác, bấm **Cập nhật**. | • Trường **Mã kho** bị **disabled** (không sửa được).<br>• Sau khi lưu, **Mã kho** trên danh sách giữ nguyên. | • Kho có mã đã biết. |
| TC_Update_Warehouse_004 | Update fails — empty warehouse name | 1. Đăng nhập System Admin.<br>2. Chọn **Chỉnh sửa** → xóa hết **Tên kho**.<br>3. Bấm **Cập nhật**. | • HTTP `400 Bad Request`.<br>• Thông báo: **"warehouseName cannot be empty"**.<br>• Dữ liệu kho không đổi. | • Kho tồn tại. |
| TC_Update_Warehouse_005 | Update fails — usable area exceeds total area | 1. Đăng nhập System Admin.<br>2. Gọi API `PATCH /api/warehouses/{id}` với `{ "totalAreaM2": 1000, "usableAreaM2": 1500 }`. | • HTTP `400`, code `AREA_EXCEEDS_TOTAL`.<br>• Thông báo: diện tích sử dụng không được lớn hơn tổng diện tích.<br>• Không cập nhật. | • Kho tồn tại. |
| TC_Update_Warehouse_006 | Update fails — usable area less than existing zone area | 1. Dùng kho có tổng diện tích zone = 800 m².<br>2. Gọi API `PATCH` với `{ "usableAreaM2": 500 }`. | • HTTP `400`, code `ZONE_AREA_EXCEEDS_USABLE`.<br>• Thông báo: tổng diện tích zone vượt diện tích sử dụng mới.<br>• `usableAreaM2` không giảm. | • Kho có zone tổng 800 m². |
| TC_Update_Warehouse_007 | Update fails — warehouse not found | 1. Đăng nhập System Admin.<br>2. Gọi API `PATCH /api/warehouses/00000000-0000-4000-8000-000000000099`. | • HTTP `404 Not Found`.<br>• Thông báo: **"Warehouse not found"**. | • `warehouseId` không hợp lệ. |
| TC_Update_Warehouse_008 | Update fails — empty PATCH body | 1. Đăng nhập System Admin.<br>2. Gọi API `PATCH /api/warehouses/{id}` với body `{}`. | • HTTP `400 Bad Request`.<br>• Thông báo: **"No valid fields to update"**. | • Kho hợp lệ tồn tại. |

---

## **Delete Warehouse** (System Admin)

| Test Case ID | Test Case Description | Test Case Procedure | Expected Results | Pre-conditions |
|--------------|----------------------|---------------------|------------------|----------------|
| TC_Delete_Warehouse_001 | Delete warehouse successfully | 1. Đăng nhập System Admin.<br>2. Tạo kho test **không có** zone, hợp đồng, user gắn kho.<br>3. Trên **Quản lý kho**, chọn nút **Xóa** (icon thùng rác) trên kho test.<br>4. Xác nhận hộp thoại **"Bạn có chắc muốn xóa kho ...?"**. | • Thông báo: **"Xóa thành công"**.<br>• Kho biến mất khỏi danh sách.<br>• `GET /api/warehouses/{id}` trả về `404`. | • Kho test không có dữ liệu phụ thuộc. |
| TC_Delete_Warehouse_002 | Delete fails — warehouse has related data | 1. Đăng nhập System Admin.<br>2. Chọn **Xóa** trên kho đã có zone / hợp đồng / WH Admin.<br>3. Xác nhận xóa. | • HTTP `400`, code `FK_VIOLATION`.<br>• Thông báo lỗi: còn dữ liệu liên quan.<br>• Kho vẫn còn trên danh sách. | • Kho có zone / contract / user. |
| TC_Delete_Warehouse_003 | Delete fails — warehouse not found | 1. Đăng nhập System Admin.<br>2. Gọi API `DELETE /api/warehouses/00000000-0000-4000-8000-000000000099`. | • HTTP `404 Not Found`.<br>• Thông báo: **"Warehouse not found"**. | • `warehouseId` không hợp lệ. |
| TC_Delete_Warehouse_004 | WH Admin cannot delete warehouse | 1. Đăng nhập WH Admin.<br>2. Truy cập **Quản lý kho** — kiểm tra không có nút **Xóa**.<br>3. Gọi API `DELETE /api/warehouses/{id}` qua Swagger. | • FE: không hiển thị icon xóa.<br>• API: HTTP `403 Forbidden` — **"SYSTEM_ADMIN only"**. | • WH Admin đang `ACTIVE`. |
| TC_Delete_Warehouse_005 | WH Admin cannot delete warehouse via API | 1. Đăng nhập WH Admin.<br>2. Gọi `DELETE` bất kỳ `warehouseId`. | • HTTP `403 Forbidden`.<br>• Kho không bị xóa. | • WH Admin đang `ACTIVE`. |

---

## **User Management** (#3, #4)

| Test Case ID | Test Case Description | Test Case Procedure | Expected Results | Pre-conditions |
|--------------|----------------------|---------------------|------------------|----------------|
| TC_SYS_004 | Create Warehouse Admin account successfully | 1. Đăng nhập bằng tài khoản System Admin.<br>2. Truy cập **Quản lý tài khoản** (`/admin/accounts`).<br>3. Chọn **Thêm tài khoản** → role **Quản trị kho** → chọn kho.<br>4. Bấm **Tạo tài khoản**. | • Thông báo: **"Tạo tài khoản thành công."**<br>• WH Admin mới đăng nhập và truy cập `/admin` đúng kho. | • At least one warehouse exists. |
| TC_SYS_005 | Create Tenant Admin account successfully | 1. Đăng nhập bằng tài khoản System Admin.<br>2. Truy cập **Quản lý tài khoản** (`/admin/accounts`).<br>3. Chọn **Thêm tài khoản** → role **Quản trị tenant** → chọn tenant.<br>4. Bấm **Tạo tài khoản**. | • Thông báo tạo tài khoản thành công.<br>• Tenant Admin chuyển tới `/staff/products` sau đăng nhập. | • Tenant company record exists. |
| TC_SYS_006 | WH Admin cannot create another WH Admin | 1. Đăng nhập bằng tài khoản Warehouse Admin.<br>2. Attempt `POST /api/users` with role `WH_ADMIN`. | • HTTP `403 Forbidden`.<br>• User is not created. | • WH Admin account is `ACTIVE`. |

## **Master Data** (#5)

| Test Case ID | Test Case Description | Test Case Procedure | Expected Results | Pre-conditions |
|--------------|----------------------|---------------------|------------------|----------------|
| TC_SYS_007 | View categories and seasons | 1. Đăng nhập bằng tài khoản System Admin.<br>2. Call `GET /api/categories` and `GET /api/seasons` via Swagger. | • Both endpoints return HTTP `200`.<br>• Response contains at least one category and one season (seed data). | • Database seeded. |
| TC_SYS_008 | Create category successfully | 1. Đăng nhập bằng tài khoản System Admin.<br>2. `POST /api/categories` with valid `categoryCode` and `categoryName`. | • HTTP `201 Created`.<br>• Category appears in subsequent GET list. | • System Admin token valid. |

## **Rental Request** (#6, #7)

| Test Case ID | Test Case Description | Test Case Procedure | Expected Results | Pre-conditions |
|--------------|----------------------|---------------------|------------------|----------------|
| TC_SYS_009 | Approve rental request successfully | 1. Có sẵn yêu cầu thuê trạng thái `PENDING`.<br>2. Đăng nhập System Admin.<br>3. Truy cập **Quản lý yêu cầu thuê** (`/admin/requests`).<br>4. Mở chi tiết yêu cầu → chọn **Duyệt & tiếp** (wizard onboarding). | • Trạng thái → `APPROVED`.<br>• Thông báo thành công.<br>• Yêu cầu sẵn sàng tạo hợp đồng. | • Pending rental request exists. |
| TC_SYS_010 | Reject rental request successfully | 1. Mở chi tiết yêu cầu thuê trạng thái `PENDING`.<br>2. Chọn **Từ chối** và nhập lý do. | • Status changes to `REJECTED`.<br>• Rejection reason is saved. | • Pending rental request exists. |

## **View All Data** (#8–#11)

| Test Case ID | Test Case Description | Test Case Procedure | Expected Results | Pre-conditions |
|--------------|----------------------|---------------------|------------------|----------------|
| TC_SYS_011 | View all tenants | 1. Đăng nhập bằng tài khoản System Admin.<br>2. Call `GET /api/tenant-companies`. | • HTTP `200`.<br>• List includes all tenant companies in system. | • At least one tenant exists. |
| TC_SYS_012 | View all contracts | 1. Đăng nhập bằng tài khoản System Admin.<br>2. Truy cập trang `/admin/contract`. | • Contract list loads for all tenants/warehouses.<br>• Filters work by status. | • At least one contract exists. |
| TC_SYS_013 | View all reports | 1. Đăng nhập bằng tài khoản System Admin.<br>2. Truy cập trang `/admin/reports`. | • Reports page loads without error.<br>• User can select report type and date range. | • System Admin account is `ACTIVE`. |
| TC_SYS_014 | View all invoices (API pending) | 1. Đăng nhập bằng tài khoản System Admin.<br>2. Attempt invoice list via API/UI. | • Document as **Not yet implemented** — verify via DB table `invoices` if needed for demo. | • Billing module not exposed yet. |

---

# Warehouse Admin — Test Cases (#12–#36)

> **Role**: `WH_ADMIN` · Login: `whadmin@warehouse.local`

## **Warehouse Structure** (#12–#16)

| Test Case ID | Test Case Description | Test Case Procedure | Expected Results | Pre-conditions |
|--------------|----------------------|---------------------|------------------|----------------|
| TC_WHAD_001 | Create warehouse zone successfully | 1. Đăng nhập WH Admin.<br>2. Truy cập **Quản lý zone** (`/admin/zones`).<br>3. Chọn **TẠO ZONE** → nhập **Mã zone**, **Tên zone**, **Loại zone**.<br>4. Bấm **Tạo zone**. | • Thông báo: **"Tạo zone thành công"**.<br>• Zone hiển thị trong danh sách kho được gán. | • WH Admin linked to warehouse. |
| TC_WHAD_002 | Create rack successfully | 1. Chọn một zone trong danh sách.<br>2. Truy cập **Quản lý rack** (`/admin/racks`).<br>3. Chọn **Thêm rack** → nhập **Mã rack**, **Tên rack**.<br>4. Bấm **Lưu**. | • Rack được tạo và liên kết với zone. | • Zone exists in WH Admin's warehouse. |
| TC_WHAD_003 | Create rack level successfully | 1. Chọn một rack.<br>2. Tạo tầng rack với **Số tầng**, **Mã tầng** (trong flow rack layout). | • Tầng rack được tạo dưới rack đã chọn. | • Rack exists. |
| TC_WHAD_004 | Create bin successfully | 1. Chọn tầng rack.<br>2. Chọn **Tạo bin** hoặc **Tạo bin hàng loạt** → nhập **Mã bin**, loại thùng, dung tích.<br>3. Bấm **Tạo bin**. | • Bin được tạo, trạng thái `AVAILABLE`. | • Rack level exists. |
| TC_WHAD_005 | Update warehouse structure successfully | 1. Chọn **Chỉnh sửa** trên zone/rack/bin.<br>2. Sửa tên hoặc trạng thái → bấm **Cập nhật** / **Lưu**.<br>3. Tải lại danh sách. | • Thay đổi được lưu.<br>• Thông báo thành công. | • Structure entity exists. |
| TC_WHAD_006 | WH Staff cannot create zone | 1. Đăng nhập bằng tài khoản WH Staff.<br>2. Attempt `POST /api/zones`. | • HTTP `403 Forbidden`. | • WH Staff account is `ACTIVE`. |

## **Account Management** (#17, #18)

| Test Case ID | Test Case Description | Test Case Procedure | Expected Results | Pre-conditions |
|--------------|----------------------|---------------------|------------------|----------------|
| TC_WHAD_007 | Create Warehouse Staff account | 1. Đăng nhập WH Admin.<br>2. Truy cập **Quản lý tài khoản** (`/admin/accounts`).<br>3. Chọn **Thêm tài khoản** → role **Nhân viên kho** (`WH_STAFF`).<br>4. Bấm **Tạo tài khoản** (không cần chọn kho — tự gán). | • Thông báo tạo tài khoản thành công.<br>• Staff đăng nhập → chuyển tới `/staff/inbound-ops`. | • WH Admin is `ACTIVE`. |
| TC_WHAD_008 | Create Transporter account | 1. Đăng nhập WH Admin.<br>2. **Quản lý tài khoản** → **Thêm tài khoản** → role **Tài xế kho** (`WH_TRANSPORTER`).<br>3. Bấm **Tạo tài khoản**. | • Tài xế được tạo cùng kho.<br>• Đăng nhập → chuyển tới **Chuyến vận chuyển của tôi** (`/staff/my-deliveries`). | • WH Admin is `ACTIVE`. |

## **Rental Request & Contract** (#19–#21, #30–#31)

| Test Case ID | Test Case Description | Test Case Procedure | Expected Results | Pre-conditions |
|--------------|----------------------|---------------------|------------------|----------------|
| TC_WHAD_009 | Review rental request | 1. Truy cập **Quản lý yêu cầu thuê** (`/admin/requests`).<br>2. Mở chi tiết yêu cầu → chuyển trạng thái sang **Đang xem xét** (`UNDER_REVIEW`). | • Trạng thái được cập nhật.<br>• Ghi chú xem xét được lưu (nếu có). | • Pending rental request exists. |
| TC_WHAD_010 | Approve rental request | 1. Mở yêu cầu đã xem xét.<br>2. Chọn **Duyệt & tiếp** trong wizard onboarding. | • Trạng thái = `APPROVED`. | • Request in reviewable state. |
| TC_WHAD_011 | Reject rental request | 1. Mở chi tiết yêu cầu thuê.<br>2. Chọn **Từ chối** và nhập lý do. | • Trạng thái = `REJECTED`. | • Pending request exists. |
| TC_WHAD_012 | Create contract successfully | 1. Truy cập **Quản lý hợp đồng** (`/admin/contract`).<br>2. Trong wizard onboarding, bước **Tạo hợp đồng** từ yêu cầu đã duyệt.<br>3. Nhập ngày bắt đầu/kết thúc, loại hợp đồng. | • Hợp đồng được tạo, trạng thái `DRAFT` hoặc `ACTIVE`.<br>• Liên kết tenant và kho. | • Approved rental request exists. |
| TC_WHAD_013 | Activate contract | 1. PATCH contract status to `ACTIVE`. | • Tenant can create inbound/outbound.<br>• Success message shown. | • Contract in `DRAFT`. |

## **Storage Reservation** (#32)

| Test Case ID | Test Case Description | Test Case Procedure | Expected Results | Pre-conditions |
|--------------|----------------------|---------------------|------------------|----------------|
| TC_WHAD_014 | Assign storage reservation to bin | 1. `POST /api/storage-reservations` with `contractId`, `binId`, `storageLevel=BIN`. | • Reservation created.<br>• Only one FK (bin) populated. | • Active contract exists.<br>• Available bin exists. |
| TC_WHAD_015 | Storage reservation fails with multiple FKs | 1. POST reservation with both `zoneId` and `binId`. | • HTTP `400 Validation Error`.<br>• Message indicates only one storage FK allowed. | • Active contract exists. |

## **Inbound / Outbound Approval** (#27–#29, #33–#36)

| Test Case ID | Test Case Description | Test Case Procedure | Expected Results | Pre-conditions |
|--------------|----------------------|---------------------|------------------|----------------|
| TC_WHAD_016 | View inbound request list | 1. Truy cập **Quản lý inbound** (`/admin/inbound`).<br>2. Lọc trạng thái `PENDING`. | • Danh sách inbound thuộc kho của WH Admin.<br>• Chỉ hiển thị inbound trong phạm vi kho. | • Pending inbound exists. |
| TC_WHAD_017 | Approve inbound request | 1. Mở chi tiết yêu cầu nhập kho (`/admin/inbound/{id}`).<br>2. Bấm **Duyệt** và xác nhận hộp thoại. | • Status → `APPROVED`.<br>• Tenant notified (if email enabled). | • Inbound `PENDING`, contract `ACTIVE`. |
| TC_WHAD_018 | Reject inbound request | 1. Mở chi tiết inbound → chọn **Hủy** / từ chối. | • Status → `CANCELLED`. | • Inbound `PENDING`. |
| TC_WHAD_019 | Assign transporter to inbound trip | 1. Mở chi tiết inbound loại **Kho đi lấy hàng** (`WAREHOUSE_TRANSPORT`).<br>2. Ở mục vận chuyển, chọn tài xế trong dropdown.<br>3. Bấm **Lưu vận chuyển**. | • `assignedDriverUserId` saved.<br>• Tài xế thấy chuyến tại **Chuyến vận chuyển của tôi** (`/staff/my-deliveries`). | • Transporter account exists.<br>• Inbound approved. |
| TC_WHAD_020 | View outbound request list | 1. `GET /api/outbound-requests?warehouseId=` via Swagger. | • HTTP `200` with outbound list scoped to warehouse. | • Outbound request exists. |
| TC_WHAD_021 | Approve outbound request | 1. PATCH outbound status to `APPROVED`. | • Status → `APPROVED` then system reserves inventory (`RESERVED`). | • Sufficient inventory available. |
| TC_WHAD_022 | Reject outbound request | 1. PATCH outbound to `CANCELLED`. | • Outbound cancelled.<br>• No inventory locked. | • Outbound in `PENDING`. |

## **Monitoring & Billing** (#22–#26)

| Test Case ID | Test Case Description | Test Case Procedure | Expected Results | Pre-conditions |
|--------------|----------------------|---------------------|------------------|----------------|
| TC_WHAD_023 | View warehouse inventory | 1. Truy cập trang `/admin/inventory`. | • Inventory list scoped to WH Admin warehouse.<br>• SKU, bin, quantity visible. | • Inventory records exist. |
| TC_WHAD_024 | View tenant company info | 1. Mở chi tiết yêu cầu thuê hoặc hợp đồng.<br>2. Xem thông tin tenant liên kết. | • Tenant name, tax code, contact displayed. | • Tenant linked to contract/request. |
| TC_WHAD_025 | View occupancy dashboard | 1. Mở trang `/admin/dashboard`. | • Occupancy widgets load (or placeholder if API pending). | • Bins with usage data exist. |
| TC_WHAD_026 | View warehouse reports | 1. Mở trang `/admin/reports`. | • Reports page accessible for WH Admin. | • WH Admin is `ACTIVE`. |
| TC_WHAD_027 | View and send invoice (API pending) | 1. Attempt invoice list/send. | • Document as **Not yet implemented** until billing API available. | • Invoice module pending. |

---

# Tenant Admin — Test Cases (#37–#47)

> **Role**: `TENANT_ADMIN` · Login: `tenant1admin@brand.local`

## **Account & Onboarding** (#37–#39, #38)

| Test Case ID | Test Case Description | Test Case Procedure | Expected Results | Pre-conditions |
|--------------|----------------------|---------------------|------------------|----------------|
| TC_TAD_001 | Create Tenant Staff account | 1. Đăng nhập Tenant Admin.<br>2. Truy cập **Quản lý tài khoản** (`/staff/accounts`).<br>3. Chọn **Thêm tài khoản** → role **Nhân viên tenant** (`TENANT_STAFF`).<br>4. Bấm **Tạo tài khoản**. | • Staff được tạo cùng `tenantId`.<br>• Staff đăng nhập → `/staff/dashboard`. | • Tenant Admin is `ACTIVE`. |
| TC_TAD_002 | Tenant Staff cannot access account management | 1. Đăng nhập bằng tài khoản Tenant Staff.<br>2. Truy cập trang `/staff/accounts`. | • Access denied or redirect.<br>• HTTP `403` on account create API. | • Tenant Staff account exists. |
| TC_TAD_003 | View contract successfully | 1. Đăng nhập Tenant Admin.<br>2. Truy cập **Hợp đồng** (`/staff/contracts`).<br>3. Chọn một hợp đồng để xem chi tiết. | • Chi tiết hợp đồng đang hoạt động hiển thị.<br>• Loại HĐ, ngày, kho hiển thị đúng. | • Active contract for tenant. |
| TC_TAD_004 | Create new rental request | 1. Truy cập **Yêu cầu thuê kho** (`/staff/rental-requests`) hoặc trang landing `/`.<br>2. Điền form **Tạo yêu cầu thuê mới** (dung lượng, loại hợp đồng).<br>3. Bấm **Tạo yêu cầu**. | • Yêu cầu thuê được tạo, trạng thái `PENDING`.<br>• Thông báo xác nhận thành công. | • Tenant Admin is `ACTIVE`. |

## **SKU Management** (#40–#42)

| Test Case ID | Test Case Description | Test Case Procedure | Expected Results | Pre-conditions |
|--------------|----------------------|---------------------|------------------|----------------|
| TC_TAD_005 | Create SKU successfully | 1. Truy cập **Quản lý SKU** (`/staff/products`).<br>2. Chọn **THÊM SKU** → nhập **Mã SKU**, tên, danh mục, mùa.<br>3. Bấm **Lưu**. | • Thông báo: **"Đã thêm SKU"**.<br>• SKU hiển thị trong danh sách.<br>• `skuCode` duy nhất trong tenant. | • Categories/seasons seeded.<br>• Contract active. |
| TC_TAD_006 | Create SKU fails with duplicate code | 1. Chọn **THÊM SKU** và nhập **Mã SKU** đã tồn tại trong cùng tenant. | • HTTP `409` hoặc lỗi validation.<br>• **"SKU code already exists in this tenant."** | • Duplicate skuCode exists. |
| TC_TAD_007 | Update SKU successfully | 1. Chọn **Sửa SKU** trên một SKU có sẵn.<br>2. Sửa tên hoặc danh mục vận chuyển → bấm **Lưu**. | • Thông báo: **"Đã cập nhật SKU"**.<br>• Thay đổi được lưu. | • SKU exists, no delete constraint. |
| TC_TAD_008 | Delete SKU successfully (soft disable) | 1. Chọn **Xóa** trên SKU không còn tồn kho. | • SKU `isActive = false`.<br>• Biến mất khỏi danh sách đang hoạt động. | • SKU has no inventory. |
| TC_TAD_009 | Delete SKU blocked when inventory exists | 1. Thử **Xóa** SKU còn tồn kho. | • HTTP `400`.<br>• **"Cannot delete SKU with existing inventory."** | • SKU has inventory > 0. |

## **Inbound & Outbound** (#43–#44)

| Test Case ID | Test Case Description | Test Case Procedure | Expected Results | Pre-conditions |
|--------------|----------------------|---------------------|------------------|----------------|
| TC_TAD_010 | Create inbound request successfully | 1. Truy cập **Tạo yêu cầu nhập kho** (`/staff/inbound/new`).<br>2. Chọn hợp đồng đang hoạt động, SKU và số lượng.<br>3. Bấm gửi / tạo yêu cầu. | • Inbound trạng thái = `PENDING`.<br>• Các dòng SKU được lưu đúng. | • Active contract.<br>• SKUs exist. |
| TC_TAD_011 | Create inbound fails without active contract | 1. Thử tạo inbound khi không có hợp đồng ACTIVE. | • HTTP `400`.<br>• **"Contract must be ACTIVE."** | • No active contract. |
| TC_TAD_012 | Create outbound request successfully | 1. `POST /api/outbound-requests` with valid items (Swagger). | • Outbound status = `PENDING`. | • Active contract.<br>• Sufficient inventory. |
| TC_TAD_013 | Create outbound fails — insufficient inventory | 1. Request quantity > available stock. | • HTTP `400`.<br>• **"INSUFFICIENT_INVENTORY"**. | • Low or zero stock for SKU. |

## **View Data** (#45–#47)

| Test Case ID | Test Case Description | Test Case Procedure | Expected Results | Pre-conditions |
|--------------|----------------------|---------------------|------------------|----------------|
| TC_TAD_014 | View tenant inventory | 1. `/staff/inventory`. | • Shows only current tenant's stock.<br>• Cannot see other tenant data. | • Inventory exists for tenant. |
| TC_TAD_015 | View invoice (API pending) | 1. Attempt invoice view. | • **Not yet implemented** — document for future sprint. | • Billing API pending. |
| TC_TAD_016 | View tenant reports | 1. Mở trang dashboard or reports (if available). | • Tenant-scoped summary visible. | • Tenant Admin is `ACTIVE`. |
| TC_TAD_017 | Tenant Admin cannot approve own inbound | 1. PATCH inbound to `APPROVED` as Tenant Admin. | • HTTP `403 Forbidden`. | • Pending inbound exists. |

---

# Warehouse Staff — Test Cases (#48–#55)

> **Role**: `WH_STAFF`

## **Inbound Operations** (#48–#51)

| Test Case ID | Test Case Description | Test Case Procedure | Expected Results | Pre-conditions |
|--------------|----------------------|---------------------|------------------|----------------|
| TC_WHST_001 | Mark inbound arrived (tenant self-delivery) | 1. Đăng nhập WH Staff.<br>2. Mở chi tiết inbound (`/staff/inbound-ops/{id}`) loại **Tự giao** (`TENANT_SELF`), trạng thái `APPROVED`.<br>3. Nhập biển số xe → bấm **Báo đã đến kho**. | • Trạng thái → `ARRIVED`.<br>• `actualArrivalAt` được ghi nhận. | • Inbound approved.<br>• Delivery info saved. |
| TC_WHST_002 | Start receiving and record quantity | 1. Bấm **Bắt đầu nhận hàng**.<br>2. Nhập **Số lượng thực nhận** từng dòng SKU.<br>3. Bấm **Hoàn tất kiểm đếm**. | • Trạng thái → `RECEIVING`.<br>• Số lượng được lưu.<br>• Chênh lệch được đánh dấu nếu không khớp. | • Inbound `ARRIVED` or `APPROVED`. |
| TC_WHST_003 | Create batch successfully | 1. Nhập **Mã batch**.<br>2. Bấm tạo batch cho inbound đang nhận. | • Batch liên kết inbound.<br>• `warehouseReceivedAt` được ghi. | • Inbound in receiving state. |
| TC_WHST_004 | Create LPN and add SKU details | 1. Tạo LPN với loại thùng.<br>2. Thêm SKU và số lượng vào LPN. | • Mã LPN được sinh.<br>• LPN trạng thái `RECEIVING`. | • Batch exists. |
| TC_WHST_005 | Put-away LPN to bin successfully | 1. Chọn LPN cần cất.<br>2. Chọn bin đích trong phần **Putaway**.<br>3. Bấm **Putaway 1 LPN (thủ công)** hoặc **Putaway tự động**. | • LPN `currentBinId` cập nhật.<br>• LPN trạng thái → `STORED`.<br>• Tồn kho tăng.<br>• Dung tích bin cập nhật. | • LPN created.<br>• Available bin exists. |
| TC_WHST_006 | Complete inbound after all put-away | 1. Putaway tất cả LPN.<br>2. Bấm **Hoàn tất inbound**. | • Inbound trạng thái → `COMPLETED`. | • All LPNs stored. |

## **Outbound Operations** (#52–#53)

| Test Case ID | Test Case Description | Test Case Procedure | Expected Results | Pre-conditions |
|--------------|----------------------|---------------------|------------------|----------------|
| TC_WHST_007 | Execute outbound picking | 1. Mở chi tiết outbound ở trạng thái `RESERVED`/`PICKING`.<br>2. Xác nhận số lượng pick theo từng task (API/UI). | • Trạng thái → `PICKING`.<br>• Số lượng đã pick được ghi nhận. | • Outbound approved and reserved. |
| TC_WHST_008 | Pack and create shipment | 1. Chuyển outbound sang `PACKING` rồi `SHIPPED`.<br>2. Nhập mã vận đơn (tracking). | • Trạng thái → `SHIPPED`.<br>• Bản ghi shipment được tạo. | • Picking completed. |

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
| TC_TST_001 | Create inbound request successfully | 1. Đăng nhập Tenant Staff.<br>2. Truy cập **Tạo yêu cầu nhập kho** (`/staff/inbound/new`) → gửi form. | • Giống TC_TAD_010.<br>• Trạng thái `PENDING`. | • Active contract.<br>• SKUs exist. |
| TC_TST_002 | Create outbound request (API) | 1. Tenant Staff calls `POST /api/outbound-requests`. | • Outbound created if inventory sufficient. | • Same as TC_TAD_012. |
| TC_TST_003 | View inbound and outbound status | 1. Truy cập **Nhập kho** (`/staff/inbound`) → mở chi tiết → xem timeline.<br>2. Xem danh sách outbound qua API. | • Timeline trạng thái hiển thị.<br>• Chỉ xem — không có nút duyệt. | • Requests exist for tenant. |
| TC_TST_004 | Tenant Staff cannot access account page | 1. Truy cập trang `/staff/accounts`. | • Access denied. | • Tenant Staff is `ACTIVE`. |

## **SKU Management** (#59–#60)

| Test Case ID | Test Case Description | Test Case Procedure | Expected Results | Pre-conditions |
|--------------|----------------------|---------------------|------------------|----------------|
| TC_TST_005 | Create SKU successfully | 1. Truy cập **Quản lý SKU** (`/staff/products`) → chọn **THÊM SKU**. | • SKU được tạo (giống TC_TAD_005). | • Categories seeded. |
| TC_TST_006 | Update SKU successfully | 1. Chọn **Sửa SKU** trên trang sản phẩm → bấm **Lưu**. | • Cập nhật được lưu. | • SKU exists. |
| TC_TST_007 | Tenant Staff cannot delete SKU | 1. Attempt `DELETE /api/skus/{id}` as Tenant Staff. | • HTTP `403 Forbidden` (if restricted) OR UI hides delete — per product policy.<br>• SKU remains active. | • SKU exists.<br>• *Note: align with BE policy — Tenant Staff typically has no delete.* |

## **View Data** (#61–#62)

| Test Case ID | Test Case Description | Test Case Procedure | Expected Results | Pre-conditions |
|--------------|----------------------|---------------------|------------------|----------------|
| TC_TST_008 | View tenant inventory | 1. `/staff/inventory`. | • Tenant-scoped inventory only. | • Inventory exists. |
| TC_TST_009 | View invoice (API pending) | 1. Attempt invoice view. | • **Not yet implemented**. | • Billing pending. |
| TC_TST_010 | Tenant Staff cannot create rental request | 1. `POST /api/rental-requests` as Tenant Staff. | • HTTP `403` or UI not available for this role. | • Tenant Staff is `ACTIVE`. |
| TC_TST_011 | Tenant Staff cannot manage warehouse inbound ops | 1. Truy cập trang `/staff/inbound-ops`. | • No receive/put-away actions or access denied for warehouse ops mode. | • Tenant Staff is `ACTIVE`. |

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
| TC_WHTR_001 | View assigned delivery trips successfully | 1. Đăng nhập Tài xế kho.<br>2. Hệ thống chuyển tới **Chuyến vận chuyển của tôi** (`/staff/my-deliveries`).<br>3. Quan sát danh sách chuyến. | • Tiêu đề trang: **Chuyến vận chuyển của tôi**.<br>• Chỉ hiển thị inbound được gán cho tài xế đang đăng nhập.<br>• Mỗi dòng có mã inbound, ngày dự kiến đến, trạng thái. | • Transporter account exists and is `ACTIVE`.<br>• At least one inbound with `deliveryMode = WAREHOUSE_TRANSPORT` is assigned to this transporter.<br>• Inbound status is `APPROVED` or later. |
| TC_WHTR_002 | Empty state when no trips are assigned | 1. Đăng nhập bằng tài khoản Tài xế kho mới tạo (chưa được gán chuyến).<br>2. Truy cập **Chuyến vận chuyển của tôi** (`/staff/my-deliveries`). | • Hiển thị: **"Chưa có chuyến nào được gán."**<br>• Không có dòng inbound nào. | • Transporter account exists and is `ACTIVE`.<br>• No inbound delivery record has `assignedDriverUserId` = this user. |
| TC_WHTR_003 | Non-transporter cannot use assigned-to-me filter | 1. Đăng nhập bằng tài khoản Warehouse Staff.<br>2. Call API `GET /api/inbound-requests?assignedToMe=true` (via Swagger or network tab). | • System returns HTTP `403 Forbidden`.<br>• Error message: **"assignedToMe requires WH_TRANSPORTER"**. | • WH Staff account exists and is `ACTIVE`. |
| TC_WHTR_004 | Transporter cannot see unassigned warehouse-transport trips | 1. Đăng nhập Tài xế kho A.<br>2. WH Admin gán inbound `WAREHOUSE_TRANSPORT` cho Tài xế B.<br>3. Tài xế A mở **Chuyến vận chuyển của tôi**. | • Inbound gán cho Tài xế B **không** xuất hiện trong danh sách của Tài xế A. | • Two transporter accounts exist in the same warehouse.<br>• One inbound is assigned only to Transporter B. |

---

## **View Inbound Trip Detail** (Function #64)

| Test Case ID | Test Case Description | Test Case Procedure | Expected Results | Pre-conditions |
|--------------|----------------------|---------------------|------------------|----------------|
| TC_WHTR_005 | View inbound trip detail successfully | 1. Đăng nhập Tài xế kho.<br>2. Trên **Chuyến vận chuyển của tôi**, chọn mã inbound.<br>3. Xem trang chi tiết chuyến. | • Trang mở tại `/staff/my-deliveries/{inboundRequestId}`.<br>• Hiển thị mã inbound, trạng thái, ngày dự kiến, SKU, mục vận chuyển.<br>• Thông tin vận chuyển phản ánh dữ liệu WH Admin/tài xế đã lưu. | • Trip is assigned to the logged-in transporter.<br>• Inbound `deliveryMode = WAREHOUSE_TRANSPORT`. |
| TC_WHTR_006 | Access denied for trip not assigned to transporter | 1. Đăng nhập Tài xế kho A.<br>2. Truy cập trực tiếp URL `/staff/my-deliveries/{inboundRequestId}` của chuyến gán cho Tài xế B. | • HTTP `403 Forbidden` hoặc UI từ chối truy cập.<br>• **"Trip is not assigned to you"**. | • Inbound exists and is assigned to another transporter. |
| TC_WHTR_007 | Transporter cannot open tenant-self inbound trip | 1. Tenant tạo inbound loại **Tự giao** (`TENANT_SELF`).<br>2. Đăng nhập Tài xế kho.<br>3. Thử mở URL chi tiết inbound đó trực tiếp. | • Chuyến không xuất hiện trong danh sách.<br>• API trả lỗi: **"This inbound is not warehouse transport"** (nếu có delivery record). | • Inbound `deliveryMode = TENANT_SELF`.<br>• Inbound is not assigned to transporter. |

---

## **Update Vehicle & Driver Info** (Function #65)

| Test Case ID | Test Case Description | Test Case Procedure | Expected Results | Pre-conditions |
|--------------|----------------------|---------------------|------------------|----------------|
| TC_WHTR_008 | Update vehicle and driver info successfully | 1. Đăng nhập Tài xế kho đã được gán chuyến.<br>2. Mở chi tiết chuyến (status `APPROVED`).<br>3. Nhập **Biển số xe**, tên/SĐT tài xế, hãng vận chuyển.<br>4. Bấm **Lưu thông tin xe**. | • Thông báo: **"Đã lưu thông tin vận chuyển"**.<br>• Thông tin xe được lưu.<br>• Inbound status vẫn `APPROVED`. | • Trip assigned to logged-in transporter.<br>• Inbound status = `APPROVED`. |
| TC_WHTR_009 | Save fails when vehicle plate is empty | 1. Đăng nhập Tài xế kho được gán chuyến.<br>2. Mở chi tiết chuyến (`APPROVED`).<br>3. Xóa trường **Biển số xe**.<br>4. Bấm **Lưu thông tin xe**. | • Thông báo lỗi: **"Nhập biển số xe trước khi lưu"** (hoặc tương đương).<br>• Delivery record is not updated. | • Trip assigned to logged-in transporter.<br>• Inbound status = `APPROVED`. |
| TC_WHTR_010 | Transporter cannot reassign driver to another user | 1. Đăng nhập Tài xế kho được gán chuyến.<br>2. Gọi API `PUT /api/inbound-requests/{id}/delivery` với `{ "assignedDriverUserId": "<other-user-uuid>" }`. | • HTTP `403 Forbidden`.<br>• **"Transporter cannot reassign driver"**. | • Trip assigned to logged-in transporter. |
| TC_WHTR_011 | Update blocked when inbound status is not APPROVED | 1. Đăng nhập Tài xế kho được gán chuyến.<br>2. Mở chi tiết chuyến đã ở trạng thái `ARRIVED` hoặc `RECEIVING`.<br>3. Thử sửa và bấm **Lưu thông tin xe**. | • HTTP `400 Bad Request`.<br>• Lỗi trạng thái inbound không hợp lệ.<br>• Thông tin vận chuyển không đổi. | • Trip was previously reported as arrived (#66). |
| TC_WHTR_012 | Inactive transporter cannot be assigned (WH Admin side) | 1. System Admin **Vô hiệu hóa** tài xế trên **Quản lý tài khoản**.<br>2. WH Admin mở chi tiết inbound → mục vận chuyển → thử gán tài xế đó. | • HTTP `400 Bad Request`.<br>• **"Transporter account is not active"**. | • Transporter user exists with status `INACTIVE`. |

---

## **Report Arrival at Warehouse** (Function #66)

| Test Case ID | Test Case Description | Test Case Procedure | Expected Results | Pre-conditions |
|--------------|----------------------|---------------------|------------------|----------------|
| TC_WHTR_013 | Report arrival at warehouse successfully | 1. Đăng nhập Tài xế kho được gán chuyến.<br>2. Mở chi tiết chuyến (`APPROVED`), đã lưu biển số (#65).<br>3. Bấm **Báo đã đến kho**. | • Thông báo thành công.<br>• Inbound status: `APPROVED` → `ARRIVED`.<br>• `actualArrivalAt` được ghi nhận.<br>• WH Staff tiếp tục nhận hàng (#49). | • Trip assigned to logged-in transporter.<br>• Inbound status = `APPROVED`.<br>• Vehicle plate is saved on delivery record. |
| TC_WHTR_014 | Report arrival fails without vehicle plate | 1. Đăng nhập Tài xế kho được gán chuyến.<br>2. Mở chi tiết chuyến chưa có biển số.<br>3. Bấm **Báo đã đến kho**. | • HTTP `400 Bad Request`.<br>• Thông báo: cần lưu biển số trước khi báo đến kho.<br>• Inbound status vẫn `APPROVED`. | • Trip assigned to logged-in transporter.<br>• Delivery record has no `vehiclePlate`. |
| TC_WHTR_015 | Report arrival fails when status is not APPROVED | 1. Đăng nhập Tài xế kho được gán chuyến.<br>2. Mở chi tiết chuyến đã ở trạng thái `ARRIVED`.<br>3. Gọi lại API `POST /api/inbound-requests/{id}/report-arrival`. | • HTTP `400 Bad Request`.<br>• Lỗi chuyển trạng thái không hợp lệ.<br>• Trạng thái vẫn `ARRIVED`. | • Arrival was already reported once. |
| TC_WHTR_016 | Warehouse Staff cannot use report-arrival endpoint | 1. Đăng nhập bằng tài khoản Warehouse Staff.<br>2. Call `POST /api/inbound-requests/{id}/report-arrival` for a TENANT_SELF inbound. | • System returns HTTP `403 Forbidden`.<br>• Error message: **"WH_TRANSPORTER only"**. | • WH Staff account is `ACTIVE`.<br>• Valid inbound exists. |
| TC_WHTR_017 | Unassigned transporter cannot report arrival | 1. Đăng nhập bằng tài khoản Transporter A.<br>2. Call report-arrival API for inbound assigned to Transporter B. | • System returns HTTP `403 Forbidden`.<br>• Error message: **"Trip is not assigned to you"**. | • Inbound assigned to a different transporter. |

---

## **Authentication & Navigation**

| Test Case ID | Test Case Description | Test Case Procedure | Expected Results | Pre-conditions |
|--------------|----------------------|---------------------|------------------|----------------|
| TC_WHTR_018 | Transporter login redirects to my deliveries | 1. Truy cập trang **Đăng nhập** (`/login`).<br>2. Nhập email/mật khẩu Tài xế kho.<br>3. Bấm đăng nhập. | • Đăng nhập thành công.<br>• Chuyển tới `/staff/my-deliveries`.<br>• Sidebar hiển thị **Chuyến vận chuyển của tôi**. | • Transporter account exists and is `ACTIVE`. |
| TC_WHTR_019 | Transporter cannot access admin pages | 1. Đăng nhập Tài xế kho.<br>2. Truy cập trực tiếp `/admin/inbound` hoặc `/admin/accounts`. | • Chuyển về đăng nhập hoặc hiển thị **403 / Access denied**.<br>• Không truy cập được trang admin. | • Transporter account is `ACTIVE`. |

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
| TC_Inactive_User_001 | Deactivate active user successfully | 1. Đăng nhập System Admin.<br>2. Truy cập **Quản lý tài khoản** (`/admin/accounts`).<br>3. Tìm user đang **Đang hoạt động** (không phải chính mình).<br>4. Chọn icon **Vô hiệu hóa** (`person_off`).<br>5. Xác nhận hộp thoại **Vô hiệu hóa tài khoản**. | • Thông báo: **"Đã vô hiệu hóa tài khoản {name}."**<br>• Badge trạng thái → **Vô hiệu hóa** / `INACTIVE`.<br>• Số **Đang hoạt động** giảm 1. | • System Admin account is `ACTIVE`.<br>• Target user exists with status `ACTIVE`.<br>• Target user is not the logged-in admin. |
| TC_Inactive_User_002 | Deactivated user cannot log in | 1. Hoàn thành TC_Inactive_User_001.<br>2. **Đăng xuất** System Admin.<br>3. Thử **Đăng nhập** bằng email/mật khẩu user đã bị vô hiệu hóa. | • Đăng nhập thất bại, HTTP `403 Forbidden`.<br>• Thông báo: **"Account is not active"** (`ACCOUNT_INACTIVE`).<br>• Không cấp access token. | • Target user status = `INACTIVE` after step 001. |
| TC_Inactive_User_003 | Admin cannot deactivate own account | 1. Đăng nhập System Admin.<br>2. Trên **Quản lý tài khoản**, tìm dòng của chính mình.<br>3. Thử chọn **Vô hiệu hóa** hoặc gọi API `PATCH` status `INACTIVE`. | • FE: cảnh báo **"Bạn không thể tự vô hiệu hóa tài khoản của chính mình."** (hoặc ẩn nút).<br>• API: HTTP `403` — **"Cannot deactivate your own account"**.<br>• Admin vẫn `ACTIVE`. | • System Admin is logged in. |
| TC_Inactive_User_004 | Non–System Admin cannot deactivate users | 1. Đăng nhập WH Admin hoặc Tenant Admin.<br>2. Truy cập **Quản lý tài khoản** (`/admin/accounts` hoặc `/staff/accounts`).<br>3. Quan sát các nút thao tác trên từng dòng user. | • Icon **Vô hiệu hóa** / **Kích hoạt** **không hiển thị** (chỉ System Admin).<br>• Gọi API trực tiếp ngoài phạm vi: HTTP `404` — **"User not found"**. | • WH Admin or Tenant Admin account is `ACTIVE`. |
| TC_Inactive_User_005 | Deactivate non-existent user returns error | 1. Đăng nhập bằng tài khoản System Admin.<br>2. Call `PATCH /api/users/00000000-0000-4000-8000-000000000099` with `{ "status": "INACTIVE" }`. | • HTTP `404 Not Found`.<br>• Error message: **"User not found"**.<br>• No user record is modified. | • Invalid or non-existent `userId`. |

---

## **Active User**

| Test Case ID | Test Case Description | Test Case Procedure | Expected Results | Pre-conditions |
|--------------|----------------------|---------------------|------------------|----------------|
| TC_Active_User_001 | Reactivate inactive user successfully | 1. Đăng nhập System Admin.<br>2. Truy cập **Quản lý tài khoản**.<br>3. Tìm user **Vô hiệu hóa** (`INACTIVE`).<br>4. Chọn icon **Kích hoạt** (`how_to_reg`).<br>5. Xác nhận hộp thoại **Kích hoạt tài khoản**. | • Thông báo: **"Đã kích hoạt tài khoản {name}."**<br>• Badge → **Đang hoạt động** / `ACTIVE`. | • Target user exists with status `INACTIVE`.<br>• System Admin is logged in. |
| TC_Active_User_002 | Reactivated user can log in successfully | 1. Hoàn thành TC_Active_User_001.<br>2. **Đăng xuất** System Admin.<br>3. **Đăng nhập** bằng email/mật khẩu user vừa được kích hoạt. | • Đăng nhập thành công.<br>• Chuyển tới trang chủ theo role.<br>• Nhận `accessToken` hợp lệ. | • Target user status = `ACTIVE` after step 001. |
| TC_Active_User_003 | Reactivate non-existent user returns error | 1. Đăng nhập bằng tài khoản System Admin.<br>2. Call `PATCH /api/users/00000000-0000-4000-8000-000000000099` with `{ "status": "ACTIVE" }`. | • HTTP `404 Not Found`.<br>• Error message: **"User not found"**. | • Invalid or non-existent `userId`. |
| TC_Active_User_004 | WH Admin cannot reactivate BLOCKED user | 1. Ensure a user has status `BLOCKED` (set via DB or System Admin if supported).<br>2. Đăng nhập bằng tài khoản Warehouse Admin.<br>3. Attempt `PATCH /api/users/{blockedUserId}` with `{ "status": "ACTIVE" }` for a user in WH Admin scope. | • HTTP `403 Forbidden`.<br>• Error message: **"Cannot reactivate blocked user"**.<br>• User status remains `BLOCKED`. | • User exists with status `BLOCKED`.<br>• WH Admin has scope over that user. |
| TC_Active_User_005 | Inactive transporter cannot be assigned after deactivation | 1. Vô hiệu hóa tài xế kho (TC_Inactive_User_001).<br>2. Đăng nhập WH Admin.<br>3. Mở chi tiết inbound → mục vận chuyển → thử gán tài xế đó. | • HTTP `400 Bad Request`.<br>• **"Transporter account is not active"**.<br>• Tài xế không được lưu trên delivery record. | • Transporter was `ACTIVE` then set to `INACTIVE`.<br>• WAREHOUSE_TRANSPORT inbound exists. |

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
