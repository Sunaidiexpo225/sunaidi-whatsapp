import { Controller, Get } from "@nestjs/common";
import { StatsService, type DashboardSummary } from "./stats.service";

@Controller()
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get("dashboard")
  dashboard(): Promise<DashboardSummary> {
    return this.stats.getDashboard();
  }
}
