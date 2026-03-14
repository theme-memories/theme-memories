import { betterAuth } from "better-auth";
import { MongoClient } from "mongodb";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { env } from "cloudflare:workers";
import { username } from "better-auth/plugins";

const baseUrl = await env.BETTER_AUTH_URL.get();
const secret = await env.BETTER_AUTH_SECRET.get();
const mongoUri = await env.MONGO_URI.get();
const client = new MongoClient(mongoUri);
const db = client.db();

export const auth = betterAuth({
  baseURL: baseUrl,
  secret: secret,
  database: mongodbAdapter(db, {
    // Optional: if you don't provide a client, database transactions won't be enabled.
    client,
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [username()],
});
