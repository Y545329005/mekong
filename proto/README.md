# GPU 算力市场原型 · P2P 撮合版 Demo

单文件交互原型（React18 UMD + Babel standalone + Tailwind Play CDN，零构建）。
对应《Vast.ai产品结构手册_v0.1》的 L2 页面卡片、L4-1 实例状态机、L3 下单/余额流程；
并按 2026-09-02 MVP 裁决（P2P 轻资产先行）加入「信任/合规三件套 + 市场三源供给 + 资金托管」。

> 前身《Vast.ai 复刻原型 · 租户漏斗 Demo》：品牌已去 Vast 化，见历史提交。

> **账户模型口径（2026-09-03 裁决）**：我方产品为「单登录账号 + 双主体」——登录层统一，宿主/租户角色、账本、凭据按主体分立。vast.ai 本体为硬性双独立账号制【R1-docs】；原型系 vast 复刻，仅账户模型按我方裁决覆盖，差异与依据见《产品结构手册》§230。角色门与自成交标注为推断设计【MK】；「自家报价」标签按 source 近似（演示单用户），真实反自成交需 identity graph（PRD 层）。

## Admin 演示原型（2026-09-14 · admin.html）

同目录 `admin.html`（同 8787/8788 静态服务）——**同源联动**的后台演示：与对客端共享 `gpu-market-demo-v1` localStorage，老板演示叙事「租客下单 → 后台实时看见 → 后台干预 → 用户端实时生效」。

- **页面**：大盘（8 卡+实时流水）/ 市场管理（三源 Offer 上下架+宿主审核队列）/ 实例运维（强制停机/销毁）/ 资金对账（双边对账+抽成滑杆 0–20% 默认 0%+**出金审批**）/ 用户与合规（封禁+**end-use 留痕表**）/ 演示数据（生成器+快照还原）/ 操作审计（全操作留痕 200 条）。
- **出金审批闭环（2026-09-15，2026-09-20 提现页并入收益页）**：用户端收益页可提现卡「**提现**」打开提现弹窗（金额+通道+实到预估一次确认）改为**申请制**——申请入 `payoutReqs` 随 dumpState 落盘（同账号同时仅一笔 pending，pending 期间入口禁用显示「审核中」）→ Admin「资金对账·出金审批」实时看见 → 批准/驳回写 `cfg.payouts={approved:[],rejected:[]}`（**Admin 审批账本以快照为准**，用户端清空不影响累计出金口径）→ 用户端 `applyAdminCfg` 按 id 匹配：approved 即扣 `hostEarnings`（paid/status 标记持久化，重复广播与刷新重放均幂等不重复扣）、rejected 仅置态钱不动。无 Admin 在线时申请保持 pending（引导双开演示）。出金不产生 ledger 流水，对账表保持租客↔宿主入账口径；出金记录与收益明细同卡片双分块（钱从哪来/到哪去）。
- **end-use 留痕（2026-09-15 · R4 缩窄）**：注册流 `_finishAuth` 新增 trail 参数——邮箱注册逐项采集四项勾选，OAuth 首登如实标注「未逐项收集」；trail 结构 `{t, v:"2026-09-02", checks, email, via}` 随 store 持久化，登录路径不覆盖。Admin「用户与合规」kyc 卡升级为留痕表（邮箱/确认时间/协议版本/四项勾选/通道）；legacy 存档如实显示「无留痕」，不回填虚构数据。受限方名单实时筛查仍属正式版。
- **写权分离（对抗审查坑 3）**：Admin 只写配置键 `gpu-market-admin-v1`（下架/封禁/抽成/停机 id/快照/审计），用户端只读该键并在自身内执行动作——避免与用户端 1s dumpState 的双写竞态。一次性指令（停机/销毁/注入）经 `BroadcastChannel("gpu-market-admin-v1")` 下发，用户端**挂载时也重放配置类干预**（刷新后停机/封禁仍生效，幂等：停机仅对非 Inactive 执行）。
- **抽成分流**：tick hostEarn 钩子按配置键 commission 分流——流水条目记 `rate` 快照（宿主 (1−r)、平台 r，Admin 端 Σ 精确对账）；r=0 与 1:1 基线完全一致（不破坏已验收链路）。分段记账：切抽成只影响新增消费，对账面板按 rate 分段标注。
- **注入器 ping/pong**：Admin 注入前探测用户端在线（150ms pong），在线走消息由用户端自行合并；离线（单开 Admin）由 Admin 读-改-写直写对客键。注入前自动快照对客两键入配置键，可一键还原（还原后广播 reload）。
- **走查实证（127.0.0.1:8788，内嵌浏览器单 tab + cache-bust）**：注入→大盘/对账联动 ✓；下架 4090→用户端搜索 0 台→恢复→1 台 ✓；强制停机→刷新后 Inactive（配置恢复路径）✓；封禁 alice→登出+登录被拦（「该账号已被封禁」）→解封→登录成功 ✓；抽成 10% 下租用 4090→新增流水 rate=10%、旧流水 rate=0%、守恒 ±0.01 ✓；EN 全页无缺键 ✓；console 全程 0 errors ✓。
- **出金闭环走查实证（2026-09-15）**：绑 payout（Wise）→提现→按钮「审核中」+ Admin 待审表实时出现（邮箱/通道/金额/时间）→批准→用户端 hostEarnings −$20、按钮恢复、**刷新重放不重复扣** ✓；二次提现→驳回→余额不动、按钮恢复 ✓；审计留痕「出金批准/驳回 · alice@demo.dev · $20」✓；新注册 eu-trail@demo.dev→留痕行（时间/版本 2026-09-02/✓✓✓✓/email）✓。同轮修复存量隐患：Admin 注入机 m-hx-009 缺 ListWizard 字段（net/sto 等）致切宿主视角渲染崩溃——GEN_PAYLOAD 补齐字段 + HostMachines 数值渲染 `(+m.x||0).toFixed()` 防御。
- **演示动线提示**：真实双 tab（用户端+Admin 各一）可获得「实时亮灯」效果；内嵌浏览器单 tab 下依赖挂载重放。演示前可「清空重来」+ 重新注入造现场；「还原快照」可回滚注入。

