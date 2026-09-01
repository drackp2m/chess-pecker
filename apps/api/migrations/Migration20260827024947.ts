import { Migration } from '@mikro-orm/migrations';

export class Migration20260827024947 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "puzzle_bookmark" ("uuid" varchar(255) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "user_uuid" varchar(255) not null, "puzzle_uuid" varchar(255) not null, "type" text check ("type" in ('favorite', 'hard', 'easy', 'unclear')) not null, constraint "puzzle_bookmark_pkey" primary key ("uuid"));`);
    this.addSql(`alter table "puzzle_bookmark" add constraint "puzzle_bookmark_user_uuid_puzzle_uuid_unique" unique ("user_uuid", "puzzle_uuid");`);

    this.addSql(`alter table "puzzle_bookmark" add constraint "puzzle_bookmark_user_uuid_foreign" foreign key ("user_uuid") references "user" ("uuid") on update cascade on delete cascade;`);
    this.addSql(`alter table "puzzle_bookmark" add constraint "puzzle_bookmark_puzzle_uuid_foreign" foreign key ("puzzle_uuid") references "puzzle" ("uuid") on update cascade on delete cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "puzzle_bookmark" cascade;`);
  }

}
