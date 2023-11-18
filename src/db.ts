import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

const connection = mysql.createPool({
  // host: process.env.MYSQL_HOST,
  host: "localhost",
  // user: process.env.DB_USER,
  user: "root",
  // database: process.env.MYSQL_DATABASE,
  database: "modern-http",
  // password: process.env.MYSQL_ROOT_PASSWORD,
  password: "pqF33MsiC154LMu3HrZy6RQSC0CEl5",
  port: +(3306 || ""),
});

export const db = drizzle(connection);
