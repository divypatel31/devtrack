import bcrypt from 'bcryptjs';
import { prisma } from '../config/db';
import { AppError } from './habit.service';
import { signAuthToken } from '../middleware/auth.middleware';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BCRYPT_ROUNDS = 12;
// Precomputed dummy hash (cost 12) to prevent timing-based user enumeration on login
const DUMMY_PASSWORD_HASH = '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4oL2.8/K2G';

export interface RegisterInput {
  email: string;
  name: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export async function registerUser(input: RegisterInput) {
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const password = typeof input.password === 'string' ? input.password : '';

  if (!email || email.length > 254 || !EMAIL_REGEX.test(email)) {
    throw new AppError('A valid email address is required.', 400);
  }
  if (!name || name.length < 2 || name.length > 80) {
    throw new AppError('Name must be between 2 and 80 characters.', 400);
  }
  if (!password || password.length < 8 || password.length > 128) {
    throw new AppError('Password must be between 8 and 128 characters.', 400);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError('Unable to register with the provided credentials.', 409);
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
    },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
    },
  });

  const token = signAuthToken({ id: user.id, email: user.email, name: user.name });
  return { user, token };
}

export async function loginUser(input: LoginInput) {
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  const password = typeof input.password === 'string' ? input.password : '';

  if (!email || !password || password.length > 128) {
    throw new AppError('Invalid email or password.', 401);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
    throw new AppError('Invalid email or password.', 401);
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    throw new AppError('Invalid email or password.', 401);
  }

  const safeUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
  };

  const token = signAuthToken({ id: user.id, email: user.email, name: user.name });
  return { user: safeUser, token };
}

export async function getUserProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw new AppError('User not found.', 404);
  }
  return user;
}