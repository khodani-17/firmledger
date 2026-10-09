import "./globals.css";

export const metadata = {
  title: "FirmLedger",
  description: "Financial management for modern law firms",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-ZA">
      <body>{children}</body>
    </html>
  );
}