import { getToken } from 'next-auth/jwt';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

type Role = 'Admin' | 'Agent' | null;

const AGENT_RATE_LIMIT_WINDOW_MS = 60_000;
const AGENT_RATE_LIMIT_MAX = 50;
const rateLimitBucket = new Map<string, { count: number; resetAt: number }>();

function isSafeScalar(value: string) {
  // Blocks obvious script/path traversal payloads in URL and JSON scalar values.
  if (value.length > 4000) return false;
  if (/\.{2,}|<\s*script|%3c\s*script|[\0]/i.test(value)) return false;
  return true;
}

function hasUnsafeValue(input: unknown): boolean {
  if (input == null) return false;
  if (typeof input === 'string') return !isSafeScalar(input);
  if (typeof input === 'number' || typeof input === 'boolean') return false;
  if (Array.isArray(input)) return input.some((v) => hasUnsafeValue(v));
  if (typeof input === 'object') {
    return Object.entries(input).some(([key, value]) => !isSafeScalar(key) || hasUnsafeValue(value));
  }
  return true;
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function pageRedirect(req: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, req.url));
}

function getRequestIdentity(req: NextRequest, token: { sub?: string | null; email?: string | null }) {
  const forwardedFor = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const realIp = req.headers.get('x-real-ip');
  return token.sub || token.email || forwardedFor || realIp || 'anonymous-agent';
}

function applyAgentRateLimit(req: NextRequest, key: string) {
  const now = Date.now();
  const bucket = rateLimitBucket.get(key);

  if (!bucket || now >= bucket.resetAt) {
    rateLimitBucket.set(key, {
      count: 1,
      resetAt: now + AGENT_RATE_LIMIT_WINDOW_MS,
    });
    return null;
  }

  if (bucket.count >= AGENT_RATE_LIMIT_MAX) {
    const retryAfterSec = Math.ceil((bucket.resetAt - now) / 1000);
    return NextResponse.json(
      {
        error: 'Rate limit exceeded for Agent requests. Try again shortly.',
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.max(1, retryAfterSec)),
        },
      }
    );
  }

  bucket.count += 1;
  rateLimitBucket.set(key, bucket);
  return null;
}

function validatePathAndQuery(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  if (!isSafeScalar(pathname)) {
    return jsonError('Unsafe path detected', 400);
  }

  for (const [key, value] of searchParams.entries()) {
    if (!isSafeScalar(key) || !isSafeScalar(value)) {
      return jsonError('Unsafe query parameter detected', 400);
    }
  }

  // Validate ObjectId shape for /api/leads/:id and /api/leads/:id/activities
  if (pathname.startsWith('/api/leads/')) {
    const parts = pathname.split('/').filter(Boolean);
    // Expected: [api, leads, :id, ...]
    const id = parts[2];
    const isHex24 = /^[a-fA-F0-9]{24}$/.test(id || '');
    if (id && id !== 'route.ts' && !isHex24) {
      return jsonError('Invalid lead id format', 400);
    }
  }

  return null;
}

async function validateRequestBody(req: NextRequest) {
  const method = req.method.toUpperCase();
  const shouldValidateBody = method === 'POST' || method === 'PUT' || method === 'PATCH';
  if (!shouldValidateBody) return null;

  const contentType = req.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return jsonError('Only application/json payloads are allowed', 415);
  }

  const contentLengthRaw = req.headers.get('content-length');
  if (contentLengthRaw) {
    const contentLength = Number(contentLengthRaw);
    if (!Number.isNaN(contentLength) && contentLength > 1_000_000) {
      return jsonError('Payload too large', 413);
    }
  }

  try {
    const payload = await req.clone().json();
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return jsonError('Request body must be a JSON object', 400);
    }
    if (hasUnsafeValue(payload)) {
      return jsonError('Unsafe value detected in request body', 400);
    }
  } catch {
    return jsonError('Malformed JSON payload', 400);
  }

  return null;
}

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith('/api/');

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const role = (token?.role as Role) ?? null;

  const isProtectedPage =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/agent') ||
    pathname.startsWith('/properties');
  const isProtectedApi = pathname.startsWith('/api/leads') || pathname.startsWith('/api/users');

  if ((isProtectedPage || isProtectedApi) && !token) {
    return isApi ? jsonError('Unauthorized', 401) : pageRedirect(req, '/login');
  }

  if (pathname.startsWith('/admin') && role !== 'Admin') {
    return isApi ? jsonError('Forbidden', 403) : pageRedirect(req, '/unauthorized');
  }

  if (pathname.startsWith('/agent') && role !== 'Agent' && role !== 'Admin') {
    return isApi ? jsonError('Forbidden', 403) : pageRedirect(req, '/unauthorized');
  }

  const pathQueryValidationError = validatePathAndQuery(req);
  if (pathQueryValidationError) return pathQueryValidationError;

  if (isProtectedApi) {
    const bodyValidationError = await validateRequestBody(req);
    if (bodyValidationError) return bodyValidationError;
  }

  // Admins are not limited; Agents are capped at 50 requests/minute on protected APIs.
  if (isProtectedApi && role === 'Agent') {
    const identity = getRequestIdentity(req, token ?? {});
    const limitError = applyAgentRateLimit(req, identity);
    if (limitError) return limitError;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/admin/:path*',
    '/agent/:path*',
    '/properties/:path*',
    '/api/leads/:path*',
    '/api/users/:path*',
  ],
};
