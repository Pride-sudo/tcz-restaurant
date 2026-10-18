import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { PasswordResetToken, User } from '../models';
import { ApiError } from '../utils/ApiError';
import { asyncHandler, ok, sha256 } from '../utils/helpers';
import { clearAuthCookie, currentUser, setAuthCookie, signToken } from '../middleware/auth';
import { getRestaurant } from '../services/restaurant';
import { sendMail } from '../services/mail';
import { clientOrigins } from '../config/env';

export const publicUser = (u: any) => ({ id: String(u._id), name: u.name, email: u.email, phone: u.phone || '', role: u.role, status: u.status, createdAt: u.createdAt, favorites: (u.favorites || []).map(String), addresses: u.addresses || [] });
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

export const register = asyncHandler(async (req, res) => {
  const { name, email, password, phone } = req.body;
  if (await User.exists({ email })) throw ApiError.conflict('An account with this email already exists. Try signing in.', 'EMAIL_TAKEN');
  const restaurant = await getRestaurant();
  // Role is never read from the request: public registration always creates customers.
  const user = await User.create({ name, email, phone: phone || undefined, passwordHash: await bcrypt.hash(password, 12), role: 'customer', restaurantId: restaurant._id });
  setAuthCookie(res, signToken(user));
  ok(res, { user: publicUser(user) }, 201);
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user: any = await User.findOne({ email }).select('+passwordHash');
  const valid = await bcrypt.compare(password, user?.passwordHash || DUMMY_HASH); // constant-ish time
  if (!user || !valid) throw new ApiError(401, 'Incorrect email or password.', 'BAD_CREDENTIALS');
  if (user.status !== 'active') throw ApiError.forbidden('This account has been suspended. Please contact the restaurant.');
  setAuthCookie(res, signToken(user));
  ok(res, { user: publicUser(user) });
});

export const logout = asyncHandler(async (_req, res) => { clearAuthCookie(res); ok(res, { loggedOut: true }); });
export const me = asyncHandler(async (req, res) => ok(res, { user: publicUser(currentUser(req)) }));

export const forgotPassword = asyncHandler(async (req, res) => {
  const user: any = await User.findOne({ email: req.body.email });
  if (user && user.status === 'active') {
    await PasswordResetToken.deleteMany({ userId: user._id });
    const token = crypto.randomBytes(32).toString('hex');
    await PasswordResetToken.create({ userId: user._id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 30 * 60_000) });
    const link = `${clientOrigins[0]}/reset-password?token=${token}`;
    await sendMail(user.email, 'Reset your TCZ Restaurant password', `Hi ${user.name},\n\nUse this link within 30 minutes to choose a new password:\n${link}\n\nIf you did not ask for this, you can ignore this email.`);
  }
  // Same response whether or not the account exists.
  ok(res, { message: 'If that email is registered, a reset link is on its way.' });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  const rec: any = await PasswordResetToken.findOne({ tokenHash: sha256(token), usedAt: null, expiresAt: { $gt: new Date() } });
  if (!rec) throw ApiError.badRequest('This reset link is invalid or has expired. Request a new one.', 'BAD_RESET_TOKEN');
  const claimed = await PasswordResetToken.findOneAndUpdate({ _id: rec._id, usedAt: null }, { usedAt: new Date() });
  if (!claimed) throw ApiError.badRequest('This reset link has already been used.', 'BAD_RESET_TOKEN');
  await User.updateOne({ _id: rec.userId }, { passwordHash: await bcrypt.hash(password, 12), $inc: { tokenVersion: 1 } }); // signs out all sessions
  await PasswordResetToken.deleteMany({ userId: rec.userId });
  ok(res, { message: 'Password updated. You can sign in now.' });
});
