import argon2 from "argon2";

const password = process.argv[2];
if (!password) {
  console.error("Usage: pnpm tsx scripts/hash-password.ts <password>");
  process.exit(1);
}

const secret = process.env.ARGON2_SECRET;
if (!secret) {
  console.error("ARGON2_SECRET env var is required");
  process.exit(1);
}

const hash = await argon2.hash(password, {
  secret: Buffer.from(secret, "utf8"),
});
console.log(hash);
