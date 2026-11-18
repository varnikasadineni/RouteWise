// Create an ADMIN or DEPOT_STAFF account without storing plaintext passwords.
// Usage: node scripts/create-user.mjs admin@example.com "Project Admin" ADMIN
import pg from "pg";
import bcrypt from "bcryptjs";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
const [emailArg, nameArg, roleArg] = process.argv.slice(2);
if (!emailArg || !nameArg || !["ADMIN", "DEPOT_STAFF"].includes(roleArg)) {
  console.error('Usage: node scripts/create-user.mjs <email> "Full Name" ADMIN|DEPOT_STAFF');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("Set DATABASE_URL before running this script.");
  process.exit(1);
}
const rl = readline.createInterface({ input, output });
const password = await rl.question("Enter password (8+ characters): ");
rl.close();
if (password.length < 8) {
  console.error("Password must be at least 8 characters.");
  process.exit(1);
}
const hash = await bcrypt.hash(password, 12);
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  await pool.query("INSERT INTO users(full_name,email,password_hash,role) VALUES($1,$2,$3,$4)", [
    nameArg,
    emailArg.toLowerCase(),
    hash,
    roleArg,
  ]);
  console.log(`Created ${roleArg} account for ${emailArg}.`);
} catch (e) {
  console.error("Could not create account:", e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
