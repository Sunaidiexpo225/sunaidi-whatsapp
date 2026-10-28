import { Module } from "@nestjs/common";
import { InboundProcessor } from "./inbound.processor";
import { InboundService } from "./inbound.service";

@Module({
  providers: [InboundService, InboundProcessor],
})
export class InboundModule {}
