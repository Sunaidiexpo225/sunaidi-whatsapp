import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { timingSafeEqual } from "node:crypto";
import type { Request } from "express";
import type { Env } from "../config/env";

/** Guards internal machine-to-machine endpoints (e.g. VDMS → template send)
 * with a shared secret presented on the x-api-key header. */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService<Env, true>) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const provided = req.header("x-api-key") ?? "";
    const expected = this.config.get("INTERNAL_API_KEY", { infer: true });
    if (!safeEqual(provided, expected)) {
      throw new UnauthorizedException("Invalid or missing API key");
    }
    return true;
  }
}

/** Constant-time string comparison that doesn't leak length via early return
 * timing beyond what the lengths themselves reveal. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) {
    return false;
  }
  return timingSafeEqual(ab, bb);
}
