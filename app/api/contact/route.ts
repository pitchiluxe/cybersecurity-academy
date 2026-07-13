import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

const TO_ADDRESS = "erickomari243@gmail.com";

function isEmail(value: unknown): value is string {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { name, email, subject, message } = (body ?? {}) as {
    name?: string; email?: string; subject?: string; message?: string;
  };

  if (!name?.trim() || !isEmail(email) || !message?.trim()) {
    return NextResponse.json({ error: "Name, a valid email, and a message are required." }, { status: 400 });
  }

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    return NextResponse.json(
      { error: "The contact form isn't configured yet. Email me directly at " + TO_ADDRESS + "." },
      { status: 503 }
    );
  }

  const transporter = nodemailer.createTransport({ service: "gmail", auth: { user, pass } });
  const when = new Date().toLocaleString("en-US", { dateStyle: "full", timeStyle: "short" });
  const safeSubject = (subject || "New message").slice(0, 120);

  try {
    // Notify the site owner.
    await transporter.sendMail({
      from: `"Cybersecurity Academy" <${user}>`,
      to: TO_ADDRESS,
      replyTo: email,
      subject: `[Cybersecurity Academy] ${safeSubject} — from ${name}`,
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; background: #0D1421; color: #E2E8F0; border-radius: 12px; overflow: hidden; border: 1px solid #1A2540;">
          <div style="background: linear-gradient(135deg, #6366F1, #8B5CF6); padding: 24px 32px;">
            <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #fff;">New Cybersecurity Academy message</h1>
            <p style="margin: 4px 0 0; color: rgba(255,255,255,0.8); font-size: 13px;">${when}</p>
          </div>
          <div style="padding: 28px 32px;">
            <p style="margin: 0 0 6px; color: #64748B; font-size: 12px; text-transform: uppercase; letter-spacing: .05em;">From</p>
            <p style="margin: 0 0 16px; font-size: 15px;">${name} &lt;<a href="mailto:${email}" style="color:#818CF8;text-decoration:none;">${email}</a>&gt;</p>
            <p style="margin: 0 0 6px; color: #64748B; font-size: 12px; text-transform: uppercase; letter-spacing: .05em;">Subject</p>
            <p style="margin: 0 0 16px; font-size: 15px;">${safeSubject}</p>
            <p style="margin: 0 0 6px; color: #64748B; font-size: 12px; text-transform: uppercase; letter-spacing: .05em;">Message</p>
            <div style="background:#152033;border:1px solid #1A2540;border-radius:8px;padding:16px 20px;font-size:14px;line-height:1.7;white-space:pre-wrap;">${message}</div>
          </div>
        </div>`,
    });

    // Auto-reply to the sender.
    await transporter.sendMail({
      from: `"Erick Omari — Cybersecurity Academy" <${user}>`,
      to: email,
      subject: "Got your message — I'll be in touch soon",
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; background: #0D1421; color: #E2E8F0; border-radius: 12px; overflow: hidden; border: 1px solid #1A2540;">
          <div style="background: linear-gradient(135deg, #6366F1, #8B5CF6); padding: 22px 32px;">
            <h1 style="margin: 0; font-size: 19px; font-weight: 800; color: #fff;">Cybersecurity Academy</h1>
          </div>
          <div style="padding: 26px 32px;">
            <p style="margin: 0 0 14px; font-size: 15px; line-height: 1.7;">Hey <strong>${name}</strong>,</p>
            <p style="margin: 0 0 14px; font-size: 15px; line-height: 1.7; color:#94A3B8;">Thanks for reaching out through Cybersecurity Academy. I got your message and will get back to you as soon as possible.</p>
            <div style="background:#152033;border:1px solid #1A2540;border-radius:8px;padding:14px 18px;margin:18px 0;font-size:13px;color:#64748B;font-style:italic;line-height:1.6;">"${message.slice(0, 200)}${message.length > 200 ? "…" : ""}"</div>
            <p style="margin: 0; font-size: 14px; color:#94A3B8;">— Erick Omari</p>
          </div>
        </div>`,
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("Contact email error:", err);
    return NextResponse.json({ error: "Failed to send message. Please try again." }, { status: 500 });
  }
}
