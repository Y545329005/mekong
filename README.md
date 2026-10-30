# Mekong Supercompute

全球算力市场对外站：浏览各地区 GPU 供给、比价、费用估算、企业算力需求对接。

## 在线预览

<https://y545329005.github.io/mekong/site/>

## 结构

| 路径 | 内容 |
|---|---|
| `site/` | 构建产物（静态托管直接指向它） |
| `site-src/` | Vite + React 源码 |

## 本地运行

```bash
cd site-src
npm install
npm run dev     # http://127.0.0.1:8790
npm run build   # 类型检查 + 重建 site/
```

## 说明

页面中的型号、价格、库存与地区均为参考数据，用于展示产品形态，非实时行情。资源引用全部相对路径，`site/` 可挂在域名根或任意子路径。
