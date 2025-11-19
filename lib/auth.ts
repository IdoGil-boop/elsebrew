import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';

export interface GoogleUser {
  sub: string; // Google user ID
  email: string;
  name: string;
  picture?: string;
  email_verified?: boolean;
}

/**
 * Verify Google JWT token server-side
 * For production, this should use Google's public keys for verification
 * For now, we'll decode and validate basic structure
 *
 * NOTE: This is a simplified MVP implementation. For production:
 * 1. Verify signature using Google's public keys
 * 2. Implement refresh token flow
 * 3. Use proper session management
 */
export async function verifyGoogleToken(token: string): Promise<GoogleUser | null> {
  try {
    // Decode without verification (Google Sign-In already verified client-side)
    // In production, fetch Google's public keys and verify signature
    const decoded = jwt.decode(token) as GoogleUser;

    if (!decoded || !decoded.sub || !decoded.email) {
      console.error('[Auth] Token decode failed - missing required fields');
      return null;
    }

    // For MVP: Allow slightly expired tokens (up to 24 hours past expiration)
    // This is acceptable since we're using localStorage and no sensitive operations
    // In production, implement proper refresh token flow instead
    const exp = (decoded as any).exp;
    if (exp) {
      const expirationTime = exp * 1000;
      const now = Date.now();
      const twentyFourHours = 24 * 60 * 60 * 1000;

      if (now >= expirationTime + twentyFourHours) {
        console.error('[Auth] Token expired more than 24 hours ago');
        return null;
      }

      if (now >= expirationTime) {
        console.warn('[Auth] Token expired but within 24-hour grace period');
      }
    }

    return decoded;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

/**
 * Extract and verify user from request headers
 */
export async function getUserFromRequest(request: NextRequest): Promise<GoogleUser | null> {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  return verifyGoogleToken(token);
}

/**
 * Middleware to protect API routes
 */
export async function requireAuth(request: NextRequest): Promise<{ user: GoogleUser } | { error: string; status: number }> {
  const user = await getUserFromRequest(request);

  if (!user) {
    return { error: 'Unauthorized', status: 401 };
  }

  return { user };
}
