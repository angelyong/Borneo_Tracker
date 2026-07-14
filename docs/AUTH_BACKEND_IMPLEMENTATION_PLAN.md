# Borneo Tracker 登录、认证后端与用户数据库实施计划

**状态：** 已通过安全、架构/数据库、QA/上线三项独立审查并合并修订，可作为实施基线
**范围：** 登录、注册、登出、会话、邮箱验证、忘记/重置密码、个人资料、修改密码、路由保护
**不在本阶段：** 社交登录、MFA、组织/团队、多租户、复杂后台权限管理

## 1. 结论：这样做是否正确

方向正确，但必须把“登录 UI”升级为一个模块化单体应用后端和持久化的 transactional application PostgreSQL，不能把用户账号写入现有的 `borneo_tracker.db`。这里的“独立”只表示与指标 SQLite 隔离，不代表现在拆成 Auth 微服务。未来 Community、Incident、Profile 等事务型业务表也进入同一个应用 PostgreSQL，并以真实外键引用 `users.id`。

原因：

1. `borneo_tracker.db` 是数据管线产物，`load_db.py` 会重建表并发布快照；它不是长期保存用户账号的应用数据库。
2. 现有 `authToken = demo-session` 存在 `localStorage`，没有服务器验证，不能代表真实身份。
3. 项目未来的 Community 发帖、Incident Report、Profile、后台管理都会需要同一个真实用户身份，所以认证应成为独立、可复用的基础服务。
4. Borneo Tracker 的 ESG/SDG 数据仍保持“Python 管线 → SQLite → 静态 JSON”，认证后端不应改变这条已经工作的公开数据链路。

推荐最终结构：

```text
浏览器 React/Vite
  ├─ 公开读取 /data/*.json              -> 现有 ESG/SDG 静态数据
  └─ 调用 /api/auth/*、/api/users/me    -> 新应用 API
                                                │
                                                ▼
                                      Application PostgreSQL
                                      auth/users + future community/incidents

Python 数据管线 -> borneo_tracker.db -> public/data/*.json
                 （绝不存放用户或 Session）
```

### 1.1 审查后冻结的 v1 决策

以下决定用于消除实现分叉；后文若出现“可选”或“由产品决定”，以这里为准：

1. 架构是 **Node 模块化单体 + 一个应用 PostgreSQL**，不是 Auth 微服务。
2. 前端与 API 生产环境优先同源；Vite 和浏览器代码始终使用相对 `/api`。
3. PENDING 用户不能建立正常登录 Session；完成邮箱验证后变为 ACTIVE 才能登录。
4. Dashboard、Regions、ESG、SDG、News、About、Data Sources、Reports 和 Community 阅读保持公开。
5. `/profile` 只允许 ACTIVE 用户；Community 发帖/评论/点赞及 `/incident_report` 写入只允许 ACTIVE 用户。
6. `/submission` 在 v1 保留兼容重定向到 `/incident_report`，但不再显示为菜单项；`/settings` 不属于 v1，不能留下可点击死链接。
7. Logout 成功后统一导航 `/login`。
8. Register 对新邮箱和已存在邮箱统一返回 `202` 与相同公开文案，避免账号枚举。
9. Reset Password 撤销全部 Session且不自动登录；Change Password 撤销其他 Session并轮换当前 Session与 CSRF token。
10. 邮件使用 PostgreSQL transactional outbox + 独立 worker；原始 token 只能进入短生命周期的加密 payload。
11. Verify/Reset token 必须在真实 PostgreSQL 事务中原子消费，并发请求恰好一个成功。
12. Verify/Reset 邮件链接使用 URL fragment（`#token=...`），而不是 query string；GET 链接不改变账号状态。
13. CSRF 使用本计划第 8.3 节定义的唯一 HMAC 同步协议，不由实施者另选方案。
14. Phase 2–4 只能进入开发/Staging；Phase 6 所有安全与恢复门槛通过前禁止生产发布。

## 2. 现有内容与需要替换的位置

### 2.1 可以保留的 UI

- `src/pages/auth/LoginPage.jsx`
- `src/pages/auth/RegisterPage.jsx`
- `src/pages/auth/ForgotPasswordPage.jsx`
- `src/pages/auth/ResetPasswordPage.jsx`
- `src/components/AuthLayout.jsx`
- `src/components/ui.jsx` 中的输入框、按钮、Modal

这些页面的视觉设计可继续使用，只替换提交逻辑、错误处理、Loading 状态和成功流程。

### 2.2 必须移除的演示逻辑

- 删除所有 `localStorage.setItem('authToken', 'demo-session')`。
- 删除用 `localStorage.removeItem('authToken')` 代替服务器登出的逻辑。
- Forgot Password 不再直接跳转到 Reset Password。
- Reset Password 必须要求来自邮件的一次性 token。
- Profile 不再使用 `INITIAL_USER`；资料来自 `/api/users/me`。
- Top bar 不再显示固定的 `Admin User` 和 `admin@borneotracker.org`。
- Community 的固定身份 `CURRENT_USER = 'You'` 后续应改为真实 `user.id`；这属于认证落地后的下一项集成，不在第一批数据库迁移中强行完成。

### 2.3 需要修正的布局问题

`/profile` 已经位于全局 `Layout` 内，但 `MyProfile.jsx` 又渲染一套 Sidebar 和 MiniTopBar。实施认证时应同时移除 Profile 内部重复布局，让页面只渲染资料内容。

## 3. 技术选型

### 3.1 推荐技术栈

| 层 | 选择 | 原因 |
|---|---|---|
| Runtime | 当前受支持的 Node.js LTS | 与 React 项目同一 JavaScript 生态；生产只使用 LTS |
| Backend | TypeScript + Express | 路由、中间件和测试生态成熟；TypeScript 减少认证数据形状错误 |
| Database | PostgreSQL | 适合持久用户、唯一约束、事务、并发、备份和未来 Community 数据 |
| ORM / migration | Prisma ORM + Prisma Migrate | schema、类型安全访问与 SQL migration 可提交版本控制 |
| Validation | Zod 或同等级 schema validator | 后端必须独立验证所有输入，不能信任前端 |
| Password hashing | Argon2id | 使用内存困难型密码哈希；参数按部署硬件基准测试后至少达到 OWASP 最低要求 |
| Authentication | 服务端 opaque session | 可以撤销、查看和强制退出 Session；比把长期 JWT 放在 localStorage 更适合当前网页应用 |
| Cookie | `__Host-bt_session` | `HttpOnly; Secure; SameSite=Lax; Path=/`，不设置 Domain |
| Email | Provider adapter | 开发使用 Mailpit/日志邮箱；生产接入已批准的交易邮件服务 |
| Test | Vitest + Supertest + Playwright | 单元、API 集成和浏览器流程分层覆盖 |

### 3.2 为什么不推荐把 JWT 放进 localStorage

- JavaScript 可读取 localStorage；发生 XSS 时 token 更容易被直接窃取。
- 登出、密码重置、封禁账号和“退出所有设备”都需要服务器撤销能力。
- 当前产品是浏览器站点，并没有必须无状态认证的移动客户端需求。

因此第一版使用随机、高熵、数据库可撤销的 Session token。数据库只保存 token 的哈希，浏览器 Cookie 保存原始 token。

### 3.3 部署假设

首选让前端与 API 同源，例如：

```text
https://borneotracker.example/       -> React 静态文件
https://borneotracker.example/api/   -> Express API
```

同源能减少 CORS、Cookie 与 CSRF 配置错误。如果最后必须跨域部署，必须在开发前确认准确域名，再配置明确的 CORS allowlist、credentials 和 Cookie 策略；禁止使用 `Access-Control-Allow-Origin: *` 配合凭证。

