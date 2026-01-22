# Berkshire Hathaway Intelligence - Testing & Deployment Guide

## Phase 5.1: Application Testing

### 1. RAG Pipeline Testing (Mastra Studio)

Access the Mastra Development Playground at: **http://localhost:4111**

#### Test Cases for RAG Pipeline:

| Test Case | Query | Expected Behavior |
|-----------|-------|-------------------|
| Basic Retrieval | "What is Warren Buffett's investment philosophy?" | Returns response with citations from multiple letters |
| Specific Year | "What did Berkshire acquire in 2023?" | Returns acquisitions from 2023 letter with source attribution |
| Multi-Context | "How has Buffett's view on technology stocks evolved?" | Synthesizes information across multiple years |
| No Data | "What did Buffett say about TikTok?" | Gracefully indicates limited information |

### 2. Conversation Memory Testing

Test memory persistence with follow-up questions:

1. Ask: "What is Buffett's view on diversification?"
2. Follow up: "Can you elaborate on that?"
3. Verify: The response references the previous context without repeating the original question

### 3. Source Attribution Testing

Verify citations appear correctly:
- Year references like (2019), (2023) should render as citation badges
- Multiple sources should be deduplicated
- Sources section should appear at bottom of responses

### 4. Streaming Performance Testing

Monitor in browser DevTools (Network tab):
- Responses should start appearing within 1-2 seconds
- Text should stream character-by-character
- Loading indicator should show during generation

---

## Phase 5.2: Production Preparation

### 1. Deployment Configuration

#### Option A: Mastra Cloud (Recommended)

```bash
# Install Mastra CLI if not installed
npm install -g mastra

# Login to Mastra Cloud
mastra login

# Deploy
mastra deploy
```

#### Option B: Docker Deployment

Create `Dockerfile`:
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000 4111
CMD ["npm", "start"]
```

#### Option C: Vercel/Railway

For the Next.js frontend:
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy frontend
vercel
```

### 2. Environment Variables for Production

Create `.env.production`:
```env
OPENAI_API_KEY=your-production-key
DATABASE_URL=your-production-database-url
NODE_ENV=production
```

### 3. Monitoring & Observability

Mastra provides built-in observability. Enable in `src/mastra/index.ts`:

```typescript
import { Mastra } from "@mastra/core";
import { LibSQLStore } from "@mastra/libsql";

export const mastra = new Mastra({
    agents: { berkshireAgent },
    storage: new LibSQLStore({
        url: process.env.DATABASE_URL || "file:./mastra.db",
    }),
    // Enable observability
    telemetry: {
        enabled: true,
        serviceName: "berkshire-intelligence",
    },
});
```

### 4. Error Handling

The application includes:
- ✅ Try-catch blocks around API calls
- ✅ Graceful fallbacks for title generation
- ✅ Loading states for async operations
- ✅ Network error handling in useChat hook

### 5. Health Check Endpoint

The Mastra API automatically provides health endpoints at:
- `http://localhost:4111/api/health`

---

## Pre-Deployment Checklist

- [ ] All environment variables configured
- [ ] Database connection tested
- [ ] OpenAI API key valid and has sufficient credits
- [ ] Vector store populated with shareholder letters
- [ ] Conversation memory persistence verified
- [ ] Error handling tested
- [ ] README documentation complete

## Quick Commands

```bash
# Development
npm run dev:all

# Build for production
npm run build

# Start production server
npm start

# Run Mastra in production
mastra start --port 4111
```
