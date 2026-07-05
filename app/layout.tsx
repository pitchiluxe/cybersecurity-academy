import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IT Playground",
  description: "Practice being IT support against an AI end-user.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
