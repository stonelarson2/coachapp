// Server-only — sends transactional emails via Resend.
// Gracefully no-ops if RESEND_API_KEY is not configured.

import { Resend } from "resend";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://mycoachfit.xyz";
const FROM = process.env.RESEND_FROM_EMAIL ?? "CoachFit <noreply@mycoachfit.xyz>";

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

/** Shared shell for a simple reminder email with one call-to-action button. */
function reminderHtml({
  heading,
  body,
  ctaLabel,
  ctaPath,
}: {
  heading: string;
  body: string;
  ctaLabel: string;
  ctaPath: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 16px;color:#111">
  <h2 style="margin-bottom:4px">${heading}</h2>
  <p style="color:#555;margin-top:0">${body}</p>
  <a href="${APP_URL}${ctaPath}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;margin-top:8px">
    ${ctaLabel}
  </a>
  <p style="margin-top:24px;font-size:13px;color:#888">
    You're getting this because you're coaching with CoachFit. Reply to your coach if you'd like to change your reminders.
  </p>
</body>
</html>`;
}

/** Nudge a client who hasn't logged any food today. */
export async function sendLogFoodReminderEmail(
  to: string,
  name: string,
): Promise<boolean> {
  const resend = getResend();
  if (!resend) return false;
  const first = name.split(" ")[0] || "there";
  await resend.emails.send({
    from: FROM,
    to,
    subject: "Don't forget to log your food today 🍽️",
    html: reminderHtml({
      heading: `Hey ${first}!`,
      body: "You haven't logged any food yet today. A quick log keeps your coach in the loop and your progress on track.",
      ctaLabel: "Log today's food",
      ctaPath: "/me",
    }),
  });
  return true;
}

/** Nudge a client who hasn't recorded a weigh-in in the last week. */
export async function sendWeighInReminderEmail(
  to: string,
  name: string,
): Promise<boolean> {
  const resend = getResend();
  if (!resend) return false;
  const first = name.split(" ")[0] || "there";
  await resend.emails.send({
    from: FROM,
    to,
    subject: "Time for a weigh-in ⚖️",
    html: reminderHtml({
      heading: `Hey ${first}!`,
      body: "It's been a week since your last weigh-in. A fresh number helps your coach adjust your plan. It only takes a few seconds.",
      ctaLabel: "Log your weight",
      ctaPath: "/me",
    }),
  });
  return true;
}

export async function sendClientInviteEmail({
  coachName,
  clientName,
  clientEmail,
  temporaryPassword,
}: {
  coachName: string;
  clientName: string;
  clientEmail: string;
  temporaryPassword: string;
}): Promise<void> {
  const resend = getResend();
  if (!resend) return; // not configured — skip silently

  const loginUrl = `${APP_URL}/login`;

  await resend.emails.send({
    from: FROM,
    to: clientEmail,
    subject: `${coachName} added you to CoachFit`,
    html: `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 16px;color:#111">
  <h2 style="margin-bottom:4px">Welcome to CoachFit</h2>
  <p style="color:#555;margin-top:0">Your coach <strong>${coachName}</strong> has set up your account.</p>

  <div style="background:#f5f5f5;border-radius:8px;padding:20px;margin:24px 0">
    <p style="margin:0 0 8px 0;font-size:14px;color:#555">Your login details</p>
    <p style="margin:0 0 4px 0"><strong>Email:</strong> ${clientEmail}</p>
    <p style="margin:0"><strong>Temporary password:</strong> <code style="background:#e5e5e5;padding:2px 6px;border-radius:4px">${temporaryPassword}</code></p>
  </div>

  <a href="${loginUrl}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">
    Log in to CoachFit
  </a>

  <p style="margin-top:24px;font-size:13px;color:#888">
    After logging in you can change your password in Settings. If you have any questions, reply to your coach directly.
  </p>
</body>
</html>`,
  });
}
