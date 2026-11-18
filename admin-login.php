<?php
require __DIR__ . '/db.php';
require_method('POST');

$input = read_json_body();
$config = config();
$username = isset($input['username']) ? (string) $input['username'] : '';
$password = isset($input['password']) ? (string) $input['password'] : '';

$usernameOk = hash_equals($config['admin_username'], $username);
$passwordOk = password_verify($password, $config['admin_password_hash']);

if (!$usernameOk || !$passwordOk) {
    usleep(800000);
    fail(401, 'Wrong username or password.', 'bad_login');
}

start_admin_session();
session_regenerate_id(true);
$_SESSION['is_admin'] = true;
send_json(['ok' => true]);
