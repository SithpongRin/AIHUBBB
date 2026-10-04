import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import { defineConfig, Plugin } from 'vite';
import modelsHandler from './api/provider/models.ts';
import testHandler from './api/provider/test.ts';

function apiDevServerPlugin(): Plugin {
  return {
    name: 'api-dev-server',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url) return next();

        const url = req.url.split('?')[0];
        if (url === '/api/provider/models' || url === '/api/provider/test') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', async () => {
            let parsedBody: Record<string, unknown> = {};
            try {
              if (body) parsedBody = JSON.parse(body);
            } catch {
              // ignore
            }

            const mockReq = {
              method: req.method,
              headers: req.headers,
              body: parsedBody,
              query: {},
            };

            const mockRes = {
              statusCode: 200,
              status(code: number) {
                this.statusCode = code;
                return this;
              },
              json(data: unknown) {
                res.statusCode = this.statusCode;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(data));
              },
            };

            try {
              if (url === '/api/provider/models') {
                await modelsHandler(mockReq, mockRes);
              } else if (url === '/api/provider/test') {
                await testHandler(mockReq, mockRes);
              }
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : 'Server error';
              mockRes.status(500).json({ success: false, error: msg });
            }
          });
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), apiDevServerPlugin()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
