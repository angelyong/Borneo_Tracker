ALTER TABLE "users"
  ADD CONSTRAINT "users_active_requires_verified_email"
    CHECK ("status" <> 'ACTIVE' OR "email_verified_at" IS NOT NULL),
  ADD CONSTRAINT "users_pending_cannot_be_verified"
    CHECK ("status" <> 'PENDING' OR "email_verified_at" IS NULL),
  ADD CONSTRAINT "users_auth_version_positive"
    CHECK ("auth_version" > 0);

ALTER TABLE "user_profiles"
  ADD CONSTRAINT "user_profiles_version_positive" CHECK ("version" > 0);

ALTER TABLE "email_outbox"
  ADD CONSTRAINT "email_outbox_attempt_count_nonnegative" CHECK ("attempt_count" >= 0);
