<?php
require __DIR__ . '/db.php';
require_method('POST');

$input = read_json_body();
$id = clean_text(isset($input['id']) ? $input['id'] : '', 12);
$action = isset($input['action']) ? $input['action'] : '';

$pdo = db();
$user = require_patient($pdo);
$appointment = find_appointment($pdo, $id);
if (!$appointment || strtolower($appointment['email']) !== $user['email']) {
    fail(404, 'Appointment not found.');
}

if ($action === 'cancel') {
    $pdo->prepare("UPDATE appointments SET status = 'cancelled', slot_key = NULL WHERE id = ?")->execute([$id]);
    send_json(['appointment' => appointment_to_array(find_appointment($pdo, $id))]);
}

if ($action === 'reschedule') {
    if ($appointment['status'] === 'cancelled') {
        fail(409, 'A cancelled appointment cannot be rescheduled.');
    }
    $schedule = clean_schedule_fields($input);
    $sql = 'UPDATE appointments SET doctor_id = ?, date_key = ?, day_label = ?, time_label = ?, date_iso = ?,
            slot_hour = ?, slot_minute = ?, sort_key = ?, fee = ?, queue_serial = ?, slot_key = ? WHERE id = ?';

    for ($attempt = 0; $attempt < 6; $attempt++) {
        $serial = next_serial($pdo, $schedule['doctor_id'], $schedule['date_key'], $id);
        try {
            $pdo->prepare($sql)->execute([
                $schedule['doctor_id'], $schedule['date_key'], $schedule['day_label'], $schedule['time_label'],
                $schedule['date_iso'], $schedule['slot_hour'], $schedule['slot_minute'], $schedule['sort_key'],
                $schedule['fee'], $serial, $schedule['slot_key'], $id,
            ]);
            send_json(['appointment' => appointment_to_array(find_appointment($pdo, $id))]);
        } catch (PDOException $error) {
            if (!is_duplicate_error($error)) throw $error;
            if (slot_is_taken($pdo, $schedule['slot_key'], $id)) {
                fail(409, 'Sorry, that time was just taken. Please pick another one.', 'slot_taken');
            }
        }
    }
    fail(503, 'The server is busy. Please try again.');
}

fail(400, 'Unknown action');
