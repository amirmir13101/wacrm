export interface AutomationSendContact {
  opted_in?: boolean | null
  opted_out?: boolean | null
  is_opted_in?: boolean | null
  is_opted_out?: boolean | null
  unsubscribed?: boolean | null
}

export function automationSendSkipReason(contact: AutomationSendContact): string | null {
  if (contact.opted_out || contact.is_opted_out || contact.unsubscribed) {
    return 'contact is opted out or unsubscribed'
  }
  return null
}
