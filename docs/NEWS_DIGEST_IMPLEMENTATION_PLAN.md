# Borneo Tracker “Borneo Pulse” AI News Digest 实施计划

**状态：** 已于 2026-07-13 对照当前仓库、`NEWS_DIGEST_CONCEPT.md`、现有 News UI、认证后端、Prisma schema、数据指标 vocabulary 与 CI 配置完成实施前审查

**目标模块：** `/news` 公开新闻、每日 RSS 采集、Gemini 英文摘要、来源佐证、管理员审核与指标 deep link

**实施原则：** AI 只生成草稿；来源由系统绑定；管理员是唯一发布人；未审核内容绝不公开

**不在第一版：** 全文抓取、AI 判真、自动发布、用户投稿新闻、新闻评论、个性化推荐、天气模块、付费新闻 API

---

## 1. 结论：这个方向是否正确

方向正确，技术上可行，也适合当前 Borneo Tracker 的架构，但不能把它实现成纯前端 mock replacement，也不能把新闻写进指标 SQLite。

正确架构是：

```text
公开指标数据
Python pipeline -> SQLite -> public/data/*.json -> React Dashboard

事务型 News Digest
RSS adapters -> News ingestion job -> Gemini draft -> Application PostgreSQL
                                                   -> Admin review -> Published API -> React /news
```

理由：

1. `borneo_tracker.db` 会被数据管线重建，不能保存新闻草稿、审核记录或管理员操作。
2. 当前 `server/` 已经是 Express + TypeScript + Prisma + PostgreSQL 的模块化单体，News 应进入同一个 application backend，不另建微服务。
3. 当前 `/news` 页面已经具备列表、详情、筛选、loading、error、empty 与 AI label，可以保留 UI，替换 service 和数据 shape。
4. 当前 `UserRole` 已包含 `ADMIN`，可以扩展为管理员审核，但目前没有 Admin authorization middleware 或 admin routes，必须补建。
5. AI 无法保证新闻真实，也不应控制来源 URL；可信流程必须来自来源白名单、独立来源数量、不可修改的来源绑定和人工审核。
6. RSS、Gemini 模型、免费额度与外部服务行为会变化，所以计划必须先设置 source/model spike 和 stop gate，不能把概念文档中的额度或 feed 可用性当作永久事实。

### 1.1 冻结的 v1 决策

以下决定用于消除实施分叉：

1. News 使用现有 Node/Express 模块化单体和 application PostgreSQL。
2. News 不进入 `borneo_tracker.db`，也不生成公开静态 news JSON 作为主存储。
3. 采集与 AI orchestration 使用 TypeScript，放在 `server/src/news-ingestion/`，直接复用 Prisma、Zod、环境变量和日志。
4. 公开 `/news` 只读取 `/api/news` 返回的 `PUBLISHED` 内容。
5. `PENDING`、`REJECTED` 和 ingestion candidates 只能由 `ADMIN` 查看。
6. AI 只能引用系统提供的 candidate IDs；真实 source URL、publisher 和时间由后端根据 ID 绑定，模型不得生成来源。
7. 新闻正文使用 plain text；前端不得用 `dangerouslySetInnerHTML` 渲染 AI 或 RSS 内容。
8. 第一版不抓取完整 article page，只读取通过验证的 RSS metadata；不绕过 paywall。
9. 单来源故事允许进入待审核队列，但必须显示 `Single source` 警告；管理员批准时需要明确确认。
10. 多来源数量表示 corroboration coverage，不命名为 “truth score” 或 “fact-check score”。
11. 第一版不自动发布；任何 code path 都不得由 ingestion job 直接写成 `PUBLISHED`。
12. 第一版不热链接 publisher 图片；使用本地 category artwork 或无图 fallback，避免版权、失效链接和生产 CSP 问题。
13. 指标 tag 使用当前 Dashboard 的 `dashboard_concept` vocabulary；`tree_cover_loss` 不作为新 key，统一使用现有 `deforestation`。
14. News scheduler 与 `refresh-data.yml` 逻辑隔离；新闻失败不得阻断指标刷新。
15. 生产 scheduler 在部署平台确定前不冻结实现。先提供可重复执行的 CLI job；部署决策完成后只选择一种 scheduler。
16. Weather strip 延后，不进入 News v1 Definition of Done。

---

## 2. 当前仓库事实与差距

### 2.1 当前已经存在并可保留的内容

| 能力 | 当前位置 | 处理方式 |
|---|---|---|
| `/news` 路由 | `src/App.jsx` | 保留 |
| News 列表与 Featured card | `src/pages/news/NewsPage.jsx` | 保留布局，改为 API pagination/filter |
| News 详情 | `src/pages/news/NewsDetailPage.jsx` | 保留布局，改用 slug 和多来源 |
| Search／territory／category／sort | `NewsFilters.jsx`、`newsUtils.js` | 保留 UX，参数移到 API contract |
| Loading／Error／Empty | News components | 保留并扩展 |
| AI-generated label | News page/detail | 保留，改成后端字段控制 |
| 用户 Session | `server/src/modules/auth/` | 保留 |
| `USER`／`ADMIN` enum | `server/prisma/schema.prisma` | 保留并用于授权 |
| CSRF／Origin／Rate limit | `server/src/middleware/`、`security/` | 管理员写入 API 复用 |
| PostgreSQL／Prisma | `server/` | 保存 News 事务数据 |
| Dashboard indicator JSON | `public/data/indicators.json` | 提供 chip 当前值和 concept contract |

### 2.2 当前必须替换或新增的内容

| 当前差距 | 当前事实 | 必须完成 |
|---|---|---|
| News 数据是 mock | `newsService.js` 读取 `mockNews.js` | 改为 `/api/news` |
| 单来源 shape | `sourceName`、`sourceUrl` | 改为 `sources[]` 和 derived `sourceCount` |
| 单 territory | `article.territory` | 改为 `territories[]`，另给 `primaryTerritory` 做 display |
| Indicator 是显示文字 | `indicatorTags[]` | 改为稳定 `indicatorConcepts[]` + UI label |
| 没有 News DB tables | Prisma 只有 Auth tables | 增加 News migration |
| 没有 admin authorization | 只有一般 authentication | 增加 `requireRole('ADMIN')` |
| Auth backend 尚未形成稳定提交基线 | 当前 `server/` 和相关前端认证文件仍在 working tree | News 开发前先整理、验证并提交 Auth baseline |
| 没有 admin review UI | 仓库没有 `ReportVerification.jsx` | 新建 News admin queue，不引用不存在组件 |
| 没有 ingestion pipeline | 没有 RSS／Gemini 代码 | 新建 `server/src/news-ingestion/` |
| 没有 scheduler decision | 只有 Python data workflow | News 独立 scheduler decision gate |
| 没有 News automated tests | root test 目前只跑 server tests | 补 unit、integration、frontend/E2E |

### 2.3 Concept 文档与仓库不一致之处

1. Concept 引用的 `ADDITIONAL_REQUIREMENTS.md` 当前不在仓库；实施前必须把最终 AR-3 acceptance criteria 纳入本计划或正式 requirements 文件。
2. Concept 提到复用 `ReportVerification.jsx`，当前没有这个文件；不能把它当依赖。
3. Concept 使用 `tree_cover_loss`，当前 Dashboard concept 是 `deforestation`。
4. Concept 建议 `fetch_news.py`／`digest_news.py`；当前 application backend 已采用 TypeScript/Prisma，News job 使用 TypeScript可减少两套数据库访问和 validation stack。
5. Concept 写明固定 Gemini 免费额度；额度属于外部状态，必须在项目的 AI Studio quota 页面验证，代码也必须处理 `429`／`503`。
6. Concept 写“没有版权风险”；实施文案应改为“降低风险”，仍需确认每个 feed 的许可和展示边界。

---

## 3. 完成后的端到端用户流程

### 3.1 每日自动采集

1. Scheduler 启动 `news:ingest` job，并建立一条 `NewsIngestionRun`。
2. Job 先取得 PostgreSQL advisory lock；已有 run 时立即退出为 `NEWS_RUN_IN_PROGRESS`，不允许两个 manual/scheduled run 并发处理同一窗口。取得 lock 后把超过 lease/最大运行时间的旧 `RUNNING` run 标记为 failed/stale，再开始新 run。
3. Job 从启用的 source adapters 拉取 rolling 48-hour RSS metadata。
4. 每个 feed 有 timeout、byte limit、item limit 和 source ID，并写独立 `NewsFeedAttempt`。
5. 系统解析 title、RSS summary、publisher、source URL、published time、language。
6. 系统规范化 URL、移除 tracking parameters、验证 publisher domain、计算 URL hash。
7. 已经出现过的 canonical URL 不建立重复 candidate。
8. 新 candidate 保存为 `COLLECTED`；失败 feed 记录错误但不终止其他 feeds。
9. 若所有 source adapters 均失败，run 标记 `FAILED`，不调用 Gemini，也不改变已发布新闻。

### 3.2 AI draft 处理

