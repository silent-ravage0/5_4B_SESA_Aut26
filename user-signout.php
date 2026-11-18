<?php
require __DIR__ . '/db.php';
require_method('POST');

if (isset($_COOKIE['meridian_patient'])) {
    start_patient_session();
    $_SESSION = [];
    session_destroy();
    setcookie('meridian_patient', '', time() - 3600, '/');
}
send_json(['ok' => true]);
