<?php
/*
 * BOONS form endpoint: booking requests (/book) and BOONS COLLECTIVE sign-ups (/collective).
 * Lives on the Vimexx hosting at https://form.boons-agency.nl/send.php
 * Upload to domains/form.boons-agency.nl/public_html: send.php, .htaccess, mail-template.html,
 * boons-logo.png, gradient.png, bg-page.png and bg-card.png (the last five make the styled emails).
 *
 * 1. checks the request: honeypot, rate limit per IP, other websites refused, an hourly emergency
 *    brake, link spam ignored, at most 3 confirmation emails per address per day, required fields
 * 2. mails it to Bookings@boons-agency.nl, Reply-To = the sender, so Finn can answer directly
 * 3. mails the sender a styled confirmation (HTML, with a plain-text version inside)
 * 4. answers JSON for the site's own JavaScript, or redirects back when posted without JavaScript
 *
 * Mail goes out through the server's own mail system (PHP mail()), so it is signed with the
 * domain's DKIM key and matches the SPF record.
 */

const TO_ADDRESS   = 'Bookings@boons-agency.nl';
const FROM_ADDRESS = 'Bookings@boons-agency.nl';
const SITE         = 'https://boons-agency.nl';
const ALLOWED_ORIGINS = ['https://boons-agency.nl', 'https://www.boons-agency.nl', 'http://127.0.0.1:8000'];
const RATE_LIMIT   = 5;      // requests per IP ...
const RATE_WINDOW  = 3600;   // ... per hour
const GLOBAL_LIMIT = 40;     // requests per hour from everyone together (emergency brake)
const CONFIRMATIONS_PER_ADDRESS = 3;   // confirmation emails per address per day
const ARTISTS      = ['GIBBS', 'BURNEY', 'BURNEY b2b GIBBS', 'Not sure yet'];
const ROLES        = ['DJ', 'Producer', 'VJ', 'Light jockey', 'Photographer', 'Videographer', 'Graphic designer',
                      'Content creator', 'Promoter / organiser', 'Other'];

header('X-Content-Type-Options: nosniff');
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, ALLOWED_ORIGINS, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Accept, Content-Type');
}
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$wantsJson = stripos($_SERVER['HTTP_ACCEPT'] ?? '', 'application/json') !== false;
$lang = (($_POST['lang'] ?? '') === 'nl') ? 'nl' : 'en';
$t = fn(string $en, string $nl): string => $lang === 'nl' ? $nl : $en;
$base = SITE . ($lang === 'nl' ? '/nl' : '');   // pages in the visitor's language


// ---------- helpers ----------

function reply(int $status, array $body, bool $json): void {
    http_response_code($status);
    if ($json) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($body, JSON_UNESCAPED_UNICODE);
    } else {
        header('Content-Type: text/plain; charset=utf-8');
        echo ($body['ok'] ?? false) ? 'OK' : implode("\n", array_column($body['errors'] ?? [], 'message'));
    }
    exit;
}

function fail(string $message, bool $json, int $status = 422): void {
    reply($status, ['ok' => false, 'errors' => [['message' => $message]]], $json);
}

// Fields: trimmed, length-capped, no line breaks in single-line values.
function field(string $key, int $max, bool $multiline = false): string {
    $v = trim((string) ($_POST[$key] ?? ''));
    if (!$multiline) $v = preg_replace('/[\r\n\t]+/', ' ', $v);
    return mb_substr($v, 0, $max);
}

function h(string $s): string {
    return htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
}

// Plain text, or HTML with the plain text inside as the fallback part.
function send(string $to, string $subject, string $text, string $replyTo, ?string $html = null, string $sender = 'BOONS AGENCY'): bool {
    $headers = [
        'From: ' . mb_encode_mimeheader($sender, 'UTF-8') . ' <' . FROM_ADDRESS . '>',
        'Reply-To: ' . $replyTo,
        'MIME-Version: 1.0',
        'X-Mailer: boons-agency.nl',
    ];
    if ($html === null) {
        $headers[] = 'Content-Type: text/plain; charset=UTF-8';
        $headers[] = 'Content-Transfer-Encoding: 8bit';
        $body = $text;
    } else {
        $b = 'boons-' . bin2hex(random_bytes(8));
        $headers[] = 'Content-Type: multipart/alternative; boundary="' . $b . '"';
        $body = "--$b\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
              . chunk_split(base64_encode($text))
              . "--$b\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
              . chunk_split(base64_encode($html))
              . "--$b--\r\n";
    }
    return mail($to, mb_encode_mimeheader($subject, 'UTF-8'), $body, implode("\r\n", $headers), '-f' . FROM_ADDRESS);
}