## 运行

```bash
cd proto && python3 -m http.server 8787
# 打开 http://localhost:8787/
```

或任意静态服务器。需要联网加载 CDN（React/Babel/Tailwind）。

## 市场供给三源（P2P 撮合闭环）

市场由三类供给拼接，卡片以 source 标签区分：

| source | 来源 | 卡片标签 | 特征 |
|---|---|---|---|
| `offer` | 静态 vast API 采样（平台实测已验证） | **已验证** | 完整规格字段，reliability/多快照齐备 |
| `seed` | 平台首发池（自购/签约，m-my-001 / m-sg-002） | **首发池** | 平台实测规格（DLPerf/DLP$·hr/TFLOPS/CUDA 齐备）、可靠性 100%、地点 KUL·MY / SIN·SG；不标"宿主上架" |
| `host` | 第三方宿主上架（ListWizard · **Agent 模式 2026-09-16 重构**） | **宿主上架** | 实名（账号级 KYC 一次）+押金约束标注；**硬件参数=Agent 唯一事实源**（安装 token 绑定宿主账号 → Agent 联网注册自动采集，宿主不可编辑）→ **平台实测为上架前置（阻塞式）**：实测通过后 DLPerf/DLP$·hr/TFLOPS/CUDA 显示**实测值**，可靠性仍「—」（实测≠履约，待首单积累）；最长租期由合同 endDate 推剩余天数（无则「—」） |

**报价卡字段（2026-09-16 对齐 Vast 搜索卡）**：五列式对齐——① GPU（型号/×N/架构徽标 Blackwell·Hopper·Ada/TFLOPS·Max CUDA/显存/带宽·PCIe·NVLink）② CPU·内存·磁盘（背景规格弱化）③ 网络 ④ DLPerf·可靠性（DLPerf + DLP/$/hr 性价比 + 可靠性 + 最长租期）⑤ 价格 + 分解 tooltip + RENT；底部仅剩来源标签 + 地理位置（host-id 小字与多卡总 VRAM 换算已删）。**视觉层级产品化（同轮）**：列头桌面端隐藏（移动端折行保留）、DLP/$/hr 性价比与可靠性命中视觉升档、CPU 规格整列降灰、RENT 44px 全宽触达——字段与结构仍对齐 Vast，仅内部权重按租户决策链路分层。排序「DLPERF ↓」对无实测值机器 null 沉底（**2026-09-16 后宿主上架机经阻塞式实测必有 DLPerf，正常参与排序不再沉底**；仅 Admin 注入机等无实测值存档仍沉底）。

## 信任 / 合规三件套（MVP P2P）

