<?php
require __DIR__ . '/db.php';
require_method('POST');

start_admin_session();
$_SESSION = [];
session_destroy();
send_json(['ok' => true]);
