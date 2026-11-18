import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Interactive Assets",
  description: "Interactive 3D and AR web experiences.",
  openGraph: {
    title: "Interactive Assets",
    description: "Interactive 3D and AR web experiences.",
    locale: "en_US",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="font-sans antialiased"
    >
      <body className="min-h-dvh flex flex-col overflow-x-hidden">{children}</body>
    </html>
  );
}