- **账号级一次性门（2026-09-11 重构）**：end-use 出口管制声明**已前置到注册流最后一步**（AuthPage step2，四项勾选全选才可创建账号），下单路径零打断——`openRent` 门序 = authed → template → credits → confirm。（内测邀请门同日按产品决策移除；2026-09-16 MVP 裁剪确认白名单整体删除——注册零名单拦截，Admin 白名单卡与拦截校验同步移除）→ **宿主角色门**（首次切宿主视角弹 hosting agreement 确认；「稍后」停留租户视角——门挡 Machines 页入口，ListWizard 唯一入口在其内，上架强制自动成立），均**只弹一次、账号级放行**，切换租户/宿主视角不重复校验。
- **租客侧**：资金托管（escrow，下单预留冻结、消费/停止/销毁释放）+ **余额不足自动停机**（停机同时释放托管）。充值入口两处：Header 余额 chip（租客视角可点，2026-09-14 加）或 RENT 余额墙触发。
- **宿主侧**：实名（必）+ 押金（可选）方可上架，降跑路/交付风险。**宿主资金闭环（2026-09-14）**：租用 `source:"host"` 机器的消费按 **1:1 全额入账** `hostEarnings`（tick 计费单点钩子，Running/停机存储费/过渡态全覆盖），Earnings 页「收益明细」渲染近期流水（ledger `hostEarn` 标记条目）；演示全额入账、抽成口径待实测【MK】。**底数自洽（2026-09-14 评审修复）**：$128.40 预置历史折算为 2 条 `hostEarn`+`legacy` 标记流水（seed 与老存档统一回填），顶卡/明细/抽屉三处同源对账；`legacy` 流水在租客侧视图（抽屉/Billing 统计与流水表）一律过滤，不污染租客消费叙事。同轮修复：充值 toast 按入口分化（门序=「继续租用」/Header 入口=仅确认充值）、CreditsModal 副标题与宿主 chip title 的中英残留改 i18n 键（`crMinNote`/`balHostTip`）。

## 落地页与注册/登录（2026-09-11 扩展 · 强制门语义）

- **未登录默认落地页（landing）**：Hero + 实时报价采样（真实 OFFERS 数据）+ 三源供给 + 资金合规 + 双主体（含租户/宿主各 3 步上手）+ Footer；延续 zinc 暗色工作台语言。Header 未登录精简：仅 logo/登录/注册/语言切换。
- **强制门**：未登录不可达市场——所有 CTA（浏览报价/价格卡/成为宿主）指向独立注册/登录页（auth 视图，全屏、不渲染控制台 Header）；渲染期守卫 + 刷新恢复守卫双防线。**退出通道（2026-09-15）**：右上「← 返回首页」按钮（带边框，与语言切换同级视觉）+ Esc 键均可回落地页（任一注册步骤中途可退；pendingOffer 保留，登录后继续租用）——演示不被强制门锁死。
- **注册**：邮箱 + 密码（≥8 位，含确认密码）→ 模拟邮箱验证码（任意 6 位）→ **注册协议 · 最终用途声明**（end-use 四项勾选，全选才 enable「同意并创建账号」）→ 自动登录落 search。**登录**：邮箱密码（账号不存在/密码错误分态提示）+ Google/Github OAuth 一键（首登=注册，视为已接受协议）+ 忘记密码 stub。邮箱重复注册 → 自动切登录 tab。
- **模拟账号库**：localStorage 键 `gpu-market-accounts-v1`，**明文存储（演示取舍，勿沿用至正式产品）**；「清空重来」同步清空。老存档（只有 authed 布尔）自动回填 legacy 账号 `demo@demo.dev`（密码 `demo12345`）并 seed 进账号库。
- **认证成功落点**：有 pendingOffer → 先落 search 再续租用门序；无 → 落 search（余额 $0，点 RENT 串联全部门序）。

## 演示路径（约 5 分钟）

