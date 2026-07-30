import { Migration } from '@mikro-orm/migrations';

export class Migration20260729042547 extends Migration {
	override async up(): Promise<void> {
		this.addSql(
			`alter table "puzzle" drop column "popularity", drop column "nb_plays", drop column "game_url";`,
		);
	}

	override async down(): Promise<void> {
		this.addSql(
			`alter table "puzzle" add column "popularity" int4 not null, add column "nb_plays" int4 not null, add column "game_url" text not null;`,
		);
	}
}
