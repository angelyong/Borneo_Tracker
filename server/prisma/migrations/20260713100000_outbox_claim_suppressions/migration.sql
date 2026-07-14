ALTER TABLE "email_outbox" ADD COLUMN "claim_id" UUID;
CREATE INDEX "email_outbox_claim_idx" ON "email_outbox"("claim_id");

CREATE TABLE "email_suppressions" (
  "id" UUID NOT NULL,
  "recipient_lookup_hmac" CHAR(64) NOT NULL,
  "encrypted_recipient" TEXT NOT NULL,
  "key_version" VARCHAR(20) NOT NULL,
  "reason" VARCHAR(80) NOT NULL,
  "source" VARCHAR(80) NOT NULL,
  "provider_event_id" VARCHAR(255) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "cleared_at" TIMESTAMPTZ(3),
  CONSTRAINT "email_suppressions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "email_suppressions_recipient_lookup_key" ON "email_suppressions"("recipient_lookup_hmac");
CREATE UNIQUE INDEX "email_suppressions_provider_event_key" ON "email_suppressions"("provider_event_id");
CREATE INDEX "email_suppressions_active_idx" ON "email_suppressions"("recipient_lookup_hmac", "cleared_at");
