"use client";

import { MastraReactProvider } from "@mastra/react";

export function MastraProvider({ children }: { children: React.ReactNode }) {
    return (
        <MastraReactProvider baseUrl="http://localhost:4111">
            {children}
        </MastraReactProvider>
    );
}
