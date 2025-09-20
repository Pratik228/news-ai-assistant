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

## 🚀 Phase 3: Enhanced Backend Features ✅

This phase includes:

- **Comprehensive Session Management**: ChatGPT-like session sidebar support
- **Real-time Chat with Socket.IO**: Streaming responses and live updates
- **Session CRUD Operations**: Create, read, update, delete sessions
- **Auto-title Generation**: Sessions automatically get titles from first message
- **Redis Persistence**: All sessions and chat history stored in Redis
- **Streaming AI Responses**: Real-time typed responses like ChatGPT
- **Session Metadata**: Titles, timestamps, message counts, and activity tracking
- **Session Title Editing**: Edit session names with pencil icon
- **Session Deletion**: Delete sessions with trash icon
- **Real-time Updates**: Live session updates across all connected clients

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
│   ├── newsIngestion.js        # RSS feed fetching and content extraction
│   ├── embeddings.js           # Jina AI embeddings integration
│   ├── vectorStore.js          # Qdrant vector database operations
│   ├── pipeline.js             # Complete pipeline orchestration
│   ├── sessionManager.js       # Redis-based session management
│   ├── ragPipeline.js          # RAG pipeline with Gemini integration
│   └── streamingRagPipeline.js # Streaming RAG with Socket.IO support
├── routes/
│   ├── chat.js                 # REST API chat endpoints
│   └── socketChat.js           # Socket.IO real-time chat handler
├── server.js                   # Express server with Socket.IO setup
└── debug-sessions.js           # Debug tool for Redis session inspection

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

### Session Management Endpoints

- `GET /api/chat/sessions` - Get all sessions (for sidebar)
- `POST /api/chat/sessions` - Create a new session
  ```json
  {
    "title": "New Chat" // optional
  }
  ```
- `GET /api/chat/sessions/:sessionId` - Get session details
- `PUT /api/chat/sessions/:sessionId` - Update session title
  ```json
  {
    "title": "Updated Session Name"
  }
  ```
- `DELETE /api/chat/sessions/:sessionId?deleteSession=true` - Delete session
- `GET /api/chat/sessions/:sessionId/history` - Get chat history
- `GET /api/chat/sessions/:sessionId/stats` - Get session statistics

### Socket.IO Events (Real-time)

#### **Client → Server Events:**

- `join-session` - Join a session room
- `leave-session` - Leave a session room
- `send-message` - Send message and get streaming response
- `get-history` - Get session chat history
- `create-session` - Create new session
- `get-sessions` - Get all sessions
- `update-session-title` - Update session title
- `delete-session` - Delete session
- `typing` - Typing indicator

#### **Server → Client Events:**

- `stream-chunk` - Receive streaming response chunks
- `stream-complete` - Streaming response completed
- `session-created` - New session created
- `session-updated` - Session title updated
- `session-title-updated` - Session title updated (broadcast)
- `session-deleted` - Session deleted
- `chat-history` - Session chat history received
- `sessions-list` - All sessions list received
- `joined-session` - Confirmed joined session room
- `error` - Error occurred

### General Endpoints

- `GET /` - API info
- `GET /health` - Health check
- `POST /api/chat/test` - Test RAG pipeline

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
