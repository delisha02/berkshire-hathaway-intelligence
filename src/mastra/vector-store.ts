/**
 * Vector Store Configuration
 * 
 * Sets up the connection to PostgreSQL using the pgvector extension.
 * This is used for storing and retrieving document embeddings for the RAG pipeline.
 */

import { PgVector } from '@mastra/pg';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
}

// Force SSL in production for Render
const getConnectionString = () => {
    if (process.env.NODE_ENV === 'production') {
        try {
            const url = new URL(DATABASE_URL);
            // Verify if it already has ssl param, if not add it
            if (!url.searchParams.has('ssl') && !url.searchParams.has('sslmode')) {
                url.searchParams.set('ssl', 'true');
            }
            return url.toString();
        } catch (e) {
            // Fallback if URL parsing fails (unlikely)
            return DATABASE_URL.includes('?') ? `${DATABASE_URL}&ssl=true` : `${DATABASE_URL}?ssl=true`;
        }
    }
    return DATABASE_URL;
};

export const pgVector = new PgVector({
    id: 'berkshire-pgvector',
    connectionString: getConnectionString(),
});

export const INDEX_NAME = 'berkshire_embeddings';