## 4. 建议目录和文件位置

```text
Borneo_Tracker/
├─ server/
│  ├─ package.json
│  ├─ tsconfig.json
│  ├─ prisma/
│  │  ├─ schema.prisma
│  │  └─ migrations/
│  ├─ src/
│  │  ├─ app.ts                    # Express app，不监听端口，供测试复用
│  │  ├─ server.ts                 # 启动与 graceful shutdown
│  │  ├─ worker.ts                 # transactional email outbox worker
│  │  ├─ config/env.ts             # 环境变量 schema 与 fail-fast
│  │  ├─ db/client.ts
│  │  ├─ middleware/
│  │  │  ├─ authenticate.ts
│  │  │  ├─ csrf.ts
│  │  │  ├─ rateLimit.ts
│  │  │  ├─ requestId.ts
│  │  │  └─ errorHandler.ts
│  │  ├─ modules/auth/
│  │  │  ├─ auth.routes.ts
│  │  │  ├─ auth.controller.ts
│  │  │  ├─ auth.service.ts
│  │  │  ├─ auth.repository.ts
│  │  │  ├─ auth.schemas.ts
│  │  │  ├─ password.ts
│  │  │  ├─ session.ts
│  │  │  └─ tokens.ts
│  │  ├─ modules/users/
│  │  │  ├─ user.routes.ts
│  │  │  ├─ user.service.ts
│  │  │  └─ user.schemas.ts
│  │  ├─ email/
│  │  │  ├─ email.provider.ts
│  │  │  ├─ verificationEmail.ts
│  │  │  └─ resetPasswordEmail.ts
│  │  └─ security/audit.ts
│  └─ tests/
│     ├─ unit/
│     ├─ integration/
│     └─ fixtures/
├─ src/
│  ├─ auth/
│  │  ├─ AuthProvider.jsx
│  │  ├─ ProtectedRoute.jsx
│  │  ├─ GuestOnlyRoute.jsx
│  │  └─ useAuth.js
│  └─ services/authService.js
├─ tests/e2e/auth.spec.js
├─ docker-compose.yml               # 本地 PostgreSQL + Mailpit
└─ .github/workflows/ci.yml
```

根 `package.json` 改为 npm workspaces（frontend/root + `server`），保留一个根 `package-lock.json`，提供统一 `dev`, `test`, `build` orchestration；API/worker 共用 server build artifact。不要同时留下两套互不一致的 lockfile，也不要把 API 代码混入 Python 数据管线脚本。

## 5. 数据库设计

认证数据库使用单独的 `DATABASE_URL`。生产与开发均使用 PostgreSQL，测试使用独立测试数据库/schema，避免 SQLite 与 PostgreSQL 行为差异。

### 5.1 `users`

| 字段 | 类型/规则 | 用途 |
|---|---|---|
| `id` | UUID PK | 不暴露连续用户数量 |
| `email` | text | 原始/展示用邮箱 |
| `email_normalized` | text UNIQUE | `trim + lowercase` 后的唯一登录键 |
| `password_hash` | text | Argon2id 编码串，绝不存原密码 |
| `first_name` | varchar | 注册资料 |
| `last_name` | varchar | 注册资料 |
| `role` | enum `USER/ADMIN` | 服务器授权；客户端不能自行提交 |
| `status` | enum `PENDING/ACTIVE/SUSPENDED` | 邮箱验证、正常、停用 |
| `email_verified_at` | nullable timestamp | 邮箱验证状态 |
| `password_changed_at` | timestamp | Session/安全判断 |
| `auth_version` | bigint default 1 | 单调递增的认证世代；使正在进行的旧凭证 Login 失效 |
| `last_login_at` | nullable timestamp | 安全与支持用途 |
| `created_at` | timestamp | 审计 |
| `updated_at` | timestamp | 审计 |

规则：

- 数据库唯一约束是并发注册的最终防线，不能只先查再插入。
- API 永远不返回 `password_hash`。
- 第一个 Admin 不通过公开注册参数产生；使用受控 seed/CLI 或生产环境一次性操作创建。
- 更改登录邮箱要走“新邮箱验证”流程，不能单靠 Profile PATCH 直接生效。

状态机固定为：`register -> PENDING -> verify -> ACTIVE`；管理员可执行 `ACTIVE -> SUSPENDED -> ACTIVE`。数据库或服务层必须拒绝 `ACTIVE + email_verified_at IS NULL` 等非法组合。PENDING/SUSPENDED 都不能建立正常 Session；SUSPENDED 用户可申请 reset，但重置密码不会自动解除 suspended。

### 5.1a `user_profiles`

Profile PII 与认证核心拆成一对一表，减少认证查询和隐私暴露面：

| 字段 | 类型/规则 |
|---|---|
| `user_id` | UUID PK/FK `users(id) ON DELETE CASCADE` |
| `phone_country_code` | nullable varchar(8) |
| `phone_number` | nullable varchar(32) |
| `address_line` | nullable varchar(200) |
| `city` | nullable varchar(100) |
| `state` | nullable varchar(100) |
| `postal_code` | nullable varchar(20)；对应现有 UI 的 `postal` |
| `version` | integer default 1，用于防止两个页面静默覆盖资料 |
| `created_at/updated_at` | `timestamptz` |

注册只收 email、password、first name、last name；电话和地址都是可选 Profile 字段。现有 UI 中 Address 的必填星号应移除，除非隐私评审确认业务确实需要强制收集。

### 5.2 `sessions`

| 字段 | 类型/规则 | 用途 |
|---|---|---|
| `id` | UUID PK | Session 记录标识 |
| `user_id` | UUID FK | 所属用户 |
| `token_hash` | char/text UNIQUE | 对 Cookie token 做 SHA-256 后存储 |
| `auth_version` | bigint | 创建 Session 时复制 `users.auth_version` |
| `created_at` | timestamptz | 创建时间 |
| `last_seen_at` | timestamptz | 闲置超时判断，节流更新 |
| `expires_at` | timestamptz | 绝对过期时间 |
| `revoked_at` | nullable timestamptz | 登出/强制撤销 |
| `user_agent` | bounded nullable text | 设备列表展示；作为不可信文本处理 |
| `ip_hash` | nullable text | 可选风控；避免无期限保存原始 IP |

Session token 使用 CSPRNG 生成至少 256 bit 随机值。登录成功后创建新 Session，绝不接受客户端指定 Session ID。密码修改、密码重置、邮箱确认、logout-all、账号停用等安全状态变更必须在同一事务递增 `users.auth_version`；所有旧版本 Session 即时失效。需要保留当前设备时，只能在新版本下轮换创建当前 Session。

v1 Session 有效期：

- 默认绝对有效期 7 天。
- v1 不实现 “Remember me”；UI、DTO 和 30 天分支全部删除。未来新增时作为单独安全变更。
- v1 闲置窗口固定 24 小时；部署评审只能通过有记录的安全变更收紧/调整。
- `last_seen_at` 每 15 分钟最多更新一次，避免每次请求都写数据库；Cookie Max-Age 不是服务器安全判断。

### 5.3 `email_verification_tokens`

| 字段 | 内容 |
|---|---|
| `id`, `user_id` | 主键和用户 FK |
| `token_hash` | 只存 token 哈希 |
| `expires_at` | v1 固定 24 小时 |
| `used_at` | 一次性使用 |
| `created_at` | 审计 |

重新发送时撤销同用途的旧 token。邮件 URL 的 host 来自受信任的 `APP_PUBLIC_URL`，不能根据请求的 Host header 动态生成。

