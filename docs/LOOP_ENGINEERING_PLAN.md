# Loop Engineering Plan — Borneo Tracker

> **状态**：v2 — **Phase 0 已拍板并开工**（2026-07-28，分支 `feature/loop-phase0`）。Phase 1 决策仍未定。
> **日期**：2026-07-24 起草 · 2026-07-28 更新
> **依据**：2026-07-24 的 5-agent 全系统审计（automation / frontend / data / roadmap / AI-backend）+ 2026-07-28 的线上实测。
>
> **2026-07-28 的大事：产品上线了**（DirectAdmin，`https://borneotracker.rentsmartprop.com.my/`）。
> 这把 deployment 从"并行轨"拉进了主线，并让 Phase 0 的紧迫性上升 —— 详见 §3.1。

---

## 0. 这份文档要干三件事

1. **对齐理解** —— 确认"loop engineering 在本项目里到底指什么"我们俩想的是同一件事。
2. **锁定方向** —— Phase 0 → Impact Simulator，以及各自的边界。
3. **拍板** —— 第 5 节把**所有需要你拍板的决策点**列成清单，逐条勾。

---

## 1. 我们的共识（先对齐理解）

### 1.1 loop engineering 在本项目里的定义
把系统当**反馈回路**来设计：`感知(sensor) → 决策(decide) → 行动(act) → 闭环回传(close)`，而不是"输入→处理→输出，结束"的一次性管线。
> 说明：这**不是**一个有权威定义的成熟学科术语，别被词唬住。内核就这么朴素。

### 1.2 关键判断（Henry 已认可）
- 系统**不缺 loop，缺"闭环"**。
- 现有的两条 loop 是**"开环在骗人"**（跑了但没人验证输出、坏了不告警、把过期数据当新鲜展示）。
- 这**直接伤 E（诚实/出处）这条护城河**——而 E 是本产品的核心价值。
- 所以第 0 步不是加新 loop，是**把现有的环闭上**。

### 1.3 时间线（已纠正的因果关系）
| 时段 | 内容 | 前提 |
|---|---|---|
| 🟢 **现在** = loop engineering 本身 | Phase 0 闭环止血 + Phase 1 Impact Simulator | **无**。不等 chatbot / blockchain / deployment |
| 🟡 **以后** | 用户行为遥测 loop（Henry 的想法：追踪 chatbot 断点、dead-click 回传后台） | 需先**上线**（有真实用户）+ **chatbot 真的活着** |
| ⚪ **地平线** | blockchain（B） | off-path，0%，**永不假装做了**，不是任何东西的前提 |
| 🔵 ~~并行轨~~ → **🟢 主线（2026-07-28 改）** | deployment（生产部署） | ~~独立发布轨~~ **已上线** → 部署链条现在是 Phase 0 的一部分（0.6） |

**结论**：不存在"先做完 chatbot/blockchain/deployment 才回来做 loop engineering"这回事。

**2026-07-28 补充（Henry 问"先做 loop engineering 还是先谈 blockchain"）：**
顺序是 **loop engineering → 上线验证 → 再谈 B**。理由不是排期偏好，是价值链本身：
`测量(D/A) → 可信(E→B) → 通证化(B) → 回馈社区(B/D)`。区块链保证的是**记录**不可篡改，
从不保证**输入**为真（oracle problem）——在一条"会撒谎的开环"上锚定，只是把错误变成不可篡改的错误。
**Phase 0 就是 B 将来要用的 oracle 层。** 但 B 的**接缝**现在就要留（见 D13），否则将来要拆数据层重来。

### 1.4 指导原则（Henry 2026-07-24 拍板）
**以长远/耐用设计为主，good coding behavior，不为了做而做。** 避免"以后回头返工"的正确方法 = 现在就把接口/骨架设计对，让后续增量能插进去而不推翻。守则：
1. 接口/seam 一次设计对：LLM 对话前端、数据改 live 源，都**现在就留好插槽**，以后接上不返工。
2. 朝一个**北极星**增量前进，每步都往上叠，不丢弃。
3. **单一真源 > 重复逻辑**。
4. 也不过度建造：能延后的用干净 seam 延后，不一次全堆。

