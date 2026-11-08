import { Module } from "@nestjs/common";
import { ApiKeyGuard } from "../outbound/api-key.guard";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

@Module({
  controllers: [UsersController],
  providers: [UsersService, ApiKeyGuard],
})
export class UsersModule {}
