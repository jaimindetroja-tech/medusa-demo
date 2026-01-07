import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260107183446 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "review" ("id" text not null, "product_id" text not null, "customer_email" text null, "customer_name" text not null, "rating" integer not null, "comment" text null, "status" text check ("status" in ('pending', 'approved', 'rejected')) not null, "approved_at" timestamptz null, "approved_by" text null, "ip_address" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "review_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_review_deleted_at" ON "review" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "review" cascade;`);
  }

}
