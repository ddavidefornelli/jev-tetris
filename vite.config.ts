import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import { jevPlugin } from './server/jevPlugin.ts';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), jevPlugin({ ...loadEnv(mode, process.cwd(), 'JEV_'), ...process.env } as Record<string, string>)],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
}));
