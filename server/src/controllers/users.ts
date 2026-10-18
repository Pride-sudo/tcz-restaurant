import bcrypt from 'bcryptjs';
import { User } from '../models';
import { ApiError } from '../utils/ApiError';
import { asyncHandler, ok } from '../utils/helpers';
import { currentUser, setAuthCookie, signToken } from '../middleware/auth';
import { publicUser } from './auth';

export const getMe = asyncHandler(async (req, res) => ok(res, { user: publicUser(currentUser(req)) }));

export const updateMe = asyncHandler(async (req, res) => {
  const user = currentUser(req);
  if (req.body.name !== undefined) user.name = req.body.name;
  if (req.body.phone !== undefined) user.phone = req.body.phone || undefined;
  await user.save();
  ok(res, { user: publicUser(user) });
});

export const changePassword = asyncHandler(async (req, res) => {
  const u: any = await User.findById(currentUser(req)._id).select('+passwordHash');
  if (!(await bcrypt.compare(req.body.currentPassword, u.passwordHash))) throw new ApiError(400, 'Your current password is incorrect.', 'BAD_CREDENTIALS');
  u.passwordHash = await bcrypt.hash(req.body.newPassword, 12);
  u.tokenVersion += 1; // invalidates other sessions
  await u.save();
  setAuthCookie(res, signToken(u));
  ok(res, { message: 'Password changed. Other devices have been signed out.' });
});

export const listAddresses = asyncHandler(async (req, res) => ok(res, { addresses: currentUser(req).addresses }));

function normaliseDefault(user: any, keepId?: string) {
  const defaults = user.addresses.filter((a: any) => a.isDefault);
  if (defaults.length > 1 && keepId) defaults.forEach((a: any) => { if (String(a._id) !== keepId) a.isDefault = false; });
  if (user.addresses.length && !user.addresses.some((a: any) => a.isDefault)) user.addresses[0].isDefault = true;
}
export const addAddress = asyncHandler(async (req, res) => {
  const user = currentUser(req);
  if (user.addresses.length >= 10) throw ApiError.badRequest('You can save up to 10 addresses.');
  user.addresses.push({ ...req.body, isDefault: req.body.isDefault || user.addresses.length === 0 });
  const added = user.addresses[user.addresses.length - 1];
  normaliseDefault(user, req.body.isDefault ? String(added._id) : undefined);
  await user.save();
  ok(res, { addresses: user.addresses }, 201);
});
export const updateAddress = asyncHandler(async (req, res) => {
  const user = currentUser(req);
  const a = user.addresses.id(req.params.addressId);
  if (!a) throw ApiError.notFound('Address not found.');
  a.set(req.body);
  normaliseDefault(user, req.body.isDefault ? String(a._id) : undefined);
  await user.save();
  ok(res, { addresses: user.addresses });
});
export const deleteAddress = asyncHandler(async (req, res) => {
  const user = currentUser(req);
  const a = user.addresses.id(req.params.addressId);
  if (!a) throw ApiError.notFound('Address not found.');
  a.deleteOne();
  normaliseDefault(user);
  await user.save();
  ok(res, { addresses: user.addresses });
});
