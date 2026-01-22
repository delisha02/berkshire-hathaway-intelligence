
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
        topK: z.number().optional().default(5).describe('The number of relevant chunks to retrieve.'),
    }),
    outputSchema: z.object({
        results: z.array(z.object({
            text: z.string(),
            metadata: z.any(),
            score: z.number(),
        })),
    }),
    execute: async ({ query, topK }) => {
        // 1. Generate embedding for the query
        const { embedding } = await embed({
            model: openai.embedding('text-embedding-3-small'),
            value: query,
        });

        // 2. Query the vector database
        const results = await pgVector.query({
            indexName: INDEX_NAME,
            queryVector: embedding,
            topK,
        });

        // 3. Format and return results
        return {
            results: results.map((r) => ({
                text: (r.metadata as any)?.text || '', // We stored the text in metadata during ingestion
                metadata: r.metadata,
                score: r.score,
            })),
        };
    },
});
