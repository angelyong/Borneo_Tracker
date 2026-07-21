# Borneo Tracker Production Rollout Plan

**Document status:** Proposed rollout baseline (deployment still pending)  
**Last updated:** 2026-07-14  
_Status updated: 2026-07-20 — corrected the system-boundary description (auth + news shipped on Supabase, not a self-hosted server/ backend). The rollout sequence and gates below are unchanged and still apply._  
**Release strategy:** 分阶段上线（phased production rollout）

## 1. 目标

本文件定义 Borneo Tracker 从当前开发状态进入 production 的顺序、每个阶段的范围、上线门槛、验证方法和回滚条件。

核心原则是：

> 每次只上线一个完整、可验证、可监控、可回滚的功能范围。未达到 production 标准的功能必须隐藏，而不是以半成品或 “Coming Soon” 的形式公开。

这份顺序主要根据当前代码成熟度、数据完整性、安全风险和运营复杂度制定。若未来商业优先级改变，可以调整阶段顺序，但不能跳过对应的上线门槛。

## 2. 当前系统边界

目前 repository 实际包含以下不同成熟度的系统：

1. **数据看板**：Python pipeline 生成 CSV、SQLite、JSON 和 GeoJSON，React 前端读取静态数据。
2. **身份系统**：已上线于 **Supabase**（route C：托管 Postgres + Auth + auto REST API）。`AuthProvider` 使用 Supabase Auth（signUp / signIn / signOut / reset / update password），`role` 来自 `profiles` 表，`role='admin'` 用于 gate `/admin/*`。**没有自托管的 `server/` Express/PostgreSQL/email-worker backend**——早期规划的自托管路线（route B）已被否决，未采用。
3. **News 与 Admin Review**：已上线于 **Supabase**。收集+摘要 pipeline（`fetch_news.py` + `digest_news.py`）写入 `news_items` 表；in-app `/admin/news` review queue（`NewsReview.jsx` + `adminNewsService.js`）已构建，public `/news` 只读 `status='published'`。
4. **仍为原型的功能**：Community（`localStorage` / IndexedDB）和 Incident Reporting 仍是 mock，尚未接入共享的 production backend。

因此，页面已经出现在 UI 中，并不代表对应功能已经具备 production persistence、authorization 或 operational support。**部署本身（DirectAdmin 域名 + production 环境）仍未完成——本文件的上线顺序与门槛仍然适用。**

## 3. Production 优先级总览

| Priority | Release | 功能范围 | 当前决定 |
|---|---|---|---|
| P0 | Production blockers | 数据可信度、district refresh、Data Sources、监控与隐藏未完成功能 | 必须先完成 |
| P1 | Release 1 | 公开、只读数据看板 | 第一批上线 |
| P2 | Release 2 | Auth 与 Profile | 第二批上线 |
| P3 | Release 3 | 正式 PDF Report | Auth 稳定后上线 |
| P4 | Release 4 | 真正的 News 与 Admin Review | 完成 backend 后上线 |
| P5 | Release 5 | Incident Reporting | 完成提交和处理 backend 后上线 |
| P6 | Release 6 | Community | 完成 moderation 和安全能力后最后上线 |

## 4. P0：任何 Production 上线前的阻挡项

以下项目全部完成前，不进行首次 production release。

### 4.1 Resilience Index 决策

当前指数会排除没有数据的支柱，再对剩余支柱取平均。现有数据中：

- Sabah 和 Sarawak 只覆盖 1/6 支柱。
- Brunei 和 Kalimantan 只覆盖 3/6 支柱。
- 四个地区目前都显示 green，但计算覆盖率不同。

上线前必须选择并落实其中一个方案：

- [ ] **方案 A：暂时隐藏 Resilience Index**，保留原始指标。
- [ ] **方案 B：设置最低覆盖门槛**；未达到门槛时显示 “Insufficient coverage”，不显示总体分数或 RAG。
- [ ] **方案 C：完成正式 methodology review**，确定 bounds、pillar weighting、coverage rule 和版本管理后再公开。

无论选择哪个方案，都必须：

- [ ] 在 UI 显示 scored pillars、unscored pillars 和 coverage。
- [ ] 保存 methodology version。
- [ ] 为 scoring、coverage 和边界值加入自动化测试。
- [ ] 不允许不同覆盖范围的指数在没有说明的情况下直接比较。

相关代码：[compute_resilience.py](../compute_resilience.py)

### 4.2 修复 District 自动发布

Pipeline 会更新 `public/data/districts.json`，但当前 scheduled workflow 没有将该文件加入 commit。

- [ ] 将 `public/data/districts.json` 加入 refresh workflow 的 staging 范围。
- [ ] 如果 boundary GeoJSON 会自动重建，也将对应文件纳入明确的发布策略。
- [ ] 在 workflow 中验证生成文件存在、可解析且 row count 不异常下降。
- [ ] 在 production 验证 territory data 和 district data 的生成日期。

