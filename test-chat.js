const axios = require("axios");

const BASE_URL = "http://localhost:3000";

async function testChatAPI() {
  try {
    console.log("🧪 Testing News AI Assistant Chat API\n");

    // Test 1: Create a new session
    console.log("\n3. Creating new session...");
    const sessionResponse = await axios.post(`${BASE_URL}/api/chat/sessions`);
    const sessionId = sessionResponse.data.sessionId;
    console.log("✅ Session created:", sessionId);

    // Test 2: Send a chat message
    console.log("\n4. Sending chat message...");
    const chatResponse = await axios.post(`${BASE_URL}/api/chat`, {
      message: "What's the latest news about artificial intelligence?",
      sessionId: sessionId,
    });
    console.log("✅ Chat response received:");
    console.log("Response:", chatResponse.data.response);
    console.log("Sources:", chatResponse.data.sources.length, "articles");

    // Test 3: Get chat history
    console.log("\n5. Getting chat history...");
    const historyResponse = await axios.get(
      `${BASE_URL}/api/chat/sessions/${sessionId}/history`
    );
    console.log(
      "✅ Chat history retrieved:",
      historyResponse.data.history.length,
      "messages"
    );

    // Test 4: Send follow-up message
    console.log("\n6. Sending follow-up message...");
    const followUpResponse = await axios.post(`${BASE_URL}/api/chat`, {
      message: "Can you tell me more about any tech company news?",
      sessionId: sessionId,
    });
    console.log("✅ Follow-up response received");
    console.log(
      "Response:",
      followUpResponse.data.response.substring(0, 200) + "..."
    );

    // Test 5: Get session stats
    console.log("\n7. Getting session stats...");
    const statsResponse = await axios.get(
      `${BASE_URL}/api/chat/sessions/${sessionId}/stats`
    );
    console.log("✅ Session stats:", statsResponse.data.stats);

    // Test 6: Test RAG pipeline directly
    console.log("\n8. Testing RAG pipeline...");
    const testResponse = await axios.post(`${BASE_URL}/api/chat/test`, {
      query: "What are the main technology trends in recent news?",
    });
    console.log("✅ RAG test completed");
    console.log(
      "Found",
      testResponse.data.result.sources.length,
      "relevant articles"
    );

    console.log("\n🎉 All tests completed successfully!");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", error.response.data);
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testChatAPI()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Fatal test error:", error);
      process.exit(1);
    });
}

module.exports = testChatAPI;
