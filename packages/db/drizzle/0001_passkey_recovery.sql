CREATE TABLE "recovery_challenges" (
	"id" text PRIMARY KEY NOT NULL,
	"challenge" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "employments_worker_credential" ON "employments" USING btree (("worker_key"->>'credentialId'));--> statement-breakpoint
CREATE INDEX "employments_employer_credential" ON "employments" USING btree (("employer_key"->>'credentialId'));