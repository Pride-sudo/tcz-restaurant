import { Restaurant, Settings } from '../models';
import { openingHoursDefault } from './defaults';

let cached: any = null;
/** Single-restaurant mode: resolves (and lazily creates) the default restaurant. */
export async function getRestaurant() {
  if (cached) { const still = await Restaurant.exists({ _id: cached._id }); if (still) return cached; cached = null; }
  let r = await Restaurant.findOne({ slug: 'tcz-restaurant' });
  if (!r) r = await Restaurant.create({ name: 'TCZ Restaurant', slug: 'tcz-restaurant' });
  cached = r;
  return r;
}
export const resetRestaurantCache = () => { cached = null; };

export async function getSettings(restaurantId?: any) {
  const rid = restaurantId || (await getRestaurant())._id;
  let s = await Settings.findOne({ restaurantId: rid });
  if (!s) s = await Settings.findOneAndUpdate({ restaurantId: rid }, { $setOnInsert: { restaurantId: rid, openingHours: openingHoursDefault() } }, { upsert: true, new: true });
  return s!;
}
