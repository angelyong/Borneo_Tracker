# Borneo Tracker AI Chatbot — 概念与实施方案

> 本文取代 `Borneo_Tracker_AI_Chatbot_Implementation_Plan_CN.md`(该文档是通用模板,未对照本 repo 撰写:全文 0 次提到 Supabase / indicators.json / news_items / DirectAdmin / OpenAI / Resilience Index)。
> 定稿日期 2026-07-28。所有引用均经过独立对抗性验证。

---

## 1. 定位:韧性顾问(Resilience Advisor),不是 FAQ 机器人

用户在看地图和数据,**但他看不懂,所以他问**。

Chatbot 的工作不是回答"网站怎么用",是**把屏幕上那个数字翻译成一句人话,并告诉用户可以往哪里使力**。

它知道用户正在看哪一页、哪个领地(`currentPage` / `region` 已在请求体中)。

**这也是 ABCDE 里 A 的第一个真实交付物**,并且是 Impact Simulator 的第一阶段(见 §9)。

---

## 2. 六层答案契约

| | 层 | 谁产出 |
|---|---|---|
| ① | **结论** — 是多少,什么等级 | 代码 |
| ② | **诊断** — 最弱在哪,由什么撑着 | 代码 |
| ③ | **差距** — vs 目标差多少 | 代码(`compute_resilience.py` 的 `BOUNDS`) |
| ④ | **影响** — 对整体意味着什么 | 代码 |
| ⑤ | **建议** — 可以往哪里使力 | 对策库检索 + 模型组织语言 |
| ⑥ | **诚实** — 置信度、口径、这个数不代表什么 | 代码 |

**①②③④⑥ 全部由确定性代码算出 → 零幻觉风险。⑤ 是唯一需要模型的部分,而且模型只能从检索到的对策里组织语言,不得自由发挥。**

### 关键结构事实

**每个 Hexagon 支柱都只由一个指标计分。** 已核实(以 Sabah 为例):

```
Food          28.7  = 人均稻谷 28.7 kg      (目标 100)
Education     45.0  = 平均受教育年限 8.7 年  (6–12)
Shelter       61.0  = 清洁水 80.5%          (50–100)
Energy        75.2  = 电力接入 87.6%        (50–100)
Healthcare    76.5  = 预期寿命 75.3 岁      (60–80)
Entertainment 96.0  = 互联网使用 98.0%      (50–100)
```

因此"诊断"永远能落到**一个具体数字**上 —— 这正是顾问式回答成立的原因。

**同时:约一半的 dashboard_concept 不计入韧性指数**(无 `hexagon_pillar` 标签或无 `BOUNDS`):`air_quality`、`economy`、`fire_hotspots`、`governance`、`poverty`、`protected_areas`、`unemployment_rate`、`heritage`、`entertainment`、`shelter`(Households 行)。

**Bot 必须区分**它谈的是「会改变韧性指数的事」还是「只在 ESG/SDG 面板上显示的事」。

---

## 3. 架构

```
用户提问
   ↓
Supabase Edge Function (Deno)      ← 唯一部署面
   ↓
请求校验 → 身份解析(匿名JWT / 登录JWT / IP段)
   ↓
准入闸门(突发限流)                  ← 不花模型额度
   ↓
意图路由(确定性关键词,EN + MS 双语词表)
   ├── SITE_KNOWLEDGE   → 知识库(自动生成)
   ├── DASHBOARD_DATA   → indicators / resilience / districts
   │                       → 实体解析 → 可比性闸门 → 答案事实对象
   ├── BORNEO_NEWS      → news_items WHERE status='published'
   │                       + pending 聚合计数(只有数字,永不含标题正文)
   └── 无证据 / 越界      → 确定性拒答(0 额度)
   ↓
【此处才占额度】→ Gemini(只写散文,不许输出数字)
   ↓
校验器:数字必须来自事实对象 · 正文一个 URL 都不许有 · 无泄密
   ↓
答案 + 来源(全部来自检索 metadata) + 剩余额度
   ↓
写 ai_chat_events(闭环遥测)
```

