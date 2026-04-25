declare module "sql.js" {
  interface Database {
    exec(sql: string): { columns: string[]; values: unknown[][] }[];
    close(): void;
  }
  interface SqlJsStatic {
    Database: new (data: ArrayLike<number>) => Database;
  }
  type SqlJsConfig = {
    locateFile?: (file: string) => string;
  };
  export default function initSqlJs(config?: SqlJsConfig): Promise<SqlJsStatic>;
}