1. 系统先用确定性规则做 territory、日期、source whitelist 和明显无关主题过滤。
2. 候选项按时间和 normalized title 建立可能 cluster，避免把所有 raw items 无限制送入模型。
3. Gemini 收到有界的 candidate JSON，每项只包含内部 ID 和允许用于摘要的 metadata。
4. Gemini 输出严格 JSON：candidate IDs、英文 title、英文 summary、beat、territories、indicator concepts。
5. Zod 验证输出：
   - 所有 candidate ID 必须来自本次输入；
   - territories 必须来自固定 enum；
   - beat 必须来自五类 allowlist；
   - indicators 必须来自当前 allowlist；
   - title／summary 长度必须合规；
   - 一个 source item 不得同时属于两个 digest clusters。
6. 后端用 candidate IDs 附上真实来源；不接受模型返回的 URL 或 source count。
7. 系统在写入前原子检查/建立 `news_generation_batches.fingerprint`，并查询近 72 小时 likely-story matches。
8. Likely match 不自动并入旧 article；系统建立新的 `PENDING` draft 和一到多条 `news_duplicate_matches`，由管理员决定 merge/dismiss/reject。
9. 旧 article 无论是 `PENDING` 或 `PUBLISHED` 都不会被 ingestion 自动修改；管理员 merge 后才迁移 source links，已发布 target 的公开内容在来源批准前保持不变。
10. 合法输出的最终提交必须在一个 PostgreSQL transaction 中同时：建立新的 `PENDING` NewsArticle、source links、duplicate matches 和 audit metadata；把该 batch 拥有的 candidates 从 `PROCESSING` 改为 `CLUSTERED/IGNORED`；把 generation batch 从 `RUNNING` 改为 `SUCCEEDED` 并写 `completed_at`。任一写入失败全部回滚，因此不能出现 article 已提交但 batch 仍可 reclaim 的崩溃窗口。Ingestion 不更新旧 article；旧 article 变化只能来自管理员 edit/merge/source-review transaction。
11. 非法输出只记录 model validation error；不保存半成品。
12. 若没有相关新闻，run 成功结束并产生 0 drafts；系统不制造 filler。

### 3.3 管理员审核

1. `ADMIN` 登录后进入 `/admin/news`。
2. Pending queue 显示 AI title、summary、beat、territories、indicator chips、所有来源和 source coverage。
3. 管理员可以打开所有原始 source links。
4. 管理员可以编辑 title、summary、beat、territories 和 indicator concepts。
5. Source URL、publisher、original title 和 source published time 不可通过普通 edit form 修改。
6. 管理员选择：
   - `Approve`：发布当前内容；
   - `Edit & Publish`：保存编辑后内容并发布；
   - `Reject`：必须选择或输入原因。
7. 单来源 article 审核时显示警告，并要求管理员额外确认。
8. 审核请求带 `version`，防止两个管理员同时覆盖；旧 version 返回 `409 REVIEW_VERSION_CONFLICT`。
9. 每次动作记录 reviewer、时间、action、reason 和内容 snapshot。
10. Queue 同时显示 likely duplicates 和 merge 后仍 pending 的 source amendments；管理员可以 merge/reject/approve 新来源，公开内容在批准前保持不变。
11. Article 仍有任何 `PENDING` duplicate match 时，Approve 必须返回 `409 DUPLICATE_REVIEW_REQUIRED`；管理员必须先逐项 dismiss，或选择一个 target merge。

### 3.4 公开浏览

1. 访客进入 `/news`，不要求登录。
2. 页面通过 `/api/news` 获取已发布内容。
3. 用户可以搜索、按 territory/beat 过滤、排序并 Load More。
4. News card 显示 AI label、territories、beat、发布时间和 `Reported by N independent sources`。
5. 详情页显示摘要、全部来源、AI disclosure 和 indicator chips。
6. Indicator chip 显示当前 Dashboard 值（若存在）并 deep-link 到对应地图或 Regional Details。
7. 没有当前指标值时，chip 仍显示概念名称，但明确显示 `Current value unavailable`。
8. 被管理员撤下的内容不再出现在列表和详情 API；旧 URL 返回 `404`，不泄漏 draft 状态。

---

## 4. 建议目录与文件位置

```text
Borneo_Tracker/
├─ docs/
│  ├─ NEWS_DIGEST_IMPLEMENTATION_PLAN.md
│  └─ NEWS_SOURCE_REGISTER.md                # Phase 0 实测后建立
│
├─ server/
│  ├─ prisma/
│  │  ├─ schema.prisma                       # News enums/models
│  │  └─ migrations/<timestamp>_news_digest/
│  ├─ src/
│  │  ├─ app.ts                              # mount public/admin news routers
│  │  ├─ config/env.ts                       # Gemini/news env validation
│  │  ├─ middleware/
│  │  │  └─ requireRole.ts                   # ADMIN authorization
│  │  ├─ modules/news/
│  │  │  ├─ news.config.ts                   # beats, territories, indicator allowlist
│  │  │  ├─ news.schemas.ts                  # API and model-output Zod schemas
│  │  │  ├─ news.routes.ts                   # public read endpoints
│  │  │  ├─ news.admin.routes.ts             # admin review endpoints
│  │  │  ├─ news.service.ts                  # query/review transactions
│  │  │  └─ news.types.ts
│  │  └─ news-ingestion/
│  │     ├─ sourceRegistry.ts                # enabled feeds/query definitions
│  │     ├─ feedClient.ts                    # timeout, size cap, safe fetch
│  │     ├─ rssParser.ts
│  │     ├─ normalizeCandidate.ts
│  │     ├─ deduplicateCandidates.ts
│  │     ├─ clusterCandidates.ts
│  │     ├─ digestProvider.ts                # provider interface
│  │     ├─ geminiDigestProvider.ts
│  │     ├─ digestPrompt.ts                   # versioned prompt
│  │     ├─ validateDigest.ts
│  │     ├─ runNewsDigest.ts                 # orchestration
│  │     └─ cli.ts                           # manual/scheduled entry point
│  └─ tests/
│     ├─ fixtures/news/
│     ├─ unit/news/
│     └─ integration/news.test.ts
│
├─ src/
│  ├─ assets/news/                            # local five-beat artwork/fallback
│  ├─ auth/
│  │  └─ AdminOnlyRoute.jsx
│  ├─ services/
│  │  ├─ newsService.js                      # public API client
│  │  └─ newsAdminService.js                 # admin API client
│  ├─ pages/news/
│  │  ├─ NewsPage.jsx                        # adapt existing
│  │  ├─ NewsDetailPage.jsx                  # adapt existing
│  │  ├─ NewsCard.jsx                        # multi-source/count
│  │  ├─ NewsSourceList.jsx                  # new
│  │  ├─ NewsIndicatorChip.jsx               # new
│  │  └─ NewsBeatArtwork.js                  # local beat -> artwork mapping
│  └─ pages/admin/news/
│     ├─ NewsReviewPage.jsx
│     ├─ NewsReviewCard.jsx
│     └─ NewsEditForm.jsx
│
└─ .github/workflows/
   └─ news-digest.yml                        # only if scheduler decision selects GitHub Actions
```

不建议：

- 把 Gemini API key 放进 React/Vite 环境变量。
- 在浏览器直接访问 RSS 或 Gemini。
- 把 News tables 写入 SQLite。
- 从 GitHub Action 直接开放生产 PostgreSQL credentials，除非部署安全审查明确批准。
- 同时维护 Python 和 TypeScript 两套 News ingestion。

---

## 5. 数据库设计

### 5.1 Enums

```prisma
enum NewsArticleStatus {
  PENDING
  PUBLISHED
  REJECTED
  WITHDRAWN
}

enum NewsBeat {
  FIRE_HAZE
  DEFORESTATION_PALM_OIL
  FLOODS_EXTREME_WEATHER
  CONSERVATION_WILDLIFE
  SUSTAINABLE_POLICY_DEVELOPMENT
}

enum NewsRunStatus {
  RUNNING
  SUCCEEDED
  PARTIAL
  FAILED
}

enum NewsCandidateStatus {
  COLLECTED
  PROCESSING
  CLUSTERED
  IGNORED
  FAILED
}

enum NewsSourceLinkStatus {
  PENDING
  APPROVED
  REJECTED
}

enum NewsDuplicateMatchStatus {
  PENDING
  MERGED
  DISMISSED
}

enum NewsGenerationStatus {
  RUNNING
  SUCCEEDED
  FAILED
}

enum NewsReviewAction {
  CREATED_BY_AI
  EDITED
  APPROVED
  REJECTED
  WITHDRAWN
  DUPLICATE_MERGED
  DUPLICATE_DISMISSED
  SOURCE_APPROVED
  SOURCE_REJECTED
}

enum BorneoTerritory {
  SABAH
  SARAWAK
  BRUNEI
  KALIMANTAN
}
```

### 5.2 `news_ingestion_runs`