Verification、reset、email-change token 统一使用 CSPRNG 至少 256 bit、固定长度 URL-safe 编码；只接受服务器生成的 token。

### 5.4 `password_reset_tokens`

与验证 token 分表，字段类似：`id`, `user_id`, `token_hash`, `expires_at`, `used_at`, `created_at`。v1 固定 30 分钟有效；创建新 token 时使旧 token 失效；成功重置后使所有该用户重置 token 失效并撤销所有现有 Session。Email-change token v1 同样固定 30 分钟；verification resend cooldown 固定 60 秒，并限制每账号/每 IP 每 24 小时最多 5 次（部署前可按压测收紧）。

### 5.5 `auth_audit_events`

记录安全事件，不记录密码、原始 Session token 或原始 reset token。

建议字段：`id`, `user_id nullable`, `event_type`, `result`, `request_id`, `ip_hash nullable`, `user_agent nullable`, `metadata JSONB`, `created_at`。

事件包括：注册、验证邮箱、登录成功/失败、登出、登出所有设备、忘记密码申请、重置成功/失败、修改密码、邮箱变更、账号停用。日志要设保留期限并限制访问。

### 5.6 `email_change_requests`

字段：`id`, `user_id`, `new_email`, `new_email_normalized`, `token_hash UNIQUE`, `expires_at`, `used_at`, `created_at`。

- v1 发起变更固定要求提交 current password；不实现未定义的 recent-auth proof。
- 新邮箱验证前不替换当前登录邮箱。
- token 必须绑定 user、用途和具体 `new_email_normalized`。
- Confirm endpoint 要求该 user 的 ACTIVE Session；若邮件链接在未登录设备打开，先走安全 Login returnTo，再提交 token，不能仅凭 token 匿名换邮箱。
- 确认时在事务中原子消费 request、重新检查邮箱唯一性、更新用户、递增 `auth_version`、撤销其他 email-change request/Session，并在新版本下轮换当前 Session，写审计和新旧邮箱通知 outbox。
- `PATCH /api/users/me` 明确拒绝 email、role、status、email_verified_at。

### 5.7 `email_outbox`

| 字段 | 规则 |
|---|---|
| `id` | UUID PK |
| `event_type` | verification/reset/password_changed/email_changed |
| `recipient` | bounded email |
| `encrypted_payload` / `key_version` | 认证加密的短生命周期邮件数据及密钥版本 |
| `dedupe_key` | UNIQUE，防重复逻辑事件 |
| `status` | pending/processing/sent/dead |
| `attempt_count` | integer |
| `next_attempt_at/locked_at/sent_at/created_at` | `timestamptz` |
| `provider_message_id` | nullable bounded text |
| `last_error_code` | 脱敏错误码，不存完整 provider body |

用户、token、audit、outbox 在同一个 PostgreSQL 事务写入；事务内不调用邮件 provider。Worker 通过 `FOR UPDATE SKIP LOCKED` 抢任务，使用有上限的指数退避：`pending -> processing -> sent`；可重试失败回到 `pending` 并设置 `next_attempt_at`；超过上限进入终态 `dead` 并告警。投递语义是 at-least-once；`dedupe_key` 只对一个逻辑事件唯一（包含 request/token event id），每次合法 resend 产生新事件，不被旧 UNIQUE 永久阻挡。provider 支持 idempotency key 时传稳定 outbox ID。包含原始 token 的 payload 使用 secret manager 中的独立 keyring 做认证加密，记录 `key_version`；旧 key 保留到相关 queue drain，decrypt failure 进入 dead 并告警。发送成功后立即清空 payload；原始 token URL 不得进入 provider metadata、日志或错误信息。Password changed 通知也通过 outbox 异步发送，邮件失败不能回滚已经成功的密码事务。

### 5.8 数据库共同约束与清理

- 所有时间使用 UTC `timestamptz`；服务器时间是 expiry 权威。
- Session/token 外键 `ON DELETE CASCADE`；audit 的 `user_id ON DELETE SET NULL` 并在删除时去标识化。
- 索引：`sessions(token_hash) UNIQUE`、`sessions(user_id, revoked_at, expires_at)`、各 token `token_hash UNIQUE`、token `(user_id, used_at, expires_at)`、audit `(event_type, created_at)`/`(user_id, created_at)`、outbox `(status, next_attempt_at)`。
- 所有 text/varchar、user-agent、metadata 都有长度或 schema allowlist。
- 定时任务清理过期 Session、已用/过期 token、长期 PENDING 账号、已发送 outbox payload；审计与 PII 保留期按第 16 节上线决策执行。

### 5.9 `email_suppressions`

为 bounce/complaint/suppression webhook 提供可查询的持久状态：`id`, `recipient_lookup_hmac UNIQUE`, `encrypted_recipient`, `key_version`, `reason`, `source`, `provider_event_id UNIQUE`, `created_at`, `cleared_at`。Lookup 使用独立 secret 的 HMAC，原邮箱认证加密；普通 hash 不足以保护可枚举邮箱。Webhook 以 provider event id 幂等 upsert，worker/enqueue 前检查未 cleared 的 suppression 并拒绝调用 provider。用户申诉解除只能走受审计的 support/admin 运维流程；邮箱变更后按新 recipient 独立判断。表的加密/HMAC key rotation、retention 和删除遵守第 11/16 节。

## 6. API 合约

所有 API 使用 `/api` 前缀、JSON、统一错误结构和 request ID。输入验证在 Controller 边界进行，业务规则放 Service，数据库访问放 Repository/Prisma 层。

统一错误示例：

```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Email or password is incorrect.",
    "requestId": "..."
  }
}
```

生产响应不返回 stack trace、SQL 错误或“该邮箱存在/不存在”等敏感细节。

### 6.0 合约先行要求

编码前必须提交并审查 `server/openapi/auth.yaml`（或同等级可机器验证合约），前后端测试从该合约校验。合约至少冻结：request/response DTO、required/nullable、最大长度、规范化、Cookie set/clear 属性、稳定 error code、`fieldErrors`、`Retry-After`、成功后的用户/Session 状态。`GET /api/auth/me` 只做认证 bootstrap；`GET /api/users/me` 返回完整 Profile，两者不能维护两套冲突字段。

v1 字段边界：email 原始长度 ≤254；first/last name 各 1–100；password 12–128 个 Unicode code points；phone ≤32；address ≤200；city/state ≤100；postal code ≤20。邮箱规范化统一调用一个共享函数：trim 外围空白、拒绝控制字符、域名按 IDNA 处理、按明确产品策略 lowercase；不做 Gmail dot/plus 等 provider-specific 合并。最终唯一性只由 `email_normalized` 数据库唯一索引保证。

核心 endpoint 合约基线：

