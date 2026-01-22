
import { PgVector } from '@mastra/pg';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
}

export const pgVector = new PgVector({
    id: 'berkshire-pgvector',
    connectionString: DATABASE_URL,
});

export const INDEX_NAME = 'berkshire_embeddings';