0. **清空 storage 打开**（或「清空重来」）→ **落地页**：浏览报价采样 → 点「浏览实时报价」→ **注册**（test@demo.dev / password123 → 任意 6 位验证码）→ 自动登录进市场，Header 出现账号 chip
1. **搜索页**：筛选器真实过滤 15 台供给（12 静态报价 + 2 首发池 + 1 宿主上架；默认滤除 Unverified，可见 12 台）；卡片五列 Vast 式对齐——DLPerf、DLP/$/hr、最长租期、TFLOPS·Max CUDA、架构徽标；宿主上架机器经 Agent 流程阻塞实测后 DLPerf 显示实测值（可靠性「—」待首单）；排序切「DLPERF ↓」看实测分降序；hover 价格看分解；勾「包含 Unverified」看过滤行为
2. **双入口下单**（机器导向）点 **RENT** → 模板弹窗选镜像（模板=镜像+硬件要求，仅作用于当前订单）→ 「继续租赁」**直接进入余额墙/确认页**（不再二次点 RENT）；
   （任务导向）可先点工具栏「**模板**」过滤（列表只剩端口兼容机器）→ 再点 RENT **直达**余额墙/确认页、跳过模板弹窗
3. **余额墙** → 支付 $25（充值成功自动关窗进确认页；也可随时点 Header 余额 chip 独立充值，无门序上下文时仅关窗不跳确认页）→ 配置确认页：镜像/磁盘/端口按模板预填 + **纯 On-Demand（固定价 · 高优先 · 保证至最长租期）**
4. 创建实例 → 状态机动画 Creating→Loading→Connecting→Running；余额按 ×60 时钟实时扣减；**Billing 页余额主卡片显示可用/冻结**（冻结=按量全局预留 + 订单 per-instance 冻结之和；停止释放回 0）
5. **Stop** 看费率切存储上浮；**Restart** 看 Scheduling；控制条触发 Offline/Expired
6. **Billing 页（2026-09-17 重构：回归「对客钱款核对面板」）**：①**当前余额主卡片**（可用 / 冻结托管（按量预留 + 订单冻结拆行）/ 可用+冻结）+ **计费与余额规则收进标题旁 `?`（InfoTip `side="left"`）**，不再占独立卡片；②**累计消费构成**（按量 lgGpu/lgStoreStop/lgBw + 订单 lgAmort 归入 GPU 算力，不再空账）；③**交易流水**：列为「时间 / 说明 / 金额 / 余额 / 流水号」——**「说明」**（原「项目」为 `Item` 直译、平台无 project 概念，正名 Description）；**说明内含 实例短ID + 型号**（`GPU compute · i-471430 · RTX 5070`，型号随流水写入时快照，实例销毁后仍可回查；事件行 ID 亦统一为 shortId）、**「余额」为逐笔写入时快照（balAfter）**、**「流水号」为逐笔 txnId**（`hidden md:table-cell`，窄屏隐藏；外层 `overflow-x-auto` 防横向溢出）；方向白名单：充值/退款 `+`、消费/订单预付 `-`、订单摊销/罚金中性「预付款分摊」，先过滤再截断。**计费配置（过渡态存储费）已迁 Admin**：属平台单方条款，对客端只读镜像（默认开启，无配置权），落点 Admin「资金对账·计费参数」。**对账闭环**：充值写 lgTopup、订单/预订下单写 lgOrderPay，逐笔盖章 txnId/balAfter，使 Σ(方向流水)=Δ余额（42 条窗口内且每行余额自证）。**带宽计费引擎**：按量 SKU 运行期按模拟流量（0.35 GB/h·$0.02/GB 全局常量）计费，与宿主 hostEarn/rate 分流同步（护住 Admin 守恒对账）
8. 右上角「→ 宿主视角」：**首次切换弹宿主角色门**（agreement 确认，可稍后；接受后不再弹）→ Machines（首发池 seed 机标「首发池」而非实名/押金）→ **上架新机器 · Agent 模式三步向导（2026-09-16 重构）**：①安装 Agent（带一次性注册 token 的命令，token 绑定宿主账号）→ ②Agent 联网注册：只读硬件清单自动上报（mock 池随机 4090×1/5090×2/A100×4，宿主不可编辑，geoloc 为出口 IP 反查·申诉为文案占位）+ 自检四项逐项回报 → ③**平台实测（阻塞式）**：进度条 ~3s 通过后解锁定价，宿主仅填商业条件（机器名/GPU·网络·存储定价/押金/租期；实名已是账号级则显示绿条）→ 发布 → 回租户搜索页**可搜到且可 RENT**（source:"host"，卡片 DLPerf 为实测值、可靠性「—」；「自家报价」标签；「隐藏自家机器」开关默认关）→ 租用后切回**宿主视角 Earnings 收益实时上浮** → 收益页（可提现卡「提现」弹窗：金额/通道选择/实到预估；弹窗内「管理通道」支持三通道设为默认·删除）
 9. Header 账号 chip → 下拉菜单（完整邮箱+退出）→「退出」回落地页 → 「登录」用同一邮箱重登（演示账号库持久化）；刷新页面：登录态、余额、实例、流水、宿主机、escrow 全部从 localStorage 恢复
