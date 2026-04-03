import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  variable: "--font-heebo",
});

export const metadata: Metadata = {
  title: {
    default: "IRBA",
    template: "\u200EIRBA \u00B7 %s",
  },
  description: "הרשמה למפגשים — IRBA",
  icons: {
    shortcut: "/favicon.ico",
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: { url: "/apple-icon.png", sizes: "180x180" },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="he"
      dir="rtl"
      className={`${heebo.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-zinc-50 font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          storageKey="irba-theme"
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
