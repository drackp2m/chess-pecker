import { Migration } from '@mikro-orm/migrations';

export class Migration20260825114914 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "training_cycle" alter column "item_count" type int using ("item_count"::int);`);
    this.addSql(`alter table "training_cycle" alter column "item_count" set not null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "training_cycle" alter column "item_count" type int using ("item_count"::int);`);
    this.addSql(`alter table "training_cycle" alter column "item_count" drop not null;`);
  }

}
