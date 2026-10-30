import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 公开站（对外层）独立构建，产物落到仓库根 site/，由 8787 的静态目录直接提供：
//   http://localhost:8787/site/
// base 保持相对（'./'），因为对外站既可能挂在域名根，也可能挂在子路径。
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: '../site', emptyOutDir: true },
  server: { port: 8790, host: '127.0.0.1' },
})
