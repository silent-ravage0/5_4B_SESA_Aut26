<?php
require __DIR__ . '/db.php';
require_method('GET');

$todayKey = clean_date_key(isset($_GET['today']) ? $_GET['today'] : '');
$ids = array_slice(array_filter(explode(',', isset($_GET['doctor_ids']) ? $_GET['doctor_ids'] : '')), 0, 10);

$pdo = db();
$doctors = [];

foreach ($ids as $rawId) {
    $doctorId = clean_doctor_id($rawId);

    $statement = $pdo->prepare("SELECT date_key, time_label FROM appointments WHERE doctor_id = ? AND status <> 'cancelled'");
    $statement->execute([$doctorId]);
    $taken = [];
    foreach ($statement->fetchAll() as $row) {
        $taken[$row['date_key']][] = $row['time_label'];
    }

    $statement = $pdo->prepare("SELECT queue_serial, time_label FROM appointments WHERE doctor_id = ? AND date_key = ? AND status <> 'cancelled' ORDER BY queue_serial");
    $statement->execute([$doctorId, $todayKey]);
    $today = [];
    foreach ($statement->fetchAll() as $row) {
        $today[] = ['serial' => (int) $row['queue_serial'], 'time' => $row['time_label']];
    }

    $doctors[$doctorId] = [
        'taken' => $taken ?: new stdClass(),
        'today' => $today,
        'queue' => queue_to_array(find_queue($pdo, $doctorId, $todayKey)),
    ];
}

send_json(['doctors' => $doctors ?: new stdClass()]);
