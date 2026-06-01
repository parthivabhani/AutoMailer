import { z } from "zod";

export const ColdSendSchema = {
  body: z.object({
    csvId: z.string().uuid("Invalid CSV file ID format"),
    segmentId: z.string().uuid().optional(),
    subject: z.string().min(1, "Subject must not be empty").max(500),
    body: z.string().min(10, "Email body must be at least 10 characters").max(50000),
    recipientIds: z.array(z.string()).min(1, "At least one recipient ID must be provided"),
  }),
};
