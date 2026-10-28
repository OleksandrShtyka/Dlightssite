import "./globals.css";

export const metadata = {
  title: "Світло × Кадр — особистий простір",
  description: "Графіки ДТЕК, кінощоденник і фітнес-трекер в одному особистому просторі.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="uk">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
