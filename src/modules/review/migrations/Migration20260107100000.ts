import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260107100000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "review" ("id" text not null, "product_id" text not null, "customer_email" text null, "customer_name" text not null, "rating" integer not null, "comment" text null, "status" text check ("status" in ('pending', 'approved', 'rejected')) not null default 'pending', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "approved_at" timestamptz null, "approved_by" text null, "ip_address" text null, "deleted_at" timestamptz null, constraint "review_pkey" primary key ("id"));`);

    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_review_product_id" ON "review" ("product_id");`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_review_status" ON "review" ("status");`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_review_product_status" ON "review" ("product_id", "status");`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_review_created_at" ON "review" ("created_at" DESC);`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_review_deleted_at" ON "review" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "review" cascade;`);
  }

}