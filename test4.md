# Unit Test Case Matrix — Core Create Functions (UT002–UT015)

> **Mục đích**: Ma trận UT (decision table) cho 14 chức năng **Create** theo danh sách Capstone.  
> **Tham chiếu**: `docs/test1.md`, `docs/test2.md` (UT015 ≈ #17), `docs/all_role_func.md`.  
> **Ký hiệu**: **O** = áp dụng · **N** = Normal · **A** = Abnormal · **B** = Boundary  
> **Phiên bản**: 1.0 — 2026-05-30

---

## Index

| UT ID | Service | Function | Role / Actor | API | Ref |
|-------|---------|----------|--------------|-----|-----|
| UT002 | Auth Service | Create Warehouse Admin Account | System Admin | `POST /api/users` | #3 |
| UT003 | Auth Service | Create Tenant Admin Account | System Admin | `POST /api/users` | #4 |
| UT004 | Warehouse Structure Service | Create Warehouse | System Admin | `POST /api/warehouses` | #1 |
| UT005 | Warehouse Structure Service | Create Warehouse Zone | WH Admin | `POST /api/zones` | #12 |
| UT006 | Warehouse Structure Service | Create Rack | WH Admin | `POST /api/racks` | #13 |
| UT007 | Warehouse Structure Service | Create Rack Level | WH Admin | `POST /api/rack-levels` | #14 |
| UT008 | Warehouse Structure Service | Create Bin | WH Admin | `POST /api/bins` | #15 |
| UT009 | Contract Service | Create Contract | WH Admin | `POST /api/contracts` | #30 |
| UT010 | Rental Request Service | Create New Rental Request | Tenant Admin / Guest | `POST /api/rental-requests` | #39 |
| UT011 | SKU Service | Create SKU | Tenant Admin | `POST /api/skus` | #40 |
| UT012 | Inbound Request Service | Create Inbound Request | Tenant Admin | `POST /api/inbound-requests` | #43 |
| UT013 | Outbound Request Service | Create Outbound Request | Tenant Admin | `POST /api/outbound-requests` | #44 |
| UT014 | Batch & LPN Service | Create Batch & LPN | WH Staff | `POST /api/batches`, `/api/lpns`, `/api/lpn-details` | #50 |
| UT015 | Auth Service | Create Warehouse Staff Account | WH Admin | `POST /api/users` | #17 · chi tiết `test2.md` §1 |

---

## UT002 — Create Warehouse Admin Account

**Actor**: System Admin · **FE**: `/admin/accounts` → **Thêm tài khoản** → **Quản trị kho** → chọn kho → **Tạo tài khoản**

### Input fields

| Field | Label FE | Bắt buộc | Valid | Invalid / biên |
|-------|----------|----------|-------|----------------|
| `fullName` | **Họ và tên** | Có | Non-empty | Empty |
| `email` | **Email** | Có | Unique | Empty / duplicate |
| `password` | **Mật khẩu** | Có | ≥ 8 | &lt; 8 / empty |
| `confirmPassword` | **Xác nhận mật khẩu** | FE | Match password | Mismatch |
| `role` | **Vai trò** | Có | `WH_ADMIN` | Other roles |
| `warehouseId` | **Kho** (dropdown) | Có | Warehouse chưa có WH Admin | Empty / kho đã có WH Admin |

### Matrix

| | | **01** | **02** | **03** | **04** | **05** | **06** | **07** | **08** |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Condition** | System Admin `ACTIVE`, logged in | O | O | O | O | O | O | | O |
| | Warehouse exists | O | O | O | O | O | | O | O |
| | **fullName** Valid | O | | O | O | O | O | O | O |
| | **fullName** Invalid (empty) | | O | | | | | | |
| | **email** Valid (unique) | O | O | | O | O | O | | O |
| | **email** Invalid (empty) | | | O | | | | | |
| | **email** Duplicate | | | | | O | | | |
| | **password** Valid (≥ 8) | O | O | O | | O | O | O | O |
| | **password** &lt; 8 | | | | O | | | | |
| | **confirmPassword** mismatch | | | | | | O | | |
| | **warehouseId** Valid | O | O | O | O | O | | O | O |
| | **warehouseId** missing | | | | | | | O | |
| | **warehouseId** already has WH Admin | | | | | | | | O |
| **Confirm** | Success | O | | | | | | | |
| | Fail | | O | O | O | O | O | O | O |
| | Message **"Tạo tài khoản thành công."** | O | | | | | | | |
| | `warehouseId is required` | | | | | | | O | |
| | `WH_ADMIN_EXISTS` / FE: kho đã có WH Admin | | | | | | | | O |
| **Result** | Type | N | A | A | B | A | A | A | A |
| | P/F | P | F | F | F | F | F | F | F |

**Payload mẫu**: `{ "fullName": "Kho trưởng HCM", "email": "whadmin2@warehouse.local", "password": "WhAdmin@12345", "role": "WH_ADMIN", "warehouseId": "<uuid>" }`

---

## UT003 — Create Tenant Admin Account

**Actor**: System Admin · **FE**: `/admin/accounts` → **Quản trị tenant** → chọn tenant → **Tạo tài khoản**

### Input fields

| Field | Label FE | Bắt buộc | Valid | Invalid |
|-------|----------|----------|-------|---------|
| `fullName` | **Họ và tên** | Có | Non-empty | Empty |
| `email` | **Email** | Có | Unique | Empty / duplicate |
| `password` | **Mật khẩu** | Có | ≥ 8 | &lt; 8 |
| `confirmPassword` | **Xác nhận mật khẩu** | FE | Match | Mismatch |
| `role` | **Vai trò** | Có | `TENANT_ADMIN` | Other |
| `tenantId` | **Tenant** | Có | Tenant chưa có Tenant Admin | Empty / tenant đã có admin |

### Matrix

| | | **01** | **02** | **03** | **04** | **05** | **06** | **07** | **08** |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Condition** | System Admin logged in | O | O | O | O | O | O | | O |
| | Tenant company exists | O | O | O | O | O | | O | O |
| | **fullName** Valid | O | | O | O | O | O | O | O |
| | **fullName** Invalid | | O | | | | | | |
| | **email** Valid | O | O | | O | O | | O |
| | **email** Empty | | | O | | | | | |
| | **email** Duplicate | | | | | O | | | |
| | **password** Valid | O | O | O | | O | O | O | O |
| | **password** &lt; 8 | | | | O | | | | |
| | **tenantId** Valid | O | O | O | O | O | | O | O |
| | **tenantId** missing | | | | | | O | | |
| | **tenantId** has Tenant Admin | | | | | | | | O |
| **Confirm** | Success + login → `/staff/products` | O | | | | | | | |
| | `tenantId is required` | | | | | | O | | |
| | `TENANT_ADMIN_EXISTS` | | | | | | | | O |
| **Result** | Type | N | A | A | B | A | A | A | A |
| | P/F | P | F | F | F | F | F | F | F |

**Payload**: `{ "role": "TENANT_ADMIN", "tenantId": "<uuid>", ... }`

---

## UT004 — Create Warehouse

**Actor**: System Admin · **FE**: `/admin/warehouse` → **TẠO KHO** → **Tạo kho**

### Input fields

| Field | Label FE | Bắt buộc | Valid | Invalid |
|-------|----------|----------|-------|---------|
| `warehouseCode` | **Mã kho** | Có | Unique | Empty / duplicate |
| `warehouseName` | **Tên kho** | Có | Non-empty | Empty |
| `city` | **Tỉnh/Thành phố** | Khuyến nghị | Catalog value | Invalid pair |
| `district` | **Quận/Huyện** | Khuyến nghị | Catalog value | — |
| `address` | **Địa chỉ** | Không | Text | — |

### Matrix

| | | **01** | **02** | **03** | **04** | **05** | **06** |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Condition** | System Admin logged in | O | O | O | | O | O |
| | **warehouseCode** Valid | O | | O | O | O | O |
| | **warehouseCode** Duplicate | | | O | | | |
| | **warehouseName** Valid | O | O | O | | O | O |
| | **warehouseName** Empty | | O | | | | |
| | WH Admin calls API | | | | O | | |
| **Confirm** | Success **"Tạo kho thành công."** | O | | | | |
| | `warehouseCode is required` / `warehouseName is required` | | O | | | |
| | `409 DUPLICATE` | | | O | | |
| | `403 SYSTEM_ADMIN only` | | | | O | |
| **Result** | Type | N | A | A | A | A | A |
| | P/F | P | F | F | F | F | F |

---

## UT005 — Create Warehouse Zone

**Actor**: WH Admin · **FE**: `/admin/zones` → **TẠO ZONE** → **Tạo zone**

### Input fields

| Field | Label FE | Bắt buộc | Valid | Invalid |
|-------|----------|----------|-------|---------|
| `zoneCode` | **Mã zone** | Có | Unique in warehouse | Empty |
| `zoneName` | **Tên zone** | Không | Text | — |
| `zoneType` | **Loại zone** | Không | `SHARED` / enum | Invalid enum |

### Matrix

| | | **01** | **02** | **03** | **04** | **05** |
|---|---|:---:|:---:|:---:|:---:|:---:|
| **Condition** | WH Admin logged in, scoped warehouse | O | O | O | | O |
| | **zoneCode** Valid | O | | O | O | O |
| | **zoneCode** Empty | | O | | | |
| | **zoneCode** Duplicate in warehouse | | | O | | |
| | Tenant Admin calls API | | | | O | |
| **Confirm** | Success **"Tạo zone thành công"** | O | | | |
| | `zoneCode is required` | | O | | |
| | `409 DUPLICATE` | | | O | |
| | `403 Forbidden` | | | | O |
| **Result** | Type | N | A | A | A | A |
| | P/F | P | F | F | F | F |

---

## UT006 — Create Rack

**Actor**: WH Admin · **FE**: `/admin/racks` → **Thêm rack** → **Lưu**

### Input fields

| Field | Label FE | Bắt buộc | Valid | Invalid |
|-------|----------|----------|-------|---------|
| `zoneId` | *(chọn zone)* | Có | Zone in warehouse | Invalid UUID / other WH |
| `rackCode` | **Mã rack** | Có | Unique in zone | Empty |
| `rackName` | **Tên rack** | Không | Text | — |

### Matrix

| | | **01** | **02** | **03** | **04** | **05** |
|---|---|:---:|:---:|:---:|:---:|:---:|
| **Condition** | Zone exists in WH scope | O | O | O | O | O |
| | **rackCode** Valid | O | | O | O | O |
| | **rackCode** Empty | | O | | | |
| | **rackCode** Duplicate in zone | | | O | | |
| | **zoneId** not found | | | | O | |
| **Confirm** | Rack created, linked to zone | O | | | |
| | `rackCode is required` | | O | | |
| | `Rack code already exists in zone` | | | O | |
| **Result** | Type | N | A | A | A | A |
| | P/F | P | F | F | F | F |

---

## UT007 — Create Rack Level

**Actor**: WH Admin · **FE**: rack layout → tạo tầng

### Input fields

| Field | Label FE | Bắt buộc | Valid | Invalid |
|-------|----------|----------|-------|---------|
| `rackId` | *(chọn rack)* | Có | Existing rack | Invalid |
| `levelNumber` | **Số tầng** / **Mã tầng** | Có | Integer ≥ 1 | Empty / negative |

### Matrix

| | | **01** | **02** | **03** | **04** |
|---|---|:---:|:---:|:---:|:---:|
| **Condition** | Rack exists | O | O | O | O |
| | **levelNumber** Valid | O | | O | O |
| | **levelNumber** missing | | O | | |
| | Duplicate level on same rack | | | O | |
| **Confirm** | Rack level created | O | | |
| | `levelNumber is required` | | O | |
| **Result** | Type | N | A | A | A |
| | P/F | P | F | F | F |

---

## UT008 — Create Bin

**Actor**: WH Admin · **FE**: **Tạo bin** / **Tạo bin hàng loạt**

### Input fields

| Field | Label FE | Bắt buộc | Valid | Invalid |
|-------|----------|----------|-------|---------|
| `rackLevelId` | *(chọn tầng)* | Có | Existing level | Invalid |
| `binCode` | **Mã bin** | Có | Unique on level | Empty |
| `maxLpnCount` | *(capacity)* | Có | Positive int | 0 / null |
| `maxVolumeUnits` | *(volume)* | Có | Positive int | 0 / null |
| `boxType` | Loại thùng | Không | Enum | — |

### Matrix

| | | **01** | **02** | **03** | **04** | **05** | **06** |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Condition** | Rack level exists | O | O | O | O | O | O |
| | **binCode** Valid | O | | O | O | O | O |
| | **binCode** Empty | | O | | | | |
| | **binCode** Duplicate on level | | | O | | | |
| | **maxLpnCount** / **maxVolumeUnits** missing | | | | O | | |
| | **maxLpnCount** not positive | | | | | O | |
| **Confirm** | Bin `AVAILABLE` | O | | | | |
| | `binCode is required` | | O | | | |
| | `maxLpnCount is required` | | | | O | |
| **Result** | Type | N | A | A | B | B | A |
| | P/F | P | F | F | F | F | F |

---

## UT009 — Create Contract

**Actor**: WH Admin · **FE**: `/admin/contract` → **Tạo hợp đồng**

### Input fields

| Field | Label FE | Bắt buộc | Valid | Invalid |
|-------|----------|----------|-------|---------|
| `rentalRequestId` | Yêu cầu thuê | Khuyến nghị | `APPROVED`, chưa link HĐ | Not found / already linked |
| `tenantId` | Tenant | Có (scope) | Valid tenant | Wrong scope |
| `warehouseId` | Kho | Có | WH scope | Wrong scope |
| `contractType` | Loại HĐ | Có | Enum | Empty |
| `pricingModel` | Mô hình giá | Có | Enum | Empty |
| `startDate` | Ngày bắt đầu | Có | &lt; endDate | Missing / end ≤ start |
| `endDate` | Ngày kết thúc | Có | After start | Missing |

### Matrix

| | | **01** | **02** | **03** | **04** | **05** | **06** | **07** |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Condition** | Rental request `APPROVED` | O | O | O | O | O | O | O |
| | **contractType** + **pricingModel** Valid | O | O | | O | O | O | O |
| | **startDate** / **endDate** Valid | O | O | O | | O | O | O |
| | **endDate** ≤ **startDate** | | | | O | | | |
| | **contractType** missing | | | O | | | | |
| | **rentalRequestId** already linked | | | | | O | | |
| | Tenant Admin creates contract | | | | | | O | |
| **Confirm** | Contract `DRAFT` created | O | | | | | |
| | `contractType is required` | | | O | | | |
| | `endDate must be after startDate` | | | | O | | |
| | `CONTRACT_ALREADY_LINKED` | | | | | O | |
| **Result** | Type | N | A | A | A | A | A | A |
| | P/F | P | F | F | F | F | F | F |

---

## UT010 — Create New Rental Request

**Actor**: Tenant Admin (FE `/staff/rental-requests`) hoặc Guest (landing `/`)  
**API**: `POST /api/rental-requests`

### Input fields

| Field | Label FE | Bắt buộc | Valid | Invalid |
|-------|----------|----------|-------|---------|
| `tenantId` | *(auto / guest)* | Có | Valid tenant | Missing |
| `city` | **Thành phố** | Có | Catalog | Empty / invalid pair |
| `district` | **Quận / huyện** | Có | Catalog | Empty |
| `expectedStartDate` | Ngày bắt đầu | Có | &lt; end, span ≥ 30 days | Missing / &lt; 30 days |
| `expectedEndDate` | Ngày kết thúc | Có | After start | end ≤ start |
| `requestedAreaM2` | Diện tích (m²) | Một trong hai | &gt; 0 | Both area and boxes empty |
| `estimatedBoxCount` | Số thùng/tháng | Một trong hai | &gt; 0 | — |
| `contractType` | Loại thuê | Không | Enum | — |
| `notes` | **Ghi chú thêm** | Không | Text | — |

### Matrix

| | | **01** | **02** | **03** | **04** | **05** | **06** | **07** |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Condition** | Tenant Admin logged in | O | O | O | O | O | O | |
| | **city** + **district** Valid catalog | O | O | | O | O | O | O |
| | **expectedStartDate** / **end** Valid (≥ 30 days) | O | O | O | | O | O | O |
| | **expectedEnd** before **start** | | | | O | | | |
| | **requestedAreaM2** or **estimatedBoxCount** provided | O | O | O | O | | O | O |
| | Both capacity fields empty | | | O | | | | |
| | Rental duration &lt; 30 days | | | | | O | | |
| | Invalid city/district pair | | | | | | O | |
| **Confirm** | Status `PENDING`, **Tạo yêu cầu** success | O | | | | | |
| | `expectedStartDate is required` | | O | | | | | |
| | `Thời hạn thuê tối thiểu 1 tháng...` | | | | | O | | |
| | `Cần nhập diện tích... hoặc quy mô hàng...` | | | O | | | | |
| **Result** | Type | N | A | A | A | B | A | A |
| | P/F | P | F | F | F | F | F | F |

---

## UT011 — Create SKU

**Actor**: Tenant Admin · **FE**: `/staff/products` → **THÊM SKU** → **Lưu**

### Input fields

| Field | Label FE | Bắt buộc | Valid | Invalid |
|-------|----------|----------|-------|---------|
| `tenantId` | *(auto)* | Có | Creator tenant | Other tenant |
| `skuCode` | **Mã SKU** | Có | Unique per tenant | Empty / duplicate |
| `productName` | Tên sản phẩm | Có | Non-empty | Empty |
| `categoryId` | Danh mục | Khuyến nghị | Seeded category | Invalid FK |
| `seasonId` | Mùa | Không | UUID | — |
| `movementCategory` | Phân loại | Không | `NORMAL` default | — |

### Matrix

| | | **01** | **02** | **03** | **04** | **05** | **06** |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Condition** | Tenant Admin `ACTIVE` | O | O | O | O | | O |
| | Active contract (E2E) | O | O | O | O | O | O |
| | **skuCode** Valid | O | | O | O | O | O |
| | **skuCode** Empty | | O | | | | |
| | **skuCode** Duplicate | | | O | | | |
| | **productName** Empty | | | | O | | |
| | WH Admin creates SKU | | | | | O | |
| **Confirm** | **"Đã thêm SKU"** | O | | | | |
| | `skuCode is required` | | O | | | |
| | `productName is required` | | | | O | |
| | `409 DUPLICATE` / SKU exists in tenant | | | O | | |
| **Result** | Type | N | A | A | A | A | A |
| | P/F | P | F | F | F | F | F |

---

## UT012 — Create Inbound Request

**Actor**: Tenant Admin · **FE**: `/staff/inbound/new` → **Submit**

### Input fields

| Field | Label FE | Bắt buộc | Valid | Invalid |
|-------|----------|----------|-------|---------|
| `contractId` | Hợp đồng | Có | `ACTIVE`, same tenant/WH | Missing / not ACTIVE |
| `warehouseId` | Kho | Có | From contract | Mismatch |
| `tenantId` | Tenant | Có | Auto | — |
| `expectedArrivalDate` | Ngày dự kiến | Không | ≥ contract start | Before contract start |
| `deliveryMode` | Hình thức | Không | `TENANT_SELF` / `WAREHOUSE_TRANSPORT` | — |
| `items[]` | SKU + qty | Có (FE) | ≥ 1 line, valid SKU | Empty items |

### Matrix

| | | **01** | **02** | **03** | **04** | **05** | **06** |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Condition** | Contract `ACTIVE` | O | O | O | | O | O |
| | SKU exists for tenant | O | O | O | O | O | O |
| | **contractId** Valid | O | | O | O | O | O |
| | **contractId** missing | | O | | | | |
| | No ACTIVE contract | | | | O | | |
| | **items** empty | | | O | | | |
| | **expectedArrivalDate** before contract start | | | | | O | |
| **Confirm** | Status `PENDING` | O | | | | |
| | `contractId is required` | | O | | | |
| | **"Contract must be ACTIVE to create an inbound request"** | | | | O | |
| | `Ngày dự kiến đến kho không được trước ngày bắt đầu hợp đồng` | | | | | O | |
| **Result** | Type | N | A | A | A | A | A |
| | P/F | P | F | F | F | F | F |

---

## UT013 — Create Outbound Request

**Actor**: Tenant Admin · **API**: `POST /api/outbound-requests` (FE ⏳ một phần)

### Input fields

| Field | Bắt buộc | Valid | Invalid |
|-------|----------|-------|---------|
| `contractId` | Có | `ACTIVE` | Not ACTIVE |
| `warehouseId` | Có | Scoped | Missing |
| `tenantId` | Có | Auto | — |
| `requestedShipDate` | Không | Valid datetime | Invalid |
| Outbound lines / qty | Có (business) | ≤ inventory | `INSUFFICIENT_INVENTORY` |

### Matrix

| | | **01** | **02** | **03** | **04** | **05** |
|---|---|:---:|:---:|:---:|:---:|:---:|
| **Condition** | Contract `ACTIVE`, stock available | O | O | O | O | O |
| | **contractId** Valid | O | | O | O | O |
| | **contractId** missing | | O | | | |
| | Contract not ACTIVE | | | O | | |
| | Qty &gt; available stock | | | | O | |
| | **warehouseId** missing | | | | | O |
| **Confirm** | Status `PENDING` | O | | | |
| | **"Contract must be ACTIVE to create an outbound request"** | | | O | |
| | **"INSUFFICIENT_INVENTORY"** | | | | O | |
| **Result** | Type | N | A | A | A | A |
| | P/F | P | F | F | F | F |

---

## UT014 — Create Batch & LPN

**Actor**: WH Staff · **FE**: inbound detail (warehouse mode) — **Tạo batch** → **Tạo LPN** → thêm SKU vào carton

### Input fields (2 bước)

| Bước | Field | Bắt buộc | Valid | Invalid |
|------|-------|----------|-------|---------|
| Batch | `inboundRequestId` | Có | Inbound in WH scope | Not found |
| Batch | `batchCode` | Có | Unique per inbound | Empty |
| LPN | `batchId` | Có | From step 1 | Missing |
| LPN | `lpnCode` | Có | Unique | Empty |
| LPN | `boxType` | Có | Enum (`SMALL`/`MEDIUM`/…) | Empty |
| LPN | `volumeUnits` | Có | Positive int | ≤ 0 |
| Detail | `skuId` | Có | Same tenant as inbound | Wrong tenant |
| Detail | `quantity` | Có | Positive int | ≤ 0 |

### Matrix

| | | **01** | **02** | **03** | **04** | **05** | **06** | **07** |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Condition** | Inbound exists, WH Staff scoped | O | O | O | O | O | O | O |
| | **batchCode** Valid | O | | O | O | O | O | O |
| | **batchCode** Empty | | O | | | | | |
| | **inboundRequestId** invalid | | | O | | | | |
| | **lpnCode** / **boxType** Valid | O | O | O | | O | O | O |
| | **boxType** missing | | | | O | | | |
| | **quantity** on LPN detail ≤ 0 | | | | | O | | |
| | Duplicate **skuId** on same LPN | | | | | | O | |
| **Confirm** | Batch + LPN + detail created | O | | | | | |
| | `batchCode is required` | | O | | | | |
| | `lpnCode is required` / `boxType is required` | | | | O | | |
| | `quantity is required` | | | | | O | |
| **Result** | Type | N | A | A | A | B | A | A |
| | P/F | P | F | F | F | F | F | F |

**API mẫu**:
```http
POST /api/batches { "inboundRequestId": "<uuid>", "batchCode": "BATCH-001" }
POST /api/lpns { "batchId": "<uuid>", "lpnCode": "LPN-001", "boxType": "MEDIUM", "volumeUnits": 2, "tenantId": "<uuid>" }
POST /api/lpn-details { "lpnId": "<uuid>", "skuId": "<uuid>", "quantity": 50 }
```

---

## UT015 — Create Warehouse Staff Account

**Service**: Auth Service · **Chi tiết đầy đủ**: `docs/test2.md` §1 (ma trận **UT WH01–WH10**).

**Tóm tắt**

| Field | Label FE | Valid |
|-------|----------|-------|
| `fullName` | **Họ và tên** | Required |
| `email` | **Email** | Unique |
| `password` | **Mật khẩu** | ≥ 8 |
| `confirmPassword` | **Xác nhận mật khẩu** | Match |
| `role` | **Nhân viên kho** (`WH_STAFF`) | Fixed option |
| `warehouseId` | *(auto)* | WH Admin scope |

**Happy path**: WH Admin → `/admin/accounts` → **Thêm tài khoản** → **Nhân viên kho** → **Tạo tài khoản** → **"Tạo tài khoản thành công."** → staff login `/staff/dashboard`.

| | | **01** | **02** | **03** | **04** | **05** |
|---|---|:---:|:---:|:---:|:---:|:---:|
| **Condition** | WH Admin logged in | O | O | O | O | |
| | All staff fields Valid (`WH_STAFF`) | O | | O | O | O |
| | **email** duplicate | | | O | | |
| | **password** &lt; 8 | | | | O | |
| | Not authenticated | | | | | O |
| **Confirm** | Success | O | | | | |
| | Fail | | O | O | O | O |
| **Result** | Type | N | A | A | B | A |
| | P/F | P | F | F | F | F |

---

## Ghi chú chung

| Mục | Nội dung |
|-----|----------|
| **Return Success** | HTTP `200`/`201`, body `success: true` (theo chuẩn API project) |
| **Exception** | `AppError` → JSON `message`, `code` (`VALIDATION_ERROR`, `DUPLICATE`, `FORBIDDEN`, …) |
| **FE validation** | Nhiều form `alert(...)` tiếng Việt trước khi gọi API — case **A** có thể chỉ fail ở FE |
| **Executed Date / Defect ID** | Điền khi chạy test thực tế |
| **Liên kết TC** | `TC_SYS_*`, `TC_WHAD_*`, `TC_TAD_*`, `TC_WHST_*` trong `test1.md` |

> Khi triển khai thêm validation FE (toast thay `alert`), cập nhật hàng **Log message** tương ứng — giữ nhãn UI tiếng Việt trong Procedure/Confirm.