相关文件：[refresh-data.yml](../.github/workflows/refresh-data.yml)、[ingest_districts.py](../ingest_districts.py)

### 4.3 完成 Data Sources 页面

`/data-sources` 目前是 placeholder。正式数据平台必须提供：

- [ ] 数据来源名称和链接。
- [ ] 指标对应来源。
- [ ] 数据年份与 `last_updated`。
- [ ] `data_level` 和 confidence 定义。
- [ ] Kalimantan roll-up、国家级继承值及 manual data 的解释。
- [ ] 已知数据缺口和 source outage 说明。
- [ ] Resilience methodology 或其正式链接。

### 4.4 数据刷新与陈旧数据规则

- [ ] 定义每个来源可接受的最大陈旧时间。
- [ ] Pipeline 输出每个 source 的成功、失败和 fallback 状态。
- [ ] Critical source 失败时，workflow 必须失败或阻止自动发布。
- [ ] Non-critical source 使用旧数据时，UI 必须显示真实的 row-level 更新时间。
- [ ] 禁止只根据顶层 `generatedAt` 判断所有数据都已刷新。
- [ ] 为 row count、territory coverage、canonical selection 和 duplicate keys 设置检查。

### 4.5 Production 基础能力

- [ ] HTTPS 已启用。
- [ ] Production domain 已确定。
- [ ] Staging 与 production 环境分离。
- [ ] CI 在 release commit 上全部通过。
- [ ] 前端错误、API 错误和数据加载失败可监控。
- [ ] 部署版本可以追踪到 Git commit。
- [ ] 已定义并演练 rollback 方法。
- [ ] 所有未完成 route 和 navigation item 已隐藏。

## 5. Release 1：公开只读数据平台

### 5.1 上线范围

| 顺序 | 功能 | Route | Release 1 状态 |
|---:|---|---|---|
| 1 | Overview Dashboard | `/` | Include |
| 2 | Regional Detail | `/regions` | Include |
| 3 | ESG Indicators | `/esg` | Include |
| 4 | SDG Progress | `/sdg` | Include |
| 5 | Data Sources | `/data-sources` | Include after completion |
| 6 | About | `/about` | Include |
| 7 | CSV/PNG quick export | ESG/SDG 页面内 | Include |

### 5.2 Release 1 不上线的功能

- `/login`
- `/register`
- `/profile`
- `/reports` 完整 PDF report
- `/news`
- `/admin/news`
- `/incident_report`
- `/community`

以上 route 在 production navigation 中必须隐藏。若用户直接访问，不应看到误导性的可操作 prototype 或 Coming Soon 页面。

### 5.3 Release 1 验收标准

- [ ] 四个 territory 都能加载并显示指标。
- [ ] District map 能加载，地图与 dropdown selection 一致。
- [ ] ESG 和 SDG 页面显示正确 territory、year、unit、source 和 confidence。
- [ ] 缺失数据明确显示为 “No data”，不使用插值或虚构值。
- [ ] Trend 少于最小真实数据点时不绘制误导性趋势。
- [ ] CSV 可以正常打开，特殊字符不会破坏列结构。
- [ ] PNG export 不包含操作按钮，内容清晰可读。
- [ ] 手机、平板和桌面主要页面经过检查。
- [ ] 静态数据文件加载失败时，用户看到明确错误状态。
- [ ] Production 没有暴露 API key 或本地环境配置。

### 5.4 Release 1 发布流程

1. 从确定的 release commit 构建 staging。
2. 在 staging 完成 smoke test 和数据抽样核对。
3. 记录 staging 使用的数据生成日期和 Git commit。
4. 进行 go/no-go review。
5. 部署到 production。
6. 立即执行 production smoke test。
7. 观察错误率和数据加载情况。
8. 达到稳定观察窗口后，标记 Release 1 complete。

### 5.5 Release 1 回滚条件

出现以下任一情况应停止发布或回滚：

- 主要页面无法加载。
- `indicators.json`、`districts.json` 或 GeoJSON 无法解析。
- Territory 或关键指标大范围缺失。
- 地图显示错误 territory 或错误颜色含义。
- 导出的报告包含错误 territory、value、year 或 source。
- 发现 API key、secret 或私人数据暴露。
- 错误率持续超过团队批准的阈值。

## 6. Release 2：Auth 与 Profile

