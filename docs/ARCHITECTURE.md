# Smart Warehouse — Architecture Deep-Dive

Tài liệu giải thích kiến trúc và design decision của backend. Đọc file này nếu bạn muốn hiểu tại sao code được viết như hiện tại, trước khi propose refactor lớn.

## Mục lục

1. [High-level architecture](#high-level-architecture)
2. [Request lifecycle](#request-lifecycle)
3. [Layered structure](#layered-structure)
4. [Authentication & authorization](#authentication--authorization)
5. [Transaction management](#transaction-management)
6. [Error handling](#error-handling)
7. [ID generation](#id-generation)
8. [Email service](#email-service)
9. [Swagger integration](#swagger-integration)
10. [Docker layout](#docker-layout)
11. [Logging & monitoring](#logging--monitoring)
12. [Testing strategy](#testing-strategy)
13. [Deployment plan](#deployment-plan)
14. [Design decisions (ADR-lite)](#design-decisions-adr-lite)

---

## High-level architecture

```
  ┌────────────┐         ┌──────────────┐         ┌──────────────┐
  │  Frontend  │  HTTPS  │   Nginx      │  HTTP   │  Node.js     │
  │  (React)   │────────►│  Reverse     │────────►│  Express API │
  └────────────┘         │  Proxy       │         │  (this repo) │
                         └──────────────┘         └──────┬───────┘
                                                         │
                                         ┌───────────────┼───────────────┐
                                         ▼               ▼               ▼
                                 ┌────────────┐  ┌──────────────┐  ┌──────────┐
                                 │ PostgreSQL │  │   SMTP       │  │  Future: │
                                 │  (RDS /    │  │   (Gmail /   │  │  S3, Redis│
                                 │   native)  │  │   SendGrid)  │  │  queue   │
                                 └────────────┘  └──────────────┘  └──────────┘
```

- **1 container app** chạy Express, stateless, scale horizontal dễ.
- **1 container Postgres** (dev) / managed DB (prod).
- **SMTP bên ngoài**, không chạy mail server local.
- Không có background worker / queue ở MVP. Khi cần scheduler (sinh invoice theo chu kỳ) sẽ thêm node-cron trong cùng process hoặc tách worker riêng.

### Nguyên tắc chung

- **Stateless server**: không lưu session in-memory. Auth hoàn toàn qua JWT.
- **DB là source of truth**: không cache aggressively (chưa cần Redis).
- **API-first**: không render HTML; FE hoàn toàn là React SPA.
- **Container-friendly**: `.env` override qua Docker, không hardcode config.

---

## Request lifecycle

Tracing một request từ lúc client gửi đến lúc response trả về:

```
Client ─► Nginx ─► Express (server.js)
             │           │
             │           ├─ cors()           (allow FE origin)
             │           │
             │           ├─ express.json()   (parse body)
             │           │
             │           ├─ Route matcher    (Express router)
             │           │
             │           ├─ requireAuth      (verify JWT, gắn req.user)
             │           │
             │           ├─ requireRoles(…)  (check role)
             │           │
             │           ├─ Controller handler
             │           │      │
             │           │      ├─ Parse/validate req.body
             │           │      ├─ Business rule check
             │           │      ├─ DB query (pg pool)
             │           │      ├─ Map DB row → domain object
             │           │      └─ res.status().json(…)
             │           │
             │           └─ Error middleware (nếu throw)
             │
             └─ Response ─────► Client
```

### Middleware stack (server.js)

```js
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
// …các router khác
app.use(errorHandler); // catch-all
```

### JWT verify flow

Trong `AuthMiddleware.js::requireAuth`:

1. Đọc header `Authorization: Bearer <token>`.
2. Nếu không có → 401.
3. `jwt.verify(token, JWT_SECRET)`:
   - Thành công → gắn decoded payload vào `req.user = { userId, email, role, tenantId }`.
   - `TokenExpiredError` → 401 với `{ message: "Token hết hạn, vui lòng đăng nhập lại" }`.
   - Khác → 401 generic.
4. `next()`.

### Role check flow

`requireRoles('admin', 'warehouse_staff')`:

1. Nếu `req.user` chưa gắn → 401 (dev quên đặt `requireAuth` trước).
2. Nếu `req.user.role` không trong danh sách allowed → 403.
3. Nếu OK → `next()`.

---

## Layered structure

```
src/
├── config/               # App-level config (DB, Swagger)
├── controllers/          # Business logic + HTTP handler
├── middlewares/          # Express middleware
├── models/               # Static metadata (table name, column names)
├── routes/               # URL declarations + Swagger annotations
├── services/             # Cross-cutting: Email, JWT
└── utils/                # Helper pure functions
```

### Ranh giới giữa các tầng

| Tầng | Được phép làm | KHÔNG được làm |
|---|---|---|
| `routes/` | Khai báo URL, middleware, Swagger JSDoc | Logic DB, tính toán |
| `controllers/` | Validate input, gọi DB, map row, throw/return lỗi HTTP | Khai báo URL, render HTML |
| `services/` | Wrap call ngoài (SMTP, future S3), tạo token JWT | Đọc req / res trực tiếp |
| `middlewares/` | Xử lý auth, logging, rate limit | Business logic |
| `models/` | Export hằng, tên bảng | Query DB |
| `utils/` | Pure function (sinh ID, format date) | Side effect |

### Tại sao không có tầng repository / DAO riêng?

Quyết định intentional ở MVP:

- Số controller ~20; mỗi controller query không quá 3-4 bảng.
- Code SQL raw trong controller dễ trace hơn là query method chia nhiều file.
- Khi codebase lớn hơn + nhiều query dùng chung → sẽ refactor dần tách ra `services/<resource>Service.js`.

Ví dụ refactor đã làm: `AuthController.js` tách hàm `createImplicitTenantForUser` và `generateNextTenantId` thành helper trong cùng file (vì chỉ dùng nội bộ).

---

## Authentication & authorization

### JWT details

- **Algorithm**: HS256.
- **Secret**: env `JWT_SECRET`, ít nhất 32 ký tự ngẫu nhiên.
- **TTL**: env `JWT_EXPIRES_IN`, default `7d`.
- **Payload**:

```json
{
  "userId": "USR0012",
  "email": "kh@example.com",
  "role": "tenant_admin",
  "tenantId": "TN0005",
  "iat": 1745280000,
  "exp": 1745884800
}
```

### Tại sao không refresh token?

- MVP ưu tiên đơn giản. Access token TTL dài (7d), acceptable cho app nội bộ.
- Roadmap: tách access token (15m) + refresh token (30d) lưu trong DB + rotate khi refresh.

### Authorization model

- **Role-Based Access Control (RBAC)** qua `requireRoles`.
- Không dùng ABAC (attribute-based) — để đơn giản.
- Tenant isolation thực hiện ở controller: `WHERE tenant_id = req.user.tenantId` khi role = tenant_admin.

### Các endpoint public (không cần token)

- `POST /auth/register`
- `POST /auth/verify-register-otp`
- `POST /auth/login`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `GET /health`
- `GET /api-docs/*`

---

## Transaction management

### Pattern

```js
const client = await pool.connect();
try {
  await client.query('BEGIN');

  // ... nhiều query ...

  await client.query('COMMIT');
  return res.status(201).json(result);
} catch (err) {
  await client.query('ROLLBACK');
  throw err;
} finally {
  client.release();
}
```

### Khi nào dùng transaction

- Operation ghi vào **≥ 2 bảng** (register user + tạo tenant).
- Operation cần atomic: contract activate + insert contract_items + update slot status.
- Khi sinh ID sequential cần khoá: `SELECT FOR UPDATE` trên bảng tenants khi sinh `TN####`.

### Các operation hiện đã dùng transaction

| Nơi | Bảng ảnh hưởng | File |
|---|---|---|
| Register + auto-tenant | `users`, `tenants`, `user_otps` | `AuthController.register` |
| Verify OTP + activate | `users`, `user_otps` | `AuthController.verifyRegisterOtp` |
| Contract activate | `contracts`, `contract_items`, `slots` | `ContractController.activateContract` |
| Shipment DELIVERED | `shipments`, `import_export_records` | (roadmap) |

### Chống race condition trên ID generator

`utils/idGenerator.js` hiện tại:

```js
export async function generatePrefixedId(pool, { tableName, idColumn, prefix }) {
  const { rows } = await pool.query(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(${idColumn} FROM ${prefix.length + 1}) AS INTEGER)), 0) + 1 AS next
     FROM ${tableName}
     WHERE ${idColumn} ~ $1`,
    [`^${prefix}[0-9]+$`],
  );
  return `${prefix}${String(rows[0].next).padStart(4, '0')}`;
}
```

**Hạn chế**: nếu 2 request đồng thời cùng sinh ID, cả 2 sẽ lấy giá trị cùng nhau → UNIQUE VIOLATION.

**Hiện tại mitigation**:

- Catch error code `23505` và retry 1-2 lần.
- Vì lưu lượng MVP thấp, xác suất conflict rất thấp.

**Roadmap**:

- Chuyển sang `SERIAL` hoặc sequence Postgres để sinh phần số, rồi format ở app.
- Hoặc dùng advisory lock `pg_advisory_xact_lock` trong transaction.

---

## Error handling

### Philosophy

- **Fail fast**: validate sớm, throw sớm.
- **Consistent shape**: response lỗi luôn có field `message`, optional `errors[]`.
- **Log context**: khi 500, `console.error(err)` kèm request path / body (mask password).

### Error categories

| Loại | Cách xử lý |
|---|---|
| **Validation** (missing field, wrong format) | Controller tự return 400 với message rõ. |
| **Business rule** (zone code trùng, contract sai state) | Return 400 hoặc 409. |
| **Not found** (user id không tồn tại) | Return 404. |
| **Auth** (sai password, token hết hạn) | 401 hoặc 403 tuỳ ngữ nghĩa. |
| **DB constraint** (unique violation) | Try-catch `err.code === '23505'`, trả 409. |
| **DB FK violation** | `err.code === '23503'`, trả 400 "Dữ liệu tham chiếu không hợp lệ". |
| **Unknown** | Log + trả 500 generic. |

### Global error middleware

`server.js` có catch-all ở cuối:

```js
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Internal server error' });
});
```

Mục đích: network error, JSON parse error, middleware crash.

---

## ID generation

Đã mô tả ở phần Transaction. Ở đây mô tả thêm về pattern đặt prefix:

| Resource | Prefix | Ví dụ |
|---|---|---|
| Tenant | `TN` | `TN0005` |
| User | `USR` | `USR0012` |
| Branch | `BR` | `BR0002` |
| Warehouse | `WH` | `WH0001` |
| Zone | `ZN` | `ZN0001` |
| Rack | `RK` | `RK0001` |
| Level | `LV` | `LV0001` |
| Slot | `SL` | `SL0001` |
| Rental Request | `RR` | `RR0001` |
| Contract | `CT` | `CT0001` |
| Contract Item | `CI` | `CI0001` |
| Shipment Request | `SR` | `SR0001` |
| Transport Contract | `TC` | `TC0001` |
| Shipment | `SH` | `SH0001` |
| Import/Export Record | `IER` | `IER0001` |
| Invoice | `INV` | `INV0001` |
| Payment | `PM` | `PM0001` |
| Notification | `NT` | `NT0001` |

Prefix chọn ngắn để ID dễ đọc trong UI.

---

## Email service

File `services/EmailService.js` wrap `nodemailer`:

```js
export async function sendEmail({ to, subject, html }) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    html,
  });
}
```

### Các template email đang dùng

| Template | Trigger | Nội dung |
|---|---|---|
| Register OTP | `POST /auth/register` | Mã OTP 6 số + nút confirm |
| Forgot password OTP | `POST /auth/forgot-password` | Mã OTP reset |
| Contract sent | `POST /contracts/:id/send` | Link ký hợp đồng (roadmap) |
| Invoice issued | Cron sinh invoice | Thông báo hoá đơn mới |

### Khi SMTP_USER / SMTP_PASS trống

- Dev mode: email log ra console, không gửi thật.
- Prod: throw 500 nếu cấu hình thiếu.

---

## Swagger integration

### Setup

```js
// config/swagger.js
import swaggerJsdoc from 'swagger-jsdoc';

export const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: { title: 'Smart Warehouse API', version: '0.6.0' },
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
  },
  apis: ['./src/routes/*.js'], // đọc JSDoc từ route files
});
```

### Cách viết Swagger JSDoc

Mỗi route có comment `@swagger` ngay trước `router.<method>`:

```js
/**
 * @swagger
 * /api/zones:
 *   post:
 *     tags: [Zones]
 *     summary: ...
 *     security: [{ bearerAuth: [] }]
 *     requestBody: { ... }
 *     responses:
 *       201: { description: Created }
 */
router.post('/', requireAuth, requireRoles('admin', 'warehouse_staff'), createZone);
```

### Lợi ích

- Single source of truth: code và doc sống cùng file.
- Swagger UI tự reload khi code thay đổi.
- FE developer có thể test trực tiếp trên `/api-docs` mà không cần Postman.

### Hạn chế

- Swagger JSDoc verbose, dễ out-of-date nếu không chăm update.
- Không tự generate schema từ TypeScript type (project dùng JS thuần).

---

## Docker layout

### `Dockerfile`

```dockerfile
FROM node:18-alpine

RUN apk add --no-cache python3 make g++ libc6-compat

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 3000
CMD ["node", "server.js"]
```

Key points:

- `python3 make g++` để build native module (`bcrypt`).
- `libc6-compat` cho alpine tương thích glibc.
- COPY `package*.json` trước để tận dụng layer cache.
- COPY toàn code **sau khi** `npm install` — tránh host `node_modules` làm bẩn image.

### `.dockerignore`

```
node_modules
npm-debug.log
.env
.env.*
.git
.gitignore
Dockerfile
docker-compose.yml
*.md
```

### `docker-compose.yml`

```yaml
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: warehouse_admin
      POSTGRES_PASSWORD: SP26SE040@!
      POSTGRES_DB: smart_warehouse
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./init-scripts:/docker-entrypoint-initdb.d
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U warehouse_admin -d smart_warehouse"]

  app:
    build: .
    env_file: .env
    ports:
      - "${API_HOST_PORT:-3000}:3000"
    depends_on:
      postgres:
        condition: service_healthy

volumes:
  postgres-data:
```

---

## Logging & monitoring

### Hiện tại

- `console.log` / `console.error` vào stdout của container.
- `docker compose logs -f app` để tail.
- Không có structured log (chưa dùng Winston / Pino).

### Roadmap

- Structured log JSON để Grafana Loki ingest.
- Request ID middleware gắn `x-request-id` để correlate log trên nhiều service.
- APM: Sentry cho error tracking ở FE + BE.
- Metrics: Prometheus exporter (count request, latency p95).

---

## Testing strategy

### Hiện tại

- Ít test tự động (MVP ưu tiên ship feature).
- Test thủ công qua Swagger UI + Postman collection.

### Kế hoạch

- **Unit test** (Jest): util, service pure function.
- **Integration test** (supertest + test DB): mỗi endpoint một test suite.
- **E2E test**: Playwright chạy FE + BE, cover happy path.
- Target coverage: 60% cho MVP → 80% cho v1.

### Test DB

- Dedicated schema `test_smart_warehouse` hoặc container Postgres riêng.
- Seed fixture trước mỗi test, teardown sau.

---

## Deployment plan

### Môi trường

| Env | Nơi chạy | DB | Domain |
|---|---|---|---|
| Local dev | Docker Compose trên máy cá nhân | Postgres container | localhost:3000 |
| Staging | VPS (DigitalOcean / Vultr), 1 node | Postgres same VPS | staging.smartwarehouse.local |
| Production | VPS hoặc managed platform | Managed Postgres (Supabase / RDS) | api.smartwarehouse.local |

### CI/CD (roadmap)

- GitHub Actions: PR → lint → test → build Docker image → push registry.
- Staging tự deploy khi merge `main`.
- Production deploy bằng tag release.

### Zero-downtime deploy

- Chạy 2 container app sau Nginx load balance.
- Rolling update: kill 1 container, update, lên lại, rồi đến container 2.

### Backup

- `pg_dump` hàng ngày, upload lên S3.
- Giữ 7 bản gần nhất.

---

## Design decisions (ADR-lite)

Tổng hợp các quyết định thiết kế đã discuss trong team:

### ADR-001: Không dùng ORM

- **Context**: Node ecosystem có Prisma, TypeORM, Sequelize. Team cân nhắc dùng hay không.
- **Decision**: Dùng `pg` raw SQL.
- **Consequence**: Query linh hoạt, debug dễ; đổi lại mất type safety và tự map row → object.

### ADR-002: JWT thay vì session cookie

- **Context**: App chủ yếu mobile-like SPA, có khả năng mở rộng multi-client.
- **Decision**: JWT + stateless.
- **Consequence**: Không cần Redis / DB cho session; khó revoke token trước hạn — chấp nhận.

### ADR-003: Password hash ở server

- **Context**: FE đề xuất hash ở client rồi gửi hash lên.
- **Decision**: Client gửi plaintext qua HTTPS, server hash bằng bcrypt.
- **Lý do**: Tránh lệch thuật toán FE/BE; hash client rồi gửi đồng nghĩa hash đó = password mới, không có lợi ích bảo mật.

### ADR-004: Auto tạo tenant khi register

- **Context**: FE đề xuất bỏ tenant concept khỏi UI.
- **Decision**: Giữ bảng tenants ở DB, backend tự insert tenant ngầm khi user tenant_admin register.
- **Consequence**: FE không phải hiểu tenant; các bảng nghiệp vụ vẫn có tenant_id để cô lập data.

### ADR-005: `rental_request.tenantId` → `userId` trong API

- **Context**: FE muốn dùng userId cho đồng nhất.
- **Decision**: API contract dùng userId; backend resolve sang tenantId qua helper.
- **Consequence**: DB schema không đổi; response vẫn camelCase.

### ADR-006: ID format `<PREFIX><4-digit>` thay vì UUID

- **Context**: UUID dài, khó đọc trong UI.
- **Decision**: Dùng prefix + sequential 4 digit.
- **Consequence**: User-friendly; đổi lại phải handle race condition khi sinh ID.

### ADR-007: Role whitelist cho admin-created users

- **Context**: Admin tạo account cho staff nội bộ.
- **Decision**: Whitelist `admin`, `warehouse_staff`, `transport_staff`. Không cho tạo `tenant_admin` (end-user phải tự register).
- **Lý do**: Bảo mật (admin không thể mạo danh tenant) + workflow nghiệp vụ rõ ràng.

### ADR-008: Soft delete user (không hard delete)

- **Context**: User bị xoá nhưng history (contract, invoice) vẫn refer.
- **Decision**: `DELETE /users/:id` chỉ flip `is_active`, không xoá row. Có endpoint `POST /users/:id/restore`.
- **Consequence**: Đảm bảo referential integrity; FK `ON DELETE SET NULL` được giữ như dự phòng.

### ADR-009: Không dùng `updated_at` auto trigger

- **Context**: Có thể dùng Postgres trigger để auto set `updated_at = NOW()`.
- **Decision**: Set thủ công trong UPDATE query.
- **Lý do**: Đơn giản, không phụ thuộc DB feature; tránh hidden magic khi debug.

### ADR-010: Swagger JSDoc thay vì file spec riêng

- **Context**: Có thể viết `openapi.yaml` tách riêng.
- **Decision**: Swagger JSDoc ngay trong route file.
- **Consequence**: Doc live cùng code, đổi lại verbose hơn.

---
