import argon2 from "argon2";

if (process.argv.length > 2) {
  console.error(
    "Do not pass passwords as arguments; pipe the password through stdin",
  );
  process.exit(1);
}

const chunks: Buffer[] = [];
for await (const chunk of process.stdin) {
  chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
}
const password = Buffer.concat(chunks)
  .toString("utf8")
  .replace(/\r?\n$/, "");
if (!password) {
  console.error(
    "Usage: read -r -s PASSWORD; printf '%s' \"$PASSWORD\" | node scripts/hash-password.ts",
  );
  process.exit(1);
}

const secret = process.env.ARGON2_SECRET;
if (!secret) {
  console.error("ARGON2_SECRET env var is required");
  process.exit(1);
}

const hash = await argon2.hash(password, {
  secret: Buffer.from(secret, "utf8"),
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
});
console.log(hash);
