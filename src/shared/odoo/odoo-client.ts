import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { config } from '../../config/env';
import { OdooSession } from './odoo-session';
import type {
  OdooJsonRpcRequest,
  OdooJsonRpcResponse,
  OdooRecord,
  OdooDomain,
  SearchReadOptions,
} from './odoo.types';
import { OdooClientError, OdooNetworkError } from './odoo.types';

// Odoo returns this code when the session has expired
const ODOO_SESSION_EXPIRED_CODE = 100;

// ----------------------------------------------------------------
// TypeScript module augmentation — adds fastify.odoo to FastifyInstance
// ----------------------------------------------------------------
declare module 'fastify' {
  interface FastifyInstance {
    odoo: OdooClient;
  }
}

/**
 * Wrapper around the Odoo JSON-RPC API.
 *
 * All data access in the Kleanet API goes through this class.
 * Raw JSON-RPC construction is intentionally confined here — never
 * build JSON-RPC requests elsewhere in the codebase.
 */
export class OdooClient {
  private readonly session: OdooSession;
  private requestId = 0;

  constructor(session: OdooSession) {
    this.session = session;
  }

  // ----------------------------------------------------------------
  // Private helpers
  // ----------------------------------------------------------------

  /** Builds a JSON-RPC 2.0 envelope with an auto-incremented id. */
  private buildEnvelope(params: unknown): OdooJsonRpcRequest {
    this.requestId += 1;
    return { jsonrpc: '2.0', method: 'call', id: this.requestId, params };
  }

  /**
   * Sends a JSON-RPC POST request to Odoo and returns the result.
   *
   * CRITICAL: Odoo always returns HTTP 200, even for errors.
   * We always check the `error` field in the body — never HTTP status.
   *
   * On session-expired (code 100): invalidates the session and retries once
   * to transparently recover from the ~24h inactivity expiry.
   */
  private async _rpc<T>(
    endpoint: string,
    params: unknown,
    retried = false,
  ): Promise<T> {
    const sessionId = await this.session.getSessionId();
    const envelope = this.buildEnvelope(params);

    let response: Response;
    try {
      response = await fetch(`${config.ODOO_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session_id=${sessionId}`,
        },
        body: JSON.stringify(envelope),
      });
    } catch (networkErr) {
      throw new OdooNetworkError(
        `Network error reaching Odoo at ${config.ODOO_URL}${endpoint}`,
        networkErr,
      );
    }

    let body: OdooJsonRpcResponse<T>;
    try {
      body = (await response.json()) as OdooJsonRpcResponse<T>;
    } catch {
      throw new OdooClientError(-1, 'Odoo returned a non-JSON response');
    }

    if (body.error) {
      // Session expired — invalidate and retry once before giving up
      if (body.error.code === ODOO_SESSION_EXPIRED_CODE && !retried) {
        this.session.invalidate();
        return this._rpc<T>(endpoint, params, true);
      }

      throw new OdooClientError(
        body.error.code,
        body.error.data?.message ?? body.error.message,
      );
    }

    return body.result as T;
  }

  // ----------------------------------------------------------------
  // Public API
  // ----------------------------------------------------------------

  /**
   * Reads records matching the domain, returning only the specified fields.
   * Always pass an explicit `fields` array — never fetch all fields.
   */
  async searchRead(
    model: string,
    domain: OdooDomain,
    fields: string[],
    options: SearchReadOptions = {},
  ): Promise<OdooRecord[]> {
    return this._rpc<OdooRecord[]>('/web/dataset/call_kw', {
      model,
      method: 'search_read',
      args: [domain],
      kwargs: {
        fields,
        limit: options.limit ?? false,
        offset: options.offset ?? 0,
        order: options.order ?? '',
      },
    });
  }

  /**
   * Creates a new record and returns its id.
   */
  async create(
    model: string,
    values: Record<string, unknown>,
  ): Promise<number> {
    return this._rpc<number>('/web/dataset/call_kw', {
      model,
      method: 'create',
      args: [values],
      kwargs: {},
    });
  }

  /**
   * Updates the records with the given ids. Returns true on success.
   */
  async write(
    model: string,
    ids: number[],
    values: Record<string, unknown>,
  ): Promise<boolean> {
    return this._rpc<boolean>('/web/dataset/call_kw', {
      model,
      method: 'write',
      args: [ids, values],
      kwargs: {},
    });
  }

  /**
   * Returns the number of records matching the domain.
   */
  async searchCount(model: string, domain: OdooDomain): Promise<number> {
    return this._rpc<number>('/web/dataset/call_kw', {
      model,
      method: 'search_count',
      args: [domain],
      kwargs: {},
    });
  }

  /**
   * Generic call to any Odoo model method not covered by the helpers above.
   */
  async call(
    model: string,
    method: string,
    args: unknown[],
    kwargs: Record<string, unknown> = {},
  ): Promise<unknown> {
    return this._rpc<unknown>('/web/dataset/call_kw', {
      model,
      method,
      args,
      kwargs,
    });
  }
}

// ----------------------------------------------------------------
// Fastify plugin
// ----------------------------------------------------------------

/**
 * Registers the OdooClient as `fastify.odoo`.
 * The session is lazily authenticated on the first request.
 */
async function odooPlugin(fastify: FastifyInstance): Promise<void> {
  const session = new OdooSession(config);
  const client = new OdooClient(session);
  fastify.decorate('odoo', client);
}

export default fp(odooPlugin, { name: 'odoo' });
