# News AI Assistant

A RAG-powered news chatbot that uses Gemini AI to answer questions based on real-time news articles from RSS feeds.

## 🏗️ Phase 1: Backend Foundation & Data Pipeline ✅

This phase includes:

- Express.js server setup
- RSS news ingestion from multiple sources
- Jina AI embeddings integration
- Qdrant vector database for semantic search
- Complete data pipeline for processing news articles

## 🤖 Phase 2: RAG Backend Implementation ✅

This phase includes:

- Redis-based session management
- RAG pipeline with Gemini AI integration
- Chat API endpoints with conversation history
- Multi-turn conversation support
- Source attribution and context awareness

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set up Environment Variables

Copy the example environment file and add your API keys:

```bash
cp .env.example .env
```

Edit `.env` and add your API keys:

- `GEMINI_API_KEY`: Get from [Google AI Studio](https://aistudio.google.com/)
- `JINA_API_KEY`: Get from [Jina AI](https://jina.ai/)
- `REDIS_URL`: Redis connection URL (e.g., `rediss://default:password@host:6379`)
- `QDRANT_URL`: Qdrant cluster URL (e.g., `https://cluster-id.region.aws.cloud.qdrant.io:6333`)
- `QDRANT_API_KEY`: Qdrant API key for authentication

### 3. Start Services (Qdrant + Redis)

```bash
docker-compose up -d
```

This will start:

- Qdrant on `http://localhost:6333`
- Redis on `localhost:6379`

### 4. Run the Complete Pipeline

```bash
npm run ingest
```

This will:

- Fetch ~50 articles from RSS feeds (Reuters, BBC, TechCrunch)
- Extract article content
- Generate embeddings using Jina AI
- Store articles and embeddings in Qdrant

### 5. Start the Server

```bash
npm start
```

Or for development with auto-restart:

```bash
npm run dev
```

The server will be available at `http://localhost:3000`

### 6. Test the Chat API

```bash
node test-chat.js
```

Or test manually:

```bash
# Send a chat message
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What is the latest news about AI?"}'
```

## 📁 Project Structure

```
src/
├── services/
│   ├── newsIngestion.js    # RSS feed fetching and content extraction
│   ├── embeddings.js       # Jina AI embeddings integration
│   ├── vectorStore.js      # Qdrant vector database operations
│   ├── pipeline.js         # Complete pipeline orchestration
│   ├── sessionManager.js   # Redis-based session management
│   └── ragPipeline.js      # RAG pipeline with Gemini integration
├── routes/
│   └── chat.js            # Chat API endpoints
└── server.js              # Express server setup

data/                      # JSON files with ingested articles
docker-compose.yml         # Qdrant + Redis services setup
test-chat.js              # Chat API testing script
```

## 🛠️ Available Scripts

- `npm start` - Start the production server
- `npm run dev` - Start development server with nodemon
- `npm run ingest` - Run news ingestion and pipeline
- `node test-chat.js` - Test the chat API endpoints
- `node test-connections.js` - Test all external service connections

## 📡 API Endpoints

### Chat Endpoints

- `POST /api/chat` - Send a message and get AI response

  ```json
  {
    "message": "What's the latest AI news?",
    "sessionId": "sess_123" // optional
  }
  ```

- `GET /api/chat/sessions/:sessionId/history` - Get chat history
- `DELETE /api/chat/sessions/:sessionId` - Clear session or delete it
- `GET /api/chat/sessions/:sessionId/stats` - Get session statistics
- `POST /api/chat/sessions` - Create a new session
- `POST /api/chat/test` - Test RAG pipeline

### General Endpoints

- `GET /` - API info

## 🔧 Manual Pipeline Testing

You can test individual components:

```javascript
// Test news ingestion only
const { ingestNews } = require("./src/services/newsIngestion");
ingestNews();

// Test complete pipeline
const NewsPipeline = require("./src/services/pipeline");
const pipeline = new NewsPipeline();
pipeline.runPipeline();
```

## 📊 Data Sources

The system currently ingests from:

- Reuters Top News
- BBC Technology News
- TechCrunch
- Reuters Technology News
- BBC Business News

## 🔍 Search Testing

After running the pipeline, you can test semantic search:

```javascript
const NewsPipeline = require("./src/services/pipeline");
const pipeline = new NewsPipeline();
pipeline.testSearch("artificial intelligence news");
```

## 🐳 Docker Services

- **Qdrant**: Vector database running on port 6333
  - Web UI: Available at `http://localhost:6333/dashboard`
- **Redis**: Session storage running on port 6379

## 🚧 Next Steps (Phase 3)

- Simple web UI for chatting
- Real-time news updates
- Enhanced search filters
- User preferences and topics

## 📝 Notes

- Articles are stored locally in `data/news_articles.json`
- Embeddings use Jina AI's `jina-embeddings-v2-base-en` model
- Vector similarity search uses cosine distance
- Content extraction includes title, description, and full article text
- Duplicate articles are automatically filtered by URL
