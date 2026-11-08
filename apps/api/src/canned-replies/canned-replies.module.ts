import { Module } from "@nestjs/common";
import { ApiKeyGuard } from "../outbound/api-key.guard";
import { CannedRepliesController } from "./canned-replies.controller";
import { CannedRepliesService } from "./canned-replies.service";

@Module({
  controllers: [CannedRepliesController],
  providers: [CannedRepliesService, ApiKeyGuard],
})
export class CannedRepliesModule {}