### 1.5 架构北极星（所有增量都朝它靠）
1. **评分模型单一真源**：`compute_resilience.py` 导出模型参数 → 前端镜像 → 金标测试。Impact Simulator 直接落在这上面。
2. **数据：从"提交进 git 的静态 JSON"→ 可订阅的 live 源**。"必须 pull 才更新 + 漏提交 districts"这类 bug，根因就是 build-time-static 架构。长期把 dashboard 数据搬到可 fetch/订阅的源（Supabase）。**Phase 0 只是临时补丁，不是终点。**
3. **确定性内核 + 可插拔智能层**：Impact Simulator 先做确定性 `recompute(inputs)` 内核；LLM 对话层以后作为**调用方**接上，不改内核。

---

## 2. 什么是 Impact Simulator（Phase 1 主角）

**它是仪表盘里的 "What-If 沙盘"。**

- **描述性 → 处方性**：现在仪表盘只告诉你现状；Simulator 让你问"**如果**把某指标改成 X，True Wealth 会怎么动"。
- **例子**：Brunei 指数 79、最弱支柱 Food 仅 8.1（书里"钱多、粮食脆弱"的论点）。拖动"粮食自给率 8%→40%" → 系统**确定性重算** → Food 支柱、总指数、strict 几何指数、最弱支柱的前后对比。
- **ABCDE 定位**：这是 **A**（AI/自主，descriptive→prescriptive）的第一步落地；买单方 = 政府/规划者（发展规划与审批）。
- **E-safe 的关键**：它是**机械重算**不是预测。只说"输入=X → 公式=Y"，绝不声称成本/年限/因果。全程标"Illustrative / 情景推演，非预测"。
- **现状**：~10%，只有文档没代码。是从 0 建的一条 `measure→act→re-measure` 闭环。

---

## 3. 审计结论（这次调查的地基，供拍板参考）

**现有 loop（2 条，都在服务端 cron，都开环）**
| Loop | 触发 | 病灶 |
|---|---|---|
| `refresh-data.yml` → `run_pipeline.py` | 每天 21:00 UTC | **实际在跑**（origin/master 数据新鲜到 2026-07-23，07-21/22/23 均有 bot 提交）；之前误判的"停摆"是本地没 `git pull`、读到旧文件的错觉。真·问题：`districts.json` 不在提交清单 → **区级数据仍冻结在 2026-07-10**；CI 少传 `FIRMS_MAP_KEY`/`GDL_API_TOKEN` |
| `news.yml` → Gemini digest | 每天 22:00 UTC | 发布全手动；`source_count` 硬编码=1（多源佐证没真做）；仓库 secrets 无法从本地核实 |

**前端**：零 loop，5 个 hook（`src/data/useIndicators.js`）fetch-once-static；`generatedAt`/`last_updated` 在数据里但 UI 从不显示；Overview 有假"Live"标签。

**运营欠债**：`profiles`/RLS 只在 Supabase 控制台、无版本化脚本（重建即丢）；`supabase/schema.sql` 已漂移（仍是"任何登录=管理员"）；**整个产品无生产部署**。

**AI 现状**：唯一真 AI = Gemini（news）。AR-2 chatbot = 装饰按钮（真身在未合并 `aichatbot` 分支）；Impact Simulator 文档级 ~10%；AR-1 AI 摄取未建（已解锁）。

### 3.1 上线后的线上实测（2026-07-28，`curl -k` 直接抓生产）

