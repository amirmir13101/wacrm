export function isAutomationCronSecretValid(
  expected: string | undefined,
  supplied: string | null,
): boolean {
  return Boolean(expected) && supplied === expected
}
