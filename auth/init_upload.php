<?php
/**
 * KRENOVA → penandatangan token UPLOAD untuk File Server (Server B — Go).
 * Pola sama persis dengan examples/server-c/auth/init_upload.php.
 *
 * Inilah satu-satunya bagian yang berjalan di sisi server: ia memegang
 * shared_secret dan menandatangani token upload. Browser (storage.js) memanggilnya,
 * lalu meng-upload file LANGSUNG ke Server B memakai token yang dikembalikan.
 *
 *   POST /auth/init_upload.php
 *   Body JSON: { "filename": "...", "size": 123, "content_type": "application/pdf" }
 *   Balas:     { "upload_url": "...", "token": "...", "jti": "..." }
 *
 * JANGAN pernah menaruh SHARED_SECRET ini di HTML/JS.
 */

const SHARED_SECRET = 'J1y4ASL6LM5QIlVsKVbwLX7CjaaMYkHOdR1fhtZFqjj'; // == config.json Server B
const FILE_SERVER   = 'http://localhost:8080';                       // base URL Server B

header('Content-Type: application/json');

// --- 1. Autentikasi user KRENOVA (GANTI dengan sistem login milikmu bila perlu) ---
// Frontend Firebase-Auth sudah membatasi siapa yang boleh mengunggah; uid di sini
// hanya metadata yang ikut ke webhook Server B.
$uid = 'krenova-peserta';

// --- 2. Validasi permintaan ---
$in          = json_decode(file_get_contents('php://input'), true) ?: [];
$filename    = trim($in['filename'] ?? '');
$size        = (int)($in['size'] ?? 0);
$contentType = $in['content_type'] ?? 'application/octet-stream';

$MAX_SIZE      = 5 * 1024 * 1024;                    // 5 MiB (batas terbesar berkas Langkah 5)
$ALLOWED_MIMES = ['image/jpeg', 'image/png', 'application/pdf']; // hanya tipe berkas Langkah 5

if ($filename === '' || $size <= 0) {
    http_response_code(422);
    echo json_encode(['error' => 'filename & size wajib diisi']);
    exit;
}
if ($size > $MAX_SIZE) {
    http_response_code(413);
    echo json_encode(['error' => 'ukuran melebihi batas']);
    exit;
}

// --- 3. Buat & tandatangani token upload (HMAC-SHA256) ---
$jti    = bin2hex(random_bytes(16));
$claims = [
    'jti'  => $jti,
    'uid'  => $uid,
    'max'  => $MAX_SIZE,
    'mime' => $ALLOWED_MIMES,
    'exp'  => time() + 600, // berlaku 10 menit
];

$payload = b64url(json_encode($claims, JSON_UNESCAPED_SLASHES));
$sig     = b64url(hash_hmac('sha256', $payload, SHARED_SECRET, true));
$token   = $payload . '.' . $sig;

echo json_encode([
    'upload_url' => FILE_SERVER . '/upload',
    'token'      => $token,
    'jti'        => $jti,
]);

/** base64 URL-safe tanpa padding — cocok dengan base64.RawURLEncoding di Go. */
function b64url(string $bin): string {
    return rtrim(strtr(base64_encode($bin), '+/', '-_'), '=');
}
