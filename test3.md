# Unit Test Case Matrix — Create Staff Accounts

> **Mục đích**: Ma trận UT (decision table) cho **#17 Create Warehouse Staff** và **#37 Create Tenant Staff**.  
> **Tham chiếu**: `docs/test1.md`, `POST /api/users`, FE `AccountModal.tsx`, `ManageAccount.tsx`.  
> **Ký hiệu**: **O** = điều kiện/kết quả áp dụng cho cột UT CID đó · **N** = Normal · **A** = Abnormal · **B** = Boundary  
> **Phiên bản**: 1.0 — 2026-05-30

---

## 1. Create Warehouse Staff (#17)

**Function**: Create Warehouse Staff Account  
**Actor**: Warehouse Admin (`WH_ADMIN`)  
**API**: `POST /api/users` · **FE**: `/admin/accounts` → **Thêm tài khoản** → role **Warehouse Staff (Nhân viên kho)** (`WH_STAFF`) → **Tạo tài khoản**  
**Scope**: `warehouseId` kế thừa từ WH Admin (không chọn kho trên form).

### 1.1 Input fields (điều kiện kiểm thử)

| Field (API) | Label FE | Kiểu | Bắt buộc | Giá trị hợp lệ (Valid) | Giá trị không hợp lệ / biên |
|-------------|----------|------|----------|------------------------|-----------------------------|
| `fullName` | **Họ và tên** | string | Có (BE) | `"NV Kho A"` | Empty / chỉ khoảng trắng |
| `email` | **Email** | string | Có | Email chưa tồn tại, VD `staff@warehouse.local` | null / empty / trùng email hệ thống |
| `password` | **Mật khẩu** | string | Có | ≥ 8 ký tự, VD `Staff@12345` | null / empty / &lt; 8 ký tự |
| `confirmPassword` | **Xác nhận mật khẩu** | string (FE only) | Có (FE) | Trùng `password` | Khác `password` |
| `role` | **Vai trò** | enum | Có | `WH_STAFF` | `TENANT_STAFF`, `WH_ADMIN`, … (creator không được tạo) |
| `phone` | **Số điện thoại** | string | Không | `0901234567` hoặc để trống | — |
| `status` | **Trạng thái** | enum | Không (mặc định) | `ACTIVE` (mặc định BE) | — |
| `warehouseId` | *(ẩn)* | uuid | Tự gán | Kế thừa `creator.warehouseId` | Gửi `warehouseId` khác → `403` |

### 1.2 Unit Test matrix

| | | **UT WH01** | **UT WH02** | **UT WH03** | **UT WH04** | **UT WH05** | **UT WH06** | **UT WH07** | **UT WH08** | **UT WH09** | **UT WH10** |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Condition** | | | | | | | | | | | |
| | WH Admin account exists and is `ACTIVE` | O | O | O | O | O | O | O | O | O | O |
| | WH Admin is logged in (Bearer token) | O | O | O | O | O | O | O | O | | O |
| | Target warehouse exists in system | O | O | O | O | O | O | O | O | O | O |
| | **fullName** — Valid | O | | O | O | O | O | O | O | O | O |
| | **fullName** — Invalid (empty / whitespace) | | O | | | | | | | | |
| | **email** — Valid (new, unique) | O | O | | O | O | O | O | O | O | O |
| | **email** — Invalid (null / empty) | | | O | | | | | | | |
| | **email** — Invalid (duplicate in DB) | | | | | | O | | | | |
| | **email** — Invalid (malformed format) | | | | | | | | | | O |
| | **password** — Valid (≥ 8 chars) | O | O | O | | O | O | O | O | O | O |
| | **password** — Invalid (null / empty) | | | | O | | | | | | |
| | **password** — Boundary (&lt; 8 chars, e.g. 7) | | | | | O | | | | | |
| | **confirmPassword** — Valid (matches password) | O | O | O | O | | O | O | O | O | O |
| | **confirmPassword** — Invalid (mismatch) | | | | | | | O | | | |
| | **role** — Valid (`WH_STAFF`) | O | O | O | O | O | O | O | | O | O |
| | **role** — Invalid (`TENANT_STAFF` via API tamper) | | | | | | | | O | | |
| | **phone** — Valid (optional, with value) | | | | | | | | | O | |
| | **phone** — Valid (optional, empty) | O | O | O | O | O | O | O | O | | O |
| **Confirm** | | | | | | | | | | | |
| | **Return** — Success | O | | | | | | | | O | |
| | **Return** — Fail | | O | O | O | O | O | O | O | | O |
| | **Exception** — Thrown | | O | O | O | O | O | O | O | | O |
| | **Log message** — Success: **"Tạo tài khoản thành công."** | O | | | | | | | | O | |
| | **Log message** — `fullName is required` | | O | | | | | | | | |
| | **Log message** — FE: **"Vui lòng nhập email"** / BE: `email is required` | | | O | | | | | | | |
| | **Log message** — FE: **"Mật khẩu tối thiểu 8 ký tự"** / BE: `Mật khẩu phải có ít nhất 8 ký tự` | | | | O | O | | | | | |
| | **Log message** — FE: **"Mật khẩu không khớp"** | | | | | | | O | | | |
| | **Log message** — HTTP `409` `DUPLICATE` (email exists) | | | | | | O | | | | |
| | **Log message** — `Role WH_ADMIN cannot create user with role TENANT_STAFF` (`403`) | | | | | | | | O | | |
| | **Log message** — `Authentication required` / redirect `/login` | | | | | | | | | | O |
| **Result** | | | | | | | | | | | |
| | **Type** | N | A | A | A | B | A | A | A | N | A |
| | **Passed / Failed** | P | F | F | F | F | F | F | F | P | F |
| | **Executed Date** | | | | | | | | | | |
| | **Defect ID** | | | | | | | | | | |

