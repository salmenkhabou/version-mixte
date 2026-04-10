// Menu Data Configuration
// Add your restaurant's dishes here

const menuData = [
    // STARTERS
    {
        id: 'bruschetta',
        name: 'Bruschetta',
        description: 'Toasted bread with fresh tomatoes, basil, and garlic',
        price: 8.99,
        category: 'Starters',
        emoji: '🍞',
        modelId: 'salad-model'
    },
    {
        id: 'soup',
        name: 'Soup of the Day',
        description: 'Chef\'s daily creation with artisan bread',
        price: 7.99,
        category: 'Starters',
        emoji: '🍜',
        modelId: 'salad-model'
    },
    {
        id: 'salad',
        name: 'Garden Salad',
        description: 'Fresh mixed greens with cherry tomatoes, cucumber, and balsamic',
        price: 9.99,
        category: 'Starters',
        emoji: '🥗',
        modelId: 'salad-model'
    },
    {
        id: 'calamari',
        name: 'Fried Calamari',
        description: 'Crispy squid rings with marinara sauce',
        price: 12.99,
        category: 'Starters',
        emoji: '🦑',
        modelId: 'salad-model'
    },

    // MAIN COURSES
    {
        id: 'burger',
        name: 'Classic Burger',
        description: 'Juicy beef patty with fresh lettuce, tomato, cheese, and special sauce',
        price: 14.99,
        category: 'Main Course',
        emoji: '🍔',
        modelId: 'burger-model'
    },
    {
        id: 'pizza',
        name: 'Margherita Pizza',
        description: 'Traditional Italian pizza with fresh mozzarella, basil, and tomato sauce',
        price: 16.99,
        category: 'Main Course',
        emoji: '🍕',
        modelId: 'pizza-model'
    },
    {
        id: 'pasta',
        name: 'Spaghetti Carbonara',
        description: 'Creamy pasta with crispy bacon, parmesan cheese, and black pepper',
        price: 15.99,
        category: 'Main Course',
        emoji: '🍝',
        modelId: 'pasta-model'
    },
    {
        id: 'steak',
        name: 'Grilled Ribeye',
        description: 'Premium 12oz ribeye steak with herb butter and seasonal vegetables',
        price: 32.99,
        category: 'Main Course',
        emoji: '🥩',
        modelId: 'steak-model'
    },
    {
        id: 'salmon',
        name: 'Grilled Salmon',
        description: 'Fresh Atlantic salmon with lemon butter sauce and asparagus',
        price: 26.99,
        category: 'Main Course',
        emoji: '🐟',
        modelId: 'steak-model'
    },
    {
        id: 'chicken',
        name: 'Roasted Chicken',
        description: 'Half chicken with rosemary, garlic, and roasted potatoes',
        price: 19.99,
        category: 'Main Course',
        emoji: '🍗',
        modelId: 'burger-model'
    },
    {
        id: 'risotto',
        name: 'Mushroom Risotto',
        description: 'Creamy Arborio rice with wild mushrooms and parmesan',
        price: 18.99,
        category: 'Main Course',
        emoji: '🍚',
        modelId: 'pasta-model'
    },
    {
        id: 'lasagna',
        name: 'Beef Lasagna',
        description: 'Layers of pasta, beef ragù, béchamel, and melted cheese',
        price: 17.99,
        category: 'Main Course',
        emoji: '🧀',
        modelId: 'pasta-model'
    },

    // DESSERTS
    {
        id: 'dessert',
        name: 'Chocolate Lava Cake',
        description: 'Warm chocolate cake with molten center, served with vanilla ice cream',
        price: 9.99,
        category: 'Desserts',
        emoji: '🍫',
        modelId: 'dessert-model'
    },
    {
        id: 'tiramisu',
        name: 'Tiramisu',
        description: 'Classic Italian dessert with espresso-soaked ladyfingers and mascarpone',
        price: 8.99,
        category: 'Desserts',
        emoji: '🍰',
        modelId: 'dessert-model'
    },
    {
        id: 'cheesecake',
        name: 'New York Cheesecake',
        description: 'Creamy cheesecake with berry compote',
        price: 9.99,
        category: 'Desserts',
        emoji: '🧁',
        modelId: 'dessert-model'
    },
    {
        id: 'icecream',
        name: 'Gelato Selection',
        description: 'Three scoops of artisan Italian gelato',
        price: 7.99,
        category: 'Desserts',
        emoji: '🍨',
        modelId: 'dessert-model'
    },

    // DRINKS
    {
        id: 'coffee',
        name: 'Espresso',
        description: 'Rich Italian espresso shot',
        price: 3.99,
        category: 'Drinks',
        emoji: '☕',
        modelId: 'dessert-model'
    },
    {
        id: 'latte',
        name: 'Caffè Latte',
        description: 'Espresso with steamed milk and light foam',
        price: 5.99,
        category: 'Drinks',
        emoji: '🥛',
        modelId: 'dessert-model'
    },
    {
        id: 'wine',
        name: 'House Wine',
        description: 'Glass of red or white wine',
        price: 8.99,
        category: 'Drinks',
        emoji: '🍷',
        modelId: 'dessert-model'
    },
    {
        id: 'cocktail',
        name: 'Signature Cocktail',
        description: 'Ask your server for today\'s special creation',
        price: 12.99,
        category: 'Drinks',
        emoji: '🍹',
        modelId: 'dessert-model'
    },
    {
        id: 'lemonade',
        name: 'Fresh Lemonade',
        description: 'Homemade lemonade with mint',
        price: 4.99,
        category: 'Drinks',
        emoji: '🍋',
        modelId: 'dessert-model'
    }
];

// Restaurant Configuration
const restaurantConfig = {
    name: 'La Palma',
    currency: '$',
    primaryColor: '#8b2d2d',
    secondaryColor: '#2d5a3d'
};
