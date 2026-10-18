export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(status: number, message: string, code = 'ERROR', details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
  static badRequest = (m: string, code = 'BAD_REQUEST', d?: unknown) => new ApiError(400, m, code, d);
  static unauthorized = (m = 'Please sign in to continue.') => new ApiError(401, m, 'UNAUTHORIZED');
  static forbidden = (m = 'You do not have permission to do that.') => new ApiError(403, m, 'FORBIDDEN');
  static notFound = (m = 'Not found.') => new ApiError(404, m, 'NOT_FOUND');
  static conflict = (m: string, code = 'CONFLICT', d?: unknown) => new ApiError(409, m, code, d);
}
