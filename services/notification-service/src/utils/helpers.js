// Helper function for Handlebars templates
const Handlebars = require('handlebars');

// Register custom helpers
Handlebars.registerHelper('multiply', function(a, b) {
  return a * b;
});

Handlebars.registerHelper('lt', function(a, b) {
  return a < b;
});

Handlebars.registerHelper('formatDate', function(date) {
  return new Date(date).toLocaleDateString();
});

Handlebars.registerHelper('formatCurrency', function(amount) {
  return `$${amount.toFixed(2)}`;
});

module.exports = { Handlebars };