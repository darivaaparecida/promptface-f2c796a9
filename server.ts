import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { registerApiRoutes } from './server/routes.ts';
import { initDb } from './server/store.ts';

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);

  // Carrega o banco do Supabase para o cache antes de aceitar requisições.
  // Sem as chaves, o servidor sobe mesmo assim e as rotas de dados falham
  // com erro claro até configurar SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.
  try {
    await initDb();
  } catch (err) {
    console.error(
      '[server] Não foi possível carregar o banco do Supabase no boot:',
      err instanceof Error ? err.message : err
    );
  }

  registerApiRoutes(app);

  if (!isProduction) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PromptFace server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start PromptFace server:', err);
  process.exit(1);
});
