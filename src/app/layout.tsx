import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { RegulationsOverlay } from "@/components/regulations-overlay";
import { getPlayerSessionPlayerId } from "@/lib/player-session";
import { getAllConfigs, getConfigInt, CONFIG } from "@/lib/config";
import { prisma } from "@/lib/prisma";
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
    icon: { url: "/favicon-64.png", type: "image/png" },
    apple: { url: "/apple-icon.png", sizes: "180x180" },
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const playerId = await getPlayerSessionPlayerId();

  let needsRegulations = false;
  let regulationsText = "";
  let allConfigs: Record<string, string> = {};

  if (playerId) {
    const [player, version, configs] = await Promise.all([
      prisma.player.findUnique({
        where: { id: playerId },
        select: { regulationsAcceptedVersion: true },
      }),
      getConfigInt(CONFIG.REGULATIONS_VERSION),
      getAllConfigs(),
    ]);

    needsRegulations =
      !player?.regulationsAcceptedVersion ||
      player.regulationsAcceptedVersion < version;

    if (needsRegulations) {
      regulationsText = configs[CONFIG.REGULATIONS_TEXT];
      allConfigs = configs;
    }
  }

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
          {needsRegulations && (
            <RegulationsOverlay
              templateText={regulationsText}
              configValues={allConfigs}
            />
          )}
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
