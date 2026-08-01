# Borneo Tracker 数据自动化审计与可行解决方案

日期：2026-07-28
范围：Dashboard ESG、SDG、True Wealth Hexagon、Resilience Index、GitHub Actions 与 DirectAdmin Production

> 本文件不包含任何 API key、密码或 Supabase service role key。

## 1. 结论先说

Borneo Tracker 目前不是“全部资料都由 API 自动更新”，但也不是“CSV 都是死数据”。

当前实际情况分成三个层次：

1. **资料来源层**：有 API、官方 CSV/XML、缓存、人工报告值和代码内写死值。
2. **GitHub 数据层**：GitHub Actions 会运行 pipeline 并重新生成 CSV/JSON。
3. **Production 层**：DirectAdmin 目前是人工上传，因此 GitHub 更新后，Production 不会自动收到新 JSON。

因此，即使 API 本身正常，Production 仍可能继续显示旧数据。

### 核心数字

- Dashboard 当前有 **75 个 canonical rows**。
- 其中约 **53/75（70.7%）**来自自动 pipeline 或自动 aggregate。
- 其余 **22/75（29.3%）**依赖：
  - `manual_overrides.csv`：11 rows
  - 写死的 Internet use：4 rows
  - 使用写死人口计算的 paddy per capita：4 rows
  - `SOURCED_ROWS` 写死值：3 rows

但是 Resilience Index 对静态资料的依赖更严重：

- 当前四个地区共使用 **25 个 scoring observations**。
- 只有约 **11/25** 是完整自动取得。
- 约 **14/25** 仍依赖人工值、代码写死值或写死人口。

这代表整体 Dashboard 看起来已有约 71% 自动化，但真正决定 Resilience Index 的数据中，超过一半仍带有静态依赖。

## 2. “CSV 是不是死数据”的正确判断

| 文件 | 目前性质 | 是否自动更新 | 真正问题 |
|---|---|---:|---|
| `borneo_tracker_poc.csv` | API/feeds 的标准化输出 | 是 | Production 未自动部署 |
| `borneo_tracker_history.csv` | 历史数据 pipeline 输出 | 是 | 失败时会保留旧文件，需要 freshness warning |
| `gdl_msch_cache.csv` | GDL API cache | 有条件 | Workflow 未传入 `GDL_API_TOKEN`，而且未 commit cache |
| `manual_overrides.csv` | 人工审核后的报告值 | 否 | 需要自动发现新版与审核流程 |
| `public/data/indicators.json` | Dashboard build artifact | 是 | DirectAdmin 未自动同步 |
| `public/data/resilience.json` | Resilience build artifact | 是 | 输入数据仍有静态依赖，DirectAdmin 未自动同步 |
| `public/data/districts.json` | District pipeline artifact | 是 | Workflow 没有 `git add`，更新会被丢掉 |

所以，**文件格式不是问题**。CSV 完全可以是自动下载与自动生成的。真正的问题是：

- 谁产生它；
- 多久产生一次；
- 失败时是否偷偷沿用旧值；
- 是否经过验证；
- 是否进入 Dashboard；
- 是否部署到 Production。

## 3. 当前 API / feed 的真实状态

### 3.1 Dashboard 数据来源

| 来源 | 连接状态 | 是否进入 Dashboard | 自动化程度 | 主要问题 |
|---|---|---:|---|---|
| data.gov.my / OpenDOSM | 可用 | 是 | 自动 | 某些 dataset 本身只更新到 2022；现有代码没有利用所有可用字段 |
| World Bank Indicators API | 可用 | 是 | 自动 | 国家级数据，不适合作为 Sabah/Sarawak 的 state value；部分指标年份很旧 |
| BPS WebAPI | 可用 | 是 | 自动 | 每个 province 的 variable coverage 不一致 |
| Global Forest Watch | 可用 | 是 | 自动 | 需要有效 GitHub Secret |
| GFW VIIRS alerts | 可用 | 是 | 自动 | Kalimantan fire roll-up 当前只有 4/5 provinces |
| WAQI | 部分可用 | 是 | 自动 | 城市站点可能临时失败；Kalimantan coverage 随可用城市变化 |
| UNESCO XML | 可用 | 是 | 自动 | Sabah/Sarawak/Kalimantan 是用坐标 bounding box 派生 |
| Global Data Lab | API 代码可用，但 Actions 未启用 | 目前由写死值补位 | 条件自动 | Workflow 缺少 `GDL_API_TOKEN`；cache 也未 commit |
| NASA FIRMS | API/CSV fallback 可用但不稳定 | **没有进入四地区 Dashboard** | 部分自动 | 只生成 `Borneo (all)` row，Dashboard filter 会排除 |
| UN SDG API | 部分可用 | 有限 | 自动 | Brunei 查询无数据；不能当成四地区完整来源 |

