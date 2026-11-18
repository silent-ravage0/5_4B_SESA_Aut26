<?php
require __DIR__ . '/db.php';
require_method('POST');
require_admin();

$input = read_json_body();
$doctorId = clean_doctor_id(isset($input['doctorId']) ? $input['doctorId'] : '');
$dateKey = clean_date_key(isset($input['dateKey']) ? $input['dateKey'] : '');
$action = isset($input['action']) ? $input['action'] : '';
$pdo = db();

if ($action === 'reset') {
    save_queue($pdo, $doctorId, $dateKey, null, []);
    send_json(['ok' => true]);
}

if ($action === 'call') {
    $statement = $pdo->prepare("SELECT queue_serial FROM appointments WHERE doctor_id = ? AND date_key = ? AND status <> 'cancelled' ORDER BY queue_serial");
    $statement->execute([$doctorId, $dateKey]);
    $serials = array_map('intval', $statement->fetchAll(PDO::FETCH_COLUMN));

    $queue = queue_to_array(find_queue($pdo, $doctorId, $dateKey));
    $completed = array_values(array_intersect($queue['completed'], $serials));
    if ($queue['serving'] !== null && in_array($queue['serving'], $serials, true)) {
        $completed[] = $queue['serving'];
    }

    $next = null;
    foreach ($serials as $serial) {
        if (!in_array($serial, $completed, true)) {
            $next = $serial;
            break;
        }
    }

    save_queue($pdo, $doctorId, $dateKey, $next, $completed);
    send_json(['ok' => true]);
}

fail(400, 'Unknown action');
