import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://britball.io"),
  title: {
    default: "Britball Archive | UK American Football History",
    template: "%s | Britball Archive",
  },
  description:
    "The historical record of American football in the United Kingdom. Scores, standings, playoffs, and team records from 1985 to present.",
  openGraph: {
    title: "Britball Archive | UK American Football History",
    description:
      "The definitive historical archive of British American football. Scores, standings, and historical records.",
    url: "https://britball.io",
    siteName: "Britball Archive",
    locale: "en_GB",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Britball Archive",
    description:
      "The definitive historical archive of British American football.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
