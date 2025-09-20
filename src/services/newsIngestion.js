const Parser = require("rss-parser");
const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs").promises;
const path = require("path");

const parser = new Parser({
  timeout: 10000,
  headers: {
    "User-Agent": "News AI Assistant Bot 1.0",
  },
});

// RSS feeds to scrape
const RSS_FEEDS = [
  "https://feeds.reuters.com/reuters/topNews",
  "https://feeds.bbci.co.uk/news/technology/rss.xml",
  "https://techcrunch.com/feed/",
  "https://feeds.reuters.com/reuters/technologyNews",
  "https://feeds.bbci.co.uk/news/business/rss.xml",
  "http://rss.cnn.com/rss/edition.rss",
  "https://www.theguardian.com/world/rss",
  "https://feeds.npr.org/1001/rss.xml",
];

async function extractArticleContent(url) {
  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
    });

    const $ = cheerio.load(response.data);

    // Remove script and style elements
    $("script, style, nav, header, footer, aside").remove();

    // Try to find main content
    let content = "";

    // Common selectors for article content
    const contentSelectors = [
      "article",
      '[role="main"]',
      ".article-content",
      ".post-content",
      ".entry-content",
      ".content",
      "main",
    ];

    for (const selector of contentSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        content = element.text().trim();
        if (content.length > 200) break; // Found substantial content
      }
    }

    // Fallback to body if no specific content found
    if (!content || content.length < 200) {
      content = $("body").text().trim();
    }

    // Clean up the content
    content = content
      .replace(/\s+/g, " ") 
      .replace(/\n+/g, " ") 
      .trim();

    return content.substring(0, 2000); // Limit content length
  } catch (error) {
    console.warn(`Failed to extract content from ${url}:`, error.message);
    return "";
  }
}

async function fetchRSSFeed(feedUrl) {
  try {
    console.log(`📡 Fetching RSS feed: ${feedUrl}`);
    const feed = await parser.parseURL(feedUrl);

    const articles = [];

    for (const item of feed.items.slice(0, 10)) {
      // Limit to 10 articles per feed
      try {
        const article = {
          title: item.title || "",
          url: item.link || "",
          publishedAt: item.pubDate || new Date().toISOString(),
          source: feed.title || "Unknown",
          description: item.contentSnippet || item.content || "",
          content: "", 
        };

        // Extract full article content
        if (article.url) {
          article.content = await extractArticleContent(article.url);
        }

        articles.push(article);
      } catch (error) {
        console.warn(`Error processing article: ${item.title}`, error.message);
      }
    }

    console.log(`✅ Fetched ${articles.length} articles from ${feedUrl}`);
    return articles;
  } catch (error) {
    console.error(`❌ Error fetching RSS feed ${feedUrl}:`, error.message);
    return [];
  }
}


async function saveArticles(articles, filename = "news_articles.json") {
  try {
    const dataDir = path.join(__dirname, "../../data");

    try {
      await fs.access(dataDir);
    } catch {
      await fs.mkdir(dataDir, { recursive: true });
    }

    const filePath = path.join(dataDir, filename);

    // Add metadata
    const data = {
      lastUpdated: new Date().toISOString(),
      totalArticles: articles.length,
      articles: articles,
    };

    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    console.log(`💾 Saved ${articles.length} articles to ${filePath}`);

    return filePath;
  } catch (error) {
    console.error("❌ Error saving articles:", error.message);
    throw error;
  }
}


async function ingestNews() {
  console.log("🚀 Starting news ingestion...");

  try {
    const allArticles = [];

    // Fetch articles from all RSS feeds
    for (const feedUrl of RSS_FEEDS) {
      const articles = await fetchRSSFeed(feedUrl);
      allArticles.push(...articles);

      // Small delay between requests to be respectful
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Remove duplicates based on URL
    const uniqueArticles = allArticles.filter(
      (article, index, self) =>
        index === self.findIndex((a) => a.url === article.url)
    );

    console.log(`📊 Total unique articles: ${uniqueArticles.length}`);

    // Save to JSON file
    await saveArticles(uniqueArticles);

    console.log("✅ News ingestion completed successfully!");

    return uniqueArticles;
  } catch (error) {
    console.error("❌ News ingestion failed:", error.message);
    throw error;
  }
}

// Run ingestion if this file is executed directly
if (require.main === module) {
  ingestNews()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Fatal error:", error);
      process.exit(1);
    });
}

module.exports = {
  ingestNews,
  fetchRSSFeed,
  extractArticleContent,
  saveArticles,
};
