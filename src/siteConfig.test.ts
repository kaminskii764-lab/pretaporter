import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  THEME_TOKENS,
  auditHtmlDocument,
  calculateContrastRatio,
  injectDynamicMeta,
  resolveBaseUrl,
} from './siteConfig.ts';

test('resolveBaseUrl prioritizes valid APP_URL and rejects unsafe host headers', () => {
  assert.equal(
    resolveBaseUrl('https://pretaporter.example.com/path', 'evil.com', 'https'),
    'https://pretaporter.example.com',
  );
  assert.equal(
    resolveBaseUrl('', 'localhost:3000', undefined),
    'http://localhost:3000',
  );
  assert.equal(
    resolveBaseUrl('', 'bad.host"><script>', 'https'),
    '',
  );
});

test('injectDynamicMeta upgrades relative emblem paths and adds canonical URL', () => {
  const sample = `<!DOCTYPE html><html><head>
  <meta property="og:image" content="./emblem.png" />
  <meta name="twitter:image" content="./emblem.png" />
  <script type="application/ld+json">{"@context":"https://schema.org","image":"./emblem.png"}</script>
</head><body></body></html>`;

  const transformed = injectDynamicMeta(sample, 'https://example.org/');
  assert.ok(transformed.includes('content="https://example.org/emblem.png"'));
  assert.ok(transformed.includes('<link rel="canonical" href="https://example.org/" />'));
  assert.ok(transformed.includes('<meta property="og:url" content="https://example.org/" />'));
  assert.ok(transformed.includes('"image": "https://example.org/emblem.png"'));
});

test('dark and high-contrast light palettes have complete token parity and pass WCAG contrast', () => {
  assert.deepEqual(
    Object.keys(THEME_TOKENS.dark).sort(),
    Object.keys(THEME_TOKENS.light).sort(),
    'Dark and light theme token maps must define identical CSS custom property keys',
  );

  // Dark mode contrast checks (WCAG AA/AAA on neutral carbon #09090b & card #121215)
  const darkPageBg: [number, number, number] = [9, 9, 11]; // #09090b
  const darkCardBg: [number, number, number] = [18, 18, 21]; // #121215
  const darkIconBg: [number, number, number] = [27, 27, 32]; // #1b1b20
  assert.ok(calculateContrastRatio([250, 250, 250, 1], darkPageBg) >= 18, 'Dark heading must be AAA');
  assert.ok(calculateContrastRatio([161, 161, 170, 1], darkPageBg) >= 7, 'Dark subtitle must be AAA');
  assert.ok(calculateContrastRatio([161, 161, 170, 1], darkCardBg) >= 6.5, 'Dark card subtext must pass AA/AAA');
  assert.ok(calculateContrastRatio([244, 244, 245, 1], darkIconBg) >= 15, 'Dark monochrome icon must be AAA');
  assert.ok(calculateContrastRatio([232, 98, 12, 1], darkPageBg) >= 5.5, 'Dark accent must pass AA');

  // High-contrast light mode checks (WCAG AAA >= 7:1 text, >= 4.5:1 accent & high-contrast borders)
  const lightPageBg: [number, number, number] = [250, 249, 246]; // #faf9f6
  const lightCardBg: [number, number, number] = [255, 255, 255]; // #ffffff
  const lightIconBg: [number, number, number] = [244, 243, 239]; // #f4f3ef
  assert.ok(calculateContrastRatio([10, 10, 12, 1], lightPageBg) >= 18, 'Light heading/body must be AAA');
  assert.ok(calculateContrastRatio([39, 39, 42, 1], lightPageBg) >= 13, 'Light subtitle must be AAA');
  assert.ok(calculateContrastRatio([10, 10, 12, 1], lightCardBg) >= 19, 'Light card title must be AAA');
  assert.ok(calculateContrastRatio([39, 39, 42, 1], lightCardBg) >= 14, 'Light card subtext must be AAA');
  assert.ok(calculateContrastRatio([10, 10, 12, 1], lightIconBg) >= 17, 'Light monochrome icon must be AAA');
  assert.ok(calculateContrastRatio([63, 63, 70, 1], lightCardBg) >= 9, 'Light card border must be high contrast');
  assert.ok(calculateContrastRatio([184, 67, 0, 1], lightCardBg) >= 5, 'Light accent must pass AA');
});