### 1.3 Mô tả nhanh từng UT CID

| UT CID | Mô tả |
|--------|--------|
| **UT WH01** | Happy path: đủ **Họ và tên**, **Email** mới, **Mật khẩu** ≥ 8, **Xác nhận** khớp, role **Nhân viên kho** → tạo thành công, staff login được `/staff/dashboard`. |
| **UT WH02** | Bỏ trống **Họ và tên** → BE `400` `fullName is required`. |
| **UT WH03** | Bỏ trống **Email** → FE alert trước khi gọi API. |
| **UT WH04** | Bỏ trống **Mật khẩu** → BE `400` (password strength). |
| **UT WH05** | **Mật khẩu** 7 ký tự → FE/BE từ chối. |
| **UT WH06** | **Email** đã tồn tại → `409` `DUPLICATE`. |
| **UT WH07** | **Xác nhận mật khẩu** ≠ **Mật khẩu** → FE chặn, không gọi API. |
| **UT WH08** | Gửi API `role: "TENANT_STAFF"` khi creator là WH Admin → `403` `FORBIDDEN`. |
| **UT WH09** | Có **Số điện thoại** hợp lệ + các trường khác valid → success (phone optional). |
| **UT WH10** | Chưa login / token hết hạn → `401` hoặc redirect login. |

---

## 2. Create Tenant Staff (#37)

**Function**: Create Tenant Staff Account  
**Actor**: Tenant Admin (`TENANT_ADMIN`)  
**API**: `POST /api/users` · **FE**: `/staff/accounts` → **Thêm tài khoản** → role **Tenant Staff (Nhân viên tenant)** (`TENANT_STAFF`) → **Tạo tài khoản**  
**Scope**: `tenantId` kế thừa từ Tenant Admin (không chọn tenant trên form).

### 2.1 Input fields (điều kiện kiểm thử)

| Field (API) | Label FE | Kiểu | Bắt buộc | Giá trị hợp lệ (Valid) | Giá trị không hợp lệ / biên |
|-------------|----------|------|----------|------------------------|-----------------------------|
| `fullName` | **Họ và tên** | string | Có (BE) | `"NV Brand"` | Empty / chỉ khoảng trắng |
| `email` | **Email** | string | Có | Email chưa tồn tại, VD `tenantstaff@brand.local` | null / empty / trùng email |
| `password` | **Mật khẩu** | string | Có | ≥ 8 ký tự | null / empty / &lt; 8 ký tự |
| `confirmPassword` | **Xác nhận mật khẩu** | string (FE only) | Có (FE) | Trùng `password` | Khác `password` |
| `role` | **Vai trò** | enum | Có | `TENANT_STAFF` | `WH_STAFF`, `TENANT_ADMIN`, … |
| `phone` | **Số điện thoại** | string | Không | Tùy chọn | — |
| `status` | **Trạng thái** | enum | Không | `ACTIVE` (mặc định) | — |
| `tenantId` | *(ẩn)* | uuid | Tự gán | Kế thừa `creator.tenantId` | Gửi `tenantId` khác → `403` |

### 2.2 Unit Test matrix

