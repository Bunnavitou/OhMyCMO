// Best-effort name-card field extraction from raw OCR text.
// Real cards vary wildly; treat the result as a starting point for the user.

const COMPANY_KEYWORDS =
  /\b(inc|ltd|llc|co\.?|corp|corporation|company|group|studio|agency|solutions|partners?|holdings?|enterprises?)\b/i

const ROLE_KEYWORDS =
  /\b(ceo|cfo|cmo|cto|coo|chief|president|vp|vice president|director|manager|engineer|designer|founder|head of|lead|principal|consultant|analyst|architect|developer|specialist|coordinator|executive|officer|associate)\b/i

const ADDRESS_HINTS =
  /\b(st\.?|street|ave|avenue|road|rd\.?|blvd|building|floor|suite|#\d|p\.?o\.?\s*box|district|city|country)\b/i

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s,]+|\b[a-z0-9-]+\.(com|net|io|co|kh|asia|org)\b/gi
const PHONE_RE = /(?:\+?\d[\d\s().-]{6,}\d)/g

export function extractCardFields(rawText) {
  const text = rawText || ''
  const fields = {
    name: '',
    role: '',
    company: '',
    email: '',
    phone: '',
    rawText: text,
  }

  const emailMatch = text.match(EMAIL_RE)
  if (emailMatch) fields.email = emailMatch[0].trim()

  const phoneCandidates = (text.match(PHONE_RE) || [])
    .map((p) => p.trim())
    .filter((p) => p.replace(/\D/g, '').length >= 8)
  if (phoneCandidates.length) fields.phone = phoneCandidates[0]

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  // Lines that aren't email/phone/website/address noise are candidates for name/role/company
  const wordy = lines.filter((l) => {
    if (EMAIL_RE.test(l)) return false
    if (URL_RE.test(l)) return false
    if (ADDRESS_HINTS.test(l)) return false
    // Strip line if mostly digits (likely phone or fax)
    const digitRatio = (l.match(/\d/g) || []).length / l.length
    if (digitRatio > 0.5) return false
    return true
  })

  // Reset regex state (since we used .test on global regex above)
  EMAIL_RE.lastIndex = 0
  URL_RE.lastIndex = 0

  const roleLine = wordy.find((l) => ROLE_KEYWORDS.test(l))
  const companyLine = wordy.find((l) => COMPANY_KEYWORDS.test(l) && l !== roleLine)

  if (roleLine) fields.role = roleLine
  if (companyLine) fields.company = companyLine

  // Name = first non-role / non-company wordy line
  const nameLine = wordy.find((l) => l !== roleLine && l !== companyLine)
  if (nameLine) fields.name = nameLine

  return fields
}

export async function scanCard(file) {
  const { default: Tesseract } = await import('tesseract.js')
  const result = await Tesseract.recognize(file, 'eng')
  const rawText = result?.data?.text || ''
  return { ...extractCardFields(rawText), rawText }
}
