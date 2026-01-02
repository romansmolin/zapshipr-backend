"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
require("dotenv/config");
const node_postgres_1 = require("drizzle-orm/node-postgres");
const pg_1 = require("pg");
const schema_1 = require("./schema");
const connectionString = process.env.DATABASE_URL;
const ssl = (process.env.DB_SSL ?? 'false').toLowerCase() === 'true' ? { rejectUnauthorized: false } : undefined;
const pool = connectionString
    ? new pg_1.Pool({ connectionString, ssl })
    : new pg_1.Pool({
        host: process.env.DB_HOST ?? 'localhost',
        port: Number(process.env.DB_PORT ?? '5432'),
        user: process.env.DB_USER ?? 'app_user',
        password: process.env.DB_PASSWORD ?? 'app_password',
        database: process.env.DB_NAME ?? 'app_db',
        ssl,
    });
exports.db = (0, node_postgres_1.drizzle)(pool, { schema: schema_1.schema });