| | | **UT TS01** | **UT TS02** | **UT TS03** | **UT TS04** | **UT TS05** | **UT TS06** | **UT TS07** | **UT TS08** | **UT TS09** | **UT TS10** |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Condition** | | | | | | | | | | | |
| | Tenant Admin account exists and is `ACTIVE` | O | O | O | O | O | O | O | O | O | O |
| | Tenant Admin is logged in (Bearer token) | O | O | O | O | O | O | O | O | | O |
| | Tenant company exists in system | O | O | O | O | O | O | O | O | O | O |
| | Active contract for tenant (khuyến nghị E2E) | O | O | O | O | O | O | O | O | O | O |
| | **fullName** — Valid | O | | O | O | O | O | O | O | O | O |
| | **fullName** — Invalid (empty / whitespace) | | O | | | | | | | | |
| | **email** — Valid (new, unique) | O | O | | O | O | O | O | O | O | O |
| | **email** — Invalid (null / empty) | | | O | | | | | | | |
| | **email** — Invalid (duplicate in DB) | | | | | | O | | | | |
| | **email** — Invalid (malformed format) | | | | | | | | | | O |
| | **password** — Valid (≥ 8 chars) | O | O | O | | O | O | O | O | O | O |
| | **password** — Invalid (null / empty) | | | | O | | | | | | |
| | **password** — Boundary (&lt; 8 chars) | | | | | O | | | | | |
| | **confirmPassword** — Valid (matches password) | O | O | O | O | | O | O | O | O | O |
| | **confirmPassword** — Invalid (mismatch) | | | | | | | O | | | |
| | **role** — Valid (`TENANT_STAFF`) | O | O | O | O | O | O | O | | O | O |
| | **role** — Invalid (`WH_STAFF` via API tamper) | | | | | | | | O | | |
| | **phone** — Valid (optional, with value) | | | | | | | | | O | |
| | **phone** — Valid (optional, empty) | O | O | O | O | O | O | O | O | | O |
| **Confirm** | | | | | | | | | | | |
| | **Return** — Success | O | | | | | | | | O | |
| | **Return** — Fail | | O | O | O | O | O | O | O | | O |
| | **Exception** — Thrown | | O | O | O | O | O | O | O | | O |
| | **Log message** — Success: **"Tạo tài khoản thành công."** | O | | | | | | | | O | |
| | **Log message** — `fullName is required` | | O | | | | | | | | |
| | **Log message** — FE: **"Vui lòng nhập email"** / BE: `email is required` | | | O | | | | | | | |
| | **Log message** — FE: **"Mật khẩu tối thiểu 8 ký tự"** / BE: `Mật khẩu phải có ít nhất 8 ký tự` | | | | O | O | | | | | |
| | **Log message** — FE: **"Mật khẩu không khớp"** | | | | | | | O | | | |
| | **Log message** — HTTP `409` `DUPLICATE` (email exists) | | | | | | O | | | | |
| | **Log message** — `Role TENANT_ADMIN cannot create user with role WH_STAFF` (`403`) | | | | | | | | O | | |
| | **Log message** — `Authentication required` / redirect `/login` | | | | | | | | | | O |
| **Result** | | | | | | | | | | | |
| | **Type** | N | A | A | A | B | A | A | A | N | A |
| | **Passed / Failed** | P | F | F | F | F | F | F | F | P | F |
| | **Executed Date** | | | | | | | | | | |
| | **Defect ID** | | | | | | | | | | |

### 2.3 Mô tả nhanh từng UT CID

| UT CID | Mô tả |
|--------|--------|
| **UT TS01** | Happy path: Tenant Admin tạo **Nhân viên tenant** → success, staff login `/staff/dashboard`. |
| **UT TS02** | **Họ và tên** trống → `400` `fullName is required`. |
| **UT TS03** | **Email** trống → FE **"Vui lòng nhập email"**. |
| **UT TS04** | **Mật khẩu** trống → BE validation. |
| **UT TS05** | **Mật khẩu** &lt; 8 ký tự. |
| **UT TS06** | **Email** trùng user khác → `409` `DUPLICATE`. |
| **UT TS07** | **Xác nhận mật khẩu** không khớp. |
| **UT TS08** | API `role: "WH_STAFF"` với creator Tenant Admin → `403`. |
| **UT TS09** | Có **Số điện thoại** + các trường còn lại valid. |
| **UT TS10** | Không có session → không tạo được account. |

---

## 3. Payload mẫu (API)

### 3.1 Create Warehouse Staff

```http
POST /api/users
Authorization: Bearer <whAdminAccessToken>
Content-Type: application/json

{
  "fullName": "NV Kho A",
  "email": "staff@warehouse.local",
  "password": "Staff@12345",
  "role": "WH_STAFF",
  "phone": "0901234567"
}
```

### 3.2 Create Tenant Staff

```http
POST /api/users
Authorization: Bearer <tenantAdminAccessToken>
Content-Type: application/json

{
  "fullName": "NV Brand",
  "email": "tenantstaff@brand.local",
  "password": "Staff@12345",
  "role": "TENANT_STAFF"
}
```

---

## 4. Ghi chú triển khai

| Mục | Warehouse Staff (#17) | Tenant Staff (#37) |
|-----|------------------------|---------------------|
| Creator được phép | `WH_ADMIN` → `WH_STAFF`, `WH_TRANSPORTER` | `TENANT_ADMIN` → `TENANT_STAFF` |
| Scope tự gán | `warehouseId` = kho của WH Admin | `tenantId` = brand của Tenant Admin |
| FE validation trước API | email, password ≥ 8, confirm match | Giống |
| BE validation | `fullName`, `email`, `role`, password strength | Giống |
| Duplicate email | PostgreSQL unique → `409` `DUPLICATE` | Giống |
| Liên kết test case tích hợp | `TC_WHAD_007` | `TC_TAD_001` |

> Khi chạy UT thực tế: điền **Executed Date** và **Defect ID** trên ma trận; đổi **P/F** theo kết quả test.