| 字段 | 规则 | 用途 |
|---|---|---|
| `id` | UUID PK | run identity |
| `status` | `NewsRunStatus` | run 状态 |
| `started_at`／`completed_at` | timestamptz | duration |
| `heartbeat_at` | nullable timestamptz | stale-run detection |
| `trigger_type` | varchar | manual／schedule |
| `feeds_attempted/succeeded/failed` | int | source health |
| `items_collected/new/deduped` | int | collection metrics |
| `drafts_created` | int | output count |
| `model_name`／`prompt_version` | varchar | reproducibility |
| `error_summary` | nullable varchar | sanitized failure summary |

不得保存 API key、完整 prompt secrets 或任意 credential。

### 5.3 `news_feed_attempts`

每次 run 必须为每个尝试的 registry source 写一条记录，不能只保存 aggregate counters：

| 字段 | 规则 | 用途 |
|---|---|---|
| `id` | UUID PK | attempt identity |
| `run_id` | FK | 所属 ingestion run |
| `source_registry_id` | varchar | 精确来源 |
| `status` | success/failed | source health |
| `started_at/completed_at` | timestamptz | duration |
| `http_status` | nullable int | sanitized network result |
| `item_count` | int | collected count |
| `latency_ms` | int | source performance |
| `error_code` | nullable varchar | bounded machine-readable failure |

以 `(run_id, source_registry_id)` 建 unique constraint。Priority source 的连续失败告警从此表计算；`news_ingestion_runs` 的 feed counters 只是汇总，不是监控唯一来源。

### 5.4 `news_candidates`

| 字段 | 规则 | 用途 |
|---|---|---|
| `id` | UUID PK | 只给模型引用的内部 ID |
| `run_id` | FK | 首次采集 run |
| `status` | `NewsCandidateStatus` | 生命周期 |
| `source_registry_id` | varchar | 来源配置 ID |
| `publisher_name/domain` | varchar | whitelist identity |
| `publisher_group` | varchar | 独立媒体集团 identity；用于 corroboration count |
| `canonical_url` | text | 原文 URL |
| `canonical_url_hash` | char(64), unique | 跨 run dedupe |
| `original_title` | varchar(500) | provenance |
| `rss_summary` | text, nullable | AI 输入；不得公开当正文 |
| `source_published_at` | timestamptz | 时间过滤 |
| `language` | varchar(16) | en／ms／id／zh 等 |
| `collected_at` | timestamptz | audit |
| `processed_at` | nullable timestamptz | terminal/last processing time |
| `attempt_count` | int default 0 | bounded retry |
| `last_error_code` | nullable varchar | sanitized failure reason |
| `processing_lease_expires_at` | nullable timestamptz | crash recovery lease |

`rss_summary` 建议只保留 30 天供审计和 troubleshooting，之后清空；title、URL、publisher 和 timestamp 可保留用于 provenance。

Candidate claim 使用 transaction 中的 compare-and-set：只有 `COLLECTED -> PROCESSING` 成功的 worker 可以处理；成功后进入 `CLUSTERED/IGNORED`，可重试错误回到 `COLLECTED`，达到上限进入 `FAILED`。`PROCESSING` 使用有界 lease；worker crash 后下一次 run 只能 reclaim 已过期 lease。不能只靠内存数组判断状态。

### 5.5 `news_generation_batches`

Exact rerun 幂等记录必须独立于 article，因为 PENDING enrichment 会改变 article 的 candidate set，不能只把最新 fingerprint 存在 article 上：

| 字段 | 规则 | 用途 |
|---|---|---|
| `id` | UUID PK | generation batch |
| `run_id` | FK | source run |
| `fingerprint` | char(64), unique | sorted candidate IDs + model + prompt version |
| `candidate_ids` | UUID[]/JSON | audit input identity，不含 RSS text |
| `model_name`／`prompt_version` | varchar | reproducibility |
| `status` | `NewsGenerationStatus` | lifecycle |
| `started_at/completed_at` | timestamptz | duration |
| `lease_expires_at` | nullable timestamptz | crashed batch recovery |
| `attempt_count` | int default 0 | bounded retry |
| `error_code` | nullable varchar | sanitized failure |

Worker 必须先原子 insert fingerprint；unique conflict 时检查状态：`SUCCEEDED` 不再生成，未过期 `RUNNING` 不重复执行，过期 lease 或 retryable `FAILED` 按 attempt policy 原子 reclaim。不能删除 ledger 后无界重跑。

Batch finalization 的 transaction 边界必须覆盖完整 article graph、candidate terminal transitions，以及 batch `SUCCEEDED/completed_at`。Transaction commit 是唯一成功点；commit 前 worker crash 不留下 article，commit 后 ledger 已是 `SUCCEEDED`，相同 fingerprint 无法再次生成。不可把 batch success 当成 article transaction 之后的 best-effort update。

### 5.6 `news_articles`

| 字段 | 规则 | 用途 |
|---|---|---|
| `id` | UUID PK | internal identity |
| `slug` | unique varchar | public URL |
| `status` | enum | publication state |
| `title` | varchar(180) | 管理员可编辑 |
| `summary` | varchar(2000) | plain-text English digest |
| `beat` | enum | fixed scope |
| `territories` | `BorneoTerritory[]` | multi-territory story |
| `primary_territory` | enum | card display/sort |
| `indicator_concepts` | `String[]` | validated dashboard concepts |
| `ai_generated` | boolean default true | disclosure |
| `model_name` | varchar | generation audit |
| `prompt_version` | varchar | generation audit |
| `event_fingerprint` | char(64), indexed | cross-run likely-story lookup，不自动证明相同事件 |
| `last_generation_batch_id` | nullable FK | 最新生成/重写 batch |
| `version` | int default 1 | optimistic concurrency |
| `approved_by_id` | nullable User FK | reviewer |
| `approved_at/published_at` | nullable timestamptz | lifecycle |
| `rejected_at/withdrawn_at` | nullable timestamptz | lifecycle |
| `created_at/updated_at` | timestamptz | lifecycle |
| `story_first_reported_at` | timestamptz | 最早 verified source 时间 |
| `story_latest_reported_at` | timestamptz | 最新 verified source 时间；public latest sort 使用 |

规则：

- `sourceCount` 不由 AI 写入，API 从 `APPROVED` source links 关联 candidates 的 distinct verified `publisher_group` 计算；同一媒体集团的不同域名不重复计数。
- `PUBLISHED` 必须有 `approved_by_id`、`approved_at`、`published_at` 和至少一个 source。
- `PENDING -> PUBLISHED/REJECTED`、`PUBLISHED -> WITHDRAWN` 是允许的状态变化；其他变化拒绝。
- Slug 冲突必须使用稳定 suffix，不覆盖旧 article。
- `primary_territory` 必须包含在 `territories` 中。
- `indicator_concepts` 至少一个；若文章无法映射指标，不属于 Borneo Pulse 范围。

Generation batch fingerprint 由 sorted candidate IDs + model + prompt version 计算，独立 ledger 的数据库 unique constraint 保证旧 batch 即使后来 enrichment 也不会被重复处理。`event_fingerprint` 用 beat、territories、UTC 日期 bucket 和 normalized title terms 建立 likely-match index；系统仍查询相同 beat/territory/72h window 并计算 token similarity，fingerprint 不作为 truth 或自动 merge 的唯一依据。

需要在 SQL migration 中加入 Prisma schema 无法完整表达的 `CHECK` constraints 和必要 index，例如 status/published time、territory GIN 或等价查询 index。

### 5.7 `news_article_sources`

Candidate 与 article 通过显式 join table 关联，避免新来源未经审核就改变已发布页面：

| 字段 | 规则 | 用途 |
|---|---|---|
| `id` | UUID PK | source-link identity，供 API 和 audit 精确引用 |
| `article_id` | FK | digest article |
| `candidate_id` | FK, unique | 一个 source item 只能属于一个 article |
| `status` | `NewsSourceLinkStatus` | source approval state |
| `reviewed_by_id` | nullable User FK | source amendment reviewer |
| `reviewed_at` | nullable timestamptz | audit |

初次 PENDING article 的 links 为 `PENDING`，article approve transaction 同时把它们改成 `APPROVED`。后续 run 的 likely duplicate 先形成独立 PENDING article；只有管理员 merge 后，source links 才迁移到 target。Target 已发布时，迁移 links 默认保持 `PENDING`，Admin queue 直接查询这些 pending links。公开 source list/count 只计算 `APPROVED` links。Ingestion 不得直接修改已发布 corroboration。

Source-link approve transaction 同时从全部 approved sources 重新计算 `story_first_reported_at` 和 `story_latest_reported_at`；不得接受客户端提交这两个聚合时间。

### 5.8 `news_duplicate_matches`

Cross-run matcher 可能找到多个 target，不能只在 candidate/article 保存一个 nullable target：

| 字段 | 规则 | 用途 |
|---|---|---|
| `id` | UUID PK | match identity |
| `source_article_id` | FK | 新 pending draft |
| `target_article_id` | FK | 可能相同的旧 article |
| `score` | decimal | deterministic similarity evidence |
| `signals` | JSON | beat/territory/date/title-token signals |
| `status` | `NewsDuplicateMatchStatus` | admin resolution |
| `version` | int default 1 | optimistic concurrency/CAS |
| `resolved_by_id/resolved_at` | nullable | audit |

