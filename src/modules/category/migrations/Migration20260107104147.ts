import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260107104147 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "category" ("id" text not null, "name" text not null, "slug" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "category_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_category_deleted_at" ON "category" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "category" cascade;`);
  }

}
