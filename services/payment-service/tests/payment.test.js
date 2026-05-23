const request = require('supertest');
const app = require('../src/app');

describe('Payment Service', () => {
  describe('POST /api/v1/payments/initialize', () => {
    it('should initialize payment successfully', async () => {
      const response = await request(app)
        .post('/api/v1/payments/initialize')
        .set('Authorization', 'Bearer test-token')
        .send({
          orderId: 'test-order-123',
          orderNumber: 'ORD-TEST-001',
          amount: 1000,
          paymentMethod: 'chapa',
          customer: {
            email: 'test@example.com',
            name: 'Test User',
            phone: '+251912345678'
          }
        });
      
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('transactionId');
    });
  });
  
  describe('GET /api/v1/payments/verify/:transactionId', () => {
    it('should verify payment status', async () => {
      const response = await request(app)
        .get('/api/v1/payments/verify/test-txn-123')
        .set('Authorization', 'Bearer test-token');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});