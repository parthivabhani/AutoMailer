import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";

import superAdminRouter from "./routes/super-admin.js";
import adminRouter from "./routes/admin.js";
import senderRouter from "./routes/sender.js";
import aiRouter from "./routes/ai.js";
import authRouter from "./routes/auth.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Enable CORS for development
app.use(
  cors({
    origin: "*", // In production, replace with specific frontend domain
    methods: ["GET", "POST", "PATCH", "DELETE", "PUT", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// 1. Health Status Endpoint
app.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 2. Register Segmented API Routers
app.use("/auth", authRouter);
app.use("/super-admin", superAdminRouter);
app.use("/admin", adminRouter);
app.use("/sender", senderRouter);
app.use("/ai", aiRouter);

// 3. Fallback Route Not Found Handler
app.use((req: Request, res: Response, next: NextFunction) => {
  res.status(404).json({ error: `Cannot ${req.method} ${req.url}` });
});

// 4. Global Error Handling Middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("Global express error:", err);
  res.status(500).json({
    error: err.message || "Internal Server Error occurred on the API backend."
  });
});

// 5. Start Server
app.listen(PORT, () => {
  console.log(`========================================`);
  console.log(`Auto Mailer Pro API Service Online!`);
  console.log(`Running in CWD: ${process.cwd()}`);
  console.log(`Port: ${PORT}`);
  console.log(`========================================`);
});
export default app;
