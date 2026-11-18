<?php
require_once __DIR__ . '/mail.php';

function config() {
    static $config = null;
    if ($config === null) {
        $config = require __DIR__ . '/config.php';
        date_default_timezone_set($config['timezone']);
    }
    return $config;
}

function db() {
    static $pdo = null;
    if ($pdo === null) {
        $config = config();
        try {
            $pdo = new PDO($config['dsn'], $config['db_user'], $config['db_pass'], [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]);
        } catch (PDOException $error) {
            error_log('Database connection failed: ' . $error->getMessage());
            fail(500, 'Could not connect to the database. Check api/config.php');
        }

        if (strpos($config['dsn'], 'sqlite:') === 0) {
            $pdo->exec(file_get_contents(__DIR__ . '/../database/schema.sqlite.sql'));
        }

        ensure_users_table($pdo);
        ensure_profile_columns($pdo);
    }
    return $pdo;
}

function ensure_users_table($pdo) {
    $pdo->exec('CREATE TABLE IF NOT EXISTS users (
        email               VARCHAR(150) NOT NULL PRIMARY KEY,
        email_key           VARCHAR(150) NULL,
        username            VARCHAR(30)  NULL,
        username_key        VARCHAR(30)  NULL,
        name                VARCHAR(100) NOT NULL,
        password_hash       VARCHAR(255) NULL,
        failed_attempts     INT          NOT NULL DEFAULT 0,
        locked_until        BIGINT       NOT NULL DEFAULT 0,
        first_signed_in_at  BIGINT       NOT NULL,
        last_signed_in_at   BIGINT       NOT NULL,
        sign_in_count       INT          NOT NULL DEFAULT 0,
        email_verified      INT          NOT NULL DEFAULT 0,
        verify_code_hash    VARCHAR(64)  NULL,
        verify_expires      BIGINT       NOT NULL DEFAULT 0,
        verify_attempts     INT          NOT NULL DEFAULT 0,
        verify_sent_at      BIGINT       NOT NULL DEFAULT 0,
        full_name           VARCHAR(100) NULL,
        phone               VARCHAR(30)  NULL,
        date_of_birth       VARCHAR(10)  NULL,
        gender              VARCHAR(10)  NULL,
        blood_group         VARCHAR(4)   NULL,
        address             VARCHAR(200) NULL,
        UNIQUE (email_key),
        UNIQUE (username_key)
    )');

    try {
        $pdo->query('SELECT email_key, username, username_key, password_hash, failed_attempts, locked_until, email_verified, verify_code_hash, verify_expires, verify_attempts, verify_sent_at FROM users LIMIT 1');
        return;
    } catch (PDOException $error) {
    }

    $upgrade = [
        'ALTER TABLE users ADD COLUMN email_key VARCHAR(150) NULL',
        'ALTER TABLE users ADD COLUMN username VARCHAR(30) NULL',
        'ALTER TABLE users ADD COLUMN username_key VARCHAR(30) NULL',
        'ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) NULL',
        'ALTER TABLE users ADD COLUMN failed_attempts INT NOT NULL DEFAULT 0',
        'ALTER TABLE users ADD COLUMN locked_until BIGINT NOT NULL DEFAULT 0',
        'ALTER TABLE users ADD COLUMN email_verified INT NOT NULL DEFAULT 0',
        'ALTER TABLE users ADD COLUMN verify_code_hash VARCHAR(64) NULL',
        'ALTER TABLE users ADD COLUMN verify_expires BIGINT NOT NULL DEFAULT 0',
        'ALTER TABLE users ADD COLUMN verify_attempts INT NOT NULL DEFAULT 0',
        'ALTER TABLE users ADD COLUMN verify_sent_at BIGINT NOT NULL DEFAULT 0',
    ];
    foreach ($upgrade as $sql) {
        try { $pdo->exec($sql); } catch (PDOException $error) { }
    }
    foreach ($pdo->query('SELECT email FROM users')->fetchAll() as $row) {
        $pdo->prepare('UPDATE users SET email_key = ? WHERE email = ?')->execute([email_key($row['email']), $row['email']]);
    }
    $indexes = [
        'CREATE UNIQUE INDEX uniq_users_email_key ON users (email_key)',
        'CREATE UNIQUE INDEX uniq_users_username_key ON users (username_key)',
    ];
    foreach ($indexes as $sql) {
        try { $pdo->exec($sql); } catch (PDOException $error) { }
    }
    $pdo->exec('UPDATE users SET email_verified = 1 WHERE password_hash IS NOT NULL');
}

