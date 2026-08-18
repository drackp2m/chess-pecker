import { Migration } from '@mikro-orm/migrations';

export class Migration20260818023721 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create index "puzzle_attempt_training_uuid_received_at_uuid_index" on "puzzle_attempt" ("training_uuid", "received_at", "uuid");`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop index "puzzle_attempt_training_uuid_received_at_uuid_index";`);
  }

}