以 `(source_article_id, target_article_id)` unique。Dismiss/merge 必须以 `id + version + status=PENDING` 做 compare-and-set，成功时递增 version；零行更新返回 409 并重新载入。Score 只用于排序 review queue，不允许自动发布或自动 merge。

### 5.9 `news_review_events`

| 字段 | 用途 |
|---|---|
| `id` | event UUID |
| `article_id` | FK |
| `operation_id` | UUID | 同一 merge/source transaction 的 correlation ID |
| `related_article_id` | nullable FK | merge counterpart |
| `source_link_id` | nullable FK | source approve/reject subject |
| `duplicate_match_id` | nullable FK | duplicate dismiss/merge subject |
| `reviewer_id` | nullable User FK；AI create event 可为空 |
| `action` | enum |
| `reason` | reject/withdraw reason |
| `before_snapshot`／`after_snapshot` | JSON |
| `metadata` | bounded JSON | source/target IDs、version、approved-source decision 等非敏感审计资料 |
| `created_at` | audit time |

Snapshot 只包含可发布字段和 tags，不复制 credentials、cookies 或完整 RSS payload。Merge transaction 必须以同一 `operation_id` 对 source article 和 target article 各写一条 `DUPLICATE_MERGED` event，并记录 match/source-link IDs；source approve/reject 和 duplicate dismiss 使用各自 action enum 与 subject ID，不能只写模糊的 `EDITED`。

---

## 6. 固定 vocabulary 与内容规则

### 6.1 Territories

公开 API 使用 display values：

```text
Sabah | Sarawak | Brunei | Kalimantan
```

数据库 enum 与 API display mapping 只能集中定义一次，不在页面重复硬编码。

### 6.2 Beats

| enum | 显示文字 |
|---|---|
| `FIRE_HAZE` | Fire & Haze |
| `DEFORESTATION_PALM_OIL` | Deforestation & Palm Oil |
| `FLOODS_EXTREME_WEATHER` | Floods & Extreme Weather |
| `CONSERVATION_WILDLIFE` | Conservation & Wildlife |
| `SUSTAINABLE_POLICY_DEVELOPMENT` | Sustainable Policy & Development |

### 6.3 Indicator concepts

News tags 必须从当前 Dashboard concepts 选择。第一版允许集合：

```text
fire_hotspots
air_quality
deforestation
forest_cover
protected_areas
heritage
clean_water_access
poverty
unemployment_rate
economy
healthcare
education
governance
food
energy
shelter
entertainment
```

实施时添加 contract test，读取 `public/data/indicators.json`，确保 allowlist 中的 key 仍存在。若 pipeline 改名，测试必须失败并要求显式 migration，不能静默产生 broken deep links。

### 6.4 内容长度与编辑规则

- Title：20–180 Unicode characters。
- Summary：80–2,000 Unicode characters。
- 每篇至少 1 个 territory、1 个 indicator concept、1 个 source。
- 最多 4 个 territories、5 个 indicator concepts。所有通过审核的 independent source links 都计入 `sourceCount`；不得为了 UI 截断而少算。Run/batch 本身仍有受控 candidate 上限，超过上限时分批处理而不是静默丢弃来源。
- RSS summary 在进入 prompt 前移除 HTML tags 并规范化 whitespace。
- AI 输出不允许 HTML、Markdown links、script-like tags 或 embedded URLs。
- Source links 只来自后端 candidate records。

---

## 7. RSS Source Registry 与采集安全

### 7.1 Phase 0 必须建立 `NEWS_SOURCE_REGISTER.md`

每个来源记录：

- stable internal ID；
- publisher name；
- publisher ownership group；
- territory coverage；
- language；
- feed/query URL；
- expected publisher domains；
- adapter type：publisher RSS／Google News RSS／GDELT；
- 实测日期、HTTP 状态、item count、timestamp quality、summary quality；
- terms/copyright review note；
- enabled/disabled；
- failure owner。

未进入 register 或未通过验证的 URL 不得由生产 job fetch。

### 7.2 Adapter 优先顺序

1. 已验证的 publisher-native RSS。
2. 已验证的 Google News RSS queries 作为覆盖补充。
3. GDELT 只有在 Kalimantan coverage 明显不足且 Phase 0 实测通过后才启用。

不把任一聚合器当成不可替换的单点依赖。所有来源通过统一 adapter contract：

```ts
interface NewsSourceAdapter {
  id: string;
  collect(window: { from: Date; to: Date }): Promise<CollectedNewsItem[]>;
}
```

### 7.3 Safe fetch 要求

- 只允许 registry 中固定的 HTTPS host。
- 禁止 user-provided URL。
- DNS/IP resolution 必须拒绝 loopback、link-local 和 private network targets，防止 SSRF。
- Redirect 每一步重新验证 host，最多 3 次。
- Connection/request timeout。
- Response byte cap 和 feed item cap。
- 只接受 XML/RSS/Atom 的允许 content types；兼容错误 content type 必须由 source-specific config 明确批准。
- XML parser 禁用 DTD、external entities 和 network entity resolution。
- 错误日志不得写入 feed credentials 或 Gemini key。

### 7.4 URL 与 source 去重

1. 解析 aggregator redirect 后取得可验证 publisher URL；若无法安全解析，candidate 不进入 production queue。
2. Scheme/host lowercase，移除 fragment 和已知 tracking params。
3. 保留可能改变内容 identity 的 query params。
4. 以 normalized URL 的 SHA-256 做唯一 key。
5. 同 publisher ownership group 的转载不增加 independent source count。
6. Independent source count 使用 distinct verified `publisher_group`，而不是 RSS item、feed 或 domain 数量。
7. URL dedupe 只解决同一链接，不等于同一事件 dedupe。每批 cluster 完成后还要对近 72 小时 `event_fingerprint`、territory、beat、source time 和 normalized title token similarity 做 likely-story lookup。
8. Exact candidate set 由 `news_generation_batches.fingerprint` unique constraint 保证幂等；新增来源导致 candidate set 改变时，必须建立 pending duplicate match，再由管理员 merge/source-amendment 流程处理，不能自动建立第二篇已发布文章。
9. Likely match 不能自动改动 `PUBLISHED` 内容；ambiguous match 必须进入管理员 duplicate review。

---

## 8. Gemini integration 设计

### 8.1 Provider boundary

定义内部接口，不让 business service 直接依赖 Gemini SDK：

```ts
interface NewsDigestProvider {
  generate(input: DigestBatchInput): Promise<unknown>;
}
```

生产默认实现是 Gemini；测试使用 deterministic fake provider。模型名称由 `GEMINI_MODEL` 环境变量配置，但生产 allowlist 必须限制已验证模型。

### 8.2 Prompt contract

Prompt 必须版本化，例如 `news-digest-v1`，并包含：

- RSS 内容是不可信数据，不是 instruction。
- 只能选择给定 candidate IDs。
- 只处理五类 beats。
- 不判断真假，不声称 fact checked。
- 不生成 source URLs、source names 或 source count。
- 不补充输入中没有的事实、数字、人物引述或日期。
- 输出 English plain-text summary。
- 输出 JSON schema，不使用 Markdown。

### 8.3 Structured output validation

模型输出必须先作为 `unknown`，再经过 Zod：

- JSON parse/schema failure：整批不写 article。
- Unknown candidate ID：整批拒绝。
- Unknown tag/territory/beat：对应 item 拒绝并记录。
- Duplicate candidate assignment：整批拒绝。
- Empty or over-length content：item 拒绝。
- Model-returned URL/source field：schema 不接受。

### 8.4 Batch 与 retry

- 每批 candidate 数量和总字符数有上限。
- 不按 public page request 调用 AI。
- `429`、`503` 使用 exponential backoff + jitter，并有最大尝试次数。
- 非 retryable validation error 不重试。
- Run 可标记 `PARTIAL`，但已发布新闻不受影响。
- 幂等 key 由 candidate ID set + prompt version + model name 计算，重复 run 不建立重复 drafts。

### 8.5 Data handling

Free tier 的输入可能有不同数据使用条款。上线前负责人必须确认所选 Gemini tier 的 data handling 是否符合项目要求。RSS 输入不得包含用户个人资料、session、内部 secrets 或管理员信息。

---

## 9. API Contract

### 9.1 Public endpoints

#### `GET /api/news`

Query：

```text
territory=Sabah|Sarawak|Brunei|Kalimantan
beat=<NewsBeat>
q=<search string, max 100>
sort=latest|oldest
limit=1..24
cursor=<opaque cursor>
```

Response：

