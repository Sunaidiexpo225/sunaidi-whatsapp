import { Inject, Injectable } from "@nestjs/common";
import { type Prisma, type PrismaClient } from "@sunaidi/db";
import { PRISMA } from "../db/prisma.module";

export interface ContactRow {
  id: string;
  waId: string;
  name: string | null;
  createdAt: Date;
  visitor: {
    name: string;
    company: string;
    consent: string;
    country: string;
  } | null;
}

@Injectable()
export class ContactsService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  async list(search?: string): Promise<ContactRow[]> {
    const term = search?.trim();
    const where: Prisma.ContactWhereInput = term
      ? {
          OR: [
            { waId: { contains: term } },
            { name: { contains: term, mode: "insensitive" } },
          ],
        }
      : {};

    const contacts = await this.prisma.contact.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        waId: true,
        name: true,
        createdAt: true,
        visitor: { select: { name: true, company: true, consent: true, country: true } },
      },
    });

    return contacts.map((c) => ({
      id: c.id,
      waId: c.waId,
      name: c.name,
      createdAt: c.createdAt,
      visitor: c.visitor
        ? {
            name: c.visitor.name,
            company: c.visitor.company,
            consent: String(c.visitor.consent),
            country: c.visitor.country,
          }
        : null,
    }));
  }
}
