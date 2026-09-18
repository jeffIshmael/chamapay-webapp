import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { BlockchainProviders } from "@/Providers/BlockchainProviders";
import { Toaster } from "sonner";
import { IsFarcasterProvider } from "./context/isFarcasterContext";
import { AuthProvider } from "./context/AuthContext";
import AddToHomeScreen from "./Components/AddToHomeScreen";
import CurrencyLocationBootstrap from "./Components/CurrencyLocationBootstrap";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Chamapay",
  description: "Save as a circle. Grow as one.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Chamapay",
  },
  icons: {
    icon: [
      { url: "/icon.png", sizes: "192x192", type: "image/png" },
      { url: "/logo-icon.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body className={`${jakarta.className} antialiased`}>
        <div className="app-viewport">
          <div className="app-shell">
            <div className="app-shell-scroll">
              <BlockchainProviders>
                <IsFarcasterProvider>
                  <AuthProvider>
                    <Toaster position="top-center" richColors closeButton />
                    <CurrencyLocationBootstrap />
                    {children}
                    <AddToHomeScreen />
                  </AuthProvider>
                </IsFarcasterProvider>
              </BlockchainProviders>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
