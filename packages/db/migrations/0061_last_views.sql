-- SPDX-License-Identifier: Apache-2.0

-- The view each account last showed on each page with a Views menu, shown again when the page opens
-- with no view in its address. It goes with the account, and loses the saved view it started from
-- when that view is deleted.

CREATE TABLE "fathom"."last_views" (
	"user_id" text NOT NULL,
	"page" text NOT NULL,
	"table_name" text NOT NULL,
	"definition" jsonb NOT NULL,
	"saved_view_id" uuid,
	"mode" text,
	CONSTRAINT "last_views_user_id_page_pk" PRIMARY KEY("user_id","page")
);
--> statement-breakpoint
ALTER TABLE "fathom"."last_views" ADD CONSTRAINT "last_views_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "fathom"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fathom"."last_views" ADD CONSTRAINT "last_views_saved_view_id_saved_views_id_fk" FOREIGN KEY ("saved_view_id") REFERENCES "fathom"."saved_views"("id") ON DELETE set null ON UPDATE no action;