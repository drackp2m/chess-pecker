import { Migration } from '@mikro-orm/migrations';

export class Migration20260829014501 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "puzzle_share" ("uuid" varchar(255) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "sender_uuid" varchar(255) not null, "puzzle_uuid" varchar(255) not null, "message" text null, "source_attempt_uuid" varchar(255) null, constraint "puzzle_share_pkey" primary key ("uuid"));`);
    this.addSql(`create index "puzzle_share_sender_uuid_created_at_index" on "puzzle_share" ("sender_uuid", "created_at");`);

    this.addSql(`create table "puzzle_share_recipient" ("uuid" varchar(255) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "share_uuid" varchar(255) not null, "recipient_uuid" varchar(255) not null, constraint "puzzle_share_recipient_pkey" primary key ("uuid"));`);
    this.addSql(`create index "puzzle_share_recipient_recipient_uuid_created_at_index" on "puzzle_share_recipient" ("recipient_uuid", "created_at");`);
    this.addSql(`alter table "puzzle_share_recipient" add constraint "puzzle_share_recipient_share_uuid_recipient_uuid_unique" unique ("share_uuid", "recipient_uuid");`);

    this.addSql(`create table "puzzle_share_attempt" ("uuid" varchar(255) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "share_uuid" varchar(255) not null, "user_uuid" varchar(255) not null, "solved" boolean not null, "closure" text check ("closure" in ('found', 'revealed')) not null, "hint_used" boolean not null default false, "mistake_count" int not null default 0, "duration_ms" int null, constraint "puzzle_share_attempt_pkey" primary key ("uuid"));`);
    this.addSql(`alter table "puzzle_share_attempt" add constraint "puzzle_share_attempt_share_uuid_user_uuid_unique" unique ("share_uuid", "user_uuid");`);

    this.addSql(`create table "user_notification" ("uuid" varchar(255) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "user_uuid" varchar(255) not null, "type" text check ("type" in ('puzzle-share-received', 'puzzle-share-solved')) not null, "actor_uuid" varchar(255) null, "share_uuid" varchar(255) null, "read_at" timestamptz null, constraint "user_notification_pkey" primary key ("uuid"));`);
    this.addSql(`create index "user_notification_user_uuid_created_at_index" on "user_notification" ("user_uuid", "created_at");`);

    this.addSql(`alter table "puzzle_share" add constraint "puzzle_share_sender_uuid_foreign" foreign key ("sender_uuid") references "user" ("uuid") on update cascade on delete cascade;`);
    this.addSql(`alter table "puzzle_share" add constraint "puzzle_share_puzzle_uuid_foreign" foreign key ("puzzle_uuid") references "puzzle" ("uuid") on update cascade on delete cascade;`);
    this.addSql(`alter table "puzzle_share" add constraint "puzzle_share_source_attempt_uuid_foreign" foreign key ("source_attempt_uuid") references "puzzle_attempt" ("uuid") on update cascade on delete set null;`);

    this.addSql(`alter table "puzzle_share_recipient" add constraint "puzzle_share_recipient_share_uuid_foreign" foreign key ("share_uuid") references "puzzle_share" ("uuid") on update cascade on delete cascade;`);
    this.addSql(`alter table "puzzle_share_recipient" add constraint "puzzle_share_recipient_recipient_uuid_foreign" foreign key ("recipient_uuid") references "user" ("uuid") on update cascade on delete cascade;`);

    this.addSql(`alter table "puzzle_share_attempt" add constraint "puzzle_share_attempt_share_uuid_foreign" foreign key ("share_uuid") references "puzzle_share" ("uuid") on update cascade on delete cascade;`);
    this.addSql(`alter table "puzzle_share_attempt" add constraint "puzzle_share_attempt_user_uuid_foreign" foreign key ("user_uuid") references "user" ("uuid") on update cascade on delete cascade;`);

    this.addSql(`alter table "user_notification" add constraint "user_notification_user_uuid_foreign" foreign key ("user_uuid") references "user" ("uuid") on update cascade on delete cascade;`);
    this.addSql(`alter table "user_notification" add constraint "user_notification_actor_uuid_foreign" foreign key ("actor_uuid") references "user" ("uuid") on update cascade on delete cascade;`);
    this.addSql(`alter table "user_notification" add constraint "user_notification_share_uuid_foreign" foreign key ("share_uuid") references "puzzle_share" ("uuid") on update cascade on delete cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "puzzle_share_recipient" drop constraint "puzzle_share_recipient_share_uuid_foreign";`);

    this.addSql(`alter table "puzzle_share_attempt" drop constraint "puzzle_share_attempt_share_uuid_foreign";`);

    this.addSql(`alter table "user_notification" drop constraint "user_notification_share_uuid_foreign";`);

    this.addSql(`drop table if exists "puzzle_share" cascade;`);

    this.addSql(`drop table if exists "puzzle_share_recipient" cascade;`);

    this.addSql(`drop table if exists "puzzle_share_attempt" cascade;`);

    this.addSql(`drop table if exists "user_notification" cascade;`);
  }

}
