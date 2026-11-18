<?php
// Copy this file to config.php and fill in your own values. config.php is git-ignored.
return [
    'dsn'     => 'mysql:host=localhost;dbname=meridian_health;charset=utf8mb4',

    'db_user' => 'root',
    'db_pass' => '',

    'admin_username'      => 'admin',
    'admin_password_hash' => '$2y$10$gLn7s6qE6m4t7PZfsf8a5exC39fBKvbMk8xt7H3vEuJYzjEN2Dr7K',

    'doctors_per_department'            => 10,
    'emergency_doctors_per_department'  => 3,
    'main_doctor_count'                 => 400,

    'timezone' => 'Asia/Dhaka',

    'mail_transport' => 'smtp',

    'smtp' => [
        'host'       => 'smtp.gmail.com',
        'port'       => 465,
        'secure'     => 'ssl',
        'username'   => '', 
        'password'   => '',
        'from_email' => '',
        'from_name'  => 'Meridian Health',
        'verify_ssl' => true,
    ],

    'otp_minutes' => 10,
];
