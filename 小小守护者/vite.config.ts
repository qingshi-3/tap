import { defineConfig } from 'vitest/config';
export default defineConfig({ base: './', server: { port: 4183, strictPort: true }, build: { target: 'es2020' }, test: { include: ['src/**/*.test.ts'] } });
