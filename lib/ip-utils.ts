import { NextRequest } from 'next/server';

/**
 * Extract IP address from Next.js request
 * Handles various proxy headers (Vercel, AWS, Cloudflare, etc.)
 */
export function getClientIp(request: NextRequest): string {
  // Try various headers in order of preference
  const headers = [
    'x-real-ip',           // Nginx
    'x-forwarded-for',     // Most proxies
    'cf-connecting-ip',    // Cloudflare
    'fastly-client-ip',    // Fastly
    'x-client-ip',         // Generic
    'x-cluster-client-ip', // Generic
    'forwarded-for',       // RFC 7239
    'forwarded',           // RFC 7239
  ];

  for (const header of headers) {
    const value = request.headers.get(header);
    if (value) {
      // x-forwarded-for can contain multiple IPs (client, proxy1, proxy2, ...)
      // We want the first one (the client)
      const ip = value.split(',')[0].trim();
      if (ip) {
        return ip;
      }
    }
  }

  // Fallback to connection IP (may not work in serverless)
  return 'unknown';
}

/**
 * Hash IP address for privacy (one-way hash)
 * This allows us to track users without storing actual IPs
 */
export async function hashIp(ip: string): Promise<string> {
  // Use Web Crypto API for hashing
  const encoder = new TextEncoder();
  const data = encoder.encode(ip + process.env.IP_HASH_SALT || 'elsebrew-salt');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return `ip_${hashHex.substring(0, 32)}`; // First 32 chars + prefix
}
