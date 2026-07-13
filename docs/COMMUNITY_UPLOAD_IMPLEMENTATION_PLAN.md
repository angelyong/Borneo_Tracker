# Borneo Tracker Community 功能实施计划

> **修订记录 (2026-07-13)：** 本版根据评审做了四处调整——
> ① 新增「删除自己发布的帖子（连同附件）」为本阶段能力；
> ② 砍掉后台 grace-period orphan reconciliation，只保留「操作当场」的 best-effort 清理（发帖失败回滚 + 删帖清附件），崩溃残留的 orphan 留给未来后端处理；
> ③ 组件（React Testing Library）测试降级为可选，完成标准以「纯函数校验 + service 一致性」自动化测试为准；
> ④ 修正两处与实际代码不符的表述：现有 `Modal`（`src/components/ui.jsx`）没有 Escape 关闭逻辑，只有 backdrop 与右上角关闭按钮会触发 `onClose`；以及 IndexedDB 可能被浏览器回收，「刷新后仍可用」不是永久保证。

## 1. 计划目的

本计划用于把当前已经存在的 Community 前端原型，完成为一个功能连贯、可验证的前端 Community Feed，并加入用户明确要求的 Upload 功能。

本阶段的主要目标是：

> 用户可以查看 Community 帖子，使用搜索与筛选，发布文字以及附件内容，删除自己发布的帖子，其他内容卡片可以显示图片、播放视频、提供文件下载，并继续支持点赞、评论与分享。

本阶段不是重新设计 Community，也不加入现有方案以外的社交功能。关注用户、收藏、通知、地图、推荐算法、管理员后台、Verification、无限层评论等均不在本计划实施范围。

## 2. 当前事实与实施边界

### 2.1 当前已经存在的功能

| 功能 | 当前实现位置 | 本阶段处理方式 | 目的 |
|---|---|---|---|
| Community 路由 | `src/App.jsx` | 保留 `/community` | 让用户可从固定网址进入页面 |
| 侧边栏入口 | `src/components/sidebar.jsx` | 保留 | 让 Community 与现有产品导航一致 |
| 帖子 Feed | `CommunityPage.jsx` | 保留并适配附件帖子 | 展示所有讨论内容 |
| Loading／Error／Empty 状态 | `CommunityPage.jsx` | 保留并补充上传错误 | 避免页面失败时没有反馈 |
| Start a discussion | `CommunityPage.jsx`、`NewPostForm.jsx` | 扩展表单 | 让用户发布文字与附件 |
| Title／Topic／Region／Details | `NewPostForm.jsx` | 保留 | 保持现有发布方案不变 |
| 搜索 | `CommunityFilters.jsx`、`communityUtils.js` | 保留 | 按关键词寻找内容 |
| Topic／Region 筛选 | `CommunityFilters.jsx` | 保留 | 缩小内容范围 |
| Read more | `PostCard.jsx` | 保留 | 控制长帖子的 Feed 高度 |
| 帖子点赞 | `communityService.js`、`PostCard.jsx` | 保留并回归测试 | 保持已有互动功能 |
| 评论与评论点赞 | `CommentThread.jsx`、`communityService.js` | 保留并回归测试 | 保持已有讨论功能 |
| Share link | `communityUtils.js`、`CommunityPage.jsx` | 保留 | 复制可定位到特定帖子的 URL |
| Mock seed posts | `mockCommunityPosts.js` | 保留并向后兼容 | 页面首次进入仍有示范内容 |
| 本地互动数据 | `communityService.js` | 本阶段继续使用 | 在没有后端时完成前端工作流 |

### 2.2 本阶段新增的产品能力

1. 选择或拖放附件。
2. 发布前预览附件。
3. 发布前移除附件。
4. 验证附件格式、数量与容量。
5. 图片在 Post Card 内显示。
6. 视频在 Post Card 内播放。
7. 文件显示名称、格式与大小。
8. 文件可以下载。
9. 页面刷新后，同一个浏览器中的附件仍然可用（前提是浏览器未回收本地存储，见 2.3）。
10. 附件读取失败时显示安全的 fallback，不破坏整张帖子。
11. 删除自己发布的帖子，并连同其附件一起清除（seed 示范帖为只读，不可删除）。

### 2.3 当前阶段的限制

当前项目没有真正的后端、共享数据库或真实身份系统。因此本阶段完成的是可操作的 frontend prototype：

