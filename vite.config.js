import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Hanya untuk `npm run dev`: menjalankan api/recognize.js langsung di server Vite,
// jadi `vercel dev` tidak diperlukan. Di Vercel, fungsi yang sama berjalan sebagai serverless function.
function localApi(env) {
  return {
    name: 'local-api',
    apply: 'serve',
    configureServer(server) {
      for (const [k, v] of Object.entries(env)) if (process.env[k] === undefined) process.env[k] = v;
      server.middlewares.use('/api/recognize', async (req, res) => {
        const chunks = [];
        for await (const c of req) chunks.push(c);
        try {
          req.body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
        } catch {
          req.body = {};
        }
        res.status = (code) => {
          res.statusCode = code;
          return res;
        };
        res.json = (obj) => {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(obj));
        };
        try {
          const mod = await server.ssrLoadModule('/api/recognize.js');
          await mod.default(req, res);
        } catch (e) {
          console.error('api/recognize error:', e);
          if (!res.writableEnded) res.status(500).json({ error: 'Galat server lokal.' });
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), localApi(loadEnv(mode, process.cwd(), ''))],
  test: { environment: 'node', include: ['tests/**/*.test.js'] },
}));