// The styled email: mail-template.html with the values filled in (all escaped).
function mail_html(array $v): ?string {
    $tpl = @file_get_contents(__DIR__ . '/mail-template.html');
    if ($tpl === false) return null;
    $rows = '';
    foreach ($v['rows'] as $label => $value) {
        $rows .= '<div style="padding:10px 0 0;"><div style="font-family:SFMono-Regular,Menlo,Consolas,\'Courier New\',monospace;font-size:11px;'
               . 'letter-spacing:1.5px;text-transform:uppercase;color:#948FA3;">' . h($label) . '</div>'
               . '<div style="padding-top:3px;font-family:Arial,Helvetica,sans-serif;font-size:17px;line-height:1.4;color:#F5F1E8;">'
               . h($value) . '</div></div>';
    }
    return strtr($tpl, [
        '{{LANG}}' => h($v['lang']), '{{SUBJECT}}' => h($v['subject']), '{{PREHEADER}}' => h($v['preheader']),
        '{{LABEL}}' => h($v['label']), '{{HEADING}}' => h($v['heading']),
        '{{INTRO}}' => nl2br(h($v['intro'])), '{{ROWS}}' => $rows, '{{OUTRO}}' => nl2br(h($v['outro'])),
        '{{BUTTON_URL}}' => h($v['button_url']), '{{BUTTON_TEXT}}' => h($v['button_text']),
        '{{SENDER}}' => h($v['sender']), '{{NOTICE}}' => h($v['notice']),
    ]);
}

$notice = $t(
    "Didn't request this? Someone probably entered your email address by mistake. You can ignore this email; we won't email you again.",
    'Heb je dit niet zelf aangevraagd? Dan heeft iemand waarschijnlijk per ongeluk jouw e-mailadres ingevuld. Je kunt deze mail negeren; we mailen je niet opnieuw.'
);
$signoff = fn(string $sender): string => "\n\n--\n" . $sender . "\nBookings@boons-agency.nl\n" . SITE . "\n\n" . $GLOBALS['notice'] . "\n";


// ---------- checks for every request ----------

if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Method not allowed', $wantsJson, 405);

// Bots fill the hidden field: pretend it worked, send nothing.
if (trim($_POST['_gotcha'] ?? '') !== '') reply(200, ['ok' => true], $wantsJson);

// Rate limit per IP (hashed, never stored in plain text), files in ./data (blocked by .htaccess).
$dir = __DIR__ . '/data';
if (!is_dir($dir)) @mkdir($dir, 0700);
$ipFile = $dir . '/' . hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . 'boons') . '.json';
$now = time();
$hits = is_file($ipFile) ? (json_decode((string) @file_get_contents($ipFile), true) ?: []) : [];
$hits = array_values(array_filter($hits, fn($ts) => $ts > $now - RATE_WINDOW));
if (count($hits) >= RATE_LIMIT) {
    fail($t('Too many requests. Please mail Bookings@boons-agency.nl directly.',
            'Te veel aanvragen. Mail ons direct op Bookings@boons-agency.nl.'), $wantsJson, 429);
}
$hits[] = $now;
@file_put_contents($ipFile, json_encode($hits), LOCK_EX);

// A request that visibly comes from another website: refuse.
if ($origin !== '' && !in_array($origin, ALLOWED_ORIGINS, true)) fail('Not allowed', $wantsJson, 403);

