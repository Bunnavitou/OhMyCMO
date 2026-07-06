// Image references.
//
// Images used to be stored inline as base64 data URLs on the entity row
// (e.g. partner.cardImage = { name, type, size, dataUrl }). That made list
// payloads enormous and slowed the dashboard. Images now live in the File
// store; the row holds only a lightweight reference:
//
//   { fileId, name, type, size }
//
// `dataUrl` may still appear on a freshly-picked-but-not-yet-saved value, and
// on any legacy row that predates the migration — display code tolerates both.

import { upload } from '../api/client.js'
import { compressImage } from './imageCompress.js'

// Does this value carry a displayable image (either shape)?
export const hasImage = (v) => !!(v && (v.fileId || v.dataUrl))

// The authenticated bytes URL for a stored file reference.
export const fileContentPath = (fileId) => `/files/${fileId}/content`

// Compress an image File, upload it to the File store, and return a reference
// suitable for storing on an entity. Returns null for a falsy input.
export async function uploadImageRef(file, options = {}) {
  const { maxDim, quality, entityType, entityId } = options
  const compressed = await compressImage(file, { maxDim, quality })
  if (!compressed) return null

  // compressImage gives us a data URL; turn it back into bytes for upload.
  const blob = await (await fetch(compressed.dataUrl)).blob()
  const fd = new FormData()
  fd.append('file', blob, compressed.name || 'image.jpg')
  if (entityType) fd.append('entityType', entityType)
  if (entityId) fd.append('entityId', entityId)

  const res = await upload('/files', fd)
  const f = res.data.file
  return { fileId: f.id, name: f.name, type: f.mimeType || f.type, size: f.size }
}

// Normalise an image value to a stored reference at a save boundary.
// - already a { fileId } ref (or null/undefined) → returned unchanged
// - a { dataUrl } value (fresh pick, scanner output, legacy) → its bytes are
//   uploaded to the File store and a { fileId } reference is returned
// Use this just before persisting an entity so base64 never reaches the DB.
export async function persistImageRef(value, options = {}) {
  if (!value || value.fileId || !value.dataUrl) return value
  const { entityType, entityId } = options
  const blob = await (await fetch(value.dataUrl)).blob()
  const fd = new FormData()
  fd.append('file', blob, value.name || 'image.jpg')
  if (entityType) fd.append('entityType', entityType)
  if (entityId) fd.append('entityId', entityId)
  const res = await upload('/files', fd)
  const f = res.data.file
  return { fileId: f.id, name: f.name, type: f.mimeType || f.type, size: f.size }
}
