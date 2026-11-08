# Menyambungkan Gmail ke DuitKu (gratis, tanpa AI)

Robot kecil ini berjalan di **akun Google kamu sendiri**. Tiap 15 menit ia membaca email transaksi dari BSI & GoPay, mengambil nominal dan nama penerima, lalu menaruhnya di Google Sheet. App DuitKu menarik data dari situ saat dibuka.

> Status: pola pembaca email masih **umum**. Kirim 1–2 contoh email asli per jenis (BSI keluar, BSI masuk, GoPay bayar, GoPay top-up; nominal boleh disensor) supaya polanya dibuat akurat.

## Langkah setup (±10 menit, sekali saja)

1. Buka **sheets.google.com**, lalu buat spreadsheet kosong. Beri nama `DuitKu Inbox`.
2. Di menu atas: **Extensions → Apps Script**.
3. Hapus isi editor, lalu **tempel seluruh isi file `Code.gs`** dari folder ini. Klik ikon 💾 (Save).
4. Di dropdown fungsi (sebelah tombol Run), pilih **`setup`**, lalu klik **Run**.
   - Google akan minta izin: **Review permissions** → pilih akunmu → muncul "Google hasn't verified this app" → **Advanced** → **Go to … (unsafe)** → **Allow**.
     *Ini normal karena script-nya buatanmu sendiri dan hanya berjalan di akunmu.*
5. Buka **View → Logs** (atau **Execution log**). Salin **TOKEN** yang tertulis di sana.
6. Klik **Deploy → New deployment** → ikon ⚙️ → **Web app**.
   - *Execute as*: **Me**
   - *Who has access*: **Anyone**
   - Klik **Deploy**, lalu salin **Web app URL** (diawali `https://script.google.com/macros/s/...`).
7. Di app DuitKu: **⚙️ Pengaturan → Impor otomatis dari Gmail**. Tempel **URL** dan **TOKEN**, lalu ketuk **Simpan & tes**.

Selesai. Transaksi baru akan muncul di **Inbox** setiap kali app dibuka.

## Keamanan
- Data transaksi hanya mengalir dari Gmail-mu → Sheet-mu → HP-mu. Tidak ada server lain.
- URL web app tidak berguna tanpa TOKEN. **Jangan bagikan TOKEN.** Kalau bocor, hapus `TOKEN` di *Project Settings → Script Properties*, lalu jalankan `setup` lagi untuk membuat token baru.

## Untuk teman yang mau ikut pakai
Setiap orang mengulang langkah di atas di akun Google masing-masing. Data tiap orang tetap terpisah.
