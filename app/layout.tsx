import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "RE Model Radar — Technical AI intelligence",
  description:
    "Evidence-backed model rankings for security research, reverse engineering, and systems development.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
