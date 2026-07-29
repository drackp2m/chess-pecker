import { Migration } from '@mikro-orm/migrations';

export class Migration20260729030630 extends Migration {
	override async up(): Promise<void> {
		this.addSql(
			`create table "puzzle" ("uuid" varchar(255) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "lichess_id" varchar(255) not null, "fen" text not null, "moves" text[] not null, "rating" int not null, "popularity" int not null, "nb_plays" int not null, "themes" text[] not null, "game_url" text not null, constraint "puzzle_pkey" primary key ("uuid"));`,
		);
		this.addSql(
			`alter table "puzzle" add constraint "puzzle_lichess_id_unique" unique ("lichess_id");`,
		);
		this.addSql(`create index "puzzle_rating_index" on "puzzle" ("rating");`);
		this.addSql(`create index "puzzle_themes_index" on "puzzle" using gin ("themes");`);

		this.addSql(
			`create table "user_setting" ("uuid" varchar(255) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "user_uuid" varchar(255) not null, "key" varchar(255) not null, "value" jsonb not null, constraint "user_setting_pkey" primary key ("uuid"));`,
		);
		this.addSql(
			`alter table "user_setting" add constraint "user_setting_user_uuid_key_unique" unique ("user_uuid", "key");`,
		);

		this.addSql(
			`alter table "user_setting" add constraint "user_setting_user_uuid_foreign" foreign key ("user_uuid") references "user" ("uuid") on update cascade on delete cascade;`,
		);
	}

	override async down(): Promise<void> {
		this.addSql(`drop table if exists "puzzle" cascade;`);

		this.addSql(`drop table if exists "user_setting" cascade;`);
	}
}
