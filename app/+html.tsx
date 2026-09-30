// This file is web-only and used to configure the root HTML for every web page
// during static rendering (and in `expo start --web`). It owns the META tags only:
// `lang`, viewport and Apple meta. Every href (favicon, manifest, apple-touch-icon)
// is base-path-dependent and belongs to `scripts/postbuild.cjs`, which knows the
// real deployment base (`app.json` `experiments.baseUrl`) at build time.

import { ScrollViewStyleReset } from 'expo-router/html';

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />

        {/*
          Disable body scrolling on web. This makes ScrollView components work closer to how they do on native.
          However, body scrolling is often nice to have for mobile web. If you want to enable it, remove this line.
        */}
        <ScrollViewStyleReset />

        {/*
          NO <link> hrefs here (favicon/manifest/apple-touch-icon): they would break under the
          GitHub Pages base path or in local dev. See `scripts/postbuild.cjs` and `ensureWebHead()`.
        */}
      </head>
      <body>{children}</body>
    </html>
  );
}
