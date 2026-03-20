import nodemailer from "nodemailer";

const smtpConfig = {
  host: "smtp.timeweb.ru",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_LOGIN,
    pass: process.env.EMAIL_PASSWORD,
  },
  tls: {
    rejectUnauthorized: false,
  },
  debug: false,
  logger: false,
};

const transporter = nodemailer.createTransport(smtpConfig);

export type EmailOptions = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export async function sendEmail(options: EmailOptions): Promise<void> {
  try {
    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.EMAIL_LOGIN,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully:", info.messageId);
  } catch (error) {
    console.error("Error sending email:", error);
    throw new Error("Failed to send email");
  }
}