| Route | Request DTO | Success | 稳定错误/状态 |
|---|---|---|---|
| `GET /api/auth/csrf` | none | `200 {csrfToken}` + 必要的 pre-auth Cookie | `503 AUTH_UNAVAILABLE` |
| `POST /api/auth/register` | `{email,password,firstName,lastName}` | 始终 `202 {message}` | `400 VALIDATION_ERROR`, `429 RATE_LIMITED` |
| `POST /api/auth/verify-email` | `{token}` | `200 {verified:true}` | `400 TOKEN_INVALID_OR_EXPIRED` |
| `POST /api/auth/resend-verification` | `{email}` | 始终 `202 {message}` | `400`, `429` + `Retry-After` |
| `POST /api/auth/login` | `{email,password}` | `200 {user,csrfToken}` + Session Cookie | `401 INVALID_CREDENTIALS`, `403 EMAIL_NOT_VERIFIED/ACCOUNT_SUSPENDED`, `429` |
| `GET /api/auth/me` | none | `200 {user:{id,email,firstName,lastName,role,emailVerified}}` | `401 SESSION_INVALID`, `503 AUTH_UNAVAILABLE` |
| `POST /api/auth/logout` | Optional Session + no body | 始终 `204` + 完整清 Cookie；可识别 Session则撤销 | 有 Cookie 时验证绑定 CSRF；Origin 失败为 `403` |
| `POST /api/auth/logout-all` | `{currentPassword}` | `204` + 撤销全部 Session并清 Cookie | `401 CURRENT_PASSWORD_INVALID/SESSION_INVALID` |
| `POST /api/auth/forgot-password` | `{email}` | 始终 `202 {message}` | `400`, `429`，不暴露账号 |
| `POST /api/auth/reset-password` | `{token,password,confirmPassword}` | `200 {reset:true}` + 清 Session Cookie | `400 TOKEN_INVALID_OR_EXPIRED`, `429` |
| `POST /api/auth/change-password` | `{currentPassword,password,confirmPassword}` | `200 {csrfToken}` + 轮换 Session Cookie | `400`, `401 CURRENT_PASSWORD_INVALID` |
| `GET /api/users/me` | none | `200 {user,profile,version}` | `401`, `503` |
| `PATCH /api/users/me` | allowlist profile fields + `version` | `200 {user,profile,version}` | `409 PROFILE_VERSION_CONFLICT`, `422` |
| `POST /api/users/me/change-email` | `{newEmail,currentPassword}` | 始终 `202 {message}` | `401/403`, `429` |
| `POST /api/users/me/confirm-email-change` | ACTIVE Session（必须匹配 token.user_id）+ `{token}` + auth CSRF | `200 {user,csrfToken}` + 撤销其他 Session、轮换当前 Session | `401 SESSION_INVALID`, `403 TOKEN_USER_MISMATCH`, `400 TOKEN_INVALID_OR_EXPIRED`, `409 EMAIL_ALREADY_IN_USE` |
| `POST /api/webhooks/email` | provider payload + signature headers | `200/204` 幂等确认 | `401 INVALID_WEBHOOK_SIGNATURE`, `400` |

所有 `429` 带 `Retry-After`；所有认证与 PII 响应带 `Cache-Control: no-store`。清 Cookie 时 name、Path、Secure、SameSite 与设置时完全一致。Email webhook 使用 provider 签名、timestamp/replay window 与 event-id 幂等，不使用浏览器 CSRF。

### 6.1 认证接口

| Method | Route | 身份 | 行为 |
|---|---|---|---|
| `POST` | `/api/auth/register` | Guest | 创建 PENDING 用户、哈希密码、发送验证邮件 |
| `GET` | `/api/auth/csrf` | Optional | 建立/读取 pre-auth 或 auth 上下文，返回内存使用的 CSRF token |
| `POST` | `/api/auth/verify-email` | Guest | 验证一次性 token，激活账号 |
| `POST` | `/api/auth/resend-verification` | Guest | 统一响应，限流后重发 |
| `POST` | `/api/auth/login` | Guest | 验证凭证、创建 Session、Set-Cookie |
| `GET` | `/api/auth/me` | Optional | 返回当前用户；未登录返回 401 |
| `POST` | `/api/auth/logout` | Optional Session | 可识别则撤销当前 Session；无论是否已过期都清 Cookie并幂等 204 |
| `POST` | `/api/auth/logout-all` | User + current password | 撤销包括当前在内的全部 Session、清 Cookie，前端变 anonymous 并跳 `/login` |
| `POST` | `/api/auth/forgot-password` | Guest | 无论邮箱是否存在都返回相同消息 |
| `POST` | `/api/auth/reset-password` | Guest + token | 单次使用 token，更换密码、撤销 Session |
| `POST` | `/api/auth/change-password` | User | 验证 current password 后更换并撤销其他 Session |

### 6.2 用户资料接口

| Method | Route | 行为 |
|---|---|---|
| `GET` | `/api/users/me` | 获取当前 Profile |
| `PATCH` | `/api/users/me` | 更新允许的资料字段 |
| `POST` | `/api/users/me/change-email` | 开始新邮箱验证，不直接替换登录邮箱 |
| `POST` | `/api/users/me/confirm-email-change` | 原子消费新邮箱 token、更新邮箱并轮换 Session |

所有写接口必须有：认证（适用时）、输入验证、body size limit、Origin/CSRF 防护、限流和审计。

### 6.3 HTTP 状态基线

- `200/201`：成功。
- `204`：登出成功，即使当前 Session 已不存在也可幂等返回。
- `400`：请求格式或 token 无效/过期。
- `401`：没有有效 Session 或凭证错误。
- `403`：已登录但无权操作、未验证邮箱访问受限写功能。
- `409`：只用于 Profile version/最终 email-change 等并发冲突；Register 不使用 409，统一返回 202。
- `422`：字段验证失败（如果团队统一选择 400，也可保持一致）。
- `429`：限流。

## 7. 完整用户流程

### 7.1 注册与邮箱验证

1. Register UI 校验必填、邮箱格式、密码确认；这只是体验校验。
2. 后端重新验证所有字段，规范化邮箱，在事务中创建用户。
3. 使用 Argon2id 哈希密码；不记录原始密码。
4. 创建随机邮箱验证 token，数据库只存哈希。
5. 在同一事务写入加密 `email_outbox`，由独立 worker 在事务外发送和重试。
6. UI 显示“检查邮箱”，而不是直接当作已登录。
7. 用户点击 `/verify-email#token=...`；前端在任何其他请求前读取 fragment、立即 `history.replaceState` 清理，然后把 token POST 给 API。
8. 后端验证未使用、未过期、匹配的 token，激活用户并标记 token 已使用。
9. 用户回到 Login 正常登录。

Verify 必须用条件 UPDATE/行锁在单一事务内消费 token；只有 `used_at IS NULL AND expires_at > now()` 的更新成功者才能激活账号。消费 token、更新状态、撤销同用途 token、写 audit/outbox 在同一事务；并发双击恰好一个成功。

Register/Resend 对所有账号状态返回相同 202/body/headers，并执行同等级的输入校验和限流；Register 各状态执行同等级密码哈希成本，Resend 对无副作用分支执行有上限的等价 dummy work/最小响应窗口，避免明显时序枚举。副作用固定为：新邮箱创建 PENDING + verification outbox；已有 PENDING 在 cooldown/每日上限允许时轮换 verification token并入 outbox，不覆盖原密码/姓名；已有 ACTIVE/SUSPENDED 不修改账号、不发送验证 token。Resend 对不存在/ACTIVE/SUSPENDED 同样无账号副作用，对 PENDING 按 cooldown 重发。受控测试比较公开响应一致性与可接受时序差异。

### 7.2 登录

1. Login POST email/password，fetch 使用 `credentials: 'include'`。
2. 后端先应用 IP 与账号维度限流。
3. 规范化 email，查找用户；不存在时仍执行接近等价的假哈希验证，减少计时枚举。
4. 使用通用错误 `Email or password is incorrect.`，不透露是哪一项错误。
5. 检查固定状态规则：只有 `ACTIVE + email_verified_at != null` 可登录；PENDING 返回 `EMAIL_NOT_VERIFIED`，SUSPENDED 返回 `ACCOUNT_SUSPENDED`。
6. Argon2 验证成功后不能直接插入 Session：进入短数据库事务重新锁定/条件读取 user，确认 normalized login email、`password_hash`、`status`、`email_verified_at` 与开始验证时的 `auth_version` 全部未改变，才允许以当前 `auth_version` 插入 Session并更新 `last_login_at`/audit。任一改变则拒绝本次 Login，防止旧密码/旧邮箱验证完成后跨越 reset/change-email/logout-all 竞态创建新 Session。
7. 前端刷新 AuthProvider，跳转到经过验证的相对 `returnTo`，默认 `/`。

