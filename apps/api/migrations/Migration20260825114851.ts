import { Migration } from '@mikro-orm/migrations';

export class Migration20260825114851 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`update "training_cycle" set "item_count" = greatest((select count(*) from "training_cycle_item" where "training_cycle_item"."cycle_uuid" = "training_cycle"."uuid"), 1) where "item_count" is null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`select 1;`);
  }

}
