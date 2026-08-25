import { Migration } from '@mikro-orm/migrations';

export class Migration20260825114842 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "training_cycle" add column "item_count" int null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "training_cycle" drop column "item_count";`);
  }

}
