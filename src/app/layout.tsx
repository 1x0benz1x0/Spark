import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { MediaStopper } from "./components/MediaStopper";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MCHS Chat",
  description: "Instagram-style social app for MCHS",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <MediaStopper />
        {children}
      </body>
    </html>
  );
}
