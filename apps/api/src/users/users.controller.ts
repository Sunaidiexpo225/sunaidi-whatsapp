import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { Role } from "@sunaidi/db";
import { z } from "zod";
import { ApiKeyGuard } from "../outbound/api-key.guard";
import { UsersService, type UserRow } from "./users.service";

const createSchema = z.object({
  email: z.string().trim().email(),
  name: z.string().trim().optional(),
  role: z.nativeEnum(Role).default(Role.AGENT),
});

const updateSchema = z
  .object({
    name: z.string().trim().optional(),
    role: z.nativeEnum(Role).optional(),
  })
  .refine((v) => v.name !== undefined || v.role !== undefined, {
    message: "Nothing to update",
  });

function parse<S extends z.ZodTypeAny>(schema: S, body: unknown): z.infer<S> {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    throw new BadRequestException(`Invalid request: ${issues}`);
  }
  return parsed.data;
}

@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(): Promise<UserRow[]> {
    return this.users.list();
  }

  @UseGuards(ApiKeyGuard)
  @Post()
  create(@Body() body: unknown): Promise<UserRow> {
    return this.users.create(parse(createSchema, body));
  }

  @UseGuards(ApiKeyGuard)
  @Patch(":id")
  update(@Param("id") id: string, @Body() body: unknown): Promise<UserRow> {
    return this.users.update(id, parse(updateSchema, body));
  }
}
