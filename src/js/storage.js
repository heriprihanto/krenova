import { isMock } from "./firebase-config.js";

// ============================================================================
// Upload lewat File Server (Server B — Go), pola sama dengan examples/server-c.
//
//   1. Browser → AUTH_UPLOAD (PHP)  : minta izin, dapat token HMAC + upload_url
//   2. Browser → Server B (Go)      : PUT /upload (stream file mentah + token)
//   3. Browser → AUTH_DOWNLOAD (PHP): tandatangani URL download berumur panjang
//
// SHARED_SECRET HANYA ada di endpoint PHP (auth/*.php), tidak pernah di JS ini.
// Origin halaman ini HARUS terdaftar di `trusted_origins` config.json Server B
// agar PUT lintas-origin ke Server B lolos CORS.
// ============================================================================
const AUTH_UPLOAD = "/auth/init_upload.php"; // menandatangani token upload
const AUTH_DOWNLOAD = "/auth/sign_download.php"; // menandatangani URL download

/**
 * Mengunggah sebuah file ke File Server dan mengembalikan URL download
 * bertanda tangan (siap disimpan di Firestore & dipakai sebagai src <img>/tautan).
 *
 * @param {File} file - Objek file yang diunggah.
 * @param {string} [path] - Diabaikan (Server B bersifat content-addressed; nama di
 *   disk = SHA-256 isi file). Dipertahankan demi kompatibilitas pemanggil lama.
 * @param {function} [progressCallback] - Menerima persen selesai (0-100).
 * @returns {Promise<string>} - URL download bertanda tangan.
 */
export async function uploadFile(file, path, progressCallback) {
  if (!file) return "";

  if (isMock) {
    return new Promise((resolve) => {
      let percent = 0;
      const interval = setInterval(() => {
        percent += 20;
        if (progressCallback) progressCallback(percent);

        if (percent >= 100) {
          clearInterval(interval);
          // Object URL lokal untuk preview selama sesi tab aktif.
          try {
            const objectUrl = URL.createObjectURL(file);
            console.log(`Mock uploaded file. Temp URL: ${objectUrl}`);
            resolve(objectUrl);
          } catch (e) {
            resolve(
              "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=500&auto=format&fit=crop",
            ); // fallback photo
          }
        }
      }, 100);
    });
  }

  // 1) Minta token upload ke endpoint PHP (server-side, memegang secret).
  const initRes = await fetch(AUTH_UPLOAD, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      size: file.size,
      content_type: file.type || "application/octet-stream",
    }),
  });
  if (!initRes.ok) {
    throw new Error("Gagal meminta token upload: HTTP " + initRes.status);
  }
  const { upload_url, token } = await initRes.json();

  // 2) PUT file mentah LANGSUNG ke Server B (streaming, dengan progress).
  //    XHR dipakai karena mendukung event progress upload; fetch belum.
  const put = await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", upload_url);
    xhr.setRequestHeader("X-Upload-Token", token);
    xhr.setRequestHeader("X-File-Name", file.name);
    xhr.setRequestHeader(
      "Content-Type",
      file.type || "application/octet-stream",
    );
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && progressCallback) {
        progressCallback(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve(JSON.parse(xhr.responseText))
        : reject(new Error("Server B menolak upload: HTTP " + xhr.status));
    xhr.onerror = () =>
      reject(
        new Error("Koneksi ke Server B gagal (cek CORS/trusted_origins)"),
      );
    xhr.send(file); // body = file mentah, bukan FormData
  });

  // 3) Tandatangani URL download berumur panjang untuk key hasil upload.
  const signRes = await fetch(AUTH_DOWNLOAD, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: put.key, name: file.name }),
  });
  if (!signRes.ok) {
    throw new Error("Gagal menandatangani URL download: HTTP " + signRes.status);
  }
  const { download_url } = await signRes.json();

  if (progressCallback) progressCallback(100);
  return download_url;
}
