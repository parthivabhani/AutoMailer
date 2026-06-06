import { z } from "zod";

export const UploadCsvSchema = {
  body: z.object({
    name: z.string().min(1, "Name is required").max(255),
    columns: z.array(z.string()).min(1, "At least one column header is required"),
    rows: z.array(z.record(z.any())).min(1, "At least one lead row is required"),
  }),
};

export const AssignCsvSchema = {
  body: z.object({
    senderId: z.string().uuid("Invalid sender ID"),
    segmentId: z.string().uuid().optional().nullable(),
  }),
};
