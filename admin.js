(function () {
"use strict";

const D = window.MeridianData;
const Store = window.MeridianStore;
const ICONS = D.ICONS;
const DEPARTMENTS = D.DEPARTMENTS;
const HOSPITALS = D.HOSPITALS;
const DOCTORS = D.DOCTORS;
const escapeHtml = D.escapeHtml;
const TODAY_KEY = D.dateKey(D.DAYS[0]);
const PAGE_SIZE = 12;
const THEME_KEY = 'meridian.theme';

const state = {
  theme: 'light',
  filter: { hospital: 'all', dept: 'all', search: '', onlyActive: false, visible: PAGE_SIZE },
  openStat: null
};

function $(selector, parent) {
  return (parent || document).querySelector(selector);
}

function $all(selector, parent) {
  return Array.from((parent || document).querySelectorAll(selector));
}

function createElement(tag, attributes, html) {
  const element = document.createElement(tag);
  Object.keys(attributes || {}).forEach(function (name) {
    if (name === 'class') element.className = attributes[name];
    else element.setAttribute(name, attributes[name]);
  });
  if (html !== undefined) element.innerHTML = html;
  return element;
}

function showToast(message) {
  const toast = createElement('div', { class: 'toast', role: 'status' }, ICONS.check + '<span></span>');
  $('span', toast).textContent = message;
  $('#toastStack').appendChild(toast);
  setTimeout(function () {
    toast.style.transition = 'opacity .3s ease, transform .3s ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    setTimeout(function () { toast.remove(); }, 320);
  }, 3000);
}

function loadSavedTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved) return saved;
  } catch (error) { }
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
}

function applyTheme() {
  const button = $('#themeToggle');
  const isLight = state.theme === 'light';
  document.documentElement.setAttribute('data-theme', state.theme);
  button.innerHTML = isLight ? ICONS.moon : ICONS.sun;
  button.setAttribute('aria-label', isLight ? 'Switch to dark theme' : 'Switch to light theme');
}

$('#themeToggle').addEventListener('click', function () {
  state.theme = state.theme === 'light' ? 'dark' : 'light';
  try { localStorage.setItem(THEME_KEY, state.theme); } catch (error) { }
  applyTheme();
});

state.theme = loadSavedTheme();
applyTheme();

function twoDigits(number) {
  return number < 10 ? '0' + number : String(number);
}

function updateClock() {
  const now = new Date();
  const time = twoDigits(now.getHours()) + ':' + twoDigits(now.getMinutes()) + ':' + twoDigits(now.getSeconds());
  $('#adminClock').textContent = D.fmtDay(now, { long: true }) + ' · ' + time;
}

updateClock();
setInterval(updateClock, 1000);

function fillFilterDropdowns() {
  const hospitalOptions = HOSPITALS.map(function (hospital) {
    return '<option value="' + hospital.id + '">' + escapeHtml(hospital.name) + '</option>';
  }).join('');
  $('#filterHospital').innerHTML = '<option value="all">All hospitals</option>' + hospitalOptions;
  $('#filterHospital').value = state.filter.hospital;

  const deptOptions = DEPARTMENTS.map(function (dept) {
    return '<option value="' + dept.id + '">' + escapeHtml(dept.name) + '</option>';
  }).join('');
  $('#filterDept').innerHTML = '<option value="all">All departments</option>' + deptOptions;
  $('#filterDept').value = state.filter.dept;
}

function changeFilter(name, value) {
  state.filter[name] = value;
  state.filter.visible = PAGE_SIZE;
  renderBoard();
}

$('#filterHospital').addEventListener('change', function (event) { changeFilter('hospital', event.target.value); });
$('#filterDept').addEventListener('change', function (event) { changeFilter('dept', event.target.value); });
$('#filterSearch').addEventListener('input', function (event) { changeFilter('search', event.target.value); });
$('#filterActiveOnly').addEventListener('change', function (event) { changeFilter('onlyActive', event.target.checked); });

function getFilteredDoctors() {
  const search = state.filter.search.trim().toLowerCase();

  return DOCTORS.filter(function (doctor) {
    if (state.filter.hospital !== 'all' && doctor.hospitalId !== state.filter.hospital) return false;
    if (state.filter.dept !== 'all' && doctor.deptId !== state.filter.dept) return false;
    if (search && doctor.name.toLowerCase().indexOf(search) === -1) return false;
    if (state.filter.onlyActive && Store.getQueueInfo(doctor.id, TODAY_KEY).total === 0) return false;
    return true;
  });
}

