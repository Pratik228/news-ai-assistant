# News AI Assistant

A RAG-powered news chatbot that uses Gemini AI to answer questions based on real-time news articles from RSS feeds.

## 🏗️ Phase 1: Backend Foundation & Data Pipeline

This phase includes:

- Express.js server setup
- RSS news ingestion from multiple sources
- Jina AI embeddings integration
- Qdrant vector database for semantic search
- Complete data pipeline for processing news articles

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

### 3. Start Qdrant Vector Database

```bash
docker-compose up -d
```

This will start Qdrant on `http://localhost:6333`

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

## 📁 Project Structure

```
src/
├── services/
│   ├── newsIngestion.js    # RSS feed fetching and content extraction
│   ├── embeddings.js       # Jina AI embeddings integration
│   ├── vectorStore.js      # Qdrant vector database operations
│   └── pipeline.js         # Complete pipeline orchestration
├── routes/
│   └── chat.js            # Chat API endpoints (Phase 2)
└── server.js              # Express server setup

data/                      # JSON files with ingested articles
docker-compose.yml         # Qdrant database setup
```

## 🛠️ Available Scripts

- `npm start` - Start the production server
- `npm run dev` - Start development server with nodemon
- `npm run ingest` - Run news ingestion and pipeline

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
- **Web UI**: Available at `http://localhost:6333/dashboard`

## 🚧 Next Steps (Phase 2)

- Chat API endpoints with Gemini AI integration
- Session management
- Simple web UI for chatting
- Real-time news updates

## 📝 Notes

- Articles are stored locally in `data/news_articles.json`
- Embeddings use Jina AI's `jina-embeddings-v2-base-en` model
- Vector similarity search uses cosine distance
- Content extraction includes title, description, and full article text
- Duplicate articles are automatically filtered by URL
