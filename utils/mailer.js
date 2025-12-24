import nodemailer from "nodemailer";

const user = process.env.EMAIL_USER;
const pass = process.env.EMAIL_PASS;

if (!user || !pass) {
  console.error("❌ EMAIL_USER ou EMAIL_PASS manquant dans .env");
  console.error("EMAIL_USER =", user);
  console.error("EMAIL_PASS =", pass ? "OK" : "MISSING");
  throw new Error("Email credentials missing (check .env + dotenv load order)");
}

export const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user, pass },
});
