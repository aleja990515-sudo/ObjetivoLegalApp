import { BadRequestException, HttpStatus, Logger, NotFoundException, type ArgumentsHost } from '@nestjs/common';
import { ApiError } from './api-error.js';
import { ApiExceptionFilter } from './api-exception.filter.js';

function run(exception: unknown) {
  const res = { headersSent: false, status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  const host = { switchToHttp: () => ({ getResponse: () => res }) } as unknown as ArgumentsHost;
  new ApiExceptionFilter().catch(exception, host);
  return { status: res.status.mock.calls[0]?.[0], body: res.json.mock.calls[0]?.[0] };
}

describe('ApiExceptionFilter', () => {
  beforeEach(() => {
    Logger.overrideLogger(false);
  });

  it('keeps ApiError status and message', () => {
    expect(run(new ApiError(409, 'Ese proceso ya está en la lista.'))).toEqual({
      status: 409,
      body: { error: 'Ese proceso ya está en la lista.' },
    });
  });

  it('maps unmatched routes to the legacy 404 message', () => {
    expect(run(new NotFoundException('Cannot GET /api/x'))).toEqual({
      status: 404,
      body: { error: 'Ruta no encontrada.' },
    });
  });

  it('flattens other HTTP exceptions to {error}', () => {
    expect(run(new BadRequestException('mal'))).toEqual({ status: 400, body: { error: 'mal' } });
  });

  it('answers 502 with the error message for unknown errors', () => {
    expect(run(new Error('La Rama Judicial respondió 500'))).toEqual({
      status: HttpStatus.BAD_GATEWAY,
      body: { error: 'La Rama Judicial respondió 500' },
    });
  });

  it('uses the legacy message for CPNU timeouts', () => {
    const timeout = new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    expect(run(timeout)).toEqual({
      status: HttpStatus.BAD_GATEWAY,
      body: { error: 'La Rama Judicial no respondió a tiempo. Intenta de nuevo.' },
    });
  });
});
