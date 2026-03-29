// JwtPayload is declared globally in src/types/fastify.d.ts — do not redefine here.

/** Input for the send-OTP route. */
export interface SendOtpInput {
  phone: string;
}

/** Input for the verify-OTP route. */
export interface VerifyOtpInput {
  phone: string;
  code: string;
}

/** Successful login response returned after OTP verification. */
export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  partner_id: number;
  is_new_user: boolean;
}

/** Result of the sendOtp service call. */
export type SendOtpResult = 'sent' | 'rate_limited';
