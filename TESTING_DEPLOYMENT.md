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

### 1. Deployment Configuration (Render)

*Per the assignment requirements to provide "Deployment notes based on Mastra's deployment options", this project utilizes **Render** as the deployment provider.*

**Why Render?**
- Fully compatible with **Mastra's Node.js runtime**.
- Native support for **PostgreSQL with pgvector** (Essential for Mastra RAG).
- Supports the multi-service architecture (Backend + Frontend) defined in `render.yaml`.

#### Deployment Steps (Infrastructure as Code):
1. Push code to GitHub.
2. Go to [Render Dashboard](https://dashboard.render.com/).
3. Click **New +** → **Blueprint**.
4. Connect your GitHub repository.
5. Render will automatically detect `render.yaml` and provision:
   - **PostgreSQL Database** (with pgvector)
   - **Web Service** (Mastra + Next.js)
6. **Manual Action**: Set your `OPENAI_API_KEY` in the Render Dashboard environment variables.

For official Mastra deployment guides, see [Mastra Deployment Documentation](https://mastra.ai/docs/deployment).

### 2. Environment Variables for Production

Ensure these are set in your Render Service settings:

| Variable | Description | Value |
|----------|-------------|-------|
| `OPENAI_API_KEY` | Required for Agents & Embeddings | `sk-...` |
| `DATABASE_URL` | Auto-set by Render Blueprint | `postgres://...` |
| `NODE_ENV` | Optimization flag | `production` |

### 3. Monitoring & Observability

Mastra provides built-in observability features. In `src/mastra/index.ts`, we ensure telemetry is configured:

```typescript
// src/mastra/index.ts
export const mastra = new Mastra({
    // ...
    telemetry: {
        enabled: true,
        serviceName: "berkshire-intelligence",
    },
});
```

Check logs in the Render "Logs" tab for real-time agent activity.

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
