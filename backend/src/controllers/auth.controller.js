// ============================================
// Auth Controller — Register / Login
// ============================================
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getPrismaClient } = require('../utils/prisma');
const { success, error } = require('../utils/response');
const logger = require('../utils/logger');
const { z } = require('zod');

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(1, 'Name is required').max(255),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

async function register(req, res) {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return error(res, 'Validation failed', 400, parsed.error.flatten().fieldErrors);
    }

    const { email, password, name } = parsed.data;
    const prisma = getPrismaClient();

    // Check if user exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return error(res, 'Email already registered', 409);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: { email, passwordHash, name },
      select: { id: true, email: true, name: true, createdAt: true },
    });

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    logger.info('User registered', { userId: user.id, email: user.email });

    return success(res, {
      user,
      token,
      expiresIn: JWT_EXPIRES_IN,
    }, 201);

  } catch (err) {
    logger.error('Registration failed', { error: err.message });
    return error(res, 'Registration failed', 500);
  }
}

async function login(req, res) {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return error(res, 'Validation failed', 400, parsed.error.flatten().fieldErrors);
    }

    const { email, password } = parsed.data;
    const prisma = getPrismaClient();

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return error(res, 'Invalid email or password', 401);
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return error(res, 'Invalid email or password', 401);
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    logger.info('User logged in', { userId: user.id, email: user.email });

    return success(res, {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
      },
      token,
      expiresIn: JWT_EXPIRES_IN,
    });

  } catch (err) {
    logger.error('Login failed', { error: err.message });
    return error(res, 'Login failed', 500);
  }
}

async function getProfile(req, res) {
  try {
    const prisma = getPrismaClient();
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, name: true, createdAt: true },
    });

    if (!user) {
      return error(res, 'User not found', 404);
    }

    return success(res, { user });
  } catch (err) {
    logger.error('Get profile failed', { error: err.message });
    return error(res, 'Failed to get profile', 500);
  }
}

module.exports = { register, login, getProfile };
