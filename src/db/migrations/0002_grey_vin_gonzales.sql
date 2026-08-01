CREATE TABLE "writing_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"parent_id" uuid,
	"title" varchar(255) NOT NULL,
	"kind" varchar(50) DEFAULT 'chapter' NOT NULL,
	"status" varchar(50) DEFAULT 'outline' NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"word_target" integer,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "writing_documents" ADD CONSTRAINT "writing_documents_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;