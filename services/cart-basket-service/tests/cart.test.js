const request = require('supertest');
const app = require('../src/app');

describe('Cart Service', () => {
  describe('GET /api/v1/cart', () => {
    it('should return empty cart for new user', async () => {
      const response = await request(app)
        .get('/api/v1/cart')
        .set('x-session-id', 'test-session-123');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.cart.items).toHaveLength(0);
    });
  });
  
  describe('POST /api/v1/cart/items', () => {
    it('should add item to cart', async () => {
      const response = await request(app)
        .post('/api/v1/cart/items')
        .set('x-session-id', 'test-session-123')
        .send({
          productId: 'prod_001',
          quantity: 2
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toHaveLength(1);
    });
  });
  
  describe('GET /api/v1/cart/count', () => {
    it('should return cart item count', async () => {
      const response = await request(app)
        .get('/api/v1/cart/count')
        .set('x-session-id', 'test-session-123');
      
      expect(response.status).toBe(200);
      expect(response.body.data.count).toBe(2);
    });
  });
});