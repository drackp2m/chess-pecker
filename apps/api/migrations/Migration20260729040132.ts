/* eslint-disable max-lines-per-function -- fichero generado por `mikro-orm migration:create` */
import { Migration } from '@mikro-orm/migrations';

export class Migration20260729040132 extends Migration {
	override async up(): Promise<void> {
		this.addSql(
			`create table "training" ("uuid" varchar(255) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "user_uuid" varchar(255) not null, "status" text check ("status" in ('calibrating', 'planning', 'running', 'finished', 'abandoned')) not null default 'calibrating', "finished_reason" text check ("finished_reason" in ('completed', 'plateau', 'max-cycles', 'cancelled')) null, "finished_at" timestamptz null, constraint "training_pkey" primary key ("uuid"), constraint training_abandoned_matches_reason_check check (finished_reason is null or ((status = 'abandoned') = (finished_reason = 'cancelled'))));`,
		);
		this.addSql(
			`create index "training_user_uuid_status_index" on "training" ("user_uuid", "status");`,
		);

		this.addSql(
			`create table "training_puzzle" ("uuid" varchar(255) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "training_uuid" varchar(255) not null, "puzzle_uuid" varchar(255) not null, constraint "training_puzzle_pkey" primary key ("uuid"));`,
		);
		this.addSql(
			`create index "training_puzzle_training_uuid_index" on "training_puzzle" ("training_uuid");`,
		);
		this.addSql(
			`alter table "training_puzzle" add constraint "training_puzzle_training_uuid_puzzle_uuid_unique" unique ("training_uuid", "puzzle_uuid");`,
		);

		this.addSql(
			`create table "training_goal" ("uuid" varchar(255) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "training_uuid" varchar(255) not null, "puzzles_per_day" int null, "end_date" date null, constraint "training_goal_pkey" primary key ("uuid"), constraint training_goal_has_target_check check (puzzles_per_day is not null or end_date is not null));`,
		);
		this.addSql(
			`create index "training_goal_training_uuid_created_at_index" on "training_goal" ("training_uuid", "created_at");`,
		);

		this.addSql(
			`create table "training_cycle" ("uuid" varchar(255) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "training_uuid" varchar(255) not null, "index" int not null, "status" text check ("status" in ('running', 'finished', 'abandoned')) not null default 'running', constraint "training_cycle_pkey" primary key ("uuid"));`,
		);
		this.addSql(
			`alter table "training_cycle" add constraint "training_cycle_training_uuid_index_unique" unique ("training_uuid", "index");`,
		);

		this.addSql(
			`create table "training_cycle_item" ("uuid" varchar(255) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "cycle_uuid" varchar(255) not null, "training_puzzle_uuid" varchar(255) not null, "position" int not null, constraint "training_cycle_item_pkey" primary key ("uuid"));`,
		);
		this.addSql(
			`alter table "training_cycle_item" add constraint "training_cycle_item_cycle_uuid_training_puzzle_uuid_unique" unique ("cycle_uuid", "training_puzzle_uuid");`,
		);
		this.addSql(
			`alter table "training_cycle_item" add constraint "training_cycle_item_cycle_uuid_position_unique" unique ("cycle_uuid", "position");`,
		);

		this.addSql(
			`create table "training_calibration_round" ("uuid" varchar(255) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "training_uuid" varchar(255) not null, "index" int not null, "kind" text check ("kind" in ('scan', 'refine')) not null, "rating" int not null, "outcome" text check ("outcome" in ('pending', 'raise', 'lower', 'accept')) not null default 'pending', constraint "training_calibration_round_pkey" primary key ("uuid"), constraint calibration_round_rating_bucket_check check (rating % 100 = 0));`,
		);
		this.addSql(
			`alter table "training_calibration_round" add constraint "training_calibration_round_training_uuid_index_unique" unique ("training_uuid", "index");`,
		);

		this.addSql(
			`create table "puzzle_attempt" ("uuid" varchar(255) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "training_uuid" varchar(255) not null, "kind" text check ("kind" in ('calibration', 'cycle')) not null, "calibration_round_uuid" varchar(255) null, "cycle_item_uuid" varchar(255) null, "puzzle_uuid" varchar(255) not null, "duration_ms" int not null, "solved" boolean not null, constraint "puzzle_attempt_pkey" primary key ("uuid"), constraint puzzle_attempt_kind_parent_check check ((kind = 'calibration' and calibration_round_uuid is not null and cycle_item_uuid is null) or (kind = 'cycle' and cycle_item_uuid is not null and calibration_round_uuid is null)));`,
		);
		this.addSql(
			`create index "puzzle_attempt_cycle_item_uuid_index" on "puzzle_attempt" ("cycle_item_uuid");`,
		);
		this.addSql(
			`create index "puzzle_attempt_puzzle_uuid_training_uuid_index" on "puzzle_attempt" ("puzzle_uuid", "training_uuid");`,
		);
		this.addSql(
			`create index "puzzle_attempt_training_uuid_kind_index" on "puzzle_attempt" ("training_uuid", "kind");`,
		);

		this.addSql(
			`create table "friendship" ("uuid" varchar(255) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "requester_uuid" varchar(255) not null, "addressee_uuid" varchar(255) not null, "status" text check ("status" in ('pending', 'accepted', 'declined')) not null default 'pending', constraint "friendship_pkey" primary key ("uuid"), constraint friendship_check check (requester_uuid <> addressee_uuid));`,
		);
		this.addSql(
			`create index "friendship_requester_uuid_index" on "friendship" ("requester_uuid");`,
		);
		this.addSql(
			`create index "friendship_addressee_uuid_index" on "friendship" ("addressee_uuid");`,
		);
		this.addSql(
			`create unique index "friendship_active_pair_unique" on "friendship" (least("requester_uuid", "addressee_uuid"), greatest("requester_uuid", "addressee_uuid")) where "status" in ('pending', 'accepted');`,
		);

		this.addSql(
			`create table "user_block" ("uuid" varchar(255) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "blocker_uuid" varchar(255) not null, "blocked_uuid" varchar(255) not null, constraint "user_block_pkey" primary key ("uuid"), constraint user_block_check check (blocker_uuid <> blocked_uuid));`,
		);
		this.addSql(
			`alter table "user_block" add constraint "user_block_blocker_uuid_blocked_uuid_unique" unique ("blocker_uuid", "blocked_uuid");`,
		);

		this.addSql(
			`alter table "training" add constraint "training_user_uuid_foreign" foreign key ("user_uuid") references "user" ("uuid") on update cascade on delete cascade;`,
		);

		this.addSql(
			`alter table "training_puzzle" add constraint "training_puzzle_training_uuid_foreign" foreign key ("training_uuid") references "training" ("uuid") on update cascade on delete cascade;`,
		);
		this.addSql(
			`alter table "training_puzzle" add constraint "training_puzzle_puzzle_uuid_foreign" foreign key ("puzzle_uuid") references "puzzle" ("uuid") on update cascade;`,
		);

		this.addSql(
			`alter table "training_goal" add constraint "training_goal_training_uuid_foreign" foreign key ("training_uuid") references "training" ("uuid") on update cascade on delete cascade;`,
		);

		this.addSql(
			`alter table "training_cycle" add constraint "training_cycle_training_uuid_foreign" foreign key ("training_uuid") references "training" ("uuid") on update cascade on delete cascade;`,
		);

		this.addSql(
			`alter table "training_cycle_item" add constraint "training_cycle_item_cycle_uuid_foreign" foreign key ("cycle_uuid") references "training_cycle" ("uuid") on update cascade on delete cascade;`,
		);
		this.addSql(
			`alter table "training_cycle_item" add constraint "training_cycle_item_training_puzzle_uuid_foreign" foreign key ("training_puzzle_uuid") references "training_puzzle" ("uuid") on update cascade on delete cascade;`,
		);

		this.addSql(
			`alter table "training_calibration_round" add constraint "training_calibration_round_training_uuid_foreign" foreign key ("training_uuid") references "training" ("uuid") on update cascade on delete cascade;`,
		);

		this.addSql(
			`alter table "puzzle_attempt" add constraint "puzzle_attempt_training_uuid_foreign" foreign key ("training_uuid") references "training" ("uuid") on update cascade on delete cascade;`,
		);
		this.addSql(
			`alter table "puzzle_attempt" add constraint "puzzle_attempt_calibration_round_uuid_foreign" foreign key ("calibration_round_uuid") references "training_calibration_round" ("uuid") on update cascade on delete cascade;`,
		);
		this.addSql(
			`alter table "puzzle_attempt" add constraint "puzzle_attempt_cycle_item_uuid_foreign" foreign key ("cycle_item_uuid") references "training_cycle_item" ("uuid") on update cascade on delete cascade;`,
		);
		this.addSql(
			`alter table "puzzle_attempt" add constraint "puzzle_attempt_puzzle_uuid_foreign" foreign key ("puzzle_uuid") references "puzzle" ("uuid") on update cascade;`,
		);

		this.addSql(
			`alter table "friendship" add constraint "friendship_requester_uuid_foreign" foreign key ("requester_uuid") references "user" ("uuid") on update cascade on delete cascade;`,
		);
		this.addSql(
			`alter table "friendship" add constraint "friendship_addressee_uuid_foreign" foreign key ("addressee_uuid") references "user" ("uuid") on update cascade on delete cascade;`,
		);

		this.addSql(
			`alter table "user_block" add constraint "user_block_blocker_uuid_foreign" foreign key ("blocker_uuid") references "user" ("uuid") on update cascade on delete cascade;`,
		);
		this.addSql(
			`alter table "user_block" add constraint "user_block_blocked_uuid_foreign" foreign key ("blocked_uuid") references "user" ("uuid") on update cascade on delete cascade;`,
		);
	}

