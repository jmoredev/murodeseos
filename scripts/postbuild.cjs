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

function injectHeadLinksIfHtmlExists(htmlPath) {
  if (!fs.existsSync(htmlPath)) return false;
  const html = fs.readFileSync(htmlPath, 'utf8');

  // Avoid duplicating on repeated builds.
  if (html.includes('data-murodeseos-pwa="1"')) return true;

  const injection =
    '\n' +
    '    <link data-murodeseos-pwa="1" rel="icon" href="./favicon.ico" />\n' +
    '    <link data-murodeseos-pwa="1" rel="manifest" href="./manifest.json" />\n';

  if (html.includes('</head>')) {
    fs.writeFileSync(htmlPath, html.replace('</head>', `${injection}  </head>`), 'utf8');
    return true;
  }

  // If head tag isn't present (unlikely), no-op.
  return false;
}

function injectHtmlLangIfHtmlExists(htmlPath) {
  if (!fs.existsSync(htmlPath)) return false;
  const html = fs.readFileSync(htmlPath, 'utf8');

  // If already has a lang attribute, don't touch it.
  if (/<html[^>]*\slang=/.test(html)) return true;

  if (html.includes('<html')) {
    fs.writeFileSync(htmlPath, html.replace('<html', '<html lang="es"'), 'utf8');
    return true;
  }

  return false;
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

  // Ensure favicon/manifest are declared in the exported HTML so browsers don't request /favicon.ico.
  injectHeadLinksIfHtmlExists(path.join(dist, 'index.html'));
  injectHeadLinksIfHtmlExists(path.join(dist, '404.html'));

  // Ensure correct document language for screen readers (WCAG 3.1.1).
  injectHtmlLangIfHtmlExists(path.join(dist, 'index.html'));
  injectHtmlLangIfHtmlExists(path.join(dist, '404.html'));
}

main();

