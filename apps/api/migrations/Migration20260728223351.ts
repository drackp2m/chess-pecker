import { Migration } from '@mikro-orm/migrations';

export class Migration20260728223351 extends Migration {
	override async up(): Promise<void> {
		this.addSql(
			`create table "user" ("uuid" varchar(255) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "username" varchar(255) not null, "password" varchar(255) not null, "email" varchar(255) null, "role" text check ("role" in ('admin', 'registered', 'guest')) not null default 'registered', constraint "user_pkey" primary key ("uuid"));`,
		);
		this.addSql(`alter table "user" add constraint "user_username_unique" unique ("username");`);
		this.addSql(`alter table "user" add constraint "user_email_unique" unique ("email");`);
	}

	override async down(): Promise<void> {
		this.addSql(`drop table if exists "user" cascade;`);
	}
}
