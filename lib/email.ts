import nodemailer from 'nodemailer';
import type { SerializedLead } from '@/types/lead';

function getTransporter() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

const FROM = process.env.SMTP_FROM ?? '"Property CRM" <noreply@example.com>';

function pkr(n: number) {
  return n.toLocaleString('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 });
}

function tableRow(label: string, value: string, tinted = false) {
  const bg = tinted ? 'background:#f9fafb' : 'background:#ffffff';
  return `<tr style="${bg}">
    <td style="padding:10px 16px;font-weight:600;color:#374151;width:130px;border-bottom:1px solid #e5e7eb">${label}</td>
    <td style="padding:10px 16px;color:#111827;border-bottom:1px solid #e5e7eb">${value}</td>
  </tr>`;
}

const priorityBadgeStyle: Record<string, string> = {
  High: 'background:#fee2e2;color:#b91c1c',
  Medium: 'background:#fef3c7;color:#b45309',
  Low: 'background:#dcfce7;color:#166534',
};

function priorityBadge(p: string) {
  const style = priorityBadgeStyle[p] ?? priorityBadgeStyle.Low;
  return `<span style="padding:2px 10px;border-radius:9999px;font-size:12px;font-weight:600;${style}">${p}</span>`;
}

function buildLeadTable(lead: SerializedLead) {
  return `<table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden">
    ${tableRow('Name', lead.name)}
    ${tableRow('Email', `<a href="mailto:${lead.email}" style="color:#1d4ed8">${lead.email}</a>`, true)}
    ${tableRow('Phone', lead.phone)}
    ${tableRow('Property', lead.propertyInterest, true)}
    ${tableRow('Budget', pkr(lead.budget))}
    ${tableRow('Priority', priorityBadge(lead.priority), true)}
    ${tableRow('Status', lead.status)}
    ${lead.notes ? tableRow('Notes', lead.notes, true) : ''}
  </table>`;
}

function wrap(heading: string, body: string) {
  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:24px;background:#f3f4f6;font-family:system-ui,-apple-system,sans-serif">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden">
    <div style="background:#1d4ed8;padding:20px 24px">
      <h2 style="margin:0;color:#ffffff;font-size:18px;font-weight:600">${heading}</h2>
    </div>
    <div style="padding:24px">${body}</div>
    <div style="padding:14px 24px;background:#f9fafb;border-top:1px solid #e5e7eb">
      <p style="margin:0;font-size:12px;color:#9ca3af">Automated message from your Property CRM system.</p>
    </div>
  </div>
</body>
</html>`;
}

export async function sendNewLeadEmail(lead: SerializedLead, adminEmails: string[]) {
  const transporter = getTransporter();
  if (!transporter || adminEmails.length === 0) return;

  const html = wrap(
    'New Lead Created',
    `<p style="margin:0 0 16px;color:#374151">A new lead has been added to the CRM:</p>
     ${buildLeadTable(lead)}`
  );

  try {
    await transporter.sendMail({
      from: FROM,
      to: adminEmails.join(', '),
      subject: `[CRM] New Lead: ${lead.name}`,
      html,
    });
  } catch (err) {
    console.error('[EMAIL] sendNewLeadEmail failed:', err);
  }
}

export async function sendLeadAssignedEmail(
  lead: SerializedLead,
  agentEmail: string,
  agentName: string
) {
  const transporter = getTransporter();
  if (!transporter) return;

  const html = wrap(
    'Lead Assigned to You',
    `<p style="margin:0 0 16px;color:#374151">Hi <strong>${agentName}</strong>, the following lead has been assigned to you:</p>
     ${buildLeadTable(lead)}
     <p style="margin:16px 0 0;font-size:13px;color:#6b7280">Log in to the CRM to view and update this lead.</p>`
  );

  try {
    await transporter.sendMail({
      from: FROM,
      to: agentEmail,
      subject: `[CRM] Lead Assigned to You: ${lead.name}`,
      html,
    });
  } catch (err) {
    console.error('[EMAIL] sendLeadAssignedEmail failed:', err);
  }
}
