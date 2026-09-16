import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { BlockchainProviders } from "@/Providers/BlockchainProviders";
import { Toaster } from "sonner";
import { IsFarcasterProvider } from "./context/isFarcasterContext";
import { AuthProvider } from "./context/AuthContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Chamapay",
  description: "The circular savings app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`bg-gypsum  border-gray shadow-lg shadow-stone-400 border-rounded-lg max-w-sm mx-auto  min-h-screen ${inter.className}`}
      >
        <BlockchainProviders>
          <IsFarcasterProvider>
            <AuthProvider>
              <Toaster /> {children}
            </AuthProvider>
          </IsFarcasterProvider>
        </BlockchainProviders>
      </body>
    </html>
  );
}
