/**
 * Job Scout — Gmail sender (Google Apps Script)
 *
 * Setup:
 * 1. https://script.google.com → New project → paste this file
 * 2. Project Settings → Script properties → Add:
 *      SECRET = <same value as Cloudflare CRON_SECRET or GMAIL_APPS_SCRIPT_SECRET>
 * 3. Deploy → New deployment → Type: Web app
 *      - Execute as: Me
 *      - Who has access: Anyone
 * 4. Copy the Web app URL → Cloudflare env GMAIL_APPS_SCRIPT_URL
 *
 * Cloudflare POST body: { secret, to, subject, html }
 */

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents || '{}')
    const expected = PropertiesService.getScriptProperties().getProperty('SECRET') || ''
    if (!expected || data.secret !== expected) {
      return json_({ ok: false, error: 'Unauthorized' })
    }
    const to = String(data.to || '').trim()
    const subject = String(data.subject || 'Job Scout digest').trim()
    const html = String(data.html || '').trim()
    if (!to || !html) {
      return json_({ ok: false, error: 'Missing to or html' })
    }
    MailApp.sendEmail({
      to: to,
      subject: subject,
      htmlBody: html,
      name: 'Job Scout',
    })
    return json_({ ok: true })
  } catch (err) {
    return json_({ ok: false, error: String(err) })
  }
}

function doGet() {
  return ContentService.createTextOutput(
    'Job Scout Gmail bridge is running. Use POST from Cloudflare.',
  )
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  )
}
