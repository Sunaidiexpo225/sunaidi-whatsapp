import { Module } from "@nestjs/common";
import { ApiKeyGuard } from "../outbound/api-key.guard";
import { InboxController } from "./inbox.controller";
import { InboxService } from "./inbox.service";

@Module({
  controllers: [InboxController],
  providers: [InboxService, ApiKeyGuard],
})
export class InboxModule {}
