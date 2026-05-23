const { Client } = require('@elastic/elasticsearch');
const logger = require('../utils/logger');

let esClient = null;

const initializeElasticsearch = async () => {
  try {
    esClient = new Client({
      node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
      maxRetries: 3,
      requestTimeout: 30000
    });
    
    // Test connection
    const health = await esClient.cluster.health();
    logger.info('Elasticsearch connected', { status: health.status });
    
    // Create index if not exists
    const indexExists = await esClient.indices.exists({
      index: process.env.ELASTICSEARCH_INDEX || 'products'
    });
    
    if (!indexExists) {
      await createIndex();
    }
    
    return esClient;
  } catch (error) {
    logger.error('Elasticsearch connection failed:', error);
    // Don't throw error - Elasticsearch is optional
    return null;
  }
};

const createIndex = async () => {
  try {
    await esClient.indices.create({
      index: process.env.ELASTICSEARCH_INDEX || 'products',
      body: {
        settings: {
          analysis: {
            analyzer: {
              autocomplete_analyzer: {
                tokenizer: 'autocomplete_tokenizer',
                filter: ['lowercase']
              }
            },
            tokenizer: {
              autocomplete_tokenizer: {
                type: 'edge_ngram',
                min_gram: 2,
                max_gram: 10,
                token_chars: ['letter', 'digit']
              }
            }
          }
        },
        mappings: {
          properties: {
            id: { type: 'keyword' },
            name: {
              type: 'text',
              analyzer: 'autocomplete_analyzer',
              fields: {
                keyword: { type: 'keyword' }
              }
            },
            description: { type: 'text' },
            category: { type: 'keyword' },
            brand: { type: 'keyword' },
            price: { type: 'float' },
            comparePrice: { type: 'float' },
            sku: { type: 'keyword' },
            tags: { type: 'keyword' },
            isActive: { type: 'boolean' },
            averageRating: { type: 'float' },
            totalReviews: { type: 'integer' },
            createdAt: { type: 'date' }
          }
        }
      }
    });
    logger.info('Elasticsearch index created');
  } catch (error) {
    logger.error('Failed to create Elasticsearch index:', error);
  }
};

const getEsClient = () => esClient;

const indexProduct = async (product) => {
  if (!esClient) return;
  
  try {
    await esClient.index({
      index: process.env.ELASTICSEARCH_INDEX || 'products',
      id: product._id.toString(),
      document: {
        id: product._id.toString(),
        name: product.name,
        description: product.description,
        category: product.category,
        brand: product.brand,
        price: product.price,
        comparePrice: product.comparePrice,
        sku: product.sku,
        tags: product.tags,
        isActive: product.isActive,
        averageRating: product.averageRating,
        totalReviews: product.totalReviews,
        createdAt: product.createdAt
      }
    });
    logger.info(`Product indexed in Elasticsearch: ${product._id}`);
  } catch (error) {
    logger.error('Failed to index product:', error);
  }
};

const deleteProductFromIndex = async (productId) => {
  if (!esClient) return;
  
  try {
    await esClient.delete({
      index: process.env.ELASTICSEARCH_INDEX || 'products',
      id: productId
    });
    logger.info(`Product deleted from Elasticsearch: ${productId}`);
  } catch (error) {
    logger.error('Failed to delete product from index:', error);
  }
};

const searchProducts = async (query, filters = {}, page = 1, limit = 20) => {
  if (!esClient) return null;
  
  const from = (page - 1) * limit;
  
  const must = [];
  
  // Full-text search
  if (query) {
    must.push({
      multi_match: {
        query,
        fields: ['name^3', 'description', 'tags', 'brand'],
        fuzziness: 'AUTO'
      }
    });
  }
  
  // Filters
  if (filters.category) {
    must.push({ term: { category: filters.category } });
  }
  
  if (filters.brand) {
    must.push({ term: { brand: filters.brand } });
  }
  
  if (filters.minPrice || filters.maxPrice) {
    const range = {};
    if (filters.minPrice) range.gte = filters.minPrice;
    if (filters.maxPrice) range.lte = filters.maxPrice;
    must.push({ range: { price: range } });
  }
  
  if (filters.isActive !== undefined) {
    must.push({ term: { isActive: filters.isActive } });
  }
  
  try {
    const result = await esClient.search({
      index: process.env.ELASTICSEARCH_INDEX || 'products',
      body: {
        query: { bool: { must } },
        from,
        size: limit,
        sort: [{ [filters.sortBy || 'createdAt']: filters.sortOrder || 'desc' }]
      }
    });
    
    return {
      products: result.hits.hits.map(hit => hit._source),
      total: result.hits.total.value,
      page,
      limit,
      totalPages: Math.ceil(result.hits.total.value / limit)
    };
  } catch (error) {
    logger.error('Elasticsearch search failed:', error);
    return null;
  }
};

module.exports = { initializeElasticsearch, getEsClient, indexProduct, deleteProductFromIndex, searchProducts };