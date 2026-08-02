CREATE TABLE "idempotency_keys" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "user_id" uuid NOT NULL,
  "route" varchar(255) NOT NULL,
  "key_hash" varchar(64) NOT NULL,
  "request_hash" varchar(64) NOT NULL,
  "state" varchar(20) DEFAULT 'processing' NOT NULL,
  "response_status" integer,
  "response_body" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idempotency_keys_expires_at_idx" ON "idempotency_keys" USING btree ("expires_at");
--> statement-breakpoint
CREATE INDEX "idempotency_keys_user_route_idx" ON "idempotency_keys" USING btree ("user_id", "route");
--> statement-breakpoint
CREATE TABLE "data_lifecycle_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "actor_user_id" uuid NOT NULL,
  "subject_user_id" uuid NOT NULL,
  "project_id" uuid,
  "operation" varchar(50) NOT NULL,
  "status" varchar(30) NOT NULL,
  "details" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "data_lifecycle_events_actor_idx" ON "data_lifecycle_events" USING btree ("actor_user_id", "created_at");
--> statement-breakpoint
CREATE INDEX "data_lifecycle_events_project_idx" ON "data_lifecycle_events" USING btree ("project_id", "created_at");
