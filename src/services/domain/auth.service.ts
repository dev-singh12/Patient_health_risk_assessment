import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { eq, and, isNull } from "drizzle-orm";

import { db } from "../../config/db";
import { users, refreshTokens } from "../../db/schema";
import { redis } from "../../config/redis";
import { env } from "../../config/env";
import { childLogger } from "../../config/logger";
import { AuthenticationError, ConflictError } from "../../errors";
import type { LoginDto, RegisterDto, AuthResultDto } from "../../dtos/auth.dto";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BCRYPT_SALT_ROUNDS = 10;
const BRUTE_FORCE_MAX_ATTEMPTS = 5;
const BRUTE_FORCE_WINDOW_SECONDS = 600; // 10 minutes
const BRUTE_FORCE_BLOCK_SECONDS = 900; // 15 minutes

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface IAuthService {
  register(dto: RegisterDto): Promise<AuthResultDto>;
  login(dto: LoginDto, ip: string, correlationId: string): Promise<AuthResultDto>;
  refresh(refreshToken: string): Promise<AuthResultDto>;
  logout(refreshToken: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function signAccessToken(userId: string, role: string): string {
  return jwt.sign(
    { userId, role },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRY as jwt.SignOptions["expiresIn"] },
  );
}

function refreshTokenExpiresAt(): Date {
  const d = new Date();
  d.setDate(d.getDate() + env.REFRESH_TOKEN_EXPIRY_DAYS);
  return d;
}

function buildAuthResult(
  user: { userId: string; name: string; role: string },
  accessToken: string,
  refreshToken: string,
): AuthResultDto {
  return {
    accessToken,
    refreshToken,
    user: {
      userId: user.userId,
      name: user.name,
      role: user.role as "HEALTHCARE_STAFF" | "PATIENT",
    },
  };
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class AuthService implements IAuthService {
  async register(dto: RegisterDto): Promise<AuthResultDto> {
    const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);

    let user: { userId: string; name: string; role: string };
    try {
      const [row] = await db
        .insert(users)
        .values({
          name: dto.name,
          email: dto.email,
          password: hashedPassword,
          role: "PATIENT",
        })
        .returning({ userId: users.userId, name: users.name, role: users.role });
      user = row;
    } catch (err: unknown) {
      // Postgres unique violation code = 23505
      if (
        err instanceof Error &&
        "code" in err &&
        (err as NodeJS.ErrnoException).code === "23505"
      ) {
        throw new ConflictError("Email already in use");
      }
      throw err;
    }

    const familyId = uuidv4();
    const token = uuidv4();
    await db.insert(refreshTokens).values({
      userId: user.userId,
      familyId,
      token,
      expiresAt: refreshTokenExpiresAt(),
    });

    return buildAuthResult(user, signAccessToken(user.userId, user.role), token);
  }

  async login(dto: LoginDto, ip: string, correlationId: string): Promise<AuthResultDto> {
    const log = childLogger(correlationId);

    // Brute-force check
    const blockedKey = `login_blocked:${ip}`;
    const isBlocked = await redis.get(blockedKey).catch(() => null);
    if (isBlocked) {
      log.warn({ ip }, "Login attempt from blocked IP");
      throw new AuthenticationError("Too many failed login attempts. Try again later.");
    }

    // Credential verification
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.email, dto.email), isNull(users.deletedAt)))
      .limit(1);

    const attemptsKey = `login_attempts:${ip}`;
    const credentialsValid =
      user !== undefined && (await bcrypt.compare(dto.password, user.password));

    if (!credentialsValid) {
      let attempts: number;
      try {
        attempts = await redis.incr(attemptsKey);
        if (attempts === 1) await redis.expire(attemptsKey, BRUTE_FORCE_WINDOW_SECONDS);
      } catch {
        attempts = 1;
      }

      if (attempts >= BRUTE_FORCE_MAX_ATTEMPTS) {
        log.warn({ ip, attempts, correlationId }, "Brute-force threshold reached — blocking IP");
        try {
          await redis.set(blockedKey, "1", "EX", BRUTE_FORCE_BLOCK_SECONDS);
          await redis.del(attemptsKey);
        } catch {
          log.warn({ ip }, "Failed to set brute-force block key in Redis");
        }
        throw new AuthenticationError("Too many failed login attempts. Try again later.");
      }

      throw new AuthenticationError("Invalid credentials");
    }

    try { await redis.del(attemptsKey); } catch { /* non-critical */ }

    const familyId = uuidv4();
    const token = uuidv4();
    await db.insert(refreshTokens).values({
      userId: user.userId,
      familyId,
      token,
      expiresAt: refreshTokenExpiresAt(),
    });

    return buildAuthResult(
      { userId: user.userId, name: user.name, role: user.role },
      signAccessToken(user.userId, user.role),
      token,
    );
  }

  async refresh(refreshToken: string): Promise<AuthResultDto> {
    const [existing] = await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.token, refreshToken))
      .limit(1);

    if (!existing) throw new AuthenticationError("Invalid refresh token");

    if (existing.usedAt !== null) {
      // Reuse detected — invalidate entire family
      await db.delete(refreshTokens).where(eq(refreshTokens.familyId, existing.familyId));
      throw new AuthenticationError("Refresh token reuse detected. All sessions invalidated.");
    }

    if (existing.expiresAt < new Date()) {
      throw new AuthenticationError("Refresh token has expired");
    }

    // Mark old token used
    await db
      .update(refreshTokens)
      .set({ usedAt: new Date() })
      .where(eq(refreshTokens.tokenId, existing.tokenId));

    const [user] = await db
      .select({ userId: users.userId, name: users.name, role: users.role })
      .from(users)
      .where(and(eq(users.userId, existing.userId), isNull(users.deletedAt)))
      .limit(1);

    if (!user) throw new AuthenticationError("User not found");

    const newToken = uuidv4();
    await db.insert(refreshTokens).values({
      userId: user.userId,
      familyId: existing.familyId,
      token: newToken,
      expiresAt: refreshTokenExpiresAt(),
    });

    return buildAuthResult(user, signAccessToken(user.userId, user.role), newToken);
  }

  async logout(refreshToken: string): Promise<void> {
    const [existing] = await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.token, refreshToken))
      .limit(1);

    if (!existing || existing.usedAt !== null) return;

    await db
      .update(refreshTokens)
      .set({ usedAt: new Date() })
      .where(eq(refreshTokens.tokenId, existing.tokenId));
  }
}