| 项目 | 线上 | 仓库 | 差距 |
|---|---|---|---|
| `indicators.json` | **2026-07-23** | 2026-07-27 | 落后 4 天，**每天再多 1 天** |
| `resilience.json` | **2026-07-23** | 2026-07-27 | 同上 |
| `districts.json` | **2026-07-10** | 2026-07-10 | 落后 18 天（连仓库都没更新） |

- 站点本体正常：HTTP 200，SPA 深链接 `/news`、`/reports`、`/admin/news` 全部 200（`public/.htaccess` 生效）。
- **Supabase 侧是活的**（新闻、登录、社区、admin 实时生效）；**dashboard 数据是死的**。
- 断点定位：`refresh-data.yml` 每天把新数据 push 回**仓库**，但 `.github/workflows/` 下**没有任何 deploy workflow** ——
  没人把文件送去 DirectAdmin。这正是 `docs/DIRECTADMIN_DASHBOARD_DATA_UPDATE_OPTIONS.md` 写的 "Current Deployment Gap"。
- 🔴 **TLS 证书不覆盖该子域名**（证书只含 `rentsmartprop.com.my` / `apexseo` / `hybrid` / `invoice` / `mail` / `packaging` / `webmail`，
  **没有 `borneotracker`**）→ **每个访客先撞浏览器安全警告**。这是目前对用户伤害最大的一条，且纯 owner 侧操作。
- `index.html` 的 `<title>` 还是 Vite 默认的 `borneo-tracker-js`（已上线，分享链接/书签/搜索结果都在用）。

> **性质变化**：假 "Live" 标签在上线前只是内部不诚实；**上线后它是对公众撒谎**。E 的信誉风险已经对外。

---

## 4. 计划

### Phase 0 — 闭环止血（护 E，不改评分口径，只让现有 loop 别再骗人）

| # | 事项 | 谁做 | 备注 |
|---|---|---|---|
| 0.1 | ~~查清日更为什么停~~ **已澄清：loop 在跑，本地 `git pull` 即可** | Henry | origin 数据新鲜到 07-23；本地落后才显旧。无需排障 |
| 0.2 | `districts.json` 进日更提交 + 行数/解析校验 | Claude（代码） | 改 `refresh-data.yml` 的 `git add` 清单 |
| 0.3 | 补 CI secrets：`FIRMS_MAP_KEY`、`GDL_API_TOKEN`（+ 提交 `gdl_msch_cache.csv`）；确认 GEMINI/SUPABASE 在不在 | **Owner/Henry** | 我给改法，改不了远端 secrets |
| 0.4 | UI 显示"数据截至 …/每日快照" + 干掉假"Live" | Claude（代码） | `useIndicators.js` 暴露 `generatedAt`；新 `DataFreshness` 组件（复用 `ProvenanceChip` 风格）；`liveLayer` → `mapLayer`（en+ms）；AQI 保留 Live |
| 0.5 | `profiles`/RLS 写成版本化迁移 + 修 `schema.sql` 漂移 | Claude（代码，需你提供线上策略） | 见 D4。**已部分完成**：`supabase/auth_schema.sql` 于 2026-07-28 从线上导出 |
| **0.6** | **把日更接到 DirectAdmin**（新 `deploy.yml`）：pipeline → 校验 → build → SFTP 上传 → **部署后 smoke test** | Claude（代码）+ **Henry 给 SFTP secrets** | 2026-07-28 新增。**smoke test 才是"闭"**：验首页 200、`/data/manifest.json` 哈希与本次构建一致、`generatedAt` 符合预期、SPA 深链接 200 |
| **0.7** | **SSL 证书覆盖子域名** | **Owner/Henry**（DirectAdmin 面板） | 2026-07-28 新增，**当前最急**：所有访客都被浏览器拦 |
| **0.8** | `index.html` 标题 + meta description | Claude（代码） | 已 live，标题还是 `borneo-tracker-js` |

### Phase 1 — Impact Simulator（旗舰新 loop）

