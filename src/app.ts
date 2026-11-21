import express from 'express';
import type { Express, Request, Response, NextFunction } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { injectDynamicMeta, resolveBaseUrl } from './siteConfig.ts';

export function createApp(
  rootDir: string = process.cwd(),
  appUrl: string | undefined = process.env.APP_URL,
): Express {
  const app = express();
  const indexHtmlPath = path.join(rootDir, 'index.html');
  const emblemPath = path.join(rootDir, 'emblem.png');

  app.disable('x-powered-by');

  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=()',
    );
    next();
  });

  app.get('/api/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
  });

  app.get(['/', '/index.html'], (req: Request, res: Response) => {
    const rawHtml = fs.readFileSync(indexHtmlPath, 'utf8');
    const forwardedProto = req.headers['x-forwarded-proto'];
    const protoStr = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
    const baseUrl = resolveBaseUrl(appUrl, req.headers.host, protoStr);
    const renderedHtml = injectDynamicMeta(rawHtml, baseUrl);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.status(200).send(renderedHtml);
  });

  app.get('/emblem.png', (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.sendFile(emblemPath);
  });

  app.get('/favicon.ico', (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.type('image/png').sendFile(emblemPath);
  });

  app.get('/robots.txt', (req: Request, res: Response) => {
    const forwardedProto = req.headers['x-forwarded-proto'];
    const protoStr = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
    const baseUrl = resolveBaseUrl(appUrl, req.headers.host, protoStr);
    const lines = ['User-agent: *', 'Allow: /'];
    if (baseUrl) {
      lines.push(`Sitemap: ${baseUrl}/`);
    }
    res.type('text/plain').send(`${lines.join('\n')}\n`);
  });

  app.use((req: Request, res: Response) => {
    if (req.accepts('html') && !req.path.includes('.')) {
      res.redirect(302, '/');
      return;
    }
    res.status(404).json({ error: 'Not Found' });
  });

  return app;
}
