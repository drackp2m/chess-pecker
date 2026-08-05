import { Migration } from '@mikro-orm/migrations';

export class Migration20260805192517_backfill_puzzle_attempt_closure extends Migration {

  override async up(): Promise<void> {
    this.addSql(`update "puzzle_attempt" set "closure" = case when "solved" then 'found' else 'revealed' end where "closure" is null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`update "puzzle_attempt" set "closure" = null;`);
  }

}
