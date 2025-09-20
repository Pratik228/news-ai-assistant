const { GoogleGenerativeAI } = require("@google/generative-ai");
const JinaEmbeddings = require("./embeddings");
const VectorStore = require("./vectorStore");
require("dotenv").config();

class StreamingRAGPipeline {
  constructor() {
    this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.gemini.getGenerativeModel({ model: "gemini-1.5-flash" });

    this.embeddings = new JinaEmbeddings(process.env.JINA_API_KEY);
    this.vectorStore = new VectorStore();

    this.maxContextArticles = 5;
    this.minSimilarityScore = 0.6;
  }

  async processQueryStream(query, sessionId = null, socket = null) {
    try {
      console.log(`🔍 Processing streaming query: "${query}"`);

      // Step 1: Generate embedding for the query
      const queryResult = await this.embeddings.embedText(query);
      const queryEmbedding = queryResult.embedding;

      // Step 2: Search for relevant articles
      const relevantArticles = await this.vectorStore.searchSimilar(
        queryEmbedding,
        this.maxContextArticles,
        this.minSimilarityScore
      );

      console.log(`📰 Found ${relevantArticles.length} relevant articles`);

      if (relevantArticles.length === 0) {
        const fallbackResponse =
          "I couldn't find any relevant news articles to answer your question. Please try rephrasing your question or ask about a different topic.";

        if (socket) {
          socket.emit("stream-complete", {
            response: fallbackResponse,
            sources: [],
            sessionId,
          });
        }

        return {
          response: fallbackResponse,
          sources: [],
          sessionId,
        };
      }

      // Step 3: Prepare context for Gemini
      const context = this.prepareContext(relevantArticles);

      // Step 4: Generate streaming response using Gemini
      const response = await this.generateStreamingResponse(
        query,
        context,
        relevantArticles,
        sessionId,
        socket
      );

      return {
        response: response,
        sources: relevantArticles.map((article) => ({
          title: article.title,
          url: article.url,
          source: article.source,
          publishedAt: article.publishedAt,
          score: article.score,
        })),
        sessionId,
      };
    } catch (error) {
      console.error("Error in streaming RAG pipeline:", error.message);

      const errorResponse =
        "I'm sorry, I encountered an error while processing your question. Please try again later.";

      if (socket) {
        socket.emit("stream-complete", {
          response: errorResponse,
          sources: [],
          sessionId,
          error: error.message,
        });
      }

      return {
        response: errorResponse,
        sources: [],
        sessionId,
        error: error.message,
      };
    }
  }

  /**
   * Prepare context from relevant articles
   */
  prepareContext(articles) {
    let context = "Based on the following recent news articles:\n\n";

    articles.forEach((article, index) => {
      context += `Article ${index + 1}: ${article.title}\n`;
      context += `Source: ${article.source}\n`;
      context += `Published: ${article.publishedAt}\n`;

      if (article.description) {
        context += `Summary: ${article.description}\n`;
      }

      if (article.content) {
        // Limit content to avoid token limits
        const content = article.content.substring(0, 1000);
        context += `Content: ${content}\n`;
      }

      context += "\n";
    });

    return context;
  }

