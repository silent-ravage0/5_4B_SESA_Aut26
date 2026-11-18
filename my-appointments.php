<?php
require __DIR__ . '/db.php';
require_method('GET');

$pdo = db();
$user = require_patient($pdo);

$statement = $pdo->prepare('SELECT * FROM appointments WHERE email = ? ORDER BY sort_key, slot_hour, slot_minute');
$statement->execute([$user['email']]);

send_json(['appointments' => array_map('appointment_to_array', $statement->fetchAll())]);
