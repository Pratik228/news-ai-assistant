const express = require("express");
const cors = require("cors");
const { createServer } = require("http");
const { Server } = require("socket.io");
require("dotenv").config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3000;

// CORS configuration for production
const corsOptions = {
  origin: [
    "http://localhost:3000",
    "http://localhost:3001",
    process.env.FRONTEND_URL, // Environment variable for frontend URL
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get("/", (req, res) => {
  res.json({
    message: "News AI Assistant API",
    version: "1.0.0",
    status: "running",
  });
});

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      process.env.FRONTEND_URL,
    ],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Import and use route modules
app.use("/api/chat", require("./routes/chat"));

// Initialize Socket.IO chat handler
const SocketChatHandler = require("./routes/socketChat");
new SocketChatHandler(io);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err.message);
  res.status(500).json({
    error: "Internal server error",
    message: err.message,
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ error: "Route not found" });
});

server.listen(PORT, () => {
  console.log(`🚀 News AI Assistant server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`🔌 Socket.IO ready for real-time connections`);
});

module.exports = app;
