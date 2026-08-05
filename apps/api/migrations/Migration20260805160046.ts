import { Migration } from '@mikro-orm/migrations';

export class Migration20260805160046 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "puzzle_attempt" add column "closure" text check ("closure" in ('found', 'revealed')) not null, add column "hint_used" boolean not null, add column "mistake_count" int not null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "puzzle_attempt" drop column "closure", drop column "hint_used", drop column "mistake_count";`);
  }

}
