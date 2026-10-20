import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from "@nestjs/common";
import { UserRole } from "../types";

export const IS_PUBLIC_KEY = "isPublic";
export const PublicReadOnly = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = "roles";
export const RequireRoles = (...roles: UserRole[]) =>
  SetMetadata(ROLES_KEY, roles);

export const CorrelationId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return (
      (request.headers["x-correlation-id"] as string) ||
      (request.headers["x-request-id"] as string) ||
      "internal-correlation-id"
    );
  },
);

export const CurrentTenant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return (
      request.tenantId ||
      (request.headers["x-tenant-id"] as string) ||
      process.env.DEFAULT_TENANT_ID ||
      "tenant-enterprise-default"
    );
  },
);

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return (
      request.user || {
        userId: (request.headers["x-user-id"] as string) || "demo-operator-1",
        name:
          (request.headers["x-user-name"] as string) || "Enterprise Operator",
        role: (request.headers["x-user-role"] as UserRole) || "approver",
        tenantId:
          (request.headers["x-tenant-id"] as string) ||
          process.env.DEFAULT_TENANT_ID ||
          "tenant-enterprise-default",
      }
    );
  },
);
