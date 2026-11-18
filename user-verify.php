<?php
require __DIR__ . '/db.php';
require_method('POST');

$input = read_json_body();
$email = clean_email(isset($input['email']) ? $input['email'] : '');
$code = trim(isset($input['code']) ? (string) $input['code'] : '');
if (!preg_match('/^\d{6}$/', $code)) {
    fail(400, 'Enter the 6-digit code from the e-mail.', 'invalid_code');
}

$pdo = db();
$statement = $pdo->prepare('SELECT * FROM users WHERE email = ?');
$statement->execute([$email]);
$user = $statement->fetch();

if (!$user || (int) $user['email_verified'] === 1 || $user['verify_code_hash'] === null) {
    fail(400, 'No verification is waiting for this e-mail. Please create the account again.', 'no_pending');
}
if ((int) $user['verify_expires'] < now_ms()) {
    fail(410, 'This code has expired. Please request a new code.', 'code_expired');
}
if ((int) $user['verify_attempts'] >= 5) {
    fail(429, 'Too many wrong codes. Please request a new code.', 'too_many_attempts');
}

if (!hash_equals($user['verify_code_hash'], otp_hash($code, $email))) {
    $attempts = (int) $user['verify_attempts'] + 1;
    $pdo->prepare('UPDATE users SET verify_attempts = ? WHERE email = ?')->execute([$attempts, $email]);
    $left = 5 - $attempts;
    usleep(300000);
    fail(400, $left > 0 ? "Wrong code. $left " . ($left === 1 ? 'try' : 'tries') . ' left.' : 'Too many wrong codes. Please request a new code.', 'wrong_code');
}

$pdo->prepare('UPDATE users SET email_verified = 1, verify_code_hash = NULL, verify_expires = 0, verify_attempts = 0 WHERE email = ?')
    ->execute([$email]);

log_in_patient($pdo, $user);
send_json(['user' => public_user($user)]);