  /**
   * Generate streaming response using Gemini
   */
  async generateStreamingResponse(query, context, sources, sessionId, socket) {
    try {
      const prompt = `You are a helpful news assistant. Answer the user's question based on the provided news articles using professional markdown formatting.

IMPORTANT INSTRUCTIONS:
- Use ONLY information from the provided articles
- If the articles don't contain enough information to answer the question, say so clearly
- Be concise but informative
- Mention the sources when relevant
- Don't make up information that isn't in the articles
- If asked about topics not covered in the articles, politely explain that you don't have recent information on that topic

FORMATTING REQUIREMENTS:
- Use **bold text** for key points and important information
- Use bullet points (-) for lists and multiple items
- Use ## subheadings when discussing different topics
- Use clear paragraph breaks for readability
- Use > blockquotes for direct quotes or important statements
- Use [link text](URL) format for any URLs mentioned
- Use *italics* for emphasis on specific terms

USER QUESTION: ${query}

${context}

Please provide a well-formatted markdown response based on the above articles:`;

      const result = await this.model.generateContentStream(prompt);
      let fullResponse = "";

      // Stream the response in chunks
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        fullResponse += chunkText;

        // Emit streaming chunk to socket
        if (socket) {
          socket.emit("stream-chunk", {
            chunk: chunkText,
            sessionId: sessionId,
          });
        }
      }

      // Emit completion signal
      if (socket) {
        socket.emit("stream-complete", {
          response: fullResponse,
          sources: sources.map((s) => ({
            title: s.title,
            url: s.url,
            source: s.source,
            publishedAt: s.publishedAt,
            score: s.score,
          })),
          sessionId: sessionId,
        });
      }

      return fullResponse;
    } catch (error) {
      console.error("Error generating streaming response:", error.message);

      const fallbackResponse = `Based on recent news, I found some relevant articles but couldn't generate a detailed response. Here are the key sources that might help: ${sources
        .map((s) => s.title)
        .join(", ")}.`;

      if (socket) {
        socket.emit("stream-complete", {
          response: fallbackResponse,
          sources: sources.map((s) => ({
            title: s.title,
            url: s.url,
            source: s.source,
            publishedAt: s.publishedAt,
            score: s.score,
          })),
          sessionId: sessionId,
        });
      }

      return fallbackResponse;
    }
  }

  /**
   * Process query with conversation context (streaming)
   */
  async processQueryWithContextStream(
    query,
    chatHistory,
    sessionId = null,
    socket = null
  ) {
    try {
      console.log(`🔍 Processing contextual streaming query: "${query}"`);

      // Get conversation context
      const conversationContext = await this.getConversationContext(
        chatHistory
      );

      // Generate embedding for the query
      const queryResult = await this.embeddings.embedText(query);
      const queryEmbedding = queryResult.embedding;

      // Search for relevant articles
      const relevantArticles = await this.vectorStore.searchSimilar(
        queryEmbedding,
        this.maxContextArticles,
        this.minSimilarityScore
      );

      console.log(`📰 Found ${relevantArticles.length} relevant articles`);

      if (relevantArticles.length === 0) {
        const fallbackResponse =
          "I couldn't find any relevant news articles to answer your question. Please try rephrasing your question or ask about a different topic.";

        if (socket) {
          socket.emit("stream-complete", {
            response: fallbackResponse,
            sources: [],
            sessionId,
          });
        }

        return {
          response: fallbackResponse,
          sources: [],
          sessionId,
        };
      }

      // Prepare context for Gemini
      const articlesContext = this.prepareContext(relevantArticles);

      // Combine conversation context with articles context
      const fullContext = conversationContext + articlesContext;

      // Generate streaming response using Gemini
      const response = await this.generateContextualStreamingResponse(
        query,
        fullContext,
        relevantArticles,
        sessionId,
        socket
      );

      return {
        response: response,
        sources: relevantArticles.map((article) => ({
          title: article.title,
          url: article.url,
          source: article.source,
          publishedAt: article.publishedAt,
          score: article.score,
        })),
        sessionId,
      };
    } catch (error) {
      console.error(
        "Error in contextual streaming RAG pipeline:",
        error.message
      );

      const errorResponse =
        "I'm sorry, I encountered an error while processing your question. Please try again later.";

      if (socket) {
        socket.emit("stream-complete", {
          response: errorResponse,
          sources: [],
          sessionId,
          error: error.message,
        });
      }

      return {
        response: errorResponse,
        sources: [],
        sessionId,
        error: error.message,
      };
    }
  }

  /**
   * Generate contextual streaming response using Gemini
   */
  async generateContextualStreamingResponse(
    query,
    fullContext,
    sources,
    sessionId,
    socket
  ) {
    try {
      const prompt = `You are a helpful news assistant having a conversation with a user. Answer the user's question based on the provided news articles and conversation context using professional markdown formatting.

IMPORTANT INSTRUCTIONS:
- Use information from both the conversation history and the provided articles
- Be conversational and reference previous parts of the conversation when relevant
- Use ONLY information from the provided articles for factual claims
- If the articles don't contain enough information, say so clearly
- Be concise but informative
- Mention the sources when relevant
- Don't make up information that isn't in the articles

FORMATTING REQUIREMENTS:
- Use **bold text** for key points and important information
- Use bullet points (-) for lists and multiple items
- Use ## subheadings when discussing different topics
- Use clear paragraph breaks for readability
- Use > blockquotes for direct quotes or important statements
- Use [link text](URL) format for any URLs mentioned
- Use *italics* for emphasis on specific terms

${fullContext}

CURRENT USER QUESTION: ${query}

Please provide a well-formatted markdown response that considers both the conversation context and the recent articles:`;

      const result = await this.model.generateContentStream(prompt);
      let fullResponse = "";

      // Stream the response in chunks
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        fullResponse += chunkText;

        // Emit streaming chunk to socket
        if (socket) {
          socket.emit("stream-chunk", {
            chunk: chunkText,
            sessionId: sessionId,
          });
        }
      }

      // Emit completion signal
      if (socket) {
        socket.emit("stream-complete", {
          response: fullResponse,
          sources: sources.map((s) => ({
            title: s.title,
            url: s.url,
            source: s.source,
            publishedAt: s.publishedAt,
            score: s.score,
          })),
          sessionId: sessionId,
        });
      }

      return fullResponse;
    } catch (error) {
      console.error(
        "Error generating contextual streaming response:",
        error.message
      );

      const fallbackResponse = `Based on our conversation and recent news, I found some relevant articles but couldn't generate a detailed response. Here are the key sources that might help: ${sources
        .map((s) => s.title)
        .join(", ")}.`;

      if (socket) {
        socket.emit("stream-complete", {
          response: fallbackResponse,
          sources: sources.map((s) => ({
            title: s.title,
            url: s.url,
            source: s.source,
            publishedAt: s.publishedAt,
            score: s.score,
          })),
          sessionId: sessionId,
        });
      }

      return fallbackResponse;
    }
  }

  /**
   * Get conversation context for multi-turn conversations
   */
  async getConversationContext(chatHistory, maxHistoryLength = 10) {
    if (!chatHistory || chatHistory.length === 0) {
      return "";
    }

    // Get recent messages (last N messages)
    const recentMessages = chatHistory.slice(-maxHistoryLength);

    let context = "Previous conversation context:\n";
    recentMessages.forEach((message, index) => {
      if (message.type === "user") {
        context += `User: ${message.content}\n`;
      } else if (message.type === "assistant") {
        context += `Assistant: ${message.content}\n`;
      }
    });

    context += "\n";
    return context;
  }
}

module.exports = StreamingRAGPipeline;
