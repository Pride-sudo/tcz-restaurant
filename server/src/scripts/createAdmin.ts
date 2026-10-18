import bcrypt from 'bcryptjs';
import readline from 'readline';
import { env } from '../config/env';
import { connectDb, disconnectDb } from '../config/db';
import { User } from '../models';
import { getRestaurant } from '../services/restaurant';

const ask = (q: string) => new Promise<string>((res) => { const rl = readline.createInterface({ input: process.stdin, output: process.stdout }); rl.question(q, (a) => { rl.close(); res(a.trim()); }); });

/** Creates (or promotes) the first administrator. Credentials come from env vars or prompts - never hard-coded. */
(async () => {
  let email = env.ADMIN_EMAIL; let password = env.ADMIN_PASSWORD; const name = env.ADMIN_NAME || 'Owner';
  if (!email) email = (await ask('Admin email: ')).toLowerCase();
  if (!password) password = await ask('Admin password (min 10 chars, letters + numbers): ');
  if (password.length < 10 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) { console.error('Password must be at least 10 characters with letters and numbers.'); process.exit(1); }
  await connectDb();
  const r = await getRestaurant();
  const passwordHash = await bcrypt.hash(password, 12);
  const existing: any = await User.findOne({ email });
  if (existing) { existing.role = 'admin'; existing.status = 'active'; existing.passwordHash = passwordHash; existing.tokenVersion += 1; await existing.save(); console.log(`Updated existing user ${email} -> admin`); }
  else { await User.create({ name, email, passwordHash, role: 'admin', restaurantId: r._id }); console.log(`Created administrator ${email}`); }
  await disconnectDb();
})().catch((e) => { console.error(e.message); process.exit(1); });
