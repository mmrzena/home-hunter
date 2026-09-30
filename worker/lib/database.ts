import type { Sql, TransactionSql } from "postgres";
export type Database = Sql | TransactionSql;
