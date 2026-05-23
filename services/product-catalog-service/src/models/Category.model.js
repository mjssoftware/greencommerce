const mongoose = require('mongoose');
const slugify = require('slugify');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Category name is required'],
    unique: true,
    trim: true,
    maxlength: [100, 'Category name cannot exceed 100 characters']
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true
  },
  description: {
    type: String,
    trim: true
  },
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null
  },
  image: {
    url: String,
    alt: String
  },
  icon: String,
  level: {
    type: Number,
    default: 0
  },
  path: {
    type: String,
    index: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  order: {
    type: Number,
    default: 0
  },
  seo: {
    title: String,
    description: String,
    keywords: [String]
  },
  productCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true }
});

// Generate slug before saving
categorySchema.pre('save', async function(next) {
  if (this.isModified('name')) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
  
  // Calculate path
  if (this.parent) {
    const parentCategory = await mongoose.model('Category').findById(this.parent);
    if (parentCategory) {
      this.path = parentCategory.path ? `${parentCategory.path}/${this.slug}` : `${parentCategory.slug}/${this.slug}`;
      this.level = parentCategory.level + 1;
    }
  } else {
    this.path = this.slug;
    this.level = 0;
  }
  
  next();
});

// Virtual for children categories
categorySchema.virtual('children', {
  ref: 'Category',
  localField: '_id',
  foreignField: 'parent'
});

// Virtual for full path
categorySchema.virtual('fullPath').get(function() {
  return this.path ? this.path.split('/') : [this.slug];
});

// Method to get category tree
categorySchema.statics.getTree = async function() {
  const categories = await this.find().lean();
  const map = {};
  const roots = [];
  
  categories.forEach(category => {
    map[category._id] = category;
    category.children = [];
  });
  
  categories.forEach(category => {
    if (category.parent) {
      if (map[category.parent]) {
        map[category.parent].children.push(category);
      }
    } else {
      roots.push(category);
    }
  });
  
  return roots;
};

const Category = mongoose.model('Category', categorySchema);

module.exports = Category;