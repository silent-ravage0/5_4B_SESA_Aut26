<?php

function try_send_mail($to, $subject, $text) {
    $config = config();
    $transport = isset($config['mail_transport']) ? $config['mail_transport'] : 'smtp';

    if ($transport === 'log') {
        $line = "---- " . date('Y-m-d H:i:s') . " ----\nTo: $to\nSubject: $subject\n\n$text\n\n";
        file_put_contents(__DIR__ . '/../database/mail-outbox.log', $line, FILE_APPEND);
        return null;
    }

    $smtp = $config['smtp'];
    if ($smtp['username'] === '' || $smtp['password'] === '') {
        return [500, 'E-mail sending is not set up yet. Open api/config.php and fill in the smtp username and app password.', 'mail_not_configured'];
    }

    try {
        smtp_deliver($smtp, $to, $subject, $text);
    } catch (Exception $error) {
        error_log('Mail failed: ' . $error->getMessage());
        return [502, 'Could not send the verification e-mail. Please check the e-mail address and try again.', 'mail_failed'];
    }
    return null;
}

function smtp_read($socket) {
    $reply = '';
    while (($line = fgets($socket, 1024)) !== false) {
        $reply .= $line;
        if (strlen($line) < 4 || $line[3] === ' ') break;
    }
    return $reply;
}

function smtp_expect($socket, $command, $okCodes) {
    if ($command !== null) fwrite($socket, $command . "\r\n");
    $reply = smtp_read($socket);
    if (!in_array(substr($reply, 0, 3), $okCodes, true)) {
        throw new Exception('SMTP error after "' . ($command === null ? 'connect' : preg_replace('/^(AUTH LOGIN ).*/', '$1***', substr($command, 0, 20))) . '": ' . trim($reply));
    }
    return $reply;
}

function smtp_deliver($smtp, $to, $subject, $text) {
    $secure = $smtp['secure'];
    $host = ($secure === 'ssl' ? 'ssl://' : 'tcp://') . $smtp['host'];
    $context = stream_context_create(['ssl' => [
        'verify_peer' => !empty($smtp['verify_ssl']),
        'verify_peer_name' => !empty($smtp['verify_ssl']),
    ]]);
    $socket = @stream_socket_client($host . ':' . $smtp['port'], $errno, $errstr, 15, STREAM_CLIENT_CONNECT, $context);
    if (!$socket) {
        throw new Exception("Cannot connect to the mail server: $errstr ($errno)");
    }
    stream_set_timeout($socket, 15);

    $from = $smtp['from_email'] !== '' ? $smtp['from_email'] : $smtp['username'];
    $name = isset($smtp['from_name']) ? $smtp['from_name'] : 'Meridian Health';

    smtp_expect($socket, null, ['220']);
    smtp_expect($socket, 'EHLO localhost', ['250']);
    if ($secure === 'tls') {
        smtp_expect($socket, 'STARTTLS', ['220']);
        if (!stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
            throw new Exception('Could not start TLS.');
        }
        smtp_expect($socket, 'EHLO localhost', ['250']);
    }
    smtp_expect($socket, 'AUTH LOGIN', ['334']);
    smtp_expect($socket, base64_encode($smtp['username']), ['334']);
    smtp_expect($socket, base64_encode($smtp['password']), ['235']);
    smtp_expect($socket, 'MAIL FROM:<' . $from . '>', ['250']);
    smtp_expect($socket, 'RCPT TO:<' . $to . '>', ['250', '251']);
    smtp_expect($socket, 'DATA', ['354']);

    $headers = [
        'From: =?UTF-8?B?' . base64_encode($name) . '?= <' . $from . '>',
        'To: <' . $to . '>',
        'Subject: =?UTF-8?B?' . base64_encode($subject) . '?=',
        'Date: ' . date('r'),
        'Message-ID: <' . bin2hex(random_bytes(12)) . '@meridian.local>',
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: base64',
    ];
    $body = chunk_split(base64_encode($text), 76, "\r\n");
    fwrite($socket, implode("\r\n", $headers) . "\r\n\r\n" . $body . "\r\n.\r\n");
    smtp_expect($socket, null, ['250']);

    fwrite($socket, "QUIT\r\n");
    fclose($socket);
}