### 四个检索源

| 源 | 规模 | 检索方式 |
|---|---|---|
| 站点知识 | ~225 条 / ~16.5k token | Postgres FTS(`english` + `indonesian`)+ GIN |
| 指标数据 | 93 行 + 27 序列 + 987 区县 | **确定性 SQL/JSON 查询**,不做文本检索 |
| 对策库 | 60–70 条 | 按 concept 直接查表 |
| 文献库 | 50–500 → 1000+ | FTS + concept 标签过滤;超 1000 条再上向量 |

---

## 4. 五个已定决策

### D1 · 运行时 = Supabase Edge Function (Deno)
生产环境是 DirectAdmin 静态托管,没有后端。分支 `aichatbot` 上的 `/api/ai/chat` 只是 Vite dev middleware,`vite build` 后不存在,生产会 404。

⚠️ **必须同时修**:`src/services/AIChatService.js` 的 catch 会捕获**所有**失败(含 429/500)并返回 `mockClientResponse()`,默认开启。后端死掉时前端会编一个看起来正常的答案。

### D2 · 模型 = Gemini,pin 死版本
- **决定性理由 = SRS BR-05(只用免费/开放层级)**。OpenAI 所有文本模型无免费层,进 Tier 1 需先充 $5。**ChatGPT Plus 订阅不包含 API 权限。**
- 马来语更优(SEA-HELM 75.82 vs 73.17)
- **用裸 `fetch`,不用 SDK**(`@google/genai` 依赖 `google-auth-library`,在 Deno 上有已知崩溃)
- **单独的 GCP project** —— 配额按 project 计,共用 key 会让 chatbot 流量静默搞停每日新闻任务
- **pin 死 model ID**,不要像 `digest_news.py` 的 `pick_model()` 那样运行时自动发现
- `max_output_tokens` ≈ 目标长度 × 2.5(thinking token 共享预算,卡太紧会返回空答案)

### D3 · 回答数值问题 —— 是,这是产品存在的理由
真正的难点不是幻觉,是**可比性**。见 §6。

### D4 · 新闻 = 保留人工闸门(BR-04),分层
- Bot 只引用 `status='published'`
- **可以说出 pending 的聚合数字**(territory + 数量 + 日期范围),**永不含标题或正文**
- 因此 bot 永远不会在"其实有新闻只是没人审"时说"没有新闻"
- 关闭 `AI_CHAT_EXTERNAL_SEARCH_ENABLED`
- 理由:闸门从来不是真实性检查,是**做不到真实性检查的替代品**;而且 `news_items.body` 是我们自己的英文改写,责任在我们,没有发布者可以指

### D5 · 额度计量对象 = 模型调用,不是回答
- 全站日预算约 160(免费层 RPD 扣除新闻任务 30 后)
- 匿名 5/天 · 登录 25/天 · 管理员 50/天
- **拒答、缓存命中、模板答案 = 0 额度**
- 身份 = Supabase 匿名登录 + Turnstile(保住免登录承诺,拿到真 JWT `sub`),并按 IP 段(IPv6 /64)双重计量,IP 存为**按天加盐的 HMAC**
- 原子计数 = Postgres `insert … on conflict do update … where … returning`(0 行 = 超限),**先占额、后调用、失败退还**。不用 Redis
- 杀停开关放 DB 行,不放环境变量
- **优雅降级**:数字由代码渲染,所以预算耗尽时数据类问题仍可用模板回答

---

## 5. 关于 RAG(给 zylena)

**RAG 指的是架构(去外部知识库取材 → 喂给模型 → 生成),不是某种检索算法。** AWS 和 Microsoft 官方文档都明确:关键词检索、SQL 检索同样是 RAG。"RAG = 向量数据库"是常见误解,来源是 2020 年提出 RAG 那篇论文恰好用了向量检索。

**所以方向是对的。差别只在向量那一步该排在什么位置。**

