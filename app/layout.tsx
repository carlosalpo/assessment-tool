import "./globals.css";

export const metadata = {
  title: "NetIQ Assessment Platform",
  description: "Cisco infrastructure assessment workspace"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
