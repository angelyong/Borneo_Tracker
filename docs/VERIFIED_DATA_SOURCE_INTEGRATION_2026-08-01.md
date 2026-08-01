# Borneo Tracker 新资料来源审核与接入结果

日期：2026-08-01

## 结论

这些资料不是购买资料。它们来自政府统计机构、国际组织或官方卫星服务；是否可以自动更新，取决于来源提供的是 API、机器可读下载文件，还是年度 PDF/统计表。

| 来源 | 是否官方/可信 | 是否对口 | 类型 | 实测状态 | 网站处理 |
|---|---|---|---|---|---|
| DOSM `population_state` | 马来西亚统计局官方 | 是，州人口 | 可下载 CSV/Parquet，不是 REST API | 通过 | 已自动接入；人均计算使用最新官方人口，并同时列出生产与人口年份 |
| DOSM `hh_access_amenities` | 马来西亚统计局官方 | 是，家庭电力接入率 | data.gov.my API + CSV | 通过 | 已接入 Sabah 87.6%、Sarawak 90.0%；明确标记为 2022 survey |
| World Bank Brunei population | World Bank 官方 API | 是，人口 | API | 通过 | 已自动接入 `SP.POP.TOTL` |
| World Bank Brunei internet | World Bank 官方 API | 是，个人互联网使用率 | API | 通过 | 已自动接入 `IT.NET.USER.ZS`；2024 为 96.2983% |
| NASA FIRMS | NASA 官方卫星资料 | 是，24 小时热点侦测 | API；另有 keyless CSV feed | 通过 | 已按行政边界分配至 Sabah、Sarawak、Brunei、Kalimantan |
| ESDM Electricity Statistics 2024 | 印尼能源与矿产资源部官方 | 是，五省电气化率 | 固定年度 PDF，不是 API | 人工核对通过 | 已作为 reviewed reference 接入，Kalimantan household-weighted 为 99.65% |
| BPS 2025 population | Statistics Indonesia 官方 | 是，五省人口 | 官方统计表/下载文件；特定 WebAPI mapping 尚未验证 | 固定资料核对通过 | 五省合计 17,951,300，已用于 2025 paddy 同年分母 |
| BPS poverty P0 | Statistics Indonesia 官方 | 与现有 poverty 指标对口 | 动态统计表；WebAPI 需 key + variable mapping | API 尚未通过 | 暂不替换 Production，待 5/5 同年份 keyed test |
| BPS internet | Statistics Indonesia 官方 | 可用，但定义为 5 岁以上、过去三个月使用互联网 | 动态统计表；WebAPI 需 key + variable mapping | API 尚未通过 | 暂不接入；必须保留年龄/定义说明并做人口加权 |

## 已接入的关键数值

- 最新 DOSM 人口（2026）：Sabah 3,767,000；Sarawak 2,539,800。
- 按最新官方人口计算的 paddy per capita：Sabah 28.6 kg/capita；Sarawak 58.0 kg/capita。来源文字会明确标出 paddy 为 2022、人口为 2026，不伪装成同年数据。
- BPS 2025 Kalimantan 五省人口：17,951,300；修正后 paddy per capita：90.3 kg/capita。
- DOSM 2022 household electricity access：Sabah 87.6%；Sarawak 90.0%。
- ESDM 2024 Kalimantan electrification ratio：99.65%（五省 household-weighted）。
- NASA FIRMS 本次 test snapshot：631 个 Borneo bbox detections，623 个成功匹配行政边界；这是 24 小时侦测，不是年度火灾数量。

## 重要定义与限制

1. API 能每天执行，不代表出版社每天发布新数据。DOSM electricity API 目前底层仍是 2022 survey。
2. FIRMS 24 小时热点与 GFW 年度 fire alerts 是不同时间窗口，代码已分成不同指标，不会平均或混合。
3. Sarawak Energy 99.4% 是 administrative domestic electrification ratio；DOSM 90.0% 是 HIES household access。两者保留为不同指标，正式跨州比较采用同一 DOSM 定义。
4. ESDM PDF 不做无人审核的自动抽取。新年度报告应先转成 reviewed CSV、核对表号/单位/五省覆盖，再合并。
5. BPS population/poverty/internet 的官方资料存在，但新的特定 WebAPI variable IDs 尚未用有效 key 实测，因此不能声称已经自动化。

## 已加入的安全保护

- API 暂时失败或 GitHub Secret 缺失时，snapshot、history 和 district layer 会保留上次成功资料并标记 `STALE`，避免数据被清空。
- Kalimantan 汇总只选同一年资料；如果已有经过核对的 territory aggregate，就不会再用简单平均覆盖它。
- Paddy kg/capita 使用最新官方人口作为 current-resident 分母（避免将 DOSM 2020 人口普查前后重基系列静默混用），并在来源文字分别记录 production year、population year、数值与发布者。
- GitHub Actions 已加入 `FIRMS_MAP_KEY`、`GDL_API_TOKEN`，并纳入 `gdl_msch_cache.csv` 与 `public/data/districts.json` 的更新提交。

## Test run

- Python 新资料来源/语义测试：15/15 通过。
- DOSM、World Bank、NASA FIRMS live source tests：通过。
- 完整 data pipeline：通过。
- 前端 Vitest：43/43 通过。
- Vite production build：通过。

## 尚需 Project Manager / hosting 管理员处理

1. 在 GitHub Actions Secrets 配置已轮换的 `BPS_API_KEY`、`GFW_API_KEY`、`WAQI_TOKEN`、`FIRMS_MAP_KEY`、`GDL_API_TOKEN`。
2. 使用有效 BPS key 找出 population、poverty P0、internet 的正确 variable/domain mapping，并验证五省、同一年、单位和定义；通过后才改成自动来源。
3. DirectAdmin 若仍为手动部署，GitHub JSON 更新不会自动到 Production；还需另行配置 SFTP/FTP deployment workflow。
