export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
  }
}

export const invalidToken = () =>
  new ApiError(400, 'TOKEN_INVALID_OR_EXPIRED', 'This link is invalid or has expired.');