### 7.3 Session 恢复和路由保护

1. App 启动时 `AuthProvider` 请求 `/api/auth/me`。
2. 请求完成前状态为 `loading`，避免先显示受保护页面再闪回 Login。
3. 401 => `anonymous`；200 => 保存最小化 user object 到 React state；网络超时/离线/5xx => `unavailable`，不能伪装成登出。
4. `ProtectedRoute` 只保护需要身份的路由；不能把前端保护当作服务器授权替代品。
5. 每个受保护 API 仍由后端验证 Session 和角色。

认证中间件每次请求同时检查：Session 未撤销、绝对未过期、未超过 idle window、所属用户仍为 ACTIVE、email 仍已验证、`session.created_at >= user.password_changed_at`，并且 `session.auth_version === user.auth_version`。Role/status 不永久缓存于 Session。数据库不可用时 fail closed 并返回 503，不能相信前端缓存身份。`last_seen_at` 每 15 分钟最多写一次；定期清理过期记录。

v1 固定访问矩阵：

| 功能 | Guest | 已验证 User | Admin |
|---|---:|---:|---:|
| Dashboard / Regions / ESG / SDG / News / About | Read | Read | Read |
| Community feed | Read | Read + 发帖/评论/点赞 | 同 User，未来可 moderation |
| Reports | Read/Generate | Read/Generate | Read/Generate |
| `/profile` | No | Own data | Own data |
| `/incident_report` submission | No | Create own | Create own；Review 不在 v1 |
| `/submission` | redirect `/incident_report` | redirect | redirect |
| Admin APIs | No | No | v1 不提供 Admin API |

这里最重要的是保持 Borneo Tracker 的公开数据使命：不应为了加入 Login 而强制所有人登录后才能看 ESG/SDG Dashboard。

在 Phase 5 真正把 Community 写入 API 前，必须用 feature flag 隐藏/禁用 Start discussion、Like、Comment 等写操作；不能让 production 继续把 browser-local demo 写入误认为真实用户数据。读取 seed posts 可继续公开。

### 7.4 登出

1. Sidebar 和 MiniTopBar 都调用同一个 `auth.logout()`。
2. Logout 是 optional-session endpoint：始终验证精确 Origin；若 Cookie 能映射到 Session则验证对应 CSRF并撤销，Session 已失效/不存在仍清 Cookie并返回 204，避免用户被坏 Cookie 卡住。无 Cookie 时直接清 Cookie属性并幂等 204。
3. 前端清空 AuthProvider 的 user state。
4. 不再清空整个 `sessionStorage`，避免误删与认证无关的页面状态。
5. 统一导航到 `/login`。

Logout-all 不是普通 logout 的幂等别名：它要求有效当前 Session 和 current password；成功事务递增 `auth_version` 并撤销包括当前在内的全部 Session，清 Session/pre-auth Cookie 与内存 CSRF，所有 tab 在重新检查后进入 anonymous 并导航 `/login`。账号 suspend/unsuspend 等安全状态改变同样递增版本，阻止已完成密码验证但尚未插入 Session 的并发 Login。

### 7.5 Forgot / Reset Password

1. 用户提交邮箱。
2. API 对存在和不存在的账号返回完全相同的消息，并尽量保持相近响应时长。
3. 对真实可用账号创建随机、一次性、短时 reset token；数据库只保存哈希。
4. 邮件包含固定受信任域名的 HTTPS fragment 链接：`/reset-password#token=...`；fragment 不发送给静态服务器/CDN。
5. Reset 页面没有 token 时不能提交；token 无效/过期时显示重新申请入口。
6. 成功后在一个数据库事务中原子消费 token、更新 Argon2id hash/password_changed_at、递增 `auth_version`、使其他 reset token 失效、撤销所有 Session、写 audit 和通知 outbox。条件消费没有返回记录时统一视为无效/过期/已使用；并发请求恰好一个成功。
7. 不自动登录；显示成功后返回 Login，并发送“密码已更改”通知邮件。
8. Reset 页面设置严格 Referrer Policy，避免 token 通过 Referer 泄漏。

### 7.6 Profile 与修改密码

- Profile mount 后从 `/api/users/me` 读取真实资料。
- 保存资料 PATCH 到服务器，成功后更新 AuthProvider user。
- Email 更换是独立验证流程。
- 修改密码要求 current password、new password、confirm；后端验证 current password。
- Change Password 成功后在同一事务递增 `auth_version`、撤销其他 Session，并在新版本下轮换当前 Session token 与 CSRF token；密码更新、撤销、轮换和 audit 事务边界必须明确。Reset Password 则递增版本、撤销全部 Session且不自动登录。

## 8. 安全要求

### 8.1 密码

- 使用 Argon2id，每个密码唯一 salt；库生成编码 hash。
- v1 密码长度固定 12–128 个 Unicode code points；允许空格和 Unicode，不做破坏性 trim。
- 不要求容易预测的“必须大写+数字+符号”组合；允许密码管理器粘贴。
- 可在不把密码发送给第三方的前提下加入泄漏密码检查。
- Hash 参数配置在服务端并可随硬件升级；登录成功时可 rehash 老参数。
- 参数必须版本化记录 memory/time/parallelism、基准机器、目标单次延迟与并发容量；至少达到当前 OWASP 最低值。昂贵 hash 前先做廉价限流，并限制并发 hash 任务，防止内存耗尽；假 hash 使用同等级参数。
- 密码、hash、reset token、Session token 永远不进入日志或 analytics。

### 8.2 Session Cookie

- Cookie name 使用 `__Host-` 前缀。
- 生产：`Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`，不设置 `Domain`。
- Session ID 只接受 Cookie，不接受 URL query 或 request body。
- 登录和权限提升时轮换 Session。
- Cookie 内容只是一段随机值，不包含 email、role 或其他 PII。

### 8.3 CSRF、CORS 与请求来源

v1 固定采用以下协议，不留给实施者自由替换：

1. `GET /api/auth/csrf` 检查现有 auth Cookie；有有效 Session 时返回 `HMAC-SHA-256(CSRF_SECRET, "auth:" + rawSessionToken)`。
2. Guest 没有 auth Cookie 时，服务器生成至少 256-bit pre-auth 随机值，设置 `__Host-bt_pre_auth`（Secure/HttpOnly/SameSite=Lax/Path=/），返回 `HMAC-SHA-256(CSRF_SECRET, "preauth:" + rawPreAuthToken)`。
3. CSRF token 只保存在 React memory，所有 POST/PATCH/DELETE 通过 `X-CSRF-Token` 回传；服务器使用 timing-safe compare。
4. Login 成功后清 pre-auth Cookie、创建新 Session，并在响应返回基于新 Session 的新 CSRF token。Change Password/权限提升轮换 Session时也返回新 token。
5. Register/Login/Forgot/Reset/Verify/Resend 等 Guest 写接口同样要求 pre-auth CSRF、精确 Origin 和 JSON Content-Type，覆盖 login CSRF。
6. 所有浏览器非 GET API 必须有 allowlist 内的精确 `Origin`（scheme/host/port）；缺失 Origin 默认拒绝。只有未来明确登记的非浏览器客户端可有独立认证例外。
7. SameSite 只是额外防线；CORS 只允许配置 origin + credentials，响应 `Vary: Origin`，不反射、不使用 wildcard/substring/suffix 匹配。
8. CSRF secret 使用 secret manager 和可控轮换；轮换期间旧请求得到 `CSRF_INVALID` 后只允许前端重新 bootstrap 一次，不能无限重试。
9. API JSON endpoint 拒绝非预期 Content-Type，限制 body 大小。

