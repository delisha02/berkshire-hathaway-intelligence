/**
 * Document Ingestion Script for Berkshire Hathaway Shareholder Letters
 * 
 * This script:
 * 1. Reads all PDF files from the Berkshire_Hathaway_Shareholder_Letters folder
 * 2. Parses each PDF and extracts text
 * 3. Chunks the documents using recursive strategy
 * 4. Generates embeddings using OpenAI text-embedding-3-small
 * 5. Stores embeddings in PostgreSQL with pgvector
 */

// Load environment variables first
import 'dotenv/config';

import { embedMany } from 'ai';
import { openai } from '@ai-sdk/openai';
import { PgVector } from '@mastra/pg';
import { MDocument } from '@mastra/rag';
import * as fs from 'fs';
import * as path from 'path';
import { createRequire } from 'module';

// Use createRequire for CommonJS modules
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

// Configuration
const DOCUMENTS_DIR = path.join(process.cwd(), 'Berkshire_Hathaway_Shareholder_Letters', 'Berkshire_Hathaway_Shareholder_Letters');
const INDEX_NAME = 'berkshire_embeddings';
const EMBEDDING_MODEL = 'openai/text-embedding-3-small';
const EMBEDDING_DIMENSION = 1536;
const CHUNK_SIZE = 512;
const CHUNK_OVERLAP = 50;

// Database connection from environment
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
}

if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY environment variable is not set');
    process.exit(1);
}

interface DocumentChunk {
    text: string;
    metadata: {
        source: string;
        year: string;
        chunkIndex: number;
        totalChunks: number;
    };
}

/**
 * Extract text from a PDF file
 */
async function extractTextFromPdf(filePath: string): Promise<string> {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    return data.text;
}

/**
 * Get all PDF files from the documents directory
 */
function getPdfFiles(): string[] {
    const files = fs.readdirSync(DOCUMENTS_DIR);
    return files
        .filter(file => file.toLowerCase().endsWith('.pdf'))
        .map(file => path.join(DOCUMENTS_DIR, file))
        .sort(); // Sort by filename (year)
}

/**
 * Extract year from filename (e.g., "2023.pdf" -> "2023")
 */
function extractYearFromFilename(filePath: string): string {
    const filename = path.basename(filePath, '.pdf');
    return filename;
}

/**
 * Main ingestion function
 */
async function ingestDocuments(): Promise<void> {
    console.log('🚀 Starting document ingestion...\n');

    // Initialize PgVector
    console.log('📦 Connecting to PostgreSQL with pgvector...');
    const pgVector = new PgVector({
        id: 'berkshire-pgvector',
        connectionString: DATABASE_URL!,
    });

    // Create index if it doesn't exist
    console.log(`📊 Creating index "${INDEX_NAME}" if not exists...`);
    try {
        await pgVector.createIndex({
            indexName: INDEX_NAME,
            dimension: EMBEDDING_DIMENSION,
        });
        console.log(`✅ Index "${INDEX_NAME}" is ready\n`);
    } catch (error: any) {
        if (error.message?.includes('already exists')) {
            console.log(`ℹ️  Index "${INDEX_NAME}" already exists, continuing...\n`);
        } else {
            throw error;
        }
    }

    // Get all PDF files
    const pdfFiles = getPdfFiles();
    console.log(`📁 Found ${pdfFiles.length} PDF files to process\n`);

    if (pdfFiles.length === 0) {
        console.error('❌ No PDF files found in the documents directory');
        process.exit(1);
    }

    // Process each PDF file
    let totalChunks = 0;
    let processedFiles = 0;

    for (const pdfPath of pdfFiles) {
        const year = extractYearFromFilename(pdfPath);
        const filename = path.basename(pdfPath);

        console.log(`📄 Processing: ${filename}...`);

        try {
            // Extract text from PDF
            const text = await extractTextFromPdf(pdfPath);

            if (!text || text.trim().length === 0) {
                console.log(`⚠️  Skipping ${filename} - no text content extracted`);
                continue;
            }

            console.log(`   - Extracted ${text.length} characters`);

            // Create MDocument and chunk it
            const doc = MDocument.fromText(text);
            const chunks = await doc.chunk({
                strategy: 'recursive',
                maxSize: CHUNK_SIZE,
                overlap: CHUNK_OVERLAP,
            });

            console.log(`   - Created ${chunks.length} chunks`);

            if (chunks.length === 0) {
                console.log(`⚠️  Skipping ${filename} - no chunks created`);
                continue;
            }

            // Prepare chunk texts and metadata
            const chunkTexts = chunks.map(chunk => chunk.text);
            const metadata = chunks.map((_, index) => ({
                text: chunkTexts[index],
                source: filename,
                year: year,
                chunkIndex: index,
                totalChunks: chunks.length,
            }));

            // Generate embeddings
            console.log('   - Generating embeddings...');
            const { embeddings } = await embedMany({
                model: openai.embedding('text-embedding-3-small'),
                values: chunkTexts,
            });

            console.log(`   - Generated ${embeddings.length} embeddings`);

            // Store in PgVector
            console.log('   - Storing in vector database...');
            await pgVector.upsert({
                indexName: INDEX_NAME,
                vectors: embeddings,
                metadata: metadata,
            });

            totalChunks += chunks.length;
            processedFiles++;
            console.log(`✅ Completed: ${filename} (${chunks.length} chunks)\n`);

        } catch (error: any) {
            console.error(`❌ Error processing ${filename}:`, error.message);
            continue;
        }
    }

    // Summary
    console.log('═'.repeat(50));
    console.log('📊 INGESTION COMPLETE');
    console.log('═'.repeat(50));
    console.log(`✅ Processed: ${processedFiles} / ${pdfFiles.length} files`);
    console.log(`📦 Total chunks stored: ${totalChunks}`);
    console.log(`🗄️  Index name: ${INDEX_NAME}`);
    console.log(`🔢 Embedding dimension: ${EMBEDDING_DIMENSION}`);
    console.log('═'.repeat(50));
}

// Run the ingestion
ingestDocuments().catch((error) => {
    console.error('❌ Fatal error during ingestion:', error);
    process.exit(1);
});
