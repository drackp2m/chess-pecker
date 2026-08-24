import { Migration } from '@mikro-orm/migrations';

export class Migration20260824211216_rename_glossary_enum_values extends Migration {

  override async up(): Promise<void> {
    this.addSql(`update "training" set "status" = 'cancelled' where "status" = 'abandoned';`);
    this.addSql(`update "training_cycle" set "status" = 'cancelled' where "status" = 'abandoned';`);
    this.addSql(`update "training_calibration_round" set "kind" = 'exploration' where "kind" = 'scan';`);
  }

  override async down(): Promise<void> {
    this.addSql(`update "training" set "status" = 'abandoned' where "status" = 'cancelled';`);
    this.addSql(`update "training_cycle" set "status" = 'abandoned' where "status" = 'cancelled';`);
    this.addSql(`update "training_calibration_round" set "kind" = 'scan' where "kind" = 'exploration';`);
  }

}
