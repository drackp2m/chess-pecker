import { Migration } from '@mikro-orm/migrations';

export class Migration20260824210724 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "training" drop constraint if exists "training_status_check";`);

    this.addSql(`alter table "training_cycle" drop constraint if exists "training_cycle_status_check";`);

    this.addSql(`alter table "training_calibration_round" drop constraint if exists "training_calibration_round_kind_check";`);

    this.addSql(`alter table "training" drop constraint training_abandoned_matches_reason_check;`);

    this.addSql(`alter table "training" add constraint "training_status_check" check("status" in ('calibrating', 'planning', 'running', 'finished', 'cancelled', 'abandoned'));`);
    this.addSql(`alter table "training" add constraint training_cancelled_matches_reason_check check(finished_reason is null or ((status in ('cancelled', 'abandoned')) = (finished_reason = 'cancelled')));`);

    this.addSql(`alter table "training_cycle" add constraint "training_cycle_status_check" check("status" in ('running', 'finished', 'cancelled', 'abandoned'));`);

    this.addSql(`alter table "training_calibration_round" add constraint "training_calibration_round_kind_check" check("kind" in ('exploration', 'refine', 'scan'));`);

    this.addSql(`alter table "puzzle_attempt" rename column "explorations" to "free_play_runs";`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "training" drop constraint if exists "training_status_check";`);

    this.addSql(`alter table "training_calibration_round" drop constraint if exists "training_calibration_round_kind_check";`);

    this.addSql(`alter table "training_cycle" drop constraint if exists "training_cycle_status_check";`);

    this.addSql(`alter table "puzzle_attempt" rename column "free_play_runs" to "explorations";`);

    this.addSql(`alter table "training" drop constraint training_cancelled_matches_reason_check;`);

    this.addSql(`alter table "training" add constraint "training_status_check" check("status" in ('calibrating', 'planning', 'running', 'finished', 'abandoned'));`);
    this.addSql(`alter table "training" add constraint training_abandoned_matches_reason_check check((finished_reason IS NULL) OR ((status = 'abandoned'::text) = (finished_reason = 'cancelled'::text)));`);

    this.addSql(`alter table "training_calibration_round" add constraint "training_calibration_round_kind_check" check("kind" in ('scan', 'refine'));`);

    this.addSql(`alter table "training_cycle" add constraint "training_cycle_status_check" check("status" in ('running', 'finished', 'abandoned'));`);
  }

}
