import { OAuth2Client } from 'google-auth-library';

// ----------------------------------------------------------------
// Error class
// ----------------------------------------------------------------

/**
 * Thrown when a Google id_token fails cryptographic verification
 * or contains an unexpected payload shape.
 */
export class GoogleTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleTokenError';
  }
}

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

/** Verified identity extracted from a Google id_token. */
export interface GoogleProfile {
  googleId: string;
  email: string;
  name: string;
}

// ----------------------------------------------------------------
// Service
// ----------------------------------------------------------------

/**
 * Verifies a Google id_token cryptographically and returns the user profile.
 *
 * Uses `google-auth-library`'s `OAuth2Client.verifyIdToken()` which validates
 * the signature, audience, and expiry — never trust an id_token without this.
 *
 * Throws `GoogleTokenError` if the token is invalid, expired, or malformed.
 */
export async function verifyGoogleToken(
  idToken: string,
  clientId: string,
): Promise<GoogleProfile> {
  const client = new OAuth2Client(clientId);

  let payload;
  try {
    const ticket = await client.verifyIdToken({ idToken, audience: clientId });
    payload = ticket.getPayload();
  } catch (err) {
    throw new GoogleTokenError(
      err instanceof Error ? err.message : 'Google token verification failed',
    );
  }

  if (!payload || !payload.sub) {
    throw new GoogleTokenError('Invalid Google token payload');
  }

  return {
    googleId: payload.sub,
    email: payload.email ?? '',
    name: payload.name ?? payload.email ?? '',
  };
}
