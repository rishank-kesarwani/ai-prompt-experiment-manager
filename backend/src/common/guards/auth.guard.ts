import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY, ROLES_KEY } from "../decorators";
import { UserRole } from "../types";

@Injectable()
export class TenantAuthGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();
    const headers = request.headers;

    // Resolve tenant identifier
    const tenantId =
      (headers["x-tenant-id"] as string) ||
      process.env.DEFAULT_TENANT_ID ||
      "tenant-enterprise-default";

    request.tenantId = tenantId;

    // Resolve user context
    const userId = (headers["x-user-id"] as string) || "operator_1";
    const userName = (headers["x-user-name"] as string) || "AI Operations Lead";
    const role: UserRole = (headers["x-user-role"] as UserRole) || "approver";

    request.user = {
      userId,
      name: userName,
      role,
      tenantId,
    };

    // If public endpoint, allow
    if (isPublic) {
      return true;
    }

    // Check API Key if provided
    const apiKey = headers["x-api-key"] as string;
    const configuredApiKey = process.env.API_KEY;

    if (configuredApiKey && apiKey && apiKey === configuredApiKey) {
      request.user.role = "admin";
      return true;
    }

    // Role check against required roles
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const roleHierarchy: Record<UserRole, number> = {
      viewer: 1,
      editor: 2,
      approver: 3,
      admin: 4,
    };

    const userLevel = roleHierarchy[role] || 1;
    const hasRole = requiredRoles.some(
      (reqRole) => userLevel >= roleHierarchy[reqRole],
    );

    if (!hasRole) {
      throw new ForbiddenException(
        `Insufficient privileges. Operation requires role(s): [${requiredRoles.join(
          ", ",
        )}]. Current role: "${role}".`,
      );
    }

    return true;
  }
}
