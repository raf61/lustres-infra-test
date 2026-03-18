import type React from "react"
import type { Metadata } from "next"
import { Inter, Plus_Jakarta_Sans } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"
import { AuthProvider } from "@/components/providers/session-provider"
import { ChatLauncherProvider } from "@/components/chat/chat-launcher"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })
const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta"
})

export const metadata: Metadata = {
  title: "Sistema de Gestão - Controle de Clientes",
  description: "Sistema completo de gestão de clientes, vendas e manutenção técnica",
  generator: 'v0.app'
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" className={`dark ${inter.variable} ${plusJakarta.variable}`}>
      <meta charSet="UTF-8" />

      <body className="antialiased" suppressHydrationWarning>
        <AuthProvider>
          <ChatLauncherProvider>
            {children}
            <Toaster />
          </ChatLauncherProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
