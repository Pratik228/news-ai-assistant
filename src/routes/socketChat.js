const SessionManager = require("../services/sessionManager");
const StreamingRAGPipeline = require("../services/streamingRagPipeline");

class SocketChatHandler {
  constructor(io) {
    this.io = io;
    this.sessionManager = new SessionManager();
    this.ragPipeline = new StreamingRAGPipeline();

    this.setupSocketHandlers();
  }

  setupSocketHandlers() {
    this.io.on("connection", (socket) => {
      console.log(`🔌 User connected: ${socket.id}`);

      // Join session room
      socket.on("join-session", (sessionId) => {
        socket.join(sessionId);
        socket.emit("joined-session", { sessionId });
      });

      // Leave session room
      socket.on("leave-session", (sessionId) => {
        socket.leave(sessionId);
      });

      // Send message and get streaming response
      socket.on("send-message", async (data) => {
        try {
          const { message, sessionId } = data;

          // Validate input
          if (
            !message ||
            typeof message !== "string" ||
            message.trim().length === 0
          ) {
            socket.emit("error", {
              message: "Message is required and must be a non-empty string",
            });
            return;
          }

          // Create new session if none provided
          let currentSessionId = sessionId;
          let isNewSession = false;

          if (!currentSessionId) {
            currentSessionId = await this.sessionManager.createSession();
            isNewSession = true;
          } else {
            // Validate existing session
            const sessionExists = await this.sessionManager.sessionExists(
              currentSessionId
            );
            if (!sessionExists) {
              currentSessionId = await this.sessionManager.createSession();
              isNewSession = true;
            }
          }

          // Get chat history for context
          const chatHistory = await this.sessionManager.getChatHistory(
            currentSessionId
          );

          // Add user message to history
          await this.sessionManager.addMessage(currentSessionId, {
            type: "user",
            content: message.trim(),
          });

          // Auto-generate title for new sessions based on first message
          if (isNewSession) {
            await this.sessionManager.autoGenerateTitle(
              currentSessionId,
              message.trim()
            );
          } else {
            // Check if this is a session that needs title generation
            // (has "New Chat" title and this is the first message)
            const sessionData = await this.sessionManager.getSession(
              currentSessionId
            );
            const chatHistory = await this.sessionManager.getChatHistory(
              currentSessionId
            );

            if (
              sessionData &&
              sessionData.title === "New Chat" &&
              chatHistory &&
              chatHistory.length === 1
            ) {
              // Only user message, no assistant response yet
              console.log(
                `🔄 Auto-generating title for existing session ${currentSessionId} with first message`
              );
              await this.sessionManager.autoGenerateTitle(
                currentSessionId,
                message.trim()
              );
            }
          }

          // Emit user message to session room
          socket.to(currentSessionId).emit("user-message", {
            message: message.trim(),
            sessionId: currentSessionId,
            timestamp: new Date().toISOString(),
          });

          // Process query through streaming RAG pipeline
          const ragResult =
            await this.ragPipeline.processQueryWithContextStream(
              message.trim(),
              chatHistory,
              currentSessionId,
              socket // Pass socket for streaming
            );

          // Add assistant response to history
          await this.sessionManager.addMessage(currentSessionId, {
            type: "assistant",
            content: ragResult.response,
            sources: ragResult.sources,
          });

          // Emit final response to session room
          socket.to(currentSessionId).emit("assistant-message", {
            response: ragResult.response,
            sources: ragResult.sources,
            sessionId: currentSessionId,
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          console.error("Error in socket chat:", error.message);
          socket.emit("error", {
            message: "Internal server error",
            details: error.message,
          });
        }
      });

      // Get session history
      socket.on("get-history", async (data) => {
        try {
          const { sessionId } = data;

          if (!sessionId) {
            socket.emit("error", { message: "Session ID is required" });
            return;
          }

          const chatHistory = await this.sessionManager.getChatHistory(
            sessionId
          );
          socket.emit("chat-history", {
            sessionId,
            history: chatHistory,
          });
        } catch (error) {
          console.error("Error getting chat history:", error.message);
          socket.emit("error", {
            message: "Error retrieving chat history",
            details: error.message,
          });
        }
      });

      // Create new session
      socket.on("create-session", async (data) => {
        try {
          const { title = "New Chat" } = data;
          const sessionId = await this.sessionManager.createSession(title);

          socket.emit("session-created", {
            sessionId,
            title,
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          console.error("Error creating session:", error.message);
          socket.emit("error", {
            message: "Error creating session",
            details: error.message,
          });
        }
      });

      // Get all sessions
      socket.on("get-sessions", async () => {
        try {
          const sessions = await this.sessionManager.getAllSessions();

          socket.emit("sessions-list", {
            sessions,
            count: sessions.length,
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          console.error("Error getting sessions:", error.message);
          socket.emit("error", {
            message: "Error retrieving sessions",
            details: error.message,
          });
        }
      });

      // Update session title
      socket.on("update-session-title", async (data) => {
        try {
          const { sessionId, title } = data;

          if (!sessionId || !title) {
            socket.emit("error", {
              message: "Session ID and title are required",
            });
            return;
          }

          const updatedSession = await this.sessionManager.updateSessionTitle(
            sessionId,
            title
          );

          socket.emit("session-updated", {
            session: updatedSession,
            timestamp: new Date().toISOString(),
          });

          // Broadcast to all clients in the session room
          socket.to(sessionId).emit("session-title-updated", {
            sessionId,
            title,
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          console.error("Error updating session title:", error.message);
          socket.emit("error", {
            message: "Error updating session title",
            details: error.message,
          });
        }
      });

      // Delete session
      socket.on("delete-session", async (data) => {
        try {
          const { sessionId } = data;

          if (!sessionId) {
            socket.emit("error", { message: "Session ID is required" });
            return;
          }

          await this.sessionManager.deleteSession(sessionId);

          socket.emit("session-deleted", {
            sessionId,
            timestamp: new Date().toISOString(),
          });

          // Broadcast to all clients in the session room
          socket.to(sessionId).emit("session-deleted", {
            sessionId,
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          console.error("Error deleting session:", error.message);
          socket.emit("error", {
            message: "Error deleting session",
            details: error.message,
          });
        }
      });

      // Typing indicator
      socket.on("typing", (data) => {
        const { sessionId, isTyping } = data;
        if (sessionId) {
          socket.to(sessionId).emit("user-typing", {
            userId: socket.id,
            isTyping,
            timestamp: new Date().toISOString(),
          });
        }
      });

      socket.on("disconnect", () => {
        // Removed verbose disconnect logging
      });
    });
  }
}

module.exports = SocketChatHandler;