实测语料:**~295 条 / ~21,000 token —— 能塞进 Gemini 上下文约 45 次。** 在这个规模,检索的作用是精准和省 token,不是可行性。

**答案质量杠杆排序(按影响力):**

1. **语料完整度** —— 现在 16 条(10 条是 placeholder),可得 ~225 条 ← 高出其他一个数量级
2. **实体解析** —— 57 个指标只认 7 个别名,987 个区县不支持,没有马来语名
3. 答案契约 / 输出校验器
4. 双语查询扩展 —— `en.json` / `ms.json` 键 1:1 对齐,**可免费生成 EN↔MS 别名表**
5. 检索排序 —— 现在是 `includes()` 子串匹配(`art` 会匹配 `quarterly`)
6. **向量搜索 —— 最低**

**向量触发条件(写死,避免反复争论):** 文献库 > 1,000 条,**或** golden set recall@10 < 85% 且诊断原因是词汇错配。届时用 `gemini-embedding-001` 截断到 768 维,build 时批量嵌入,500 条 × 768 维 = 1.5 MB,**连索引都不用建**。

⚠️ Postgres 内置 `indonesian` 词干分析器,**没有 `malay`**。马来语/印尼语词缀形态基本相同,可作代理,但无基准测试,上线前需实测。

---

## 6. 可比性闸门(这是数值问题的真正难点)

一个校验器能拦住假数字;**只有可比性闸门能拦住"真但没意义"的答案。**

### 19 个 concept 中只有 10 个可跨领地比较

不可比的原因分三类:

**(a) 各领地用了不同指标**

| concept | 问题 |
|---|---|
| `forest_cover` | Brunei 是 **% 国土**(72.1%, 2023);其余三地是 **2000 年公顷基线**(Sabah 6,684,138 ha)。**Sabah 目前根本没有森林覆盖百分比** |
| `economy` | Brunei/Kalimantan 报**增长率 %**;Sabah/Sarawak 报**绝对值 RM mil**。拿增长率比绝对值 |
| `education` | Brunei 是 **成人识字率 %(2011 年!)**;其余是平均受教育年限 |
| `energy` | Brunei/Sabah 是 Electricity access;Sarawak/Kalimantan 是 Electrification ratio |
| `shelter` | Brunei 是基本卫生设施 %;其余是**户数(count)** —— 户数是人口统计,不是居住质量,且**不计分** |
| `poverty` | 马来西亚是**家庭收入**低于 PLI(均值 RM2,705/月);印尼是**人均消费支出**低于 Rp609,160/月(≈RM162)。**Brunei 完全缺失** |
| `entertainment` | Brunei/Sabah/Sarawak 是游客抵达;Kalimantan 是**居民出行次数** |
| `internet_use` | 印尼 BPS 口径是**5 岁以上、分母为总人口**;马来西亚 DOSM 口径是 **15 岁以上**。**印尼网民中 18.5% 在马来西亚的年龄门槛以下** —— 72.78% vs 98.02% 那个 25 点差距被口径放大了一半以上 |

✅ **一个洗清的数字:Kalimantan 互联网 76.1% 是对的。** 五省人口加权 = 76.18%,Databoks 引 BPS《人类发展指数 2024》= 76.14%。但要标注为**派生的区域聚合值** —— BPS 只发布省级,不发布"Kalimantan"这一层。

**(b) 全国数字套用在次级行政区 → 零区分力**

- `governance`:Sabah = Sarawak = 57.9,因为两者都是**马来西亚全国**的 WGI 数字。**按定义就不可能区分。**
- `education`:Global Data Lab 对 Sabah 和 Sarawak **在 1990–2023 全部 34 年输出完全相同的值**。那不是两地趋同,是**同一个估计印了两遍**。

**(c) 绝对计数未做面积/人口归一化**

