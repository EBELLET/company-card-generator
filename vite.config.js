import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  server: {
    host: true,
    port: 5173,
    watch: {
      usePolling: true,
      interval: 1000,
      ignored: ['**/scratch/**', '**/dist/**', '**/server/**', '**/node_modules/**', '**/.git/**', '**/*.sqlite*']
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (err, req, res) => {
            if (err.code === 'ECONNREFUSED' && !res.headersSent) {
              res.writeHead(503, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: "Le serveur API backend est en cours de démarrage..." }));
            }
          });
        }
      },
      '/card': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (err, req, res) => {
            if (err.code === 'ECONNREFUSED' && !res.headersSent) {
              res.writeHead(503, { 'Content-Type': 'text/html' });
              res.end('<h2 style="font-family:sans-serif;text-align:center;margin-top:4rem;">Le serveur API est en cours de démarrage...</h2>');
            }
          });
        }
      }
    }
  },
  optimizeDeps: {
    holdUntilCrawlEnd: true
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        contact: resolve(__dirname, 'contact.html')
      }
    }
  }
});
