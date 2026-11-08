-- SPDX-License-Identifier: Apache-2.0

-- Several roles for each account, as the Decisions Log sets out: an account holds one or more roles,
-- exactly one of them its default, and each session acts as one of them at a time. Every change set
-- records the role its maker acted as. Each account keeps the role it held, as its only role and its
-- default.

ALTER TABLE "fathom"."user_roles" DROP CONSTRAINT "user_roles_pkey";--> statement-breakpoint
ALTER TABLE "fathom"."user_roles" ADD CONSTRAINT "user_roles_user_id_role_id_pk" PRIMARY KEY("user_id","role_id");--> statement-breakpoint
ALTER TABLE "fathom"."user_roles" ADD COLUMN "is_default" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "fathom"."user_roles" SET "is_default" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "user_roles_default_index" ON "fathom"."user_roles" USING btree ("user_id") WHERE "fathom"."user_roles"."is_default";--> statement-breakpoint
ALTER TABLE "fathom"."change_sets" ADD COLUMN "made_as_role_id" uuid;--> statement-breakpoint
ALTER TABLE "fathom"."change_sets" ADD CONSTRAINT "change_sets_made_as_role_id_roles_id_fk" FOREIGN KEY ("made_as_role_id") REFERENCES "fathom"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fathom"."sessions" ADD COLUMN "active_role_id" uuid;--> statement-breakpoint
ALTER TABLE "fathom"."sessions" ADD CONSTRAINT "sessions_active_role_id_roles_id_fk" FOREIGN KEY ("active_role_id") REFERENCES "fathom"."roles"("id") ON DELETE no action ON UPDATE no action;
