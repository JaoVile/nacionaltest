import type { Metadata } from 'next';
import { Inter, JetBrains_Mono, Fraunces } from 'next/font/google';
import './globals.css';
import { Shell } from './components/Shell';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});
const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  axes: ['opsz'],
});

export const metadata: Metadata = {
  title: 'Nacional — Cobrança NF',
  description: 'Painel de disparo de cobrança de prestadores',
};

const themeScript = `(function(){try{var t=localStorage.getItem('theme');if(t==='dark')document.documentElement.classList.add('dark');}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning
      className={`${inter.variable} ${jetbrains.variable} ${fraunces.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