### 3.2 非 ESG 数据服务

| 服务 | 用途 | 状态 | 是否属于 Resilience 数据 |
|---|---|---|---:|
| Supabase | Auth、profiles、news、admin | 已配置/使用中 | 否 |
| Gemini | News rewriting/processing | 使用中 | 否 |
| RSS feeds | News collection | 可用但可能临时失败 | 否 |
| OpenStreetMap / map tiles | 地图底图 | 使用中 | 否 |

Supabase 和 Gemini 正常，并不代表 ESG/SDG 数据已经自动化；它们是另一条产品功能链。

## 4. 当前真正的人工与写死资料

### 4.1 `manual_overrides.csv`：11 rows

1. Sabah life expectancy
2. Sarawak life expectancy
3. Sarawak electrification ratio
4. Brunei paddy production
5. Sabah tourist arrivals
6. Sarawak tourist arrivals
7. Brunei tourist arrivals
8. Sabah national parks count
9. Sarawak national parks count
10. Brunei national parks count
11. Kalimantan national parks count

其中直接影响目前 Resilience Index 的人工 rows 是：

- Sabah life expectancy
- Sarawak life expectancy
- Sarawak electrification ratio
- Brunei paddy production

Tourist arrivals 和 national parks 目前会显示在 Dashboard，但现有 scorer 的 Entertainment 使用的是 Internet use，因此它们目前不直接改变 Resilience Index。

### 4.2 `data_model.py` 中写死的资料

#### A. Population

Population 用于把 paddy tonnes 转成 kg/capita，所以会直接影响 Food pillar。

审计前写死值：

- Sabah：3,751,000
- Sarawak：2,907,500
- Brunei：455,500
- Kalimantan：17,259,155

2026-08-01 实测与修复结果：

- DOSM 官方 `population_state.csv` 最新 2026 Sabah population 为 **3,767,000**。
- DOSM 官方 `population_state.csv` 最新 2026 Sarawak population 为 **2,539,800**。
- 现有 Sarawak 2,907,500 与最新官方数据差距明显。
- Paddy per capita 延续使用最新官方人口作为 current-resident 分母，避免静默混用 DOSM 2020 人口普查前后的重基系列；同时在 provenance 分别标出生产年和人口年。最新 2026 人口：Sabah **3,767,000**、Sarawak **2,539,800**。
- 修正后的 paddy per capita：Sabah **28.6 kg/capita**、Sarawak **58.0 kg/capita**。
- Kalimantan 2025 五省 BPS 人口合计 **17,951,300**，已作为 2025 paddy 的同年分母。

这不是单纯的 freshness 问题，而是会实质改变 Food pillar。

#### B. Internet use

审计前四个地区由 `INTERNET_USE` 常量写死；现在 Brunei 已改由 World Bank API 自动获取：

- Sabah：Malaysia national 98.0% proxy
- Sarawak：Malaysia national 98.0% proxy
- Brunei：World Bank `IT.NET.USER.ZS`，最新实测 2024 为 **96.2983%**
- Kalimantan：76.1%

问题：

- Sabah/Sarawak 使用全国 proxy，不是真正 state value。
- Brunei World Bank `IT.NET.USER.ZS` 可直接自动获取，不需要继续写死。
- Kalimantan 需要从 BPS 的一致 province-level table 汇总，不应只保留人工抄录值。

#### C. `SOURCED_ROWS`

- Sabah mean years schooling 8.7
- Sarawak mean years schooling 8.7
- Sabah electricity access 87.6%

Sabah electricity 已改由 data.gov.my 自动产生；GDL mean years schooling 在没有 token 时仍使用已审查的 fallback，后续应由 cache/API 接替。

## 5. 已确认可以直接自动化的修复

### 5.1 Sabah / Sarawak population

直接使用 DOSM 官方完整 CSV：

`https://storage.dosm.gov.my/population/population_state.csv`

选择：

