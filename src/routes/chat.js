const express = require("express");
const router = express.Router();
const SessionManager = require("../services/sessionManager");
const RAGPipeline = require("../services/ragPipeline");

// Initialize services
const sessionManager = new SessionManager();
const ragPipeline = new RAGPipeline();

// Helper function to get io instance
const getIO = (req) => {
  return req.app.get("io");
};

router.post("/", async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    // Validate input
    if (
      !message ||
      typeof message !== "string" ||
      message.trim().length === 0
    ) {
      return res.status(400).json({
        error: "Message is required and must be a non-empty string",
      });
    }

    // Create new session if none provided
    let currentSessionId = sessionId;
    let isNewSession = false;

    if (!currentSessionId) {
      currentSessionId = await sessionManager.createSession();
      isNewSession = true;
    } else {
      // Validate existing session
      const sessionExists = await sessionManager.sessionExists(
        currentSessionId
      );
      if (!sessionExists) {
        currentSessionId = await sessionManager.createSession();
        isNewSession = true;
      }
    }

    // Get chat history for context
    const chatHistory = await sessionManager.getChatHistory(currentSessionId);

    // Add user message to history
    await sessionManager.addMessage(currentSessionId, {
      type: "user",
      content: message.trim(),
    });

    // Auto-generate title for new sessions based on first message
    if (isNewSession) {
      await sessionManager.autoGenerateTitle(currentSessionId, message.trim());
    }

    // Process query through RAG pipeline
    const ragResult = await ragPipeline.processQueryWithContext(
      message.trim(),
      chatHistory,
      currentSessionId
    );

    // Add assistant response to history
    await sessionManager.addMessage(currentSessionId, {
      type: "assistant",
      content: ragResult.response,
      sources: ragResult.sources,
    });

    // Return response
    res.json({
      response: ragResult.response,
      sessionId: currentSessionId,
      sources: ragResult.sources,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in chat endpoint:", error.message);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
});

router.get("/sessions/:sessionId/history", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { limit = 50 } = req.query;

    // Validate session exists
    const sessionExists = await sessionManager.sessionExists(sessionId);
    if (!sessionExists) {
      return res.status(404).json({
        error: "Session not found",
      });
    }

    // Get chat history
    const chatHistory = await sessionManager.getChatHistory(
      sessionId,
      parseInt(limit)
    );

    // Get session stats
    const sessionStats = await sessionManager.getSessionStats(sessionId);

    res.json({
      sessionId,
      history: chatHistory,
      stats: sessionStats,
    });
  } catch (error) {
    console.error("Error getting chat history:", error.message);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
});

router.delete("/sessions/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { clearHistory = true, deleteSession = false } = req.query;

    // Validate session exists
    const sessionExists = await sessionManager.sessionExists(sessionId);
    if (!sessionExists) {
      return res.status(404).json({
        error: "Session not found",
      });
    }

    if (deleteSession === "true") {
      // Delete entire session
      await sessionManager.deleteSession(sessionId);
      res.json({
        message: "Session deleted successfully",
        sessionId,
      });
    } else if (clearHistory === "true") {
      // Clear chat history only
      await sessionManager.clearChatHistory(sessionId);
      res.json({
        message: "Chat history cleared successfully",
        sessionId,
      });
    } else {
      res.status(400).json({
        error: "Invalid operation. Use clearHistory=true or deleteSession=true",
      });
    }
  } catch (error) {
    console.error("Error clearing/deleting session:", error.message);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
});

router.get("/sessions/:sessionId/stats", async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Validate session exists
    const sessionExists = await sessionManager.sessionExists(sessionId);
    if (!sessionExists) {
      return res.status(404).json({
        error: "Session not found",
      });
    }

    // Get session stats
    const stats = await sessionManager.getSessionStats(sessionId);

    res.json({
      sessionId,
      stats,
    });
  } catch (error) {
    console.error("Error getting session stats:", error.message);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
});

router.post("/sessions", async (req, res) => {
  try {
    const { title = "New Chat" } = req.body;
    const sessionId = await sessionManager.createSession(title);

    // Emit real-time update to all connected clients
    const io = getIO(req);
    if (io) {
      io.emit("session-created", {
        sessionId,
        title,
        timestamp: new Date().toISOString(),
      });
    }

    res.status(201).json({
      message: "Session created successfully",
      sessionId,
      title,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error creating session:", error.message);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
});

/**
 * GET /api/chat/sessions
 * Get all sessions (for ChatGPT-like sidebar)
 */
router.get("/sessions", async (req, res) => {
  try {
    const sessions = await sessionManager.getAllSessions();

    res.json({
      sessions,
      count: sessions.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error getting sessions:", error.message);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
});

/**
 * GET /api/chat/sessions/:sessionId
 * Get session details and summary
 */
router.get("/sessions/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Validate session exists
    const sessionExists = await sessionManager.sessionExists(sessionId);
    if (!sessionExists) {
      return res.status(404).json({
        error: "Session not found",
      });
    }

    const sessionSummary = await sessionManager.getSessionSummary(sessionId);

    res.json({
      session: sessionSummary,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error getting session:", error.message);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
});

router.put("/sessions/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { title } = req.body;

    if (!title) {
      return res.status(400).json({
        error: "Title is required",
      });
    }

    // Validate session exists
    const sessionExists = await sessionManager.sessionExists(sessionId);
    if (!sessionExists) {
      return res.status(404).json({
        error: "Session not found",
      });
    }

    const updatedSession = await sessionManager.updateSessionTitle(
      sessionId,
      title
    );

    res.json({
      message: "Session updated successfully",
      session: updatedSession,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error updating session:", error.message);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
});

router.post("/test", async (req, res) => {
  try {
    const { query = "What's the latest news about technology?" } = req.body;

    const result = await ragPipeline.processQuery(query);

    res.json({
      testQuery: query,
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("RAG test failed:", error.message);
    res.status(500).json({
      error: "RAG test failed",
      message: error.message,
    });
  }
});

module.exports = router;
