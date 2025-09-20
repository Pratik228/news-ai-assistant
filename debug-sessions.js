const Redis = require("ioredis");
require("dotenv").config();

async function debugSessions() {
  console.log("🔍 Debugging Session Storage in Redis\n");

  try {
    // Connect to Redis
    const redis = new Redis(process.env.REDIS_URL, {
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    console.log("✅ Connected to Redis");

    // Get all session keys
    const sessionKeys = await redis.keys("session:*");
    console.log(`📊 Found ${sessionKeys.length} sessions:`);

    for (const key of sessionKeys) {
      console.log(`\n🔑 Session Key: ${key}`);

      // Get session data
      const sessionData = await redis.get(key);
      if (sessionData) {
        const session = JSON.parse(sessionData);
        console.log(`   📝 Title: ${session.title}`);
        console.log(`   🆔 ID: ${session.id}`);
        console.log(`   📅 Created: ${session.createdAt}`);
        console.log(`   ⏰ Last Activity: ${session.lastActivity}`);
        console.log(`   💬 Message Count: ${session.messageCount}`);
      }

      // Get chat history for this session
      const sessionId = key.replace("session:", "");
      const chatHistoryKey = `chat_history:${sessionId}`;
      const chatHistoryData = await redis.get(chatHistoryKey);

      if (chatHistoryData) {
        const messages = JSON.parse(chatHistoryData);
        console.log(`   💬 Chat History: ${messages.length} messages`);

        // Show first few messages
        messages.slice(0, 3).forEach((msg, index) => {
          console.log(
            `      ${index + 1}. [${msg.type}] ${msg.content.substring(
              0,
              50
            )}...`
          );
        });

        if (messages.length > 3) {
          console.log(`      ... and ${messages.length - 3} more messages`);
        }
      } else {
        console.log(`   ❌ No chat history found for session ${sessionId}`);
      }

      // Check TTL
      const ttl = await redis.ttl(key);
      console.log(
        `   ⏳ TTL: ${ttl} seconds (${Math.round(ttl / 3600)} hours)`
      );
    }

    // Check for a specific session if provided
    const specificSessionId = process.argv[2];
    if (specificSessionId) {
      console.log(`\n🔍 Detailed check for session: ${specificSessionId}`);

      const sessionKey = `session:${specificSessionId}`;
      const chatHistoryKey = `chat_history:${specificSessionId}`;

      console.log(`\n📋 Session Data (${sessionKey}):`);
      const sessionData = await redis.get(sessionKey);
      if (sessionData) {
        console.log(JSON.stringify(JSON.parse(sessionData), null, 2));
      } else {
        console.log("❌ Session not found");
      }

      console.log(`\n💬 Chat History (${chatHistoryKey}):`);
      const chatHistoryData = await redis.get(chatHistoryKey);
      if (chatHistoryData) {
        const messages = JSON.parse(chatHistoryData);
        console.log(`Found ${messages.length} messages:`);
        messages.forEach((msg, index) => {
          console.log(`\nMessage ${index + 1}:`);
          console.log(`  Type: ${msg.type}`);
          console.log(`  Content: ${msg.content}`);
          console.log(`  Timestamp: ${msg.timestamp}`);
          if (msg.sources) {
            console.log(`  Sources: ${msg.sources.length} articles`);
          }
        });
      } else {
        console.log("❌ Chat history not found");
      }
    }

    await redis.disconnect();
    console.log("\n✅ Debug complete");
  } catch (error) {
    console.error("❌ Error debugging sessions:", error.message);
  }
}

// Run if called directly
if (require.main === module) {
  debugSessions()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Fatal error:", error);
      process.exit(1);
    });
}

module.exports = debugSessions;