function showStats(doctors) {
  let patients = 0;
  let inRoom = 0;
  let waiting = 0;

  doctors.forEach(function (doctor) {
    const info = Store.getQueueInfo(doctor.id, TODAY_KEY);
    patients += info.total;
    if (info.serving !== null) inRoom += 1;
    waiting += info.waitingSerials.length;
  });

  $('#statDoctors').textContent = doctors.length;
  $('#statPatients').textContent = patients;
  $('#statInRoom').textContent = inRoom;
  $('#statWaiting').textContent = waiting;
}

const STAT_TITLES = {
  doctors: 'Doctors shown',
  patients: 'Patients booked today',
  inroom: 'Currently in a room',
  waiting: 'Still waiting'
};

const STAT_EMPTY_MESSAGES = {
  doctors: 'No doctors match the current filters.',
  patients: 'No patients booked today for the current filters.',
  inroom: 'No patients are currently in a room.',
  waiting: 'No patients are currently waiting.'
};

function grayNote(text) {
  return ' <span style="color:var(--ink-faint);font-weight:500;">' + text + '</span>';
}

function doctorRow(doctor, info) {
  let tag = 'Not started';
  let rowState = 'next';
  if (info.total === 0) { tag = 'No patients'; rowState = 'waiting'; }
  else if (info.status === 'finished') { tag = 'All seen'; rowState = 'done'; }
  else if (info.serving !== null) { tag = 'In room'; rowState = 'serving'; }

  return {
    serial: '',
    name: escapeHtml(doctor.name) + grayNote('— ' + escapeHtml(doctor.deptName) + ' · ' + escapeHtml(doctor.hospitalName)),
    tag: tag,
    state: rowState
  };
}

function patientRow(appt, doctor, info) {
  let tag = 'Waiting';
  let rowState = 'waiting';
  if (info.completedSet[appt.serial]) { tag = 'Seen'; rowState = 'done'; }
  else if (info.serving === appt.serial) { tag = 'In room'; rowState = 'serving'; }

  return {
    serial: appt.serial,
    name: escapeHtml(appt.name) + grayNote('→ ' + escapeHtml(doctor.name)),
    tag: tag,
    state: rowState
  };
}

function getStatRows(kind, doctors) {
  const rows = [];

  doctors.forEach(function (doctor) {
    const info = Store.getQueueInfo(doctor.id, TODAY_KEY);

    if (kind === 'doctors') {
      rows.push(doctorRow(doctor, info));
    }

    if (kind === 'patients') {
      info.appointments.forEach(function (appt) { rows.push(patientRow(appt, doctor, info)); });
    }

    if (kind === 'inroom' && info.serving !== null) {
      const appt = info.appointments.find(function (item) { return item.serial === info.serving; });
      rows.push({
        serial: info.serving,
        name: escapeHtml(appt.name) + grayNote('→ ' + escapeHtml(doctor.name) + ' · ' + escapeHtml(doctor.roomLabel)),
        tag: 'In room',
        state: 'serving'
      });
    }

    if (kind === 'waiting') {
      info.appointments.forEach(function (appt) {
        if (info.waitingSerials.indexOf(appt.serial) === -1) return;
        rows.push({
          serial: appt.serial,
          name: escapeHtml(appt.name) + grayNote('→ ' + escapeHtml(doctor.name)),
          tag: 'Waiting',
          state: 'waiting'
        });
      });
    }
  });

  return rows;
}

function renderStatDetails(kind, doctors) {
  $('#statDetailTitle').textContent = STAT_TITLES[kind];
  const rows = getStatRows(kind, doctors);
  const body = $('#statDetailBody');

  if (rows.length === 0) {
    body.innerHTML = '<div class="roster-empty">' + STAT_EMPTY_MESSAGES[kind] + '</div>';
    return;
  }

  const rowsHtml = rows.map(function (row) {
    const serial = row.serial === '' ? '' : '<span class="roster-serial">#' + row.serial + '</span>';
    return '<div class="roster-row is-' + row.state + '">' +
      serial +
      '<span class="roster-name">' + row.name + '</span>' +
      '<span class="roster-tag">' + row.tag + '</span>' +
    '</div>';
  }).join('');

  body.innerHTML = '<div class="queue-roster" style="max-height:60vh;">' + rowsHtml + '</div>';
}

function openStatModal(kind) {
  state.openStat = kind;
  renderStatDetails(kind, getFilteredDoctors());
  $('#statDetailOverlay').classList.add('is-open');
  document.body.style.overflow = 'hidden';
}