// Emergency brake: more than GLOBAL_LIMIT requests in an hour, from anywhere, is never real traffic.
$allFile = $dir . '/_all.json';
$all = is_file($allFile) ? (json_decode((string) @file_get_contents($allFile), true) ?: []) : [];
$all = array_values(array_filter($all, fn($ts) => $ts > $now - RATE_WINDOW));
if (count($all) >= GLOBAL_LIMIT) {
    fail($t('The form is very busy right now. Please mail Bookings@boons-agency.nl directly.',
            'Het formulier is nu erg druk. Mail ons direct op Bookings@boons-agency.nl.'), $wantsJson, 429);
}
$all[] = $now;
@file_put_contents($allFile, json_encode($all), LOCK_EX);

// Link spam: a link in a name-like field, or more than one link in the free text. Pretend it worked, send nothing.
$countLinks = fn(string $s): int => preg_match_all('~(https?://|www\.|\[url|<a\s)~i', $s);
foreach (['name', 'artist_name', 'city', 'event', 'set_time', 'lineup', 'sound', 'phone'] as $k) {
    if ($countLinks((string) ($_POST[$k] ?? '')) > 0) reply(200, ['ok' => true], $wantsJson);
}
if ($countLinks((string) ($_POST['message'] ?? '')) > 1) reply(200, ['ok' => true], $wantsJson);

// Cloudflare Turnstile: is there a person behind this form? The secret key sits in
// turnstile-secret.php on this server only (not in the public repo). No key file: check skipped.
$secretFile = __DIR__ . '/turnstile-secret.php';
$secret = is_file($secretFile) ? include $secretFile : '';
if (is_string($secret) && $secret !== '' && strpos($secret, 'PASTE_') === false) {
    $token = (string) ($_POST['cf-turnstile-response'] ?? '');
    if ($token === '') {
        fail($t('Please wait a second for the spam check, then send again.',
                'Wacht even op de spamcheck en verstuur het dan opnieuw.'), $wantsJson, 403);
    }
    $payload = http_build_query(['secret' => $secret, 'response' => $token, 'remoteip' => $_SERVER['REMOTE_ADDR'] ?? '']);
    $url = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
    $answer = false;
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => $payload, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 8]);
        $answer = curl_exec($ch);
        curl_close($ch);
    } else {
        $answer = @file_get_contents($url, false, stream_context_create(['http' => [
            'method' => 'POST', 'header' => "Content-Type: application/x-www-form-urlencoded\r\n", 'content' => $payload, 'timeout' => 8]]));
    }
    // Cloudflare unreachable: let it through (the other checks still apply) rather than lose a real booking.
    if ($answer !== false && (json_decode((string) $answer, true)['success'] ?? false) !== true) {
        fail($t('The spam check did not pass. Please try again, or mail Bookings@boons-agency.nl.',
                'De spamcheck ging niet goed. Probeer het opnieuw, of mail naar Bookings@boons-agency.nl.'), $wantsJson, 403);
    }
}

// At most CONFIRMATIONS_PER_ADDRESS confirmation emails per address per day, so nobody can use
// the form to flood someone's inbox. Stored as a hash, never the address itself.
function confirmation_allowed(string $email): bool {
    $file = __DIR__ . '/data/m-' . hash('sha256', strtolower(trim($email)) . 'boons') . '.json';
    $now = time();
    $sent = is_file($file) ? (json_decode((string) @file_get_contents($file), true) ?: []) : [];
    $sent = array_values(array_filter($sent, fn($ts) => $ts > $now - 86400));
    if (count($sent) >= CONFIRMATIONS_PER_ADDRESS) return false;
    $sent[] = $now;
    @file_put_contents($file, json_encode($sent), LOCK_EX);
    return true;
}


// ---------- BOONS COLLECTIVE sign-up (the form on /collective) ----------

