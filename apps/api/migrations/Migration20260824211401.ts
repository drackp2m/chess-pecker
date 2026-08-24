import { Migration } from '@mikro-orm/migrations';

export class Migration20260824211401 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "training" drop constraint if exists "training_status_check";`);

    this.addSql(`alter table "training_cycle" drop constraint if exists "training_cycle_status_check";`);

    this.addSql(`alter table "training_calibration_round" drop constraint if exists "training_calibration_round_kind_check";`);

    this.addSql(`alter table "training" drop constraint training_cancelled_matches_reason_check;`);

    this.addSql(`alter table "training" add constraint "training_status_check" check("status" in ('calibrating', 'planning', 'running', 'finished', 'cancelled'));`);
    this.addSql(`alter table "training" add constraint training_cancelled_matches_reason_check check(finished_reason is null or ((status = 'cancelled') = (finished_reason = 'cancelled')));`);

    this.addSql(`alter table "training_cycle" add constraint "training_cycle_status_check" check("status" in ('running', 'finished', 'cancelled'));`);

    this.addSql(`alter table "training_calibration_round" add constraint "training_calibration_round_kind_check" check("kind" in ('exploration', 'refine'));`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "training" drop constraint if exists "training_status_check";`);

    this.addSql(`alter table "training_cycle" drop constraint if exists "training_cycle_status_check";`);

    this.addSql(`alter table "training_calibration_round" drop constraint if exists "training_calibration_round_kind_check";`);

    this.addSql(`alter table "training" drop constraint training_cancelled_matches_reason_check;`);

    this.addSql(`alter table "training" add constraint "training_status_check" check("status" in ('calibrating', 'planning', 'running', 'finished', 'cancelled', 'abandoned'));`);
    this.addSql(`alter table "training" add constraint training_cancelled_matches_reason_check check(finished_reason is null or ((status in ('cancelled', 'abandoned')) = (finished_reason = 'cancelled')));`);

    this.addSql(`alter table "training_cycle" add constraint "training_cycle_status_check" check("status" in ('running', 'finished', 'cancelled', 'abandoned'));`);

    this.addSql(`alter table "training_calibration_round" add constraint "training_calibration_round_kind_check" check("kind" in ('exploration', 'refine', 'scan'));`);
  }

}
