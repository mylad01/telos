import type { MetadataRoute } from 'next';

// `output: 'export'` requires metadata routes to say they are static.
export const dynamic = 'force-static';

// Served as /manifest.webmanifest (or /<repo>/manifest.webmanifest on GitHub
// Pages). Every path here is relative on purpose: the manifest URL is the base,
// so the same file is right on localhost and under a base path.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Telos — a quiet to-do list',
    short_name: 'Telos',
    description: 'A quiet, phone-first to-do list. Due dates, recurring tasks, offline.',
    start_url: '.',
    scope: '.',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f4eee2',
    theme_color: '#f4eee2',
    icons: [
      { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