```json
{
  "items": [
    {
      "slug": "kalimantan-fire-alerts-2026-07-13",
      "title": "...",
      "summary": "...",
      "beat": "FIRE_HAZE",
      "territories": ["Kalimantan"],
      "primaryTerritory": "Kalimantan",
      "indicatorConcepts": ["fire_hotspots", "air_quality"],
      "aiGenerated": true,
      "sourceCount": 3,
      "storyFirstReportedAt": "2026-07-12T23:30:00.000Z",
      "storyLatestReportedAt": "2026-07-13T02:10:00.000Z",
      "publishedAt": "2026-07-13T05:00:00.000Z"
    }
  ],
  "totalCount": 18,
  "nextCursor": null
}
```

只返回 `PUBLISHED`。`latest` 按 `storyLatestReportedAt DESC, id DESC`，不是按管理员批准时间；`publishedAt` 表示 Borneo Pulse 的发布时间。Cursor 必须是 opaque、validated 和有稳定排序 tie-breaker 的值。`totalCount` 是应用当前全部 filters 后的总数，用于保留现有 NewsFilters result count。

#### `GET /api/news/:slug`

返回 article fields、全部 approved sources，以及服务端计算的 `relatedItems`（最多 3 条）：

```json
{
  "article": {
    "slug": "kalimantan-fire-alerts-2026-07-13",
    "title": "...",
    "summary": "...",
    "sources": [
    {
      "publisherName": "...",
      "originalTitle": "...",
      "url": "https://...",
      "publishedAt": "..."
    }
    ]
  },
  "relatedItems": []
}
```

未发布、withdrawn 或不存在统一返回 `404 NEWS_NOT_FOUND`。

Related items 按共享 territory、beat、indicator concepts 和时间排序，只返回 published。v1 不建立独立 related endpoint，避免 detail 页面第二次请求和 contract 分叉。

### 9.2 Admin endpoints

所有写入：exact Origin + JSON + CSRF + ACTIVE session + ADMIN role。

```text
GET   /api/admin/news?status=PENDING&cursor=...
GET   /api/admin/news/:id
PATCH /api/admin/news/:id
POST  /api/admin/news/:id/approve
POST  /api/admin/news/:id/reject
POST  /api/admin/news/:id/withdraw
POST  /api/admin/news/:id/merge
POST  /api/admin/news/:id/duplicates/:matchId/dismiss
POST  /api/admin/news/:id/sources/:sourceLinkId/approve
POST  /api/admin/news/:id/sources/:sourceLinkId/reject
```

更新 payload 必须包含 `version`。Approve service 在同一个 transaction 中：

1. lock article；
2. 验证 current version/status；
3. 查询该 article 的 duplicate matches；任何 `PENDING` match 都返回 `409 DUPLICATE_REVIEW_REQUIRED`；
4. 验证至少一个 source 和有效 tags；
5. 对 single-source 批准检查 explicit acknowledgement；
6. 把初次 source links 改为 approved，并从 approved sources 计算 story dates；public `sourceCount` 始终按查询动态派生；
7. 写 published state；
8. 写 review event；
9. commit 后才对 public query 可见。

对已发布 article 的新 corroborating source，source-link approve/reject 使用独立 transaction 和明确 `SOURCE_APPROVED/SOURCE_REJECTED` audit event；批准前 public source list/count/story dates 不变，批准后在同一 transaction 重算 story dates，动态 sourceCount 才包含该 link。

Merge payload 只包含 source article version、target article ID/version 和 chosen match ID/version，不接受任何 source-approval flag。Service lock 两篇 article，并以 chosen match `id + version + status=PENDING` 做 CAS；将不重复 source links 移到 target，把 chosen match 标记 `MERGED` 并递增 version，把同一 source article 的其他 `PENDING` matches 原子标记 `DISMISSED` 并递增各自 version，再把 source article 标记为 `REJECTED`（reason=`MERGED`）。任一 article/match version 不符返回 409 且 transaction 不产生部分变化。对 source/target 写使用同一 operation ID 的 audit。Target 已发布时，所有迁移 links 无条件保持 `PENDING`；merge transaction 不改变公开 sources/sourceCount/story dates，也不写 `SOURCE_APPROVED`。管理员之后必须通过 source-link endpoints 逐条 approve/reject，每条决定各写一个精确引用 sourceLinkId 的 audit event；只有逐条 approve transaction 才能重算 story dates 和改变动态 sourceCount。

Dismiss duplicate match payload 包含 article version 和 match version；transaction 以 match `id + version + status=PENDING` CAS，成功时递增 match version并写 `DUPLICATE_DISMISSED` audit，只把该 match 标记为 `DISMISSED`，source article 保持 `PENDING` 供正常审核。CAS 失败返回 409。Reject source article时，其所有 unresolved duplicate matches 同 transaction 标记 `DISMISSED` 并递增各自 version；queue 不得留下无法处理的 pending match。

### 9.3 Error codes

```text
NEWS_NOT_FOUND
NEWS_VALIDATION_ERROR
NEWS_STATUS_CONFLICT
REVIEW_VERSION_CONFLICT
ADMIN_REQUIRED
SINGLE_SOURCE_ACK_REQUIRED
NEWS_SOURCE_INVALID
NEWS_MERGE_CONFLICT
DUPLICATE_REVIEW_REQUIRED
NEWS_INGESTION_DISABLED
NEWS_PROVIDER_UNAVAILABLE
```

公开错误不暴露 prompt、RSS raw payload、数据库内容或 provider response。

---

## 10. 前端实施

### 10.1 `newsService.js`

保留现有 service abstraction，移除生产 mock import：

```js
getNewsArticles(filters, cursor)
getNewsArticleBySlug(slug)
```

`getNewsArticleBySlug` 返回 `{ article, relatedItems }`；v1 不再单独调用 `getRelatedNewsArticles`。

Mock fixtures 只能存在于 tests/story fixtures，不能作为 production fallback。API 失败时显示 error，不悄悄展示 fabricated news。

### 10.2 News list

- Filter 改为 API query；search 使用 debounce。
- Beat/category options 直接来自固定 `NewsBeat` display config，不能再从当前一页已载入 articles 动态推导，否则 cursor pagination 会缺少选项。
- Load More 使用 `nextCursor`，不再先下载全部内容再 `slice`。
- Result count 使用 API `totalCount`，不是当前已载入 item 数。
- 同一 request 只允许最新 response 更新 state，避免快速筛选产生 race。
- Featured article 第一版取当前结果第一条；不新增复杂 recommendation system。
- Card 显示 source coverage，而不是单一 `sourceName`。
- Card 显示 `storyFirstReportedAt` 或产品批准的 story date label；排序使用 `storyLatestReportedAt`，不能把管理员批准时间伪装成新闻事件时间。
- 新建 `NewsBeatArtwork.js`，把五个 beat 映射到仓库内本地 artwork。`NewsCard`、`FeaturedNews`、`NewsImage` 和 detail 必须支持 artwork/null fallback，不再要求 API 提供 remote `imageUrl`。

### 10.3 News detail

- Route param 使用 slug；保留 `/news/:articleId` path pattern 也可，但组件变量统一命名 `slug`。
- 显示完整 source list。
- 每个 source link 使用 `target="_blank" rel="noopener noreferrer"`。
- AI disclosure 明确说明这是 rewritten summary，不是原文或 fact check。
- 不展示 RSS raw summary。
- 使用 detail response 已包含的 `relatedItems`；不发第二个 related request。
- 保留当前 SDG chips，但不在 News DB 重复保存 `sdgTags`：前端根据 article `indicatorConcepts`、territories 和已加载 canonical indicator rows 取得 `sdg_goal` union。没有映射时不显示空 chip。

### 10.4 Indicator chips 与 deep links

新建 `NewsIndicatorChip.jsx`：

1. 使用 `indicatorConcept` 查找当前 territory 的 canonical row。
2. 显示 indicator label、当前 value、year 和 confidence（空间不足时详情页完整显示，card 只显示 label）。
3. Map layer concepts deep-link：

```text
fire_hotspots -> /?territory=Kalimantan&layer=fireHotspots
air_quality   -> /?territory=Kalimantan&layer=airQuality
deforestation -> /?territory=Kalimantan&layer=deforestation
forest_cover  -> /?territory=Kalimantan&layer=forestCover
poverty       -> /?territory=Kalimantan&layer=poverty
```

4. 其他 concepts 跳转：

```text
/regions?territory=Kalimantan&concept=energy
```

5. `OverviewDashboard.jsx` 和 `Regional_Detail.jsx` 必须解析、validate 并应用这些 query params；未知值回到安全 default。
6. 同一组 canonical rows 同时用于派生详情页 SDG goal chips，避免 News AI 自行生成与指标不一致的 SDG tags。

注意：Dashboard 数据提供相关背景，不应在 UI 文案中声称指标“证明新闻为真”。推荐文案是 `Related dashboard evidence`。

### 10.5 Admin UI

`AdminOnlyRoute` 行为：

- loading：等待 session。
- anonymous：跳 login 并保留 return path。
- authenticated USER：显示 403／navigate home，不渲染 admin page。
- authenticated ADMIN：进入 queue。

Admin form 必须：