if (($_POST['form'] ?? '') === 'BOONS COLLECTIVE') {
    $c = [
        'role'        => field('role', 40),
        'artist_name' => field('artist_name', 100),
        'name'        => field('name', 100),
        'email'       => field('email', 150),
        'phone'       => field('phone', 40),
        'city'        => field('city', 100),
        'sound'       => field('sound', 200),
        'instagram'   => field('instagram', 100),
        'mix'         => field('mix', 300),
        'source'      => field('source', 60),
        'message'     => field('message', 3000, true),
    ];
    // "What are you looking for?": only the known options, as one line
    $wanted = ['Gigs', 'B2B partners', 'Collaborations', 'Feedback and network'];
    $picked = array_values(array_intersect($wanted, array_map('strval', (array) ($_POST['looking_for'] ?? []))));
    $missing = [];
    foreach (['role', 'artist_name', 'name', 'email', 'phone', 'city', 'sound', 'instagram'] as $k) {
        if ($c[$k] === '') $missing[] = $k;
    }
    if ($missing) fail($t('Please fill in: ', 'Vul nog in: ') . implode(', ', $missing), $wantsJson);
    if (!filter_var($c['email'], FILTER_VALIDATE_EMAIL)) fail($t('That email address does not look right.', 'Dat e-mailadres klopt niet.'), $wantsJson);
    if (!preg_match('/^\+?[0-9 ()\-]{8,20}$/', $c['phone'])) fail($t('That phone number does not look right.', 'Dat telefoonnummer klopt niet.'), $wantsJson);
    if (!in_array($c['role'], ROLES, true)) fail($t('Please choose what you do.', 'Kies wat je doet.'), $wantsJson);
    if (($_POST['age_18'] ?? '') !== 'yes') fail($t('The collective is for people aged 18 or older.', 'Het collective is voor mensen van 18 jaar of ouder.'), $wantsJson);
    if (($_POST['listed_ok'] ?? '') !== 'yes') fail($t('Members are listed on the Collective page. Please tick that box to join.',
                                                     'Leden staan op de Collective-pagina. Vink dat vakje aan om je aan te melden.'), $wantsJson);

    // 1. To Bookings@ (plain text, for handling)
    $rows = ['Role' => $c['role'], 'Artist name' => $c['artist_name'], 'Name' => $c['name'], 'Email' => $c['email'],
             'Phone / WhatsApp' => $c['phone'], 'City' => $c['city'], 'Sound / style' => $c['sound'],
             'Instagram' => $c['instagram'], 'Portfolio / mix' => $c['mix'], 'Looking for' => implode(', ', $picked),
             'Found us via' => $c['source'], '18 or older' => 'yes', 'OK to be listed' => 'yes', 'Site language' => strtoupper($lang)];
    $body = "New BOONS COLLECTIVE sign-up via boons-agency.nl\n\n";
    foreach ($rows as $label => $value) {
        if ($value !== '') $body .= $label . ': ' . $value . "\n";
    }
    if ($c['message'] !== '') $body .= "\nAbout them:\n" . $c['message'] . "\n";
    $body .= "\nReply to this email to answer " . $c['artist_name'] . " directly.\n";
    if (!send(TO_ADDRESS, 'Collective sign-up: ' . $c['artist_name'] . ' (' . $c['role'] . ')', $body, $c['email'])) {
        fail($t('Something went wrong. Please mail Bookings@boons-agency.nl instead.',
                'Er ging iets mis. Mail ons in plaats daarvan op Bookings@boons-agency.nl.'), $wantsJson, 500);
    }

    // 2. Welcome to the new member (styled)
    $roleNl = ['Photographer' => 'Fotograaf', 'Videographer' => 'Videograaf', 'Graphic designer' => 'Grafisch ontwerper',
               'Promoter / organiser' => 'Promoter / organisator', 'Other' => 'Iets anders'];
    $role = $lang === 'nl' ? ($roleNl[$c['role']] ?? $c['role']) : ($c['role'] === 'Other' ? 'Something else' : $c['role']);
    $subject = $t('Welcome to BOONS COLLECTIVE', 'Welkom bij BOONS COLLECTIVE');
    $intro = $t(
        "Hi {$c['name']}, thanks for signing up for BOONS COLLECTIVE, the network of DJs and creatives from the scene. Your sign-up is in.",
        "Hoi {$c['name']}, bedankt voor je aanmelding voor BOONS COLLECTIVE, het netwerk van DJ's en creatives uit de scene. Je aanmelding is binnen."
    );
    $outro = $t(
        "We look at every sign-up personally and will let you know either way.\nQuestions, or something to add? Just reply to this email.",
        "We bekijken elke aanmelding zelf en laten je hoe dan ook iets weten.\nVragen, of wil je nog iets toevoegen? Beantwoord gewoon deze mail."
    );
    $details = [$t('What you do', 'Wat je doet') => $role, $t('Artist name', 'Artiestennaam') => $c['artist_name'], $t('City', 'Stad') => $c['city']];
    $text = $intro . "\n\n";
    foreach ($details as $label => $value) $text .= $label . ': ' . $value . "\n";
    $text .= "\n" . $outro . $signoff('BOONS COLLECTIVE');
    $html = mail_html([
        'lang' => $lang, 'subject' => $subject, 'preheader' => $t('Your sign-up is in.', 'Je aanmelding is binnen.'),
        'label' => 'BOONS COLLECTIVE', 'heading' => $t('Welcome.', 'Welkom.'), 'intro' => $intro, 'rows' => $details,
        'outro' => $outro, 'button_text' => $t('See the collective', 'Bekijk het collective'),
        'button_url' => $base . '/collective', 'sender' => 'BOONS COLLECTIVE', 'notice' => $notice,
    ]);
    if (confirmation_allowed($c['email'])) send($c['email'], $subject, $text, TO_ADDRESS, $html, 'BOONS COLLECTIVE');

    if ($wantsJson) reply(200, ['ok' => true], true);
    header('Location: ' . $base . '/collective?joined=1#join', true, 303);
    exit;
}


