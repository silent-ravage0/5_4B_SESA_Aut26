CREATE TABLE IF NOT EXISTS appointments (
  id            VARCHAR(12)  NOT NULL PRIMARY KEY,
  doctor_id     VARCHAR(10)  NOT NULL,
  date_key      VARCHAR(12)  NOT NULL,
  day_label     VARCHAR(30)  NOT NULL,
  time_label    VARCHAR(10)  NOT NULL,
  date_iso      VARCHAR(40)  NOT NULL,
  slot_hour     INTEGER      NOT NULL,
  slot_minute   INTEGER      NOT NULL,
  sort_key      BIGINT       NOT NULL,
  visit_mode    VARCHAR(12)  NOT NULL DEFAULT 'in-person',
  reason        VARCHAR(200) NOT NULL DEFAULT '',
  patient_type  VARCHAR(12)  NOT NULL DEFAULT 'new',
  status        VARCHAR(12)  NOT NULL DEFAULT 'upcoming',
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) NOT NULL,
  phone         VARCHAR(30)  NOT NULL DEFAULT '',
  fee           INTEGER      NOT NULL DEFAULT 0,
  queue_serial  INTEGER      NOT NULL,
  slot_key      VARCHAR(40)  NULL,
  created_at    BIGINT       NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_queue_serial ON appointments (doctor_id, date_key, queue_serial);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_slot_key ON appointments (slot_key);
CREATE INDEX IF NOT EXISTS idx_email ON appointments (email);
CREATE INDEX IF NOT EXISTS idx_doctor_day ON appointments (doctor_id, date_key);

CREATE TABLE IF NOT EXISTS users (
  email               VARCHAR(150) NOT NULL PRIMARY KEY,
  email_key           VARCHAR(150) NULL,
  username            VARCHAR(30)  NULL,
  username_key        VARCHAR(30)  NULL,
  name                VARCHAR(100) NOT NULL,
  password_hash       VARCHAR(255) NULL,
  failed_attempts     INTEGER      NOT NULL DEFAULT 0,
  locked_until        BIGINT        NOT NULL DEFAULT 0,
  first_signed_in_at  BIGINT        NOT NULL,
  last_signed_in_at   BIGINT        NOT NULL,
  sign_in_count       INTEGER      NOT NULL DEFAULT 0,
  email_verified      INTEGER      NOT NULL DEFAULT 0,
  verify_code_hash    VARCHAR(64)  NULL,
  verify_expires      BIGINT       NOT NULL DEFAULT 0,
  verify_attempts     INTEGER      NOT NULL DEFAULT 0,
  verify_sent_at      BIGINT       NOT NULL DEFAULT 0,
  full_name           VARCHAR(100) NULL,
  phone               VARCHAR(30)  NULL,
  date_of_birth       VARCHAR(10)  NULL,
  gender              VARCHAR(10)  NULL,
  blood_group         VARCHAR(4)   NULL,
  address             VARCHAR(200) NULL,
  UNIQUE (email_key),
  UNIQUE (username_key)
);

CREATE TABLE IF NOT EXISTS queues (
  doctor_id   VARCHAR(10) NOT NULL,
  date_key    VARCHAR(12) NOT NULL,
  serving     INTEGER     NULL,
  completed   TEXT        NOT NULL,
  updated_at  BIGINT      NOT NULL,
  PRIMARY KEY (doctor_id, date_key)
);
