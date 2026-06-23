/**
 * Legacy PM2 worker placeholder.
 *
 * The website-import scheduler was removed from the CRM feature set.
 * Keep this process alive for now so existing PM2 deployments that still
 * restart `wacrm-scheduler` do not fail. Removing the PM2 process itself is a
 * separate operations change and should be done only after approval.
 */

console.info('[wacrm-scheduler] no scheduled CRM worker is configured')

setInterval(() => {
  // Intentionally idle.
}, 60_000)
