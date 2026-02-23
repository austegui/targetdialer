import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "TargetDialer — Meeting Intelligence",
  description: "AI-powered meeting transcription and summarization for the TargetDial team",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
