import { Migration } from '@mikro-orm/migrations';

export class Migration20260729225329 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "training_calibration_puzzle" ("uuid" varchar(255) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "calibration_round_uuid" varchar(255) not null, "puzzle_uuid" varchar(255) not null, "position" int not null, constraint "training_calibration_puzzle_pkey" primary key ("uuid"));`);
    this.addSql(`alter table "training_calibration_puzzle" add constraint "training_calibration_puzzle_calibration_round_uui_ec26c_unique" unique ("calibration_round_uuid", "puzzle_uuid");`);
    this.addSql(`alter table "training_calibration_puzzle" add constraint "training_calibration_puzzle_calibration_round_uui_e9549_unique" unique ("calibration_round_uuid", "position");`);

    this.addSql(`alter table "training_calibration_puzzle" add constraint "training_calibration_puzzle_calibration_round_uuid_foreign" foreign key ("calibration_round_uuid") references "training_calibration_round" ("uuid") on update cascade on delete cascade;`);
    this.addSql(`alter table "training_calibration_puzzle" add constraint "training_calibration_puzzle_puzzle_uuid_foreign" foreign key ("puzzle_uuid") references "puzzle" ("uuid") on update cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "training_calibration_puzzle" cascade;`);
  }

}
