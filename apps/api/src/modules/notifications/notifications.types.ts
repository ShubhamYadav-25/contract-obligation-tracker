/**
 * @file Defines backend notifications module contracts, services, routes, or persistence logic.
 */
export interface NotificationInput {
  readonly recipient: string;
  readonly from?: string;
  readonly subject: string;
  readonly bodyText: string;
  readonly bodyHtml?: string;
  readonly correlationId?: string;
}

export interface NotificationResult {
  readonly providerMessageId?: string;
  readonly status: "accepted" | "rejected";
}

export interface NotificationProvider {
  send(input: NotificationInput): Promise<NotificationResult>;
}
