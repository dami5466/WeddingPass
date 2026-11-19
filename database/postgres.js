const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing. Check your .env file.");
}

const databaseUrl = new URL(process.env.DATABASE_URL);

// Use explicit certificate verification for Neon connections.
databaseUrl.searchParams.set("sslmode", "verify-full");

const pool = new Pool({
    connectionString: databaseUrl.toString(),
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000
});

pool.on("error", (error) => {
    console.error("Unexpected PostgreSQL pool error:", error.message);
});

module.exports = pool;