- 同一浏览器可以发布、查看和下载自己的附件。
- 刷新页面后附件仍存在（前提是浏览器未回收本地存储，见下条）。
- 浏览器在存储压力下可能回收 IndexedDB（Safari 对脚本可写存储尤其激进），因此附件并非永久保证；v1 可调用 `navigator.storage.persist?.()` 尽力申请持久化，但不能承诺永不丢失。
- 只能删除本浏览器中自己创建的帖子；seed 示范帖为只读，不可删除。
- 不同电脑或不同用户无法共享这些本地附件。
- `CURRENT_USER` 仍然是现有的示范身份 `You`。
- 前端验证只用于用户体验，不能声称提供生产环境的病毒扫描或安全审核。

这个限制必须在开发文档中说明，不能把本地 prototype 描述成真正的多人 Community backend。

## 3. 完成后的用户流程

### 3.1 查看与寻找帖子

1. 用户通过侧边栏进入 `/community`。
2. 页面载入 seed posts 和本地创建的帖子。
3. 用户可以输入关键词。
4. 用户可以按 Topic 和 Region 筛选。
5. 结果数随着筛选结果更新。
6. 没有结果时显示现有的 no-results 状态，并允许 Clear filters。

### 3.2 发布文字帖子

1. 用户点击 **Start a discussion**。
2. 输入 Title、Topic、Region 和 Details。
3. 不选择附件也可以发布。
4. 发布成功后关闭 Modal，新帖子显示在 Feed 顶部。

### 3.3 发布附件帖子

1. 用户填写现有表单字段。
2. 使用 Browse 或 drag-and-drop 选择附件。
3. 前端立即验证类型、数量、单个容量和总容量。
4. 合法附件显示预览；不合法附件显示明确原因且不会进入待发布列表。
5. 用户可以逐一移除已选择附件。
6. 用户点击 **Post discussion**。
7. 系统先把附件 Blob 保存到 IndexedDB，再保存可序列化的帖子 metadata。
8. 两部分都成功后才关闭 Modal。
9. 如果任何一步失败，保留用户的文字和已选择内容，并显示可理解的错误。

本计划中的“发布前预览”定义为：图片显示缩略图；视频与文件显示类型、名称和容量。视频在发布后才使用播放器；第一版不包含发布前播放视频或 PDF 内容预览。

### 3.4 查看与下载附件

1. 图片在帖子正文下方以响应式 gallery 显示。
2. 视频使用浏览器原生 controls 播放，不自动带声音播放。
3. 文件以 attachment card 显示名称、格式和容量。
4. 点击 Download 后，从 IndexedDB 读取 Blob，并使用安全的显示文件名下载。
5. 如果附件已经不存在，显示 **Attachment unavailable**，其余帖子内容仍正常显示。

### 3.5 原有互动

附件帖子必须和文字帖子一样支持：

- Like／Unlike post。
- 展开和收起评论。
- Add comment。
- Like／Unlike comment。
- Read more／Show less。
- Share link。
- 从 `?post=<id>` 打开并定位到目标帖子。

### 3.6 删除自己的帖子

1. 用户只在自己创建的帖子上看到 **Delete** 操作（seed 示范帖不显示）。
2. 点击后弹出二次确认，避免误删。
3. 确认后，service 先从 overlay 移除该帖 metadata（成功即视为删除成功），再 best-effort 删除其全部附件 Blob。
4. Feed 立即刷新，被删帖子从列表消失。
5. 删除失败时保留帖子并显示可理解的错误，不留下「看起来删了但其实还在」的状态。

## 4. 上传规则

### 4.1 支持格式

| 类型 | 第一版允许格式 | 帖子内行为 |
|---|---|---|
| 图片 | JPEG、PNG、WebP | 预览缩略图；发布后显示 gallery |
| 视频 | MP4、WebM | 显示文件资料；发布后内嵌播放 |
| 文件 | PDF、DOCX、XLSX、CSV | 显示 file card；支持下载 |

禁止 HTML、SVG、ZIP、EXE、脚本和未识别格式。扩展名必须符合 allowlist，MIME type 也必须落在该扩展名允许的浏览器返回值集合中；必须为部分浏览器会对 CSV／Office 文件返回空 MIME 或通用 MIME 的情况制定明确兼容表，不能使用单一字符串硬编码，也不能只检查文件名。前端检查只负责拒绝明显错误，不能替代未来后端的文件签名检查和恶意文件扫描。