- 显示 immutable sources；
- 编辑 title、summary、beat、territories、indicators；
- 显示长度限制；
- 显示 single-source warning；
- 显示所有 likely-duplicate targets 及其 match 状态；每个 pending match 都必须可选择受版本控制的 dismiss，或选定一个 target 执行 atomic merge；所有 matches 解决前禁用 article approve，并解释 `DUPLICATE_REVIEW_REQUIRED`；
- 显示已发布 article 的 pending source amendments，提供逐条 approve/reject；批准前公开来源列表、source count 和 story dates 必须保持不变，批准后才刷新为重新计算的值；
- Merge dialog 不提供“同时批准来源”选项；若 target 已发布，成功提示必须说明迁移来源仍待逐条审核，并将管理员引导到 source-amendment queue；
- merge/source-review 成功后重新取得 article、matches、source links 和 version，不能只在浏览器本地猜测最终状态；
- submit 期间禁止重复操作；
- 409 时重新载入而不是覆盖；
- reject/withdraw 要求 reason；
- 操作成功后从 queue 移除并显示确认。

---

## 11. Scheduler 与部署

### 11.1 本地和开发阶段

在 `server/package.json` 增加：

```text
news:ingest      -> tsx src/news-ingestion/cli.ts
news:ingest:dry  -> dry-run，不写 drafts
```

Dry run 输出 counts 和 sanitized sample，不打印完整 copyrighted summaries 或 secrets。

### 11.2 生产 scheduler 决策门槛

优先顺序：

1. 部署平台的 cron/scheduled job，在同一应用环境运行 CLI，直接使用 application `DATABASE_URL`。
2. 若平台不支持 cron，建立独立 `.github/workflows/news-digest.yml`，调用受保护的 internal trigger API。

若选择 GitHub Action trigger：

- Action 不持有 `DATABASE_URL`。
- Action 使用独立 `NEWS_JOB_SECRET` 对 timestamp + body 做 HMAC。
- 服务端验证短时间窗口、nonce/replay 和 HMAC constant-time equality。
- Internal endpoint 只触发 job，不接受任意 feed URL、prompt 或 article content。
- 并发 run 使用 PostgreSQL advisory lock 或 run lock，第二个请求返回 `409 NEWS_RUN_IN_PROGRESS`。

不得把 News job 直接塞进现有 Python `run_pipeline.py`；两个 pipeline 的失败域和发布目标不同。

### 11.3 环境变量

```text
NEWS_DIGEST_ENABLED=false
NEWS_LOOKBACK_HOURS=48
NEWS_MAX_FEED_BYTES=<reviewed limit>
NEWS_MAX_ITEMS_PER_FEED=<reviewed limit>
NEWS_CANDIDATE_RETENTION_DAYS=30
GEMINI_API_KEY=<secret>
GEMINI_MODEL=<approved model id>
NEWS_PROMPT_VERSION=news-digest-v1
```

若采用 GitHub trigger 再增加：

```text
NEWS_JOB_SECRET=<32+ byte random secret>
```

所有 env 进入 `server/src/config/env.ts` 的 Zod schema；`NEWS_DIGEST_ENABLED=false` 时允许开发环境不提供 Gemini key，启用时 key/model 必须 fail fast。

---

## 12. Security、版权与内容治理

### 12.1 权限

- UI route 不能替代 API authorization。
- 所有 admin actions 写 audit event。
- Admin role 由受控数据库/运维流程授予，不提供公开“升级管理员”API。
- Public read API 不返回 reviewer email、candidate RSS summary、model raw output 或 internal IDs。

### 12.2 Prompt injection 与不可信输入

- RSS title/summary 视为 hostile input。
- AI 无 tool access、无 browser、无数据库权限。
- Prompt 指示模型忽略 RSS 内 instruction，但安全不能只依赖 prompt；最终靠 schema 和 candidate-ID binding。
- RSS/AI text 作为 plain text 输出，由 React 自动 escape。

### 12.3 Copyright 和 attribution

- 不抓 full article body。
- 不复制 publisher 图片。
- Public 页面只展示 original title、publisher、link 和自己的 reviewed summary。
- Source register 保存 feed/terms review note。
- 若 publisher 要求停止使用，disable source，并保留已发布 citation 的处理决定。
- 产品文案不得使用 `No copyright risk`；使用 `RSS metadata, rewritten summary and attribution reduce reproduction risk`。

### 12.4 AI transparency

每篇文章显示：

- `AI-generated summary, reviewed by a Borneo Tracker administrator.`
- 来源列表和 independent source count。
- 发布/更新时间。
- `This is not an automated fact check.` 或等价说明。

### 12.5 Data retention

- Candidate RSS summary 默认 30 天后清空。
- Ingestion run metrics 和 published provenance 保留期限由 staging/production privacy decision 确认。
- Rejected article content 保留期限需要产品 owner 决定；默认建议 90 天后只保留 audit metadata 和 rejection reason。

---

## 13. Testing 计划

### 13.1 前置安全修复

当前 server integration test 会 `TRUNCATE` 配置的数据库，而 Vitest 没有强制专用 test DB。新增任何 News integration test 前必须：

1. 增加独立 `TEST_DATABASE_URL` 或明确的 test database naming rule。
2. Test bootstrap 验证 database name/schema 含受控 test 标识；不符合则拒绝启动。
3. 测试不得读取开发/生产 `DATABASE_URL` 后直接清表。
4. CI 使用 ephemeral PostgreSQL service。

这是 News Phase 1 的 blocking gate，不是可延后优化。

### 13.2 Unit tests

- RSS/Atom fixtures parsing。
- HTML removal、Unicode 和 timezone parsing。
- Feed byte/item limit。
- Redirect/host allowlist 和 SSRF rejection。
- URL normalization 与 tracking params。
- Candidate URL dedupe。
- Candidate claim 使用 compare-and-set；活跃 lease 不能被第二个 worker 取得，过期 lease 可被 reclaim，超过 attempt limit 进入终态且不会无限重试。
- Distinct publisher source count。
- Deterministic cluster hints。
- Event matcher 使用固定 fixtures 覆盖同事件跨 publisher、相似标题但不同事件、跨日更新和多 target ambiguous cases，并明确允许的 false-positive/false-negative 边界。
- Prompt input serialization。
- Model schema validation。
- Unknown candidate/tag/territory rejection。
- Duplicate candidate assignment rejection。
- Retry/backoff classification。
- Generation batch fingerprint unique/CAS claim、过期 lease reclaim、attempt limit 和 completed batch 不重复产生 draft。
- Per-feed attempt 聚合与 consecutive-failure counter：单 feed 失败、全部失败、失败后恢复三种情况。
- Indicator allowlist 与 `indicators.json` contract。

所有 CI tests 使用 committed fixtures，不访问 live RSS 或 Gemini。

### 13.3 API integration tests

- Public list 只返回 published。
- Draft/rejected/withdrawn detail 返回统一 404。
- Filter/search/cursor 稳定。
- Anonymous/User 无法访问 admin API。
- Admin 可以查看 pending。
- Approve transaction 建立 review event。
- Single-source 没 acknowledgement 返回 `422 SINGLE_SOURCE_ACK_REQUIRED`。
- Stale version 返回 409。
- 同一 duplicate match 的两个并发 dismiss/merge 操作，只有 match-version CAS 胜出的一个成功，另一个返回 409，且没有重复 audit 或部分 merge。
- 两个并发 approve 恰好一个成功。
- 任何 pending duplicate match 都阻止 approve；逐项 dismiss 后才可 approve，并写带 match ID 的 `DUPLICATE_DISMISSED` audit。
- Merge 原子移动非重复 source links，不能丢失或重复来源。
- Multi-target merge 将 chosen match 标记 `MERGED`、同一 source article 的其余 pending matches 标记 `DISMISSED`，source/target audit 共用 operation ID；事务失败时全部回滚。
- 已发布 target 接收新 source links 后，merge API 即使被构造额外 approval 参数也必须拒绝或忽略，且 public list/detail 的 sources、sourceCount、storyFirstReportedAt/storyLatestReportedAt 完全不变；随后每条 link 经独立 approve/reject endpoint 决定，approve 后在同一 transaction 更新，reject 后永久不进入公开结果；每条决定恰好有一个精确 source-link audit。
- Withdraw 后立即不再公开。
- Ingestion rerun 幂等。
- Worker 在 candidate claim 或 generation batch 中途崩溃后，只有 lease 到期后的一个 worker 能 reclaim；专门模拟 article/source/match 写入后但 transaction commit 前崩溃，断言 article graph、candidate terminal state 与 batch success 全部回滚；重试只建立一个 draft。另测 commit 后 batch 已为 `SUCCEEDED`，不能再次 claim。
- Partial model output 不产生 orphan article/source rows。

### 13.4 Frontend tests

当前 root package 没有 React component test runner。Phase 2 必须明确加入：

- Vitest + jsdom 作为 frontend unit/component runner；
- React Testing Library + `@testing-library/jest-dom` + `@testing-library/user-event`；
- 根 scripts：`test:frontend`；
- server 保留 `test:server`，root `test` 顺序/并行运行两者；
- Playwright 作为 staging E2E runner，并增加 `test:e2e`；若团队决定使用等价工具，必须先更新本计划和 CI，不能只写“frontend tests”而没有 runner。

