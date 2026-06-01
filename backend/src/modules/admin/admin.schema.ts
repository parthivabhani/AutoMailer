import { z } from "zod";

export const CreateSenderSchema = {
  body: z.object({
    name: z.string().min(1, "Name is required").max(100),
    email: z.string().email("Invalid email format"),
    password: z.string().min(6, "Password must be at least 6 characters"),
  }),
};

export const SmtpConfigSchema = {
  body: z.object({
    gmail: z.string().email("Invalid Gmail address"),
    appPassword: z.string().min(8, "App Password must be at least 8 characters"),
  }),
};

export const LogQuerySchema = {
  query: z.object({
    senderId: z.string().uuid().optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
  }),
};
