import { Module } from "@nestjs/common";
import { OutboundProcessor } from "./outbound.processor";
import { OutboundService } from "./outbound.service";

@Module({
  providers: [OutboundService, OutboundProcessor],
})
export class OutboundModule {}
