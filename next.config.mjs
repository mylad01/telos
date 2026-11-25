import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// `npm run build:static` exports a GitHub Pages site: no Node runtime there, so
// the API route handlers are left out and assets live under /<repo>/.
const isStatic = process.env.TELOS_STATIC === '1';

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
