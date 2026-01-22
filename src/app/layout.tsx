import type { Metadata } from "next";
import { MastraProvider } from "../components/MastraProvider";
import "./globals.css";

export const metadata: Metadata = {
    title: "Berkshire Hathaway Intelligence",
    description: "AI Analyst for Warren Buffett's Shareholder Letters",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className="antialiased">
                <MastraProvider>
                    {children}
                </MastraProvider>
            </body>
        </html>
    );
}
