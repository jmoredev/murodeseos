const fs = require('fs');
const path = require('path');

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function copyFileIfExists(src, dest) {
  if (!fs.existsSync(src)) return false;
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
  return true;
}

function copyDirIfExists(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return false;
  ensureDir(destDir);
  fs.cpSync(srcDir, destDir, { recursive: true });
  return true;
}

/**
 * Normalizes the deployment base path from `app.json` (`expo.experiments.baseUrl`).
 * '' → '' ; '/murodeseos' → '/murodeseos' ; '/murodeseos/' → '/murodeseos' ; 'murodeseos' → '/murodeseos'.
 */
function normalizeBasePath(raw) {
  const base = (raw || '').trim();
  if (!base) return '';
  const segment = base.replace(/^\/+/, '').replace(/\/+$/, '');
  return segment ? `/${segment}` : '';
}

/**
 * Builds the idempotent PWA link block injected into the exported HTML.
 * Hrefs are absolute and base-aware so they also resolve correctly on deep routes
 * served by the GitHub Pages `404.html` fallback (where relative hrefs break).
 */
function buildPwaHeadInjection(basePath) {
  const base = normalizeBasePath(basePath);
  return (
    '\n' +
    `    <link data-murodeseos-pwa="1" rel="icon" href="${base}/favicon.ico" />\n` +
    `    <link data-murodeseos-pwa="1" rel="apple-touch-icon" href="${base}/apple-touch-icon.png" />\n` +
    `    <link data-murodeseos-pwa="1" rel="manifest" href="${base}/manifest.json" />\n`
  );
}

/**
 * Pure injection: returns the HTML with the PWA link block before `</head>`, or
 * the input unchanged when the block is already present (idempotent) or there is
 * no `</head>` to inject into. Never touches `<html lang>` (it lives in `app/+html.tsx`).
 */
function injectPwaHeadLinks(html, basePath) {
  if (html.includes('data-murodeseos-pwa="1"')) return html;
  if (!html.includes('</head>')) return html;
  return html.replace('</head>', `${buildPwaHeadInjection(basePath)}  </head>`);
}

function injectHeadLinksIfHtmlExists(htmlPath, basePath) {
  if (!fs.existsSync(htmlPath)) return false;
  const html = fs.readFileSync(htmlPath, 'utf8');
  const updated = injectPwaHeadLinks(html, basePath);
  if (updated === html) return false;

  fs.writeFileSync(htmlPath, updated, 'utf8');
  return true;
}

function readConfiguredBasePath(root) {
  try {
    const appJson = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
    return appJson?.expo?.experiments?.baseUrl || '';
  } catch {
    return '';
  }
}

function main() {
  const root = process.cwd();
  const dist = path.join(root, 'dist');
  const publicDir = path.join(root, 'public');

  // GitHub Pages SPA fallback + disable Jekyll.
  if (fs.existsSync(path.join(dist, 'index.html'))) {
    fs.copyFileSync(path.join(dist, 'index.html'), path.join(dist, '404.html'));
  }
  ensureDir(dist);
  fs.writeFileSync(path.join(dist, '.nojekyll'), '');

  // Ensure PWA assets are present in the published folder (dist).
  copyFileIfExists(path.join(publicDir, 'favicon.ico'), path.join(dist, 'favicon.ico'));
  copyFileIfExists(path.join(publicDir, 'manifest.json'), path.join(dist, 'manifest.json'));
  copyFileIfExists(path.join(publicDir, 'sw.js'), path.join(dist, 'sw.js'));
  copyDirIfExists(path.join(publicDir, 'AppIcons'), path.join(dist, 'AppIcons'));

  // Ensure favicon/manifest/apple-touch-icon are declared in the exported HTML with
  // base-aware absolute hrefs, so they also resolve on deep routes served by 404.html.
  const basePath = readConfiguredBasePath(root);
  injectHeadLinksIfHtmlExists(path.join(dist, 'index.html'), basePath);
  injectHeadLinksIfHtmlExists(path.join(dist, '404.html'), basePath);
}


if (require.main === module) {
  main();
}

module.exports = {
  normalizeBasePath,
  buildPwaHeadInjection,
  injectPwaHeadLinks,
  injectHeadLinksIfHtmlExists,
  readConfiguredBasePath,
};
