# Mekong Supercompute 对外站（源码）

Vite + React 单页站：首页、算力市场、价格与行情、企业算力。构建产物输出到仓库根 `site/`，可直接静态托管。

## 运行与构建

```bash
cd site-src
npm install
npm run dev      # 本地开发，http://127.0.0.1:8790
npm run build    # 类型检查 + 构建到 ../site/
```

- `site/` 是构建产物，不要手改；改源码后重跑 `npm run build`
- 资源引用全部相对路径（`base: './'`），站点挂在域名根或任意子路径都能用

## 目录

- `src/content.ts` — 型号目录、地区、报价的单一信源
- `src/homeMarket.ts` — 首页行情条与概览数据的派生
- `src/live.ts` — 实时漂移：可租数与挂牌价按时间桶确定性变化
- `src/marketModel.ts` — 价格页与地图表的派生模型
- `src/rentalModel.ts` — 租用页配置与费用估算

## 数据口径

改型号、数量、报价只改 `src/content.ts` / `src/inventory.ts` / `src/demoInventory.ts` / `src/vastOfferSnapshot.ts`；派生数字（总量、可租、已租、覆盖卡型）由代码算，不在各页面写死。页面数据为参考口径，非实时行情。