覆盖：

- News loading/error/empty/published rendering。
- Multiple sources 和 source count。
- Search/filter request mapping。
- Cursor Load More 去重。
- Indicator chip 有值/无值状态。
- Indicator concepts 派生 SDG chips 的 union/no-data 行为。
- Deep-link query parsing。
- AdminOnlyRoute USER/ADMIN 行为。
- Review edit、approve、reject、409 conflict。
- Duplicate 多 target 列表、逐项 dismiss、选择 target merge，以及 unresolved match 时 approve disabled/error refresh。
- Pending source amendment 的 approve/reject UI；操作前公开计数/日期不变化，操作成功后以 server 返回的重算结果刷新。
- AI disclosure 始终显示。

### 13.5 E2E staging flow

1. 使用 fixture/dry-run 产生 candidates。
2. Fake provider 产生 pending draft。
3. 普通用户确认看不到 draft。
4. Admin 登录、打开来源、编辑并批准。
5. 匿名用户在 `/news` 看见文章。
6. Indicator chip 跳到正确 territory/layer。
7. 第二个 run 产生 likely duplicate；确认管理员解决所有 matches 前不能批准，并测试 dismiss 后批准路径。
8. 将另一个 duplicate merge 到已发布 target；确认 merge UI/API 不能同时批准来源，所有迁移 links 保持 pending 且不改变公开 sources/count/dates；再逐条 approve/reject，确认只有获批 links 改变公开结果且每条都有 audit。
9. Admin withdraw 后 public URL 返回 not found。

### 13.6 Live-source smoke tests

Live RSS/Gemini 只在手动 staging smoke 或独立 scheduled monitor 运行，不作为 PR CI gate。连续失败必须告警，但不能让正常 frontend build 变得不稳定。

---

## 14. CI/CD 与运行监控

### 14.1 PR CI

必须执行：

- ESLint。
- Server typecheck/build。
- Frontend production build。
- News unit tests。
- Auth/News integration tests against ephemeral PostgreSQL。
- Prisma migration validation。

### 14.2 Scheduled run metrics

每次 run 至少记录：

- feeds attempted/succeeded/failed；
- items collected/new/deduped；
- candidates sent to AI；
- model calls/retries/validation failures；
- drafts created；
- run duration/status；
- pending queue age/count。

告警条件：

- 所有 feeds 失败。
- 连续 2–3 次 scheduled run 失败。
- 48 小时没有任何 source 成功。
- pending article 超过审核 SLA。
- model validation error 突然上升。
- source registry 中某个 priority source 连续失败。

日志不得包含 Gemini key、session cookie、CSRF token 或完整 raw model payload。

---

## 15. 分阶段实施顺序

### Phase 0：Requirements 与 Source Spike（Blocking）

目标：先证明来源和外部假设可用，再写 production pipeline。

- [ ] 将 Concept 的最终 acceptance criteria 合并进仓库文档。
- [ ] 整理当前未提交的 Auth backend，确认 migration、session、ADMIN role 和 tests 后建立可回滚的提交基线。
- [ ] 确认五类 beats。
- [ ] 确认每日 reviewer owner 和审核 SLA。
- [ ] 建立 `NEWS_SOURCE_REGISTER.md`。
- [ ] 实测 priority publisher RSS、Google News RSS 和必要 redirect behavior。
- [ ] 完成至少 7 天 source observation，记录每个 territory/beat 的 item supply 与失败率。
- [ ] 确认每个启用来源的 attribution/terms note。
- [ ] 确认 Gemini model、当前 quota、data handling 和 region availability。
- [ ] 用真实 samples 完成 dry clustering/summary spike，但不写数据库。
- [ ] 确认生产 scheduler 类型；若部署未定，只批准 local/staging CLI。

**Exit gate：** 每个 territory 至少有 2 个已验证且 ownership group 不同的来源路径；五个 beats 都有明确 query/feed coverage；English/Malay/Indonesian 按实际 territory 覆盖；完成 7 天 observation；source matrix 和不足之处由 supervisor 签核。若达不到门槛，必须缩小产品 coverage claim，不能仍宣称完整每日全 Borneo corroboration。能从真实 RSS 产生合法 candidate JSON；未确认来源不进入 Phase 4 production registry。

### Phase 1：Test Database Safety 与 News Schema

- [ ] 修复 integration test database guard。
- [ ] 增加 News enums/models/migration/check constraints/indexes。
- [ ] Prisma generate/typecheck。
- [ ] 建立 seed/fixture drafts。
- [ ] 验证 migration deploy 和 rollback/runbook。

**Exit gate：** Migration 在空 DB 和现有 auth DB 都成功；测试不可能 truncate 非 test DB。

### Phase 2：Public News API 与现有 UI 接入

- [ ] 建 public news routes/service/schemas。
- [ ] 实现 published-only query、filter、cursor 和 detail。
- [ ] 将 `newsService.js` 从 mock 改为 API。
- [ ] 更新 list/detail 为 multi-source shape。
- [ ] 移除 production mock fallback。
- [ ] 添加 public API/frontend tests。

**Exit gate：** Seeded published news 正常显示；pending/rejected 完全不可见；现有 News UX 无功能回退。

### Phase 3：Admin Authorization 与 Review Queue

- [ ] 增加 `requireRole` 和 `AdminOnlyRoute`。
- [ ] 建 admin news API。
- [ ] 建 pending queue/edit/approve/reject/withdraw UI。
- [ ] 实现 optimistic concurrency 和 audit events。
- [ ] 实现 multi-target likely-duplicate review、逐项 dismiss、unresolved-match approval gate 与 atomic merge。
- [ ] 实现已发布文章的 pending source-amendment queue、逐条 approve/reject、story-date 重算和公开数据隔离。
- [ ] 实现 single-source acknowledgement。
- [ ] 完成并发、权限、duplicate/source-review audit correlation tests。

**Exit gate：** 只有 ADMIN 能审核；所有状态变化原子且有可定位 subject 的 audit；两个并发审核不会双重发布；unresolved duplicate 不能绕过；pending source amendment 在批准前不会改变任何公开字段。

### Phase 4：RSS Collection Foundation

- [ ] 实现 source adapter contract 和 registry。
- [ ] Job 开始时取得 PostgreSQL run lock，并测试 manual/scheduled 并发只有一个进入处理。
- [ ] 实现 safe fetch/XML parser。
- [ ] 实现 normalization、domain verification、URL dedupe。
- [ ] 建 ingestion run/candidate persistence。
- [ ] 实现 candidate CAS claim、lease expiry reclaim、attempt limit 与 per-feed attempt/consecutive-failure persistence。
- [ ] 建 dry-run CLI。
- [ ] 用 fixtures 完成 unit tests。
- [ ] 用 staging 运行 live-source smoke。

**Exit gate：** 重跑幂等；并发 worker 不能重复 claim，崩溃后只有 lease 到期才可 reclaim；单 feed 失败隔离且 health counters 正确；所有 feed 失败不会破坏 published news；无 arbitrary URL fetch。

### Phase 5：Gemini Draft Generation

- [ ] 建 provider interface/fake provider。
- [ ] 建 versioned prompt 和 strict schema。
- [ ] 实现 candidate ID binding。
- [ ] 实现 batch limits/retry/idempotency。
- [ ] 实现 generation-batch fingerprint unique/CAS claim、lease reclaim 和 attempt terminal state。
- [ ] 建 event-match fixtures 并校验 same-event、different-event、跨日 update 与 ambiguous multi-target 行为。
- [ ] 在同一 finalization transaction 中建立 PENDING article graph、结束 candidates 并提交 generation batch success。
- [ ] 完成 malicious RSS/prompt-injection fixtures。
- [ ] Staging 验证真实 model output。

**Exit gate：** 模型不能注入来源；非法输出不产生半成品；batch crash/retry 不产生重复 draft；ambiguous duplicates 全部进入人工 resolution；AI 永远不能直接 publish。

### Phase 6：Indicator Integration

- [ ] 建 `NewsIndicatorChip`。
- [ ] 增加 concept label/value/confidence display。
- [ ] 实现 Overview/Regional query deep links。
- [ ] 添加 allowlist/data contract test。
- [ ] 更新文案，避免 “data proves news” 误导。

**Exit gate：** 每个允许 concept 有稳定 destination；未知/过期 concept 安全 fallback。

### Phase 7：Scheduler、Monitoring 与 Staging Sign-off

- [ ] 按部署决定实现平台 cron 或独立 GitHub trigger workflow。
- [ ] 接通已在 Phase 4 验证的 run lock、per-feed metrics 和 alerts。
- [ ] 配置 staging secrets 与 admin。
- [ ] 完成连续多日 staging runs。
- [ ] 完成管理员每日审核演练。
- [ ] 完成 security/copyright/source register review。
- [ ] 更新 README/runbook。

