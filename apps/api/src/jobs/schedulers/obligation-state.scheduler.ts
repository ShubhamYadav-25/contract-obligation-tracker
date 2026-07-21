import type { ObligationService } from "../../modules/obligations/obligations.service.js";

export class ObligationStateScheduler {
  constructor(private readonly obligationService: ObligationService) {}

  async markDueObligations(): Promise<number> {
    void this.obligationService;
    throw new Error("Obligation due-state scheduler is not implemented yet");
  }
}
