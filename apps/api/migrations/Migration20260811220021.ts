import { Migration } from '@mikro-orm/migrations';

export class Migration20260811220021 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "puzzle_attempt" add column "record" jsonb not null default '[]', add column "explorations" jsonb not null default '[]', add column "received_at" timestamptz not null default now();`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "puzzle_attempt" drop column "record", drop column "explorations", drop column "received_at";`);
  }

}
