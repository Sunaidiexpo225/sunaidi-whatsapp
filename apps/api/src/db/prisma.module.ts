import { Global, Module } from "@nestjs/common";
import { prisma } from "@sunaidi/db";

/** Token for the shared Prisma client. */
export const PRISMA = "PRISMA";

@Global()
@Module({
  providers: [{ provide: PRISMA, useValue: prisma }],
  exports: [PRISMA],
})
export class PrismaModule {}
