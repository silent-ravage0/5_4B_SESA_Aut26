<?php
require __DIR__ . '/db.php';
require_method('POST');

$input = read_json_body();
$username = clean_username(isset($input['username']) ? $input['username'] : '');
$email = clean_email(isset($input['email']) ? $input['email'] : '');
$password = isset($input['password']) ? (string) $input['password'] : '';

$problem = password_problem($password, $username);
if ($problem !== '') {
    fail(400, $problem, 'invalid_password');
}

$pdo = db();
$emailKey = email_key($email);
$usernameKey = strtolower($username);
$now = now_ms();

$pdo->prepare('DELETE FROM users WHERE email_verified = 0 AND password_hash IS NOT NULL AND verify_expires < ?')->execute([$now]);

$statement = $pdo->prepare('SELECT * FROM users WHERE email = ? OR email_key = ?');
$statement->execute([$email, $emailKey]);
$existing = $statement->fetch();
if ($existing && (int) $existing['email_verified'] === 1) {
    fail(409, 'An account with this email already exists. Please sign in.', 'email_taken');
}
$reuseEmail = $existing ? $existing['email'] : null;

$statement = $pdo->prepare('SELECT 1 FROM users WHERE username_key = ? AND email <> ?');
$statement->execute([$usernameKey, $reuseEmail === null ? '' : $reuseEmail]);
if ($statement->fetchColumn()) {
    fail(409, 'This username is already taken. Please choose another one.', 'username_taken');
}

$hash = password_hash($password, PASSWORD_DEFAULT);

try {
    if ($reuseEmail !== null) {
        $pdo->prepare('UPDATE users SET email = ?, email_key = ?, username = ?, username_key = ?, name = ?, password_hash = ?,
                       email_verified = 0 WHERE email = ?')
            ->execute([$email, $emailKey, $username, $usernameKey, $username, $hash, $reuseEmail]);
    } else {
        $pdo->prepare('INSERT INTO users (email, email_key, username, username_key, name, password_hash, email_verified,
                       first_signed_in_at, last_signed_in_at, sign_in_count) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, 0)')
            ->execute([$email, $emailKey, $username, $usernameKey, $username, $hash, $now, $now]);
    }
} catch (PDOException $error) {
    if (!is_duplicate_error($error)) throw $error;
    fail(409, 'This email or username is already registered. Please sign in or choose another.', 'already_taken');
}

send_verification_code($pdo, $email, true);

send_json([
    'needsVerification' => true,
    'email'             => $email,
    'maskedEmail'       => mask_email($email),
    'resendAfter'       => 60,
], 202);
