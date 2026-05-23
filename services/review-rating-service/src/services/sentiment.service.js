const natural = require('natural');
const logger = require('../utils/logger');

class SentimentService {
  constructor() {
    this.analyzer = new natural.SentimentAnalyzer('English', natural.PorterStemmer, 'afinn');
    this.tokenizer = new natural.WordTokenizer();
  }
  
  async analyzeSentiment(text) {
    try {
      // Tokenize and analyze
      const tokens = this.tokenizer.tokenize(text);
      const score = this.analyzer.getSentiment(tokens);
      
      // Determine label based on score
      let label = 'neutral';
      if (score > 0.2) {
        label = 'positive';
      } else if (score < -0.2) {
        label = 'negative';
      }
      
      // Calculate confidence based on score magnitude
      const confidence = Math.min(Math.abs(score) / 0.5, 1);
      
      return {
        score: parseFloat(score.toFixed(4)),
        label,
        confidence: parseFloat(confidence.toFixed(4))
      };
    } catch (error) {
      logger.error('Sentiment analysis failed:', error);
      return {
        score: 0,
        label: 'neutral',
        confidence: 0.5
      };
    }
  }
  
  async analyzeBatchReviews(reviews) {
    const results = [];
    for (const review of reviews) {
      const sentiment = await this.analyzeSentiment(review.content);
      results.push({
        reviewId: review._id,
        sentiment
      });
    }
    return results;
  }
  
  async getProductSentimentSummary(productId, reviews) {
    const summary = {
      positive: 0,
      neutral: 0,
      negative: 0,
      averageScore: 0,
      commonPositiveWords: [],
      commonNegativeWords: []
    };
    
    let totalScore = 0;
    const positiveWords = new Map();
    const negativeWords = new Map();
    
    for (const review of reviews) {
      if (review.sentiment) {
        summary[review.sentiment.label]++;
        totalScore += review.sentiment.score;
        
        // Extract words for analysis
        const words = this.tokenizer.tokenize(review.content.toLowerCase());
        const sentimentScore = review.sentiment.score;
        
        for (const word of words) {
          if (word.length > 3) { // Ignore short words
            if (sentimentScore > 0.2) {
              positiveWords.set(word, (positiveWords.get(word) || 0) + 1);
            } else if (sentimentScore < -0.2) {
              negativeWords.set(word, (negativeWords.get(word) || 0) + 1);
            }
          }
        }
      }
    }
    
    summary.averageScore = reviews.length > 0 ? totalScore / reviews.length : 0;
    summary.commonPositiveWords = Array.from(positiveWords.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
    summary.commonNegativeWords = Array.from(negativeWords.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
    
    return summary;
  }
}

module.exports = new SentimentService();