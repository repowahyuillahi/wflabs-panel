# WFLabs 9Router Monitoring & Admin Panel

Dashboard kontrol, monitoring, dan manajemen akun untuk **9Router** (AI Gateway).

---

## ⚠️ Prasyarat Sistem

1. **Node.js >= 22.5.0**  
   Backend menggunakan modul native `node:sqlite` (`DatabaseSync`), tidak kompatibel dengan Node.js versi di bawah 22.5.
2. **9Router Gateway**  
   Server membaca database lokal di:
   * Windows: `%APPDATA%\9router\db\data.sqlite`
   * Port default gateway: `http://127.0.0.1:20128`

---

## 🚀 Cara Menjalankan

### 1. Persiapan Frontend (Admin Panel React)
```bash
cd admin-panel
npm install
npm run build
cd ..
```

### 2. Jalankan Server Panel
```bash
# Menggunakan npm
npm start

# Atau langsung via Node
node server.js

# Atau via shortcut launcher (Windows)
start-panel.bat
```

Akses di browser:
* **Admin Terminal:** `http://127.0.0.1:20110`
* **Member Portal:** `http://127.0.0.1:20110/member`
* **Monitoring Gateway:** `http://127.0.0.1:20128`

---

## 🛠️ Mode Development

### Backend Auto-Reload
```bash
node --watch server.js
```

### Frontend Dev Server (HMR)
```bash
npm run dev:admin
# Berjalan di http://localhost:5173
```

---

## 🧪 Self-Check & Verifikasi Database
Untuk mengecek apakah database 9Router lokal terbaca dengan benar:
```bash
npm test
```

---

## 📌 Catatan Pengerjaan Lanjutan (TODO di Rumah)
* [ ] **Pemisahan Database:** Buat database independen (`panel.sqlite`) untuk data panel (CDKey, kuota member, pricing, user admin) agar terpisah dari database internal 9Router (`data.sqlite`).
* [ ] **Autentikasi Admin:** Pasang middleware auth/token pada endpoint `/api/*` untuk keamanan saat diakses remote.
