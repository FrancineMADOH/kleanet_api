// ----------------------------------------------------------------
// JSON-RPC 2.0 protocol types
// ----------------------------------------------------------------

/** JSON-RPC 2.0 request envelope sent to Odoo. */
export interface OdooJsonRpcRequest {
  jsonrpc: '2.0';
  method: 'call';
  id: number;
  params: unknown;
}

/**
 * JSON-RPC 2.0 response from Odoo.
 * CRITICAL: Odoo always returns HTTP 200 — inspect `error`, never the HTTP status.
 */
export interface OdooJsonRpcResponse<T = unknown> {
  jsonrpc: '2.0';
  id: number;
  result?: T;
  error?: OdooError;
}

/** Top-level error object present in the JSON-RPC body on failure. */
export interface OdooError {
  code: number;
  message: string;
  data: OdooErrorData;
}

/** Detailed error payload nested inside OdooError. */
export interface OdooErrorData {
  name: string;
  debug: string;
  message: string;
  arguments: unknown[];
  exception_type: string;
}

// ----------------------------------------------------------------
// Odoo domain / record types
// ----------------------------------------------------------------

/** Generic Odoo record — `id` is always present; other fields vary by model. */
export type OdooRecord = { id: number; [key: string]: unknown };

/**
 * Odoo domain expression — recursive array of filter tuples or operators.
 * e.g. [['state', '=', 'draft'], ['partner_id', '=', 42]]
 */
export type OdooDomain = Array<string | number | boolean | OdooDomain>;

/** Optional parameters for search_read queries. */
export interface SearchReadOptions {
  limit?: number;
  offset?: number;
  order?: string;
}

// ----------------------------------------------------------------
// Custom error classes
// ----------------------------------------------------------------

/** Thrown when Odoo session authentication fails. */
export class OdooSessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OdooSessionError';
  }
}

/** Thrown when Odoo returns a JSON-RPC error payload in the response body. */
export class OdooClientError extends Error {
  /** Odoo error code (e.g. 100 = session expired, 200 = access denied). */
  public readonly code: number;

  constructor(code: number, message: string) {
    super(`Odoo error [${code}]: ${message}`);
    this.name = 'OdooClientError';
    this.code = code;
  }
}

/** Thrown when the HTTP request to Odoo fails entirely (network down, DNS, etc.). */
export class OdooNetworkError extends Error {
  public readonly cause: unknown;

  constructor(message: string, cause: unknown) {
    super(message);
    this.name = 'OdooNetworkError';
    this.cause = cause;
  }
}
