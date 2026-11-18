# Meridian Health (PHP + MySQL)

Frontend-focused hospital appointment booking website (HTML, CSS, JavaScript) with a PHP/MySQL backend.

> **First step:** copy `api/config.example.php` to `api/config.php` and fill in your own database and SMTP details. `config.php` is listed in `.gitignore` and must never be committed.

## Setup with XAMPP
1. Copy this whole folder to `C:\xampp\htdocs\meridian` and start **Apache** and **MySQL** in the XAMPP control panel.
2. Open http://localhost/phpmyadmin, click **Import**, and choose `database/schema.sql`.
   This creates the `meridian_health` database with three tables: `appointments`, `queues` and `users`.
   (If you already imported an older version, you do not need to import again: the `users` table is created automatically the first time the site runs.)
3. If your MySQL has a password (XAMPP default is none), edit `api/config.php` (created from `api/config.example.php`).
4. Open http://localhost/meridian/index.html (patients) and http://localhost/meridian/admin.html (front desk).

Do not open the pages by double-clicking the files. They must be opened through `http://localhost/...` so PHP can run.

## Setup WITHOUT XAMPP (SQLite, only PHP needed)
1. Install PHP (Windows: download the zip from https://windows.php.net/download, unzip to `C:\php`).
   Copy `php.ini-development` to `php.ini` and remove the `;` in front of `extension=pdo_sqlite` and `extension=sqlite3`.
   Check with `C:\php\php.exe -m` that both names appear.
2. In `api/config.php`, replace the MySQL `dsn` line with this one:
   `'dsn' => 'sqlite:' . __DIR__ . '/../database/meridian.sqlite',`
3. Open a terminal in this project folder and run: `C:\php\php.exe -S localhost:8000`
4. Open http://localhost:8000/index.html and http://localhost:8000/admin.html
There is nothing to import: the database file `database/meridian.sqlite` is created automatically.
This is for your own computer only. For a real website use MySQL with Apache.

## Patient accounts (users table)
Patients create an account (username + email + password) and then sign in with their email OR username.
- One email = one account (for Gmail, dots and `+tag` are ignored: `a.b+x@gmail.com` is the same as `ab@gmail.com`).
- One username = one account (not case sensitive).
- Passwords: 8 to 64 characters, no spaces, with an uppercase letter, a lowercase letter, a number and a special character.
- Passwords are saved only as a bcrypt hash (`password_hash` column), never as plain text.
- E-mail OTP: after sign-up a 6-digit code is e-mailed. The account only starts working after the code is entered (valid 10 minutes, 5 tries per code, a new code once a minute). Fake or other people's e-mails cannot be used.
- After 5 wrong passwords the account is locked for 5 minutes.
- Sign-in is a PHP session. `My appointments`, cancel and reschedule only work for the signed-in patient.
Open the `users` table in phpMyAdmin to see who registered: `email`, `username`, `password_hash`, `first_signed_in_at`, `last_signed_in_at`, `sign_in_count`.

## Patient profile
After signing in, click your name in the top bar (or **My profile** in the mobile menu) to open the profile page.
- View: username, full name, email, phone, date of birth, gender, blood group, address and the month you joined.
- Edit: press **Edit profile**, change the details and press **Save changes**. The email cannot be changed because it is used to sign in and to find your appointments. The username can be changed if nobody else uses it.
- The saved phone number and full name are filled in automatically when you book an appointment.
- The extra columns (`full_name`, `phone`, `date_of_birth`, `gender`, `blood_group`, `address`) are added to the `users` table automatically the first time the site runs, so an old database needs no re-import.
- API: `api/user-profile.php` (GET returns the profile, POST saves it; only works for a signed-in patient).

## E-mail setup for the verification code (Gmail)
Open `api/config.php` and fill in the `smtp` part:
1. Turn on **2-Step Verification** in your Google account: https://myaccount.google.com/security
2. Make an **App password**: https://myaccount.google.com/apppasswords (a 16 letter code).
3. Put your Gmail address in `username` and the app password in `password` (not your normal Gmail password).
4. XAMPP says "certificate verify failed"? Set `'verify_ssl' => false` (only on your own computer).
To test without sending real e-mails, set `'mail_transport' => 'log'`: the code is then written to `database/mail-outbox.log`.

## Front-desk login
Default username `admin`, password `admin123`. Change it in `api/config.php`
To make a new password hash, run: `php -r "echo password_hash('your-new-password', PASSWORD_DEFAULT);"` and paste the result into `admin_password_hash`.

## Folder map
- `index.html`, `admin.html` : the two pages
- `css/styles.css` : all styles (button colours are at the bottom, one class per button)
- `js/data.js` : hospitals, departments and the doctor names (`DOCTOR_NAMES`, 400 names in order: hospital by hospital, department by department, 10 per department; `EXTRA_DOCTORS` for doctor 401 and up)
- `js/api.js` : small helper that talks to the PHP files
- `js/store.js` : keeps the latest data from the server and sends changes to it
- `js/site.js`, `js/admin.js` : page logic
- `api/*.php` : the backend (one file per action; `user-signup.php`, `user-verify.php`, `user-resend-code.php`, `user-signin.php`, `user-signout.php`, `user-me.php`, `user-profile.php` are the patient accounts; `mail.php` sends the code)
- `database/schema.sql` : the database tables

Needs PHP 7.4 or newer.