function closeStatModal() {
  state.openStat = null;
  $('#statDetailOverlay').classList.remove('is-open');
  document.body.style.overflow = '';
}

$('#statDetailClose').addEventListener('click', closeStatModal);

$('#statDetailOverlay').addEventListener('click', function (event) {
  if (event.target === $('#statDetailOverlay')) closeStatModal();
});

document.addEventListener('keydown', function (event) {
  if (event.key === 'Escape' && state.openStat) closeStatModal();
});

$all('.admin-stat-card[data-stat]').forEach(function (card) {
  const kind = card.getAttribute('data-stat');
  card.addEventListener('click', function () { openStatModal(kind); });
  card.addEventListener('keydown', function (event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openStatModal(kind);
    }
  });
});

function patientStatus(appt, info) {
  if (info.completedSet[appt.serial]) return { rowState: 'done', tag: 'Seen' };
  if (info.serving === appt.serial) return { rowState: 'serving', tag: 'In room' };
  if (info.waitingSerials[0] === appt.serial) {
    return { rowState: 'next', tag: info.serving === null && info.completed.length === 0 ? 'Up first' : 'Next' };
  }
  return { rowState: 'waiting', tag: 'Waiting' };
}

function buildRoster(doctor, info) {
  if (info.total === 0) {
    return '<div class="roster-empty">No patients have booked ' + escapeHtml(doctor.name) + ' today yet.</div>';
  }

  const rows = info.appointments.map(function (appt) {
    const status = patientStatus(appt, info);
    const details = [
      appt.mode === 'video' ? 'Video visit' : 'In person',
      appt.time,
      appt.reason,
      appt.email
    ].filter(Boolean).join(' · ');

    return '<div class="roster-row is-' + status.rowState + '" title="' + escapeHtml(details) + '">' +
      '<span class="roster-serial">#' + appt.serial + '</span>' +
      '<span class="roster-name">' + escapeHtml(appt.name) + '</span>' +
      '<span class="roster-tag">' + status.tag + '</span>' +
    '</div>';
  }).join('');

  return '<div class="queue-roster">' + rows + '</div>';
}

function buildStatusBadge(info) {
  if (info.total === 0) return '<span class="queue-card-badge queue-card-badge--waiting">No patients today</span>';
  if (info.status === 'finished') return '<span class="queue-card-badge queue-card-badge--done">All seen</span>';
  if (info.status === 'serving') return '<span class="queue-card-badge queue-card-badge--serving">In room</span>';
  return '<span class="queue-card-badge queue-card-badge--waiting">Not started</span>';
}

function getCallButton(info) {
  if (info.total === 0) return { label: 'No patients to call', disabled: true };
  if (info.status === 'finished') return { label: 'All patients seen today', disabled: true };

  if (info.serving === null) {
    return { label: ICONS.door + ' Call patient #' + info.nextSerial + ' in', disabled: false };
  }
  if (info.nextSerial !== null) {
    return { label: ICONS.exit + ' Release #' + info.serving + ' &amp; call #' + info.nextSerial, disabled: false };
  }
  return { label: ICONS.exit + ' Release #' + info.serving + ' (last patient)', disabled: false };
}

