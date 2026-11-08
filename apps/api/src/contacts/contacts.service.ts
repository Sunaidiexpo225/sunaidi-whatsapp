import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { ConsentStatus, type Prisma, type PrismaClient } from "@sunaidi/db";
import { PRISMA } from "../db/prisma.module";

export interface ContactTagRef {
  id: string;
  name: string;
}

export interface ContactRow {
  id: string;
  waId: string;
  name: string | null;
  createdAt: Date;
  tags: ContactTagRef[];
  visitor: {
    name: string;
    company: string;
    consent: string;
    country: string;
  } | null;
}

export interface ListContactsFilter {
  search?: string;
  tagId?: string;
  consent?: ConsentStatus;
}

export interface ImportContactInput {
  to: string;
  name?: string;
}

@Injectable()
export class ContactsService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  async list(filter: ListContactsFilter = {}): Promise<ContactRow[]> {
    const term = filter.search?.trim();
    const and: Prisma.ContactWhereInput[] = [];
    if (term) {
      and.push({
        OR: [
          { waId: { contains: term } },
          { name: { contains: term, mode: "insensitive" } },
        ],
      });
    }
    if (filter.tagId) {
      and.push({ tags: { some: { tagId: filter.tagId } } });
    }
    if (filter.consent) {
      and.push({ visitor: { is: { consent: filter.consent } } });
    }

    const contacts = await this.prisma.contact.findMany({
      where: and.length ? { AND: and } : {},
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        waId: true,
        name: true,
        createdAt: true,
        tags: { select: { tag: { select: { id: true, name: true } } } },
        visitor: { select: { name: true, company: true, consent: true, country: true } },
      },
    });

    return contacts.map((c) => ({
      id: c.id,
      waId: c.waId,
      name: c.name,
      createdAt: c.createdAt,
      tags: c.tags.map((t) => ({ id: t.tag.id, name: t.tag.name })),
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

  /** Attach a tag to a contact (idempotent). Both must belong to the same workspace. */
  async addTag(contactId: string, tagId: string): Promise<{ ok: true }> {
    const [contact, tag] = await Promise.all([
      this.prisma.contact.findUnique({ where: { id: contactId }, select: { workspaceId: true } }),
      this.prisma.tag.findUnique({ where: { id: tagId }, select: { workspaceId: true } }),
    ]);
    if (!contact) throw new BadRequestException("Unknown contact");
    if (!tag) throw new BadRequestException("Unknown tag");
    if (contact.workspaceId !== tag.workspaceId) {
      throw new BadRequestException("Tag and contact belong to different workspaces");
    }
    await this.prisma.contactTag.upsert({
      where: { contactId_tagId: { contactId, tagId } },
      create: { contactId, tagId },
      update: {},
    });
    return { ok: true };
  }

  async removeTag(contactId: string, tagId: string): Promise<{ ok: true }> {
    await this.prisma.contactTag.deleteMany({ where: { contactId, tagId } });
    return { ok: true };
  }

  /** Bulk upsert contacts by phone. Returns how many were created vs. already existed. */
  async import(
    entries: ImportContactInput[],
    eventId?: string,
  ): Promise<{ created: number; updated: number; skipped: number }> {
    const workspaceId = await this.resolveWorkspaceId(eventId);

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const seen = new Set<string>();

    for (const entry of entries) {
      const waId = entry.to.replace(/\D/g, "");
      if (waId.length < 8 || seen.has(waId)) {
        skipped += 1;
        continue;
      }
      seen.add(waId);
      const name = entry.name?.trim() || null;
      const existing = await this.prisma.contact.findUnique({
        where: { workspaceId_waId: { workspaceId, waId } },
        select: { id: true },
      });
      await this.prisma.contact.upsert({
        where: { workspaceId_waId: { workspaceId, waId } },
        create: { workspaceId, waId, name },
        // Only fill a name when one was supplied; never clobber an existing name with null.
        update: name ? { name } : {},
      });
      if (existing) updated += 1;
      else created += 1;
    }

    return { created, updated, skipped };
  }

  private async resolveWorkspaceId(eventId?: string): Promise<string> {
    if (eventId) {
      const phone = await this.prisma.phoneNumber.findUnique({
        where: { eventId },
        select: { workspaceId: true },
      });
      if (phone) return phone.workspaceId;
    }
    const workspace = await this.prisma.workspace.findFirst({ select: { id: true } });
    if (!workspace) {
      throw new BadRequestException("No workspace exists yet");
    }
    return workspace.id;
  }
}
