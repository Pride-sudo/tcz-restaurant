/**
 * DEVELOPMENT-ONLY seed. Refuses to run when NODE_ENV=production.
 *   npm run seed            -> seeds only into an empty database
 *   npm run seed -- --reset -> wipes this database's TCZ collections first (non-production only)
 */
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { env, isProd } from '../config/env';
import { connectDb, disconnectDb } from '../config/db';
import { Category, Coupon, Food, InventoryMovement, Order, Review, Settings, User } from '../models';
import { getRestaurant, getSettings, resetRestaurantCache } from '../services/restaurant';
import { changeStatus, createOrder } from '../services/orders';
import { recalcRating } from '../controllers/food';

if (isProd) { console.error('Refusing to seed: NODE_ENV=production.'); process.exit(1); }
const reset = process.argv.includes('--reset');
const img = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=900&q=70`;
const I = { burger: '1568901346375-23c9450c58cd', pizza: '1513104890138-7c749659a591', pasta: '1621996346565-e3dbc646d9a9', salad: '1512621776951-a57141f2eefd', sushi: '1579871494447-9811cf80d66c', steak: '1546964124-0cce460f38ef', fries: '1573080496219-bb080dd4f877', wings: '1567620832903-9fc6debc209f', cake: '1578985545062-69928b1d9587', icecream: '1497034825429-c343d7c6a68f', coffee: '1509042239860-f550ce710b93', smoothie: '1505252585461-04db1eb84625', tacos: '1565299585323-38d6b0865b47', soup: '1547592166-23ac45744acd', bowl: '1512058564366-18510be2db19', breakfast: '1525351484163-7529414344d8', lemonade: '1621263764928-df1444c5e859' };

const categories = [['Burgers', 'sandwich'], ['Pizza & Pasta', 'pizza'], ['Grill & Mains', 'flame'], ['Salads & Bowls', 'salad'], ['Sides & Starters', 'soup'], ['Desserts', 'cake-slice'], ['Drinks', 'cup-soda']];
// name, category, cents, description, image, prep, stock, lowThreshold, flags
const foods: any[] = [
  ['Classic Chicken Burger', 0, 850, 'Crispy buttermilk chicken, lettuce, tomato and house sauce on a toasted brioche bun.', 'burger', 15, 35, 10, { isFeatured: true, soldCount: 120, allergens: ['Gluten', 'Egg', 'Milk'], ingredients: ['Chicken', 'Brioche bun', 'Lettuce', 'Tomato', 'House sauce'], variants: [{ name: 'Single', priceDeltaCents: 0 }, { name: 'Double', priceDeltaCents: 300 }] }],
  ['Smoky BBQ Beef Burger', 0, 1100, 'Flame-grilled beef patty, cheddar, caramelised onion and smoky BBQ glaze.', 'burger', 18, 28, 8, { isChefPick: true, soldCount: 95, allergens: ['Gluten', 'Milk'] }],
  ['Veggie Garden Burger', 0, 900, 'Chickpea and herb patty with avocado, rocket and lemon mayo.', 'burger', 15, 20, 8, { allergens: ['Gluten', 'Egg'], soldCount: 30 }],
  ['Margherita Pizza', 1, 1000, 'Wood-fired base, San Marzano tomato, fresh mozzarella and basil.', 'pizza', 20, 25, 8, { isFeatured: true, soldCount: 110, allergens: ['Gluten', 'Milk'], variants: [{ name: 'Medium', priceDeltaCents: 0 }, { name: 'Large', priceDeltaCents: 400 }] }],
  ['Spicy Pepperoni Pizza', 1, 1300, 'Pepperoni, chilli honey, mozzarella and oregano.', 'pizza', 20, 6, 10, { soldCount: 80, allergens: ['Gluten', 'Milk'], discountPercent: 15 }],
  ['Creamy Chicken Alfredo', 1, 1200, 'Fettuccine in parmesan cream with grilled chicken and parsley.', 'pasta', 18, 18, 8, { isChefPick: true, soldCount: 60, allergens: ['Gluten', 'Milk', 'Egg'] }],
  ['Slow-cooked Beef Stew & Sadza', 2, 1250, 'Tender beef stew with seasonal greens, served with sadza.', 'steak', 25, 15, 6, { isFeatured: true, soldCount: 70, ingredients: ['Beef', 'Tomato', 'Onion', 'Maize meal', 'Greens'] }],
  ['Grilled Ribeye Steak', 2, 2200, '300g ribeye, garlic butter, charred greens and peppercorn sauce.', 'steak', 25, 10, 5, { isChefPick: true, soldCount: 40, allergens: ['Milk'] }],
  ['Peri-Peri Half Chicken', 2, 1400, 'Flame-grilled half chicken with peri-peri basting and a choice of side.', 'wings', 25, 22, 8, { isFeatured: true, soldCount: 130, variants: [{ name: 'Mild', priceDeltaCents: 0 }, { name: 'Hot', priceDeltaCents: 0 }] }],
  ['Salmon Teriyaki Rice Bowl', 3, 1500, 'Glazed salmon, sushi rice, edamame, pickled cucumber and sesame.', 'bowl', 18, 12, 6, { soldCount: 35, allergens: ['Fish', 'Soy', 'Sesame'] }],
  ['Harvest Chicken Salad', 3, 950, 'Grilled chicken, mixed leaves, roasted butternut, seeds and citrus dressing.', 'salad', 12, 20, 8, { soldCount: 45 }],
  ['Sushi Sharing Platter', 3, 1800, 'Assorted nigiri and maki, wasabi, pickled ginger and soy.', 'sushi', 20, 0, 5, { soldCount: 25, allergens: ['Fish', 'Soy', 'Gluten'] }],
  ['Street Tacos (3)', 3, 1000, 'Three soft tacos with citrus-marinated chicken, slaw and lime crema.', 'tacos', 14, 30, 10, { soldCount: 55, allergens: ['Gluten', 'Milk'], discountPercent: 10 }],
  ['Loaded Skin-on Fries', 4, 600, 'Crisp fries with cheese sauce, spring onion and chilli flakes.', 'fries', 10, 50, 15, { soldCount: 140, allergens: ['Milk'] }],
  ['Hot Wings (8)', 4, 900, 'Sticky hot wings with ranch dip and celery.', 'wings', 15, 9, 10, { soldCount: 90, allergens: ['Milk', 'Egg'] }],
  ['Roasted Tomato Soup', 4, 550, 'Slow-roasted tomato and basil soup with garlic croutons.', 'soup', 10, 24, 8, { soldCount: 20, allergens: ['Gluten'] }],
  ['Full English Breakfast', 4, 1100, 'Eggs, bacon, sausage, beans, grilled tomato and toast. Served all day.', 'breakfast', 18, 16, 6, { soldCount: 50, allergens: ['Egg', 'Gluten'] }],
  ['Chocolate Fudge Cake', 5, 650, 'Dense chocolate sponge, fudge ganache and cream.', 'cake', 5, 14, 5, { isChefPick: true, soldCount: 85, allergens: ['Gluten', 'Egg', 'Milk'] }],
  ['Vanilla Bean Ice Cream', 5, 450, 'Three scoops of vanilla bean ice cream with berry coulis.', 'icecream', 5, 40, 10, { soldCount: 40, allergens: ['Milk'] }],
  ['Fresh Mint Lemonade', 6, 400, 'Freshly squeezed lemon, mint and a touch of cane sugar.', 'lemonade', 5, 45, 12, { isFeatured: true, soldCount: 100, unit: 'bottle' }],
  ['Mango Passion Smoothie', 6, 550, 'Mango, passion fruit and yoghurt blended with ice.', 'smoothie', 6, 5, 10, { soldCount: 65, allergens: ['Milk'], unit: 'cup' }],
  ['Flat White', 6, 350, 'Double ristretto with silky steamed milk.', 'coffee', 5, 60, 15, { soldCount: 150, allergens: ['Milk'], unit: 'cup' }],
];

(async () => {
  await connectDb();
  if (reset) { console.log('Resetting TCZ collections...'); await Promise.all(Object.values(mongoose.models).map((m) => m.deleteMany({}))); resetRestaurantCache(); }
  else if (await Food.exists({})) { console.error('Database already has products. Re-run with `npm run seed -- --reset` to wipe and reseed (development only).'); await disconnectDb(); process.exit(1); }

  const r = await getRestaurant();
  await getSettings(r._id);
  await Settings.updateOne({ restaurantId: r._id }, { name: 'TCZ Restaurant', email: 'hello@tcz.example', phone: '+263 77 000 0000', address: '12 Samora Machel Ave, Harare', currency: 'USD', taxRatePercent: 0, deliveryFeeCents: 300, freeDeliveryOverCents: 4000, minOrderCents: 500, deliveryAreas: [] });

  const cats: any[] = [];
  for (let i = 0; i < categories.length; i++) cats.push(await Category.create({ restaurantId: r._id, name: categories[i][0], slug: categories[i][0].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, ''), icon: categories[i][1], sortOrder: i }));

  for (const [name, ci, priceCents, description, image, prepMinutes, stock, lowStockThreshold, extra] of foods) {
    const f: any = await Food.create({ restaurantId: r._id, name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, ''), description, category: cats[ci]._id, image: img((I as any)[image]), priceCents, prepMinutes, stock, lowStockThreshold, costCents: Math.round(priceCents * 0.35), reorderQuantity: 25, lastRestockedAt: new Date(), ...extra });
    await InventoryMovement.create({ restaurantId: r._id, foodId: f._id, type: 'restock', stockDelta: stock, stockAfter: stock, reservedAfter: 0, reason: 'Initial seed stock' });
  }

  const hash = (p: string) => bcrypt.hash(p, 10);
  const customer: any = await User.create({ restaurantId: r._id, name: 'Tendai Moyo', email: 'customer@tcz.test', phone: '+263771234567', passwordHash: await hash('Customer123!'), addresses: [{ label: 'Home', line1: '45 Borrowdale Road', city: 'Harare', isDefault: true }] });
  await User.create({ restaurantId: r._id, name: 'Kitchen Staff', email: 'staff@tcz.test', passwordHash: await hash('Staff12345!'), role: 'staff' });
  if (env.ADMIN_EMAIL && env.ADMIN_PASSWORD) await User.create({ restaurantId: r._id, name: env.ADMIN_NAME, email: env.ADMIN_EMAIL, passwordHash: await hash(env.ADMIN_PASSWORD), role: 'admin' });

  const day = 86400000;
  await Coupon.create([
    { restaurantId: r._id, code: 'WELCOME10', description: '10% off your order', type: 'percent', value: 10, minOrderCents: 1000, maxDiscountCents: 1000 },
    { restaurantId: r._id, code: 'SAVE3', description: '$3 off orders over $15', type: 'fixed', value: 300, minOrderCents: 1500 },
    { restaurantId: r._id, code: 'OLDDEAL', description: 'Expired example coupon', type: 'percent', value: 20, expiresAt: new Date(Date.now() - day) },
  ]);

  // Sample orders go through the real order service so reservations, stock commits and timelines are genuine.
  const byName = async (n: string) => String((await Food.findOne({ name: n }))!._id);
  const mk = async (key: string, items: [string, number][], coupon?: string) => (await createOrder(customer, { items: await Promise.all(items.map(async ([n, q]) => ({ foodId: await byName(n), quantity: q }))), paymentMethod: 'cash', customer: { name: customer.name, phone: customer.phone }, addressId: String(customer.addresses[0]._id), couponCode: coupon, instructions: 'Gate code 1234' }, `seed-${key}-0001`)).order;
  const staff: any = await User.findOne({ email: 'staff@tcz.test' });
  const walk = async (o: any, steps: string[]) => { for (const s of steps) await changeStatus(o._id, s, staff); };
  const full = ['confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered'];
  const o1 = await mk('o1', [['Classic Chicken Burger', 2], ['Loaded Skin-on Fries', 1]], 'WELCOME10'); await walk(o1, full);
  const o2 = await mk('o2', [['Margherita Pizza', 1], ['Fresh Mint Lemonade', 2]]); await walk(o2, full);
  const o3 = await mk('o3', [['Grilled Ribeye Steak', 1]]); await walk(o3, ['confirmed', 'preparing', 'ready', 'out_for_delivery']);
  const o4 = await mk('o4', [['Peri-Peri Half Chicken', 2]]); await walk(o4, ['confirmed', 'preparing']);
  await mk('o5', [['Hot Wings (8)', 1], ['Flat White', 2]]);
  const o6 = await mk('o6', [['Chocolate Fudge Cake', 2]]); await changeStatus(o6._id, 'cancelled', staff, 'Customer changed their mind');

  for (const [order, food, rating, comment] of [[o1, 'Classic Chicken Burger', 5, 'Crispy, juicy and arrived hot. Easily the best chicken burger in Harare.'], [o2, 'Margherita Pizza', 4, 'Great base and fresh basil. Slightly late but worth it.'], [o2, 'Fresh Mint Lemonade', 5, 'Perfectly tart and minty.']] as any[]) {
    const f: any = await Food.findOne({ name: food });
    await Review.create({ foodId: f._id, userId: customer._id, orderId: order._id, rating, comment }); await recalcRating(f._id);
  }
  console.log(`Seeded ${foods.length} products, ${categories.length} categories, 6 orders, 3 coupons, 3 reviews.\nDemo logins (development only):\n  customer@tcz.test / Customer123!\n  staff@tcz.test    / Staff12345!\nCreate your admin with: npm run create-admin`);
  await disconnectDb();
})().catch((e) => { console.error(e); process.exit(1); });
