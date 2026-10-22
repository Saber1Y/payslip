export type PayslipErrorCode =
  | "NOT_CANONICAL"
  | "INVALID_RECORD"
  | "INVALID_PERIOD"
  | "INVALID_DATE"
  | "INVALID_SIGNATURE"
  | "INVALID_PACKET"
  | "INTEGRITY_ERROR";

export class PayslipError extends Error {
  readonly code: PayslipErrorCode;
  readonly field: string | undefined;

  constructor(code: PayslipErrorCode, message: string, field?: string) {
    super(message);
    this.name = "PayslipError";
    this.code = code;
    this.field = field;
  }
}

export function isPayslipError(error: unknown, code?: PayslipErrorCode): error is PayslipError {
  return error instanceof PayslipError && (code === undefined || error.code === code);
}