test('production index.html and metadata.json pass all audit and sync checks', () => {
  const rootDir = process.cwd();
  const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
  const metadata = JSON.parse(
    fs.readFileSync(path.join(rootDir, 'metadata.json'), 'utf8'),
  ) as { name: string; description: string };

  const result = auditHtmlDocument(html);
  assert.deepEqual(result.issues, [], `HTML audit failed: ${result.issues.join('; ')}`);
  assert.equal(result.valid, true);

  for (const mode of ['dark', 'light'] as const) {
    for (const [prop, val] of Object.entries(THEME_TOKENS[mode])) {
      assert.ok(
        html.includes(`'${prop}': '${val}'`),
        `index.html THEMES.${mode} must include exact ${prop} value`,
      );
    }
  }

  assert.ok(
    html.includes(`<title>${metadata.name}</title>`),
    'index.html <title> must match metadata.json name',
  );
  assert.ok(
    html.includes(`content="${metadata.description}"`),
    'index.html description must match metadata.json description',
  );
  assert.ok(
    html.includes('animation: emblem-float 6s cubic-bezier(0.45, 0, 0.55, 1) infinite;'),
    '.emblem must apply slow, smooth emblem-float keyframe animation',
  );
  assert.ok(
    html.includes('transform: translate3d(0, -6px, 0);'),
    'emblem-float must animate compositor-only translate3d transform',
  );
  assert.ok(
    html.includes('transition: box-shadow 0.55s cubic-bezier(0.22, 1, 0.36, 1);'),
    '.emblem must use slowed, graceful transition',
  );
  assert.ok(
    html.includes('class="emblem-stage fade-in stagger-1"'),
    'Emblem stage must use .fade-in.stagger-1 class',
  );
  assert.ok(
    html.includes('<h1 class="fade-in stagger-2">'),
    'Heading must use .fade-in.stagger-2 class',
  );
  assert.ok(
    html.includes('class="rule fade-in-rule stagger-3"'),
    'Divider rule must use .fade-in-rule.stagger-3 class',
  );
  assert.ok(
    html.includes('class="subtitle fade-in stagger-4"'),
    'Subtitle must use .fade-in.stagger-4 class',
  );
  for (let i = 5; i <= 8; i++) {
    assert.ok(
      html.includes(`class="card fade-in stagger-${i}"`),
      `Link card ${i - 4} must use .fade-in.stagger-${i} class`,
    );
  }
  assert.ok(
    fs.existsSync(path.join(rootDir, 'emblem.png')),
    'emblem.png static asset must exist at root',
  );
});

test('Express app serves index.html, emblem.png, security headers, and blocks internal files', async () => {
  const { createApp } = await import('./app.ts');
  const app = createApp(process.cwd(), '');
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  try {
    const addr = server.address();
    assert.ok(addr && typeof addr === 'object');
    const base = `http://127.0.0.1:${addr.port}`;

    const healthRes = await fetch(`${base}/api/health`);
    assert.equal(healthRes.status, 200);
    assert.deepEqual(await healthRes.json(), { status: 'ok' });

    const homeRes = await fetch(`${base}/`);
    assert.equal(homeRes.status, 200);
    assert.equal(homeRes.headers.get('x-content-type-options'), 'nosniff');
    const html = await homeRes.text();
    assert.ok(html.includes(`content="${base}/emblem.png"`));

    const emblemRes = await fetch(`${base}/emblem.png`);
    assert.equal(emblemRes.status, 200);
    assert.match(emblemRes.headers.get('content-type') ?? '', /image\/png/);

    // Internal repository files must never be exposed even with text/html Accept header
    const blockedPkg = await fetch(`${base}/package.json`, {
      headers: { Accept: 'text/html,*/*' },
      redirect: 'manual',
    });
    assert.equal(blockedPkg.status, 404);

    const blockedServer = await fetch(`${base}/server.ts`, {
      headers: { Accept: 'text/html,*/*' },
      redirect: 'manual',
    });
    assert.equal(blockedServer.status, 404);
  } finally {
    server.close();
  }
});
