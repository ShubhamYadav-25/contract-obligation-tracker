/**
 * @file Defines backend auth module contracts, services, routes, or persistence logic.
 */
export interface AuthenticatedActor {
  readonly id: string;
  readonly role: "ADMIN" | "REVIEWER" | "SYSTEM";
}