	override async down(): Promise<void> {
		this.addSql(
			`alter table "training_puzzle" drop constraint "training_puzzle_training_uuid_foreign";`,
		);

		this.addSql(
			`alter table "training_goal" drop constraint "training_goal_training_uuid_foreign";`,
		);

		this.addSql(
			`alter table "training_cycle" drop constraint "training_cycle_training_uuid_foreign";`,
		);

		this.addSql(
			`alter table "training_calibration_round" drop constraint "training_calibration_round_training_uuid_foreign";`,
		);

		this.addSql(
			`alter table "puzzle_attempt" drop constraint "puzzle_attempt_training_uuid_foreign";`,
		);

		this.addSql(
			`alter table "training_cycle_item" drop constraint "training_cycle_item_training_puzzle_uuid_foreign";`,
		);

		this.addSql(
			`alter table "training_cycle_item" drop constraint "training_cycle_item_cycle_uuid_foreign";`,
		);

		this.addSql(
			`alter table "puzzle_attempt" drop constraint "puzzle_attempt_cycle_item_uuid_foreign";`,
		);

		this.addSql(
			`alter table "puzzle_attempt" drop constraint "puzzle_attempt_calibration_round_uuid_foreign";`,
		);

		this.addSql(`drop table if exists "training" cascade;`);

		this.addSql(`drop table if exists "training_puzzle" cascade;`);

		this.addSql(`drop table if exists "training_goal" cascade;`);

		this.addSql(`drop table if exists "training_cycle" cascade;`);

		this.addSql(`drop table if exists "training_cycle_item" cascade;`);

		this.addSql(`drop table if exists "training_calibration_round" cascade;`);

		this.addSql(`drop table if exists "puzzle_attempt" cascade;`);

		this.addSql(`drop table if exists "friendship" cascade;`);

		this.addSql(`drop table if exists "user_block" cascade;`);
	}
}
