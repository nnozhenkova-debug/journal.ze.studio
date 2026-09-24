import { GeistSans } from 'geist/font/sans';
import './globals.css';

export const metadata = {
  title: 'Журнал студии',
  description: 'Ретро, проекты и проблемы студии ze.studio',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru" className={GeistSans.variable}>
      <body>{children}</body>
    </html>
  );
}
