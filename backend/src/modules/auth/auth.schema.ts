import { z } from "zod";

export const LoginSchema = {
  body: z.object({
    email: z.string().email("Invalid email address format"),
    password: z.string().min(6, "Password must be at least 6 characters"),
  }),
};
