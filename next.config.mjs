import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// `npm run build:static` exports a GitHub Pages site: no Node runtime there, so
// the API route handlers are left out and assets live under /<repo>/.
const isStatic = process.env.TELOS_STATIC === '1';

// `build:static` passes NEXT_PUBLIC_TELOS_SYNC=0 because a static export has no
// /api routes. Supabase is the exception: when its two settings are present the
// static site syncs through it, so that flag is decided here, from the settings,
// rather than by the script. Without them the site stays local-only.
if (isStatic) {
  const hasSupabase = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  process.env.NEXT_PUBLIC_TELOS_SYNC = hasSupabase ? '1' : '0';
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['*.vercel.run', '*.vercel.app'],
  ...(isStatic && {
    output: 'export',
    basePath: process.env.TELOS_BASE_PATH ?? '/telos',
    distDir: '.next-pages',
    images: { unoptimized: true },
    pageExtensions: ['tsx', 'jsx'],
  }),
};

export default withNextIntl(nextConfig);