function ensure_profile_columns($pdo) {
    try {
        $pdo->query('SELECT full_name, phone, date_of_birth, gender, blood_group, address FROM users LIMIT 1');
        return;
    } catch (PDOException $error) {
    }
    $upgrade = [
        'ALTER TABLE users ADD COLUMN full_name VARCHAR(100) NULL',
        'ALTER TABLE users ADD COLUMN phone VARCHAR(30) NULL',
        'ALTER TABLE users ADD COLUMN date_of_birth VARCHAR(10) NULL',
        'ALTER TABLE users ADD COLUMN gender VARCHAR(10) NULL',
        'ALTER TABLE users ADD COLUMN blood_group VARCHAR(4) NULL',
        'ALTER TABLE users ADD COLUMN address VARCHAR(200) NULL',
    ];
    foreach ($upgrade as $sql) {
        try { $pdo->exec($sql); } catch (PDOException $error) { }
    }
}

set_exception_handler(function ($error) {
    error_log($error);
    fail(500, 'Something went wrong on the server.');
});

function send_json($data, $status = 200) {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function fail($status, $message, $code = '') {
    send_json(['error' => $message, 'code' => $code], $status);
}

function require_method($method) {
    if ($_SERVER['REQUEST_METHOD'] !== $method) {
        fail(405, 'Method not allowed');
    }
}

function read_json_body() {
    $type = isset($_SERVER['CONTENT_TYPE']) ? $_SERVER['CONTENT_TYPE'] : '';
    if (stripos($type, 'application/json') === false) {
        fail(415, 'Please send JSON');
    }
    $data = json_decode(file_get_contents('php://input'), true);
    if (!is_array($data)) {
        fail(400, 'Invalid JSON');
    }
    return $data;
}

function start_admin_session() {
    if (session_status() === PHP_SESSION_NONE) {
        session_name('meridian_admin');
        session_set_cookie_params(['path' => '/', 'httponly' => true, 'samesite' => 'Lax']);
        session_start();
    }
}

function require_admin() {
    start_admin_session();
    if (empty($_SESSION['is_admin'])) {
        fail(401, 'Please sign in as front desk.', 'not_logged_in');
    }
}

function now_ms() {
    return (int) round(microtime(true) * 1000);
}

function clean_text($value, $maxLength) {
    $text = trim((string) $value);
    return mb_substr($text, 0, $maxLength);
}

function clean_date_key($value) {
    $key = (string) $value;
    if (!preg_match('/^\d{4}-\d{1,2}-\d{1,2}$/', $key)) {
        fail(400, 'Invalid date');
    }
    return $key;
}

function clean_doctor_id($value) {
    $id = (string) $value;
    if (!preg_match('/^doc\d{1,4}$/', $id)) {
        fail(400, 'Invalid doctor');
    }
    return $id;
}

function clean_person_name($value) {
    $name = preg_replace('/\s+/u', ' ', trim((string) $value));
    if ($name === null || mb_strlen($name) < 2 || mb_strlen($name) > 100) {
        fail(400, 'Please enter your name (at least 2 characters).', 'invalid_name');
    }
    if (!preg_match('/^[\p{L}\p{M}0-9 .\'_-]+$/u', $name) || !preg_match('/\p{L}/u', $name)) {
        fail(400, 'Your name can only use letters, numbers, spaces and . - _ \'', 'invalid_name');
    }
    return $name;
}

function clean_username($value) {
    $username = trim((string) $value);
    if (!preg_match('/^[A-Za-z0-9][A-Za-z0-9._-]{2,29}$/', $username)) {
        fail(400, 'Username must be 3 to 30 characters: letters, numbers, . _ - (start with a letter or number).', 'invalid_username');
    }
    return $username;
}

function password_problem($password, $username) {
    if (!preg_match('/^[\x21-\x7E]+$/', $password)) {
        return 'Password can only use letters, numbers and symbols (no spaces).';
    }
    if (strlen($password) < 8 || strlen($password) > 64) {
        return 'Password must be 8 to 64 characters.';
    }
    if (!preg_match('/[a-z]/', $password) || !preg_match('/[A-Z]/', $password) ||
        !preg_match('/[0-9]/', $password) || !preg_match('/[^A-Za-z0-9]/', $password)) {
        return 'Password needs a lowercase letter, an uppercase letter, a number and a special character (like ! @ # $ %).';
    }
    if ($username !== '' && stripos($password, $username) !== false) {
        return 'Password cannot contain your username.';
    }
    return '';
}

function email_key($email) {
    $email = strtolower(trim($email));
    $parts = explode('@', $email, 2);
    if (count($parts) !== 2) return $email;
    $local = $parts[0];
    $domain = $parts[1];
    if ($domain === 'gmail.com' || $domain === 'googlemail.com') {
        $plus = strpos($local, '+');
        if ($plus !== false) $local = substr($local, 0, $plus);
        $local = str_replace('.', '', $local);
        $domain = 'gmail.com';
    }
    return $local . '@' . $domain;
}

function mask_email($email) {
    $parts = explode('@', $email, 2);
    if (count($parts) !== 2) return $email;
    return substr($parts[0], 0, 1) . '***@' . $parts[1];
}

function otp_hash($code, $email) {
    return hash_hmac('sha256', $code, strtolower($email));
}

function send_verification_code($pdo, $email, $deleteIfNotSent = false) {
    $config = config();
    $minutes = isset($config['otp_minutes']) ? (int) $config['otp_minutes'] : 10;
    $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    $now = now_ms();

    $pdo->prepare('UPDATE users SET verify_code_hash = ?, verify_expires = ?, verify_attempts = 0, verify_sent_at = ? WHERE email = ?')
        ->execute([otp_hash($code, $email), $now + $minutes * 60000, $now, $email]);

    $problem = try_send_mail($email, 'Your Meridian Health verification code',
        "Your Meridian Health verification code is:\n\n    $code\n\n" .
        "It is valid for $minutes minutes. If you did not create an account, you can ignore this e-mail.");
    if ($problem !== null) {
        if ($deleteIfNotSent) {
            $pdo->prepare('DELETE FROM users WHERE email = ? AND email_verified = 0')->execute([$email]);
        }
        fail($problem[0], $problem[1], $problem[2]);
    }
}

function public_user($row) {
    $username = $row['username'] !== null && $row['username'] !== '' ? $row['username'] : $row['name'];
    $field = function ($key) use ($row) {
        return isset($row[$key]) && $row[$key] !== null ? (string) $row[$key] : '';
    };
    return [
        'name'          => $username,
        'username'      => $username,
        'email'         => $row['email'],
        'fullName'      => $field('full_name'),
        'phone'         => $field('phone'),
        'dateOfBirth'   => $field('date_of_birth'),
        'gender'        => $field('gender'),
        'bloodGroup'    => $field('blood_group'),
        'address'       => $field('address'),
        'memberSince'   => isset($row['first_signed_in_at']) ? (int) $row['first_signed_in_at'] : 0,
    ];
}

function start_patient_session() {
    if (session_status() === PHP_SESSION_NONE) {
        ini_set('session.gc_maxlifetime', '604800');
        session_name('meridian_patient');
        session_set_cookie_params(['lifetime' => 604800, 'path' => '/', 'httponly' => true, 'samesite' => 'Lax']);
        session_start();
    }
}

function current_patient($pdo) {
    if (!isset($_COOKIE['meridian_patient'])) return null;
    start_patient_session();
    if (empty($_SESSION['patient_email'])) return null;
    $statement = $pdo->prepare('SELECT * FROM users WHERE email = ?');
    $statement->execute([$_SESSION['patient_email']]);
    $row = $statement->fetch();
    return $row ? $row : null;
}

function require_patient($pdo) {
    $user = current_patient($pdo);
    if (!$user) {
        fail(401, 'Please sign in to continue.', 'not_logged_in');
    }
    return $user;
}

function log_in_patient($pdo, $row) {
    start_patient_session();
    session_regenerate_id(true);
    $_SESSION['patient_email'] = $row['email'];
    $pdo->prepare('UPDATE users SET failed_attempts = 0, locked_until = 0, last_signed_in_at = ?, sign_in_count = sign_in_count + 1 WHERE email = ?')
        ->execute([now_ms(), $row['email']]);
}

function clean_email($value) {
    $email = strtolower(trim((string) $value));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 150) {
        fail(400, 'Please enter a valid email.');
    }
    return $email;
}

