const { GoogleGenerativeAI } = require("@google/generative-ai");
const JinaEmbeddings = require("./embeddings");
const VectorStore = require("./vectorStore");
require("dotenv").config();

class RAGPipeline {
  constructor() {
    this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.gemini.getGenerativeModel({ model: "gemini-1.5-flash" });

    this.embeddings = new JinaEmbeddings(process.env.JINA_API_KEY);
    this.vectorStore = new VectorStore(
      process.env.QDRANT_URL || "http://localhost:6333",
      process.env.QDRANT_API_KEY
    );

    this.maxContextArticles = 5;
    this.minSimilarityScore = 0.6;
  }

  async processQuery(query, sessionId = null) {
    try {
      console.log(`🔍 Processing query: "${query}"`);

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
        return {
          response:
            "I couldn't find any relevant news articles to answer your question. Please try rephrasing your question or ask about a different topic.",
          sources: [],
          sessionId,
        };
      }

      // Step 3: Prepare context for Gemini
      const context = this.prepareContext(relevantArticles);

      // Step 4: Generate response using Gemini
      const response = await this.generateResponse(
        query,
        context,
        relevantArticles
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
      console.error("Error in RAG pipeline:", error.message);

      // Return a fallback response
      return {
        response:
          "I'm sorry, I encountered an error while processing your question. Please try again later.",
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

  async generateResponse(query, context, sources) {
    try {
      const prompt = `You are a helpful news assistant. Answer the user's question based on the provided news articles. 

IMPORTANT INSTRUCTIONS:
- Use ONLY information from the provided articles
- If the articles don't contain enough information to answer the question, say so clearly
- Be concise but informative
- Mention the sources when relevant
- Don't make up information that isn't in the articles
- If asked about topics not covered in the articles, politely explain that you don't have recent information on that topic

USER QUESTION: ${query}

${context}

Please provide a helpful response based on the above articles:`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      return text;
    } catch (error) {
      console.error("Error generating Gemini response:", error.message);

      // Fallback response if Gemini fails
      return `Based on recent news, I found some relevant articles but couldn't generate a detailed response. Here are the key sources that might help answer your question: ${sources
        .map((s) => s.title)
        .join(", ")}.`;
    }
  }

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

  async processQueryWithContext(query, chatHistory, sessionId = null) {
    try {
      console.log(`🔍 Processing contextual query: "${query}"`);

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
        return {
          response:
            "I couldn't find any relevant news articles to answer your question. Please try rephrasing your question or ask about a different topic.",
          sources: [],
          sessionId,
        };
      }

      // Prepare context for Gemini
      const articlesContext = this.prepareContext(relevantArticles);

      // Combine conversation context with articles context
      const fullContext = conversationContext + articlesContext;

      // Generate response using Gemini
      const response = await this.generateContextualResponse(
        query,
        fullContext,
        relevantArticles
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
      console.error("Error in contextual RAG pipeline:", error.message);

      return {
        response:
          "I'm sorry, I encountered an error while processing your question. Please try again later.",
        sources: [],
        sessionId,
        error: error.message,
      };
    }
  }

  async generateContextualResponse(query, fullContext, sources) {
    try {
      const prompt = `You are a helpful news assistant having a conversation with a user. Answer the user's question based on the provided news articles and conversation context.

IMPORTANT INSTRUCTIONS:
- Use information from both the conversation history and the provided articles
- Be conversational and reference previous parts of the conversation when relevant
- Use ONLY information from the provided articles for factual claims
- If the articles don't contain enough information, say so clearly
- Be concise but informative
- Mention the sources when relevant
- Don't make up information that isn't in the articles

${fullContext}

CURRENT USER QUESTION: ${query}

Please provide a helpful response that considers both the conversation context and the recent articles:`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      return text;
    } catch (error) {
      console.error(
        "Error generating contextual Gemini response:",
        error.message
      );

      return `Based on our conversation and recent news, I found some relevant articles but couldn't generate a detailed response. Here are the key sources that might help: ${sources
        .map((s) => s.title)
        .join(", ")}.`;
    }
  }

  async testPipeline(
    testQuery = "What's the latest news about artificial intelligence?"
  ) {
    try {
      console.log("🧪 Testing RAG pipeline...");

      const result = await this.processQuery(testQuery);

      console.log("📋 Test Results:");
      console.log(`Query: ${testQuery}`);
      console.log(`Response: ${result.response}`);
      console.log(`Sources: ${result.sources.length} articles found`);

      result.sources.forEach((source, index) => {
        console.log(`  ${index + 1}. ${source.title} (${source.source})`);
      });

      return result;
    } catch (error) {
      console.error("RAG pipeline test failed:", error.message);
      throw error;
    }
  }
}

module.exports = RAGPipeline;
