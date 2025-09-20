const { ingestNews } = require("./newsIngestion");
const JinaEmbeddings = require("./embeddings");
const VectorStore = require("./vectorStore");
require("dotenv").config();

class NewsPipeline {
  constructor() {
    this.embeddings = new JinaEmbeddings(process.env.JINA_API_KEY);
    this.vectorStore = new VectorStore(
      process.env.QDRANT_URL || "http://localhost:6333",
      process.env.QDRANT_API_KEY
    );
  }

  async runPipeline() {
    try {
      console.log("🚀 Starting complete news pipeline...\n");

      // Step 1: Ingest news articles
      console.log("📰 Step 1: Ingesting news articles...");
      const articles = await ingestNews();

      if (articles.length === 0) {
        throw new Error("No articles were ingested");
      }

      console.log(`✅ Ingested ${articles.length} articles\n`);

      // Step 2: Generate embeddings
      console.log("🧠 Step 2: Generating embeddings...");
      const articlesWithEmbeddings = await this.embeddings.embedArticles(
        articles
      );

      console.log(
        `✅ Generated embeddings for ${articlesWithEmbeddings.length} articles\n`
      );

      // Step 3: Store in vector database
      console.log("💾 Step 3: Storing in vector database...");
      const storedCount = await this.vectorStore.addArticles(
        articlesWithEmbeddings
      );

      console.log(`✅ Stored ${storedCount} articles in vector database\n`);

      // Step 4: Get collection info
      console.log("📊 Step 4: Collection info...");
      const info = await this.vectorStore.getCollectionInfo();
      console.log("Collection Info:", JSON.stringify(info, null, 2));

      console.log("\n🎉 Pipeline completed successfully!");

      return {
        ingested: articles.length,
        embedded: articlesWithEmbeddings.length,
        stored: storedCount,
        collectionInfo: info,
      };
    } catch (error) {
      console.error("❌ Pipeline failed:", error.message);
      throw error;
    }
  }

  async testSearch(query = "artificial intelligence news") {
    try {
      console.log(`🔍 Testing search with query: "${query}"`);

      // Generate embedding for the query
      const queryResult = await this.embeddings.embedText(query);
      const queryEmbedding = queryResult.embedding;

      // Search for similar articles
      const results = await this.vectorStore.searchSimilar(
        queryEmbedding,
        5,
        0.6
      );

      console.log(`\n📋 Search Results (${results.length} found):`);
      results.forEach((result, index) => {
        console.log(`\n${index + 1}. ${result.title}`);
        console.log(`   Source: ${result.source}`);
        console.log(`   Score: ${result.score.toFixed(3)}`);
        console.log(`   URL: ${result.url}`);
        console.log(`   Published: ${result.publishedAt}`);
        if (result.description) {
          console.log(
            `   Description: ${result.description.substring(0, 150)}...`
          );
        }
      });

      return results;
    } catch (error) {
      console.error("❌ Search test failed:", error.message);
      throw error;
    }
  }
}

if (require.main === module) {
  const pipeline = new NewsPipeline();

  pipeline
    .runPipeline()
    .then(() => {
      console.log("\n🧪 Running search test...");
      return pipeline.testSearch();
    })
    .then(() => {
      console.log("\n✅ All tests completed!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Fatal error:", error);
      process.exit(1);
    });
}

module.exports = NewsPipeline;
