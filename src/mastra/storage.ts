/**
 * Persistent Storage Configuration
 * 
 * Configures LibSQL (SQLite) for storing agent memory (conversation history),
 * workflows states, and other improved persistent data.
 */

import { LibSQLStore } from '@mastra/libsql';

export const storage = new LibSQLStore({
    id: "mastra-storage",
    url: "file:mastra.db",
});
