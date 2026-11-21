export interface AuditResult {
  valid: boolean;
  issues: string[];
}

/**
 * Safely resolves the canonical base URL from APP_URL or validated request headers.
 * Rejects malformed or untrusted host headers to prevent host-header injection.
 */
export function resolveBaseUrl(
  appUrlEnv?: string,
  hostHeader?: string,
  forwardedProto?: string,
): string {
  if (appUrlEnv && appUrlEnv.trim().length > 0) {
    try {
      const parsed = new URL(appUrlEnv.trim());
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return `${parsed.protocol}//${parsed.host}`;
      }
    } catch {
      // Fall through to header inspection if APP_URL is invalid
    }
  }

  if (!hostHeader) {
    return '';
  }

  const trimmedHost = hostHeader.trim();
  const safeHostPattern = /^[a-zA-Z0-9.-]+(?::\d{1,5})?$/;
  if (!safeHostPattern.test(trimmedHost)) {
    return '';
  }

  const rawProto = forwardedProto?.split(',')[0]?.trim().toLowerCase();
  const proto =
    rawProto === 'https' || rawProto === 'http'
      ? rawProto
      : trimmedHost.startsWith('localhost') || trimmedHost.startsWith('127.0.0.1')
        ? 'http'
        : 'https';

  return `${proto}://${trimmedHost}`;
}

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Enhances static index.html at request time with absolute OpenGraph/Twitter image URLs
 * and canonical URL metadata when served via Express, while keeping index.html portable
 * for static hosting.
 */
export function injectDynamicMeta(html: string, baseUrl: string): string {
  if (!baseUrl) {
    return html;
  }

  const cleanBase = baseUrl.replace(/\/+$/, '');
  const safeRootUrl = escapeHtmlAttr(`${cleanBase}/`);
  const safeEmblemUrl = escapeHtmlAttr(`${cleanBase}/emblem.png`);

  let result = html
    .replace(
      /<meta property="og:image" content="\.\/emblem\.png"\s*\/>/g,
      `<meta property="og:image" content="${safeEmblemUrl}" />`,
    )
    .replace(
      /<meta name="twitter:image" content="\.\/emblem\.png"\s*\/>/g,
      `<meta name="twitter:image" content="${safeEmblemUrl}" />`,
    )
    .replace(/"image":\s*"\.\/emblem\.png"/g, `"image": "${cleanBase}/emblem.png"`);

  if (!result.includes('rel="canonical"')) {
    result = result.replace(
      '</head>',
      `  <link rel="canonical" href="${safeRootUrl}" />\n  <meta property="og:url" content="${safeRootUrl}" />\n</head>`,
    );
  }

  return result;
}

/**
 * Computes WCAG 2.1 contrast ratio for an RGBA foreground composited over an RGB background.
 */
