# Mekong 算力平台 · 交互原型

P2P GPU 算力市场交互原型（租户 + 宿主 + 平台管理端 + 企业客户入口），单文件、零构建：React 18 UMD + Babel standalone + Tailwind，全部经 CDN 加载，浏览器直接打开即可运行。

## 在线预览

- 主原型（租户 / 宿主双视角）：<https://y545329005.github.io/mekong/proto/index.html>
- 平台管理端（出金审批 / 抽成 / 风控）：<https://y545329005.github.io/mekong/proto/admin.html>
- 企业客户入口（采购需求受理）：<https://y545329005.github.io/mekong/proto/enterprise.html>
- 实例工作区演示（第三方跳转落地）：<https://y545329005.github.io/mekong/proto/portal.html>

> 首屏加载需访问 CDN，请确保网络可访问 `cdn.jsdelivr.net`。

## 本地运行

方式一（零依赖）：直接用浏览器打开 `proto/index.html`。

方式二（Vite 本地服务）：

```bash
npm install
npm run dev
# 打开 http://localhost:8787/proto/index.html
```

## 页面与角色

| 入口 | 说明 |
|---|---|
| `proto/index.html` | 租户 + 宿主单文件原型。右上角「→ 宿主视角」切换双主体；导航含控制台 / 行情 / 实例 / 账单 |
| `proto/admin.html` | 平台管理端：大盘 / 市场管理 / 资金对账（抽成滑杆 + 出金审批）/ 用户与合规 |
| `proto/enterprise.html` | 企业客户入口：提交算力采购需求，进入线下对接流程 |
| `proto/portal.html` | 实例工作区演示：五场景自动播放导览（第三方工作区网关形态） |

核心演示链路：

- **租户**：搜索报价 → 选机器 → 双 SKU（按量 / 时段订单·预订）→ 计费状态机 → 账单流水
- **宿主**：上架向导（Agent 化）→ 收益实时入账 → 收益页「提现」弹窗（通道 / 金额 / 实到预估）→ 申请制出金
- **平台**：Admin 实时看见申请 → 批准/驳回 → 用户端秒级到账（幂等不重复扣）
- **行情**：各型号价格分布 / 地域分布 / 12 周趋势 / 供需汇总
- **企业**：落地页「企业算力采购」→ 需求表单 → 受理态（含受理编号）
- **双端联动**：`index.html` 与 `admin.html` 同源共享 localStorage，双开演示「用户操作 → 后台实时亮灯 → 后台干预 → 用户端生效」

## 演示账号

- 注册：任意邮箱（如 `test@demo.dev`）+ 密码 `password123` + 任意 6 位验证码
- Admin 端内置演示账号，见 `proto/admin.html`

## 文档

- `proto/README.md` —— 原型功能全景与走查脚本
- `proto/DEMO.md` —— 14 分钟演示脚本（分幕）

## 说明

- 本仓库为产品原型 / 可点击规格说明，**非生产代码**；数据均为演示 mock。
- **行情页的历史趋势为示意序列**，非真实成交统计，不作为定价依据；成交样本仅取自当前会话订单，样本量极小。
- **企业客户入口当前为需求受理漏斗**，不支持平台自助下单；企业合同、统一交付责任、SLA 与统一账单尚在规划中，不构成承诺。
- 价格、费率、对账口径等标注为演示口径的部分，以正式 PRD 为准。
