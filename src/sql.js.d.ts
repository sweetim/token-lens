declare module "sql.js" {
  type BindParams = ReadonlyArray<unknown> | Record<string, unknown>;

  interface Statement {
    bind(params?: BindParams): boolean;
    step(): boolean;
    get(params?: BindParams): unknown[];
    getAsObject(params?: BindParams): Record<string, unknown>;
    run(params?: BindParams): void;
    free(): void;
  }

  interface Database {
    exec(sql: string): { columns: string[]; values: unknown[][] }[];
    prepare(sql: string): Statement;
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
