<?php
require __DIR__ . '/db.php';
require_method('POST');

$input = read_json_body();
$schedule = clean_schedule_fields($input);

$name = clean_person_name(isset($input['name']) ? $input['name'] : '');
$email = clean_email(isset($input['email']) ? $input['email'] : '');
$mode = (isset($input['mode']) && $input['mode'] === 'video') ? 'video' : 'in-person';
$patientType = (isset($input['patientType']) && $input['patientType'] === 'returning') ? 'returning' : 'new';

$pdo = db();
$patient = current_patient($pdo);
if ($patient) {
    $email = $patient['email'];
}
$sql = 'INSERT INTO appointments
    (id, doctor_id, date_key, day_label, time_label, date_iso, slot_hour, slot_minute, sort_key,
     visit_mode, reason, patient_type, status, name, email, phone, fee, queue_serial, slot_key, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

for ($attempt = 0; $attempt < 6; $attempt++) {
    $id = make_appointment_id();
    $serial = next_serial($pdo, $schedule['doctor_id'], $schedule['date_key']);

    try {
        $pdo->prepare($sql)->execute([
            $id, $schedule['doctor_id'], $schedule['date_key'], $schedule['day_label'], $schedule['time_label'],
            $schedule['date_iso'], $schedule['slot_hour'], $schedule['slot_minute'], $schedule['sort_key'],
            $mode, clean_text(isset($input['reason']) ? $input['reason'] : '', 200), $patientType, 'upcoming',
            $name, $email, clean_text(isset($input['phone']) ? $input['phone'] : '', 30),
            $schedule['fee'], $serial, $schedule['slot_key'], now_ms(),
        ]);
        send_json(['appointment' => appointment_to_array(find_appointment($pdo, $id))], 201);
    } catch (PDOException $error) {
        if (!is_duplicate_error($error)) throw $error;
        if (slot_is_taken($pdo, $schedule['slot_key'])) {
            fail(409, 'Sorry, that time was just taken. Please pick another one.', 'slot_taken');
        }
    }
}
fail(503, 'The server is busy. Please try again.');
