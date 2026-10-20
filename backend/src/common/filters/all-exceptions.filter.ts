import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const correlationId =
      (request.headers["x-correlation-id"] as string) ||
      (request.headers["x-request-id"] as string) ||
      uuidv4();

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    let message = "Internal server error";
    let errors: any = null;

    if (typeof exceptionResponse === "object" && exceptionResponse !== null) {
      message = (exceptionResponse as any).message || message;
      errors = (exceptionResponse as any).errors || null;
    } else if (typeof exceptionResponse === "string") {
      message = exceptionResponse;
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    // Never leak stack traces or raw sensitive parameters to caller
    if (status >= 500) {
      this.logger.error(
        `[${correlationId}] ${request.method} ${request.url} Status: ${status} - Error: ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(
        `[${correlationId}] ${request.method} ${request.url} Status: ${status} - ${message}`,
      );
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      errors,
      correlationId,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
