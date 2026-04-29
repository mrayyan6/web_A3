// Test script to send a single email using .env.local settings
const dotenv = require('dotenv');
const nodemailer = require('nodemailer');

dotenv.config({ path: '.env.local' });

async function main() {
  if (!process.env.SMTP_HOST) {
    console.error('SMTP_HOST not set in .env.local — aborting');
    process.exit(1);
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  try {
    await transporter.verify();
    console.log('SMTP connection verified');
  } catch (err) {
    console.error('SMTP verification failed:', err);
  }

  const from = process.env.SMTP_FROM || 'Test <noreply@example.com>';
  const to = process.env.SMTP_USER || 'noreply@example.com';

  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject: 'CRM Test Email',
      text: 'This is a test email from your local CRM instance.',
      html: '<p>This is a <strong>test</strong> email from your local CRM instance.</p>',
    });
    console.log('Message sent:', info.messageId || info);
  } catch (err) {
    console.error('sendMail failed:', err);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('Unexpected error', e);
  process.exit(1);
});