> **更新（2026-07-20）：** Auth 实际已上线于 **Supabase（route C）**，不是自托管的 Express + PostgreSQL + email-worker backend。因此下方门槛应按 Supabase 语义解读：production database = Supabase 托管 Postgres（无需自建/自行 migrate）；email provider = Supabase Auth 邮件（production 需配置 custom SMTP + production Site URL/Redirect URL）；session/CSRF/cookie 由 Supabase 客户端 SDK 管理。**没有独立 email worker，也没有 `server/` backend。** 门槛的意图（备份、真实收件箱测试、HTTPS、rate limit、secrets 不入库）仍然有效。

### 6.1 上线范围

- Register
- Email verification
- Login/logout
- Forgot/reset password
- Profile management
- Change password
- Change email
- Logout all sessions

### 6.2 上线门槛

- [ ] PostgreSQL production database 已建立。
- [ ] Migration 已在 staging 和 production-like backup 上演练。
- [ ] Backup、restore 和 retention 流程已验证。
- [ ] 正式 email provider、发件域名及 credentials 已配置。
- [ ] Verification、reset 和 email-change 邮件通过真实收件箱测试。
- [ ] HTTPS、Secure Cookie、CSRF 和 allowed origins 已验证。
- [ ] Session expiration、revocation 和 password change 行为已验证。
- [ ] Rate limiting 在多实例部署下行为正确。
- [ ] API 与 email worker 有独立 health monitoring。
- [ ] Backend integration tests 在 PostgreSQL 环境全部通过。
- [ ] Production secrets 不存在 repository 或 frontend bundle 中。

相关文件：[src/auth/AuthProvider.jsx](../src/auth/AuthProvider.jsx)、[supabase/schema.sql](../supabase/schema.sql)、[docs/SUPABASE_AUTH_MIGRATION_PLAN.md](SUPABASE_AUTH_MIGRATION_PLAN.md)（没有 `server/` backend——route B 未采用）

### 6.3 回滚原则

- Application rollback 不得自动回滚数据库 migration。
- 破坏性 schema change 必须使用 expand-and-contract migration。
- Email worker 可独立暂停，不能因为 provider 故障导致 auth transaction 丢失。
- 若 session 或 CSRF 出现异常，暂停新登录入口并保留公开只读看板。

## 7. Release 3：正式 PDF Report

### 7.1 上线范围

- Indicator summary
- Territory comparison
- Historical trends
- Resilience coverage/methodology（只有 P0 决策完成后）
- Data sources and generation dates
- Client-side PDF download

### 7.2 上线前修改

当前 report 页面读取 browser-local Community posts。正式报告上线前必须：

- [ ] 移除 Community prototype 数据依赖，或在 Community backend 完成前完全排除该 section。
- [ ] 每份报告显示数据生成日期和 row-level source/year。
- [ ] 验证多页切割不会截断标题、表头或重要说明。
- [ ] 测试主要浏览器和不同屏幕尺寸。
- [ ] 检查报告文件大小和生成失败时的用户提示。

相关文件：[GenerateReportPage.jsx](../src/pages/reports/GenerateReportPage.jsx)、[pdfReport.js](../src/utils/pdfReport.js)

## 8. Release 4：News 与 Admin Review

> **更新（2026-07-20）：** News 与 admin review 已构建于 **Supabase**（不再是纯 mock/`localStorage`）：pipeline（`fetch_news.py` + `digest_news.py`）写入 `news_items`；in-app `/admin/news` review queue（`NewsReview.jsx` + `adminNewsService.js`）支持 Approve / Edit→Publish / Reject；public `/news` 只读 `status='published'`；RLS 强制未发布内容不公开。`localStorage` 版本现在只是无 keys 时的 dev/test fallback。**剩下的是 production 部署与运营验收**（真实 admin 账户、编辑团队验收、上线观察），下方门槛据此解读。

### 8.1 必要 backend 能力

- [ ] News database tables。
- [ ] 服务端 create、read、update、review 和 publish API。
- [ ] 服务端 ADMIN authorization；不能只依靠 React route guard。
- [ ] Draft、Pending、Published、Rejected 和 Withdrawn 状态。
- [ ] Reviewer identity、review time 和 audit trail。
- [ ] Publish、unpublish 和 rollback 流程。
- [ ] Public API 永远不返回未发布内容。
- [ ] 多个用户和设备看到一致的状态。
- [ ] 输入清理、内容长度限制和 rate limiting。

### 8.2 上线顺序

1. Backend schema/API。
2. Admin review staging。
3. Public news staging。
4. 编辑团队验收。
5. Production admin access。
6. Production public news。

相关文件：[adminNewsService.js](../src/services/adminNewsService.js)（Supabase-wired，`newsStore.js` 为无 keys fallback）、[src/pages/admin/news/NewsReview.jsx](../src/pages/admin/news/NewsReview.jsx)

## 9. Release 5：Incident Reporting

`/incident_report` 当前为 placeholder，正式上线需要完整 submission lifecycle。

### 9.1 最低功能范围

