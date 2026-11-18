<?php
require __DIR__ . '/db.php';
require_method('POST');

$input = read_json_body();
$email = clean_email(isset($input['email']) ? $input['email'] : '');

$pdo = db();
$statement = $pdo->prepare('SELECT * FROM users WHERE email = ?');
$statement->execute([$email]);
$user = $statement->fetch();

if (!$user || (int) $user['email_verified'] === 1 || $user['password_hash'] === null) {
    fail(400, 'No verification is waiting for this e-mail. Please create the account again.', 'no_pending');
}

$wait = 60000 - (now_ms() - (int) $user['verify_sent_at']);
if ($wait > 0) {
    fail(429, 'Please wait ' . (int) ceil($wait / 1000) . ' seconds before asking for another code.', 'too_soon');
}

send_verification_code($pdo, $email);
send_json(['ok' => true, 'resendAfter' => 60]);