### 4.2 数量与容量

- 每个帖子最多 10 个附件。
- 每个帖子最多 10 张图片。
- 每个帖子最多 1 个视频。
- 每张图片最大 8 MB。
- 每个视频最大 50 MB。
- 每个文件最大 15 MB。
- 每个帖子附件总容量最大 75 MB。
- 0-byte 文件不允许上传。
- Title 和 Details 继续为必填，附件为选填。

所有规则集中放在一个 config 文件中，UI 和 service 不得各自复制常数。

## 5. 数据设计

### 5.1 Post shape

现有 post 新增 `attachments`，旧帖子和 seed posts 在读取时统一补成空数组。

```js
{
  id: 'post-...',
  author: 'You',
  title: '...',
  body: '...',
  topic: 'Environment',
  territory: 'Sabah',
  createdAt: '2026-07-12T00:00:00.000Z',
  likeCount: 0,
  comments: [],
  attachments: []
}
```

删除权限不在 post shape 上加字段：帖子可删 ⇔ 它存在于 overlay（用户创建），seed 帖恒不可删。`getPosts`／`hydratePost` 为 overlay 来源的帖子标记一个派生标志（如 `canDelete: true`），让 UI 直接依据它显示 Delete，而不是靠 `author` 字符串去猜归属。

### 5.2 Attachment metadata

```js
{
  id: 'attachment-...',
  postId: 'post-...',
  kind: 'image' | 'video' | 'document',
  name: 'river-report.pdf',
  mimeType: 'application/pdf',
  size: 2451000,
  storageKey: 'community-attachment-...',
  createdAt: '2026-07-12T00:00:00.000Z'
}
```

规则：

- `File`、`Blob` 和 `blob:` URL 不写入 localStorage。
- `blob:` URL 只在显示或下载时临时产生，因为页面刷新后旧 URL 会失效。
- 原始文件名只用于 UI 和 download attribute，不作为 IndexedDB key。
- `id` 与 `storageKey` 使用独立生成的稳定 ID，避免重名覆盖。
- Post ID、attachment ID 与 storageKey 优先使用 `crypto.randomUUID()`；不支持时使用含随机部分的兼容 fallback，不能只使用 `Date.now()`，避免快速连续发布或多标签页碰撞。

## 6. 储存方案与原因

### 6.1 Metadata

继续使用现有 `communityService.js` 的 localStorage overlay 保存：

- 用户创建的帖子 metadata。
- Post likes。
- Comments。
- Comment likes。
- Attachment metadata。

目的：保持当前架构，避免为了一个 frontend prototype 重写全部 Community service。

### 6.2 Attachment Blob

使用 IndexedDB 保存：

- 图片 Blob。
- 视频 Blob。
- 文件 Blob。

IndexedDB 保存完整 record：

```js
{
  storageKey: 'community-attachment-...',
  blob: FileOrBlob,
  createdAt: '2026-07-12T00:00:00.000Z'
}
```

`getAttachment(storageKey)` 对 UI 返回 Blob；`listAttachmentRecords()` 返回包含 `storageKey` 与 `createdAt` 的维护资料。

目的：localStorage 容量小且只能可靠储存字符串，不适合媒体文件；IndexedDB 可以异步保存 Blob，并让同一浏览器刷新后继续读取。

### 6.3 一致性与恢复要求

