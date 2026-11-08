/**
 * DuitKu: robot pembaca email transaksi (Google Apps Script).
 * Berjalan di akun Google-mu sendiri, tiap 15 menit:
 *   1. Cari email baru dari BSI & GoPay
 *   2. Ambil nominal, nama penerima/merchant, tanggal (pakai pola teks / regex, TANPA AI)
 *   3. Tulis ke Sheet ini, lalu beri label "duitku-imported" di Gmail
 * App DuitKu menarik baris baru lewat doGet() dengan token rahasia.
 *
 * ⚠️ Pola regex di bawah masih UMUM. Setelah kamu kirim contoh email asli BSI & GoPay,
 *    pola di PARSERS akan dibuat spesifik supaya hasilnya akurat.
 */

// Pengirim email. Sesuaikan setelah melihat contoh email asli.
const SOURCES = [
  { account: 'BSI', query: 'from:(bankbsi.co.id)' },
  { account: 'GoPay', query: 'from:(gojek.com OR gopay.co.id)' }
];

const LABEL = 'duitku-imported';
const LOOKBACK = 'newer_than:30d';
const HEADERS = ['id', 'messageId', 'account', 'direction', 'amount', 'counterparty', 'date', 'subject', 'snippet'];

/** Jalankan SEKALI secara manual: membuat token, header Sheet, dan jadwal 15 menit. */
function setup() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('TOKEN')) props.setProperty('TOKEN', Utilities.getUuid().replace(/-/g, ''));
  const sheet = getSheet_();
  if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('scanEmails').timeBased().everyMinutes(15).create();
  scanEmails();
  Logger.log('TOKEN kamu (salin ke app DuitKu → Pengaturan → Gmail): ' + props.getProperty('TOKEN'));
}

/** Dipanggil otomatis tiap 15 menit. */
function scanEmails() {
  const sheet = getSheet_();
  const label = GmailApp.getUserLabelByName(LABEL) || GmailApp.createLabel(LABEL);
  let nextId = Math.max(1, sheet.getLastRow());
  const known = new Set(sheet.getLastRow() > 1 ? sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).getValues().map((r) => r[0]) : []);

  SOURCES.forEach((src) => {
    const threads = GmailApp.search(src.query + ' ' + LOOKBACK + ' -label:' + LABEL, 0, 50);
    threads.forEach((thread) => {
      thread.getMessages().forEach((msg) => {
        const id = msg.getId();
        if (known.has(id)) return;
        const parsed = parseMessage_(src.account, msg);
        if (parsed) {
          sheet.appendRow([nextId++, id, src.account, parsed.direction, parsed.amount, parsed.counterparty,
            msg.getDate().toISOString(), msg.getSubject(), msg.getPlainBody().slice(0, 300)]);
          known.add(id);
        }
      });
      thread.addLabel(label);
    });
  });
}

/** Endpoint untuk app: ?token=...&since=<id terakhir> */
function doGet(e) {
  const token = PropertiesService.getScriptProperties().getProperty('TOKEN');
  if (!e || !e.parameter || e.parameter.token !== token) return json_({ ok: false, error: 'Token salah' });
  const since = Number(e.parameter.since || 0);
  const sheet = getSheet_();
  const last = sheet.getLastRow();
  const rows = last > 1 ? sheet.getRange(2, 1, last - 1, 7).getValues() : [];
  const out = rows
    .filter((r) => Number(r[0]) > since && Number(r[4]) > 0)
    .map((r) => ({ id: Number(r[0]), messageId: String(r[1]), account: String(r[2]), direction: String(r[3]), amount: Number(r[4]), counterparty: String(r[5]), date: r[6] instanceof Date ? r[6].toISOString() : String(r[6]) }));
  return json_({ ok: true, rows: out });
}

/* ---------------- Parser (pola teks) ---------------- */

const PARSERS = {
  // Contoh pola khusus nanti diisi di sini, mis.:
  // BSI: (subject, body) => { const m = body.match(/Nominal\s*:?\s*Rp\s*([\d.,]+)/i); ... }
};

function parseMessage_(account, msg) {
  const subject = msg.getSubject() || '';
  const body = (msg.getPlainBody() || '').replace(/\s+/g, ' ');
  if (PARSERS[account]) {
    const r = PARSERS[account](subject, body);
    if (r) return r;
  }
  return genericParse_(subject, body);
}

function genericParse_(subject, body) {
  const text = subject + ' | ' + body;
  // nominal: ambil "Rp" pertama yang wajar
  const amtMatch = text.match(/(?:Rp\.?|IDR)\s?([\d.,]+)/i);
  const amount = amtMatch ? parseIdr_(amtMatch[1]) : 0;
  if (!amount) return null;

  const incoming = /(dana masuk|uang masuk|diterima|kredit|transfer dari|incoming|menerima)/i.test(text);
  const cpMatch =
    text.match(/(?:merchant|penerima|tujuan|nama toko|kepada|ke)\s*:?\s*([A-Za-z0-9 .&'\-]{3,40}?)(?=\s{2}|\s(?:pada|tanggal|sebesar|nominal|rp|no\.|ref)|[|,]|$)/i) ||
    text.match(/(?:dari|pengirim)\s*:?\s*([A-Za-z0-9 .&'\-]{3,40}?)(?=\s{2}|\s(?:pada|tanggal|sebesar|nominal|rp)|[|,]|$)/i);
  return {
    direction: incoming ? 'in' : 'out',
    amount: amount,
    counterparty: cpMatch ? cpMatch[1].trim().toUpperCase() : subject.slice(0, 40)
  };
}

/** "45.000,00" / "45,000.00" / "45000" -> 45000 */
function parseIdr_(s) {
  s = String(s).trim();
  if (/[.,]\d{2}$/.test(s) && /[.,].*[.,]/.test(s)) s = s.slice(0, -3);
  else if (/,\d{2}$/.test(s)) s = s.slice(0, -3);
  const digits = s.replace(/[^\d]/g, '');
  return digits ? Number(digits) : 0;
}

/* ---------------- Utilitas ---------------- */

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName('Transaksi') || ss.insertSheet('Transaksi');
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
