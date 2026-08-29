// ============================================
// API Key Controller
// ============================================
const crypto = require('crypto');
const { getPrismaClient } = require('../utils/prisma');
const { success, error } = require('../utils/response');
const logger = require('../utils/logger');
const { z } = require('zod');

const createKeySchema = z.object({
  name: z.string().min(1).max(255),
  rateLimit: z.number().int().min(1).max(10000).default(100),
  expiresInDays: z.number().int().min(1).max(365).optional(),
  permissions: z.object({}).passthrough().optional(),
});

function generateApiKey() {
  const key = `ieps_${crypto.randomBytes(32).toString('hex')}`;
  const hash = crypto.createHash('sha256').update(key).digest('hex');
  const prefix = key.substring(0, 12);
  return { key, hash, prefix };
}

async function listApiKeys(req, res) {
  try {
    const prisma = getPrismaClient();
    const keys = await prisma.apiKey.findMany({
      where: { userId: req.user.id },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        rateLimit: true,
        permissions: true,
        lastUsedAt: true,
        expiresAt: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return success(res, { keys });
  } catch (err) {
    logger.error('List API keys failed', { error: err.message });
    return error(res, 'Failed to list API keys', 500);
  }
}

async function createApiKey(req, res) {
  try {
    const parsed = createKeySchema.safeParse(req.body);
    if (!parsed.success) {
      return error(res, 'Validation failed', 400, parsed.error.flatten().fieldErrors);
    }

    const { name, rateLimit, expiresInDays, permissions } = parsed.data;
    const { key, hash, prefix } = generateApiKey();
    const prisma = getPrismaClient();

    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const apiKey = await prisma.apiKey.create({
      data: {
        userId: req.user.id,
        name,
        keyHash: hash,
        keyPrefix: prefix,
        rateLimit,
        permissions: permissions || {},
        expiresAt,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        rateLimit: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    logger.info('API key created', { userId: req.user.id, keyId: apiKey.id });

    // Return the full key ONLY on creation
    return success(res, {
      ...apiKey,
      key, // Only shown once!
      message: 'Save this key now. It will not be shown again.',
    }, 201);

  } catch (err) {
    logger.error('Create API key failed', { error: err.message });
    return error(res, 'Failed to create API key', 500);
  }
}

async function revokeApiKey(req, res) {
  try {
    const prisma = getPrismaClient();
    const apiKey = await prisma.apiKey.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });

    if (!apiKey) {
      return error(res, 'API key not found', 404);
    }

    await prisma.apiKey.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });

    logger.info('API key revoked', { keyId: req.params.id });
    return success(res, { message: 'API key revoked' });

  } catch (err) {
    logger.error('Revoke API key failed', { error: err.message });
    return error(res, 'Failed to revoke API key', 500);
  }
}

module.exports = { listApiKeys, createApiKey, revokeApiKey };
