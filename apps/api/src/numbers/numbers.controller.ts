import { Controller, Get } from "@nestjs/common";
import { NumbersService, type NumberRow } from "./numbers.service";

@Controller("numbers")
export class NumbersController {
  constructor(private readonly numbers: NumbersService) {}

  @Get()
  list(): Promise<NumberRow[]> {
    return this.numbers.list();
  }
}