- 附件全部保存成功后，才尝试写入帖子 metadata。
- 当前 `saveOverlay()` 会吞掉 localStorage 写入异常，必须增加 strict write path，让 `createPost` 可以知道 quota／serialization 写入是否失败；现有 likes/comments 如需保留静默降级，可以继续使用非 strict wrapper。
- 如果第 N 个附件失败，best-effort 删除该次已经保存的前 N-1 个附件。
- 如果附件成功但帖子 metadata 保存失败，best-effort 回滚本次所有新附件。
- 删除帖子时，先从 overlay 移除 metadata（成功即视为删除成功），再 best-effort 删除其附件 Blob；附件删除失败只记录诊断，不回滚帖子删除。
- 不允许发布引用不存在 storageKey 的帖子。
- 旧帖读取失败或 attachment 字段缺失时，normalize 为 `attachments: []`。
- `createPost` 不可在上传开始前读取 overlay，并在上传结束后把旧副本写回。附件保存完成后必须重新读取最新 overlay，只合并新 post 再 strict save；否则会覆盖上传期间刚发生的 Like／Comment。
- **关于 orphan Blob（本版决定）：** localStorage 与 IndexedDB 无法形成跨储存的真正原子事务，浏览器若在两次写入之间崩溃，仍可能留下没有帖子引用的 orphan Blob。本阶段**不实现**后台 grace-period reconciliation——它为对付一个单用户下近乎理论的边界情况，却引入「误删正在使用的附件」这一更严重的风险和一大堆计时/边界逻辑，投入产出不成正比。v1 只做「操作当场」的 best-effort 清理（发帖失败回滚、删帖清附件）；崩溃残留的 orphan 至多占用用户本机少量配额，可接受，并留待未来后端以服务端定时任务统一清理（见 §13）。
- **已知并发局限（本版记录）：** 「上传后重新读取 overlay 再合并」只是对发帖路径的针对性缓解。事实上整个 service 的 like／comment 都是 `loadOverlay → 改 → saveOverlay` 的 read-modify-write，同类丢更新问题在单用户下极少发生，本阶段一并接受、不做全局加锁。

## 7. 文件级实施方案

### 7.1 新增 `src/pages/community/communityUploadConfig.js`

做什么：

- 定义允许的 MIME 与扩展名。
- 定义单文件、总容量和数量上限。
- 提供 `kindForFile(file)`。
- 提供 `validateAttachments(existingFiles, newFiles)`。
- 提供统一的人类可读错误信息。
- 提供 `formatFileSize(bytes)`。

目的：把业务规则集中在一个地方，防止表单、service 和 renderer 规则不一致。

### 7.2 新增 `src/services/communityAttachmentStore.js`

做什么：

- 建立 IndexedDB database，例如 `borneo-tracker-community`。
- 建立 `attachments` object store，以 `storageKey` 为 key。
- 实现：
- `saveAttachment({ storageKey, blob, createdAt })`
- `getAttachment(storageKey)`
- `deleteAttachment(storageKey)`
- `deleteAttachments(storageKeys)`（删帖与失败回滚都用它）
- `listAttachmentRecords()`（可选，仅未来 reconciliation 需要；v1 不依赖，可暂不实现）
- 统一转换 IndexedDB request／transaction error 为 Promise rejection。
- 对不支持 IndexedDB、权限拒绝和 quota exceeded 返回可识别错误。
- 初始化时尽力调用 `navigator.storage.persist?.()` 申请持久化存储，降低被浏览器回收的概率（失败不阻断功能）。

目的：UI 不直接操作浏览器数据库；未来接后端时只需要替换储存适配层。

### 7.3 新增 `src/pages/community/AttachmentPicker.jsx`

做什么：

- 提供隐藏 `<input type="file" multiple>`。
- 提供 Browse 按钮。
- 提供 drag-enter、drag-over、drag-leave、drop 状态。
- 设置 input `accept`，但仍执行代码验证。
- 显示选中文件列表。
- 图片显示临时 thumbnail。
- 视频与文件显示 type、name、size。
- 每个附件有 Remove 按钮。
- 组件卸载时 revoke 预览 object URLs。
- 把合法 `File[]` 交给 `NewPostForm` 管理。

目的：完成用户看得见、可理解、可撤销的 Upload 操作。

### 7.4 修改 `src/pages/community/NewPostForm.jsx`

做什么：

- 在现有 `EMPTY_FORM` 之外加入 `attachments` state。
- 在 Details 下方渲染 `AttachmentPicker`。
- `canSubmit` 同时检查必填文字、当前没有验证错误、没有提交中。
- `onSubmit` 传递 `{ title, body, topic, territory, attachments }`。
- 提交中锁定重复发布。
- 发布失败时不能 reset form 或关闭 Modal。
- 明确组件契约：`onSubmit(form)` 返回 Promise；`NewPostForm` 接收 `submitError`，在表单内以 live region 显示；用户重新提交或修改附件时按规则清除旧错误。

目的：不改变现有发布字段，只增加可选附件。

### 7.5 修改 `src/pages/community/CommunityPage.jsx`

做什么：