- `fire_hotspots`:Kalimantan 27,652 vs Sabah 697。**但 Kalimantan 是 Sabah 的 ≈7.4 倍面积(不是 13 倍)**
- 归一化后(每千 km²):Kalimantan 50.8 · Sarawak 26.7 · **Brunei 22.2** · **Sabah 9.5**
- **排名翻转:Brunei 原始计数看起来最干净,按面积算比 Sabah 差 2.3 倍。Sabah 才是火灾最少的。**
- `protected_areas`:Sarawak 30 个 vs Sabah 9 个 —— **但 Sabah 保护 30.06% 国土,Sarawak 约 7.1%。这个指标指反了方向。**

### 其他必须拒答的情况

- **趋势**:19 个 concept 只有 7 个有序列。而且序列指标和头条行的指标**不是同一个**(如 `deforestation` 头条是累计,序列是年度)
- **SDG 进展**:数据里**没有任何 target 字段**,所以只能答"覆盖度",不能答"进展"
- **区县数据**:`districts.json` 停在 2026-07-10,每个区县答案必须带过期声明

---

## 7. 已发现的数据问题(按优先级)

**这些是线上产品的真实缺陷,独立于 chatbot,建议单独修。**

| # | 问题 | 影响 | 证据 |
|---|---|---|---|
| **1** | **Food 用 2022 年产量 ÷ 2024 年人口** | Sabah Food 28.7 → 应为 **31.5** | OpenDOSM 107,565 t (2022);DOSM 人口 3,414.9k (2022) vs 3,742.0k (2024) |
| **2** | **Sarawak 互联网使用率错误** | 显示 98.0,实为 **94.2**(全马 16 州**最低**)。Sarawak 韧性 72.5 → **71.2** | DOSM ICT Survey **Table 2.8** |
| **3** | **Brunei 互联网年份标错** | 99.0 标"2024",实为 **2023** 值;2024 = 96.30。Brunei 韧性 79.0 → **78.1** | `data_model.py` 对每个 `INTERNET_USE` 行硬编码 `"year": "2024"` |
| **4** | **Kalimantan 旅游数字是月度值,且方向反了** | 4,741,336 是**单月**、且是 *provinsi asal*(Kalimantan 居民**出行**),不是 *tujuan*(**到访**)。年度约 40–60M | Kemenpar/BPS 表 |
| **5** | **poverty 边界值被裁剪** | 边界 best 0% / worst 25%,但 Sabah 2020 = **25.3%**,超出"最差"边界 | `hh_poverty_state.csv` |
| **6** | **poverty 趋势线有方法论断点** | 2019 年 PLI 方法论变更(全国 PLI RM983 → RM2,208)。2016→2019 连线会显示 Sabah 从 2.9% 暴涨到 19.5% —— **那是方法改变,不是现实** | DOSM;EHM 分析 |
| **7** | **Brunei 失业率用了 ILO 模型估计** | 5.28% 是 World Bank/ILO **模型**值;Brunei DEPS 自己报 **5.0%**(2025)。ILO 明确警告模型值不得用于国家间排名比较 | DEPS Labour Force |
| **8** | **Sabah/Sarawak 失业率是季度值标成年度** | 5.7 / 3.1 是 **2025 Q3** 的印数;Sabah Q1 2025 是 6.7% | `lfs_qtr_state.csv` |
| **9** | **Kalimantan poverty 5.13% 对不上** | 五省 2025-03 P0 未加权平均 = 5.18%。且未加权平均本身就不对(Kalbar ~540万人 vs Kaltara <80万) | BPS 省级 |
| **10** | **Kalimantan GDP 增长 4.5% 无来源** | 找不到任何出处 | — |
| 11 | Sabah 旅游 3,200,000 | 官方 2024 gross = **3,147,480** | Sabah Tourism Board |

---

## 8. 可以修复的指标空洞

