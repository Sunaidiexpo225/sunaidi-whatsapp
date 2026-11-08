import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { validateEnv } from "./config/env";
import { PrismaModule } from "./db/prisma.module";
import { QueueModule } from "./queue/queue.module";
import { HealthController } from "./health/health.controller";
import { AutomationsModule } from "./automations/automations.module";
import { CampaignModule } from "./campaign/campaign.module";
import { CannedRepliesModule } from "./canned-replies/canned-replies.module";
import { ContactsModule } from "./contacts/contacts.module";
import { InboxModule } from "./inbox/inbox.module";
import { NumbersModule } from "./numbers/numbers.module";
import { OutboundModule } from "./outbound/outbound.module";
import { StatsModule } from "./stats/stats.module";
import { TagsModule } from "./tags/tags.module";
import { TemplatesModule } from "./templates/templates.module";
import { UsersModule } from "./users/users.module";
import { WhatsappModule } from "./whatsapp/whatsapp.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    PrismaModule,
    QueueModule,
    WhatsappModule,
    InboxModule,
    OutboundModule,
    CampaignModule,
    StatsModule,
    TemplatesModule,
    TagsModule,
    ContactsModule,
    AutomationsModule,
    NumbersModule,
    UsersModule,
    CannedRepliesModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
