# Staging / Production 上线前决策记录

**状态：** 尚未签核，不阻挡本地开发
**适用范围：** Login、Register、Email Verification、Password Reset、Session、Profile 及后续事务型功能
**最后更新：** 2026-07-13

## 1. 使用方式

这份文件是上线前的正式决策记录（ADR/checklist），不是当前已经确定的配置。

- 本地开发可以继续使用 Docker PostgreSQL 与 Mailpit。
- Staging 可以先采用免费服务，但必须接受休眠、容量和无 SLA 等限制。
- Production 发布前，本文所有 `待决定` 项目必须有明确选择、负责人、确认日期和验证证据。
- 免费方案若无法满足安全、恢复或可靠性门槛，应延后 Production，而不是降低门槛。
- 供应商密钥、数据库密码和恢复代码不得写入本文或提交 Git。

## 2. 当前建议摘要

| 项目 | 本地开发 | 免费 Staging 建议 | Production 前状态 |
|---|---|---|---|
| 网站与 API | `localhost`，Vite proxy `/api` | 单一 Render `onrender.com` 域名，前端与 API 同源 | 待决定 |
| 部署平台 | 本机 Node.js | Render Free Web Service | 待决定 |
| PostgreSQL | Docker PostgreSQL | Neon Free，选择靠近主要用户的区域 | 待决定 |
| 邮件 | Mailpit，不发送真实邮件 | Resend/Brevo 免费额度；必须验证 sender | 待决定 |
| 数据库备份 | Docker volume；开发资料不视为正式备份 | Provider 短期恢复 + 加密导出测试 | 待决定 |
| Secrets | 本机 `.env`，不得提交 | 平台环境变量 / GitHub Actions Secrets | 待决定 |
| 日志 | 本机脱敏日志 | 平台日志，禁止记录密码、Session、token 和敏感 PII | 待决定 |

免费 Staging 只是功能验收环境，不等于具备 Production SLA 的正式服务。

## 3. 决策一：正式网站与 API 域名

**状态：** 待决定
**建议：** 优先同源，例如网站和 API 都由 `https://example.com` 提供，API 使用 `/api/*`。这能减少 Cookie、CORS 与 CSRF 配置错误。

需要填写：

- 正式网站 URL：`待决定`
- 正式 API URL：`待决定`
- 是否同源：`待决定`
- DNS/域名负责人：`待指派`
- Cookie Domain、Secure、SameSite 最终值：`待决定`
- Staging URL：`待决定`
- 确认人/日期：`待填写`

上线证据：HTTPS 有效、HTTP 自动跳转 HTTPS、允许来源清单准确、Cookie 不跨越不必要的子域、验证/重置邮件链接只能指向批准域名。

## 4. 决策二：部署平台

**状态：** 待决定
**免费 Staging 建议：** Render Free Web Service 同时托管编译后的前端与 Express API。免费服务可能休眠和冷启动，不应当作高可靠 Production。

需要填写：

- 平台与方案：`待决定`
- 部署区域：`待决定`
- API 实例数量：`待决定`
- Email worker 运行方式：`待决定`
- Migration release job 运行方式：`待决定`
- 部署负责人：`待指派`
- 回滚负责人和步骤：`待指派/待记录`
- 确认人/日期：`待填写`

上线证据：CI build/test 通过、Staging smoke test 通过、单一 release job 执行 migration、健康检查可用、回滚演练成功、平台文件系统不用于保存用户数据。

## 5. 决策三：托管 PostgreSQL 与区域

**状态：** 待决定
**免费 Staging 建议：** Neon Free PostgreSQL。应用始终通过标准 `DATABASE_URL` 连接，避免业务代码绑定供应商。

需要填写：

- PostgreSQL 服务商/方案：`待决定`
- PostgreSQL major version：`待决定并固定`
- Primary region：`待决定`
- 数据驻留要求：`待法律/业务确认`
- 连接池方案和上限：`待决定`
- Migration credential owner：`待指派`
- Runtime credential owner：`待指派`
- 确认人/日期：`待填写`

选择区域时应优先考虑主要用户位置、部署平台区域、资料驻留要求和延迟；API 与数据库尽量位于相同或邻近区域。

上线证据：TLS 连接、最小权限账号分离、连接池压力测试、migration upgrade test、容量告警、数据库不可用时应用能安全失败。

## 6. 决策四：正式邮件服务与发件域名

**状态：** 待决定
**本地默认：** Mailpit
**免费 Staging 候选：** Resend 或 Brevo。免费额度和政策可能改变，确定时必须重新查阅官方条款。

需要填写：

- Email provider/方案：`待决定`
- 发件域名：`待决定`
- From address：`待决定`
- Reply-to address：`待决定`
- SPF owner/status：`待指派/待配置`
- DKIM owner/status：`待指派/待配置`
- DMARC owner/status：`待指派/待配置`
- Bounce/complaint 处理负责人：`待指派`
- API key 轮换负责人：`待指派`
- 确认人/日期：`待填写`

