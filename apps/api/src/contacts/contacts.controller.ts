import { Controller, Get, Query } from "@nestjs/common";
import { ContactsService, type ContactRow } from "./contacts.service";

@Controller("contacts")
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  @Get()
  list(@Query("search") search?: string): Promise<ContactRow[]> {
    return this.contacts.list(search);
  }
}
