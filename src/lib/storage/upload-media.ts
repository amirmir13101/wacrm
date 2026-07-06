import { createClient } from '@/lib/supabase/client'

export const MEDIA_MAX_BYTES = 16 * 1024 * 1024

export const MEDIA_MAX_BYTES_BY_KIND = {
  image: 5 * 1024 * 1024,
  video: 16 * 1024 * 1024,
  audio: 16 * 1024 * 1024,
  document: 16 * 1024 * 1024,
} as const

export function buildMediaPath(
  workspaceId: string,
  fileName: string,
  now: number = Date.now(),
): string {
  const hasExt = /\.[^.]+$/.test(fileName)
  const ext = hasExt ? fileName.split('.').pop()!.toLowerCase() : 'bin'
  const safeBase =
    fileName
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .slice(0, 40) || 'file'
  return `workspace-${workspaceId}/${now}-${safeBase}.${ext}`
}

export interface UploadAccountMediaResult {
  publicUrl: string
  path: string
}

/**
 * Compatibility helper for upstream Flow/Templates UI.
 *
 * The upstream project calls this "account" media. In this CRM it is scoped
 * to the user's active workspace so it fits the existing workspace tenancy
 * model without changing unrelated storage/auth code.
 */
export async function uploadAccountMedia(
  bucket: string,
  file: File,
): Promise<UploadAccountMediaResult> {
  const supabase = createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError || !user) throw new Error('Not signed in.')

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('active_workspace_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (profileError || !profile?.active_workspace_id) {
    throw new Error('Could not resolve your active workspace.')
  }

  const path = buildMediaPath(String(profile.active_workspace_id), file.name)
  const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  })
  if (uploadError) throw new Error(uploadError.message)

  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(path)

  return { publicUrl, path }
}

export async function deleteAccountMedia(bucket: string, path: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.storage.from(bucket).remove([path])
  if (error) throw new Error(error.message)
}
