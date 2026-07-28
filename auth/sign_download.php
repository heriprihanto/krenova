<?php
/**
 * KRENOVA → penandatangan token DOWNLOAD untuk File Server (Server B — Go).
 *
 * Dipanggil SETELAH upload sukses (browser sudah tahu `key` blob dari respons
 * PUT /upload). Mengembalikan URL download bertanda tangan yang berumur panjang,
 * sehingga bisa disimpan di Firestore dan dipakai langsung sebagai `src` <img>
 * / tautan berkas di panel admin & tampilan detail.
 *
 *   POST /auth/sign_download.php
 *   Body JSON: { "key": "ab/cd/abcdef...", "name": "foto.jpg" (opsional) }
 *   Balas:     { "download_url": "http://localhost:8080/files/<token>?name=foto.jpg" }
 *
 * JANGAN pernah menaruh SHARED_SECRET ini di HTML/JS.
 */

const SHARED_SECRET = 'J1y4ASL6LM5QIlVsKVbwLX7CjaaMYkHOdR1fhtZFqjj'; // == config.json Server B
const FILE_SERVER   = 'http://localhost:8080';                       // base URL Server B
const TTL_SECONDS   = 60 * 60 * 24 * 365;                            // ~1 tahun (long-lived)

header('Content-Type: application/json');

$in   = json_decode(file_get_contents('php://input'), true) ?: [];
$key  = trim($in['key'] ?? '');
$name = trim($in['name'] ?? '');

// key = path relatif blob, mis. "77/f8/77f8...". Hanya izinkan karakter aman.
if ($key === '' || !preg_match('#^[A-Za-z0-9/_-]+$#', $key)) {
    http_response_code(422);
    echo json_encode(['error' => 'key tidak valid']);
    exit;
}

// --- Buat & tandatangani token download (HMAC-SHA256): claims { key, exp } ---
$claims  = ['key' => $key, 'exp' => time() + TTL_SECONDS];
$payload = b64url(json_encode($claims, JSON_UNESCAPED_SLASHES));
$sig     = b64url(hash_hmac('sha256', $payload, SHARED_SECRET, true));
$token   = $payload . '.' . $sig;

$url = FILE_SERVER . '/files/' . $token;
if ($name !== '') {
    $url .= '?name=' . rawurlencode($name);
}

echo json_encode(['download_url' => $url]);

/** base64 URL-safe tanpa padding — cocok dengan base64.RawURLEncoding di Go. */
function b64url(string $bin): string {
    return rtrim(strtr(base64_encode($bin), '+/', '-_'), '=');
}