| concept | 现状 | 更好的来源 | 状态 |
|---|---|---|---|
| `protected_areas` | 国家公园**计数**,指反方向 | **WDPA / Protected Planet API v4** —— `SUB_LOC` 字段是 ISO 3166-2(MY-12 Sabah、MY-13 Sarawak、ID-KB/KT/KS/KI/KU),`IUCN_CAT` 的 Category II 就是"国家公园",`MARINE` 区分海陆 | 路径已验证;需免费 API token。**v3 已于 2026-05-01 停用,直接对 v4 开发** |
| `economy` | 增长率 vs 绝对值混用 | **实际 GDP per capita**。Sabah RM23,613 vs Sarawak **RM60,681 = 2.57 倍**(现在的绝对值比只显示 1.73 倍)。终于和 poverty 说的是同一个故事 | Sabah/Sarawak/Brunei 今天就能算;**Kalimantan 待解**(BPS 被 Cloudflare 403,需注册 WebAPI key) |
| `education` | GDL 建模值,两州完全相同 | **DOSM SDG 04-6-1 功能性识字率** —— Sabah **88.8%**,Sarawak **92.2%**(实测、可区分州、CC-BY、CSV) | 可用;但口径是比例不是年限,边界需重设。数据止于 2022 |
| `air_quality` | 单站实时 AQI 当territory值 | **WHO Ambient Air Quality Database v8.0**(2026-06-30 发布,年均 PM2.5,城市级) | 需确认哪些婆罗洲城市在库内 |
| `entertainment` | 绝对抵达数,四种口径 | 住宿餐饮业占 GDP 比重,或 **Tourism Satellite Account**(Sabah RTSA 2022 = **占 GDP 10.7%**) | Sarawak RTSA 停在 2018;Brunei/Kalimantan 无 |
| `fire_hotspots` | VIIRS 告警计数 | **SiPongi**(印尼林业部)按省/县发布**过火公顷数**,经地面核实 —— 天然可按面积归一 | 仅印尼侧,不能替代但应并列 |
| `internet_use` | 已饱和(94–99%),无区分力 | 真正的信号在旁边:**固网宽带**(Sabah 32.2%、Sarawak 34.0% vs 全马 48.0%)和**电脑使用率**(Sabah **61.0%,全马最低**) | DOSM 同一份报告 |
| `shelter` | 户数(count),不计分 | 需要真正的居住质量指标 | 待查 |

**两个采集改进(已验证可用):**
- **Sarawak 旅游** 有 CC-BY CKAN API,今天就能用
- **Sabah 旅游不再需要人工录入** —— `sabahtourism.com` 用浏览器 UA 可正常取 PDF
- ⚠️ `bps.go.id` 全域 Cloudflare 403,需注册 WebAPI key,不能爬

---

## 9. 与 Impact Simulator 的关系

| | v1 · 韧性顾问 | v2 · Impact Simulator |
|---|---|---|
| 能力 | **诊断**(只读) | **模拟**(What-if) |
| 用户问 | "Sabah 的粮食为什么弱?" | "如果稻米提升 30% 会怎样?" |
| 新增 | 对策库 | `recompute(inputs)` + function calling |

**实体解析、事实对象、答案契约、出处处理全部复用。** 前端也是同一个入口 —— 聊天框就是 Simulator 的界面(它的自然输入是一句话,不是一堆滑杆)。前端只需增加**一条消息能渲染小图卡**的能力:

```
Sabah 韧性  63.7 ──▶ 68.2   (+4.5)
Food        28.7 ──▶ 45.0   目标 100
最弱环节     Food  ──▶ Education(45.0)  ← 换人了
```

最后那行是 Simulator 的真正价值:**改了一件事,最弱环节会换成另一个。**

⚠️ v1 **不要**永久禁用 function calling(原方案 §3/§17 把它列入"最终不加入")。v1 暂缓可以,永久禁用会让 `get_resilience()` / `simulate_impact()` 以后没有落点。

---

## 10. 对策库(lever library)

### Schema

