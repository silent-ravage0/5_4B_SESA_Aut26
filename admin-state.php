<?php
require __DIR__ . '/db.php';
require_method('GET');
require_admin();

$todayKey = clean_date_key(isset($_GET['today']) ? $_GET['today'] : '');
$pdo = db();

$statement = $pdo->prepare("SELECT * FROM appointments WHERE date_key = ? AND status <> 'cancelled' ORDER BY doctor_id, queue_serial");
$statement->execute([$todayKey]);
$appointments = array_map('appointment_to_array', $statement->fetchAll());

$statement = $pdo->prepare('SELECT * FROM queues WHERE date_key = ?');
$statement->execute([$todayKey]);
$queues = [];
foreach ($statement->fetchAll() as $row) {
    $queues[$row['doctor_id']] = queue_to_array($row);
}

send_json(['appointments' => $appointments, 'queues' => $queues ?: new stdClass()]);
