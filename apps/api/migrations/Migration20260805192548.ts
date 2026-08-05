import { Migration } from '@mikro-orm/migrations';

export class Migration20260805192548 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "puzzle_attempt" alter column "closure" type text using ("closure"::text);`);
    this.addSql(`alter table "puzzle_attempt" alter column "closure" set not null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "puzzle_attempt" alter column "closure" type text using ("closure"::text);`);
    this.addSql(`alter table "puzzle_attempt" alter column "closure" drop not null;`);
  }

}