export function calculateContrastRatio(
  fgRgba: readonly [number, number, number, number],
  bgRgb: readonly [number, number, number],
): number {
  const [fr, fg, fb, alpha] = fgRgba;
  const [br, bg, bb] = bgRgb;

  const compositeR = fr * alpha + br * (1 - alpha);
  const compositeG = fg * alpha + bg * (1 - alpha);
  const compositeB = fb * alpha + bb * (1 - alpha);

  const luminance = (r: number, g: number, b: number): number => {
    const channel = (c: number): number => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  };

  const l1 = luminance(compositeR, compositeG, compositeB);
  const l2 = luminance(br, bg, bb);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

export type ThemeName = 'dark' | 'light';

export const THEME_TOKENS: Record<ThemeName, Record<string, string>> = {
  dark: {
    '--bg-color': '#09090b',
    '--bg-gradient':
      'radial-gradient(ellipse 70% 45% at 50% 0%, rgba(255, 255, 255, 0.045) 0%, rgba(18, 18, 22, 0.40) 50%, #09090b 100%)',
    '--text-primary': '#f4f4f5',
    '--text-heading': '#fafafa',
    '--text-subtitle': '#a1a1aa',
    '--accent': '#e8620c',
    '--accent-hover-border': 'rgba(232, 98, 12, 0.50)',
    '--focus-halo': 'rgba(232, 98, 12, 0.24)',
    '--card-bg': '#121215',
    '--card-hover-bg': '#17171c',
    '--card-sheen': 'rgba(232, 98, 12, 0.08)',
    '--card-border': 'rgba(255, 255, 255, 0.09)',
    '--card-shadow':
      '0 10px 28px rgba(0, 0, 0, 0.40), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
    '--card-title': '#fafafa',
    '--card-sub': '#a1a1aa',
    '--icon-bg': '#1b1b20',
    '--icon-hover-bg': 'rgba(232, 98, 12, 0.12)',
    '--icon-border': 'rgba(255, 255, 255, 0.08)',
    '--icon-fg': '#f4f4f5',
    '--arrow-color': '#71717a',
    '--emblem-shadow':
      '0 0 0 5px #09090b, 0 0 0 6px rgba(255, 255, 255, 0.12), 0 18px 42px rgba(0, 0, 0, 0.60)',
    '--toggle-bg': '#141418',
    '--toggle-border': 'rgba(255, 255, 255, 0.12)',
    '--toggle-hover-bg': '#1e1e24',
  },
  light: {
    '--bg-color': '#faf9f6',
    '--bg-gradient':
      'radial-gradient(ellipse 70% 45% at 50% 0%, #ffffff 0%, #faf9f6 70%)',
    '--text-primary': '#0a0a0c',
    '--text-heading': '#0a0a0c',
    '--text-subtitle': '#27272a',
    '--accent': '#b84300',
    '--accent-hover-border': '#b84300',
    '--focus-halo': 'rgba(184, 67, 0, 0.22)',
    '--card-bg': '#ffffff',
    '--card-hover-bg': '#fcfbf9',
    '--card-sheen': 'rgba(184, 67, 0, 0.06)',
    '--card-border': '#3f3f46',
    '--card-shadow': '0 6px 20px rgba(10, 10, 12, 0.06)',
    '--card-title': '#0a0a0c',
    '--card-sub': '#27272a',
    '--icon-bg': '#f4f3ef',
    '--icon-hover-bg': '#fff3eb',
    '--icon-border': '#52525b',
    '--icon-fg': '#0a0a0c',
    '--arrow-color': '#27272a',
    '--emblem-shadow':
      '0 0 0 5px #faf9f6, 0 0 0 6px #3f3f46, 0 12px 28px rgba(10, 10, 12, 0.10)',
    '--toggle-bg': '#ffffff',
    '--toggle-border': '#3f3f46',
    '--toggle-hover-bg': '#f4f3ef',
  },
};

/**
 * Audits index.html for common static-site defects: missing webfont links, inline base64 bloat,
 * unsafe target="_blank" rel attributes, unhidden decorative SVGs, missing image dimensions,
 * missing OpenGraph/Twitter metadata, malformed JSON-LD, and dual-theme custom property wiring.
 */
export function auditHtmlDocument(html: string): AuditResult {
  const issues: string[] = [];

  if (html.includes("'Unbounded'") && !html.includes('family=Unbounded')) {
    issues.push('Unbounded font is referenced in CSS but not loaded via Google Fonts stylesheet');
  }
  if (html.includes("'Onest'") && !html.includes('family=Onest')) {
    issues.push('Onest font is referenced in CSS but not loaded via Google Fonts stylesheet');
  }
  if (/data:image\/png;base64,[A-Za-z0-9+/=]{1000,}/.test(html)) {
    issues.push('Large inline base64 PNG found; use external cached image asset instead');
  }

  if (!html.includes('id="theme-toggle"')) {
    issues.push('Missing #theme-toggle button in HTML');
  }
  if (!html.includes('setProperty(')) {
    issues.push('Missing dynamic CSS custom property update via style.setProperty()');
  }
  for (const prop of Object.keys(THEME_TOKENS.dark)) {
    if (!html.includes(`var(${prop})`)) {
      issues.push(`CSS custom property ${prop} is not consumed via var(${prop}) in stylesheet`);
    }
  }
  if (/<svg\b[\s\S]*?(?:fill|stroke)="#f5f2eb"/.test(html)) {
    issues.push('SVG contains hardcoded #f5f2eb fill/stroke instead of theme-aware currentColor');
  }
  if (!/@keyframes\s+emblem-float\b/.test(html)) {
    issues.push('Missing @keyframes emblem-float animation definition');
  }
  if (!/@keyframes\s+fade-rise\b/.test(html)) {
    issues.push('Missing @keyframes fade-rise entrance animation definition');
  }
  if (!/@keyframes\s+rule-draw\b/.test(html)) {
    issues.push('Missing @keyframes rule-draw divider animation definition');
  }
  if (!/\.fade-in\s*\{/.test(html) || !/\.fade-in-rule\s*\{/.test(html)) {
    issues.push('Missing .fade-in / .fade-in-rule entrance CSS class definitions');
  }
  for (let step = 1; step <= 8; step++) {
    if (!new RegExp(`\\.stagger-${step}\\s*\\{`).test(html)) {
      issues.push(`Missing .stagger-${step} CSS class definition`);
    }
    if (!new RegExp(`class="[^"]*\\bstagger-${step}\\b[^"]*"`).test(html)) {
      issues.push(`Missing stagger-${step} class applied in HTML markup`);
    }
  }
  if (!/\.emblem\s*\{[\s\S]*?animation:\s*emblem-float\b/.test(html)) {
    issues.push('Missing emblem-float animation applied to .emblem');
  }
  if (!/prefers-reduced-motion:\s*reduce[\s\S]*?animation:\s*none/.test(html)) {
    issues.push('Missing animation: none inside prefers-reduced-motion media query');
  }

  const blankAnchors = html.match(/<a\b[^>]*target="_blank"[^>]*>/g) ?? [];
  if (blankAnchors.length === 0) {
    issues.push('Expected external social link anchors with target="_blank"');
  }
  for (const anchor of blankAnchors) {
    const relMatch = anchor.match(/\brel="([^"]*)"/);
    const relTokens = relMatch ? relMatch[1].split(/\s+/) : [];
    if (!relTokens.includes('noopener') || !relTokens.includes('noreferrer')) {
      issues.push(`Anchor missing rel="noopener noreferrer": ${anchor}`);
    }
  }

  const svgs = html.match(/<svg\b[^>]*>/g) ?? [];
  for (const svg of svgs) {
    if (!svg.includes('aria-hidden="true"')) {
      issues.push(`Decorative <svg> missing aria-hidden="true": ${svg}`);
    }
  }

  const imgs = html.match(/<img\b[^>]*>/g) ?? [];
  for (const img of imgs) {
    if (!/\bwidth="\d+"/.test(img) || !/\bheight="\d+"/.test(img)) {
      issues.push(`<img> missing explicit width/height attributes: ${img}`);
    }
  }

  for (const metaKey of ['og:title', 'og:description', 'og:image', 'twitter:card']) {
    if (!html.includes(metaKey)) {
      issues.push(`Missing social metadata tag: ${metaKey}`);
    }
  }

  const jsonLdMatch = html.match(
    /<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/,
  );
  if (!jsonLdMatch) {
    issues.push('Missing Schema.org application/ld+json structured data');
  } else {
    try {
      const parsed = JSON.parse(jsonLdMatch[1]) as Record<string, unknown>;
      if (parsed['@context'] !== 'https://schema.org') {
        issues.push('JSON-LD @context must be https://schema.org');
      }
    } catch {
      issues.push('Malformed JSON inside application/ld+json script');
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
