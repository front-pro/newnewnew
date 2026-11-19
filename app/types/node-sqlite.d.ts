declare module "node:sqlite" {
  export class DatabaseSync {
    constructor(location: string);
    readonly isTransaction: boolean;
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
  }
  export interface StatementSync {
    run(...parameters: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
    get(...parameters: unknown[]): unknown;
    all(...parameters: unknown[]): unknown[];
  }
}
