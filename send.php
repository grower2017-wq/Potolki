<?php
/**
 * Приём заявок с сайта.
 * Отправляет письмо на почту и (по желанию) сообщение в Telegram-бот.
 * Настройки — в файле send-config.php (создайте его по образцу send-config.sample.php).
 */

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

function respond($code, $data)
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function clean($value, $max)
{
    if (!is_string($value)) {
        return '';
    }
    $value = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $value);
    $value = trim($value);
    return function_exists('mb_substr') ? mb_substr($value, 0, $max, 'UTF-8') : substr($value, 0, $max);
}

function clean_list($value, $max)
{
    $out = array();
    if (is_array($value)) {
        foreach (array_slice($value, 0, 12) as $v) {
            $c = clean($v, $max);
            if ($c !== '') {
                $out[] = $c;
            }
        }
    }
    return $out;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    respond(405, array('ok' => false, 'error' => 'method_not_allowed'));
}

$cfgFile = __DIR__ . '/send-config.php';
$cfg = is_file($cfgFile) ? require $cfgFile : array();
$to      = is_array($cfg) && !empty($cfg['to_email']) ? trim($cfg['to_email']) : '';
$tgToken = is_array($cfg) && !empty($cfg['telegram_token']) ? trim($cfg['telegram_token']) : '';
$tgChat  = is_array($cfg) && !empty($cfg['telegram_chat_id']) ? trim($cfg['telegram_chat_id']) : '';
$logFile = is_array($cfg) && !empty($cfg['log_file']) ? $cfg['log_file'] : '';

if ($to === '' && ($tgToken === '' || $tgChat === '')) {
    respond(503, array('ok' => false, 'error' => 'not_configured'));
}

$raw = file_get_contents('php://input', false, null, 0, 20000);
$in = json_decode((string) $raw, true);
if (!is_array($in)) {
    respond(400, array('ok' => false, 'error' => 'bad_request'));
}

// Ловушка для ботов: поле скрыто от людей. Бот заполняет — делаем вид, что всё хорошо.
if (!empty($in['website'])) {
    respond(200, array('ok' => true));
}

$name    = clean($in['name'] ?? '', 80);
$phone   = clean($in['phone'] ?? '', 30);
$channel = clean($in['channel'] ?? '', 30);
$source  = clean($in['source'] ?? '', 40);
$page    = clean($in['page'] ?? '', 300);

if (mb_strlen($name, 'UTF-8') < 2 || strlen(preg_replace('/\D/', '', $phone)) !== 11) {
    respond(422, array('ok' => false, 'error' => 'validation'));
}

// Не чаще одной заявки в 20 секунд с одного адреса.
$ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$rateFile = sys_get_temp_dir() . '/lead_' . md5($ip);
if (is_file($rateFile) && (time() - (int) @filemtime($rateFile)) < 20) {
    respond(429, array('ok' => false, 'error' => 'too_many'));
}

$quiz = isset($in['quiz']) && is_array($in['quiz']) ? $in['quiz'] : null;
$lines = array();
$lines[] = 'Новая заявка с сайта';
$lines[] = '';
$lines[] = 'Имя: ' . $name;
$lines[] = 'Телефон: ' . $phone;
$lines[] = 'Куда прислать расчёт: ' . ($channel !== '' ? $channel : 'не указано');
if ($quiz) {
    $lines[] = '';
    $lines[] = 'Ответы квиза:';
    $obj = clean($quiz['object'] ?? '', 80);
    $rooms = clean_list($quiz['rooms'] ?? array(), 60);
    $area = clean($quiz['area'] ?? '', 12);
    $type = clean($quiz['type'] ?? '', 80);
    $light = clean_list($quiz['light'] ?? array(), 80);
    if ($obj !== '')   { $lines[] = 'Объект: ' . $obj; }
    if ($rooms)        { $lines[] = 'Помещения: ' . implode(', ', $rooms); }
    if ($area !== '')  { $lines[] = 'Площадь: ' . $area . ' м²'; }
    if ($type !== '')  { $lines[] = 'Вид потолка: ' . $type; }
    if ($light)        { $lines[] = 'Свет: ' . implode(', ', $light); }
}
$lines[] = '';
$lines[] = 'Форма: ' . ($source !== '' ? $source : '-');
if ($page !== '') {
    $lines[] = 'Страница: ' . $page;
}
if (isset($in['utm']) && is_array($in['utm'])) {
    foreach (array_slice($in['utm'], 0, 8, true) as $k => $v) {
        $lines[] = clean((string) $k, 30) . ': ' . clean((string) $v, 120);
    }
}
$lines[] = 'Время: ' . date('d.m.Y H:i:s') . ' (сервер)';
$body = implode("\n", $lines);

$sent = false;

// --- Почта ---
if ($to !== '' && filter_var($to, FILTER_VALIDATE_EMAIL)) {
    $host = preg_replace('/[^a-z0-9.\-]/i', '', preg_replace('/^www\./i', '', $_SERVER['HTTP_HOST'] ?? 'localhost'));
    $from = 'noreply@' . ($host !== '' ? $host : 'localhost');
    $subject = '=?UTF-8?B?' . base64_encode('Заявка с сайта: ' . str_replace(array("\r", "\n"), ' ', $name)) . '?=';
    $headers = array(
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: 8bit',
        'From: =?UTF-8?B?' . base64_encode('Сайт STATYS Потолки') . '?= <' . $from . '>',
    );
    if (@mail($to, $subject, $body, implode("\r\n", $headers), '-f' . $from)) {
        $sent = true;
    }
}

// --- Telegram ---
if ($tgToken !== '' && $tgChat !== '') {
    $url = 'https://api.telegram.org/bot' . $tgToken . '/sendMessage';
    $data = http_build_query(array('chat_id' => $tgChat, 'text' => $body));
    $ctx = stream_context_create(array('http' => array(
        'method' => 'POST',
        'header' => "Content-Type: application/x-www-form-urlencoded\r\n",
        'content' => $data,
        'timeout' => 8,
        'ignore_errors' => true,
    )));
    $res = @file_get_contents($url, false, $ctx);
    $j = $res ? json_decode($res, true) : null;
    if (is_array($j) && !empty($j['ok'])) {
        $sent = true;
    }
}

// --- Резервный журнал (на случай, если почта не дошла) ---
if ($logFile !== '') {
    @file_put_contents($logFile, "----\n" . $body . "\nstatus: " . ($sent ? 'sent' : 'NOT SENT') . "\n", FILE_APPEND | LOCK_EX);
}

if (!$sent) {
    respond(502, array('ok' => false, 'error' => 'send_failed'));
}

@touch($rateFile);
respond(200, array('ok' => true));