function is_emergency_doctor($doctorId) {
    $config = config();
    $number = (int) substr($doctorId, 3);
    return $number >= 1 && $number <= $config['main_doctor_count'] &&
        (($number - 1) % $config['doctors_per_department']) < $config['emergency_doctors_per_department'];
}

function clean_schedule_fields($input) {
    $time = isset($input['time']) ? (string) $input['time'] : '';
    if (!preg_match('/^(1[0-2]|[1-9]):([0-5]\d) (AM|PM)$/', $time, $parts)) {
        fail(400, 'Invalid time');
    }
    $hour = (int) $parts[1];
    if ($parts[3] === 'PM' && $hour !== 12) $hour += 12;
    if ($parts[3] === 'AM' && $hour === 12) $hour = 0;

    $doctorId = clean_doctor_id(isset($input['doctorId']) ? $input['doctorId'] : '');
    $dateKey = clean_date_key(isset($input['dateKey']) ? $input['dateKey'] : '');

    return [
        'doctor_id'   => $doctorId,
        'date_key'    => $dateKey,
        'day_label'   => clean_text(isset($input['dayLabel']) ? $input['dayLabel'] : '', 30),
        'time_label'  => $time,
        'date_iso'    => clean_text(isset($input['dateISO']) ? $input['dateISO'] : '', 40),
        'slot_hour'   => $hour,
        'slot_minute' => (int) $parts[2],
        'sort_key'    => (int) (isset($input['sortKey']) ? $input['sortKey'] : 0),
        'fee'         => max(0, min(1000000, (int) (isset($input['fee']) ? $input['fee'] : 0))),
        'slot_key'    => is_emergency_doctor($doctorId) ? null : $doctorId . '|' . $dateKey . '|' . $time,
    ];
}

