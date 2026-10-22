CREATE TABLE "employments" (
	"id" text PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"employer_name" text NOT NULL,
	"worker_name" text NOT NULL,
	"declared_salary_cents" integer NOT NULL,
	"rest_day_weekday" integer NOT NULL,
	"start_period" text NOT NULL,
	"rp" jsonb NOT NULL,
	"employer_key" jsonb NOT NULL,
	"worker_key" jsonb,
	"salt" text NOT NULL,
	"employment" jsonb,
	"employment_hash" text,
	"employer_token_hash" text NOT NULL,
	"worker_token_hash" text NOT NULL,
	"worker_invite_token" text,
	"open_tx" text,
	"anchor_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"opened_at" timestamp with time zone,
	CONSTRAINT "employments_employer_token_hash_unique" UNIQUE("employer_token_hash"),
	CONSTRAINT "employments_worker_token_hash_unique" UNIQUE("worker_token_hash")
);
--> statement-breakpoint
CREATE TABLE "records" (
	"id" serial PRIMARY KEY NOT NULL,
	"employment_id" text NOT NULL,
	"period" text NOT NULL,
	"record" jsonb NOT NULL,
	"record_hash" text NOT NULL,
	"employer_signature" jsonb NOT NULL,
	"proposal_tx" text,
	"decision" jsonb,
	"decision_hash" text,
	"worker_signature" jsonb,
	"decision_tx" text,
	"anchor_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "records_employment_id_employments_id_fk" FOREIGN KEY ("employment_id") REFERENCES "public"."employments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "records_employment_period" ON "records" USING btree ("employment_id","period");