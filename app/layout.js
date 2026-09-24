import './globals.css';

export const metadata = {
  title: 'Журнал студии',
  description: 'Встречи, заметки, решения и ретро по всем проектам ze.studio',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