- `state = Sabah / Sarawak`
- overall age
- both sexes
- overall ethnicity
- latest date

这条路线已经实际下载和核对过，可行。

### 5.2 Sabah / Sarawak electricity access

data.gov.my 已有 `hh_access_amenities`：

- Sabah 2022 electricity：87.6%
- Sarawak 2022 electricity：90.0%

现有代码拉的是 `electricity_access` household count，却另外写死 Sabah percentage，并人工保存 Sarawak 99.4%。

可行修复：

- 从 `hh_access_amenities` 读取 `district = All Districts` 的 `electricity` 字段。
- 自动生成 Sabah 与 Sarawak comparable percentage。
- 如果产品坚持使用 Sarawak Energy 的 2023 domestic electrification 99.4%，则必须把它视为不同定义，并保留人工审核，不能与 HIES household survey 90.0% 无说明地互换。

### 5.3 Brunei population 与 Internet use

可直接加入 World Bank API：

- `SP.POP.TOTL`
- `IT.NET.USER.ZS`

World Bank API 是 keyless，现有 `pull_worldbank()` 已经在使用相同 API，只需要新增两个 indicator codes。

注意：

- Brunei DEPS 是更接近本地官方的一手来源。
- World Bank 可以作为自动 fallback。
- 当 DEPS 与 World Bank 数值不同，不能静默覆盖；应显示 source 与 year，并触发 difference warning。

### 5.4 GDL mean years schooling

可行修复：

1. GitHub Actions env 加入 `GDL_API_TOKEN: ${{ secrets.GDL_API_TOKEN }}`。
2. commit step 加入 `gdl_msch_cache.csv`。
3. 修改 `pull_gdl()`：先尝试读取 cache；只有 cache 到期需要 refresh 时，才要求 token。
4. 当 GDL row 成功时，不再添加相同 key 的 `SOURCED_ROWS`，避免重复来源。

### 5.5 District data

将以下文件加入 workflow commit：

`public/data/districts.json`

目前 pipeline 会生成它，但 workflow 没有 stage 它，所以生成的新 district data 不会进入 GitHub。

## 6. 不能直接粗暴 API 化的资料

### 6.1 Sabah / Sarawak life expectancy

数据来自 DOSM Abridged Life Tables release。若没有稳定的 machine-readable state dataset，应采用：

1. 定期检查官方 release page 或文件列表。
2. 发现新 PDF/Excel 后下载并保存 source hash。
3. 自动抽取 Sabah/Sarawak 候选值、年份、table/page。
4. PM 审核。
5. 审核通过后才更新 `manual_overrides.csv` 或 approved observations table。

AI 可以帮助抽取候选值，但不能直接批准或凭空补数。

### 6.2 Sabah / Sarawak tourism

data.gov.my 有 `arrivals_soe`，但它代表 **state of entry**，官方也明确说明不应把入境州推断成游客最终目的地。

所以不能用 Sabah 入境点人数直接替换 Sabah tourist arrivals，也不能用 Sarawak 入境点人数直接替换 Sarawak tourist arrivals。

正确路线：

- Sabah Tourism Board / state official annual report；
- Sarawak Ministry of Tourism official statistics；
- 自动发现新版 PDF/网页；
- 抽取候选值；
- PM 审核后发布。

### 6.3 Brunei tourism

Brunei Tourism Department 的官网已有 annual report 与 2025 页面统计，可建立页面/PDF watcher。

它适合“自动发现 + 自动抽取 + 人工批准”，不建议未经审核直接覆盖 Production。

### 6.4 Brunei paddy

优先顺序：

1. Brunei Department of Agriculture & Agrifood official Excel/report；
2. FAOSTAT official bulk download/API；
3. 如果接口不稳定，保留 last-good cache，并建立新版报告 watcher；
4. PM 审核后发布。

不能因为 FAOSTAT 某次 403/521 或 timeout 就把 0 当作 paddy production。

### 6.5 National parks

当前四地区的 “national park count” 定义不一致：

- Sabah Parks 管理的 parks
- Sarawak 大量不同规模 parks
- Brunei 1 个 national park
- Kalimantan federal taman nasional

数量不能公平比较。

建议：

- 不要用 count 做地区排名或 Resilience score。
- 更好的指标是 terrestrial protected/conserved area coverage percentage。
- 可申请 Protected Planet API v4 token，按统一定义与空间边界计算 coverage。
- 若暂时不做空间处理，继续显示 count，但必须标记 “not comparable”，且不进入 score。

