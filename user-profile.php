<?php
require __DIR__ . '/db.php';

$method = isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : 'GET';
if ($method !== 'GET' && $method !== 'POST') {
    fail(405, 'Method not allowed');
}

$pdo = db();
$user = require_patient($pdo);

if ($method === 'GET') {
    send_json(['user' => public_user($user)]);
}

$input = read_json_body();

function profile_text($input, $key, $maxLength, $label) {
    $value = isset($input[$key]) ? trim((string) $input[$key]) : '';
    $value = preg_replace('/[\x00-\x1F\x7F]/u', ' ', $value);
    if ($value === null) {
        fail(400, $label . ' has invalid characters.', 'invalid_' . $key);
    }
    $value = trim(preg_replace('/\s+/u', ' ', $value));
    if (preg_match_all('/./us', $value) > $maxLength) {
        fail(400, $label . ' must be at most ' . $maxLength . ' characters.', 'invalid_' . $key);
    }
    return $value;
}

$username = clean_username(isset($input['username']) ? $input['username'] : '');

$fullName = profile_text($input, 'fullName', 100, 'Full name');
if ($fullName !== '' && !preg_match('/^[\p{L}\p{M}0-9 .\'_-]+$/u', $fullName)) {
    fail(400, 'Full name can only use letters, numbers, spaces and . \' _ -', 'invalid_fullName');
}

$phone = profile_text($input, 'phone', 20, 'Phone');
if ($phone !== '' && !preg_match('/^[0-9+() -]{6,20}$/', $phone)) {
    fail(400, 'Enter a valid phone number (digits, spaces, + - and brackets only).', 'invalid_phone');
}

$dateOfBirth = profile_text($input, 'dateOfBirth', 10, 'Date of birth');
if ($dateOfBirth !== '') {
    $parsed = DateTime::createFromFormat('Y-m-d', $dateOfBirth);
    $valid = $parsed && $parsed->format('Y-m-d') === $dateOfBirth;
    if (!$valid || $dateOfBirth < '1900-01-01' || $dateOfBirth > date('Y-m-d')) {
        fail(400, 'Enter a valid date of birth.', 'invalid_dateOfBirth');
    }
}

$gender = profile_text($input, 'gender', 10, 'Gender');
if (!in_array($gender, ['', 'male', 'female', 'other'], true)) {
    fail(400, 'Choose a valid gender option.', 'invalid_gender');
}

$bloodGroup = profile_text($input, 'bloodGroup', 4, 'Blood group');
if (!in_array($bloodGroup, ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'], true)) {
    fail(400, 'Choose a valid blood group.', 'invalid_bloodGroup');
}

$address = profile_text($input, 'address', 200, 'Address');

$usernameKey = strtolower($username);
$statement = $pdo->prepare('SELECT 1 FROM users WHERE username_key = ? AND email <> ?');
$statement->execute([$usernameKey, $user['email']]);
if ($statement->fetchColumn()) {
    fail(409, 'This username is already taken. Please choose another one.', 'username_taken');
}

try {
    $pdo->prepare('UPDATE users SET username = ?, username_key = ?, name = ?, full_name = ?, phone = ?, date_of_birth = ?,
                   gender = ?, blood_group = ?, address = ? WHERE email = ?')
        ->execute([
            $username, $usernameKey, $username,
            $fullName === '' ? null : $fullName,
            $phone === '' ? null : $phone,
            $dateOfBirth === '' ? null : $dateOfBirth,
            $gender === '' ? null : $gender,
            $bloodGroup === '' ? null : $bloodGroup,
            $address === '' ? null : $address,
            $user['email'],
        ]);
} catch (PDOException $error) {
    if (!is_duplicate_error($error)) throw $error;
    fail(409, 'This username is already taken. Please choose another one.', 'username_taken');
}

$statement = $pdo->prepare('SELECT * FROM users WHERE email = ?');
$statement->execute([$user['email']]);
send_json(['user' => public_user($statement->fetch())]);
