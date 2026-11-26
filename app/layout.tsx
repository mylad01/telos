import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { Fraunces, Inter } from 'next/font/google';
import { ThemeProvider } from '@/components/ThemeProvider';
import { PRESETS } from '@/lib/theme/presets';
import { presetsCss } from '@/lib/theme/tokens';
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

// Paints the stored preset before first paint, so no one sees a flash of the
// default palette while React hydrates. The token blocks themselves are the
// style element below, generated from the same presets the studio lists.
const BOOT_SCRIPT =
  "try{var d=document.documentElement,p=localStorage.getItem('telos.theme.preset.v1');" +
  "if(p&&/^[a-z0-9-]{1,40}$/.test(p))d.dataset.preset=p;}catch(e){}";

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
      data-preset="paper"
      className={`${display.variable} ${text.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
        <style
          id="telos-presets"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: presetsCss(PRESETS) }}
        />
      </head>
      <body suppressHydrationWarning>
        <NextIntlClientProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