function make_appointment_id() {
    $letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    $id = '';
    for ($i = 0; $i < 6; $i++) {
        $id .= $letters[random_int(0, strlen($letters) - 1)];
    }
    return 'MH-' . $id;
}

function next_serial($pdo, $doctorId, $dateKey, $ignoreId = '') {
    $statement = $pdo->prepare('SELECT COALESCE(MAX(queue_serial), 0) FROM appointments WHERE doctor_id = ? AND date_key = ? AND id <> ?');
    $statement->execute([$doctorId, $dateKey, $ignoreId]);
    return (int) $statement->fetchColumn() + 1;
}

function slot_is_taken($pdo, $slotKey, $ignoreId = '') {
    if ($slotKey === null) {
        return false;
    }
    $statement = $pdo->prepare('SELECT 1 FROM appointments WHERE slot_key = ? AND id <> ?');
    $statement->execute([$slotKey, $ignoreId]);
    return (bool) $statement->fetchColumn();
}

function is_duplicate_error($error) {
    return (string) $error->getCode() === '23000';
}

function appointment_to_array($row) {
    return [
        'id'          => $row['id'],
        'doctorId'    => $row['doctor_id'],
        'dateKey'     => $row['date_key'],
        'dayLabel'    => $row['day_label'],
        'time'        => $row['time_label'],
        'dateISO'     => $row['date_iso'],
        'hour'        => (int) $row['slot_hour'],
        'minute'      => (int) $row['slot_minute'],
        'sortKey'     => (int) $row['sort_key'],
        'mode'        => $row['visit_mode'],
        'reason'      => $row['reason'],
        'patientType' => $row['patient_type'],
        'status'      => $row['status'],
        'name'        => $row['name'],
        'email'       => $row['email'],
        'phone'       => $row['phone'],
        'fee'         => (int) $row['fee'],
        'serial'      => (int) $row['queue_serial'],
        'createdAt'   => (int) $row['created_at'],
    ];
}

function find_appointment($pdo, $id) {
    $statement = $pdo->prepare('SELECT * FROM appointments WHERE id = ?');
    $statement->execute([$id]);
    return $statement->fetch();
}

function queue_to_array($row) {
    if (!$row) {
        return ['serving' => null, 'completed' => [], 'updatedAt' => null];
    }
    $completed = json_decode($row['completed'], true);
    return [
        'serving'   => $row['serving'] === null ? null : (int) $row['serving'],
        'completed' => is_array($completed) ? array_map('intval', $completed) : [],
        'updatedAt' => (int) $row['updated_at'],
    ];
}

function find_queue($pdo, $doctorId, $dateKey) {
    $statement = $pdo->prepare('SELECT * FROM queues WHERE doctor_id = ? AND date_key = ?');
    $statement->execute([$doctorId, $dateKey]);
    return $statement->fetch();
}

function save_queue($pdo, $doctorId, $dateKey, $serving, $completed) {
    $completedJson = json_encode(array_values($completed));
    if (find_queue($pdo, $doctorId, $dateKey)) {
        $statement = $pdo->prepare('UPDATE queues SET serving = ?, completed = ?, updated_at = ? WHERE doctor_id = ? AND date_key = ?');
        $statement->execute([$serving, $completedJson, now_ms(), $doctorId, $dateKey]);
    } else {
        $statement = $pdo->prepare('INSERT INTO queues (doctor_id, date_key, serving, completed, updated_at) VALUES (?, ?, ?, ?, ?)');
        $statement->execute([$doctorId, $dateKey, $serving, $completedJson, now_ms()]);
    }
}
