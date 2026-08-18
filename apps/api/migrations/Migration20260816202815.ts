import { Migration } from '@mikro-orm/migrations';

export class Migration20260816202815 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "training" add column "client_ref" varchar(255) null, add column "received_at" timestamptz not null default now();`);
    this.addSql(`alter table "training" add constraint "training_client_ref_unique" unique ("client_ref");`);

    this.addSql(`alter table "training_puzzle" add column "client_ref" varchar(255) null, add column "received_at" timestamptz not null default now();`);
    this.addSql(`alter table "training_puzzle" add constraint "training_puzzle_client_ref_unique" unique ("client_ref");`);

    this.addSql(`alter table "training_goal" add column "client_ref" varchar(255) null, add column "received_at" timestamptz not null default now();`);
    this.addSql(`alter table "training_goal" add constraint "training_goal_client_ref_unique" unique ("client_ref");`);

    this.addSql(`alter table "training_cycle" add column "client_ref" varchar(255) null, add column "received_at" timestamptz not null default now();`);
    this.addSql(`alter table "training_cycle" add constraint "training_cycle_client_ref_unique" unique ("client_ref");`);

    this.addSql(`alter table "training_cycle_item" add column "client_ref" varchar(255) null, add column "received_at" timestamptz not null default now();`);
    this.addSql(`alter table "training_cycle_item" add constraint "training_cycle_item_client_ref_unique" unique ("client_ref");`);

    this.addSql(`alter table "training_calibration_round" add column "client_ref" varchar(255) null, add column "received_at" timestamptz not null default now();`);
    this.addSql(`alter table "training_calibration_round" add constraint "training_calibration_round_client_ref_unique" unique ("client_ref");`);

    this.addSql(`alter table "training_calibration_puzzle" add column "client_ref" varchar(255) null, add column "received_at" timestamptz not null default now();`);
    this.addSql(`alter table "training_calibration_puzzle" add constraint "training_calibration_puzzle_client_ref_unique" unique ("client_ref");`);

    this.addSql(`alter table "puzzle_attempt" add column "client_ref" varchar(255) null;`);
    this.addSql(`alter table "puzzle_attempt" add constraint "puzzle_attempt_client_ref_unique" unique ("client_ref");`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "puzzle_attempt" drop constraint "puzzle_attempt_client_ref_unique";`);
    this.addSql(`alter table "puzzle_attempt" drop column "client_ref";`);

    this.addSql(`alter table "training" drop constraint "training_client_ref_unique";`);
    this.addSql(`alter table "training" drop column "client_ref", drop column "received_at";`);

    this.addSql(`alter table "training_calibration_puzzle" drop constraint "training_calibration_puzzle_client_ref_unique";`);
    this.addSql(`alter table "training_calibration_puzzle" drop column "client_ref", drop column "received_at";`);

    this.addSql(`alter table "training_calibration_round" drop constraint "training_calibration_round_client_ref_unique";`);
    this.addSql(`alter table "training_calibration_round" drop column "client_ref", drop column "received_at";`);

    this.addSql(`alter table "training_cycle" drop constraint "training_cycle_client_ref_unique";`);
    this.addSql(`alter table "training_cycle" drop column "client_ref", drop column "received_at";`);

    this.addSql(`alter table "training_cycle_item" drop constraint "training_cycle_item_client_ref_unique";`);
    this.addSql(`alter table "training_cycle_item" drop column "client_ref", drop column "received_at";`);

    this.addSql(`alter table "training_goal" drop constraint "training_goal_client_ref_unique";`);
    this.addSql(`alter table "training_goal" drop column "client_ref", drop column "received_at";`);

    this.addSql(`alter table "training_puzzle" drop constraint "training_puzzle_client_ref_unique";`);
    this.addSql(`alter table "training_puzzle" drop column "client_ref", drop column "received_at";`);
  }

}