上线证据：域名验证通过、SPF/DKIM/DMARC 检查通过、验证与重置邮件送达测试通过、bounce/complaint 可见、邮件内容和 provider metadata 不泄漏原始 token。

## 7. 决策五：备份与数据库恢复

**状态：** 待决定
**原则：** Provider 宣称“有备份”不等于项目已经具备可恢复能力；必须实际恢复并验证资料。

需要填写：

- 目标 RPO（最多可丢失多久资料）：`待决定`
- 目标 RTO（多久内恢复服务）：`待决定`
- 自动备份频率：`待决定`
- 备份保留期限：`待决定`
- 备份存放区域/服务：`待决定`
- 备份加密与 key owner：`待指派`
- 数据库恢复负责人：`待指派`
- 替补恢复负责人：`待指派`
- 恢复演练频率：`待决定`
- 最近一次演练证据：`尚无`
- 确认人/日期：`待填写`

Production 阻断条件：没有明确 RPO/RTO、没有独立恢复负责人、或尚未完成一次从备份恢复到隔离数据库并验证登录资料一致性的演练。

## 8. 决策六：隐私资料与日志保留

**状态：** 待决定
**原则：** 只收集功能真正需要的资料，保留期限到期后删除或不可逆匿名化。

需要逐项确认：

| 资料 | 用途 | 建议起点（非最终政策） | 最终期限/动作 |
|---|---|---|---|
| Active user/profile | 提供账号功能 | 账号存在期间 | 待决定 |
| 已删除账号资料 | 法律/恢复缓冲 | 尽可能短；法律确认后决定 | 待决定 |
| Active session | 保持登录 | 到期或撤销后清除 | 待决定 |
| Verify/reset token record | 安全与一次性消费 | 到期后短期清理 | 待决定 |
| Auth audit event | 安全调查 | 先评估 90 天作为起点 | 待决定 |
| Application/access log | 故障与安全调查 | 先评估 30 天作为起点 | 待决定 |
| Email outbox payload | 邮件投递 | 成功后立即清空敏感 payload | 待决定 |
| Database backup | 灾难恢复 | 依 RPO/RTO 与隐私要求 | 待决定 |

必须决定：隐私政策负责人、资料访问/更正/导出/删除流程、用户请求处理时限、法律保留例外，以及备份中的删除资料如何随生命周期淘汰。

日志永久禁止：明文密码、完整 Session cookie、CSRF secret、验证/重置原始 token、邮件里的完整敏感链接、数据库密码、邮件 API key。IP、User-Agent、邮箱等资料必须先确认必要性、访问权限和保留期限。

## 9. 决策七：Production Secrets 所有权

**状态：** 待决定

需要填写：

- Production secrets 总负责人：`待指派`
- 替补负责人：`待指派`
- Database credentials owner：`待指派`
- Cookie/session secret owner：`待指派`
- CSRF/outbox encryption key owner：`待指派`
- Email API key owner：`待指派`
- GitHub/deployment access owner：`待指派`
- 紧急撤销与轮换负责人：`待指派`
- 定期轮换周期：`待决定`
- 人员离开项目时的撤权流程：`待记录`

控制要求：最小权限、Production 与 Staging 完全隔离、禁止通过聊天/邮件传递 secret、禁止提交 Git、关键账号启用 MFA、至少两位获授权人员能处理紧急恢复，但日常权限不应公开共享。

## 10. Production 发布签核表

以下项目全部完成后，才可批准 Production：

- [ ] 正式网站/API 域名与同源策略已确认。
- [ ] 部署平台、区域、worker、migration 和回滚流程已确认。
- [ ] PostgreSQL 服务、区域、版本、连接池和最小权限账号已确认。
- [ ] 邮件 provider、发件域名、SPF、DKIM、DMARC 已验证。
- [ ] RPO/RTO、备份频率、保留期限和恢复负责人已签核。
- [ ] 已完成并保存数据库恢复演练证据。
- [ ] 隐私资料清单、用途、删除流程及各类日志保留期限已签核。
- [ ] Production secrets owner、替补、MFA、轮换和撤权流程已确认。
- [ ] Staging 与 Production 的数据库、邮件、secrets 完全隔离。
- [ ] Auth 安全、集成、并发和 E2E 测试全部通过。
- [ ] 监控、告警、outbox dead-letter 和事件响应流程可用。
- [ ] 最终批准人、发布日期与回滚负责人已经记录。

## 11. 最终批准记录

| 角色 | 姓名 | 决定/签核范围 | 日期 |
|---|---|---|---|
| Project owner | 待指派 | 最终 Production go/no-go | 待填写 |
| Technical owner | 待指派 | 架构、部署、migration | 待填写 |
| Security/privacy owner | 待指派 | Secrets、隐私、日志 | 待填写 |
| Database recovery owner | 待指派 | 备份与恢复演练 | 待填写 |
| Email/domain owner | 待指派 | DNS、SPF、DKIM、DMARC | 待填写 |

相关实施基线：[AUTH_BACKEND_IMPLEMENTATION_PLAN.md](./AUTH_BACKEND_IMPLEMENTATION_PLAN.md)
