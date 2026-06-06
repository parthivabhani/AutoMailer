import { z } from "zod";

export const UpdateAdminStatusSchema = {
  params: z.object({
    id: z.string().uuid("Invalid administrator user ID format"),
  }),
  body: z.object({
    status: z.enum(["active", "suspended"], {
      errorMap: () => ({ message: "Status must be either 'active' or 'suspended'" }),
    }),
  }),
};
