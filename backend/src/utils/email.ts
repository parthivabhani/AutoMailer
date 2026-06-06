import nodemailer from "nodemailer";
import { supabase } from "../config/supabase.js";
import { decrypt } from "./crypto.js";

interface EmailRecipient {
  _id: string;
  email: string;
  name?: string;
  company?: string;
  [key: string]: any;
}

interface DispatchCampaignInput {
  senderId: string;
  adminId: string;
  csvId: string;
  segmentId?: string;
  subjectTemplate: string;
  bodyTemplate: string;
  recipientIds: string[];
}

export async function sendEmailCampaign(input: DispatchCampaignInput) {
  const { senderId, adminId, csvId, segmentId, subjectTemplate, bodyTemplate, recipientIds } = input;

  // 1. Fetch parent Admin's SMTP config
  const { data: smtpConfig, error: smtpErr } = await supabase
    .from("smtp_configs")
    .select("*")
    .eq("admin_id", adminId)
    .single();

  if (smtpErr || !smtpConfig) {
    throw new Error("Unable to locate SMTP configuration for this campaign.");
  }

  // 2. Decrypt Gmail App Password
  let decryptedPassword = "";
  try {
    decryptedPassword = decrypt(smtpConfig.encrypted_password);
  } catch (decErr) {
    console.error("Failed to decrypt SMTP credentials:", decErr);
    throw new Error("SMTP Authentication credentials corrupted.");
  }

  // 3. Retrieve CSV File to map recipients
  const { data: csvFile, error: csvErr } = await supabase
    .from("csv_files")
    .select("*")
    .eq("id", csvId)
    .single();

  if (csvErr || !csvFile) {
    throw new Error("CSV Campaign list not found.");
  }

  const rows = csvFile.rows as EmailRecipient[];
  const targetedRecipients = rows.filter((r) => recipientIds.includes(r._id));

  if (targetedRecipients.length === 0) {
    throw new Error("No matching recipients identified for this campaign dispatch.");
  }

  // 4. Create Nodemailer transporter dynamically
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: smtpConfig.gmail,
      pass: decryptedPassword
    }
  });

  let sentCount = 0;
  const duplicateEmails: string[] = [];

  // 5. Sequentially send emails to prevent spam flags
  for (const recipient of targetedRecipients) {
    const recipientEmail = (recipient.email || recipient.Email || "").trim();
    const recipientName = (recipient.name || recipient.Name || recipient.FirstName || "there").trim();

    if (!recipientEmail) {
      // Log missing email failure
      await supabase.from("email_logs").insert({
        sender_id: senderId,
        csv_id: csvId,
        segment_id: segmentId || null,
        recipient_email: "missing_email",
        recipient_name: recipientName,
        subject: subjectTemplate,
        body: bodyTemplate,
        status: "failed",
        error_message: "Missing recipient email address."
      });
      continue;
    }

    // 6. Check duplicate: Has this admin already sent an email to this recipientEmail in the past?
    // Get sender IDs under this admin
    const { data: siblingSenders } = await supabase
      .from("profiles")
      .select("id")
      .eq("admin_id", adminId);

    const siblingIds = (siblingSenders || []).map((s) => s.id);

    const { data: existingSend, error: checkErr } = await supabase
      .from("email_logs")
      .select("id")
      .in("sender_id", siblingIds)
      .eq("recipient_email", recipientEmail)
      .eq("status", "sent")
      .limit(1);

    if (!checkErr && existingSend && existingSend.length > 0) {
      // Mark as skipped duplicate
      duplicateEmails.push(recipient._id);
      await supabase.from("email_logs").insert({
        sender_id: senderId,
        csv_id: csvId,
        segment_id: segmentId || null,
        recipient_email: recipientEmail,
        recipient_name: recipientName,
        subject: subjectTemplate,
        body: bodyTemplate,
        status: "skipped_duplicate",
        error_message: "Recipient already contacted in a previous campaign."
      });
      continue;
    }

    // 7. Dynamic Variable Interpolation (casing-insensitive)
    let subject = subjectTemplate;
    let body = bodyTemplate;

    // Build replacement key map from CSV columns
    Object.keys(recipient).forEach((key) => {
      const regex = new RegExp(`{${key}}`, "gi");
      const value = String(recipient[key] || "");
      subject = subject.replace(regex, value);
      body = body.replace(regex, value);
    });

    // General fallback interpolation if not done
    subject = subject.replace(/{name}/gi, recipientName);
    body = body.replace(/{name}/gi, recipientName);

    try {
      // 8. Dispatch actual email
      await transporter.sendMail({
        from: `"${smtpConfig.gmail}" <${smtpConfig.gmail}>`,
        to: recipientEmail,
        subject: subject,
        text: body
      });

      // 9. Log successful dispatch in Supabase
      await supabase.from("email_logs").insert({
        sender_id: senderId,
        csv_id: csvId,
        segment_id: segmentId || null,
        recipient_email: recipientEmail,
        recipient_name: recipientName,
        subject: subject,
        body: body,
        status: "sent"
      });

      sentCount++;

      // Small natural delay (200-500ms) between dispatches to mimic human pacing
      await new Promise((r) => setTimeout(r, 200 + Math.random() * 300));
    } catch (sendErr: any) {
      console.error(`SMTP Sending Error for ${recipientEmail}:`, sendErr);
      
      // Log failed dispatch in Supabase
      await supabase.from("email_logs").insert({
        sender_id: senderId,
        csv_id: csvId,
        segment_id: segmentId || null,
        recipient_email: recipientEmail,
        recipient_name: recipientName,
        subject: subject,
        body: body,
        status: "failed",
        error_message: sendErr.message || "Failed to route through Google SMTP."
      });
    }
  }

  return {
    sent: sentCount,
    skippedDuplicates: duplicateEmails
  };
}