- `handleCreatePost` 把完整 form 交给 service。
- 捕获 create/upload failure。
- 保持 composer open，并在 Modal 内显示错误。
- 维护 `submitError` state 并传给 `NewPostForm`。
- `submittingPost` 为 true 时，backdrop 与关闭按钮不得关闭 composer。**注意现有 `Modal`（`src/components/ui.jsx`）并没有 Escape 关闭逻辑，只有 backdrop mousedown 与右上角关闭按钮会触发 `onClose`**，因此只需新增一个默认不影响其他页面的 `disableClose` prop 去拦截这两者，不要为「拦截 Escape」写一段并不存在的行为。
- 新增 `handleDeletePost(postId)`：弹二次确认 → 调 `deletePost` → 成功后 `refresh()`；失败用现有 toast/错误提示，且不从列表移除该帖。
- 把 `onDelete` 传给可删除的 `PostCard`（依 `post.canDelete`）。
- 成功后调用现有 `refresh()`。
- 避免 `showToast` 的 timeout 在页面卸载后继续更新 state。
- Like、Comment 和 Share handler 的行为保持不变。

目的：由页面协调 UI 状态，但不在页面组件中实现文件储存细节。

### 7.6 修改 `src/services/communityService.js`

做什么：

- 把 `createPost` 改为接收 attachments。
- 在开始储存前生成 post ID 和 attachment IDs。
- IDs 使用 `crypto.randomUUID()` 与兼容 fallback，不沿用只靠 `Date.now()` 的方案。
- 调用 attachment store 保存每一个 Blob。
- 只把 metadata 写进 overlay。
- 实现失败 rollback。
- 增加可抛出写入错误的 strict metadata save；不能继续依赖当前会吞异常的 `saveOverlay()` 来判断成功。
- 附件保存后重新读取最新 overlay 再合并新 post，避免覆盖同时发生的 Like／Comment。
- 新增 `deletePost(postId)`：仅允许删除 overlay 中的用户帖子（引用 seed 帖时拒绝并抛错）；先移除 overlay 中的 metadata，再 best-effort 删除其附件 Blob，附件删除失败不回滚帖子删除。
- `getPosts`／`hydratePost` 为 overlay 来源的帖子标记 `canDelete` 派生标志，供 UI 判断是否显示 Delete。
- `hydratePost` 对所有帖子补上 `attachments: []`。
- `loadOverlay` 对损坏或旧版本结构安全降级。
- 保持现有 `getPosts`、likes、comments API 兼容。
- 本阶段不实现后台 reconciliation（见 §6.3）。

目的：保持 CommunityPage 使用单一 service API，并确保 metadata 与 Blob 不出现半完成状态。

### 7.7 新增 `src/pages/community/PostAttachments.jsx`

做什么：

- 接收 `postId`、`postTitle` 和 attachment metadata。
- 从 attachment store 异步读取 Blob。
- 为 image/video 建立临时 object URL。
- 图片使用响应式 grid。
- 视频使用 `<video controls preload="metadata">`。
- 文件显示 name、extension、formatted size。
- Download 使用 Blob URL 和安全 display name。
- 下载名称移除路径分隔符、控制字符和异常保留字符；不能直接信任原始名称执行路径行为。
- 下载文件名需要移除路径分隔符、控制字符和会造成异常的保留字符；UI 可以保留可读名称，但不能直接信任原始名称执行路径行为。
- 缺失或读取失败显示单项 fallback。
- 卸载或附件变化时 revoke URLs。

目的：附件展示逻辑不塞进已经负责帖子互动的 `PostCard`。

### 7.8 修改 `src/pages/community/PostCard.jsx`

做什么：

- 在正文与 action row 之间加入 `PostAttachments`。
- 无附件时不产生额外空白。
- 保持 Like、Comment、Share 和 Read more 的 DOM 行为。
- 确保长文件名不撑破卡片。
- `post.canDelete` 为 true 时显示 **Delete** 操作，点击经二次确认后触发 `onDelete`；seed 帖不显示。
- Delete 控件需有可被 screen reader 识别的 accessible name（含帖子标题）。

目的：让所有帖子保持统一卡片结构，同时控制组件职责。

### 7.9 保持不改或只做必要兼容的文件

- `CommentThread.jsx`：不新增 nested reply 或附件评论，只做回归验证。
- `CommunityFilters.jsx`：不新增 filter，只验证附件帖子仍能搜索和筛选。
- `communityUtils.js`：保持时间、搜索、分享逻辑；只有通用 filename helper 确实适合时才增加。
- `mockCommunityPosts.js`：不强制修改所有 seed 数据；由 normalize 处理缺少 attachments 的旧 shape。
- `App.jsx`、`sidebar.jsx`：路由已经存在，不需要改变。

