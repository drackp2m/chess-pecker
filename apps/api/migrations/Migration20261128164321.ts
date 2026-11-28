import { Migration } from '@mikro-orm/migrations';

export class Migration20261128164321 extends Migration {

  override name = 'Migration20261128164321';

  override up(): void | Promise<void> {
    this.addSql(`alter table "user" add "avatar_piece" text null, add "avatar_color" text null, add "avatar_background" text null;`);
    this.addSql(`alter table "user" add constraint "user_avatar_piece_check" check ("avatar_piece" in ('pawn', 'knight', 'bishop', 'rook', 'queen', 'king'));`);
    this.addSql(`alter table "user" add constraint "user_avatar_color_check" check ("avatar_color" in ('red', 'orange', 'yellow', 'lime', 'green', 'teal', 'sky', 'blue', 'violet', 'pink', 'brown', 'slate', 'ivory', 'ink'));`);
    this.addSql(`alter table "user" add constraint "user_avatar_background_check" check ("avatar_background" in ('red', 'orange', 'yellow', 'lime', 'green', 'teal', 'sky', 'blue', 'violet', 'pink', 'brown', 'slate', 'ivory', 'ink'));`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "user" drop constraint "user_avatar_piece_check";`);
    this.addSql(`alter table "user" drop constraint "user_avatar_color_check";`);
    this.addSql(`alter table "user" drop constraint "user_avatar_background_check";`);
    this.addSql(`alter table "user" drop column "avatar_piece", drop column "avatar_color", drop column "avatar_background";`);
  }

}
