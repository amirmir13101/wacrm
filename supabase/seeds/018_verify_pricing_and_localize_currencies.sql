-- ============================================================
-- 018_verify_pricing_and_localize_currencies.sql
-- Marks imported WhatsApp pricing rates as admin verified and
-- localizes USD rows with a documented static exchange-rate map.
--
-- IMPORTANT:
-- 1. Replace YOUR_ADMIN_EMAIL@example.com with the CRM admin email.
-- 2. This updates existing rows only. It does not insert duplicates.
-- 3. Safe to rerun: rows already converted away from USD are not
--    multiplied again.
-- 4. Actual Meta billing may differ.
-- ============================================================

DO $$
DECLARE
  target_user_id UUID;
BEGIN
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = 'YOUR_ADMIN_EMAIL@example.com'
  LIMIT 1;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'No Supabase auth user found for the seed email. Replace YOUR_ADMIN_EMAIL@example.com first.';
  END IF;

  WITH currency_map(iso_country_code, local_currency, usd_to_local_rate) AS (
    VALUES
    ('PK', 'PKR', 278.500000),
    ('TR', 'TRY', 32.500000),
    ('US', 'USD', 1.000000),
    ('GB', 'GBP', 1.000000),
    ('AE', 'AED', 1.000000),
    ('IN', 'INR', 1.000000),
    ('SA', 'SAR', 1.000000),
    ('QA', 'QAR', 3.640000),
    ('OM', 'OMR', 0.385000),
    ('KW', 'KWD', 0.307000),
    ('BH', 'BHD', 0.376000),
    ('CA', 'CAD', 1.370000),
    ('AU', 'AUD', 1.520000),
    ('BR', 'BRL', 5.100000),
    ('EG', 'EGP', 47.000000),
    ('IL', 'ILS', 3.700000),
    ('NG', 'NGN', 1500.000000),
    ('ZA', 'ZAR', 18.500000),
    ('RU', 'RUB', 90.000000),
    ('DZ', 'DZD', 134.000000),
    ('AO', 'AOA', 850.000000),
    ('BJ', 'XOF', 600.000000),
    ('BW', 'BWP', 13.500000),
    ('BF', 'XOF', 600.000000),
    ('BI', 'BIF', 2850.000000),
    ('CM', 'XAF', 600.000000),
    ('TD', 'XAF', 600.000000),
    ('ER', 'ERN', 15.000000),
    ('ET', 'ETB', 56.000000),
    ('GA', 'XAF', 600.000000),
    ('GM', 'GMD', 67.000000),
    ('GH', 'GHS', 15.000000),
    ('GW', 'XOF', 600.000000),
    ('CI', 'XOF', 600.000000),
    ('KE', 'KES', 130.000000),
    ('LS', 'LSL', 18.500000),
    ('LR', 'LRD', 190.000000),
    ('LY', 'LYD', 4.800000),
    ('MG', 'MGA', 4500.000000),
    ('MW', 'MWK', 1750.000000),
    ('ML', 'XOF', 600.000000),
    ('MR', 'MRU', 39.000000),
    ('MA', 'MAD', 10.000000),
    ('MZ', 'MZN', 64.000000),
    ('NA', 'NAD', 18.500000),
    ('NE', 'XOF', 600.000000),
    ('CG', 'XAF', 600.000000),
    ('RW', 'RWF', 1300.000000),
    ('SN', 'XOF', 600.000000),
    ('SL', 'SLL', 22000.000000),
    ('SO', 'SOS', 570.000000),
    ('SS', 'SSP', 1300.000000),
    ('SD', 'SDG', 600.000000),
    ('SZ', 'SZL', 18.500000),
    ('TZ', 'TZS', 2550.000000),
    ('TG', 'XOF', 600.000000),
    ('TN', 'TND', 3.100000),
    ('UG', 'UGX', 3800.000000),
    ('ZM', 'ZMW', 25.000000),
    ('AF', 'AFN', 70.000000),
    ('BD', 'BDT', 110.000000),
    ('KH', 'KHR', 4100.000000),
    ('CN', 'CNY', 7.200000),
    ('HK', 'HKD', 7.800000),
    ('JP', 'JPY', 155.000000),
    ('LA', 'LAK', 21000.000000),
    ('MN', 'MNT', 3400.000000),
    ('NP', 'NPR', 133.000000),
    ('NZ', 'NZD', 1.650000),
    ('PG', 'PGK', 3.800000),
    ('PH', 'PHP', 56.000000),
    ('SG', 'SGD', 1.350000),
    ('LK', 'LKR', 300.000000),
    ('TW', 'TWD', 32.000000),
    ('TJ', 'TJS', 11.000000),
    ('TH', 'THB', 36.000000),
    ('TM', 'TMT', 3.500000),
    ('UZ', 'UZS', 12600.000000),
    ('VN', 'VND', 25000.000000),
    ('AL', 'ALL', 95.000000),
    ('AM', 'AMD', 390.000000),
    ('AZ', 'AZN', 1.700000),
    ('BY', 'BYN', 3.300000),
    ('BG', 'BGN', 1.800000),
    ('HR', 'EUR', 0.920000),
    ('CZ', 'CZK', 23.000000),
    ('GE', 'GEL', 2.700000),
    ('GR', 'EUR', 0.920000),
    ('HU', 'HUF', 360.000000),
    ('LV', 'EUR', 0.920000),
    ('LT', 'EUR', 0.920000),
    ('MD', 'MDL', 18.000000),
    ('MK', 'MKD', 57.000000),
    ('PL', 'PLN', 4.000000),
    ('RO', 'RON', 4.600000),
    ('RS', 'RSD', 108.000000),
    ('SK', 'EUR', 0.920000),
    ('SI', 'EUR', 0.920000),
    ('UA', 'UAH', 40.000000),
    ('BO', 'BOB', 6.900000),
    ('CR', 'CRC', 520.000000),
    ('DO', 'DOP', 59.000000),
    ('EC', 'USD', 1.000000),
    ('SV', 'USD', 1.000000),
    ('GT', 'GTQ', 7.800000),
    ('HT', 'HTG', 132.000000),
    ('HN', 'HNL', 25.000000),
    ('JM', 'JMD', 155.000000),
    ('NI', 'NIO', 36.700000),
    ('PA', 'USD', 1.000000),
    ('PY', 'PYG', 7300.000000),
    ('PR', 'USD', 1.000000),
    ('UY', 'UYU', 39.000000),
    ('VE', 'VES', 36.000000),
    ('IQ', 'IQD', 1310.000000),
    ('JO', 'JOD', 0.709000),
    ('LB', 'LBP', 89500.000000),
    ('YE', 'YER', 250.000000),
    ('AR', 'ARS', 1.000000),
    ('CL', 'CLP', 1.000000),
    ('CO', 'COP', 1.000000),
    ('FR', 'EUR', 1.000000),
    ('DE', 'EUR', 1.000000),
    ('ID', 'IDR', 1.000000),
    ('IT', 'EUR', 1.000000),
    ('MY', 'MYR', 1.000000),
    ('MX', 'MXN', 1.000000),
    ('NL', 'EUR', 1.000000),
    ('PE', 'PEN', 1.000000),
    ('ES', 'EUR', 1.000000),
    ('AT', 'EUR', 0.920000),
    ('BE', 'EUR', 0.920000),
    ('DK', 'DKK', 6.900000),
    ('FI', 'EUR', 0.920000),
    ('IE', 'EUR', 0.920000),
    ('NO', 'NOK', 10.500000),
    ('PT', 'EUR', 0.920000),
    ('SE', 'SEK', 10.500000),
    ('CH', 'CHF', 0.900000)
  )
  UPDATE whatsapp_pricing_rates AS rate
  SET
    currency = CASE
      WHEN rate.currency = 'USD' AND currency_map.local_currency IS NOT NULL THEN currency_map.local_currency
      ELSE rate.currency
    END,
    marketing_rate = CASE
      WHEN rate.currency = 'USD' AND currency_map.local_currency IS NOT NULL AND currency_map.local_currency <> 'USD'
        THEN ROUND((rate.marketing_rate * currency_map.usd_to_local_rate)::NUMERIC, 6)
      ELSE rate.marketing_rate
    END,
    utility_rate = CASE
      WHEN rate.currency = 'USD' AND currency_map.local_currency IS NOT NULL AND currency_map.local_currency <> 'USD'
        THEN ROUND((rate.utility_rate * currency_map.usd_to_local_rate)::NUMERIC, 6)
      ELSE rate.utility_rate
    END,
    authentication_rate = CASE
      WHEN rate.currency = 'USD' AND currency_map.local_currency IS NOT NULL AND currency_map.local_currency <> 'USD'
        THEN ROUND((rate.authentication_rate * currency_map.usd_to_local_rate)::NUMERIC, 6)
      ELSE rate.authentication_rate
    END,
    service_rate = CASE
      WHEN rate.currency = 'USD' AND currency_map.local_currency IS NOT NULL AND currency_map.local_currency <> 'USD'
        THEN ROUND((rate.service_rate * currency_map.usd_to_local_rate)::NUMERIC, 6)
      ELSE rate.service_rate
    END,
    source_note = 'Admin verified against official WhatsApp Business Platform pricing calculator estimates.',
    official_rate_source_url = 'https://whatsappbusiness.com/products/platform-pricing/',
    last_verified_at = DATE '2026-05-24',
    verified_by_admin = TRUE,
    notes = CASE
      WHEN rate.currency = 'USD' AND currency_map.local_currency IS NOT NULL AND currency_map.local_currency <> 'USD'
        THEN 'Admin verified estimate. Converted from USD estimate using admin-maintained exchange rate. Actual Meta billing currency/rate may differ; verify important campaigns with the official WhatsApp calculator.'
      WHEN rate.currency = 'USD' AND (currency_map.local_currency IS NULL OR currency_map.local_currency = 'USD')
        THEN 'Admin verified estimate. Local currency not configured or USD is the local pricing currency; USD retained. Actual Meta billing may differ; verify important campaigns with the official WhatsApp calculator.'
      ELSE 'Admin verified estimate. Actual Meta billing may differ; verify important campaigns with the official WhatsApp calculator.'
    END,
    updated_at = NOW()
  FROM currency_map
  WHERE rate.user_id = target_user_id
    AND rate.iso_country_code = currency_map.iso_country_code;

  UPDATE whatsapp_pricing_rates AS rate
  SET
    source_note = 'Admin verified against official WhatsApp Business Platform pricing calculator estimates.',
    official_rate_source_url = 'https://whatsappbusiness.com/products/platform-pricing/',
    last_verified_at = DATE '2026-05-24',
    verified_by_admin = TRUE,
    notes = 'Admin verified estimate. Local currency not configured or USD is the local pricing currency; USD retained. Actual Meta billing may differ; verify important campaigns with the official WhatsApp calculator.',
    updated_at = NOW()
  WHERE rate.user_id = target_user_id
    AND NOT EXISTS (
      SELECT 1 FROM currency_map
      WHERE currency_map.iso_country_code = rate.iso_country_code
    );
END $$;

