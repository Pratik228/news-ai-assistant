const Redis = require("ioredis");
require("dotenv").config();

class SessionManager {
  constructor() {
    console.log("🔗 Using Redis URL connection");

    this.redis = new Redis(process.env.REDIS_URL, {
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    this.sessionTTL = 24 * 60 * 60; // 24 hours in seconds
    this.sessionPrefix = "session:";
    this.chatHistoryPrefix = "chat_history:";
  }

  /**
   * Generate a unique session ID
   */
  generateSessionId() {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 15);
    return `sess_${timestamp}_${randomStr}`;
  }

  /**
   * Create a new session
   */
  async createSession(title = "New Chat") {
    try {
      const sessionId = this.generateSessionId();

      // Ensure we never create a session with null or undefined title
      const safeTitle =
        title && title.trim() !== "" ? title.trim() : "New Chat";

      const sessionData = {
        id: sessionId,
        title: safeTitle,
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        messageCount: 0,
        isActive: true,
      };

      await this.redis.setex(
        `${this.sessionPrefix}${sessionId}`,
        this.sessionTTL,
        JSON.stringify(sessionData)
      );

      // Initialize empty chat history
      await this.redis.setex(
        `${this.chatHistoryPrefix}${sessionId}`,
        this.sessionTTL,
        JSON.stringify([])
      );

      console.log(
        `✅ Created new session: ${sessionId} with title: "${safeTitle}"`
      );
      return sessionId;
    } catch (error) {
      console.error("Error creating session:", error.message);
      throw error;
    }
  }

  /**
   * Get session data
   */
  async getSession(sessionId) {
    try {
      const sessionData = await this.redis.get(
        `${this.sessionPrefix}${sessionId}`
      );

      if (!sessionData) {
        return null;
      }

      return JSON.parse(sessionData);
    } catch (error) {
      console.error("Error getting session:", error.message);
      throw error;
    }
  }

  /**
   * Update session activity
   */
  async updateSessionActivity(sessionId) {
    try {
      const sessionData = await this.getSession(sessionId);
      if (!sessionData) {
        return false;
      }

      sessionData.lastActivity = new Date().toISOString();
      sessionData.messageCount = (sessionData.messageCount || 0) + 1;

      await this.redis.setex(
        `${this.sessionPrefix}${sessionId}`,
        this.sessionTTL,
        JSON.stringify(sessionData)
      );

      // Also extend the chat history TTL
      await this.redis.expire(
        `${this.chatHistoryPrefix}${sessionId}`,
        this.sessionTTL
      );

      return true;
    } catch (error) {
      console.error("Error updating session activity:", error.message);
      throw error;
    }
  }

  /**
   * Add message to chat history
   */
  async addMessage(sessionId, message) {
    try {
      const chatHistory = await this.getChatHistory(sessionId);
      if (!chatHistory) {
        throw new Error("Session not found");
      }

      const messageData = {
        ...message,
        timestamp: new Date().toISOString(),
      };

      chatHistory.push(messageData);

      await this.redis.setex(
        `${this.chatHistoryPrefix}${sessionId}`,
        this.sessionTTL,
        JSON.stringify(chatHistory)
      );

      // Update session activity
      await this.updateSessionActivity(sessionId);

      console.log(`💬 Added message to session ${sessionId}`);
      return messageData;
    } catch (error) {
      console.error("Error adding message:", error.message);
      throw error;
    }
  }

  /**
   * Get chat history for a session
   */
  async getChatHistory(sessionId, limit = 50) {
    try {
      const chatHistoryData = await this.redis.get(
        `${this.chatHistoryPrefix}${sessionId}`
      );

      if (!chatHistoryData) {
        return null;
      }

      const chatHistory = JSON.parse(chatHistoryData);

      // Return last N messages
      return chatHistory.slice(-limit);
    } catch (error) {
      console.error("Error getting chat history:", error.message);
      throw error;
    }
  }

  /**
   * Clear chat history for a session
   */
  async clearChatHistory(sessionId) {
    try {
      await this.redis.setex(
        `${this.chatHistoryPrefix}${sessionId}`,
        this.sessionTTL,
        JSON.stringify([])
      );

      console.log(`🧹 Cleared chat history for session ${sessionId}`);
      return true;
    } catch (error) {
      console.error("Error clearing chat history:", error.message);
      throw error;
    }
  }

  /**
   * Delete a session completely
   */
  async deleteSession(sessionId) {
    try {
      const pipeline = this.redis.pipeline();

      pipeline.del(`${this.sessionPrefix}${sessionId}`);
      pipeline.del(`${this.chatHistoryPrefix}${sessionId}`);

      await pipeline.exec();

      console.log(`🗑️ Deleted session ${sessionId}`);
      return true;
    } catch (error) {
      console.error("Error deleting session:", error.message);
      throw error;
    }
  }

  /**
   * Get all active sessions (for ChatGPT-like sidebar)
   */
  async getAllSessions() {
    try {
      const keys = await this.redis.keys(`${this.sessionPrefix}*`);
      const sessions = [];

      for (const key of keys) {
        const sessionData = await this.redis.get(key);
        if (sessionData) {
          const session = JSON.parse(sessionData);

          // Fix any existing sessions with null titles
          if (
            !session.title ||
            session.title === null ||
            session.title.trim() === ""
          ) {
            console.log(`🔧 Fixing null title for session ${session.id}`);
            session.title = "New Chat";
            // Update the session in Redis with the fixed title
            await this.redis.setex(
              `${this.sessionPrefix}${session.id}`,
              this.sessionTTL,
              JSON.stringify(session)
            );
          }

          // Get message count for display
          const chatHistory = await this.getChatHistory(session.id, 1);
          session.lastMessage =
            chatHistory && chatHistory.length > 0
              ? chatHistory[chatHistory.length - 1]
              : null;
          sessions.push(session);
        }
      }

      // Sort by last activity (most recent first)
      sessions.sort(
        (a, b) => new Date(b.lastActivity) - new Date(a.lastActivity)
      );

      return sessions;
    } catch (error) {
      console.error("Error getting all sessions:", error.message);
      throw error;
    }
  }

  async updateSessionTitle(sessionId, newTitle) {
    try {
      const sessionData = await this.getSession(sessionId);
      if (!sessionData) {
        throw new Error("Session not found");
      }

      // Ensure we never set null or undefined titles
      const safeTitle =
        newTitle && newTitle.trim() !== "" ? newTitle.trim() : "New Chat";

      sessionData.title = safeTitle;
      sessionData.lastActivity = new Date().toISOString();

      await this.redis.setex(
        `${this.sessionPrefix}${sessionId}`,
        this.sessionTTL,
        JSON.stringify(sessionData)
      );

      console.log(`📝 Updated session title: ${sessionId} -> "${safeTitle}"`);
      return sessionData;
    } catch (error) {
      console.error("Error updating session title:", error.message);
      throw error;
    }
  }

  async autoGenerateTitle(sessionId, firstMessage) {
    try {
      // Always ensure we have a valid title, even if message is short
      if (!firstMessage || firstMessage.trim().length === 0) {
        console.log(
          `⚠️ Empty message provided for title generation in session ${sessionId}`
        );
        return;
      }

      // Generate a title from the first message (truncate to 50 chars)
      // Even short messages should generate a title
      const trimmedMessage = firstMessage.trim();
      const title =
        trimmedMessage.length > 50
          ? trimmedMessage.substring(0, 47) + "..."
          : trimmedMessage;

      console.log(
        `🔄 Auto-generating title for session ${sessionId}: "${title}"`
      );
      await this.updateSessionTitle(sessionId, title);
      console.log(
        `✅ Successfully updated title for session ${sessionId}: "${title}"`
      );
      return title;
    } catch (error) {
      console.error(
        `❌ Error auto-generating title for session ${sessionId}:`,
        error.message
      );
      // Ensure we never leave a session with null title - set a fallback
      try {
        await this.updateSessionTitle(sessionId, "New Chat");
        console.log(`🔄 Set fallback title for session ${sessionId}`);
      } catch (fallbackError) {
        console.error(
          `❌ Failed to set fallback title for session ${sessionId}:`,
          fallbackError.message
        );
      }
    }
  }

  async getSessionSummary(sessionId) {
    try {
      const session = await this.getSession(sessionId);
      if (!session) return null;

      const chatHistory = await this.getChatHistory(sessionId, 1);
      const lastMessage =
        chatHistory && chatHistory.length > 0
          ? chatHistory[chatHistory.length - 1]
          : null;

      return {
        id: session.id,
        title: session.title,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        messageCount: session.messageCount,
        lastMessage: lastMessage
          ? {
              content: lastMessage.content,
              type: lastMessage.type,
              timestamp: lastMessage.timestamp,
            }
          : null,
      };
    } catch (error) {
      console.error("Error getting session summary:", error.message);
      throw error;
    }
  }

  async sessionExists(sessionId) {
    try {
      const exists = await this.redis.exists(
        `${this.sessionPrefix}${sessionId}`
      );
      return exists === 1;
    } catch (error) {
      console.error("Error checking session existence:", error.message);
      return false;
    }
  }

  /**
   * Get session statistics
   */
  async getSessionStats(sessionId) {
    try {
      const session = await this.getSession(sessionId);
      const chatHistory = await this.getChatHistory(sessionId);

      if (!session) {
        return null;
      }

      return {
        sessionId,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        messageCount: session.messageCount,
        historyLength: chatHistory ? chatHistory.length : 0,
        ttl: await this.redis.ttl(`${this.sessionPrefix}${sessionId}`),
      };
    } catch (error) {
      console.error("Error getting session stats:", error.message);
      throw error;
    }
  }

  /**
   * Close Redis connection
   */
  async close() {
    try {
      await this.redis.quit();
      console.log("🔌 Redis connection closed");
    } catch (error) {
      console.error("Error closing Redis connection:", error.message);
    }
  }
}

module.exports = SessionManager;
