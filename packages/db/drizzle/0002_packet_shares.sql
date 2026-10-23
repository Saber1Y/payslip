CREATE TABLE "shares" (
	"id" serial PRIMARY KEY NOT NULL,
	"employment_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"label" text NOT NULL,
	"packet" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "shares_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "shares" ADD CONSTRAINT "shares_employment_id_employments_id_fk" FOREIGN KEY ("employment_id") REFERENCES "public"."employments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shares_employment" ON "shares" USING btree ("employment_id");