10. **出金闭环（双 tab）**：宿主视角收益页可提现卡「提现」→ 弹窗（未绑通道则先「添加通道」）输金额/选通道/看实到预估 → 确认 → 行动卡「审核中」→ Admin「资金对账·出金审批」实时出现 → 批准 → 用户端即时 toast「已到账」+ 可提现 −$20（刷新不重复扣）；驳回则钱不动。演示前可先「重置 Admin 配置」清审批账本

## Demo 控制条（底部，评审专用）

触发 L4-1 异常分支：宿主断连→Offline / 布置重启卡住（Scheduling >30s 提示）/ 快进到期→Expired / 重置余额 / **退出登录 / 清空重来**。可折叠；landing 页折叠为浮球（可展开），auth 页不渲染。**模拟时钟（2026-09-18 自 header 迁入）**：评审工具与产品元素分离——时钟自注「正式产品无此元素」，归位控制条右组（时间加速旁），倍率由相邻 ×60 切换按钮唯一表达（时钟本体不再重复显示 ×N）。

## 证据角标

🟢 实测复刻（走查记录）｜ 🔵 文档口径（docs.vast.ai R1）｜ 🟡 推断设计（手册 MK 标注，待 $10 实测校准）

## 多语言规范（i18n）

原型支持 **中/EN 切换**（header 右上 pill，选择持久化于 `vast-demo-lang` 独立键）。判定规则——每个字串先问：**它在真实 vast.ai 界面上存在吗？**

1. **行业术语层**（SSH / Docker / DLPERF / PCIe / $/hr）：两种语言都保持行业原文，永不翻译。
2. **产品复刻层**（vast.ai 界面原文）：其中**结构语义词**（导航项、CTA 按钮、认证徽标）中文模式显示中文——账单 / 存储 / 租用 / 已验证（2026-08-26 裁决：可读性优先于原样复刻；EN 模式仍为官方原文 RENT / Verified）。状态机 10 词维持「原文 · 中文释义」格式（见 `statusText()`）。充值弹窗两条免责（退款 / SLA）**不适用混排范式**（2026-09-16 用户实测否决：长句混排可读性差，仅短词适合「原文 · 释义」）——zh 纯中文 / en 官方原文，「可读性优先」同结构语义词裁决。
3. **解释层**（demo 作者的辅助信息：警告、说明、角标、控制条、toast）：随语言切换，全部走字典。

5. **术语白名单**（2026-08-26 裁决）：GPU、SSH、USDC、Jupyter、Google/Github、PCIe、RTX 型号、DLPERF、VRAM、CPU、RAM、host-id、单位（Mbps/GB/s 等）两种语言保留原文；规格标签 BW→带宽、ports→端口、Disk→磁盘 已译。**元规则**：白名单未尽者按第 1–3 问判定，判不准默认进解释层（翻译）。

**推断设计页规则**（第四条补充）：无 vast 原文可依的自创页面（宿主侧）视同解释层，两语言均须完整——它们不是复刻标本。

### 工程约定