```json
{
  "concept": "food",
  "title": "复耕 22,146 公顷荒废稻田",
  "whoActs": "government | business | community",
  "horizon": "short | medium | long",
  "mechanism": "针对该指标公式的精确机制说明",
  "evidence": { "publisher": "", "year": 0, "title": "", "url": "", "whatItActuallySays": "" },
  "appliesWhen": "前提 / 适用领地",
  "doesNotApplyWhen": "诚实的限制"
}
```

**纪律:模型不得自由发挥建议。** 只能从检索到的对策里组织语言。措辞是「有文献记录的做法是…」+ 出处,**不是**「你应该」。每条回答保留免责声明。

### 建设流程必须是两段式

```
研究 agent 找证据  →  对抗性验证 agent 逐条打  →  才能入库
```

**这不是可选项。** 实测:第一批 17 条引用中约 11 条需要修改、1 条被推翻(**约 65%**),而研究员已被明确要求逐条 fetch。验证成本与研究成本相当。

抓到的三种错误,单纯 URL 检查全都发现不了:
1. 「Sabah 达成 30% 保护区」—— 那是**标题**的词,正文全是条件式;林业局自己的网站 2026-07-27 仍写 **26.4%**
2. 「63–65% 实际森林覆盖」—— 那是**土地权属类别加总**,把 83 万公顷工业人工林算作森林;而且 63% 在 forest.sabah.gov.my 上**根本不存在**
3. 「GFW 看不见选择性伐木」—— **方向反了**,WRI 说 2015 年后对选择性伐木的敏感度**提升**了

### 已完成:约 55 条对策,覆盖 17 个 concept

`food` · `deforestation` / `forest_cover` · `energy` · `clean_water_access` · `shelter` · `education` · `healthcare` · `fire_hotspots` · `air_quality` · `protected_areas` · `poverty` · `unemployment_rate` · `economy` · `internet_use` · `entertainment` · `heritage` · `governance`

### 两个「无对策」结论(这比编四条假对策有价值)

**`governance` —— 按定义就不可能被本地行动改变。** WGI 是国家级指标。Sabah 的反腐改革会作为一个分数进入全国感知综合指数,和整个西马混在一起。**而且没有替代品**:印尼有省级 SPI/IDI,马来西亚没有对等物(唯一的州级 SDG16 数据构成是凶杀率、暴力受害比例、未判决羁押、监禁率 —— 那是暴力与监禁,不是制度质量)。**正确做法:标注为「国家级,继承值」,并从任何跨领地排名中排除。**

**`heritage` —— 三重结构性阻塞,均经 UNESCO 原始文件核实。**
1. 马来西亚的 Tentative List 里**一个婆罗洲站点都没有**(仅 Taman Negara、Gombak 石英脊、双溪毛糯麻风病院)
2. Tentative 列入是**硬性前置条件**,且 2025 年新规增加了强制性 Preliminary Assessment + 至少 12 个月间隔 → **最快约 4 年**
3. **马来西亚全国每年只有 1 个提名名额**。Betung Kerihun(西加里曼丹)已排队 **22 年**

**Brunei 更极端:0 个已列入,且 Tentative List 是空的** —— 批约 15 年,第一步都没走。

⚠️ Danum Valley、Maliau Basin、Loagan Bunut、Bako-Buntal Bay **都不在 UNESCO 体系内**。任何暗示它们"申报中"的文案都是错的。

### 一个必须写进 bot 的混淆因子

**El Niño 使重大火灾概率提高 2.7 倍**(npj Natural Hazards 2026)。Bot **绝不能**在不说明两个年份 ENSO 状态的情况下,把 `fire_hotspots` 的同比变化归因于政策 —— 2.7 倍的乘数与任何单一对策的建模效果(40–76%)相当甚至更大。

**但也不能全推给气候**:2025 年 7 月 794 个热点 vs 2024 年 7 月 68 个,而 2025 年旱季**更温和**。那是点火与排水管理的失败,不是气候信号。

---

## 11. 文献库(外部证据)

**做法:策展 + 定期抓取,不做实时网络搜索。**

实时搜索给的引用**更差**:Gemini grounding 返回 Google 跳转链接、标题只有域名、**没有发表日期**,且 3.x 模型免费层不开放。

