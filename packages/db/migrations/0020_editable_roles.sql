-- SPDX-License-Identifier: Apache-2.0

-- Makes roles editable: each role becomes a row with the permissions it grants, starting with the
-- roles that were fixed in the server's code, and accounts hold roles by reference instead of by name.

CREATE TABLE "fathom"."role_permissions" (
	"role_id" uuid NOT NULL,
	"permission" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_permissions_role_id_permission_pk" PRIMARY KEY("role_id","permission")
);
--> statement-breakpoint
CREATE TABLE "fathom"."roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "fathom"."user_roles" ADD COLUMN "role_id" uuid;--> statement-breakpoint
ALTER TABLE "fathom"."role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "fathom"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "roles_name_index" ON "fathom"."roles" USING btree (lower("name"));--> statement-breakpoint
ALTER TABLE "fathom"."user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "fathom"."roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
-- The roles Fathom starts with, granting exactly what they granted when fixed in the server's code,
-- so nobody's access changes.
INSERT INTO "fathom"."roles" ("key", "name", "description") VALUES
  ('viewer', 'Viewer', 'Sees the plan, including everyone''s work assignments.'),
  ('project-planner', 'Project Planner', 'Edits projects, proposals, features, milestones, releases, products, customers, and estimates across the whole plan.'),
  ('resource-planner', 'Resource Planner', 'Sees people''s General details, and edits allocations across the whole plan.'),
  ('people-manager', 'People Manager', 'Proposes feature teams, and sees people, with Personal details for everyone.'),
  ('workforce-administrator', 'Workforce Administrator', 'Maintains people, teams, reporting lines, feature teams, the hiring plan, and planning configuration, and sees all Personal and Confidential data.'),
  ('leadership', 'Leadership', 'Sees people, with their Personal and Confidential data, without editing it.'),
  ('approver', 'Approver', 'Approves or rejects drafts of the data their roles let them see.'),
  ('administrator', 'Administrator', 'Manages user accounts, role assignments, and system settings, without access to Personal or Confidential data.');--> statement-breakpoint
INSERT INTO "fathom"."role_permissions" ("role_id", "permission")
SELECT r."id", g."permission" FROM "fathom"."roles" r JOIN (VALUES
  ('viewer', 'plan:view'),
  ('viewer', 'allocations:view'),
  ('viewer', 'changes:view'),
  ('project-planner', 'plan:edit'),
  ('project-planner', 'drafts:submit'),
  ('project-planner', 'changes:view'),
  ('resource-planner', 'people:view'),
  ('resource-planner', 'allocations:edit'),
  ('resource-planner', 'drafts:submit'),
  ('resource-planner', 'changes:view'),
  ('people-manager', 'people:view'),
  ('people-manager', 'feature-teams:propose'),
  ('people-manager', 'feature-teams:edit'),
  ('people-manager', 'personal:view'),
  ('people-manager', 'changes:view'),
  ('workforce-administrator', 'people:edit'),
  ('workforce-administrator', 'feature-teams:edit'),
  ('workforce-administrator', 'personal:edit'),
  ('workforce-administrator', 'confidential:edit'),
  ('workforce-administrator', 'configuration:edit'),
  ('workforce-administrator', 'changes:view'),
  ('leadership', 'people:view'),
  ('leadership', 'personal:view'),
  ('leadership', 'confidential:view'),
  ('leadership', 'changes:view'),
  ('approver', 'drafts:approve'),
  ('approver', 'feature-teams:approve'),
  ('approver', 'configuration:view'),
  ('approver', 'changes:view'),
  ('administrator', 'accounts:manage'),
  ('administrator', 'history:view')
) AS g ("key", "permission") ON g."key" = r."key";--> statement-breakpoint
UPDATE "fathom"."user_roles" ur SET "role_id" = r."id" FROM "fathom"."roles" r WHERE r."key" = ur."role";--> statement-breakpoint
-- A role name the server no longer knew granted nothing, so dropping it changes nobody's access.
DELETE FROM "fathom"."user_roles" WHERE "role_id" IS NULL;--> statement-breakpoint
ALTER TABLE "fathom"."user_roles" DROP CONSTRAINT "user_roles_user_id_role_pk";--> statement-breakpoint
ALTER TABLE "fathom"."user_roles" ALTER COLUMN "role_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "fathom"."user_roles" ADD CONSTRAINT "user_roles_user_id_role_id_pk" PRIMARY KEY("user_id","role_id");--> statement-breakpoint
CREATE INDEX "user_roles_role_id_index" ON "fathom"."user_roles" USING btree ("role_id");--> statement-breakpoint
ALTER TABLE "fathom"."user_roles" DROP COLUMN "role";--> statement-breakpoint
-- Until roles' permissions are read from here, a starting role's key alone decides what it grants,
-- so the application may rename and describe roles but never change a key. A role it adds cannot
-- take a starting role's key, which is unique, and any other key grants nothing.
REVOKE UPDATE ON "fathom"."roles" FROM fathom_app;--> statement-breakpoint
GRANT UPDATE ("name", "description", "updated_at") ON "fathom"."roles" TO fathom_app;