若部署最终变成真正 cross-site，必须回到安全审查重新设计 `SameSite=None; Secure` 与 CSRF/CORS；不能临时改一个 Cookie flag 就上线。

### 8.4 限流与防滥用

分别配置而非一个全局数字：

- Login：IP + normalized email 双维度滑动窗口；逐步 backoff，避免永久锁死造成 DoS。
- Register：IP/设备维度；防止批量账号。
- Forgot/Resend：IP + email 维度；响应保持通用。
- Reset token 验证：IP + token fingerprint；失败次数受限。
- 正常 API：较宽松全局 limit，防止资源耗尽。

如果部署多实例，限流状态必须放共享 gateway、Redis 或数据库，不能只放单个 Node 进程内存。Phase 0 根据平台选定一种；开发环境可使用内存实现，但生产启动时要 fail-fast 检查。

### 8.5 其他后端基线

- HTTPS only；配置 HSTS、CSP、frame 防护、MIME sniffing 防护等安全 header。
- Verify/Reset route 在 hosting 层设置 `Referrer-Policy: no-referrer`、`Cache-Control: no-store` 和严格 CSP；CDN、proxy、APM、access log 对这些路径禁止记录/必须脱敏 query。页面禁止第三方资源，邮件 GET 不直接消费 token。
- 参数化 ORM 查询；禁止拼接 SQL。
- 全局错误处理中间件；生产不暴露 stack。
- request ID + 结构化日志；日志做字段 allowlist/redaction。
- Logger 在读取/记录 headers、query、body 前先 redaction；禁止记录 Cookie、Authorization、password/currentPassword、token、完整邮箱链接。Audit metadata 按 event type 使用固定 schema，不能 dump 任意请求 JSON。
- 如记录 IP fingerprint，使用独立、可轮换密钥的 HMAC和短保留期；普通 hash 不足以保护小地址空间。
- `trust proxy` 只按真实反向代理拓扑配置，避免伪造客户端 IP。
- 环境变量启动时 schema 验证；缺 secret 立即退出。
- 依赖锁文件提交；自动 dependency/security scan。
- 数据库账号最小权限，生产 migration 凭证与 runtime 凭证能分离则分离。

## 9. 前端改造计划

### 9.1 `authService.js`

集中封装：`register`, `verifyEmail`, `login`, `getMe`, `logout`, `forgotPassword`, `resetPassword`, `changePassword`, `updateProfile`, `requestEmailChange`, `confirmEmailChange`。

要求：

- 统一 `credentials: 'include'`。
- 统一解析 API 错误和字段错误。
- 不缓存密码、Session token 或 reset token。
- 401 交由 AuthProvider 做一致处理，避免每页各写一套。

### 9.2 `AuthProvider`

状态：

```text
status: loading | authenticated | anonymous | unavailable
user: null | { id, email, firstName, lastName, role, emailVerified }
```

提供：`login`, `logout`, `refreshUser`, `updateUser`。请求有 timeout/AbortController 和有限重试；401 与网络/5xx 分流，并对并发 401 refresh 去重。跨 tab logout/session expiry 通过 BroadcastChannel 或 `storage` 事件只传播“重新检查 Session”信号，不传播凭证。不要把完整 user database row 放进前端。

### 9.3 页面逐项修改

- Login：async submit、disabled/loading、防重复提交、服务器字段错误、returnTo。
- Register：显示密码规则、提交后进入 Check Email 页面，不直接登录。
- 新增 Verify Email 页面与 Resend 状态。
- 新增 `/confirm-email-change` 最小安全页面：从 fragment 清理 token、调用确认 API、刷新 AuthProvider，处理过期/已用/最终邮箱冲突。
- Confirm Email Change v1 不允许 Guest 仅凭 token 操作，也不会把 token 当登录凭证。无 Session/Session 过期时，页面清除 fragment 后明确提示：“请先用旧邮箱登录，然后重新打开原邮件链接”；v1 不跨 Login 暂存 token，也不声称普通 returnTo 能恢复已清除 token。跨用户 Session 必须 403。确认成功撤销其他 Session并轮换当前 Session/CSRF。
- Forgot：统一成功信息，不跳过邮件步骤。
- Verify/Reset：从 URL fragment 读取 token，在加载 analytics/外部资源或调用其他 API 前立即 `history.replaceState` 清理；页面使用不含 MiniTopBar、AIbot、第三方图片的最小安全 layout。无 token/过期有明确状态。
- Profile：读取和保存 API；移除硬编码用户和重复 Layout。
- MiniTopBar：显示真实姓名/邮箱/首字母；Guest 显示 Login，而不是假 Admin。
- AuthLayout 中的 Guest top bar 不能渲染 Avatar/Profile/Logout；Verify/Reset 页面进一步使用最小安全 header，避免加载 AIbot/第三方资源。
- Sidebar/MiniTopBar：复用同一个真实 logout action。

### 9.4 路由

- 增加 `/verify-email`、`/check-email`。
- `/profile` 放入 `ProtectedRoute`；v1 不创建 `/settings` 链接或路由。
- `GuestOnlyRoute` 处理已登录用户访问 `/login` 与 `/register`。
- 保存原访问路径，但用 URL parser + 明确站内 route allowlist；拒绝 `//host`、反斜杠、编码绕过和协议变体。
- 增加 `*` Not Found 页面。

## 10. Email 设计

必须在实施开始前选择生产邮件提供商和发件域名。代码只依赖内部 `EmailProvider` interface，避免业务代码绑定供应商。

开发：

- Docker Compose 启动 Mailpit；开发者可在本地查看验证/重置邮件。
- 自动测试使用 fake provider，捕获邮件 token/URL，不发真实邮件。

生产：

- 设置 SPF、DKIM、DMARC。
- 使用固定 `APP_PUBLIC_URL` 生成链接。
- 邮件内容不含密码。
- 注册和 forgot endpoint 只负责事务写入 outbox，独立 worker 重试；API 不同步等待 provider。
- 记录 provider message ID，不记录完整 token URL。
- Worker、API、migration 使用同一代码版本；queue age、retry、`dead` terminal count 可监控。
- 接收 provider bounce/complaint/suppression webhook，验证签名并保证幂等。v1 退信 UX 固定为：公开 Register/Resend 仍返回通用 202；suppressed recipient 不反复入 provider queue，内部记录 `EMAIL_SUPPRESSED` audit/metric，并在用户已登录的 Profile 提供 support 联系入口，公开 endpoint 不泄露 suppression 状态。
- 模板同时提供 text/HTML、明确 locale、support path；发件域通过 SPF/DKIM/DMARC alignment。

## 11. 环境变量与秘密

建议新增 `server/.env.example`，避免把认证配置与 Python 数据源 API key 混成一个无边界文件：

```text
NODE_ENV=
PORT=
DATABASE_URL=
APP_PUBLIC_URL=
ALLOWED_ORIGINS=
CSRF_SECRET=
OUTBOX_ENCRYPTION_KEYRING=            # versioned keyring + active version
SUPPRESSION_LOOKUP_HMAC_KEYRING=      # 独立 lookup keyring
PII_ENCRYPTION_KEYRING=               # suppression recipient 等 PII
EMAIL_PROVIDER=
EMAIL_FROM=
EMAIL_API_KEY=
RATE_LIMIT_STORE_URL=
LOG_LEVEL=
```

规则：

