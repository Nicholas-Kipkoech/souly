import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Soully — Real People. Meaningful Connections.",
  description: "Meet someone who gets you. Soully is the dating app for real relationships and meaningful connections.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
