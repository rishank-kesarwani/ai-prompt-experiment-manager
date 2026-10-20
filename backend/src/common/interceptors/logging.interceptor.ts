import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger("HTTP");

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const correlationId =
      (req.headers["x-correlation-id"] as string) ||
      (req.headers["x-request-id"] as string) ||
      uuidv4();

    req.headers["x-correlation-id"] = correlationId;
    res.setHeader("x-correlation-id", correlationId);

    const { method, url } = req;
    const now = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - now;
          this.logger.log(
            `[${correlationId}] ${method} ${url} ${res.statusCode} +${duration}ms`,
          );
        },
        error: (err) => {
          const duration = Date.now() - now;
          const status = err.status || 500;
          this.logger.warn(
            `[${correlationId}] ${method} ${url} ${status} +${duration}ms - ${err.message}`,
          );
        },
      }),
    );
  }
}