- `.env` 永不提交。
- 测试、staging、production 使用不同数据库和 secrets。
- 不在 Vite `VITE_*` 变量中放后端 secret；Vite 变量会进入浏览器 bundle。
- Secret rotation 有书面流程；Session/Token 设计应说明 rotation 后的影响。
- Keyring 配置来自 secret manager，包含 active version 与仍可解密/查询的旧版本。Outbox/PII 新写入使用 active key，读取按 `key_version` 选旧 key；Suppression lookup 在轮换窗口用所有 retained HMAC keys 计算候选并查询，新写入用 active key。后台先解密 recipient、重算 active lookup、更新 `key_version`，验证迁移完成和 queue drain 后才退役旧 key；轮换/解密失败必须有 integration test 和告警。

## 12. 测试计划

### 12.1 单元测试

- email normalization 与验证。
- password policy、hash、verify、rehash 判断。
- token 生成、hash、expiry、single-use。
- Session expiry/revocation。
- returnTo 安全验证。
- Zod schema 边界值。

### 12.2 API 集成测试（真实测试 PostgreSQL）

- 注册成功、重复邮箱并发冲突、字段非法。
- 密码 hash 与原文不同，API 永不泄露 hash。
- 验证邮件 token：成功、错误、过期、重复使用、重发后旧 token 失效。
- 登录：成功、错误邮箱/密码同样响应、PENDING/SUSPENDED 状态。
- Session Cookie flags、`/me`、过期、撤销、logout 幂等、logout-all。
- 每请求 user status/password_changed_at 检查；suspend 与进行中请求、reset 与 concurrent login、Session rotation race。
- 确定性并发测试：Login 完成旧密码/旧邮箱验证但尚未插入 Session时，分别执行 reset-password、change-password、confirm-email-change、logout-all、suspend；随后 Login 必须因 `auth_version`/锁后重检失败，不能建立有效 Session。
- Forgot 对存在/不存在邮箱返回相同公开消息。
- Reset token 单次使用、过期、重置后所有 Session 失效。
- 两个并发 verify/reset 请求断言恰好一个成功；token 消费与用户/Session/audit/outbox 原子回滚。
- Change password 要求 current password。
- Profile 只能读取/更新自己，不能提交 `role/status/id`。
- CSRF、Origin、CORS、Content-Type、body limit、rate limit。
- 数据库事务失败、邮件 provider 失败、并发请求的恢复行为。
- Outbox `SKIP LOCKED` 多 worker、dedupe、retry/backoff、`dead` terminal、payload 清空与加密失败。
- Email provider webhook 的签名、timestamp/replay window、重复 event id、bounce/complaint/suppression 状态更新。
- Webhook → `email_suppressions` 幂等持久化 → 后续 resend/outbox worker 不调用 provider；覆盖 cleared appeal 和 key rotation。
- Email change current-password 再认证、并发邮箱唯一性、旧/新邮箱通知和 Session rotation。
- Confirm email change endpoint 的成功、过期、重复消费、最终唯一性冲突和 fragment E2E。

### 12.3 E2E 浏览器测试

- Register → 查看测试邮件 → Verify → Login → Profile → Logout。
- Forgot → 邮件链接 → Reset → 老密码失败 → 新密码成功。
- 未登录访问 `/profile` 被送到 Login，登录后安全返回 `/profile`。
- 已登录访问 `/login` 被送回合理页面。
- 刷新后 Session 恢复。
- 两个浏览器上下文测试 logout-all。
- Auth API 5xx/timeout 显示 unavailable 而不是被当作登出；跨 tab revoke UX。
- Profile `postal` ↔ `postal_code` mapping、nullable/长度、version conflict、server error focus、未保存离开提示。
- 未登录打开 email-change fragment：token 清理后提示先登录并重新打开原邮件；确认 token 不进入 Web Storage，refresh 后不会被静默恢复。
- 可访问性：label、键盘、错误提示、focus、screen reader announcement。

### 12.4 安全回归测试

- Token 不出现在 localStorage/sessionStorage。
- Cookie 不能被 `document.cookie` 读取。
- 尝试用户枚举、暴力登录、reset token 重放。
- CSRF 请求和恶意 Origin 被拒绝。
- Open redirect payload 被拒绝。
- 输入中的 script/HTML 作为文本处理。
- 日志扫描确认没有 password/token/hash。
- Verify/Reset fragment 不进入 server/CDN/APM log，页面无第三方请求，响应包含 no-store/no-referrer/CSP。
- CSRF 覆盖 pre-auth/auth bootstrap、缺失/错误 header、跨 Session 重放、Session rotation、多 tab 和恶意 Origin。
- 依赖审计与基础 DAST（例如 staging 上的 OWASP ZAP baseline）。

## 13. CI/CD 与运行

新增独立 `ci.yml`，不要把应用检查塞进会自动提交数据的 `refresh-data.yml`。

Pull request 必须通过：

1. Frontend lint。
2. Frontend production build。
3. Backend typecheck/lint。
4. Backend unit tests。
5. PostgreSQL integration tests。
6. E2E auth happy path 与关键失败路径。
7. Migration validation。
8. Dependency/security scan。
9. OpenAPI lint、breaking-change check、前后端 contract tests。
10. 固定 route access matrix 的 UI/API authorization tests，以及 Community/Incident feature-flag tests。

CI 固定 Node LTS、PostgreSQL major version并使用 lockfile clean install；同时验证“空数据库跑完整 migration history”和“上一发布 schema + representative data 升级到当前版本”。检查 schema drift/未提交 migration，破坏性 SQL 必须人工批准。前端增加 auth service/AuthProvider/route-guard component tests。测试冻结时钟、隔离 database/schema，并保留失败 E2E screenshot/trace；flaky test 不能靠无限 retry 掩盖。

部署顺序：

1. 备份数据库。
2. 执行向前兼容 migration。
3. 部署 backend。
4. 健康检查通过后部署 frontend。
5. Smoke test register/login/logout/forgot（生产邮件使用受控测试账号）。
6. 观察错误率、登录失败率、邮件发送率和数据库连接。

回滚原则：应用版本可回滚；数据库 migration 优先 forward-fix。任何破坏性 schema 修改必须采用 expand → migrate data → contract，多版本兼容后才删除旧列。

生产部署由反向代理把 `/` 路由到静态前端、`/api` 路由到 API；PostgreSQL、worker、共享 limiter 位于私网。Vite dev server 用 proxy 转发 `/api`。Migration 由单一 release job 使用受限 migration credential 执行 `prisma migrate deploy`，不能由每个 API replica 启动时迁移。`/health/live` 不查外部依赖；`/health/ready` 检查 DB 与关键配置，但邮件 provider 故障通过 outbox 指标降级而非让全部登录读取失效。

最低运行门槛（项目负责人可选择更严格但不能更宽松后无记录）：PITR ≥7 天、每日加密备份保留 ≥30 天、RPO ≤24 小时、RTO ≤4 小时、备份凭证最小权限并限制访问。每季度在隔离环境做一次 restore 演练，验证行数、约束、migration version 和受控登录 smoke test，记录实际 elapsed time 与证据。部署前定义 migration lock、兼容窗口、失败 migration 决策树和 owner；到期备份按保留政策删除。

监控至少包含 API p95/5xx、login 成功/失败/429、Session DB latency/pool saturation、outbox oldest age/retry/`dead` terminal、邮件 accepted/delivered/bounced、reset conversion。初始告警基线：连续 5 分钟 API 5xx >2%、outbox oldest age >10 分钟、outbox `dead` >0、DB pool >80%；上线观察后以变更记录调优。Metrics/log label 禁止使用完整 email、token、原始 IP 等高基数 PII。

## 14. 分阶段实施顺序

### Phase 0：决策与基础设施

