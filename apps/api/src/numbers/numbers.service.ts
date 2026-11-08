import { Inject, Injectable } from "@nestjs/common";
import { type PrismaClient } from "@sunaidi/db";
import { PRISMA } from "../db/prisma.module";

export interface NumberRow {
  id: string;
  eventName: string;
  displayPhone: string;
  displayName: string | null;
  phoneNumberId: string;
  wabaId: string;
  qualityRating: string;
  messagingLimit: number | null;
  graphApiVersion: string;
}

@Injectable()
export class NumbersService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  /** List connected WhatsApp numbers. Never returns the access token. */
  async list(): Promise<NumberRow[]> {
    const phones = await this.prisma.phoneNumber.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        displayPhone: true,
        displayName: true,
        phoneNumberId: true,
        wabaId: true,
        qualityRating: true,
        messagingLimit: true,
        graphApiVersion: true,
        event: { select: { name: true } },
      },
    });
    return phones.map((p) => ({
      id: p.id,
      eventName: p.event?.name ?? "—",
      displayPhone: p.displayPhone,
      displayName: p.displayName,
      phoneNumberId: p.phoneNumberId,
      wabaId: p.wabaId,
      qualityRating: p.qualityRating,
      messagingLimit: p.messagingLimit,
      graphApiVersion: p.graphApiVersion,
    }));
  }
}
