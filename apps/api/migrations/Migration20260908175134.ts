import { Migration } from '@mikro-orm/migrations';

export class Migration20260908175134 extends Migration {

  override name = 'Migration20260908175134';

  override up(): void | Promise<void> {
    this.addSql(`create table "puzzle_bookmark_history" ("uuid" varchar(255) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "user_uuid" varchar(255) not null, "puzzle_uuid" varchar(255) not null, "type" varchar(255) null, "attempt_uuid" varchar(255) null, primary key ("uuid"));`);

    this.addSql(`alter table "puzzle_bookmark" add "attempt_uuid" varchar(255) null;`);

    this.addSql(`alter table "puzzle_bookmark_history" add constraint "puzzle_bookmark_history_user_uuid_foreign" foreign key ("user_uuid") references "user" ("uuid") on update cascade on delete cascade;`);
    this.addSql(`alter table "puzzle_bookmark_history" add constraint "puzzle_bookmark_history_puzzle_uuid_foreign" foreign key ("puzzle_uuid") references "puzzle" ("uuid") on update cascade on delete cascade;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "puzzle_bookmark_history" cascade;`);

    this.addSql(`alter table "puzzle_bookmark" drop column "attempt_uuid";`);
  }

}
