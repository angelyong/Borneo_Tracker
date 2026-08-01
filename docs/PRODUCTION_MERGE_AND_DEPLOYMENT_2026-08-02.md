# Borneo Tracker — 合并、检查与 Production 上传说明

日期：2026-08-02

Production：`borneotracker.rentsmartprop.com.my`

## 这次完成了什么

- 已解决最新代码中的 Git conflict，并确认没有残留 conflict marker。
- 保留原有页面、登入、地图、ESG、SDG、社区、报告及 Supabase 功能。
- 合并已验证的数据来源与来源说明，包括 DOSM、World Bank、NASA FIRMS、BPS/GFW 的 last-good fallback，以及经审核的 ESDM/BPS 固定资料。
- 修正 `Domestic electrification ratio` 没有进入 Resilience scoring bounds 的问题。
- 每一条 fallback 资料会保留真正的最后成功更新时间，不再假装当天更新。
- AQI 和 24 小时火点属于即时资料；抓取失败时不会显示昨天的旧值。
- fallback 资料超过 45 天、日期无效、数据量异常下降或 Resilience stale 比例过高时，GitHub Actions 会停止发布。
- GitHub Actions 会先确认 `BPS_API_KEY`、`GFW_API_KEY`、`WAQI_TOKEN`、`GDL_API_TOKEN` 已设置；只显示缺少的 Secret 名称，不会输出 Secret 内容。`FIRMS_MAP_KEY` 可选，因为已有 NASA 官方 keyless CSV fallback。

## 最终检查结果

- Python source/semantics/live API tests：15/15 通过。
- Data validation gate：29/29 通过。
- Frontend Vitest：43/43 通过。
- Vite Production build：成功。
- 资料覆盖：4 个主要 territory、131 个 district、987 条 district records。
- 当前 566 条 district fallback 的真实 last-success date 为 2026-07-10；在 45 天窗口内，页面可以继续显示，但会明确标示 stale。

## GitHub 必须设置的 Actions Secrets

进入 GitHub repository → **Settings** → **Secrets and variables** → **Actions**，确认以下名称存在：

- `BPS_API_KEY`
- `GFW_API_KEY`
- `WAQI_TOKEN`
- `GDL_API_TOKEN`
- `FIRMS_MAP_KEY`（可选，但有 key 时优先使用）

这些 backend/API secrets 不应上传到 DirectAdmin，也不应放进 ZIP 或 commit 到 GitHub。

## DirectAdmin 上传步骤

交付 ZIP：`borneo-tracker-directadmin-production-20260802.zip`

大小：1,764,746 bytes

SHA-256：`b912a3317372c4676681e75dc2418db9b42e0595715902186cc2560032996116`

1. 下载交付的 `borneo-tracker-directadmin-production-20260802.zip`。
2. DirectAdmin → File Manager → `domains/borneotracker.rentsmartprop.com.my/public_html`。
3. 先把目前的 `public_html` 内容 Archive 成一个备份 ZIP。
4. 保留备份 ZIP，但移除旧网站的 `assets`、`data`、`index.html`、`favicon.svg`、`icons.svg` 与 `.htaccess`，避免旧 hash 文件混用。
5. 上传新的 Production ZIP 到 `public_html`，然后 Extract。
6. 确认文件是直接位于 `public_html/index.html`，不是多包一层 `dist` 文件夹。
7. 确认 `.htaccess`、`assets/`、`data/`、`index.html` 都存在。
8. 打开网站并按 `Ctrl + F5` 强制刷新，再测试首页、地图、登入和重新载入 `/login`。

## 仍需 hosting 管理员处理

SSL certificate 必须覆盖 `borneotracker.rentsmartprop.com.my`。ZIP 和代码不能修复证书；在 SSL 完成前，浏览器仍可能显示 **Not secure**。

## 自动更新的重要说明

GitHub Actions 可以自动更新 repository 内的 JSON，但 DirectAdmin 目前是手动上传，因此 Production 不会自动取得 GitHub 的新 build。要全自动，还需要 hosting 管理员提供 SFTP/FTP host、port、username、upload path 和 password/SSH key，并另外建立安全的 deployment workflow。在这之前，重要 demo 前应重新 build 并上传最新 ZIP。
