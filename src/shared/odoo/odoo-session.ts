import type { Config } from '../../config/env';
import type { OdooJsonRpcResponse } from './odoo.types';
import { OdooNetworkError, OdooSessionError } from './odoo.types';

/** Shape of a successful /web/session/authenticate result. */
interface AuthResult {
  session_id: string;
  uid: number | false; // Odoo returns false if credentials are wrong
}

/**
 * Manages the Odoo session cookie.
 *
 * Authenticates once on first use and stores the session_id in memory.
 * Call `invalidate()` to force re-authentication on the next request
 * (used by OdooClient when Odoo returns a session-expired error).
 */
export class OdooSession {
  private sessionId: string | null = null;
  private readonly odooUrl: string;
  private readonly credentials: { db: string; login: string; password: string };

  constructor(config: Config) {
    this.odooUrl = config.ODOO_URL;
    this.credentials = {
      db: config.ODOO_DB,
      login: config.ODOO_USER,
      password: config.ODOO_PASSWORD,
    };
  }

  /**
   * Authenticates against Odoo and stores the session_id.
   * Throws OdooNetworkError if Odoo is unreachable.
   * Throws OdooSessionError if credentials are rejected.
   */
  async connect(): Promise<void> {
    let response: Response;

    try {
      response = await fetch(`${this.odooUrl}/web/session/authenticate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          id: 1,
          params: this.credentials,
        }),
      });
    } catch (networkErr) {
      throw new OdooNetworkError(
        `Cannot reach Odoo at ${this.odooUrl}`,
        networkErr,
      );
    }

    let body: OdooJsonRpcResponse<AuthResult>;
    try {
      body = (await response.json()) as OdooJsonRpcResponse<AuthResult>;
    } catch {
      throw new OdooSessionError('Odoo returned a non-JSON response during authentication');
    }

    // Odoo always returns HTTP 200 — check the error field, not the status code
    if (body.error) {
      throw new OdooSessionError(
        `Odoo authentication failed: ${body.error.data?.message ?? body.error.message}`,
      );
    }

    // uid === false means wrong credentials (Odoo quirk — no error, just false uid)
    if (body.result?.uid === false || !body.result?.uid) {
      throw new OdooSessionError(
        'Odoo rejected credentials — check ODOO_USER and ODOO_PASSWORD in .env',
      );
    }

    // Odoo returns the session_id in the Set-Cookie header, not the JSON body
    const setCookie = response.headers.get('set-cookie') ?? '';
    const match = setCookie.match(/session_id=([^;]+)/);
    if (!match) {
      throw new OdooSessionError('Odoo did not return a session_id cookie after authentication');
    }

    this.sessionId = match[1];
  }

  /**
   * Returns the active session_id, connecting first if not yet authenticated.
   */
  async getSessionId(): Promise<string> {
    if (!this.sessionId) {
      await this.connect();
    }
    return this.sessionId as string;
  }

  /**
   * Marks the session as expired.
   * The next call to `getSessionId()` will trigger re-authentication.
   */
  invalidate(): void {
    this.sessionId = null;
  }
}
