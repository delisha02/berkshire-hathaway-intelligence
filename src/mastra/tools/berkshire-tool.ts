/**
 * Berkshire Hathaway Retrieval Tool
 * 
 * This tool enables the agent to perform semantic search across the ingested shareholder letters.
 * 
 * Logic:
 * 1. Generates an embedding for the user's query
 * 2. Searches the PostgreSQL vector database (pgvector) for similar chunks
 * 3. Returns the top K most relevant text segments with metadata
 */

import { createTool } from '@mastra/core/tools';
import { embed } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { pgVector, INDEX_NAME } from '../vector-store';

export const berkshireRetrievalTool = createTool({
    id: 'berkshire-retrieval',
    description: 'Search Berkshire Hathaway shareholder letters for information about Warren Buffett\'s investment philosophy.',
    inputSchema: z.object({
        query: z.string().describe('The search query to find relevant information in shareholder letters.'),
        topK: z.number().optional().default(10).describe('The number of relevant chunks to retrieve (default: 10).'),
    }),
    outputSchema: z.object({
        results: z.array(z.object({
            text: z.string(),
            metadata: z.any(),
            score: z.number(),
        })),
    }),
    execute: async ({ query, topK }) => {
        try {
            console.log('[berkshire-retrieval] Starting query:', query);

            // 1. Generate embedding for the query
            const { embedding } = await embed({
                model: openai.embedding('text-embedding-3-small'),
                value: query,
            });
            console.log('[berkshire-retrieval] Generated embedding, length:', embedding.length);

            // 2. Query the vector database
            console.log('[berkshire-retrieval] Querying vector database...');
            const results = await pgVector.query({
                indexName: INDEX_NAME,
                queryVector: embedding,
                topK: topK || 10,
            });
            console.log('[berkshire-retrieval] Found', results.length, 'results');

            // 3. Format and return results
            const formattedResults = results.map((r) => ({
                text: (r.metadata as any)?.text || '', // We stored the text in metadata during ingestion
                metadata: r.metadata,
                score: r.score,
            }));

            console.log('[berkshire-retrieval] Returning', formattedResults.length, 'formatted results');
            return { results: formattedResults };
        } catch (error: any) {
            console.error('[berkshire-retrieval] Error:', error.message);
            console.error('[berkshire-retrieval] Stack:', error.stack);
            // Return empty results instead of throwing to prevent agent from failing
            return { results: [] };
        }
    },
});