// ---------- booking request (the form on /book) ----------

$d = [
    'name'       => field('name', 100),
    'email'      => field('email', 150),
    'phone'      => field('phone', 40),
    'artist'     => field('artist', 40),
    'date'       => field('date', 10),
    'city'       => field('city', 100),
    'event_type' => field('event_type', 60),
    'event'      => field('event', 150),
    'set_time'   => field('set_time', 100),
    'lineup'     => field('lineup', 300),
    'capacity'   => field('capacity', 40),
    'budget'     => field('budget', 40),
    'message'    => field('message', 3000, true),
];

$missing = [];
foreach (['name', 'email', 'artist', 'date', 'city', 'event_type', 'event', 'capacity'] as $k) {
    if ($d[$k] === '') $missing[] = $k;
}
if ($missing) fail($t('Please fill in: ', 'Vul nog in: ') . implode(', ', $missing), $wantsJson);
if (!filter_var($d['email'], FILTER_VALIDATE_EMAIL)) fail($t('That email address does not look right.', 'Dat e-mailadres klopt niet.'), $wantsJson);
if (!in_array($d['artist'], ARTISTS, true)) fail($t('Please choose an artist.', 'Kies een artiest.'), $wantsJson);
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $d['date']) || !checkdate((int) substr($d['date'], 5, 2), (int) substr($d['date'], 8, 2), (int) substr($d['date'], 0, 4))) {
    fail($t('Please choose a valid date.', 'Kies een geldige datum.'), $wantsJson);
}

// Reference from the site (BOONS-YYMM-NNNN), or make one when it is missing / malformed.
$ref = (string) ($_POST['reference'] ?? '');
if (!preg_match('/^BOONS-\d{4}-\d{4}$/', $ref)) $ref = 'BOONS-' . date('ym') . '-' . str_pad((string) random_int(0, 9999), 4, '0', STR_PAD_LEFT);

$dateObj = DateTime::createFromFormat('Y-m-d', $d['date']);
$months = $lang === 'nl'
    ? ['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december']
    : ['January','February','March','April','May','June','July','August','September','October','November','December'];
$days = $lang === 'nl'
    ? ['zondag','maandag','dinsdag','woensdag','donderdag','vrijdag','zaterdag']
    : ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
$niceDate = $days[(int) $dateObj->format('w')] . ' ' . (int) $dateObj->format('j') . ' ' . $months[(int) $dateObj->format('n') - 1] . ' ' . $dateObj->format('Y');

