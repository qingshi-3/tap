import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `vite build --mode single`：所有资源内联成一个 html，双击即可打开（file:// 下不能加载 module 分包）
export default defineConfig(({ mode }) =>
  mode === 'single'
    ? { base: './', plugins: [viteSingleFile()], build: { target: 'es2020', outDir: 'dist-single' } }
    : { base: './', build: { target: 'es2020', assetsInlineLimit: 0 } },
);