**复用 `fetch_news.py` / `news.yml` 那台机器,月度 cron**(文献不像新闻会烂,一篇 2019 年的论文明年依然成立 → **不需要每日人工闸门**)。

| 来源 | Borneo 相关量 | 摘要覆盖 | 角色 |
|---|---|---|---|
| **OpenAlex** | 26,021 | 78% | **骨干** —— 发现、去重、SDG 标签、FWCI 质量分 |
| **CGSpace (CIFOR)** | 1,259 | 78% | 相关度最高,婆罗洲的机构声音 |
| **World Bank OKR** | ~10(精准) | 高 | 明确 **CC BY 3.0 IGO** |
| **Europe PMC** | 1,552 | 高 | **逐篇授权字段** —— 最干净 |
| **DOAJ** | 1,610 | 高 | 本地印尼/马来开放期刊 |
| ~~Semantic Scholar~~ | — | 47% | ❌ 授权"不可再授权",不能用 |

**版权是硬红线,三层分开处理:**
- **元数据**(标题/作者/年份/DOI/链接)—— 到处都安全
- **摘要正文** —— **只有拿到逐条授权才能存**(约 40–60% 的语料)。OpenAlex 把摘要存成倒排索引正是因为它无法主张再分发权;还原成明文不改变版权状态
- **全文** —— 不存,只给链接

实测最小可用语料:19 个 concept → **112 篇不重复,中位 FWCI 10.3**(领域平均的 10 倍)。

⚠️ `internet_use` 学术文献里只有 16 篇 —— **这个 concept 无法用文献覆盖**,应改用 ITU/MCMC 报告或直接留白。

---

## 12. 分阶段

| 阶段 | 内容 |
|---|---|
| **0** | 合并 `aichatbot` 分支(落后 master 14 个 commit,layout 文件已分叉);修 §7 的数据问题;删掉前端 mock fallback |
| **1** | Edge Function 骨架 + Gemini 裸 fetch + 身份/额度(Postgres RPC) |
| **2** | 知识库 16 → ~225 条(全自动生成:`reportContent.js` + 双语 i18n + `PolicyPage.jsx` + 方法论 markdown) |
| **3** | 实体解析 + EN↔MS 别名表 + 可比性闸门 |
| **4** | 答案事实对象 + 六层契约 + 校验器 + 无 LLM 模板降级 |
| **5** | 对策库入库(55 条已验证)+ 新闻分层读取 |
| **6** | Golden test(~50–80 题,**一半马来语**),测 recall@10 与实体解析准确率 |
| **7** | 文献库 v1(OpenAlex + 授权解析)|
| **v2** | Impact Simulator:`recompute(inputs)` + function calling + 聊天内图卡 |

---

## 13. 验收标准(可证伪的)

原方案的 21 条验收标准在最危险的地方不可判定,在最容易的地方可测。替换为:

1. Golden set 中每个数据类问题,回答里的**每一个数字 token 都能在事实对象的预格式化字符串中找到**(归一化千分位/小数/百分号/年份后)
2. 回答正文中**零个 URL**;`sources[]` 全部来自检索 metadata
3. 不可比的跨领地问题**返回可比性拒答**,不返回数字(测试用例:`forest_cover` Brunei vs Sabah、`economy` 任意两地、`governance` Sabah vs Sarawak)
4. 无趋势数据的 concept 问趋势 → 拒答(12 个 concept)
5. 问 SDG「进展」→ 降级为覆盖度 + 说明无 target 数据
6. 马来语提问能被正确路由(不得因英文词表而被判越界)
7. 后端 404 / 429 / 500 时前端**显示错误**,不显示编造的答案
8. 新闻问题无已发布内容时,返回「尚未审核」而非「没有新闻」
9. 模型预算耗尽时,数据类问题仍返回模板答案
10. `npm run lint` / `npm test` / `npm run build` 通过;diff 中无 secret
