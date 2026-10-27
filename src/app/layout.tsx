import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Formulario Debida Diligencia | UDG",
  description: "Formulario de Debida Diligencia para clientes de Urban Development Group",
  icons: {
    icon: "/UDG_LOGO_SMALL.png",
    shortcut: "/UDG_LOGO_SMALL.png",
    apple: "/UDG_LOGO_SMALL.png",
  },
  openGraph: {
    images: [
      {
        url: "https://debida-diligencia.udggroup.com/SMALL_BG.png",
        width: 1200,
        height: 630,
        alt: "UDG Logo",
      },
    ],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      className={`${cormorant.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#052B48]">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