## 8. 错误处理标准

每一个错误必须告诉用户：哪个文件失败、为什么失败、可以怎样处理。

必须覆盖：

- 不支持的文件格式。
- 扩展名与 MIME 不符合 allowlist。
- 0-byte 文件。
- 单个文件太大。
- 附件总容量太大。
- 附件数量太多。
- 超过一个视频。
- 浏览器不支持 IndexedDB。
- 浏览器拒绝储存。
- 浏览器 quota exceeded。
- IndexedDB transaction 失败。
- Post metadata 写入失败。
- 删除帖子时 metadata 写入失败（保留帖子并报错，不留下「已消失但其实还在」的假象）。
- 已发布附件后来找不到。

失败行为：

- 不关闭 composer。
- 不清空用户输入。
- 不留下显示为空的帖子。
- 尽可能删除本次产生的 orphan blobs。
- Feed 中单个坏附件不能导致整个 Feed crash。

## 9. UI、响应式与 Accessibility

- Drag-and-drop 不是唯一上传方法，键盘用户必须可使用 Browse。
- Drop zone 有明确 label、focus style 和错误状态。
- Remove 按钮的 accessible name 包含文件名。
- 图片 alt 第一版使用 `帖子标题 + image 序号`。
- 视频不 autoplay with sound，并提供原生 controls。
- 文件类型与容量使用文字显示，不能只依赖 icon 或颜色。
- 手机宽度下上传列表、gallery 和 file card 不产生水平滚动。
- 长文件名 wrap 或 ellipsis，并保留完整 title tooltip。
- 提交状态使用文字，例如 **Publishing…**，不能只显示 spinner。
- 错误信息使用可被 screen reader 感知的 live region。

## 10. 测试基础与自动化

当前 `package.json` 没有 test script。本计划的**必需**测试基础（完成标准以此为准）：

- Vitest。
- fake-indexeddb（稳定测试 IndexedDB service；不要依赖测试环境真实浏览器数据库）。
- `npm run test` script。

**可选**（仅当要做组件交互测试时才装）：jsdom + React Testing Library。§10.3 的组件测试本版降级为可选、不进入完成标准——原因是它最贵写、最脆（UI 一改就红），而这是快速迭代的原型 UI；同样的信心用 §10.1 纯函数测试 + §10.2 service 测试即可拿到，回报率更高。§10.4 手动验收清单继续作为 UI 层的验证手段。

### 10.1 单元测试

- MIME／extension allowlist。
- `kindForFile`。
- 0-byte rejection。
- 每类容量限制。
- 总容量限制。
- 总数量限制。
- 单视频限制。
- `formatFileSize`。
- 旧 post normalize 为 `attachments: []`。
- attachment metadata 不包含 Blob 或 object URL。
- 搜索函数仍能匹配现有 title/body/topic/territory/author。

### 10.2 Service 测试

- 成功保存多个 attachments 后才保存 post。
- 第 N 个附件失败时 rollback 前 N-1 个。
- metadata save 失败时 rollback 全部新附件。
- strict metadata save 必须向 `createPost` 抛出 quota／serialization error。
- attachment store failure 不产生 post。
- 上传期间发生的 Like／Comment 不会被 `createPost` 的旧 overlay 覆盖。
- `deletePost` 从 overlay 移除用户帖并 best-effort 删除其附件 Blob。
- `deletePost` 拒绝删除 seed 帖，且不影响其他帖子与既有 likes/comments。
- 删附件 Blob 失败时，帖子仍被视为删除成功（不回滚删除）。
- 旧 localStorage overlay 可以继续读取。
- likes、comments、comment likes 不受 attachments 影响。

### 10.3 Component 测试（可选，不进入完成标准）

- Browse 选择文件。
- Drag-and-drop 文件。
- 非法文件显示错误。
- Remove selected attachment。
- 提交中防止 double submit。
- 发布失败后 form 内容仍存在。
- `submitError` 正确显示和清除，失败后 title、body 与 attachments 都仍存在。
- submitting 时 backdrop 与关闭按钮不能关闭 Modal（现有 Modal 无 Escape 逻辑，无需测 Escape）。
- 有 attachment 的 PostCard 正确渲染。
- missing attachment 显示 fallback。
- Download action 使用正确文件名。
- 可删除帖子显示 Delete、seed 帖不显示；确认后触发 `onDelete`。

