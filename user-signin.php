<?php
require __DIR__ . '/db.php';
require_method('POST');

$input = read_json_body();
$identifier = trim(isset($input['identifier']) ? (string) $input['identifier'] : '');
$password = isset($input['password']) ? (string) $input['password'] : '';

if ($identifier === '' || $password === '') {
    fail(400, 'Enter your email or username and your password.');
}

$pdo = db();
if (strpos($identifier, '@') !== false) {
    $statement = $pdo->prepare('SELECT * FROM users WHERE email_key = ?');
    $statement->execute([email_key($identifier)]);
} else {
    $statement = $pdo->prepare('SELECT * FROM users WHERE username_key = ?');
    $statement->execute([strtolower($identifier)]);
}
$user = $statement->fetch();

if ($user && (int) $user['locked_until'] > now_ms()) {
    $minutes = (int) ceil(((int) $user['locked_until'] - now_ms()) / 60000);
    fail(429, 'Too many wrong attempts. Please try again in ' . $minutes . ' minute' . ($minutes === 1 ? '' : 's') . '.', 'locked');
}

$hash = ($user && $user['password_hash'] !== null) ? $user['password_hash'] : '$2y$10$rfMEQbBrS6tgmC7OuhoDPuZmy3FsU2iWsPfxoZuuH1V7OCjkv2Ydq';
$passwordOk = password_verify($password, $hash);

if (!$user || $user['password_hash'] === null || !$passwordOk) {
    if ($user) {
        $attempts = (int) $user['failed_attempts'] + 1;
        if ($attempts >= 5) {
            $pdo->prepare('UPDATE users SET failed_attempts = 0, locked_until = ? WHERE email = ?')->execute([now_ms() + 300000, $user['email']]);
        } else {
            $pdo->prepare('UPDATE users SET failed_attempts = ? WHERE email = ?')->execute([$attempts, $user['email']]);
        }
    }
    usleep(500000);
    fail(401, 'Incorrect email/username or password.', 'bad_login');
}

if (password_needs_rehash($user['password_hash'], PASSWORD_DEFAULT)) {
    $pdo->prepare('UPDATE users SET password_hash = ? WHERE email = ?')->execute([password_hash($password, PASSWORD_DEFAULT), $user['email']]);
}

if ((int) $user['email_verified'] !== 1) {
    if (now_ms() - (int) $user['verify_sent_at'] >= 60000) {
        send_verification_code($pdo, $user['email']);
    }
    send_json([
        'error'       => 'Please verify your e-mail first. We sent a 6-digit code to ' . mask_email($user['email']) . '.',
        'code'        => 'not_verified',
        'email'       => $user['email'],
        'maskedEmail' => mask_email($user['email']),
    ], 403);
}

log_in_patient($pdo, $user);
send_json(['user' => public_user($user)]);
