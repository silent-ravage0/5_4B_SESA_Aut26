<?php
require __DIR__ . '/db.php';
require_method('GET');

$user = current_patient(db());
send_json(['user' => $user ? public_user($user) : null]);
