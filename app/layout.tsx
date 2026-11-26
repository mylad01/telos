import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { Fraunces, Inter } from 'next/font/google';
import './globals.css';

const display = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
});

const text = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4eee2' },
    { media: '(prefers-color-scheme: dark)', color: '#17150f' },
  ],
  colorScheme: 'light dark',
};

// Applies the stored theme before first paint, so a dark-mode user never sees
// a flash of the light palette while React hydrates.
const THEME_SCRIPT =
  "try{var s=localStorage.getItem('telos.theme.v1');" +
  "var d=window.matchMedia('(prefers-color-scheme: dark)').matches;" +
  "document.documentElement.dataset.theme=" +
  "(s==='dark'||(s!=='light'&&d))?'dark':'light'}catch(e){}";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta');
  return {
    title: t('title'),
    description: t('description'),
    applicationName: 'Telos',
    // Relative, like the manifest's own paths: correct at / and under /telos/.
    icons: { apple: { url: 'icons/apple-touch-icon.png', sizes: '180x180' } },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${text.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body suppressHydrationWarning>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
