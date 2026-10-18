import { Types } from 'mongoose';
import { Category, Food, Review } from '../models';
import { ApiError } from '../utils/ApiError';
import { asyncHandler, escapeRegex, ok, pageMeta } from '../utils/helpers';
import { availableStock, unitPricing } from '../services/pricing';
import { getRestaurant } from '../services/restaurant';

export const toFoodDto = (f: any, now = new Date()) => {
  const p = unitPricing(f, null, now)!;
  const avail = availableStock(f);
  const cat = f.category && f.category.name ? { id: String(f.category._id), name: f.category.name, slug: f.category.slug, icon: f.category.icon } : f.category ? { id: String(f.category) } : null;
  return {
    id: String(f._id), slug: f.slug, name: f.name, description: f.description, category: cat, image: f.image,
    priceCents: f.priceCents, finalPriceCents: p.final, discountPercent: p.discount > 0 ? f.discountPercent : 0, discountEndsAt: p.discount > 0 ? f.discountEndsAt : null,
    prepMinutes: f.prepMinutes, isFeatured: f.isFeatured, isChefPick: f.isChefPick, ingredients: f.ingredients, allergens: f.allergens, variants: f.variants,
    ratingAvg: f.ratingAvg, ratingCount: f.ratingCount, soldCount: f.soldCount, unit: f.unit, maxPerOrder: f.maxPerOrder,
    available: f.isAvailable && avail > 0, lowStock: f.isAvailable && avail > 0 && avail <= f.lowStockThreshold, createdAt: f.createdAt,
  };
};

export const listCategories = asyncHandler(async (_req, res) => {
  const r = await getRestaurant();
  const cats = await Category.find({ restaurantId: r._id }).sort({ sortOrder: 1, name: 1 });
  const counts = await Food.aggregate([{ $match: { restaurantId: r._id, archived: false } }, { $group: { _id: '$category', n: { $sum: 1 } } }]);
  const map = new Map(counts.map((c: any) => [String(c._id), c.n]));
  ok(res, cats.map((c: any) => ({ id: String(c._id), name: c.name, slug: c.slug, icon: c.icon, count: map.get(String(c._id)) || 0 })));
});

export const listFoods = asyncHandler(async (req, res) => {
  const r = await getRestaurant();
  const { q, category, minPrice, maxPrice, minRating, sort, page, limit, available } = req.query as any;
  const filter: any = { restaurantId: r._id, archived: false };
  if (q) { const rx = new RegExp(escapeRegex(q), 'i'); filter.$or = [{ name: rx }, { description: rx }]; }
  if (category) { const c: any = await Category.findOne({ restaurantId: r._id, slug: category }); filter.category = c ? c._id : new Types.ObjectId(); }
  if (minPrice != null || maxPrice != null) { filter.priceCents = {}; if (minPrice != null) filter.priceCents.$gte = Math.round(minPrice * 100); if (maxPrice != null) filter.priceCents.$lte = Math.round(maxPrice * 100); }
  if (minRating) filter.ratingAvg = { $gte: minRating };
  if (available === 'true') { filter.isAvailable = true; filter.$expr = { $gt: [{ $subtract: ['$stock', '$reserved'] }, 0] }; }
  const sorts: Record<string, any> = { popular: { soldCount: -1, ratingCount: -1, _id: 1 }, price_asc: { priceCents: 1 }, price_desc: { priceCents: -1 }, rating: { ratingAvg: -1, ratingCount: -1 }, newest: { createdAt: -1 } };
  const [items, total] = await Promise.all([
    Food.find(filter).populate('category', 'name slug icon').sort(sorts[sort]).skip((page - 1) * limit).limit(limit),
    Food.countDocuments(filter),
  ]);
  ok(res, items.map((f) => toFoodDto(f)), 200, pageMeta(page, limit, total));
});

export const featured = asyncHandler(async (_req, res) => {
  const r = await getRestaurant();
  const base: any = { restaurantId: r._id, archived: false, isAvailable: true };
  const pop = (f: any) => Food.find({ ...base, ...f }).populate('category', 'name slug icon');
  const [featuredItems, bestsellers, chefPicks, offers] = await Promise.all([
    pop({ isFeatured: true }).sort({ soldCount: -1 }).limit(8),
    pop({}).sort({ soldCount: -1, ratingCount: -1 }).limit(8),
    pop({ isChefPick: true }).limit(6),
    pop({ discountPercent: { $gt: 0 }, $or: [{ discountEndsAt: null }, { discountEndsAt: { $gt: new Date() } }] }).sort({ discountPercent: -1 }).limit(6),
  ]);
  const dto = (a: any[]) => a.map((f) => toFoodDto(f));
  ok(res, { featured: dto(featuredItems), bestsellers: dto(bestsellers), chefPicks: dto(chefPicks), offers: dto(offers) });
});

export const getFood = asyncHandler(async (req, res) => {
  const r = await getRestaurant();
  const id = req.params.id;
  const f = await Food.findOne({ restaurantId: r._id, archived: false, ...(Types.ObjectId.isValid(id) ? { _id: id } : { slug: id }) }).populate('category', 'name slug icon');
  if (!f) throw ApiError.notFound('That dish could not be found.');
  const related = await Food.find({ restaurantId: r._id, archived: false, category: (f.category as any)._id, _id: { $ne: f._id } }).populate('category', 'name slug icon').sort({ soldCount: -1 }).limit(4);
  ok(res, { food: toFoodDto(f), related: related.map((x) => toFoodDto(x)), allergenNotice: 'Ingredient and allergen details are provided by the restaurant. If you have a serious allergy, please contact us before ordering.' });
});

export const recalcRating = async (foodId: any) => {
  const [agg] = await Review.aggregate([{ $match: { foodId: new Types.ObjectId(String(foodId)) } }, { $group: { _id: null, avg: { $avg: '$rating' }, n: { $sum: 1 } } }]);
  await Food.updateOne({ _id: foodId }, { ratingAvg: agg ? Math.round(agg.avg * 10) / 10 : 0, ratingCount: agg?.n || 0 });
};