**内核（E 优先，防"模拟器算的和真指数不一样"这种灾难）**
1. **单一真源**：让 `compute_resilience.py` 把评分模型参数（`BOUNDS`、指标→支柱映射、权重、公式）**导出进 JSON**。
2. 前端 `recomputeResilience(inputs, model)` **镜像** Python 算法，但参数只有一份（来自 Python）。
3. **金标 Vitest**：baseline 输入喂进 JS，**断言复现已提交的 `resilience.json` 指数**。一旦漂移测试就红。这是让模拟器永不撒谎的闸门。

**交互**
- 新路由 `/simulator`。
- 选领地 → 拖动该领地**最弱支柱**的关键输入 → 实时重算 → **前后对比** Hexagon 雷达 + Resilience 仪表 + weakest-link 条（**复用现成组件** `HexRadar`/`RagGauge`/`WeakestLinkBars`）。
- 输入夹在合理区间；全程"Illustrative"标注。

**v1 明确不做**：LLM 对话式 What-If（延后到 Phase 1.5，先把零幻觉的确定性内核做出来）。

### Phase 2 — 用户行为遥测 loop（延后）
Henry 的想法（chatbot 断点、dead-click → 回传后台指导改进）。**前提**：上线 + chatbot 就绪。工具：PostHog（待确认组织里"Production Web"项目是否指向本站）。

### 地平线 — blockchain（B）
off-path，永不假装。不排期。

### 并行轨 — deployment
独立发布轨，等域名就绪再做；不挡 Phase 0/1。

---

## 5. 需要你拍板的决策点（逐条勾 ✅/✏️）

> 每条给了我的**推荐**。你只需确认或改。

**流程**
- **D0** — 本 plan 放 `docs/LOOP_ENGINEERING_PLAN.md`，拍板前不写代码。〔推荐：同意〕→ 你的决定：______

**Phase 0**
- **D1** — Phase 0 五项是否全做。〔推荐：全做〕→ ______
- **D2** — 假"Live"标签怎么改：全部改"每日快照"，还是只给真·近实时的（AQI）保留"Live"、其余标快照。〔推荐：默认"每日快照"；AQI 若确证近实时再单独标〕→ ______
- **D3** — `districts.json` 进日更提交；边界 `geojson` 是否也进。〔推荐：只提交 districts.json，geojson 当静态资产〕→ ______
- **D4** — RLS/schema 版本化放哪 + **需要你从 Supabase 控制台贴出线上现行策略**（否则我只能按 plan 写的 admin-only 重建，可能与线上不符）。〔推荐：新建 `supabase/migrations/` + 你提供线上策略〕→ ______
- **D5**（owner-side）— 谁查"日更为什么停"（需 angelyong 仓库权限）+ 谁补 CI secrets。〔推荐：你来做/给我访问；我负责代码侧〕→ ______

**Phase 1 — Impact Simulator**
- **D6** — v1 只做确定性滑块版、LLM 对话延后。〔推荐：是〕→ ______
- **D7** — v1 可调指标范围：先聚焦各领地"最弱支柱"的高杠杆输入，还是一次开放全部支柱。〔推荐：先聚焦最弱支柱 + 少量高杠杆，之后再扩〕→ ______
- **D8** — 评分"单一真源"方案（Python 导出模型参数 → 前端镜像 + 金标测试）。这会小改 Python 管线。〔推荐：采用〕→ ______
- **D9** — 挂载点：新 `/simulator`（推荐）/ 复用 `/submission` 占位 / Overview 加面板。→ ______
- **D10** — 输入夹合理区间 + 全程"Illustrative 情景推演，非预测"标注。〔推荐：采用〕→ ______

**对齐（非立即执行，只确认理解一致）**
- **D11** — 遥测 loop 确认延到"上线 + chatbot 就绪"之后；工具 PostHog（待确认项目归属）。〔推荐：确认延后〕→ ______
- **D12** — blockchain 确认为 off-path 地平线、永不假装。〔推荐：确认〕→ ______