- 字典：`I18N = {zh:{…}, en:{…}}` 平铺对象；组件内经全局 Proxy `T.xxx` 取值（动态求值，语言切换免刷新生效）
- **新增任何文案必须同时在 zh/en 两个包中登记**，缺键会直接渲染键名（便于发现）
- 引擎层（tick/横幅）不存储渲染文案，只存 `msgKey`+参数，渲染时翻译——防止切换语言后历史数据残留旧语言
- **预览唯一方式：`npm run dev`（vite :8787）**，禁止另起 `python -m http.server`；起服前先 `lsof -nP -iTCP:8787 -sTCP:LISTEN` 查占用。macOS 允许 `*:8787` / `127.0.0.1:8787` / `[::1]:8787` 三地址同时绑定且**不报错**，重复起服会静默堆积（2026-09-16 盘查：8787 曾 3 进程抢答、8788 遗留 1 个，已清）。访问地址统一 `http://localhost:8787/proto/index.html`——vite root 是仓库根，裸 `/` 不是原型
- 二期已完成（2026-08-28）：Billing / Storage / HostMachines / ListWizard / Earnings / BindPayout 六页 EN 全量迁移，phase-2 横幅已拆除
- P2P 轮已完成（2026-09-02）：注入/邀请门/end-use/三源标签/escrow/wz 实名押金 等 ~30 新键双包登记
- MVP 裁剪轮（2026-09-16）：Interruptible 竞价 / 白名单 / Auto Top-Up / Transfer / Serverless / Storage / Notifications / Referral / 卷 整链删除（index+admin 双端 + i18n 双包）；键位审计（词法扫描）used=430 / zh=457 / en=457 **零缺口、zh=en 键集完全对称**
- Vast 对齐轮（2026-09-16）：报价卡补 DLPerf/DLP$·hr/最长租期/TFLOPS/Max CUDA/架构徽标（OFFERS 12 条 + SEED 2 台补采【MK】）、宿主信任挂账、五列布局；删死键 `oMaxDur`/`oDurNote`；筛选器「不限」硬编码修复（新键 `fUnltd`）；老存档 hydration 补**整台缺失 seed 机追加回填**（此前仅按 id 补字段不追加）；键位审计 used=434 / zh=494 / en=494 零缺口对称（'en' 单键 diff 为扫描伪影）
- 免责 i18n 轮（2026-09-16）：充值弹窗两条 vast 走查免责去硬编码，新键 `crD1Pre/crD1Em/crD1Suf`、`crD2Pre/crD2Em/crD2Suf` 双包对称（三段式拆键保真 `<b>` 加粗）；初版套 `statusText()` 混排范式，**用户实测否决后改 zh 纯中文 / en 官方原文**（长句混排可读性差，混排仅保留给状态机短词）
- 元注释清理轮（2026-09-16）：全盘移除 UI 元注释——删键 `crD3`/`instEmptyFoot`/`blHero`/`eaHero`/`eaDetailNote`/`ttMkNote`/`ldFootNote`/`instNote`/`hmFoot`/`legend`；整删**证据角标体系**（`EV_META`/`EvBadge`/图例弹层）；14 键改纯产品语义（`escrowNote`/`eaWdWarn`/`eaWdThreshold`/`hmWarn`/`haBody`/`debtBanner`/`poRateNote`/`tOos`/`tPortal`/`tReboot`/`ldFootStub`/`ldFootCorp`/`ldTickerFoot`/`eaMonthlySub`/`ownTagTitle`/`simClockTip`/`perspTitle`）；`<title>` 改 `GPU·Market`；裁决/口径/走查引用统一归档 PRD《算力云平台-PRD-outline.md》**附录 B**；保留：`ctlBadge`（控制条身份徽标，用户裁决）、`auCodeHint`/`auForgotToast`（演示可操作性）；键位审计 used=441（'map' 为 `GPU_LIST.map` 扫描伪影）/ zh=467 / en=467 零缺口对称
 - **Agent 向导轮（2026-09-16）**：ListWizard 按「首期仅实体算力卡 + Agent 联网上架」重构为 安装 Agent→注册自检→阻塞实测定价 三步——删宿主手填硬件参数（wzCk1-4/wzS0Lead/wzS0Note/wzUnCmd/wzDefName/wzFGeoPh/wzFNvlink 等 10 键）、自检与硬件采集改 Agent 自动回报（AGENT_MOCKS mock 池 3 套全字段配置）、安装命令带一次性 token、平台实测阻塞解锁定价（新键 wzBtnWait/wzConnecting/wzOnline/wzRepTitle/wzRepNote/wzChkTitle/chk×4/wzBench×4/wzPriceLead）；实名升级账号级 `S.hostRealname`（宿主主体 KYC 一次，本账号全部机器生效）；实测值入 machine payload（verified/dlperf/dlperfPerUsd=tflops/cuda），DLP$/hr=round(dlperf/dph) 与 offer 口径一致；键位审计 used=444 / zh=471 / en=471 零缺口对称
 - **弹框体验轮（2026-09-17）**：确认弹框四项优化——①固定文案分级收纳：磁盘解释行/按量「不可互转」收进新 `InfoTip` 组件（？圆标点击气泡，外部点击/Esc 关闭），订单「无 Stop·到期自动退房」保留常驻短句（行为预期管理）；②高级配置改 **Popover 浮层**（absolute + 外部点击关闭，展开前后弹框高度实测 601px 不变）；③预定开机改 **datetime-local 直选准确时刻**（本地时区串→模拟钟域同源纪元换算 `SIM_EPOCH_MS`，选定实时回显 `＝ 模拟钟 …Z`；提交瞬间二次校验 `startAt>simT` 防加速钟飘过，阻断不静默降级）；④**时段互斥 v3.3**：mock 他人预订懒初始化并持久化（`S.bookings`，按首次打开订单弹框时 simT 固化防漂移）+ 自己订单/预订实例（`createInstance` 补 `offerId`），半开区间重叠判定（紧邻合法），下单页 24h 占用时间轴（灰=占用/绿=所选/重叠红显+禁提交），超窗截断标记；新键 `cfPickTimeHint/cfSimEcho/cfPastErr/cfTlLegend/cfTlCut/cfConflict` 双包对称，删键 `cfAfterMin/cfDelayPh` 零残留；规格 §7.7 升 v3.3（精确时刻+互斥规则）
 - **时间轴+文案净化轮（2026-09-17）**：①时长档「7 天」→**自定义小时**（整数输入，上限=报价 `maxDuration` 天数×24，缺字段兜底 30d；`dur`/`customH` 分立 state 防混类型污染派生链；超限/非法红字+禁提交且锁价显示 —）；②时间轴视觉——占用块灰→**琥珀 `amber-400/75`**（深色底醒目）、每 6h 刻度线+钟点标签+「现在」白线；**视窗改为跟随所选时段起点**（不再以当前为坐标），截断仅时长>24h；③预定回显删内部术语提示，改「距开机 X · 到期 Y」（复用 `durTxt`）；④**对客文案全局去「退房」黑话**（内部口径保留）：cfOrderRules 精简为「总价全包 · 提前取消收未用部分 15% 违约金 · 到期自动释放，数据由平台寄存 · 宿主断连超 5 分钟全额退款」、ordNoStop/ordPenalty/tOrderCreated/tEarlyReturn/tOrderExpired/lgPenalty/lgRefund/evOrderExpire/实例卡按钮（订单态「退房」→「释放」）zh/en 同步；新键 `cfDurCustom/cfCustomPh/cfCustomErr/cfStartEcho`，删键 `cfDur7d/cfPickTimeHint/cfSimEcho` 双包对称

