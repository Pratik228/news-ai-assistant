const { QdrantClient } = require("@qdrant/js-client-rest");

class VectorStore {
  constructor(url = "http://localhost:6333", apiKey = null) {
    this.client = new QdrantClient({
      url: url,
      apiKey: apiKey,
    });
    this.collectionName = "news_articles";
    this.vectorSize = 768; // Jina embeddings v2 base dimension
  }

  async initializeCollection() {
    try {
      console.log(`🔄 Initializing Qdrant collection: ${this.collectionName}`);

      // Check if collection exists
      const collections = await this.client.getCollections();
      const collectionExists = collections.collections.some(
        (col) => col.name === this.collectionName
      );

      if (collectionExists) {
        console.log(`✅ Collection ${this.collectionName} already exists`);
        return;
      }

      // Create collection
      await this.client.createCollection(this.collectionName, {
        vectors: {
          size: this.vectorSize,
          distance: "Cosine",
        },
      });

      console.log(`✅ Created collection: ${this.collectionName}`);
    } catch (error) {
      console.error("Error initializing collection:", error.message);
      throw error;
    }
  }

  async addArticles(articlesWithEmbeddings) {
    try {
      console.log(
        `🔄 Adding ${articlesWithEmbeddings.length} articles to vector store...`
      );

      // Ensure collection exists
      await this.initializeCollection();

      // Prepare points for insertion
      const points = articlesWithEmbeddings.map((article, index) => ({
        id: this.generateId(article.url),
        vector: article.embedding,
        payload: {
          title: article.title,
          url: article.url,
          publishedAt: article.publishedAt,
          source: article.source,
          description: article.description,
          content: article.content,
          embeddingModel: article.embeddingModel,
          indexedAt: new Date().toISOString(),
        },
      }));

      // Upsert points (insert or update)
      await this.client.upsert(this.collectionName, {
        wait: true,
        points: points,
      });

      console.log(`✅ Added ${points.length} articles to vector store`);

      return points.length;
    } catch (error) {
      console.error("Error adding articles to vector store:", error.message);
      throw error;
    }
  }

  async searchSimilar(queryEmbedding, limit = 10, scoreThreshold = 0.7) {
    try {
      console.log(`🔍 Searching for similar articles...`);

      const searchResult = await this.client.search(this.collectionName, {
        vector: queryEmbedding,
        limit: limit,
        score_threshold: scoreThreshold,
        with_payload: true,
        with_vector: false,
      });

      const results = searchResult.map((result) => ({
        id: result.id,
        score: result.score,
        title: result.payload.title,
        url: result.payload.url,
        publishedAt: result.payload.publishedAt,
        source: result.payload.source,
        description: result.payload.description,
        content: result.payload.content,
      }));

      console.log(`✅ Found ${results.length} similar articles`);

      return results;
    } catch (error) {
      console.error("Error searching vector store:", error.message);
      throw error;
    }
  }

  async getCollectionInfo() {
    try {
      const info = await this.client.getCollection(this.collectionName);
      return {
        name: info.collection_name,
        vectorsCount: info.vectors_count,
        indexedVectorsCount: info.indexed_vectors_count,
        pointsCount: info.points_count,
        segmentsCount: info.segments_count,
        config: info.config,
      };
    } catch (error) {
      console.error("Error getting collection info:", error.message);
      throw error;
    }
  }

  async deleteCollection() {
    try {
      await this.client.deleteCollection(this.collectionName);
      console.log(`🗑️ Deleted collection: ${this.collectionName}`);
    } catch (error) {
      console.error("Error deleting collection:", error.message);
      throw error;
    }
  }

  async clearCollection() {
    try {
      await this.client.delete(this.collectionName, {
        wait: true,
        points: {}, // Empty filter deletes all points
      });
      console.log(
        `🧹 Cleared all points from collection: ${this.collectionName}`
      );
    } catch (error) {
      console.error("Error clearing collection:", error.message);
      throw error;
    }
  }

  generateId(url) {
    const crypto = require("crypto");
    return crypto.createHash("md5").update(url).digest("hex");
  }

  async batchSearch(queries, limit = 10, scoreThreshold = 0.7) {
    try {
      console.log(`🔍 Batch searching with ${queries.length} queries...`);

      const searchRequests = queries.map((queryEmbedding) => ({
        vector: queryEmbedding,
        limit: limit,
        score_threshold: scoreThreshold,
        with_payload: true,
        with_vector: false,
      }));

      const results = await this.client.searchBatch(this.collectionName, {
        searches: searchRequests,
      });

      return results.map((searchResult, index) => ({
        queryIndex: index,
        results: searchResult.map((result) => ({
          id: result.id,
          score: result.score,
          title: result.payload.title,
          url: result.payload.url,
          publishedAt: result.payload.publishedAt,
          source: result.payload.source,
          description: result.payload.description,
          content: result.payload.content,
        })),
      }));
    } catch (error) {
      console.error("Error in batch search:", error.message);
      throw error;
    }
  }
}

module.exports = VectorStore;