- [ ] Server-generated incident ID。
- [ ] Authenticated submission。
- [ ] Incident category、description、location 和 event time。
- [ ] 安全的 attachment upload。
- [ ] 服务端 MIME/signature、size 和 count validation。
- [ ] Malware scanning。
- [ ] Submission status tracking。
- [ ] Admin triage、assignment、status update 和 audit trail。
- [ ] Rate limiting 和 abuse prevention。
- [ ] Privacy、retention 和 deletion policy。
- [ ] 敏感 incident 不会出现在 public dashboard 或 logs。

如果业务正式确认 Incident Reporting 是核心目标，可以把本阶段排到 News 前面；上线门槛保持不变。

## 10. Release 6：Community

Community 最后上线，因为它涉及最高的内容、安全、存储和运营风险。

### 10.1 必须替换的 prototype 部分

- `localStorage` posts/comments/likes
- IndexedDB attachment blobs
- Client-side ownership checks
- Browser-specific deletion and persistence

### 10.2 Production 必需能力

- [ ] Shared database。
- [ ] Server-side ownership and authorization。
- [ ] Object storage。
- [ ] Upload validation 和 malware scanning。
- [ ] Moderation queue。
- [ ] Report、hide、remove、suspend 和 ban。
- [ ] Rate limiting 和 spam protection。
- [ ] Content audit trail。
- [ ] Storage quota 和 lifecycle rules。
- [ ] Community Guidelines、Privacy Policy 和 Terms。
- [ ] Moderator ownership 和 response process。

相关 prototype：[communityService.js](../src/services/communityService.js)、[communityAttachmentStore.js](../src/services/communityAttachmentStore.js)

## 11. 每个 Release 的标准流程

每个阶段统一使用以下流程：

### 11.1 Scope freeze

- 明确 include 和 exclude。
- 不在 release validation 期间加入新功能。
- 记录 release owner、target date 和 rollback owner。

### 11.2 Staging validation

- 部署与 production 相同的 build artifact。
- 使用 production-like database、origin 和 email 配置。
- 执行 automated tests、smoke tests 和业务验收。
- 记录未解决问题并进行 go/no-go 判断。

### 11.3 Production deployment

- 记录 Git commit、数据版本和 migration version。
- 先部署 backward-compatible backend/database change。
- 再开放 frontend route 或 feature flag。
- 发布后立即运行 smoke test。

### 11.4 Observation

- 检查页面错误、API 5xx、database health 和 email failures。
- 检查关键用户流程。
- 检查数据生成日期和文件完整性。
- 未达到稳定标准前不进入下一阶段。

### 11.5 Rollback

- 关闭对应 route 或 feature flag。
- 回滚 application artifact。
- 保留并审计已写入的数据。
- Database migration 使用预先批准的恢复方案，不执行未经验证的直接逆向操作。
- 记录 incident、root cause 和重新发布条件。

## 12. Go/No-Go Checklist

每次 production release 前必须逐项确认：

### Product

- [ ] Release scope 明确且没有半成品入口。
- [ ] User-facing wording、source、year 和 limitation 已审核。
- [ ] Error、empty 和 unavailable states 已验证。

### Data

- [ ] 数据文件可解析。
- [ ] Territory 和关键 indicator coverage 正常。
- [ ] Source freshness 和 fallback 状态已检查。
- [ ] 没有 fabricated 或 silent interpolated data。

### Security

- [ ] Secrets 未进入 Git、logs 或 frontend bundle。
- [ ] 所有写入操作有服务端 authentication 和 authorization。
- [ ] HTTPS、cookies、CSRF、CORS/origin 和 rate limit 已验证。
- [ ] Upload 已具备服务端验证和扫描。

### Reliability

- [ ] CI 全部通过。
- [ ] Staging smoke test 通过。
- [ ] Monitoring 和 alerting 已启用。
- [ ] Backup 和 rollback 可用。

### Operations

- [ ] Release owner 已确认。
- [ ] Rollback owner 已确认。
- [ ] Support 和 incident communication channel 已确认。
- [ ] 上线后的 observation window 已安排。

只有所有适用于本阶段的项目通过，才能做出 **GO** 决定。

## 13. Definition of Production Ready

一个功能只有同时符合以下条件，才算 production ready：

1. 功能对所有目标用户行为一致。
2. 数据持久化符合该功能承诺。
3. 权限由服务端执行。
4. 失败状态对用户清楚可见。
5. 有自动化测试和 staging 验证。
6. 有监控、运营负责人和问题处理流程。
7. 可以在不破坏其他 production 功能的情况下关闭或回滚。
8. 文档描述与真实代码行为一致。

如果其中任何一项不满足，该功能应继续保留在 development/staging，或通过 feature flag 隐藏。

