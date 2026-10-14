import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google";
import "./globals.css";

// Dark theme fonts.
const body = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

const heading = Space_Grotesk({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

// Light theme font.
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

const code = JetBrains_Mono({
  variable: "--font-code",
  subsets: ["latin"],
});

// Runs before the page paints, so a light-theme visitor never sees a dark flash. Key matches lib/theme.ts.
const THEME_SCRIPT = `try{if(localStorage.getItem("infrasentinel.theme")==="light")document.documentElement.dataset.theme="light"}catch(e){}`;

export const metadata: Metadata = {
  title: "InfraSentinel",
  description: "Live infrastructure risk intelligence for any city",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The theme script sets data-theme before React loads, so the attribute differs from the server's.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${body.variable} ${heading.variable} ${jakarta.variable} ${code.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="h-full">{children}</body>
    </html>
  );
}
