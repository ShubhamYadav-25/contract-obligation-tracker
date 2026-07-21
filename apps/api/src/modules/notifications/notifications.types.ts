export interface NotificationInput {
  readonly recipient: string;
  readonly subject: string;
  readonly bodyText: string;
  readonly correlationId?: string;
}

export interface NotificationResult {
  readonly providerMessageId?: string;
  readonly status: "accepted" | "rejected";
}

export interface NotificationProvider {
  send(input: NotificationInput): Promise<NotificationResult>;
}
