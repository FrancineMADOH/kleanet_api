// ----------------------------------------------------------------
// Error class
// ----------------------------------------------------------------

/**
 * Thrown when a Facebook access_token fails verification
 * or the Graph API returns an error response.
 */
export class FacebookTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FacebookTokenError';
  }
}

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

/** Verified identity extracted from a Facebook access_token. */
export interface FacebookProfile {
  facebookId: string;
  email: string;
  name: string;
}

/** Shape of the Facebook Graph API /me response. */
interface GraphMeResponse {
  id?: string;
  name?: string;
  email?: string;
  error?: {
    message: string;
    type: string;
    code: number;
  };
}

// ----------------------------------------------------------------
// Constants
// ----------------------------------------------------------------

/** Facebook Graph API endpoint for token verification. */
const GRAPH_ME_URL = 'https://graph.facebook.com/me';

// ----------------------------------------------------------------
// Service
// ----------------------------------------------------------------

/**
 * Verifies a Facebook access_token via the Graph API and returns the user profile.
 *
 * Makes a GET request to /me with fields=id,name,email.
 * The Graph API returns an error object in the JSON body (not a non-200 status)
 * when the token is invalid — so we always check the `error` field.
 *
 * Throws `FacebookTokenError` if the token is invalid, expired, or the request fails.
 */
export async function verifyFacebookToken(accessToken: string): Promise<FacebookProfile> {
  const url = `${GRAPH_ME_URL}?fields=id,name,email&access_token=${encodeURIComponent(accessToken)}`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch (err) {
    throw new FacebookTokenError(
      err instanceof Error ? err.message : 'Network error reaching Facebook Graph API',
    );
  }

  let data: GraphMeResponse;
  try {
    data = (await response.json()) as GraphMeResponse;
  } catch {
    throw new FacebookTokenError('Facebook Graph API returned a non-JSON response');
  }

  if (data.error) {
    throw new FacebookTokenError(data.error.message);
  }

  if (!data.id) {
    throw new FacebookTokenError('Invalid Facebook token response — missing id field');
  }

  return {
    facebookId: data.id,
    email: data.email ?? '',
    name: data.name ?? '',
  };
}