### 10.4 手动验收

1. 发布纯文字帖子。
2. 发布单图片帖子。
3. 发布多图片帖子。
4. 发布单视频帖子。
5. 发布 PDF、DOCX、XLSX、CSV。
6. 发布混合图片、视频和文件帖子。
7. 刷新浏览器后重新查看所有附件。
8. 下载每一种允许文件。
9. 尝试超大文件、未知格式、第二个视频和超量附件。
10. 在手机宽度检查 composer、gallery、video 和 download card。
11. 全程只用键盘完成发帖。
12. 检查 Like、Comment、Share、Read more、Search 和 Filters。
13. 使用 shared URL 打开 attachment post 并正确定位。
14. 手动删除 IndexedDB attachment，确认 fallback 正常。
15. 清除 localStorage 后确认 seed posts 仍正常。
16. 删除自己发布的附件帖，确认帖子消失、附件同时清除，且 seed 帖没有 Delete 按钮。

## 11. 实施阶段与依赖顺序

### Phase 0：基线与测试准备

目的：确保后续可以判断是否破坏现有功能。

- [ ] 记录现有 Community 主要用户流程。
- [ ] 加入 test runner（Vitest + fake-indexeddb）和 `npm run test`；RTL/jsdom 可选，仅做组件测试时才加。
- [ ] 为 `communityUtils` 和 `communityService` 现有行为补 baseline tests。
- [ ] 确认 lint 状态。
- [ ] 修复当前环境的 production build dependency 问题后记录基线 build。

完成条件：现有文字帖子、搜索、筛选、点赞、评论、分享有可重复验证的基线。

### Phase 1：Upload 规则与 IndexedDB foundation

目的：先建立稳定数据层，避免 UI 完成后才发现文件无法可靠保存。

- [ ] 新增 `communityUploadConfig.js`。
- [ ] 编写 validation tests。
- [ ] 新增 `communityAttachmentStore.js`。
- [ ] 测试 save、get、delete、bulk delete 和失败情况。
- [ ] 固定 IndexedDB record shape 为 `{ storageKey, blob, createdAt }`。
- [ ] 初始化时尽力 `navigator.storage.persist?.()` 申请持久化。
- [ ] 在 `communityService.js` 加 post normalization。

完成条件：允许文件可以保存、读取、删除；非法文件在写入前被拒绝；旧帖子仍可读取。

### Phase 2：发布前 Upload UI

目的：让用户可以清楚选择、检查和撤销附件。

- [ ] 新增 `AttachmentPicker.jsx`。
- [ ] 实现 Browse 与 drag-and-drop。
- [ ] 实现图片 preview、文件资料和 Remove。
- [ ] 明确第一版 preview：图片缩略图；视频和文件显示 metadata，不含发布前视频播放或 PDF 内容预览。
- [ ] 实现 inline validation feedback。
- [ ] 接入 `NewPostForm.jsx`。
- [ ] 完成键盘和手机布局。

完成条件：用户可以在不发布的情况下完整管理待上传附件，所有规则在 UI 中可见。

### Phase 3：Create Post 与一致性

目的：把附件和帖子作为一个完整操作发布，避免 broken post 或 orphan file。

- [ ] 扩展 `createPost` input。
- [ ] 生成 post／attachment IDs。
- [ ] 保存 IndexedDB blobs。
- [ ] 写入 serializable metadata。
- [ ] 实现 rollback。
- [ ] 实现 strict metadata save，使 localStorage 写入失败可被 create flow 捕获。
- [ ] 附件保存后重新读取最新 overlay 再合并帖子，并测试不会覆盖并发 Like／Comment。
- [ ] 实现 `deletePost`（仅用户帖，先删 metadata 再 best-effort 删附件）+ `CommunityPage` 的删除确认与刷新。
- [ ] 接通 `submitError` state/prop，并在 submitting 时阻止 Modal dismiss。
- [ ] 在 `CommunityPage.jsx` 显示 submitting／failure 状态。
- [ ] 成功后刷新 Feed 并关闭 Modal。

完成条件：只有 metadata 与所有 Blob 都成功时帖子才出现；失败时用户资料和表单内容不丢失。