- 确认生产域名、前后端是否同源。
- 选择 PostgreSQL、部署平台、邮件 provider、Redis/共享 rate-limit store。
- 采用第 1.1/7.3 节已经冻结的 v1 访问矩阵；变更需更新 OpenAPI、威胁模型和 E2E。
- 建立 staging 环境和 secret manager。

**完成标准：** 域名、DB、邮件、部署 owner 都有明确答案；没有未决的 Cookie 跨域问题。

### Phase 1：Backend skeleton 与数据库

- 创建 `server/` TypeScript/Express。
- env fail-fast、logging、request ID、error handling、health endpoints。
- Prisma schema、首个 migration、email outbox 与 worker skeleton。
- PostgreSQL dev/test 环境。

**完成标准：** migration 可在空数据库重复部署；health/readiness 正确；CI 能连接测试 DB。

### Phase 2：核心 Session 认证

- password hash/verify。
- login、me、logout、logout-all；仅用受控已验证 fixture。Public register route 用 feature flag 禁止暴露，避免产生无法验证的 PENDING 用户。
- session middleware、Cookie、Origin/CSRF、限流、审计。
- API 集成测试。

**完成标准：** 不依赖邮箱也能用受控已验证 fixture 完成真实登录；所有安全负面测试通过。

### Phase 3：邮箱验证与密码恢复

- EmailProvider、Mailpit/fake provider。
- register、verification、resend、forgot、reset、change-email 与 outbox worker；完整链路通过后才打开 public register feature flag。
- token hash、过期、single-use、session revocation。

**完成标准：** 完整邮件链路在 staging 可用；枚举与 token 重放测试通过。

### Phase 4：React 集成

- authService、AuthProvider、route guards。
- 改 Login/Register/Forgot/Reset。
- 新增 Check Email/Verify 页面。
- TopBar/Sidebar 真实用户与真实 logout。
- Profile API 化并移除重复布局。

**完成标准：** 浏览器刷新保持 Session；不存在 demo token/固定 Admin；E2E 流程通过。

### Phase 5：授权与相邻功能接入

- Community 写操作要求真实用户；seed 内容可继续只读展示。
- Incident submission 关联 `user_id`。
- v1 不提供 Admin API；如保留 role 字段，只允许服务器读取，Admin seed/CLI 延后到真实管理功能阶段。

Community/Incident 的完整持久化 schema、CRUD、moderation 和内容生命周期属于独立后续计划；本认证计划在 Phase 5 只负责真实 `user_id` 身份边界、API 授权契约和未接入前的 feature flag，不把相邻业务实现偷渡进 Login v1。

**完成标准：** API 层没有只靠前端按钮隐藏的权限；跨用户访问测试通过。

### Phase 6：上线加固

- CSP/HSTS/security headers、生产 Cookie、HTTPS。
- Redis/shared rate limit、邮件域名验证、备份/恢复演练。
- 监控/告警、日志 redaction、依赖审计、DAST。
- staging 验收与发布 runbook。

**完成标准：** 上线清单签核；RPO/RTO restore 演练有证据；关键指标和告警可见；HTTPS、共享限流、日志脱敏、outbox 监控、备份恢复任一缺失都阻止生产部署。

## 15. 验收标准（Definition of Done）

只有同时满足以下条件，才能称为“完整 Login 功能”：

- 用户可注册，邮箱唯一，密码只存 Argon2id hash。
- 邮箱验证 token 随机、哈希存储、过期、单次使用。
- Verify/Reset 并发原子消费测试证明恰好一个成功。
- 正确凭证可登录，错误凭证不泄露账号是否存在。
- Session 使用 HttpOnly Secure Cookie，不使用 localStorage token。
- 刷新后可恢复登录状态，Session 可过期、撤销、logout-all。
- `auth_version` 并发测试证明旧密码/旧邮箱验证不能跨越 reset/change/logout-all/suspend 后建立 Session。
- 公开 ESG/SDG 页面仍可匿名访问。
- Profile 只显示和修改当前真实用户资料。
- Forgot/Reset 通过真实邮件链接，一次性、短时有效；成功后旧 Session 失效。
- 前端 route guard 和后端 authorization 都存在。
- CSRF、Origin/CORS、限流、输入验证、日志脱敏已测试。
- OpenAPI 合约覆盖所有 auth/profile endpoint，并通过前后端 contract test。
- Transactional outbox/worker 的加密、去重、重试、dead-letter 和监控通过故障测试。
- 数据库 migration、备份、恢复和 CI 检查可运行。
- 所有核心单元、集成与 E2E 测试通过。
- AuthProvider 能区分 anonymous 与 unavailable；服务故障不会伪装成登出。
- 代码中不存在 `demo-session`、硬编码 Admin 身份或把认证 token 存入 Web Storage 的逻辑。

## 16. 不能跳过的上线前决策

以下不是编码细节，必须由项目负责人确认并记录：

集中决策记录与 Production 签核表见：[STAGING_PRODUCTION_DECISIONS.md](./STAGING_PRODUCTION_DECISIONS.md)。

1. 正式前端域名和 API 域名，是否同源。
2. PostgreSQL 托管位置、区域、备份与恢复目标。
3. 邮件 provider、发件域名和 SPF/DKIM/DMARC owner。
4. Session 默认 7 天、idle 24 小时是否需要收紧；v1 已明确不做 Remember-me。
5. 用户隐私政策、Profile PII 的目的/同意、资料导出/更正/删除、Community 内容匿名化和审计日志保留期限。
6. 如果未来启用 Admin，初始 Admin 的授权人和创建流程；v1 不启用 Admin API。

在这些决策确认前可以完成本地和 staging 实现，但不能声称生产上线已经完成。

## 17. 实施风险与控制

| 风险 | 控制 |
|---|---|
| 把用户写入会重建的指标 DB | 应用 PostgreSQL 与独立 migration；代码和权限隔离 |
| localStorage token 被继续沿用 | 全仓搜索并设置 CI/测试断言，禁止 auth token 进入 Web Storage |
| Cookie 跨域配置临时拼凑 | Phase 0 先确定域名；优先同源 |
| Forgot Password 泄露用户 | 统一文案/状态、相近时序、双维度限流 |
| Reset token 数据库泄漏后可直接使用 | 只存 token hash、短 expiry、single-use |
| 多实例限流失效 | 生产使用共享 Redis/DB store |
| 邮件发送失败造成账号卡住 | outbox/retry + resend endpoint + 可观测性 |
| 只做前端 route guard | 所有 API 服务端重新认证与授权 |
| Profile 可提交 role/status | DTO allowlist，忽略/拒绝受保护字段，跨用户集成测试 |
| Migration 破坏生产 | committed SQL review、expand/contract、部署前备份和 staging 演练 |

## 18. 依据

- OWASP Password Storage Cheat Sheet：密码应使用现代自适应哈希，首选 Argon2id。
- OWASP Session Management Cheat Sheet：Session ID 应具有足够熵，并使用 Secure/HttpOnly/SameSite Cookie。
- OWASP Forgot Password Cheat Sheet：统一响应、随机且安全存储的一次性短时 token、重置后不自动登录并考虑撤销 Session。
- OWASP CSRF Prevention Cheat Sheet：SameSite 不是所有场景下唯一的 CSRF 防护，应结合 token/header 与来源验证。
- Node.js 官方发布策略：生产使用 Active LTS 或 Maintenance LTS。
- Prisma 官方文档：migration SQL 和历史应提交版本控制，并区分开发与生产 migration 流程。

官方参考：

- https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html
- https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
- https://nodejs.org/en/about/previous-releases
- https://www.prisma.io/docs/orm/prisma-migrate
