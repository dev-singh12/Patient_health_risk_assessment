import { defineConfig } from "drizzle-kit";

// Load .env locally; on Render the variable is already injected
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required for drizzle-kit");
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: DATABASE_URL,
  },
});
