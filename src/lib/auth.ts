import { cookies } from "next/headers";
import {
  createHmac,
  randomBytes,
  pbkdf2 as pbkdf2Callback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { prisma } from "@/lib/prisma";

const pbkdf2 = promisify(pbkdf2Callback);

export const SESSION_COOKIE = "firmledger_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 8;

function getAuthSecret() {
  const value = process.env.AUTH_SECRET;

  if (!value) {
    throw new Error("AUTH_SECRET is not configured.");
  }

  return value;
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");

  const derived = await pbkdf2(
    password,
    salt,
    120_000,
    64,
    "sha512"
  );

  return `pbkdf2$120000$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  stored: string
) {
  try {
    const [algorithm, iterationsText, salt, expected] =
      stored.split("$");

    if (
      algorithm !== "pbkdf2" ||
      !iterationsText ||
      !salt ||
      !expected
    ) {
      return false;
    }

    const iterations = Number(iterationsText);

    if (!Number.isInteger(iterations) || iterations <= 0) {
      return false;
    }

    const derived = await pbkdf2(
      password,
      salt,
      iterations,
      64,
      "sha512"
    );

    const expectedBuffer = Buffer.from(expected, "hex");

    if (derived.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(derived, expectedBuffer);
  } catch {
    return false;
  }
}

function sign(value: string) {
  return createHmac(
    "sha256",
    getAuthSecret()
  )
    .update(value)
    .digest("hex");
}

export function makeSession(userId: string) {
  const expires =
    Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;

  const payload = `${userId}.${expires}`;
  const signature = sign(payload);

  return `${payload}.${signature}`;
}

export function parseSession(value: string | undefined) {
  if (!value) {
    return null;
  }

  const parts = value.split(".");

  if (parts.length !== 3) {
    return null;
  }

  const [userId, expiresText, signature] = parts;

  if (!userId || !expiresText || !signature) {
    return null;
  }

  const payload = `${userId}.${expiresText}`;

  let expectedSignature: string;

  try {
    expectedSignature = sign(payload);
  } catch {
    return null;
  }

  const actualBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expectedSignature, "hex");

  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null;
  }

  const expires = Number(expiresText);

  if (!Number.isFinite(expires)) {
    return null;
  }

  if (expires < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return {
    userId,
  };
}

export async function getCurrentUser() {
  const cookieStore = await cookies();

  const sessionCookie =
    cookieStore.get(SESSION_COOKIE)?.value;

  const session = parseSession(sessionCookie);

  if (!session) {
    return null;
  }

  return prisma.firmUser.findUnique({
    where: {
      id: session.userId,
    },
    include: {
      firm: true,
    },
  });
}