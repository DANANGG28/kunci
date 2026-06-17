ALTER TABLE "leads" ADD COLUMN "segment" text DEFAULT 'enterprise' NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "source" text;