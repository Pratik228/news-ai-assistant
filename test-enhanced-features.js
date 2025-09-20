const axios = require("axios");
const io = require("socket.io-client");

const BASE_URL = "http://localhost:3000";

async function testEnhancedFeatures() {
  console.log("🧪 Testing Enhanced Backend Features\n");

  // Test 1: Session Management API
  console.log("1. Testing Session Management API...");
  try {
    // Create a session
    const createResponse = await axios.post(`${BASE_URL}/api/chat/sessions`, {
      title: "Test Session",
    });
    const sessionId = createResponse.data.sessionId;
    console.log("✅ Created session:", sessionId);

    // Get all sessions
    const sessionsResponse = await axios.get(`${BASE_URL}/api/chat/sessions`);
    console.log(`✅ Retrieved ${sessionsResponse.data.count} sessions`);

    // Get session details
    const sessionResponse = await axios.get(
      `${BASE_URL}/api/chat/sessions/${sessionId}`
    );
    console.log(
      "✅ Retrieved session details:",
      sessionResponse.data.session.title
    );

    // Update session title
    const updateResponse = await axios.put(
      `${BASE_URL}/api/chat/sessions/${sessionId}`,
      {
        title: "Updated Test Session",
      }
    );
    console.log("✅ Updated session title");
  } catch (error) {
    console.log("❌ Session management test failed:", error.message);
  }

  // Test 2: Socket.IO Connection
  console.log("\n2. Testing Socket.IO Connection...");
  try {
    const socket = io(BASE_URL);

    await new Promise((resolve, reject) => {
      socket.on("connect", () => {
        console.log("✅ Socket.IO connected:", socket.id);
        resolve();
      });

      socket.on("connect_error", (error) => {
        console.log("❌ Socket.IO connection failed:", error.message);
        reject(error);
      });

      setTimeout(() => reject(new Error("Connection timeout")), 5000);
    });

    // Test session operations via Socket.IO
    socket.emit("create-session", { title: "Socket Test Session" });

    await new Promise((resolve) => {
      socket.on("session-created", (data) => {
        console.log("✅ Socket.IO session created:", data.sessionId);
        resolve();
      });
      setTimeout(resolve, 2000);
    });

    socket.disconnect();
    console.log("✅ Socket.IO disconnected");
  } catch (error) {
    console.log("❌ Socket.IO test failed:", error.message);
  }

  // Test 3: Real-time Chat with Socket.IO
  console.log("\n3. Testing Real-time Chat...");
  try {
    const socket = io(BASE_URL);
    let messageReceived = false;

    await new Promise((resolve) => {
      socket.on("connect", () => {
        console.log("✅ Connected for chat test");
        resolve();
      });
    });

    // Create session and send message
    socket.emit("create-session", { title: "Real-time Chat Test" });

    await new Promise((resolve) => {
      socket.on("session-created", (data) => {
        console.log("✅ Session created for chat:", data.sessionId);

        // Join session and send message
        socket.emit("join-session", data.sessionId);
        socket.emit("send-message", {
          message: "What's the latest news about AI?",
          sessionId: data.sessionId,
        });
        resolve();
      });
    });

    // Listen for streaming response
    await new Promise((resolve) => {
      let responseChunks = [];

      socket.on("stream-chunk", (data) => {
        responseChunks.push(data.chunk);
        console.log("📝 Received chunk:", data.chunk.substring(0, 50) + "...");
      });

      socket.on("stream-complete", (data) => {
        console.log("✅ Streaming response completed");
        console.log("📊 Sources found:", data.sources.length);
        messageReceived = true;
        resolve();
      });

      setTimeout(() => {
        if (!messageReceived) {
          console.log("⏰ Streaming test timeout");
          resolve();
        }
      }, 15000);
    });

    socket.disconnect();
    console.log("✅ Real-time chat test completed");
  } catch (error) {
    console.log("❌ Real-time chat test failed:", error.message);
  }

  // Test 4: Session CRUD Operations
  console.log("\n4. Testing Session CRUD Operations...");
  try {
    // Create multiple sessions
    const session1 = await axios.post(`${BASE_URL}/api/chat/sessions`, {
      title: "Session 1",
    });
    const session2 = await axios.post(`${BASE_URL}/api/chat/sessions`, {
      title: "Session 2",
    });

    console.log("✅ Created multiple sessions");

    // Get all sessions
    const allSessions = await axios.get(`${BASE_URL}/api/chat/sessions`);
    console.log(`✅ Retrieved ${allSessions.data.count} sessions`);

    // Update session titles
    await axios.put(
      `${BASE_URL}/api/chat/sessions/${session1.data.sessionId}`,
      {
        title: "Updated Session 1",
      }
    );
    await axios.put(
      `${BASE_URL}/api/chat/sessions/${session2.data.sessionId}`,
      {
        title: "Updated Session 2",
      }
    );
    console.log("✅ Updated session titles");

    // Delete sessions
    await axios.delete(
      `${BASE_URL}/api/chat/sessions/${session1.data.sessionId}?deleteSession=true`
    );
    await axios.delete(
      `${BASE_URL}/api/chat/sessions/${session2.data.sessionId}?deleteSession=true`
    );
    console.log("✅ Deleted sessions");
  } catch (error) {
    console.log("❌ CRUD operations test failed:", error.message);
  }

  // Test 5: Auto-title Generation
  console.log("\n5. Testing Auto-title Generation...");
  try {
    // Send a message without session (creates new session with auto-title)
    const chatResponse = await axios.post(`${BASE_URL}/api/chat`, {
      message: "Tell me about the latest technology trends",
    });

    console.log(
      "✅ Created session with auto-title:",
      chatResponse.data.sessionId
    );

    // Get session details to see the generated title
    const sessionDetails = await axios.get(
      `${BASE_URL}/api/chat/sessions/${chatResponse.data.sessionId}`
    );
    console.log("✅ Auto-generated title:", sessionDetails.data.session.title);
  } catch (error) {
    console.log("❌ Auto-title generation test failed:", error.message);
  }

  console.log("\n🎉 Enhanced features testing completed!");
}

// Run tests if this file is executed directly
if (require.main === module) {
  testEnhancedFeatures()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Fatal test error:", error);
      process.exit(1);
    });
}

module.exports = testEnhancedFeatures;