**2026-07-28 新增**
- **D13 — B 的接缝，现在就留**〔Henry 已同意，见 §8〕。三条，都在 Phase 0 里顺手做，不额外开工：
  1. 每次 refresh 对三份 JSON 算 **SHA-256**，写进 `public/data/manifest.json`（哈希不嵌进被它描述的文件里，避免自指）。
  2. **追加**一行到 `public/data/provenance.jsonl`（append-only：UTC 时间 / 文件 / 哈希 / `generatedAt` / run id）。只增不改。
  3. 稳定 ID 规范 + 不硬编中心化所有权，为 self-sovereign（数据归社区、收益回社区）留位。
  **它现在就有回报，不是纯为将来**：0.6 的 smoke test 可以直接比对哈希 —— "线上这份到底是不是仓库那份"，比对日期更硬。
  将来上链锚定的对象就是这条 append-only 日志。
- **D14 — SSL 证书**（0.7）：owner 侧，无技术选项可选，只是必须做。

---

## 6. 明确不做的（划清边界，防止范围膨胀）

- v1 **不做** LLM 对话前端。
- **不做** blockchain。
- **不在**产品上线前做遥测 loop。
- Phase 0 **不改**评分口径本身（只暴露新鲜度、闭上骗人的环）。
- 拍板前**不写任何代码**。

---

## 7. 拍板后我的下一步（预告）

1. 建 TodoWrite 跟踪。
2. 从 **Phase 0 的 0.4（新鲜度徽标 + 去假 Live）** 开刀——最小、最护 E、立刻见效，作为"闭环思维"的样板。
3. 并进 Phase 1 内核（先做 D8 的模型单一真源 + 金标测试骨架）。
4. Owner-side 项（0.3 的 secrets / 0.5 的线上策略）等你提供输入。

---

## 8. 决策记录（Decisions log）

- **2026-07-24 · D7 = 以长远为主**：Impact Simulator 开放全部六支柱输入 + 可扩展架构，不做最小版；靠 §1.4/§1.5 的原则保证不返工。
- **2026-07-24 · D5 = 澄清**：日更 loop 实际在跑（fresh 到 07-23），非停摆；Henry 本地 `git pull` 即回新。仍需补 CI secrets `FIRMS_MAP_KEY`/`GDL_API_TOKEN`（Claude 写进 workflow env，Henry 在 repo 加 secret 值）。`districts.json` 冻结 07-10 属实 → Phase 0.2 修。
- **2026-07-24 · D4 = 方案**：首选 Supabase CLI `db pull` 导出 profiles/RLS/触发器为 migration（可复现）；`auth.users` 触发器用 SQL introspection 兜底。等 Henry 执行并回传结果。
- **2026-07-28 · 上线**：产品已部署到 DirectAdmin。线上实测见 §3.1：dashboard 数据冻结在 07-23、区级冻结在 07-10、
  TLS 证书不覆盖子域名。deployment 因此从"并行轨"升为主线（新增 0.6/0.7）。
- **2026-07-28 · 顺序确认**：**先做 loop engineering，再回来谈 blockchain**（理由见 §1.3 补充）。B 不排期，但接缝现在留。
- **2026-07-28 · D13 = 采纳**：哈希 + append-only 溯源日志 + 稳定 ID，随 Phase 0 一起做。
- **2026-07-28 · Phase 0 拍板开工**：Henry 批准按清单执行，开分支 `feature/loop-phase0`，并要求多 subagent 并行、不漏细节。
  执行范围 = **0.2 / 0.4 / 0.6 / 0.8 + D13**；owner 侧待办 = **0.7 SSL** + repo secrets（`FIRMS_MAP_KEY`、`GDL_API_TOKEN`、`SFTP_*`）。
- **仍待确认**：**D6 / D7 / D8 / D9 / D10**（Phase 1 Impact Simulator，尚未开工）· D11 / D12（对齐性确认）。
