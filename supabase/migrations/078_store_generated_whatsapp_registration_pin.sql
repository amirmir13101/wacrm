-- 078_store_generated_whatsapp_registration_pin.sql
--
-- Meta requires a six-digit two-step verification PIN when a phone number is
-- registered for Cloud API. Embedded Signup now generates that PIN on the
-- server so customers do not need to enter it during onboarding. Only the
-- authenticated ciphertext is retained; plaintext is never stored.

ALTER TABLE public.whatsapp_config
  ADD COLUMN IF NOT EXISTS two_step_pin_encrypted TEXT;

COMMENT ON COLUMN public.whatsapp_config.two_step_pin_encrypted IS
  'AES-GCM encrypted Meta WhatsApp Cloud API registration PIN. Never expose to clients.';
