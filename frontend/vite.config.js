import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendTarget = String(env.VITE_BACKEND_URL || 'http://localhost:5000').replace(/\/+$/, '');
  const frontendPort = Number(env.VITE_PORT || 3000);

  return {
    plugins: [react()],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return;

            if (id.includes('recharts')) return 'charts';
            return 'vendor';
          },
        },
      },
    },
    server: {
      port: frontendPort,
      strictPort: true,
      proxy: {
        '/api': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
          ws: true,
          timeout: 30000,
          proxyTimeout: 30000,
        },
      },
    },
  };
})