function buildQueueCard(doctor) {
  const info = Store.getQueueInfo(doctor.id, TODAY_KEY);
  const callButton = getCallButton(info);
  const nothingToReset = info.total === 0 && info.serving === null && info.completed.length === 0;

  let cardClass = 'queue-card';
  if (info.serving !== null) cardClass += ' is-active-room';
  if (info.status === 'finished') cardClass += ' is-done-today';

  const card = createElement('div', { class: cardClass, 'data-doctor-id': doctor.id });

  card.innerHTML =
    '<div class="queue-card-top">' +
      '<div class="doctor-avatar" style="background:' + doctor.color + ';">' + doctor.initials + '</div>' +
      '<div class="queue-card-info">' +
        '<h3>' + escapeHtml(doctor.name) + '</h3>' +
        '<p>' + escapeHtml(doctor.deptName) + ' · ' + escapeHtml(doctor.hospitalName) + '</p>' +
        '<p>' + escapeHtml(doctor.roomLabel) + '</p>' +
      '</div>' +
      buildStatusBadge(info) +
    '</div>' +
    '<div class="queue-card-panel">' +
      '<div class="queue-card-panel__row"><span class="queue-card-panel__label">Now serving</span><span class="queue-card-panel__value is-room">' + (info.serving === null ? '—' : info.serving) + '</span></div>' +
      '<div class="queue-card-panel__row"><span class="queue-card-panel__label">Patients today</span><span class="queue-card-panel__value">' + info.total + '</span></div>' +
      '<div class="queue-card-panel__row"><span class="queue-card-panel__label">Completed</span><span class="queue-card-panel__value">' + info.completed.length + ' / ' + info.total + '</span></div>' +
    '</div>' +
    buildRoster(doctor, info) +
    '<div class="queue-card-actions">' +
      '<button class="btn btn--sm btn-reset-queue" data-act="reset" title="Reset today\'s queue for this doctor"' + (nothingToReset ? ' disabled' : '') + '>' + ICONS.reset + '</button>' +
      '<button class="btn btn-call-patient" data-act="call"' + (callButton.disabled ? ' disabled' : '') + '><span>' + callButton.label + '</span></button>' +
    '</div>';

  $('[data-act="call"]', card).addEventListener('click', async function (event) {
    event.currentTarget.disabled = true;
    try {
      const updated = await Store.callNextPatient(doctor.id);
      if (updated.serving !== null) {
        showToast(doctor.name + ': patient #' + updated.serving + ' called in to ' + doctor.roomLabel);
      } else {
        showToast(doctor.name + ': all patients seen for today');
      }
    } catch (error) {
      handleAdminError(error);
    }
  });

  $('[data-act="reset"]', card).addEventListener('click', async function () {
    const sure = confirm('Reset today\'s queue for ' + doctor.name + '? This clears who has been called and seen.');
    if (!sure) return;
    try {
      await Store.resetQueue(doctor.id);
      showToast(doctor.name + ': queue reset');
    } catch (error) {
      handleAdminError(error);
    }
  });

  return card;
}

function renderBoard() {
  const doctors = getFilteredDoctors();
  const board = $('#queueBoard');
  const loadMore = $('#adminLoadMoreWrap');

  showStats(doctors);
  if (state.openStat) renderStatDetails(state.openStat, doctors);

  board.innerHTML = '';
  loadMore.innerHTML = '';

  if (doctors.length === 0) {
    board.appendChild(createElement('div', { class: 'admin-empty' }, 'No doctors match these filters.'));
    return;
  }

  doctors.slice(0, state.filter.visible).forEach(function (doctor) {
    board.appendChild(buildQueueCard(doctor));
  });

  const hiddenCount = doctors.length - state.filter.visible;
  if (hiddenCount > 0) {
    const button = createElement('button', {
      class: 'btn btn-show-more-doctors',
      type: 'button'
    }, '<span>Show more doctors (' + hiddenCount + ' more)</span>');
    button.addEventListener('click', function () {
      state.filter.visible += PAGE_SIZE;
      renderBoard();
    });
    loadMore.appendChild(button);
  }
}

function showLogin() {
  openAdminLogin(true);
}

function openAdminLogin(shouldOpen) {
  $('#adminLoginOverlay').classList.toggle('is-open', shouldOpen);
  $('#adminLogoutBtn').hidden = shouldOpen;
  if (shouldOpen) $('#adminUsername').focus();
}

function handleAdminError(error) {
  if (error.code === 'not_logged_in') {
    showLogin();
  } else {
    showToast(error.message);
  }
  renderBoard();
}

async function loadAdminData() {
  try {
    await Store.refreshAdmin();
    openAdminLogin(false);
    renderBoard();
  } catch (error) {
    handleAdminError(error);
  }
}

$('#adminLoginForm').addEventListener('submit', async function (event) {
  event.preventDefault();
  const errorBox = $('#adminLoginError');
  errorBox.hidden = true;

  try {
    await Store.adminLogin($('#adminUsername').value.trim(), $('#adminPassword').value);
    $('#adminPassword').value = '';
    await loadAdminData();
  } catch (error) {
    errorBox.textContent = error.message;
    errorBox.hidden = false;
  }
});

$('#adminLogoutBtn').addEventListener('click', async function () {
  try { await Store.adminLogout(); } catch (error) { }
  window.location.reload();
});

Store.onChange(renderBoard);

setInterval(function () {
  if (document.hidden || $('#adminLoginOverlay').classList.contains('is-open')) return;
  Store.refreshAdmin().catch(function (error) {
    if (error.code === 'not_logged_in') showLogin();
  });
}, 3000);

fillFilterDropdowns();
renderBoard();
loadAdminData();
})();