### Phase 4：Post 内显示与下载

目的：完成“其他内容卡片能够观看和下载上传资料”的前端体验。

- [ ] 新增 `PostAttachments.jsx`。
- [ ] 实现 image gallery。
- [ ] 实现 video player。
- [ ] 实现 document card。
- [ ] 实现 download。
- [ ] 实现 object URL lifecycle cleanup。
- [ ] 实现 unavailable fallback。
- [ ] 接入 `PostCard.jsx`。

完成条件：所有允许类型都能正确显示或下载，刷新后仍有效，单个缺失附件不会破坏帖子。

### Phase 5：完整回归与交付

目的：确认新增 Upload 没有破坏当前方案已有 features。

- [ ] 执行所有自动化测试。
- [ ] 执行完整手动验收清单。
- [ ] 执行 `npm run lint`。
- [ ] 执行 `npm run test`。
- [ ] 执行 `npm run build`。
- [ ] 检查手机和桌面布局。
- [ ] 更新 README，注明 prototype storage limitation。

完成条件：测试、lint、build 全部通过，现有功能与 Upload 用户流程全部通过验收。

## 12. 不应采用的实现方式

- 不把 File 或 base64 文件直接放入 localStorage。
- 不长期保存 `blob:` URL。
- 不让 React UI 组件直接散落 IndexedDB 操作。
- 不只依赖 input `accept` 作为 validation。
- 不在附件未保存完成前先发布帖子。
- 不因一个附件读取失败而让整个 Community 页面报错。
- 不把 frontend validation 宣称为病毒扫描或生产安全。
- 不在本次工作顺便加入未确认的社交 features。

## 13. 未来 Backend 替换界面

本阶段组件应依赖 attachment service，而不是依赖 IndexedDB 实现细节。未来多人版本可以保持 UI 和 attachment metadata 大致不变，只替换 service：

1. Frontend 向 backend 请求受授权的 upload URL。
2. Frontend 上传到 object storage。
3. Backend 验证、扫描并保存 attachment record。
4. Backend 返回 attachment ID。
5. Frontend 使用 attachment IDs 创建帖子。
6. 查看／下载时 backend 返回有权限和期限的 URL。

未来 production 阶段必须另外处理：真实登录、权限、共享数据库、恶意文件扫描、内容审核、隐私、删除政策和储存费用。这些不是本次 frontend plan 的完成条件。此外，本阶段砍掉的 orphan Blob 清理属于后端的服务端定时任务（扫描无引用的 storage key 再删）——放在这一层与这个时机才正确。

> **可选产品方向（非本阶段范围）：** 若要让 Community 真正长在本产品上，可把「附件」定位为**田野证据**而非泛社交文件——利用帖子已有的 `territory` 给带图帖子挂上地点，让它们在 Overview 地图上作为公民实地上报（森林砍伐、水灾、野生动物）浮现，并回流到数据层。这只是方向记录，是否采用由产品决定。

## 14. Definition of Done

只有以下条件全部满足，本计划才算完成：

- [ ] 当前 Community 路由和侧边栏入口正常。
- [ ] Feed、Loading、Error、Empty 状态正常。
- [ ] Search、Topic filter、Region filter 正常。
- [ ] 纯文字帖子可以发布。
- [ ] 图片、视频、PDF、DOCX、XLSX、CSV 可以选择与验证。
- [ ] 发布前可以预览和移除附件。
- [ ] 图片可以显示，视频可以播放，文件可以下载。
- [ ] 在浏览器未回收本地存储的前提下，同一浏览器刷新后附件仍可用。
- [ ] Like、Comment、Comment Like、Share、Read more 正常。
- [ ] 可以删除自己发布的帖子，附件一并清除；seed 帖不可删。
- [ ] 非法文件不会被保存。
- [ ] 失败不会产生 broken post；一般失败会 best-effort rollback（发帖失败回滚、删帖清附件）。浏览器崩溃残留的 orphan blob 本阶段不做后台清理，属于已知可接受局限。
- [ ] 缺失附件有 fallback。
- [ ] Desktop、mobile 和 keyboard flow 可用。
- [ ] 必需自动化测试（纯函数校验 + service 一致性）通过；组件测试为可选。
- [ ] Lint 通过。
- [ ] Production build 通过。
- [ ] README 清楚标明 frontend-only、same-browser，以及「存储可能被浏览器回收」的 limitation。