## 7. Kalimantan 必须修的 coverage 问题

Kalimantan 是五个 provinces 的 aggregate。自动 API 成功不等于数据完整。

当前主要风险：

- Electrification ratio 只有 **1/5 provinces**，却被当成 Kalimantan 分数。
- Fire alerts 当前只有 **4/5 provinces**。
- 某些 BPS 指标是 unweighted mean；若各 province 人口差异大，会偏离真正 territory result。

必须建立以下规则：

1. `coverage_count` 与 `coverage_total` 跟每个 aggregate 一起输出。
2. 5/5 才可标记为 complete。
3. 4/5 可显示但降 confidence，并显示 “partial coverage”。
4. 1/5 不应继续当作 Kalimantan score；应标为 unscored 或使用一致的 BPS national by-province table。
5. Percentage 指标优先做 population-weighted mean，不是简单平均。

## 8. 建议采用的两条数据路线

### Lane A：全自动来源

适用：

- API
- 官方 CSV
- 官方 XML
- 稳定 bulk download

流程：

`Download -> Save raw/cache -> Normalize -> Validate -> Generate JSON -> Deploy`

验证项目：

- HTTP success 不等于数据 success；
- row count；
- territory/province coverage；
- year 是否倒退；
- unit 是否变化；
- null/zero 异常；
- 与上一版差异是否过大；
- duplicate canonical key；
- source 与 data level 是否完整。

### Lane B：官方报告辅助录入

适用：

- PDF
- Excel report
- 政府网页 summary
- 没有稳定 API 的 annual release

流程：

`Watch official source -> Detect new file/hash -> Extract candidate -> Human review -> Approve -> Publish`

候选记录至少包含：

- territory
- indicator
- year
- value
- unit
- source URL
- document title
- table/page/quote
- retrieved date
- file hash
- extraction confidence
- reviewer
- approved timestamp

## 9. 最适合当前大学项目的审核方案

### 推荐：GitHub Pull Request review

不需要马上开发新的 Supabase admin module。

1. Scheduled workflow 检查官方 PDF/网页是否有新版。
2. 新版出现时，下载 source 并产生 candidate patch。
3. Workflow 自动开一个 Pull Request。
4. PR 显示旧值、新值、来源、年份、证据位置与数据差异。
5. PM 审核并 merge。
6. Merge 后 pipeline 重新生成 JSON。
7. 自动部署到 DirectAdmin。

优点：

- 开发量较小；
- 有审计记录；
- 可以 rollback；
- PM 不需要直接改 CSV；
- AI 无权直接发布数值。

### 后续升级：Supabase review queue

项目成熟后可建立：

- `data_sources`
- `data_candidates`
- `data_observations`
- `ingestion_runs`
- `source_health`

Admin 页面提供 Approve / Edit / Reject。必须加 RLS，只允许 admin 修改 approved data。

## 10. Production 自动更新是不可缺少的一步

如果 GitHub Actions 只更新 repository，不部署 DirectAdmin：

- API 是活的；
- CSV/JSON 在 GitHub 是新的；
- Production 仍然是旧 snapshot。

因此需要在 SSL 修复后完成以下其中一种：

### 方案 A：自动部署，推荐

GitHub Actions build 后，通过 SFTP/FTPS 上传 `dist` 到：

`/domains/borneotracker.rentsmartprop.com.my/public_html`

所需 Secrets：

- host
- port
- username
- password 或 SSH private key
- remote path

### 方案 B：人工部署

每次重要 demo 前：

1. 拉最新 GitHub。
2. 重新 build。
3. 上传新的 `dist` ZIP。
4. 解压覆盖 `public_html`。
5. 检查 `generatedAt`。

若选人工方案，就必须接受 Production 不是真正 daily live。

## 11. 必须加入的 freshness 与 health 机制

建议生成：

`public/data/data-status.json`

每个 source/indicator 包含：

- `last_attempt_at`
- `last_success_at`
- `source_data_year`
- `status`: fresh / stale / partial / failed
- `used_fallback`
- `coverage`
- `row_count`
- `message`

前端至少显示：

- Dashboard generated date
- 数据本身的 year
- source
- data level
- confidence
- partial/stale badge

### 建议 fail-safe

