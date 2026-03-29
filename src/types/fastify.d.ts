import '@fastify/jwt';

// ----------------------------------------------------------------
// JWT payload — decoded from every authenticated request token
// ----------------------------------------------------------------

/** Shape of the JWT payload signed by the auth routes. */
export interface JwtPayload {
  /** Standard JWT subject — string representation of partner_id. */
  sub: string;
  partner_id: number;
  phone?: string;
  email?: string;
  /** JWT ID — present only in refresh tokens to allow per-token revocation. */
  jti?: string;
}

// ----------------------------------------------------------------
// Fastify module augmentation — adds request.user to FastifyRequest
// ----------------------------------------------------------------

declare module 'fastify' {
  interface FastifyRequest {
    /** Decoded JWT payload — populated by authGuard before the route handler runs. */
    user: JwtPayload;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}
