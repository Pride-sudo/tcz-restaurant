import nodemailer from 'nodemailer';
import { env, isProd } from '../config/env';
import { logger } from '../utils/logger';

let transport: nodemailer.Transporter | null = null;
if (env.SMTP_HOST) transport = nodemailer.createTransport({ host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_PORT === 465, auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined });

export async function sendMail(to: string, subject: string, text: string) {
  if (!transport) {
    // No SMTP configured: in development print the message so the flow can be tested; never print bodies in production.
    logger.warn('SMTP not configured - email not sent', { to, subject, ...(isProd ? {} : { body: text }) });
    return false;
  }
  try { await transport.sendMail({ from: env.MAIL_FROM, to, subject, text }); return true; }
  catch (e: any) { logger.error('Email send failed', { message: e.message }); return false; }
}