## 已知边界

- Tailwind 经 jsdelivr `@tailwindcss/browser@4` 加载（tailwindcss.com 在部分网络被劫持）；断网时顶部出现红色降级横幅
- ESC 关闭弹窗 / focus trap 已实现但未经自动化按键测试
- **Agent 上架流程为同步模拟（2026-09-16）**：真实系统为异步状态机（registered→benchmarking→listed，实测失败有修复重测循环）——原型在向导内同步完成（~3s 进度条），不做跨会话中间态与失败分支；重开向导 = 重新随机一台 mock 机器（token/上报值不持久化，演示语义「另一台机器」）；geoloc「出口 IP 反查」与「联系平台申诉」为文案占位，无采集与工单实现
- 宿主收益为**演示层守恒**（前端 1:1 数字联动），非引擎结算实现；Expire 后过渡态存储费持续扣租客、同步持续入宿主账（机器仍被占用，语义成立）
- 「收益明细」仅展示 ledger 窗口内（42 条上限）近期流水，长租场景以顶部累计数字为准；legacy 底数流水位于窗口最老端，刷满 42 条真实流水后自然老化出窗（届时顶卡累计数字仍准确）
- LedgerDrawer 把手 13px 触达偏窄、sr-only 余额播报 span 位于 chip button 内污染可访问名（实测读出双金额）、无焦点归还——2026-09-14 评审已知项，属 polish/harden 范围
- **账单页对账窗口（2026-09-17）**：流水「余额」列为**逐笔写入时快照（balAfter）**，每行自身可自证；跨行 Σ(方向流水)=Δ余额 仅在 ledger 42 条窗口内成立，长会话旧条目出窗后以余额主卡片为准；**Admin 注入 / legacy seed 流水无审计字段 → 余额/流水号显示 `—`**（注入属评审工具、不入对客链路，缺口已登记）；带宽为**模拟流量**（无真实流量源，运行期平滑累积，非实测）；订单摊销/罚金为预付款内部分摊（下单已全额划款），中性展示且不参与求和；舍入用 toFixed(4)/(5) 不统一，逐笔快照为准、不承诺逐分对账；Admin 原始对账表仍用 fmtNeg 统一显示负号（运营视图，未按方向区分，属后续 polish）
