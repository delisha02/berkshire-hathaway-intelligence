"use client";

import { MastraReactProvider } from "@mastra/react";

export function MastraProvider({ children }: { children: React.ReactNode }) {
    // Use empty baseUrl to use relative URLs - Next.js rewrites will proxy to Mastra backend
    return (
        <MastraReactProvider baseUrl="">
            {children}
        </MastraReactProvider>
    );
}