**Exit gate：** 至少 3 次连续 scheduled run 成功或合理地产生 0 drafts；失败隔离有效；审核 owner 接受操作流程。

### Phase 8：Production Release

- [ ] Migration backup/restore plan 已批准。
- [ ] Production domain/CSP/scheduler/secrets owner 已确认。
- [ ] `NEWS_DIGEST_ENABLED` 初始保持 false 完成部署。
- [ ] 先启用 collection/draft，不公开自动产生内容。
- [ ] Admin 审核第一批真实 drafts。
- [ ] 批准后验证 public API和 UI。
- [ ] 观察 metrics 后正式启用每日 schedule。

---

## 16. Definition of Done

- [ ] `/news` 不再读取 fabricated production mock data。
- [ ] Public API 永远只返回 `PUBLISHED`。
- [ ] RSS 来源全部来自已审核 registry。
- [ ] 不抓取 full article body，不绕过 paywall，不热链接 publisher image。
- [ ] 候选 URL、publisher 和 source count 由系统决定，AI 不能生成。
- [ ] AI 输出经过 strict schema 和 allowlist validation。
- [ ] 每篇 draft 至少有 source、territory、beat 和 indicator concept。
- [ ] 所有 AI 内容在公开前经过 ADMIN 审核。
- [ ] Single-source item 有清楚警告和额外批准确认。
- [ ] Approve/edit/reject/withdraw 有不可缺失的 audit trail。
- [ ] Pending duplicate match 会阻止 approve；dismiss/merge 解决所有 matches 后才能继续，且 audit 包含 match、article、target 和 correlation IDs。
- [ ] Merge 对 chosen/remaining matches、source/target articles 和迁移 links 的状态变化在同一 transaction 完成，失败时全部回滚。
- [ ] Merge 到已发布文章不能批量或隐式批准来源；所有迁移 links 保持 `PENDING`，之后必须逐条 approve/reject。批准前 public sources/sourceCount/story dates 不变，批准后同一 transaction 重算，且每条决定的 audit 包含 source-link ID。
- [ ] 普通用户和匿名用户不能访问 admin queue/API。
- [ ] Multi-source citation 和 AI disclosure 在详情页可见。
- [ ] Indicator chips 显示相关 Dashboard evidence，并可正确 deep-link。
- [ ] 现有 SDG chips 由 canonical indicator rows 派生，不能由 AI 自由生成或与指标 mapping 冲突。
- [ ] News artwork 来自本地 beat mapping 或安全无图 fallback，不依赖 remote `imageUrl`。
- [ ] Scheduled news failure 不阻断指标 pipeline 或删除 published news。
- [ ] Re-run 幂等，不重复建立同一 source/article draft。
- [ ] Candidate 与 generation-batch leases 支持安全 crash recovery、CAS ownership 和有限 attempts；并发 worker 不会重复处理。
- [ ] Per-feed attempts、连续失败和恢复 metrics 可由 persistence 与 tests 证明。
- [ ] 测试使用独立 PostgreSQL，不能 truncate 开发/生产 DB。
- [ ] Unit、integration、frontend、E2E 和 production build 全部通过。
- [ ] Source register、管理员 owner、secrets owner、retention 和 scheduler 已签核。
- [ ] README 和运维 runbook 反映真实部署方式。

---

## 17. 风险与控制

| 风险 | 影响 | 控制 |
|---|---|---|
| Google News RSS 变化或停止 | 采集覆盖下降 | Adapter abstraction；publisher RSS 优先；Phase 0 实测；source health alert |
| Publisher feed 内容/terms 变化 | 法律或内容风险 | Source register、terms note、快速 disable |
| Gemini quota/model 变化 | Draft 失败或成本变化 | Env-configured allowlist、quota check、retry、可停用、fake provider tests |
| AI hallucination | 错误摘要 | 不允许补充事实；candidate-ID binding；人工审核 |
| AI 编造 source | 信任破坏 | Schema 不接受 source/URL；后端从 candidates 绑定 |
| Prompt injection | 内容或系统行为偏离 | 无 tools；不可信输入隔离；strict schema/allowlist/plain text |
| 同一事件重复发布 | News feed 噪音 | URL hash、cluster idempotency、admin duplicate view |
| 多来源其实属于同一 publisher group | 虚高 corroboration | Source registry 增加 ownership group；count distinct independent group，而不只 domain |
| Admin backlog | 新闻过时 | Pending age metrics、review SLA、过期草稿 reject/expire policy |
| 错误管理员操作 | 错误内容公开 | Preview、version conflict、audit、withdraw |
| 远程图片失效/CSP block | Broken UI | v1 本地 category art/no image |
| Integration tests 清错 DB | 数据损失 | Phase 1 blocking test DB guard |
| News job 与 data refresh 耦合 | 一项失败影响全站 | 独立 job/workflow、独立 status/alerts |
| “数据验证新闻”文案过度承诺 | 学术/信誉风险 | 使用 related evidence/context；明确非 fact check |

---

## 18. 实施前必须由负责人确认的决定

以下决定无法由代码替代，未确认前不得生产发布：

1. 五类 beats 是否最终批准。
2. 第一批 source whitelist 和 publisher ownership groups。
3. 谁拥有 ADMIN 角色、谁负责每日审核、审核 SLA 多久。
4. Single-source story 是否允许发布；本计划默认允许但要求额外确认。
5. Rejected candidates 和 RSS summaries 的 retention period。
6. Gemini 选用模型、tier、data handling 和费用 owner。
7. Production scheduler 使用平台 cron 还是 GitHub trigger。
8. Production secrets owner、rotation 和撤权流程。
9. 版权/attribution 文案是否经过 supervisor 或项目负责人批准。
10. Weather strip 延后到哪个阶段；默认不属于 v1。

---

## 19. 本计划反向审查结果

本计划完成后已按下列方向进行一致性检查：

| 检查方向 | 结果 |
|---|---|
| 是否建立在当前存在的 News UI 上 | 是；保留现有 page/components，替换 service/data shape |
| 是否使用当前真实 backend | 是；Express/TypeScript/Prisma/PostgreSQL |
| 是否误用指标 SQLite | 否；News 只进入 application PostgreSQL |
| 是否依赖不存在的 `ReportVerification.jsx` | 否；新建独立 admin queue |
| 是否依赖不存在的 `ADDITIONAL_REQUIREMENTS.md` | 否；列为 Phase 0 requirements gap |
| 是否使用当前正确 indicator vocabulary | 是；`deforestation` 等现有 concepts |
| 是否允许 Gemini 控制来源 | 否；candidate-ID binding + server-side source attachment |
| 是否可能未审核就公开 | 按 contract 不允许；published transition 只在 admin transaction |
| 是否考虑当前 Auth/Admin 能力差距 | 是；新增 role middleware 和 AdminOnlyRoute |
| 是否考虑测试清库风险 | 是；列为 Phase 1 blocking gate |
| 是否把外部服务假设当事实 | 否；RSS/model/quota 都有 Phase 0 stop gate |
| 是否与指标 refresh 隔离 | 是；独立 CLI/scheduler/run status |
| 是否处理生产 CSP/远程图片 | 是；v1 不热链接 publisher images |
| 是否有可验证 Definition of Done | 是；每项均可由测试、配置或签核证明 |

### 19.1 正确性声明

本计划已经与 2026-07-13 当前工作区结构进行对照，可以作为实施基线。任何依赖外部 RSS、Gemini quota、部署平台、版权条款或人工审核 owner 的内容，都没有被假定为永久成立，而是被转换为 Phase 0 或 Production 的明确 stop gate。

因此，本计划能保证的是：

- 架构位置与当前仓库一致；
- 实施依赖、状态流、安全边界和验收方式明确；
- 未验证的外部条件不会被静默带入生产；
- 每个阶段都有可检查的 exit gate。

没有任何实施计划能够诚实保证未来外部服务“100% 永远不变化”。本计划用验证门槛、adapter boundary、failure isolation 和人工发布 gate，把这类不可控变化限制为可发现、可停止、不会错误公开内容的失败。

---

## 20. 实施时使用的外部技术依据

以下链接属于动态外部资料，实施 Phase 0 和每次 provider 升级时必须重新核对，不能只依赖本计划记录的日期：

- Gemini API billing 与 tier：<https://ai.google.dev/gemini-api/docs/billing>
- Gemini API pricing：<https://ai.google.dev/gemini-api/docs/pricing>
- Gemini API rate limits：<https://ai.google.dev/gemini-api/docs/rate-limits>
- Gemini structured outputs：<https://ai.google.dev/gemini-api/docs/structured-output>
- Gemini safety settings：<https://ai.google.dev/gemini-api/docs/safety-settings>
- Gemini API terms：<https://ai.google.dev/gemini-api/terms>

Gemini structured output 支持 JSON Schema，并可与 JavaScript/Zod workflow 配合，但官方只支持 JSON Schema 的子集，且 2026 年 API 仍有 breaking changes。因此 provider adapter、prompt version 和二次 Zod validation 都是必要边界，不能把 provider-specific response shape 扩散到 News business service。