// 1. The request, to Bookings@ (plain text, for handling)
$rows = [
    'Reference'  => $ref,
    'Name'       => $d['name'],
    'Email'      => $d['email'],
    'Phone'      => $d['phone'],
    'Artist'     => $d['artist'],
    'Date'       => $d['date'] . ' (' . $niceDate . ')',
    'City'       => $d['city'],
    'Event type' => $d['event_type'],
    'Event'      => $d['event'],
    'Set time'   => $d['set_time'],
    'Line-up'    => $d['lineup'],
    'Capacity'   => $d['capacity'],
    'Budget'     => $d['budget'] !== '' ? $d['budget'] : 'Rather discuss it',
    'Site language' => strtoupper($lang),
];
$body = "New booking request via boons-agency.nl\n\n";
foreach ($rows as $label => $value) {
    if ($value !== '') $body .= $label . ': ' . $value . "\n";
}
if ($d['message'] !== '') $body .= "\nMessage:\n" . $d['message'] . "\n";
$body .= "\nReply to this email to answer " . $d['name'] . " directly.\n";

$subject = 'Booking request ' . $ref . ': ' . $d['artist'] . ', ' . $d['date'] . ', ' . $d['event'];
if (!send(TO_ADDRESS, $subject, $body, $d['email'])) {
    fail($t('Something went wrong. Please mail Bookings@boons-agency.nl instead.',
            'Er ging iets mis. Mail ons in plaats daarvan op Bookings@boons-agency.nl.'), $wantsJson, 500);
}

// 2. Confirmation to the promoter (styled)
$confirmSubject = $t('We received your request', 'Je aanvraag is binnen') . ' (' . $ref . ')';
$intro = $t(
    "Hi {$d['name']}, thanks for your booking request. Finn Bes, who handles our bookings, will pick it up.",
    "Hoi {$d['name']}, bedankt voor je boekingsaanvraag. Finn Bes, die onze boekingen doet, pakt hem voor je op."
);
$outro = $t(
    "You'll hear back from Finn within two working days, also if the answer is no.\nSomething urgent, or a detail to add? Reply to this email and keep the reference in the subject.",
    "Je hoort binnen twee werkdagen van Finn, ook als het antwoord nee is.\nIets dringends of wil je nog iets toevoegen? Beantwoord deze mail en laat de referentie in het onderwerp staan."
);
$details = [
    $t('Reference', 'Referentie') => $ref,
    $t('Artist', 'Artiest')       => $d['artist'],
    $t('Date', 'Datum')           => $niceDate,
    'Event'                       => $d['event'] . ', ' . $d['city'],
];
$pages = ['GIBBS' => '/gibbs', 'BURNEY' => '/burney'];
if (isset($pages[$d['artist']])) {
    $buttonText = $t($d['artist'] . ' press kit', 'Press kit van ' . $d['artist']);
    $buttonUrl = $base . $pages[$d['artist']] . '#presskit';
} else {
    $buttonText = $t('Back to the artists', 'Terug naar de artiesten');
    $buttonUrl = $base . '/#roster';
}
$text = $intro . "\n\n";
foreach ($details as $label => $value) $text .= $label . ': ' . $value . "\n";
$text .= "\n" . $outro . $signoff('BOONS AGENCY');
$html = mail_html([
    'lang' => $lang, 'subject' => $confirmSubject, 'preheader' => $ref . ' · ' . $d['artist'] . ' · ' . $niceDate,
    'label' => $t('Request received', 'Aanvraag ontvangen'), 'heading' => $t("That's in.", 'Binnen.'),
    'intro' => $intro, 'rows' => $details, 'outro' => $outro,
    'button_text' => $buttonText, 'button_url' => $buttonUrl, 'sender' => 'BOONS AGENCY', 'notice' => $notice,
]);
// a failed or skipped confirmation does not fail the request: Bookings@ has it either way
if (confirmation_allowed($d['email'])) send($d['email'], $confirmSubject, $text, TO_ADDRESS, $html);

// 3. Answer
if ($wantsJson) reply(200, ['ok' => true, 'reference' => $ref], true);
header('Location: ' . $base . '/thanks?' . http_build_query(['artist' => $d['artist'], 'ref' => $ref]), true, 303);
exit;