- 一个非关键来源失败：保留 last-good value，但标记 stale。
- 核心 scoring input 失败且无可靠 last-good：阻止发布新 Resilience JSON。
- coverage 从 5/5 降成 1/5：阻止发布。
- year 倒退：阻止发布。
- 数值异常变化超过阈值：要求人工审核。

## 12. 实施顺序

### P0：先修“有更新但 Production 看不到”

1. 修 SSL。
2. 决定 DirectAdmin 自动或人工部署。
3. workflow commit `public/data/districts.json`。
4. workflow commit `gdl_msch_cache.csv`。
5. workflow 传入 `GDL_API_TOKEN`。
6. 加 `data-status.json` 和 pipeline failure notification。

### P1：先修会改变 Resilience Index 的静态输入

1. 自动拉 DOSM Sabah/Sarawak population。
2. 自动拉 Sabah/Sarawak electricity percentage。
3. 自动拉 Brunei population 与 Internet use。
4. 启用 GDL cache/API，移除重复硬编码教育值。
5. 修 Kalimantan electrification 1/5 coverage。
6. 自动取得 Kalimantan population，并改用 population-weighted aggregation。

### P2：建立报告审核路线

1. Sabah/Sarawak life expectancy watcher。
2. Sabah/Sarawak/Brunei tourism watcher。
3. Brunei paddy official report/FAOSTAT fallback。
4. GitHub PR approval flow。

### P3：改善非 score 指标的可比性

1. National park count 改为 protected-area coverage。
2. 申请 Protected Planet API v4 token。
3. 保留原 count 作为 descriptive data，不做排名。

## 13. 完成标准

只有以下全部满足，才可称为“Production data automation 完成”：

- [ ] 每个 Dashboard row 可追溯到 source、year、data level 与 last success。
- [ ] 所有静态 scoring inputs 已移除，或清楚标记为 approved manual。
- [ ] Kalimantan aggregate 显示 coverage，不再把 1/5 当完整 territory。
- [ ] GDL cache 在没有即时 API call 时仍可用。
- [ ] District JSON 会被 commit。
- [ ] Build 后会自动或有纪律地部署到 DirectAdmin。
- [ ] Production 能显示最新 `generatedAt`。
- [ ] API 失败不会变成 0 或无声沿用旧值。
- [ ] 新 PDF/网页资料必须经过 PM 审核才发布。
- [ ] 所有 exposed keys 已 rotate，secrets 只保存在 GitHub/Supabase/hosting secret storage。

## 14. 最终建议

最可行的方案不是强迫每个来源都变成 API，而是：

1. **能自动的官方 CSV/API 全部自动化。**
2. **没有 API 的官方报告，用自动侦测与候选抽取减少人手。**
3. **数值发布前保留 PM 审核。**
4. **GitHub 数据更新后自动部署 DirectAdmin。**
5. **页面公开显示 freshness、coverage 与来源层级。**

这同时符合 Borneo Tracker 的 Data 与 Ethics 要求：提高自动化，但不伪造、不猜测、不隐藏 coverage gap，也不把国家级 proxy 假装成 state-level fact。

## 15. 官方参考

- data.gov.my Population Table: States: https://data.gov.my/data-catalogue/population_state
- data.gov.my Access to Basic Amenities: https://data.gov.my/data-catalogue/hh_access_amenities
- data.gov.my Arrivals by State of Entry caveat: https://data.gov.my/data-catalogue/arrivals_soe
- World Bank Indicators API documentation: https://datahelpdesk.worldbank.org/knowledgebase/articles/889392-about-the-indicators-api-documentation
- BPS WebAPI developer portal: https://webapi.bps.go.id/developer
- BPS population by province table: https://www.bps.go.id/id/statistics-table/3/V1ZSbFRUY3lTbFpEYTNsVWNGcDZjek53YkhsNFFUMDkjMyMwMDAw/jumlah-penduduk--laju-pertumbuhan-penduduk--distribusi-persentase-penduduk--kepadatan-penduduk--rasio-jenis-kelamin-penduduk-menurut-provinsi.html
- Brunei DEPS population: https://deps.mofe.gov.bn/population-social-statistics/
- Brunei Tourism statistics: https://www.tourism.gov.bn/v2-5-tourism-report-statistics/
- FAOSTAT: https://www.fao.org/Faostat/en/
- Protected Planet API v4: https://api.protectedplanet.net/documentation
