# Smart Warehouse Backend

REST API cho hệ thống **Smart Warehouse** — nền tảng SaaS B2B quản lý kho thông minh: cho thuê không gian kho (warehouse / zone / rack / level / slot), quản lý hợp đồng, yêu cầu vận chuyển, xuất nhập hàng, hoá đơn, thanh toán.

> Project thuộc đồ án capstone **SEP490 — NextGenWarehouse** (FPT University HCM, kỳ SP26).

---

## Mục lục

1. [Giới thiệu dự án](#giới-thiệu-dự-án)
2. [Bối cảnh & vấn đề](#bối-cảnh--vấn-đề)
3. [Mục tiêu & phạm vi](#mục-tiêu--phạm-vi)
4. [Các bên tham gia (Actors)](#các-bên-tham-gia-actors)
5. [Mô hình nghiệp vụ tổng thể](#mô-hình-nghiệp-vụ-tổng-thể)
6. [Cấu trúc không gian kho](#cấu-trúc-không-gian-kho)
7. [Quy trình nghiệp vụ chính](#quy-trình-nghiệp-vụ-chính)
8. [Vòng đời trạng thái (state machine)](#vòng-đời-trạng-thái-state-machine)
9. [Mô hình dữ liệu chính](#mô-hình-dữ-liệu-chính)
10. [Multi-tenancy](#multi-tenancy)
11. [Bảo mật & phân quyền](#bảo-mật--phân-quyền)
12. [Tech Stack](#tech-stack)
13. [Yêu cầu môi trường](#yêu-cầu-môi-trường)
14. [Cấu hình `.env`](#cấu-hình-env)
15. [Chạy với Docker Compose (khuyến nghị)](#chạy-với-docker-compose-khuyến-nghị)
16. [Chạy local không Docker](#chạy-local-không-docker)
17. [Seed dữ liệu test](#seed-dữ-liệu-test)
18. [Cấu trúc dự án](#cấu-trúc-dự-án)
19. [Danh sách API chính](#danh-sách-api-chính)
20. [Authentication (JWT)](#authentication-jwt)
21. [Tài khoản test](#tài-khoản-test)
22. [Quy ước naming](#quy-ước-naming)
23. [Nguyên tắc thiết kế backend](#nguyên-tắc-thiết-kế-backend)
24. [Troubleshooting](#troubleshooting)
25. [Roadmap](#roadmap)

---

## Giới thiệu dự án

**Smart Warehouse** là một nền tảng cho thuê và vận hành kho bãi B2B, cho phép:

- Doanh nghiệp sở hữu kho (landlord) niêm yết không gian cho thuê dưới dạng **slot** chuẩn hoá — mỗi slot gắn với một vị trí vật lý cụ thể trong kho (zone → rack → level → slot), có kích thước, trọng tải, trạng thái sẵn có.
- Doanh nghiệp có nhu cầu lưu trữ (tenant) tìm kiếm, gửi yêu cầu thuê theo gói **RACK** (thuê nguyên rack, gồm nhiều level và nhiều slot) hoặc **LEVEL** (thuê một tầng cụ thể trong rack), ký hợp đồng điện tử, và quản lý hàng hoá lưu kho.
- Đội ngũ vận hành (warehouse staff) xử lý duyệt yêu cầu, xuất/nhập hàng theo hợp đồng, theo dõi sức chứa kho theo thời gian thực.
- Đội giao vận (transport staff) + nhà cung cấp vận tải (transport provider) điều phối shipment đi kèm hợp đồng thuê, từ điểm kho đến địa chỉ khách hàng hoặc ngược lại.
- Hệ thống kế toán tự động hoá việc phát sinh hoá đơn từ hợp đồng (rental/transportation/deposit), ghi nhận thanh toán, đối soát công nợ.

Sản phẩm được thiết kế theo hướng **multi-tenant** ngay từ gốc: mọi bảng nghiệp vụ (rental request, contract, shipment, invoice…) đều gắn `tenant_id` để cô lập dữ liệu giữa các doanh nghiệp sử dụng hệ thống. Backend tự động tạo tenant record ngầm khi user `tenant_admin` tự đăng ký, giúp frontend không phải nhận thức khái niệm tenant.

Dự án là **đồ án tốt nghiệp** (capstone SEP490) nên bên cạnh mục tiêu thương mại hoá, còn có mục tiêu học thuật: áp dụng các pattern kiến trúc phổ biến (layered architecture, REST, JWT auth, OpenAPI docs, containerisation), thực hành review và CI nội bộ, và trình bày được một quy trình nghiệp vụ đầu-cuối hoàn chỉnh.

---

## Bối cảnh & vấn đề

Thị trường kho bãi cho thuê tại Việt Nam truyền thống có các điểm đau:

1. **Niêm yết thủ công, khó so sánh** — khách thuê phải liên hệ từng chủ kho qua điện thoại / Zalo / mail, không có một chuẩn mô tả "slot" thống nhất. Thông tin về kích thước, sức chứa, phí, chi nhánh thường không rõ ràng.
2. **Hợp đồng giấy, ký chậm** — quy trình yêu cầu thuê → thương thảo → ký thường kéo dài 1-2 tuần với hợp đồng giấy gửi chuyển phát nhanh, rất khó theo dõi trạng thái.
3. **Không theo dõi được sức chứa theo thời gian thực** — chủ kho thường không biết còn bao nhiêu slot trống vào một thời điểm cụ thể, dẫn đến overbook hoặc bỏ phí dung lượng.
4. **Xuất nhập hàng không có audit trail** — khi shipment ra vào kho, việc ghi nhận thường rời rạc trên Excel, khó đối soát với hợp đồng và hoá đơn.
5. **Đội vận chuyển tách rời kho** — kho và nhà xe là hai business riêng, không liên thông dữ liệu shipment; tenant phải tự coordinate.

**Smart Warehouse** giải quyết bằng cách:

- Chuẩn hoá mô hình **Warehouse → Zone → Rack → Level → Slot** ở tầng DB, mọi chủ kho đều publish theo cùng một schema.
- Workflow số hoá **Rental Request → Contract → Activate** với trạng thái minh bạch, có thể ký điện tử (lưu file URL chữ ký).
- Realtime **occupancy tracking** (trường `occupied_percent` + `occupancy_status` ở mỗi warehouse/zone) tự động cập nhật khi slot được assign vào contract item.
- Audit trail đầy đủ cho **Import/Export Records** — mỗi lần xuất nhập được gắn cứng với `contract_id` và `shipment_id`, có người xác nhận.
- Tích hợp đội vận chuyển qua module **Shipment Requests → Transport Contracts → Shipments** để tenant yêu cầu vận tải ngay trong cùng platform.

---

## Mục tiêu & phạm vi

### Mục tiêu sản phẩm

- **MVP (v0.x)** đã triển khai:
  - Đăng ký / đăng nhập bằng email + OTP, quên mật khẩu có reset qua OTP email.
  - CRUD đầy đủ cho Warehouse / Zone / Rack / Level / Slot với validate ràng buộc vật lý (kích thước slot ≤ level, level ≤ rack…).
  - Rental Request workflow end-to-end: tenant submit → staff approve/reject → sinh Contract.
  - Contract Items chi tiết assign từng slot vào contract, có giá theo chu kỳ.
  - Shipment / Shipment Request / Transport Contract.
  - Import/Export Records theo contract.
  - Invoice / Payment cơ bản.
  - Notifications nội bộ.
  - Swagger UI đầy đủ, có authorize JWT để test.
- **Sắp tới (v1.x)**:
  - Pricing rule + promotion engine động (đã có bảng, chưa có logic tính).
  - Realtime dashboard occupancy.
  - Export báo cáo PDF hoá đơn.
  - Mobile app cho warehouse staff scan barcode khi xuất/nhập.

### Phạm vi triển khai kỹ thuật

- Backend: **API-only**, không render view. Dùng JSON REST.
- Frontend (repo riêng): React + TypeScript, consume REST API.
- Infra: Docker Compose để dev, deploy hướng đến VPS Linux + Nginx reverse proxy + PostgreSQL managed.
- Data seeding / fixture: script Node tự chạy được từ Docker.
- Migration: SQL thô, đánh số `init-scripts/NN-*.sql`, Postgres container tự chạy khi init volume lần đầu. Migration bổ sung chạy tay qua `psql` (cho tới khi chuyển sang tool chuẩn như `node-pg-migrate`).

---

## Các bên tham gia (Actors)

Hệ thống có **4 actor chính**, tương ứng 4 giá trị hợp lệ ở cột `users.role`:

| Actor | Role ở DB | Mô tả nghiệp vụ | Cách tạo tài khoản |
|---|---|---|---|
| **System Admin** | `admin` | Quản trị toàn nền tảng: tạo staff, cấu hình master data, giám sát tenant, giải quyết tranh chấp. | Được tạo từ seed hoặc bởi admin khác qua `POST /api/users`. |
| **Warehouse Staff** | `warehouse_staff` | Nhân viên vận hành kho: duyệt / từ chối rental request, xác nhận xuất nhập hàng, cập nhật trạng thái slot, quản lý chi nhánh vật lý. | Admin tạo qua `POST /api/users`. |
| **Transport Staff** | `transport_staff` | Nhân viên điều phối vận chuyển: nhận shipment request, chỉ định nhà xe (transport provider), theo dõi shipment. | Admin tạo qua `POST /api/users`. |
| **Tenant Admin** | `tenant_admin` | Đại diện doanh nghiệp thuê kho: gửi rental request, ký contract, tạo shipment request, xem hoá đơn / thanh toán của chính tenant đó. | **Tự đăng ký** qua `POST /api/auth/register` → xác thực OTP email. Backend tự sinh `tenant` ngầm gắn kèm. |

Ngoài ra còn có các "actor dữ liệu" không đăng nhập:

- **Transport Provider** — nhà cung cấp vận tải (bên thứ ba), lưu ở bảng `transport_providers`. System admin thêm thông tin; transport staff chọn provider khi tạo transport contract.
- **Transport Station** — trạm trung chuyển (cross-dock) nếu shipment đi qua nhiều chặng.

---

## Mô hình nghiệp vụ tổng thể

Quy trình tổng của một **lượt thuê kho hoàn chỉnh** — từ lúc tenant tạo tài khoản đến lúc tất toán hợp đồng — được chia thành 6 giai đoạn:

```
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│ 1. Onboarding │ → │ 2. Duyệt yêu  │ → │ 3. Ký hợp     │
│   tenant      │   │    cầu thuê   │   │    đồng       │
└───────────────┘   └───────────────┘   └───────┬───────┘
                                                │
        ┌───────────────────────────────────────┘
        ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│ 4. Vận hành   │ → │ 5. Xuất kho / │ → │ 6. Hoá đơn &  │
│    & nhập kho │   │    điều phối  │   │    thanh toán │
└───────────────┘   │    giao vận   │   └───────────────┘
                    └───────────────┘
```

1. **Onboarding**: tenant admin tự đăng ký → xác thực OTP email → backend tạo user + tenant record.
2. **Duyệt yêu cầu thuê**: tenant chọn warehouse, specify loại thuê (RACK / LEVEL), thời gian, số lượng → submit `rental_request` → warehouse staff approve/reject.
3. **Ký hợp đồng**: request APPROVED tự sinh `contract` (DRAFT) → staff gửi cho tenant (SENT) → tenant ký (SIGNED) → staff activate (ACTIVE) và assign các `contract_items` = slots cụ thể.
4. **Vận hành & nhập kho**: tenant tạo `shipment_request` (IMPORT) → transport staff duyệt, cấp `transport_contract` và `shipment` → hàng về kho, warehouse staff tạo `import_export_record` kiểu IMPORT.
5. **Xuất kho / điều phối giao vận**: khi tenant cần lấy hàng ra → `shipment_request` (EXPORT) → tương tự, tạo `import_export_record` kiểu EXPORT, trừ tồn kho theo slot.
6. **Hoá đơn & thanh toán**: hệ thống phát sinh `invoice` theo chu kỳ contract (rental fee) và theo shipment (transportation fee), tenant thanh toán, payment được đối soát với invoice.

---

## Cấu trúc không gian kho

Một trong những điểm nghiệp vụ cốt lõi: **slot là đơn vị cho thuê nhỏ nhất**. Tất cả các ràng buộc về sức chứa, giá thuê, chiếm dụng đều quy về slot.

```
Branch (chi nhánh)
└── Warehouse (nhà kho)
    └── Zone (khu vực trong kho: A, B, …)
        └── Rack (giá kệ)
            └── Level (tầng của rack)
                └── Slot (ô chứa — đơn vị cho thuê)
```

Ý nghĩa từng tầng:

| Tầng | Ví dụ | Thuộc tính quan trọng | Ghi chú |
|---|---|---|---|
| **Branch** | "Chi nhánh Bình Dương" | `branch_code`, `address`, `manager_id` | Gom các warehouse cùng vùng; thường gắn với một manager warehouse_staff. |
| **Warehouse** | "Kho A1" | `warehouse_code`, dimension (L×W×H), `total_area`, `usable_area`, `occupancy_status` | Tính sức chứa tổng; `occupied_percent` cập nhật khi slot bị assign. |
| **Zone** | "Zone A — Hàng khô" | `zone_code` (UNIQUE trong warehouse), `zone_name` | Phân khu theo loại hàng / nhiệt độ / dễ vỡ. Tổng số slot = sum các rack con. |
| **Rack** | "Rack A-01" | `rack_code`, chiều cao, số level tối đa | Giá kệ vật lý. Có thể thuê nguyên rack (`rental_type = RACK`). |
| **Level** | "Level 1, 2, 3…" | `level_number`, weight capacity | Tầng của rack. Có thể thuê nguyên level (`rental_type = LEVEL`). |
| **Slot** | "Slot A-01-L1-S01" | `slot_code`, L×W×H, `status` (AVAILABLE/OCCUPIED/RESERVED/MAINTENANCE) | Đơn vị nhỏ nhất. Contract item gán vào slot cụ thể. |

**Ràng buộc vật lý** (kiểm ở controller + DB CHECK):

- `zone_code` UNIQUE theo `(warehouse_id, zone_code)` — chung kho không trùng, khác kho được phép.
- Tổng kích thước slot trong một level ≤ kích thước level.
- Level number trong rack không trùng.
- Khi zone/rack/level/slot parent bị DELETE CASCADE thì toàn bộ descendant bị xoá; nhưng thường dùng "soft" — set `status = INACTIVE` thay vì xoá cứng nếu đã có contract_item tham chiếu.

---

## Quy trình nghiệp vụ chính

### 1. Onboarding tenant

```
POST /api/auth/register
  (email, password, phone, fullName)
    └─ tạo user (role = tenant_admin, is_active = FALSE)
    └─ sinh OTP (6 số, hết hạn 5 phút), gửi email
    └─ trả userId cho FE

POST /api/auth/verify-register-otp
  (userId, otp)
    └─ đối chiếu OTP với bảng user_otps
    └─ nếu đúng:
        ├─ sinh tenant_id mới (TN0001, TN0002, …)
        ├─ INSERT tenants (company_name tạm = fullName, tax_code tạm = IND-<userId>)
        ├─ UPDATE users SET tenant_id = <new>, is_active = TRUE
        └─ sinh JWT, trả về FE
```

Điểm quan trọng: mọi user `tenant_admin` luôn có `tenant_id` từ giây phút verify OTP. Điều này giúp các endpoint sau (rental request, contract, …) không bao giờ gặp case `tenant_id IS NULL`.

### 2. Rental Request flow

```
tenant ─[POST /api/rental-requests]─> (status = PENDING)
                                           │
                             ┌─────────────┴─────────────┐
                             ▼                           ▼
                warehouse_staff approve       warehouse_staff reject
                (POST /:id/approve)            (POST /:id/reject)
                             │                           │
                             ▼                           ▼
                  status = APPROVED            status = REJECTED
                             │                 (chấm dứt)
                             ▼
                 system tự sinh Contract (status = DRAFT)
```

Payload submit:

```json
{
  "userId": "USR0005",
  "warehouseId": "WH0001",
  "rentalType": "RACK",
  "startDate": "2026-05-01",
  "endDate": "2026-11-01",
  "quantity": 2,
  "note": "Cần 2 rack zone A"
}
```

Backend tự resolve `tenantId` từ `userId` (xem `RentalRequestController.resolveTenantFromUser`). FE không phải gửi `tenantId`.

### 3. Contract lifecycle

Contract là bản ghi "chốt deal". Sau khi approve rental request, contract sẽ đi qua các trạng thái:

```
DRAFT ─(staff gửi cho tenant)─> SENT ─(tenant ký)─> SIGNED
                                                      │
                                      (staff activate + assign slot)
                                                      ▼
                                                   ACTIVE
                                                      │
                          ┌───────────────────────────┤
                          ▼                           ▼
                     COMPLETED                    CANCELLED
                  (hết hạn / tất toán)            (huỷ giữa chừng)
```

Các endpoint tương ứng:

- `POST /api/contracts/:id/send` → DRAFT → SENT
- `POST /api/contracts/:id/sign` → SENT → SIGNED (có lưu `signed_by` và `file_url` chữ ký)
- `POST /api/contracts/:id/activate` → SIGNED → ACTIVE
- `POST /api/contracts/:id/complete` → ACTIVE → COMPLETED
- `POST /api/contracts/:id/cancel` → ACTIVE/SIGNED → CANCELLED

Khi contract ACTIVE, `contract_items` được insert — mỗi item gắn với 1 slot, có `unit_price`, `billing_cycle` (MONTHLY / QUARTERLY / YEARLY), và slot đó đổi `status = OCCUPIED`.

### 4. Shipment / Transport flow

```
tenant ─[POST /api/shipment-requests]─> (shipment_type = IMPORT | EXPORT, status = PENDING)
                                                    │
                                     transport_staff approve
                                     (POST /:id/approve)
                                                    │
                                                    ▼
                                  sinh transport_contract (DRAFT)
                                                    │
                                                    ▼
                                  tenant ký, staff activate → SIGNED
                                                    │
                                                    ▼
                                  sinh shipment (SCHEDULED)
                                                    │
                      PICKED_UP → IN_TRANSIT → DELIVERED → COMPLETED
```

Khi shipment DELIVERED:

- Nếu `shipment_type = IMPORT`: warehouse staff tạo `import_export_record` kiểu IMPORT, cập nhật `slot.status = OCCUPIED` nếu chưa, ghi `quantity_in` vào stock.
- Nếu `shipment_type = EXPORT`: tạo record EXPORT, trừ tồn kho; nếu quantity về 0 và contract item kết thúc thì slot về `AVAILABLE`.

### 5. Import/Export records

Bảng `import_export_records` là **audit trail** cho mọi lần hàng đi vào / ra kho, ràng buộc cứng bởi:

- `contract_id` (NOT NULL) — chỉ được xuất/nhập theo hợp đồng đang ACTIVE.
- `shipment_id` (nullable) — link tới shipment tương ứng nếu có.
- `confirmed_by` (user_id) — nhân viên xác nhận.
- `record_type` IN (`IMPORT`, `EXPORT`).
- `quantity`, `item_description`, `note`.

Không cho phép xoá record — chỉ thêm mới. Nếu sai thì tạo record đối ứng (IMPORT để correct một EXPORT nhầm, ngược lại).

### 6. Billing & Payment

- Mỗi `contract_item` có `billing_cycle` → cron / manual sinh `invoice` mỗi kỳ.
- `invoice_type` có 4 loại: `RENTAL`, `TRANSPORTATION`, `DEPOSIT`, `OTHER`.
- `payment` gắn `contract_id`, optional gắn `invoice_id` (cho phép trả gộp nhiều invoice hoặc trả trước).
- Trạng thái invoice: `UNPAID → PARTIAL → PAID → OVERDUE`.

---

## Vòng đời trạng thái (state machine)

Tổng hợp các state machine quan trọng (mỗi transition đều có endpoint tương ứng, không tự đổi state bằng PATCH generic):

### Rental Request

| Từ | Sang | Điều kiện |
|---|---|---|
| — | `PENDING` | tenant submit |
| `PENDING` | `APPROVED` | staff approve |
| `PENDING` | `REJECTED` | staff reject (kèm lý do) |
| `APPROVED` | — | sinh contract DRAFT (không tự đổi) |

### Contract

| Từ | Sang | Endpoint |
|---|---|---|
| `DRAFT` | `SENT` | `POST /contracts/:id/send` |
| `SENT` | `SIGNED` | `POST /contracts/:id/sign` |
| `SIGNED` | `ACTIVE` | `POST /contracts/:id/activate` |
| `ACTIVE` | `COMPLETED` | `POST /contracts/:id/complete` |
| `ACTIVE` / `SIGNED` | `CANCELLED` | `POST /contracts/:id/cancel` |

### Shipment

| Từ | Sang | Điều kiện |
|---|---|---|
| — | `SCHEDULED` | tạo từ transport contract đã activate |
| `SCHEDULED` | `PICKED_UP` | driver pick hàng |
| `PICKED_UP` | `IN_TRANSIT` | bắt đầu vận chuyển |
| `IN_TRANSIT` | `DELIVERED` | đến đích |
| `DELIVERED` | `COMPLETED` | đã tạo import/export record đối ứng |
| bất kỳ | `CANCELLED` | huỷ (ghi note) |

### User

| Từ | Sang | Điều kiện |
|---|---|---|
| — | `active` (is_active=TRUE) | admin `POST /users` hoặc tenant verify OTP |
| `active` | `inactive` (is_active=FALSE) | `DELETE /api/users/:id` (soft) |
| `inactive` | `active` | `POST /api/users/:id/restore` |

---

## Mô hình dữ liệu chính

Các bảng cốt lõi (chi tiết xem `init-scripts/01-complete-schema-with-fk.sql`):

```
tenants ─┐
         │
         ▼
        users ──── user_otps
                    │
                    ▼
branches ── warehouses ── zones ── racks ── levels ── slots
                │                                        │
                │                                        │
                ▼                                        ▼
         rental_requests ──► contracts ──► contract_items
                                  │
                                  ├──► invoices ──► payments
                                  │
                                  ├──► shipment_requests
                                  │         │
                                  │         ▼
                                  │     transport_contracts
                                  │         │
                                  │         ▼
                                  └──► shipments ──► import_export_records
                                            │
                                            ▼
                                       transport_providers, transport_stations
```

**Nguyên tắc sinh ID** (qua `utils/idGenerator.js`):

- Prefix 2-3 ký tự + padding 4 chữ số: `TN0001` (tenant), `WH0001` (warehouse), `ZN0001` (zone), `RK0001` (rack), `LV0001` (level), `SL0001` (slot), `USR0001` (user), `RR0001` (rental request), `CT0001` (contract), `INV0001` (invoice), `PM0001` (payment), `SH0001` (shipment), …
- Sinh sequential trong transaction để tránh race condition; có retry nếu conflict unique.

---

## Multi-tenancy

Hệ thống là **shared-database / shared-schema multi-tenant**: tất cả tenant dùng chung DB và schema, phân biệt bằng `tenant_id` ở mọi bảng nghiệp vụ.

Cơ chế:

1. Khi user `tenant_admin` tạo tài khoản qua `/api/auth/register` → sau verify OTP, backend auto-insert một bản ghi vào `tenants` với `tenant_id` tự sinh, `company_name` tạm bằng `fullName`, `tax_code` tạm `IND-<userId>`. Tenant admin có thể update thông tin thật (company_name, tax_code, contact info) sau qua `/api/tenants/:id`.
2. Mọi endpoint tạo resource thuộc về tenant (rental request, contract, shipment…) đều lấy `tenant_id` từ `req.user.tenantId` (decode từ JWT), không tin body của client.
3. Khi tenant_admin query list (GET /rental-requests, /contracts…), backend tự filter `WHERE tenant_id = req.user.tenantId`; admin / warehouse_staff / transport_staff thấy hết data.
4. Không có endpoint nào cho tenant admin đổi `tenant_id` của resource — chống leakage data giữa các tenant.
5. Staff nội bộ (admin / warehouse_staff / transport_staff) không thuộc tenant nào, cột `users.tenant_id` của họ để NULL.

---

## Bảo mật & phân quyền

### Pipeline xác thực

```
Request ─► express json parser
         ─► CORS
         ─► requireAuth   (JWT verify, gắn req.user = { userId, role, tenantId })
         ─► requireRoles(*allowed)  (so sánh req.user.role với whitelist)
         ─► Controller
```

### Mật khẩu

- **Không bao giờ** gửi plaintext qua API xong rồi để client hash. Client gửi plaintext, **server hash bằng bcrypt** (saltRounds=10) trước khi lưu vào `users.password_hash`.
- Response không chứa `password_hash` — các hàm `mapUserRow` + `delete mapped.passwordHash` đảm bảo điều này.
- Đổi mật khẩu không qua PATCH user — phải dùng flow `POST /auth/forgot-password` → `POST /auth/reset-password` (có OTP email).

### JWT

- Sign bằng `HS256`, secret ở `JWT_SECRET`, hết hạn mặc định `7d`.
- Payload gọn: `{ userId, email, role, tenantId }`. Không nhét thêm PII.
- Frontend lưu token ở `localStorage` (với app nội bộ) hoặc `httpOnly cookie` (nếu deploy public sau này).

### Ma trận quyền theo endpoint tiêu biểu

| Endpoint | admin | warehouse_staff | transport_staff | tenant_admin | Public |
|---|---|---|---|---|---|
| `POST /auth/register` | | | | | ✅ |
| `POST /auth/login` | | | | | ✅ |
| `POST /users` (tạo staff) | ✅ | | | | |
| `PATCH /users/:id` | ✅ | | | | |
| `DELETE /users/:id` | ✅ | | | | |
| `POST /users/:id/restore` | ✅ | | | | |
| `POST /warehouses` | ✅ | ✅ | | | |
| `POST /zones` | ✅ | ✅ | | | |
| `POST /rental-requests` | | | | ✅ | |
| `POST /rental-requests/:id/approve` | ✅ | ✅ | | | |
| `POST /contracts/:id/activate` | ✅ | ✅ | | | |
| `POST /shipment-requests/:id/approve` | ✅ | | ✅ | | |

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

## Nguyên tắc thiết kế backend

Ghi lại các nguyên tắc team đã thống nhất và đang áp dụng xuyên suốt codebase. Khi review PR, dùng checklist này để đối chiếu.

### 1. Layered architecture

```
routes/         ─► chỉ khai báo URL + middleware + Swagger, không chứa logic
  ↓
controllers/    ─► validate input, gọi service / DB, map DB row ↔ domain, trả JSON
  ↓
services/       ─► dùng cho cross-cutting concern: EmailService, JwtService
  ↓
models/         ─► chỉ là metadata schema: export tableName, column names
  ↓
config/         ─► db pool, swagger config
  ↓
utils/          ─► helper thuần tuý, không side effect (idGenerator, …)
```

Controller **được phép viết SQL raw trực tiếp**; không bắt buộc tách repository. Tiêu chí: nếu query được dùng ở nhiều nơi → tách thành hàm helper trong `services/`.

### 2. Đặt tên hàm & endpoint

- Controller export các hàm tên động từ + danh từ: `createZone`, `listRentalRequests`, `approveRentalRequest`, `restoreUser`.
- Mỗi file controller phụ trách **1 resource**, đặt tên `<Resource>Controller.js`.
- Route path lowercase kebab-case (`/rental-requests`, không `/rentalRequests`).
- Action transition dùng `POST /<resource>/:id/<action>` (vd `POST /contracts/:id/activate`) thay vì nhét vào PATCH body.

### 3. Validate input

- Kiểm tra **trim + type** cho mọi string input trước khi query DB.
- Reject sớm với 400 nếu thiếu field bắt buộc, kèm message tiếng Việt rõ.
- Enum / whitelist role: ưu tiên dùng `Set` + method `has()`, không dùng `Array.includes` cho whitelist nhiều phần tử.
- ID tham chiếu (warehouseId, tenantId…): validate tồn tại ở DB trước khi INSERT, trả 400 nếu không tồn tại. Không dựa vào FK constraint DB để trả 500.

### 4. Mapping DB ↔ API

- DB cột luôn `snake_case`, JSON response luôn `camelCase`.
- Mỗi controller có `mapXxxRow(row)` làm chuyển đổi, đặt ở đầu file.
- Không trả cột `password_hash` ra response — xoá trong mapping.
- Field optional nullable: dùng `row.field ?? null` để đồng nhất, tránh trộn `undefined` và `null`.

### 5. Transaction

- Bất kỳ operation nào ghi vào >1 bảng (ví dụ register user + tạo tenant) đều dùng `pool.connect()` + `BEGIN ... COMMIT/ROLLBACK`.
- Rollback trong `catch`, đừng quên `client.release()` trong `finally`.
- Tránh gọi API ngoài (SMTP send email) trong transaction — đẩy ra ngoài sau khi commit để không giữ connection.

### 6. Lỗi & HTTP status

| Tình huống | Status | Ghi chú |
|---|---|---|
| Thiếu input / sai format | `400` | Trả `{ message }` bằng tiếng Việt |
| Chưa đăng nhập | `401` | `requireAuth` tự trả |
| Không đủ role | `403` | `requireRoles` tự trả |
| Resource không tồn tại | `404` | |
| Conflict unique / state | `409` | VD: email trùng, user đang active mà gọi restore |
| Lỗi khác | `500` | Luôn log `console.error` kèm context |

### 7. Idempotency

- Endpoint transition state (approve, reject, activate, restore…) phải idempotent — gọi lần 2 trên state đã đúng trả 409 hoặc 200 tuỳ ngữ nghĩa, không phá dữ liệu.
- Seed script idempotent bằng cách dùng `ON CONFLICT DO NOTHING` hoặc check `SELECT` trước `INSERT`.

### 8. Swagger-first

- Mỗi route **phải có** comment `@swagger`. PR review từ chối nếu thiếu.
- Body schema khai báo đầy đủ `required`, `enum`, `description` bằng tiếng Việt.
- Response documentation: ít nhất liệt kê 200, 400, 401, 403, 404 (nếu applicable).

### 9. Git flow

- Branch naming: `feature/<ticket>`, `fix-<topic>`, `refactor-<topic>`.
- Commit message theo convention: `<type>(<scope>): <subject>` — `feat`, `fix`, `refactor`, `docs`, `chore`, `test`.
- Commit nhỏ, 1 commit 1 ý. Tránh commit gộp 10 thay đổi không liên quan.
- Không commit `.env`, `node_modules`, build artefact.

### 10. Docker reproducibility

- `.dockerignore` chặn `node_modules` host để tránh lẫn native binary sai platform.
- `Dockerfile` install `python3 make g++ libc6-compat` để build được `bcrypt` / các native module.
- Init scripts số thứ tự tăng dần, tên có tiền tố `NN-`. Sẽ chạy duy nhất 1 lần khi Postgres volume rỗng.

---

## Roadmap

### Đã có (hiện tại)

- [x] Đăng ký / đăng nhập / OTP / đổi mật khẩu.
- [x] Admin tạo staff nội bộ (role whitelist, server hash password).
- [x] CRUD warehouse / zone / rack / level / slot.
- [x] Rental request → Contract → Contract items.
- [x] Shipment request → Transport contract → Shipment.
- [x] Import/Export records.
- [x] Invoice / Payment cơ bản.
- [x] Notifications.
- [x] Swagger UI đầy đủ.
- [x] Multi-tenant với auto-create tenant khi register.
- [x] Soft delete + restore user.

### Đang làm / sắp tới

- [ ] Pricing engine: áp dụng `pricing_rules` + `promotions` khi sinh invoice.
- [ ] Scheduler / cron để tự sinh invoice theo `billing_cycle`.
- [ ] Upload file chữ ký hợp đồng (S3 / local storage).
- [ ] Dashboard occupancy realtime (WebSocket hoặc polling).
- [ ] Export PDF hoá đơn, bảng kê.
- [ ] Audit log cho tất cả action quan trọng (ai, làm gì, khi nào).
- [ ] Rate limit cho auth endpoints (chống brute force).
- [ ] Unit test + integration test coverage ≥ 60%.
- [ ] CI pipeline (GitHub Actions): lint + test + build Docker image.
- [ ] Migration tool chuẩn (`node-pg-migrate`) thay cho init-scripts thủ công.

### Ý tưởng dài hạn

- [ ] Mobile app cho warehouse staff scan QR khi xuất/nhập.
- [ ] AI gợi ý vị trí slot tối ưu theo loại hàng / tần suất xuất.
- [ ] IoT integration: sensor nhiệt độ / độ ẩm từng zone.
- [ ] Marketplace công khai: tenant tìm kiếm kho theo filter vị trí, sức chứa, giá.

---

## License

ISC — Dự án nội bộ, mục đích học tập (SEP490).

