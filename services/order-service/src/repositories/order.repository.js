const Order = require('../models/Order.model');
const OrderItem = require('../models/OrderItem.model');

class OrderRepository {
  async create(orderData) {
    const order = new Order(orderData);
    return await order.save();
  }
  
  async findById(id) {
    return await Order.findById(id);
  }
  
  async findByOrderNumber(orderNumber) {
    return await Order.findOne({ orderNumber });
  }
  
  async findByUserId(userId, page = 1, limit = 20, status = null) {
    const filter = { userId };
    if (status) filter.status = status;
    
    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit);
    
    const total = await Order.countDocuments(filter);
    
    return { orders, total };
  }
  
  async updateStatus(id, status, timelineEntry) {
    const order = await Order.findById(id);
    if (!order) return null;
    
    order.status = status;
    if (timelineEntry) {
      order.timeline.push(timelineEntry);
    }
    
    return await order.save();
  }
  
  async updatePayment(id, paymentData) {
    const order = await Order.findById(id);
    if (!order) return null;
    
    order.payment = { ...order.payment, ...paymentData };
    return await order.save();
  }
  
  async updateShipping(id, shippingData) {
    const order = await Order.findById(id);
    if (!order) return null;
    
    order.shipping = { ...order.shipping, ...shippingData };
    return await order.save();
  }
  
  async getStats() {
    const stats = await Order.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$summary.total' }
        }
      }
    ]);
    
    return stats;
  }
  
  async getOrdersByDateRange(startDate, endDate) {
    return await Order.find({
      createdAt: { $gte: startDate, $lte: endDate }
    }).sort({ createdAt: 1 });
  }
}

module.exports = new OrderRepository();