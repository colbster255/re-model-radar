import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "RE Model Radar — The open-weight top 10",
  description:
    "The top 10 open-weight models for RE-adjacent coding, reasoning and long tasks, with fresh benchmark results and simple call pricing.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
