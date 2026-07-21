export interface AuthenticatedActor {
  readonly id: string;
  readonly role: "ADMIN" | "REVIEWER" | "SYSTEM";
}
