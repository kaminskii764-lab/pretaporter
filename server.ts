import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './src/app.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const app = createApp(__dirname);

const server = app.listen(PORT, HOST, () => {
  console.log(`Server listening on http://${HOST}:${PORT}`);
});

server.on('error', (err: NodeJS.ErrnoException) => {
  console.error(`Failed to start server on ${HOST}:${PORT}:`, err.message);
  process.exit(1);
});

const shutdown = () => {
  server.close(() => {
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 2000).unref();
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
