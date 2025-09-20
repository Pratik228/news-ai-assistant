const axios = require("axios");

class JinaEmbeddings {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = "https://api.jina.ai/v1/embeddings";
  }
  async embedText(text, model = "jina-embeddings-v2-base-en") {
    try {
      if (!this.apiKey) {
        throw new Error("Jina API key is required");
      }

      if (!text || text.trim().length === 0) {
        throw new Error("Text cannot be empty");
      }

      const response = await axios.post(
        this.baseURL,
        {
          input: [text],
          model: model,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          timeout: 30000,
        }
      );

      if (
        response.data &&
        response.data.data &&
        response.data.data.length > 0
      ) {
        return {
          embedding: response.data.data[0].embedding,
          model: response.data.model,
          usage: response.data.usage,
        };
      }

      throw new Error("Invalid response from Jina API");
    } catch (error) {
      console.error("Error generating embeddings:", error.message);

      if (error.response) {
        console.error(
          "API Response:",
          error.response.status,
          error.response.data
        );
      }

      throw error;
    }
  }

  async embedTexts(texts, model = "jina-embeddings-v2-base-en") {
    try {
      if (!this.apiKey) {
        throw new Error("Jina API key is required");
      }

      if (!Array.isArray(texts) || texts.length === 0) {
        throw new Error("Texts array cannot be empty");
      }

      const validTexts = texts.filter((text) => text && text.trim().length > 0);

      if (validTexts.length === 0) {
        throw new Error("No valid texts to embed");
      }

      const response = await axios.post(
        this.baseURL,
        {
          input: validTexts,
          model: model,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          timeout: 30000,
        }
      );

      if (response.data && response.data.data) {
        return {
          embeddings: response.data.data.map((item) => item.embedding),
          model: response.data.model,
          usage: response.data.usage,
        };
      }

      throw new Error("Invalid response from Jina API");
    } catch (error) {
      console.error("Error generating embeddings for texts:", error.message);

      if (error.response) {
        console.error(
          "API Response:",
          error.response.status,
          error.response.data
        );
      }

      throw error;
    }
  }

  async embedArticles(articles) {
    try {
      console.log(
        `🔄 Generating embeddings for ${articles.length} articles...`
      );

      const texts = articles.map((article) => {
        // Combine title, description, and content for better embeddings
        const combinedText = [
          article.title,
          article.description,
          article.content,
        ]
          .filter((text) => text && text.trim().length > 0)
          .join(" ")
          .trim();

        return combinedText.substring(0, 8000);
      });

      const result = await this.embedTexts(texts);

      // Combine articles with their embeddings
      const articlesWithEmbeddings = articles.map((article, index) => ({
        ...article,
        embedding: result.embeddings[index],
        embeddingModel: result.model,
      }));

      console.log(
        `✅ Generated embeddings for ${articlesWithEmbeddings.length} articles`
      );
      console.log(`📊 Token usage: ${JSON.stringify(result.usage)}`);

      return articlesWithEmbeddings;
    } catch (error) {
      console.error("Error embedding articles:", error.message);
      throw error;
    }
  }

  static cosineSimilarity(embedding1, embedding2) {
    if (embedding1.length !== embedding2.length) {
      throw new Error("Embeddings must have the same length");
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);

    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }

    return dotProduct / (norm1 * norm2);
  }
}

module.exports = JinaEmbeddings;
