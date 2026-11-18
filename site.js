(function () {
"use strict";

const D = window.MeridianData;
const Store = window.MeridianStore;
const Api = window.MeridianApi;
const ICONS = D.ICONS;
const DEPT_ICONS = D.DEPT_ICONS;
const DEPARTMENTS = D.DEPARTMENTS;
const HOSPITALS = D.HOSPITALS;
const DOCTORS = D.DOCTORS;
const TESTIMONIALS = D.TESTIMONIALS;
const DAYS = D.DAYS;
const DOW = D.DOW;
const escapeHtml = D.escapeHtml;
const TODAY_KEY = D.dateKey(DAYS[0]);
const PAGE_SIZE = 24;
const MINUTES_PER_PATIENT = 8;
const SESSION_KEY = 'meridian.session.v1';
const THEME_KEY = 'meridian.theme';
const VALID_VIEWS = ['home', 'departments', 'doctors', 'appointments', 'profile', 'about', 'contact'];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NAME_PATTERN = /^[\p{L}\p{M}0-9 .'_-]+$/u;
const USERNAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{2,29}$/;

function loadSession() {
  try {
    const saved = localStorage.getItem(SESSION_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch (error) {
    return null;
  }
}

function sessionUser(user) {
  return {
    name: user.name,
    username: user.username,
    email: user.email,
    fullName: user.fullName || '',
    phone: user.phone || '',
    dateOfBirth: user.dateOfBirth || '',
    gender: user.gender || '',
    bloodGroup: user.bloodGroup || '',
    address: user.address || '',
    memberSince: user.memberSince || 0
  };
}

function saveSession(user) {
  try {
    if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    else localStorage.removeItem(SESSION_KEY);
  } catch (error) { }
}

const state = {
  view: 'home',
  theme: 'light',
  user: loadSession(),
  carouselIndex: { home: 0, about: 0 },
  doctorFilter: { search: '', dept: 'all', hospital: 'all', sort: 'soonest', visible: PAGE_SIZE },
  hero: { hospitalId: 'all', deptId: DEPARTMENTS[0].id, doctorId: null, dayIndex: 0, time: null, priceSort: 'default' },
  booking: null,
  queueModalApptId: null,
  notified: {}
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

function isValidEmail(email) {
  const clean = email.trim();
  return clean.length <= 150 && EMAIL_PATTERN.test(clean);
}

function cleanName(name) {
  return name.replace(/\s+/g, ' ').trim();
}

function isValidUsername(username) {
  return USERNAME_PATTERN.test(username);
}

function passwordProblem(password, username) {
  if (!/^[\x21-\x7E]+$/.test(password)) return 'Password can only use letters, numbers and symbols (no spaces).';
  if (password.length < 8 || password.length > 64) return 'Password must be 8 to 64 characters.';
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    return 'Password needs a lowercase letter, an uppercase letter, a number and a special character (like ! @ # $ %).';
  }
  if (username && password.toLowerCase().indexOf(username.toLowerCase()) !== -1) return 'Password cannot contain your username.';
  return '';
}

function isValidName(name) {
  const clean = cleanName(name);
  return clean.length >= 2 && clean.length <= 100 && NAME_PATTERN.test(clean) && /\p{L}/u.test(clean);
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
  }, 3400);
}

function openOverlay(selector) {
  $(selector).classList.add('is-open');
  document.body.style.overflow = 'hidden';
}

function closeOverlay(selector) {
  $(selector).classList.remove('is-open');
  document.body.style.overflow = '';
}

function isOpen(selector) {
  return $(selector).classList.contains('is-open');
}

const CHEVRON_ICON = '<svg viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function parseTime(label) {
  const match = /(\d+):(\d+)\s*(AM|PM)/.exec(label);
  let hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  if (match[3] === 'PM' && hour !== 12) hour += 12;
  if (match[3] === 'AM' && hour === 12) hour = 0;
  return { hour: hour, minute: minute };
}

function isSlotInPast(doctor, dayIndex, slot) {
  if (D.dateKey(DAYS[dayIndex]) !== TODAY_KEY) return false;

  const time = parseTime(slot.time);
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const slotStart = time.hour * 60 + time.minute;

  if (doctor.emergency) return slotStart + 30 <= nowMinutes;
  return slotStart <= nowMinutes;
}

function sortDoctorsByPrice(doctors, order) {
  if (order !== 'low-high' && order !== 'high-low') return doctors;
  const sorted = doctors.slice();
  sorted.sort(function (a, b) {
    if (a.fee !== b.fee) return order === 'low-high' ? a.fee - b.fee : b.fee - a.fee;
    return a.name.localeCompare(b.name);
  });
  return sorted;
}

const PRICE_SORT_OPTIONS =
  '<option value="default">Default order</option>' +
  '<option value="low-high">Price: Low to High</option>' +
  '<option value="high-low">Price: High to Low</option>';

function getVisibleSlots(doctor, dayIndex) {
  const slots = doctor.availability[D.dateKey(DAYS[dayIndex])] || [];
  if (!doctor.emergency) return slots;
  return slots.filter(function (slot) { return !isSlotInPast(doctor, dayIndex, slot); });
}

function isSlotUnavailable(doctor, dayIndex, slot, ignoreApptId) {
  if (slot.booked) return true;
  if (isSlotInPast(doctor, dayIndex, slot)) return true;

  const dateKey = D.dateKey(DAYS[dayIndex]);
  return Store.isSlotTaken(doctor.id, dateKey, slot.time, ignoreApptId);
}

function applyTheme() {
  const button = $('#themeToggle');
  const isLight = state.theme === 'light';
  document.documentElement.setAttribute('data-theme', state.theme);
  button.innerHTML = isLight ? ICONS.moon : ICONS.sun;
  button.setAttribute('aria-label', isLight ? 'Switch to dark theme' : 'Switch to light theme');
}

function loadSavedTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved) return saved;
  } catch (error) { }
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
}

$('#themeToggle').addEventListener('click', function () {
  state.theme = state.theme === 'light' ? 'dark' : 'light';
  try { localStorage.setItem(THEME_KEY, state.theme); } catch (error) { }
  applyTheme();
  showToast('Switched to ' + state.theme + ' theme');
});

state.theme = loadSavedTheme();
applyTheme();

function navigate(view, options) {
  options = options || {};
  if (VALID_VIEWS.indexOf(view) === -1) view = 'home';
  let promptSignIn = false;
  if (view === 'profile' && !state.user) {
    view = 'home';
    promptSignIn = true;
  }
  state.view = view;

  $all('.view').forEach(function (section) { section.classList.remove('is-active'); });
  $('#view-' + view).classList.add('is-active');

  $all('[data-nav]').forEach(function (link) {
    const target = link.getAttribute('href').replace('#', '');
    link.classList.toggle('is-active', target === view);
  });

  if (!options.skipHash) history.replaceState(null, '', '#' + view);
  if (!options.skipScroll) window.scrollTo(0, 0);
  closeMobilePanel();

  if (view === 'doctors') renderDoctorGrid();
  if (view === 'appointments') renderAppointments();
  if (view === 'profile') openProfileView();
  if (promptSignIn) openSignIn();
}

$all('[data-nav]').forEach(function (link) {
  link.addEventListener('click', function (event) {
    event.preventDefault();
    navigate(link.getAttribute('href').replace('#', ''));
  });
});

$all('[data-nav-btn]').forEach(function (button) {
  button.addEventListener('click', function () { navigate(button.getAttribute('data-nav-btn')); });
});

window.addEventListener('hashchange', function () {
  navigate(location.hash.replace('#', '') || 'home', { skipHash: true });
});

window.addEventListener('scroll', function () {
  $('#siteHeader').classList.toggle('is-scrolled', window.scrollY > 8);
});

function openMobilePanel() {
  $('#mobilePanel').classList.add('is-open');
  $('#menuToggle').setAttribute('aria-expanded', 'true');
}

function closeMobilePanel() {
  $('#mobilePanel').classList.remove('is-open');
  $('#menuToggle').setAttribute('aria-expanded', 'false');
}

$('#menuToggle').addEventListener('click', openMobilePanel);
$('#mobileClose').addEventListener('click', closeMobilePanel);
$('#mobileBackdrop').addEventListener('click', closeMobilePanel);

$('#mobileBook').addEventListener('click', function () {
  closeMobilePanel();
  openBooking();
});

$('#mobileSignIn').addEventListener('click', function () {
  closeMobilePanel();
  if (state.user) navigate('appointments');
  else openSignIn();
});

function createDepartmentCard(dept) {
  const doctorCount = DOCTORS.filter(function (doctor) { return doctor.deptId === dept.id; }).length;
  const card = createElement('button', { class: 'dept-card', type: 'button' });

  card.innerHTML =
    '<div class="dept-icon"><svg viewBox="0 0 24 24" fill="none">' + DEPT_ICONS[dept.id] + '</svg></div>' +
    '<h3>' + dept.name + '</h3>' +
    '<p style="margin-bottom:2px;font-size:.86rem;">' + dept.blurb + '</p>' +
    '<div class="dept-count">' + doctorCount + ' doctors across our hospitals</div>' +
    '<span class="dept-link">View doctors ' + ICONS.arrow + '</span>';

  card.addEventListener('click', function () {
    state.doctorFilter.dept = dept.id;
    state.doctorFilter.search = '';
    state.doctorFilter.visible = PAGE_SIZE;
    navigate('doctors');
  });
  return card;
}

function renderDepartments() {
  const homeGrid = $('#homeDeptGrid');
  const fullGrid = $('#fullDeptGrid');
  homeGrid.innerHTML = '';
  fullGrid.innerHTML = '';

  DEPARTMENTS.slice(0, 4).forEach(function (dept) { homeGrid.appendChild(createDepartmentCard(dept)); });
  DEPARTMENTS.forEach(function (dept) { fullGrid.appendChild(createDepartmentCard(dept)); });
}

function createDoctorCard(doctor) {
  const next = D.firstAvailable(doctor);
  const card = createElement('div', { class: 'doctor-card' });

  let nextOpening = '<span>No openings this week</span>';
  if (doctor.emergency) {
    nextOpening = '<span>Available right now</span><span>24/7 emergency</span>';
  } else if (next) {
    nextOpening = '<span>Next opening</span><span>' + D.fmtDay(next.day) + ' · ' + next.time + '</span>';
  }
  const emergencyBadge = doctor.emergency ? '<span class="badge badge--emergency">24/7 Emergency</span>' : '';
  const starIcon = ICONS.star.replace('currentColor', 'var(--amber)');
  const videoBadge = doctor.telehealth ? '<span>' + ICONS.video + ' Video visits</span>' : '';

  card.innerHTML =
    '<div class="doctor-top">' +
      '<div class="doctor-avatar" style="background:' + doctor.color + ';">' + doctor.initials + '</div>' +
      '<div><div class="doctor-name">' + doctor.name + '</div><div class="doctor-spec">' + doctor.deptName + '</div>' + emergencyBadge + '</div>' +
    '</div>' +
    '<div class="doctor-hospital">' + ICONS.hospital + ' ' + doctor.hospitalName + '</div>' +
    '<div class="doctor-meta">' +
      '<span>' + starIcon + ' ' + doctor.rating + ' (' + doctor.reviews + ')</span>' +
      '<span>' + doctor.years + ' yrs exp</span>' +
      videoBadge +
    '</div>' +
    '<div class="doctor-meta" style="margin-top:-6px;"><span class="doctor-fee">Visit fee: ' + D.fmtBdt(doctor.fee) + '</span></div>' +
    '<div class="doctor-next">' + nextOpening + '</div>' +
    '<div class="doctor-actions">' +
      '<button class="btn btn--sm btn-doctor-profile" data-act="profile">View profile</button>' +
      '<button class="btn btn--sm btn-doctor-book" data-act="book"><span>Book</span></button>' +
    '</div>';

  $('[data-act="book"]', card).addEventListener('click', function () {
    openBooking({ doctorId: doctor.id });
  });

  $('[data-act="profile"]', card).addEventListener('click', function () {
    showToast(doctor.name + ' — ' + doctor.years + ' years in ' + doctor.deptName + ' at ' + doctor.hospitalName +
      ' (' + doctor.roomLabel + ') · ' + D.fmtBdt(doctor.fee) + ' visit fee');
  });
  return card;
}

function renderHomeDoctors() {
  const grid = $('#homeDoctorGrid');
  grid.innerHTML = '';

  DEPARTMENTS.slice(0, 6).forEach(function (dept) {
    const doctor = DOCTORS.find(function (item) { return item.deptId === dept.id; });
    grid.appendChild(createDoctorCard(doctor));
  });
}

function fillDoctorFilters() {
  const deptOptions = DEPARTMENTS.map(function (dept) {
    return '<option value="' + dept.id + '">' + dept.name + '</option>';
  }).join('');
  $('#doctorDeptFilter').innerHTML = '<option value="all">All departments</option>' + deptOptions;

  const hospitalOptions = HOSPITALS.map(function (hospital) {
    return '<option value="' + hospital.id + '">' + hospital.name + '</option>';
  }).join('');
  $('#doctorHospitalFilter').innerHTML = '<option value="all">All hospitals</option>' + hospitalOptions;
}

function getFilteredDoctors() {
  const filter = state.doctorFilter;
  function normalise(text) {
    return String(text || '').toLowerCase().replace(/[.,\-_]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  const searchWords = normalise(filter.search).split(' ').filter(Boolean);

  const matches = DOCTORS.filter(function (doctor) {
    const haystack = normalise(doctor.name + ' ' + doctor.deptName);
    const matchesSearch = searchWords.every(function (word) { return haystack.indexOf(word) !== -1; });
    const matchesDept = filter.dept === 'all' || doctor.deptId === filter.dept;
    const matchesHospital = filter.hospital === 'all' || doctor.hospitalId === filter.hospital;
    return matchesSearch && matchesDept && matchesHospital;
  });

  function soonestDayIndex(doctor) {
    const next = D.firstAvailable(doctor);
    return next ? next.dayIndex : 999;
  }

  matches.sort(function (a, b) {
    if (filter.sort === 'rating') return b.rating - a.rating;
    if (filter.sort === 'fee-low') return a.fee - b.fee;
    if (filter.sort === 'name') return a.name.localeCompare(b.name);
    return soonestDayIndex(a) - soonestDayIndex(b);
  });
  return matches;
}

function renderDoctorGrid() {
  const filter = state.doctorFilter;
  $('#doctorDeptFilter').value = filter.dept;
  $('#doctorHospitalFilter').value = filter.hospital;
  $('#doctorSearch').value = filter.search;
  $('#doctorSort').value = filter.sort;

  const doctors = getFilteredDoctors();
  const grid = $('#fullDoctorGrid');
  const loadMore = $('#doctorLoadMoreWrap');
  grid.innerHTML = '';
  loadMore.innerHTML = '';

  if (doctors.length === 0) {
    grid.appendChild(createElement('div', { class: 'empty-panel' },
      'No doctors match your search. Try a different hospital, department or term.'));
  }

  doctors.slice(0, filter.visible).forEach(function (doctor) {
    grid.appendChild(createDoctorCard(doctor));
  });

  $('#doctorResultCount').textContent = doctors.length + (doctors.length === 1 ? ' doctor' : ' doctors');

  const hiddenCount = doctors.length - filter.visible;
  if (hiddenCount > 0) {
    const button = createElement('button', {
      class: 'btn btn-show-more',
      type: 'button'
    }, '<span>Show more doctors (' + hiddenCount + ' more)</span>');
    button.addEventListener('click', function () {
      filter.visible += PAGE_SIZE;
      renderDoctorGrid();
    });
    loadMore.appendChild(button);
  }
}

function changeDoctorFilter(name, value) {
  state.doctorFilter[name] = value;
  state.doctorFilter.visible = PAGE_SIZE;
  renderDoctorGrid();
}

$('#doctorSearch').addEventListener('input', function (event) {
  if (event.target.value.trim() !== '') {
    state.doctorFilter.dept = 'all';
    state.doctorFilter.hospital = 'all';
  }
  changeDoctorFilter('search', event.target.value);
});
$('#doctorDeptFilter').addEventListener('change', function (event) { changeDoctorFilter('dept', event.target.value); });
$('#doctorHospitalFilter').addEventListener('change', function (event) { changeDoctorFilter('hospital', event.target.value); });
$('#doctorSort').addEventListener('change', function (event) { changeDoctorFilter('sort', event.target.value); });

function fillHeroDropdowns() {
  const hospitalOptions = HOSPITALS.map(function (hospital) {
    return '<option value="' + hospital.id + '">' + hospital.name + ' · ' + hospital.area + '</option>';
  }).join('');
  $('#heroHospital').innerHTML = '<option value="all">All hospitals</option>' + hospitalOptions;
  $('#heroHospital').value = state.hero.hospitalId;

  $('#heroDept').innerHTML = DEPARTMENTS.map(function (dept) {
    return '<option value="' + dept.id + '">' + dept.name + '</option>';
  }).join('');
  $('#heroDept').value = state.hero.deptId;

  fillHeroDoctors();
}

function fillHeroDoctors() {
  const doctors = sortDoctorsByPrice(DOCTORS.filter(function (doctor) {
    const sameDept = doctor.deptId === state.hero.deptId;
    const sameHospital = state.hero.hospitalId === 'all' || doctor.hospitalId === state.hero.hospitalId;
    return sameDept && sameHospital;
  }), state.hero.priceSort);

  const select = $('#heroDoctor');
  if (doctors.length === 0) {
    select.innerHTML = '<option value="">No doctors at this hospital</option>';
    state.hero.doctorId = null;
  } else {
    select.innerHTML = doctors.map(function (doctor) {
      return '<option value="' + doctor.id + '">' + doctor.name + ' · ' + D.fmtBdt(doctor.fee) + '</option>';
    }).join('');
    state.hero.doctorId = doctors[0].id;
    select.value = state.hero.doctorId;
  }
  loadDoctorSlots(state.hero.doctorId);
  renderHeroDays();
}

function renderHeroDays() {
  const strip = $('#heroDayStrip');
  strip.innerHTML = '';

  DAYS.forEach(function (day, index) {
    const selected = index === state.hero.dayIndex ? ' is-selected' : '';
    const chip = createElement('button', { class: 'day-chip' + selected, type: 'button' },
      '<span class="dow">' + DOW[day.getDay()] + '</span><span class="dom">' + day.getDate() + '</span>');
    chip.addEventListener('click', function () {
      state.hero.dayIndex = index;
      state.hero.time = null;
      renderHeroDays();
    });
    strip.appendChild(chip);
  });
  renderHeroSlots();
}

function renderHeroSlots() {
  const grid = $('#heroSlotGrid');
  const continueButton = $('#heroContinueBtn');
  const doctor = D.doctorById(state.hero.doctorId);
  grid.innerHTML = '';

  if (!doctor) {
    grid.appendChild(createElement('div', { class: 'slot-empty' }, 'No doctors in this department at the selected hospital. Try another hospital.'));
    continueButton.disabled = true;
    return;
  }

  const day = DAYS[state.hero.dayIndex];
  const slots = getVisibleSlots(doctor, state.hero.dayIndex);

  if (slots.length === 0) {
    grid.appendChild(createElement('div', { class: 'slot-empty' }, 'No openings on ' + D.fmtDay(day, { long: true }) + '. Try another day.'));
  }

  slots.forEach(function (slot) {
    const unavailable = isSlotUnavailable(doctor, state.hero.dayIndex, slot);
    if (unavailable && state.hero.time === slot.time) state.hero.time = null;

    const selected = state.hero.time === slot.time ? ' is-selected' : '';
    const button = createElement('button', { class: 'slot-btn' + selected, type: 'button' }, slot.time);
    button.disabled = unavailable;
    button.addEventListener('click', function () {
      state.hero.time = slot.time;
      renderHeroSlots();
    });
    grid.appendChild(button);
  });

  continueButton.disabled = !state.hero.time;
  $('span', continueButton).textContent = state.hero.time
    ? 'Continue with ' + D.fmtDay(day) + ' · ' + state.hero.time
    : 'Select a time to continue';
}

$('#heroHospital').addEventListener('change', function (event) {
  state.hero.hospitalId = event.target.value;
  state.hero.time = null;
  fillHeroDoctors();
});

$('#heroDept').addEventListener('change', function (event) {
  state.hero.deptId = event.target.value;
  state.hero.dayIndex = 0;
  state.hero.time = null;
  fillHeroDoctors();
});

$('#heroPriceSort').innerHTML = PRICE_SORT_OPTIONS;
$('#heroPriceSort').addEventListener('change', function (event) {
  state.hero.priceSort = event.target.value;
  state.hero.time = null;
  fillHeroDoctors();
});

$('#heroDoctor').addEventListener('change', function (event) {
  state.hero.doctorId = event.target.value;
  state.hero.time = null;
  loadDoctorSlots(state.hero.doctorId);
  renderHeroDays();
});

$('#heroContinueBtn').addEventListener('click', function () {
  if (!state.hero.time || !state.hero.doctorId) return;
  openBooking({
    doctorId: state.hero.doctorId,
    dayIndex: state.hero.dayIndex,
    time: state.hero.time,
    startStep: 3
  });
});

function renderCarousel(containerId, key) {
  const box = $('#' + containerId);
  const index = state.carouselIndex[key];
  const testimonial = TESTIMONIALS[index];

  const dots = TESTIMONIALS.map(function (item, dotIndex) {
    const active = dotIndex === index ? ' is-active' : '';
    return '<button class="dot' + active + '" data-dot="' + dotIndex + '" aria-label="Go to testimonial ' + (dotIndex + 1) + '"></button>';
  }).join('');

  box.innerHTML =
    '<div class="carousel-track"><div class="testi">' +
      '<blockquote>"' + testimonial.quote + '"</blockquote>' +
      '<cite>' + testimonial.name + ' · ' + testimonial.role + '</cite>' +
    '</div></div>' +
    '<div class="carousel-nav">' +
      '<button class="icon-btn btn-carousel-prev" data-dir="-1" aria-label="Previous testimonial"><svg viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
      '<div class="carousel-dots">' + dots + '</div>' +
      '<button class="icon-btn btn-carousel-next" data-dir="1" aria-label="Next testimonial"><svg viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
    '</div>';

  $all('[data-dir]', box).forEach(function (button) {
    button.addEventListener('click', function () {
      const step = parseInt(button.getAttribute('data-dir'), 10);
      state.carouselIndex[key] = (index + step + TESTIMONIALS.length) % TESTIMONIALS.length;
      renderCarousel(containerId, key);
    });
  });

  $all('[data-dot]', box).forEach(function (dot) {
    dot.addEventListener('click', function () {
      state.carouselIndex[key] = parseInt(dot.getAttribute('data-dot'), 10);
      renderCarousel(containerId, key);
    });
  });
}

function getMyAppointments() {
  return state.user ? Store.getMyAppointments() : [];
}

function showServerError(error) {
  showToast(error.message || 'Something went wrong. Please try again.');
}

function syncPatientData() {
  Store.setPatientEmail(state.user ? state.user.email : null);
  Store.refreshPatient().catch(function (error) {
    console.warn(error.message);
    if (error.code === 'not_logged_in' && state.user) {
      clearSignedInUser();
      showToast('Your session ended. Please sign in again.');
    }
  });
}

function loadDoctorSlots(doctorId) {
  if (!doctorId) return;
  Store.watchDoctor(doctorId).catch(function (error) { console.warn(error.message); });
}

function minutesOfDay(appt) {
  return appt.hour * 60 + appt.minute;
}

function renderAppointments() {
  const wrap = $('#apptListWrap');
  const appointments = getMyAppointments();
  wrap.innerHTML = '';

  if (!state.user) {
    wrap.appendChild(createElement('div', { class: 'empty-state' },
      ICONS.calendar +
      '<h3>Sign in to see your appointments</h3>' +
      '<p>Create an account, or sign in, with the email you booked with.</p>' +
      '<button class="btn btn-book-first" id="emptySignInBtn"><span>Sign in</span></button>'));
    $('#emptySignInBtn').addEventListener('click', function () { openSignIn(); });
    return;
  }

  if (appointments.length === 0) {
    wrap.appendChild(createElement('div', { class: 'empty-state' },
      ICONS.calendar +
      '<h3>No appointments yet</h3>' +
      '<p>When you book a visit, it will show up here with all the details you need — including your live queue serial.</p>' +
      '<button class="btn btn-book-first" id="emptyBookBtn"><span>Book your first appointment</span></button>'));
    $('#emptyBookBtn').addEventListener('click', function () { openBooking(); });
    return;
  }

  appointments.sort(function (a, b) {
    return (a.sortKey - b.sortKey) || (minutesOfDay(a) - minutesOfDay(b));
  });

  const list = createElement('div', { class: 'appt-list' });
  appointments.forEach(function (appt) { list.appendChild(createAppointmentCard(appt)); });
  wrap.appendChild(list);
}

function createAppointmentCard(appt) {
  const doctor = D.doctorById(appt.doctorId);
  const isCancelled = appt.status === 'cancelled';
  const isVideo = appt.mode === 'video';
  const card = createElement('div', { class: 'appt-card', 'data-appt-id': appt.id });

  const statusBadge = isCancelled
    ? '<span class="badge badge--cancelled">Cancelled</span>'
    : '<span class="badge badge--upcoming">Upcoming</span>';
  const videoBadge = isVideo ? '<span class="badge badge--video">' + ICONS.video + ' Video</span>' : '';
  const place = isVideo ? ' · Video visit' : ' · In person, ' + doctor.roomLabel;

  let actions = '';
  if (!isCancelled) {
    actions =
      (isVideo ? '<button class="btn btn--sm btn-join-video" data-act="join">Join video</button>' : '') +
      '<button class="btn btn--sm btn-add-calendar" data-act="ics">Add to calendar</button>' +
      '<button class="btn btn--sm btn-reschedule" data-act="reschedule">Reschedule</button>' +
      '<button class="btn btn--sm btn-cancel-appointment" data-act="cancel">Cancel</button>';
  }

  card.innerHTML =
    '<div class="appt-doc">' +
      '<div class="doctor-avatar" style="background:' + doctor.color + ';width:48px;height:48px;border-radius:14px;font-size:.9rem;">' + doctor.initials + '</div>' +
      '<div class="appt-info"><h4>' + doctor.name + '</h4><p>' + doctor.deptName + ' · ' + doctor.hospitalName + place + '</p>' +
        '<div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;">' + statusBadge + videoBadge +
        '<span class="badge badge--fee">' + D.fmtBdt(appt.fee) + '</span></div>' +
      '</div>' +
    '</div>' +
    '<div class="appt-when">' + appt.dayLabel + ' · ' + appt.time + '</div>' +
    '<div class="appt-actions">' + actions + '</div>' +
    '<div data-queue-slot></div>';

  if (isCancelled) return card;

  const joinButton = $('[data-act="join"]', card);
  if (joinButton) joinButton.addEventListener('click', function () { showToast('Launching your video visit…'); });

  $('[data-act="ics"]', card).addEventListener('click', function () { downloadCalendarFile(appt); });

  $('[data-act="reschedule"]', card).addEventListener('click', function () {
    openBooking({ doctorId: appt.doctorId, rescheduleId: appt.id, startStep: 2 });
  });

  $('[data-act="cancel"]', card).addEventListener('click', function () { askToCancel(card, appt); });

  renderQueueSlot($('[data-queue-slot]', card), appt);
  return card;
}

function askToCancel(card, appt) {
  if ($('.appt-confirm-row', card)) return;
  const doctor = D.doctorById(appt.doctorId);

  const row = createElement('div', { class: 'appt-confirm-row' },
    '<p>Cancel this appointment with ' + doctor.name + '?</p>' +
    '<div style="display:flex;gap:8px;">' +
      '<button class="btn btn--sm btn-keep-appointment" data-act="keep">Keep it</button>' +
      '<button class="btn btn--sm btn-confirm-cancel" data-act="confirm-cancel">Yes, cancel</button>' +
    '</div>');
  card.appendChild(row);

  $('[data-act="keep"]', row).addEventListener('click', function () { row.remove(); });
  $('[data-act="confirm-cancel"]', row).addEventListener('click', async function () {
    try {
      await Store.cancelAppointment(appt.id);
      renderAppointments();
      showToast('Appointment cancelled');
    } catch (error) {
      showServerError(error);
    }
  });
}

function twoDigits(number) {
  return number < 10 ? '0' + number : String(number);
}

function downloadCalendarFile(appt) {
  const doctor = D.doctorById(appt.doctorId);
  const date = new Date(appt.dateISO);
  const start = String(date.getFullYear()) + twoDigits(date.getMonth() + 1) + twoDigits(date.getDate()) +
    'T' + twoDigits(appt.hour) + twoDigits(appt.minute) + '00';

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    'SUMMARY:Appointment with ' + doctor.name,
    'DESCRIPTION:' + doctor.deptName + ' visit at ' + doctor.hospitalName + ' (Queue serial #' + appt.serial + ', fee ' + D.fmtBdt(appt.fee) + ')',
    'DTSTART:' + start,
    'DURATION:PT30M',
    'UID:' + appt.id + '@meridianhealth.example',
    'END:VEVENT',
    'END:VCALENDAR'
  ];

  const url = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/calendar' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = appt.id + '.ics';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  showToast('Calendar file downloaded');
}

function getQueueStatus(appt, info, doctorStatus) {
  if (appt.dateKey !== TODAY_KEY) {
    return { kind: 'pending', text: 'Live tracking opens on the day of your visit', ahead: 0 };
  }

  if (info.completedSet[appt.serial]) {
    return { kind: 'done', text: 'Your visit is complete', ahead: 0 };
  }

  if (info.serving === appt.serial) {
    return { kind: 'turn', text: 'It\'s your turn — please head in now', ahead: 0 };
  }

  const waitingAhead = info.waitingSerials.filter(function (serial) { return serial < appt.serial; }).length;
  const ahead = waitingAhead + (info.serving !== null ? 1 : 0);

  if (info.serving === null) {
    if (info.status === 'finished') {
      return { kind: 'done', text: 'Today\'s queue for this doctor has wrapped up', ahead: 0 };
    }

    const now = new Date();
    const slotHasPassed = minutesOfDay(appt) <= now.getHours() * 60 + now.getMinutes();

    if (!doctorStatus.arrived && slotHasPassed) {
      return {
        kind: 'delayed',
        text: 'Your appointment time has passed — the doctor hasn\'t checked in yet. We\'ll update you the moment the queue starts.',
        ahead: ahead
      };
    }
    if (doctorStatus.arrived) {
      return { kind: 'pending', text: 'Doctor has arrived — you\'re #' + appt.serial + ' in line, queue starting shortly', ahead: ahead };
    }
    return { kind: 'pending', text: 'Queue not started yet — you\'re #' + appt.serial + ' in line', ahead: ahead };
  }

  if (ahead === 1) {
    return { kind: 'next', text: 'You\'re next — please wait near ' + info.doc.roomLabel, ahead: ahead };
  }
  return { kind: 'waiting', text: ahead + ' patients ahead of you', ahead: ahead };
}

function buildDoctorStatusBadge(doctorStatus) {
  if (doctorStatus.arrived) {
    return '<span class="doctor-status-badge doctor-status-badge--arrived">' + ICONS.check + ' Doctor has arrived</span>';
  }
  return '<span class="doctor-status-badge doctor-status-badge--away">' + ICONS.clock + ' Doctor not arrived yet</span>';
}

function queueProgressPercent(info) {
  if (info.total === 0) return 0;
  const started = info.completed.length + (info.serving !== null ? 1 : 0);
  return Math.min(100, Math.round((started / info.total) * 100));
}

function waitText(status) {
  if (status.kind === 'turn') return 'You\'re up';
  if (status.kind === 'done') return '—';
  return '~' + (status.ahead * MINUTES_PER_PATIENT) + ' min';
}

function buildQueueWidget(appt, info, status, doctorStatus) {
  const isToday = appt.dateKey === TODAY_KEY;

  if (status.kind === 'pending' || status.kind === 'delayed' || (isToday && info.total === 0)) {
    const extraClass = status.kind === 'delayed' ? ' queue-live--delayed' : '';
    const arrival = isToday
      ? '<div class="queue-live__arrival">' + buildDoctorStatusBadge(doctorStatus) + '</div>'
      : '';
    return '<div class="queue-live queue-live--pending' + extraClass + '">' +
      '<div class="queue-live__top"><span class="queue-live__status">' + ICONS.clock + ' ' + status.text + '</span></div>' +
      arrival +
    '</div>';
  }

  const extraClass = { turn: ' queue-live--turn', next: ' queue-live--next', done: ' queue-live--done' }[status.kind] || '';

  return '<div class="queue-live' + extraClass + '">' +
    '<div class="queue-live__top">' +
      '<span class="queue-live__status"><span class="live-dot"></span> ' + status.text + '</span>' +
      '<button class="btn btn--sm btn-live-tracker" data-act="track">' + ICONS.ticket + ' Live tracker</button>' +
    '</div>' +
    '<div class="queue-live__numbers">' +
      '<div class="queue-num"><span>Now serving</span><strong>' + (info.serving === null ? '—' : info.serving) + '</strong></div>' +
      '<div class="queue-num"><span>Your serial</span><strong class="is-you">#' + appt.serial + '</strong></div>' +
      '<div class="queue-num"><span>Total today</span><strong>' + info.total + '</strong></div>' +
    '</div>' +
    '<div class="queue-bar-track"><div class="queue-bar-fill" style="width:' + queueProgressPercent(info) + '%;"></div></div>' +
    '<div class="queue-live__foot"><span class="queue-live__wait">Estimated wait: <strong>' + waitText(status) + '</strong></span></div>' +
  '</div>';
}

function renderQueueSlot(container, appt) {
  if (!container) return;

  const info = Store.getQueueInfo(appt.doctorId, TODAY_KEY);
  const doctorStatus = Store.getDoctorStatus(appt.doctorId, TODAY_KEY);
  const status = getQueueStatus(appt, info, doctorStatus);
  container.innerHTML = buildQueueWidget(appt, info, status, doctorStatus);

  const trackButton = $('[data-act="track"]', container);
  if (trackButton) trackButton.addEventListener('click', function () { openQueueModal(appt.id); });

  const doctor = D.doctorById(appt.doctorId);
  const isTodayAlert = appt.dateKey === TODAY_KEY && (status.kind === 'turn' || status.kind === 'next');
  if (isTodayAlert && state.notified[appt.id] !== status.text) {
    const prefix = status.kind === 'turn' ? 'Your turn with ' : 'Almost up — ';
    showToast(prefix + doctor.name + ': ' + status.text);
  }
  state.notified[appt.id] = status.text;
}

function openQueueModal(apptId) {
  state.queueModalApptId = apptId;
  renderQueueModal();
  openOverlay('#queueOverlay');
}

function closeQueueModal() {
  state.queueModalApptId = null;
  closeOverlay('#queueOverlay');
}

function renderQueueModal() {
  const appt = Store.getAppointment(state.queueModalApptId);
  if (!appt) return;

  const doctor = D.doctorById(appt.doctorId);
  const info = Store.getQueueInfo(appt.doctorId, TODAY_KEY);
  const doctorStatus = Store.getDoctorStatus(appt.doctorId, TODAY_KEY);
  const status = getQueueStatus(appt, info, doctorStatus);

  const radius = 62;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (queueProgressPercent(info) / 100) * circumference;
  const ringColor = { turn: 'var(--coral)', delayed: 'var(--amber)' }[status.kind] || 'var(--teal-600)';

  const doctorRow = appt.dateKey === TODAY_KEY
    ? '<div class="qmodal-row"><span>Doctor status</span><span>' + buildDoctorStatusBadge(doctorStatus) + '</span></div>'
    : '';

  $('#queueBody').innerHTML =
    '<div class="qmodal-hero">' +
      '<div class="qmodal-ring">' +
        '<svg viewBox="0 0 140 140">' +
          '<circle cx="70" cy="70" r="' + radius + '" fill="none" stroke="var(--line)" stroke-width="10"/>' +
          '<circle cx="70" cy="70" r="' + radius + '" fill="none" stroke="' + ringColor + '" stroke-width="10" stroke-linecap="round" stroke-dasharray="' + circumference.toFixed(1) + '" stroke-dashoffset="' + offset.toFixed(1) + '"/>' +
        '</svg>' +
        '<div class="qmodal-ring-center"><span>Now serving</span><strong>' + (info.serving === null ? '—' : info.serving) + '</strong></div>' +
      '</div>' +
      '<h3 style="margin-bottom:4px;">' + status.text + '</h3>' +
      '<p style="margin:0;">Your serial is <strong style="color:var(--ink);">#' + appt.serial + '</strong> at ' + doctor.hospitalName + '</p>' +
    '</div>' +
    doctorRow +
    '<div class="qmodal-row"><span>Doctor</span><span>' + doctor.name + '</span></div>' +
    '<div class="qmodal-row"><span>Hospital</span><span>' + doctor.hospitalName + ' · ' + doctor.roomLabel + '</span></div>' +
    '<div class="qmodal-row"><span>Appointment</span><span>' + appt.dayLabel + ' · ' + appt.time + '</span></div>' +
    '<div class="qmodal-row"><span>Total patients today</span><span>' + info.total + '</span></div>' +
    '<div class="qmodal-row"><span>Visit fee</span><span>' + D.fmtBdt(appt.fee) + '</span></div>' +
    '<div class="qmodal-row"><span>Estimated wait</span><span>' + waitText(status) + '</span></div>';
}

$('#queueClose').addEventListener('click', closeQueueModal);
$('#queueOverlay').addEventListener('click', function (event) {
  if (event.target === $('#queueOverlay')) closeQueueModal();
});

function refreshLiveViews() {
  if (state.view === 'appointments') renderAppointments();
  if (state.view === 'home') renderHeroSlots();
  if (isOpen('#queueOverlay')) renderQueueModal();
  if (isOpen('#bookingOverlay')) {
    if (state.booking.step === 2) renderBookingStep();
    refreshBookingQueue();
  }
}

Store.onChange(refreshLiveViews);

setInterval(function () {
  if (document.hidden) return;
  Store.refreshPatient().catch(function (error) { console.warn(error.message); });
}, 4000);

function newBookingState(options) {
  const user = state.user;
  return {
    step: options.startStep || 1,
    doctorId: options.doctorId || DOCTORS[0].id,
    dayIndex: options.dayIndex || 0,
    time: options.time || null,
    reason: '',
    name: user ? (user.fullName || user.name) : '',
    email: user ? user.email : '',
    phone: user ? user.phone : '',
    patientType: 'new',
    mode: 'in-person',
    priceSort: 'default',
    rescheduleId: options.rescheduleId || null,
    createdAppt: null
  };
}

function openBooking(options) {
  state.booking = newBookingState(options || {});
  openOverlay('#bookingOverlay');
  renderBookingStep();
}

function closeBooking() {
  closeOverlay('#bookingOverlay');
}

$('#bookingClose').addEventListener('click', closeBooking);
$('#bookingOverlay').addEventListener('click', function (event) {
  if (event.target === $('#bookingOverlay')) closeBooking();
});
$all('[data-open-booking]').forEach(function (button) {
  button.addEventListener('click', function () { openBooking(); });
});
$('#headerBookBtn').addEventListener('click', function () { openBooking(); });

function goToStep(step) {
  state.booking.step = step;
  renderBookingStep();
}

function renderBookingStep() {
  const booking = state.booking;

  $all('#bookingStepper i').forEach(function (dot) {
    const number = parseInt(dot.getAttribute('data-step'), 10);
    dot.classList.toggle('is-done', number < booking.step);
    dot.classList.toggle('is-current', number === booking.step);
  });

  $('#bookingTitle').textContent = booking.rescheduleId ? 'Reschedule appointment' : 'Book an appointment';

  const body = $('#bookingBody');
  const footer = $('#bookingFoot');

  if (booking.step === 1) renderStepChooseDoctor(body, footer);
  if (booking.step === 2) renderStepChooseTime(body, footer);
  if (booking.step === 3) renderStepPatientDetails(body, footer);
  if (booking.step === 4) renderStepReview(body, footer);
  if (booking.step === 5) renderStepSuccess(body, footer);
}

function selectField(id, label) {
  return '<div class="field"><label for="' + id + '">' + label + '</label>' +
    '<div class="select-wrap"><select id="' + id + '"></select>' + CHEVRON_ICON + '</div></div>';
}

function renderStepChooseDoctor(body, footer) {
  const booking = state.booking;
  const currentDoctor = D.doctorById(booking.doctorId);
  const inPersonClass = booking.mode === 'in-person' ? ' is-selected' : '';
  const videoClass = booking.mode === 'video' ? ' is-selected' : '';

  body.innerHTML =
    selectField('bkHospital', 'Hospital') +
    selectField('bkDept', 'Department') +
    selectField('bkPriceSort', 'Sort doctors by price') +
    selectField('bkDoctor', 'Doctor') +
    '<div class="field"><label for="bkReason">Reason for visit</label>' +
    '<input type="text" class="text-input" id="bkReason" placeholder="e.g. annual checkup, follow-up, new symptom" value="' + escapeHtml(booking.reason) + '"></div>' +
    '<div class="field"><label>Visit type</label><div class="radio-row">' +
      '<button type="button" class="radio-pill' + inPersonClass + '" data-mode="in-person">In person</button>' +
      '<button type="button" class="radio-pill' + videoClass + '" data-mode="video">Video visit</button>' +
    '</div></div>';

  const hospitalSelect = $('#bkHospital', body);
  const deptSelect = $('#bkDept', body);
  const doctorSelect = $('#bkDoctor', body);
  const priceSortSelect = $('#bkPriceSort', body);

  priceSortSelect.innerHTML = PRICE_SORT_OPTIONS;
  priceSortSelect.value = booking.priceSort;

  hospitalSelect.innerHTML = '<option value="all">Any hospital</option>' + HOSPITALS.map(function (hospital) {
    return '<option value="' + hospital.id + '">' + hospital.name + ' · ' + hospital.area + '</option>';
  }).join('');
  hospitalSelect.value = currentDoctor.hospitalId;

  deptSelect.innerHTML = DEPARTMENTS.map(function (dept) {
    return '<option value="' + dept.id + '">' + dept.name + '</option>';
  }).join('');
  deptSelect.value = currentDoctor.deptId;

  function fillDoctorSelect() {
    const doctors = sortDoctorsByPrice(DOCTORS.filter(function (doctor) {
      const sameDept = doctor.deptId === deptSelect.value;
      const sameHospital = hospitalSelect.value === 'all' || doctor.hospitalId === hospitalSelect.value;
      return sameDept && sameHospital;
    }), priceSortSelect.value);

    if (doctors.length === 0) {
      doctorSelect.innerHTML = '<option value="">No doctors match this hospital &amp; department</option>';
      booking.doctorId = null;
      return;
    }

    doctorSelect.innerHTML = doctors.map(function (doctor) {
      return '<option value="' + doctor.id + '">' + doctor.name + ' · ' + D.fmtBdt(doctor.fee) + '</option>';
    }).join('');

    const stillListed = doctors.some(function (doctor) { return doctor.id === booking.doctorId; });
    booking.doctorId = stillListed ? booking.doctorId : doctors[0].id;
    doctorSelect.value = booking.doctorId;
  }

  fillDoctorSelect();
  deptSelect.addEventListener('change', fillDoctorSelect);
  hospitalSelect.addEventListener('change', fillDoctorSelect);
  priceSortSelect.addEventListener('change', function () {
    booking.priceSort = priceSortSelect.value;
    fillDoctorSelect();
  });
  doctorSelect.addEventListener('change', function () { booking.doctorId = doctorSelect.value; });

  $('#bkReason', body).addEventListener('input', function (event) { booking.reason = event.target.value; });

  $all('[data-mode]', body).forEach(function (button) {
    button.addEventListener('click', function () {
      booking.mode = button.getAttribute('data-mode');
      $all('[data-mode]', body).forEach(function (other) { other.classList.remove('is-selected'); });
      button.classList.add('is-selected');
    });
  });

  footer.innerHTML = '<span></span><button class="btn btn-step-next" id="bkNext"><span>Continue</span></button>';
  $('#bkNext').addEventListener('click', function () {
    if (!booking.doctorId) {
      showToast('Choose a hospital and department with an available doctor');
      return;
    }
    booking.time = null;
    goToStep(2);
  });
}

function renderStepChooseTime(body, footer) {
  const booking = state.booking;
  const doctor = D.doctorById(booking.doctorId);
  loadDoctorSlots(booking.doctorId);

  body.innerHTML =
    '<div class="summary-box"><div class="doctor-avatar" style="background:' + doctor.color + ';">' + doctor.initials + '</div>' +
    '<div><h4>' + doctor.name + '</h4><p>' + doctor.deptName + ' · ' + doctor.hospitalName + ' · ' + D.fmtBdt(doctor.fee) + '</p></div></div>' +
    '<div class="field"><label>Day</label><div class="day-strip" id="bkDayStrip"></div></div>' +
    '<div class="field"><label>Available times</label><div class="slot-grid" id="bkSlotGrid"></div></div>';

  footer.innerHTML =
    '<button class="btn btn-step-back" id="bkBack">Back</button>' +
    '<button class="btn btn-step-next" id="bkNext"><span>Continue</span></button>';

  const nextButton = $('#bkNext');

  function drawDays() {
    const strip = $('#bkDayStrip', body);
    strip.innerHTML = '';
    DAYS.forEach(function (day, index) {
      const selected = index === booking.dayIndex ? ' is-selected' : '';
      const chip = createElement('button', { class: 'day-chip' + selected, type: 'button' },
        '<span class="dow">' + DOW[day.getDay()] + '</span><span class="dom">' + day.getDate() + '</span>');
      chip.addEventListener('click', function () {
        booking.dayIndex = index;
        booking.time = null;
        drawDays();
        drawSlots();
      });
      strip.appendChild(chip);
    });
  }

  function drawSlots() {
    const grid = $('#bkSlotGrid', body);
    const slots = getVisibleSlots(doctor, booking.dayIndex);
    grid.innerHTML = '';

    if (slots.length === 0) grid.appendChild(createElement('div', { class: 'slot-empty' }, 'No openings this day.'));

    slots.forEach(function (slot) {
      const unavailable = isSlotUnavailable(doctor, booking.dayIndex, slot, booking.rescheduleId);
      if (unavailable && booking.time === slot.time) booking.time = null;

      const selected = booking.time === slot.time ? ' is-selected' : '';
      const button = createElement('button', { class: 'slot-btn' + selected, type: 'button' }, slot.time);
      button.disabled = unavailable;
      button.addEventListener('click', function () {
        booking.time = slot.time;
        drawSlots();
      });
      grid.appendChild(button);
    });

    nextButton.disabled = !booking.time;
  }

  drawDays();
  drawSlots();

  $('#bkBack').addEventListener('click', function () { goToStep(1); });
  nextButton.addEventListener('click', function () {
    if (!booking.time) return;
    if (booking.rescheduleId && state.user) {
      booking.name = state.user.fullName || state.user.name;
      booking.email = state.user.email;
      goToStep(4);
      return;
    }
    goToStep(3);
  });
}

function renderStepPatientDetails(body, footer) {
  const booking = state.booking;
  const newClass = booking.patientType === 'new' ? ' is-selected' : '';
  const returningClass = booking.patientType === 'returning' ? ' is-selected' : '';

  body.innerHTML =
    '<div class="field"><label>Patient type</label><div class="radio-row">' +
      '<button type="button" class="radio-pill' + newClass + '" data-patient-type="new">New patient</button>' +
      '<button type="button" class="radio-pill' + returningClass + '" data-patient-type="returning">Returning</button>' +
    '</div></div>' +
    '<div class="field"><label for="bkName">Full name</label><input type="text" class="text-input" id="bkName" value="' + escapeHtml(booking.name) + '" placeholder="Jordan Lee"></div>' +
    '<div class="field"><label for="bkEmail">Email</label><input type="email" class="text-input" id="bkEmail" value="' + escapeHtml(booking.email) + '" placeholder="you@example.com"' + (state.user ? ' readonly title="Booked with your account email"' : '') + '></div>' +
    '<div class="field"><label for="bkPhone">Phone</label><input type="tel" class="text-input" id="bkPhone" value="' + escapeHtml(booking.phone) + '" placeholder="(555) 019-2045"></div>';

  $all('[data-patient-type]', body).forEach(function (button) {
    button.addEventListener('click', function () {
      booking.patientType = button.getAttribute('data-patient-type');
      $all('[data-patient-type]', body).forEach(function (other) { other.classList.remove('is-selected'); });
      button.classList.add('is-selected');
    });
  });

  $('#bkName', body).addEventListener('input', function (event) { booking.name = event.target.value; });
  $('#bkEmail', body).addEventListener('input', function (event) { booking.email = event.target.value; });
  $('#bkPhone', body).addEventListener('input', function (event) { booking.phone = event.target.value; });

  footer.innerHTML =
    '<button class="btn btn-step-back" id="bkBack">Back</button>' +
    '<button class="btn btn-step-next" id="bkNext"><span>Review booking</span></button>';

  $('#bkBack').addEventListener('click', function () { goToStep(2); });
  $('#bkNext').addEventListener('click', function () {
    if (!isValidName(booking.name)) {
      showToast('Enter a valid name (at least 2 characters, letters and numbers only)');
      return;
    }
    if (!isValidEmail(booking.email)) {
      showToast('Enter a valid email like you@example.com');
      return;
    }
    goToStep(4);
  });
}

function renderStepReview(body, footer) {
  const booking = state.booking;
  const doctor = D.doctorById(booking.doctorId);
  const day = DAYS[booking.dayIndex];
  const visitType = booking.mode === 'video' ? 'Video visit' : 'In person, ' + doctor.roomLabel;

  body.innerHTML =
    '<div class="summary-box"><div class="doctor-avatar" style="background:' + doctor.color + ';">' + doctor.initials + '</div>' +
    '<div><h4>' + doctor.name + '</h4><p>' + doctor.deptName + ' · ' + doctor.hospitalName + '</p></div></div>' +
    '<ul class="review-list">' +
      '<li><span>Date &amp; time</span><span>' + D.fmtDay(day, { long: true }) + ', ' + booking.time + '</span></li>' +
      '<li><span>Hospital</span><span>' + doctor.hospitalName + '</span></li>' +
      '<li><span>Visit type</span><span>' + visitType + '</span></li>' +
      '<li><span>Reason</span><span>' + (booking.reason ? escapeHtml(booking.reason) : 'Not specified') + '</span></li>' +
      '<li><span>Patient</span><span>' + escapeHtml(booking.name) + '</span></li>' +
      '<li><span>Contact</span><span>' + escapeHtml(booking.email) + '</span></li>' +
      '<li><span>Visit fee</span><span>' + D.fmtBdt(doctor.fee) + '</span></li>' +
    '</ul>';

  const backStep = booking.rescheduleId && state.user ? 2 : 3;
  const confirmLabel = booking.rescheduleId ? 'Confirm new time' : 'Confirm booking';

  footer.innerHTML =
    '<button class="btn btn-step-back" id="bkBack">Back</button>' +
    '<button class="btn btn-confirm-booking" id="bkConfirm"><span>' + confirmLabel + '</span></button>';

  $('#bkBack').addEventListener('click', function () { goToStep(backStep); });
  $('#bkConfirm').addEventListener('click', confirmBooking);
}

function renderStepSuccess(body, footer) {
  const booking = state.booking;
  const appt = booking.createdAppt;
  const doctor = D.doctorById(appt.doctorId);

  body.innerHTML =
    '<div class="success-panel">' +
      '<svg class="success-icon" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.6"/><path d="M2 12h4l2-5 4 10 2-7 1.5 2H22" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      '<h3>You&#39;re booked</h3>' +
      '<p>' + doctor.name + ' · ' + appt.dayLabel + ' at ' + appt.time + '</p>' +
      '<div class="appt-id">' + appt.id + '</div>' +
      '<p style="margin:-10px 0 4px;font-size:.86rem;">Visit fee <strong style="color:var(--ink);">' + D.fmtBdt(appt.fee) + '</strong> · Your queue serial <strong style="color:var(--ink);">#' + appt.serial + '</strong></p>' +
    '</div>' +
    '<div data-queue-slot style="margin-bottom:18px;"></div>' +
    '<div class="success-actions">' +
      '<button class="btn btn-success-calendar" id="bkAddIcs">Add to calendar</button>' +
      '<button class="btn btn-success-view-appointments" id="bkViewAppts"><span>View my appointments</span></button>' +
    '</div>';

  $('#bkAddIcs').addEventListener('click', function () { downloadCalendarFile(appt); });
  $('#bkViewAppts').addEventListener('click', function () {
    closeBooking();
    navigate('appointments');
  });

  footer.innerHTML = '';
  refreshBookingQueue();
}

function refreshBookingQueue() {
  const booking = state.booking;
  if (!booking || booking.step !== 5 || !booking.createdAppt) return;

  const latest = Store.getAppointment(booking.createdAppt.id) || booking.createdAppt;
  renderQueueSlot($('[data-queue-slot]', $('#bookingBody')), latest);
}

async function confirmBooking() {
  const booking = state.booking;
  const doctor = D.doctorById(booking.doctorId);
  const day = DAYS[booking.dayIndex];
  const dateKey = D.dateKey(day);
  const time = parseTime(booking.time);

  const slot = (doctor.availability[dateKey] || []).find(function (item) { return item.time === booking.time; });
  if (!slot || isSlotUnavailable(doctor, booking.dayIndex, slot, booking.rescheduleId)) {
    showToast('Sorry, that time was just taken. Please pick another one.');
    booking.time = null;
    goToStep(2);
    return;
  }

  const details = {
    doctorId: booking.doctorId,
    dateKey: dateKey,
    dayLabel: D.fmtDay(day, { long: true }),
    time: booking.time,
    dateISO: day.toISOString(),
    hour: time.hour,
    minute: time.minute,
    sortKey: day.getTime(),
    fee: doctor.fee
  };

  const confirmButton = $('#bkConfirm');
  confirmButton.disabled = true;

  let appt;
  try {
    if (booking.rescheduleId) {
      appt = await Store.rescheduleAppointment(booking.rescheduleId, details);
    } else {
      appt = await Store.addAppointment(Object.assign({
        mode: booking.mode,
        reason: booking.reason,
        patientType: booking.patientType,
        name: cleanName(booking.name),
        email: booking.email.trim(),
        phone: booking.phone
      }, details));
    }
  } catch (error) {
    showServerError(error);
    if (error.code === 'slot_taken') {
      booking.time = null;
      loadDoctorSlots(booking.doctorId);
      goToStep(2);
    } else {
      confirmButton.disabled = false;
    }
    return;
  }

  syncPatientData();

  booking.createdAppt = appt;
  goToStep(5);
  showToast(booking.rescheduleId ? 'Appointment rescheduled' : 'Appointment booked');
}

function setFieldError(fieldId, message) {
  const field = $('#' + fieldId);
  field.classList.toggle('has-error', !!message);
  if (message) $('.error-text', field).textContent = message;
}

function setFormMessage(form, message) {
  const box = $('.form-message', form);
  box.hidden = !message;
  $('.error-text', box).textContent = message || '';
}

function setAuthMode(mode) {
  const isSignUp = mode === 'signup';
  const isVerify = mode === 'verify';
  $('#signInForm').hidden = mode !== 'signin';
  $('#signUpForm').hidden = !isSignUp;
  $('#verifyForm').hidden = !isVerify;
  $('#authTabSignIn').classList.toggle('is-selected', mode === 'signin');
  $('#authTabSignUp').classList.toggle('is-selected', isSignUp);
  $('#authTabSignIn').parentNode.hidden = isVerify;
  $('#signInTitle').textContent = isVerify ? 'Verify your e-mail' : (isSignUp ? 'Create your Meridian account' : 'Sign in to Meridian');
  ['#fieldSiId', '#fieldSiPassword', '#fieldSuUsername', '#fieldSuEmail', '#fieldSuPassword', '#fieldSuConfirm', '#fieldVfCode'].forEach(function (id) {
    $(id).classList.remove('has-error');
  });
  setFormMessage($('#signInForm'), '');
  setFormMessage($('#signUpForm'), '');
  setFormMessage($('#verifyForm'), '');
}

function openSignIn(mode) {
  setAuthMode(mode === 'signup' ? 'signup' : 'signin');
  openOverlay('#signInOverlay');
}

function closeSignIn() {
  closeOverlay('#signInOverlay');
}

$('#signInClose').addEventListener('click', closeSignIn);
$('#signInOverlay').addEventListener('click', function (event) {
  if (event.target === $('#signInOverlay')) closeSignIn();
});
$('#authTabSignIn').addEventListener('click', function () { setAuthMode('signin'); });
$('#authTabSignUp').addEventListener('click', function () { setAuthMode('signup'); });

$all('[data-show-password]').forEach(function (checkbox) {
  checkbox.addEventListener('change', function () {
    $all('input[type="password"], input[data-was-password]', checkbox.closest('form')).forEach(function (input) {
      input.type = checkbox.checked ? 'text' : 'password';
      input.setAttribute('data-was-password', '1');
    });
  });
});

['siId', 'siPassword', 'suUsername', 'suEmail', 'suPassword', 'suConfirm'].forEach(function (id) {
  const fieldId = 'field' + id.charAt(0).toUpperCase() + id.slice(1);
  $('#' + id).addEventListener('input', function () { $('#' + fieldId).classList.remove('has-error'); });
});

function finishSignIn(user) {
  state.user = sessionUser(user);
  saveSession(state.user);
  renderAuthArea();
  syncPatientData();
  closeSignIn();
  $('#signInForm').reset();
  $('#signUpForm').reset();
  $('#verifyForm').reset();
  showToast('Signed in as ' + user.name);
  if (state.view === 'appointments') renderAppointments();
}

$('#signInForm').addEventListener('submit', async function (event) {
  event.preventDefault();
  const form = $('#signInForm');
  const identifier = $('#siId').value.trim();
  const password = $('#siPassword').value;

  setFieldError('fieldSiId', identifier ? '' : 'Enter your email or username.');
  setFieldError('fieldSiPassword', password ? '' : 'Enter your password.');
  setFormMessage(form, '');
  if (!identifier || !password) return;

  const submitButton = $('.btn-sign-in-submit', form);
  submitButton.disabled = true;
  try {
    const data = await Api.post('user-signin.php', { identifier: identifier, password: password });
    finishSignIn(data.user);
  } catch (error) {
    if (error.code === 'not_verified' && error.data) {
      showVerifyStep(error.data.email, error.data.maskedEmail, 60, error.message);
    } else {
      setFormMessage(form, error.message || 'Could not sign in. Please try again.');
    }
  }
  submitButton.disabled = false;
});

$('#signUpForm').addEventListener('submit', async function (event) {
  event.preventDefault();
  const form = $('#signUpForm');
  const username = $('#suUsername').value.trim();
  const email = $('#suEmail').value.trim();
  const password = $('#suPassword').value;
  const confirm = $('#suConfirm').value;

  const problem = passwordProblem(password, username);
  const usernameOk = isValidUsername(username);
  const emailOk = isValidEmail(email);
  setFieldError('fieldSuUsername', usernameOk ? '' : 'Username must be 3 to 30 characters: letters, numbers, . _ - (start with a letter or number).');
  setFieldError('fieldSuEmail', emailOk ? '' : 'Enter a valid email like you@example.com.');
  setFieldError('fieldSuPassword', problem);
  setFieldError('fieldSuConfirm', !problem && password !== confirm ? 'The two passwords do not match.' : '');
  setFormMessage(form, '');
  if (!usernameOk || !emailOk || problem || password !== confirm) return;

  const submitButton = $('.btn-sign-up-submit', form);
  submitButton.disabled = true;
  try {
    const data = await Api.post('user-signup.php', { username: username, email: email, password: password });
    showVerifyStep(data.email, data.maskedEmail, data.resendAfter);
  } catch (error) {
    if (error.code === 'username_taken' || error.code === 'invalid_username') setFieldError('fieldSuUsername', error.message);
    else if (error.code === 'email_taken') setFieldError('fieldSuEmail', error.message);
    else if (error.code === 'invalid_password') setFieldError('fieldSuPassword', error.message);
    else setFormMessage(form, error.message || 'Could not create the account. Please try again.');
  }
  submitButton.disabled = false;
});

let verifyEmail = '';
let resendTimer = null;

function startResendCountdown(seconds) {
  const button = $('#vfResend');
  clearInterval(resendTimer);
  let left = seconds;
  button.disabled = true;
  button.textContent = 'Resend code in ' + left + 's';
  resendTimer = setInterval(function () {
    left--;
    if (left <= 0) {
      clearInterval(resendTimer);
      button.disabled = false;
      button.textContent = 'Resend code';
    } else {
      button.textContent = 'Resend code in ' + left + 's';
    }
  }, 1000);
}

function showVerifyStep(email, maskedEmail, resendAfter, message) {
  verifyEmail = email;
  setAuthMode('verify');
  $('#verifyEmailText').textContent = maskedEmail;
  $('#vfCode').value = '';
  startResendCountdown(resendAfter || 60);
  if (message) setFormMessage($('#verifyForm'), message);
  $('#vfCode').focus();
}

$('#vfCode').addEventListener('input', function (event) {
  event.target.value = event.target.value.replace(/\D/g, '').slice(0, 6);
  $('#fieldVfCode').classList.remove('has-error');
});

$('#verifyForm').addEventListener('submit', async function (event) {
  event.preventDefault();
  const form = $('#verifyForm');
  const code = $('#vfCode').value.trim();

  setFieldError('fieldVfCode', /^\d{6}$/.test(code) ? '' : 'Enter the 6-digit code from the e-mail.');
  setFormMessage(form, '');
  if (!/^\d{6}$/.test(code)) return;

  const submitButton = $('.btn-verify-submit', form);
  submitButton.disabled = true;
  try {
    const data = await Api.post('user-verify.php', { email: verifyEmail, code: code });
    clearInterval(resendTimer);
    finishSignIn(data.user);
  } catch (error) {
    setFormMessage(form, error.message || 'Could not verify the code. Please try again.');
  }
  submitButton.disabled = false;
});

$('#vfResend').addEventListener('click', async function () {
  const form = $('#verifyForm');
  setFormMessage(form, '');
  try {
    const data = await Api.post('user-resend-code.php', { email: verifyEmail });
    startResendCountdown(data.resendAfter || 60);
    showToast('A new code was sent');
  } catch (error) {
    setFormMessage(form, error.message || 'Could not send a new code.');
  }
});

$('#vfBack').addEventListener('click', function () {
  clearInterval(resendTimer);
  setAuthMode('signup');
});

async function checkSignedInUser() {
  try {
    const data = await Api.get('user-me.php');
    if (data.user) {
      state.user = sessionUser(data.user);
      saveSession(state.user);
    } else if (state.user) {
      state.user = null;
      saveSession(null);
    }
    renderAuthArea();
  } catch (error) {
    console.warn(error.message);
  }
  syncPatientData();
}

function clearSignedInUser() {
  state.user = null;
  saveSession(null);
  renderAuthArea();
  syncPatientData();
  if (state.view === 'profile') navigate('home');
}

function signOut() {
  Api.post('user-signout.php', {}).catch(function () { });
  clearSignedInUser();
  showToast('Signed out');
  navigate('home');
}

function renderAuthArea() {
  const area = $('#authArea');
  $('#mobileSignIn').textContent = state.user ? 'My appointments' : 'Sign in';
  $('#mobileProfileLink').hidden = !state.user;

  if (!state.user) {
    area.innerHTML = '<button class="btn btn-sign-in" id="signInBtn">Sign in</button>';
    $('#signInBtn').addEventListener('click', openSignIn);
    return;
  }

  const initials = profileInitials(state.user);
  const firstName = profileDisplayName(state.user).split(' ')[0];

  area.innerHTML =
    '<button class="avatar-btn" id="userMenuBtn" title="My profile"><span class="avatar-chip"></span><span class="avatar-name"></span></button>' +
    '<button class="icon-btn btn-sign-out" id="signOutBtn" aria-label="Sign out" title="Sign out">' + ICONS.exit + '</button>';

  $('.avatar-chip', area).textContent = initials;
  $('.avatar-name', area).textContent = firstName;
  $('#userMenuBtn').addEventListener('click', function () { navigate('profile'); });
  $('#signOutBtn').addEventListener('click', signOut);
}

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const GENDER_OPTIONS = [['', 'Prefer not to say'], ['male', 'Male'], ['female', 'Female'], ['other', 'Other']];
const FULL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const PHONE_PATTERN = /^[0-9+() -]{6,20}$/;
const PROFILE_FIELDS = {
  username: 'fieldPfUsername',
  fullName: 'fieldPfFullName',
  phone: 'fieldPfPhone',
  dateOfBirth: 'fieldPfDob',
  gender: 'fieldPfGender',
  bloodGroup: 'fieldPfBlood',
  address: 'fieldPfAddress'
};
const profileUi = { editing: false };

function profileDisplayName(user) {
  return user.fullName || user.name;
}

function profileInitials(user) {
  return profileDisplayName(user).split(' ')
    .filter(Boolean)
    .map(function (part) { return part[0]; })
    .join('').slice(0, 2).toUpperCase();
}

function formatProfileDate(isoDate) {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  return FULL_MONTHS[Number(parts[1]) - 1] + ' ' + Number(parts[2]) + ', ' + parts[0];
}

function formatMemberSince(milliseconds) {
  if (!milliseconds) return '';
  const date = new Date(milliseconds);
  return FULL_MONTHS[date.getMonth()] + ' ' + date.getFullYear();
}

function todayIso() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return now.getFullYear() + '-' + month + '-' + day;
}

function profileItem(label, value, wide) {
  const valueHtml = value ? '<span>' + escapeHtml(value) + '</span>' : '<span class="profile-empty">Not added</span>';
  return '<div class="profile-item' + (wide ? ' profile-item--wide' : '') + '">' +
    '<div class="profile-label">' + label + '</div>' +
    '<div class="profile-value">' + valueHtml + '</div>' +
  '</div>';
}

function renderProfile() {
  const wrap = $('#profileWrap');
  if (!state.user) {
    wrap.innerHTML = '';
    return;
  }
  if (profileUi.editing) renderProfileForm(wrap, state.user);
  else renderProfileView(wrap, state.user);
}

function renderProfileView(wrap, user) {
  const since = formatMemberSince(user.memberSince);

  wrap.innerHTML =
    '<div class="profile-card">' +
      '<div class="profile-head">' +
        '<div class="profile-avatar"></div>' +
        '<div class="profile-head-text">' +
          '<h2 class="profile-name"></h2>' +
          '<div class="profile-email"></div>' +
          (since ? '<div class="profile-since">Member since ' + escapeHtml(since) + '</div>' : '') +
        '</div>' +
        '<button type="button" class="btn btn-edit-profile" id="editProfileBtn"><span>Edit profile</span></button>' +
      '</div>' +
      '<div class="profile-grid">' +
        profileItem('Username', user.username) +
        profileItem('Full name', user.fullName) +
        profileItem('Email', user.email) +
        profileItem('Phone', user.phone) +
        profileItem('Date of birth', formatProfileDate(user.dateOfBirth)) +
        profileItem('Gender', GENDER_OPTIONS.filter(function (option) { return option[0] === user.gender && option[0] !== ''; }).map(function (option) { return option[1]; })[0] || '') +
        profileItem('Blood group', user.bloodGroup) +
        profileItem('Address', user.address, true) +
      '</div>' +
    '</div>';

  $('.profile-avatar', wrap).textContent = profileInitials(user);
  $('.profile-name', wrap).textContent = profileDisplayName(user);
  $('.profile-email', wrap).textContent = user.email;
  $('#editProfileBtn').addEventListener('click', function () {
    profileUi.editing = true;
    renderProfile();
  });
}

function setFieldError(fieldId, message) {
  const field = $('#' + fieldId);
  field.classList.toggle('has-error', !!message);
  $('.error-text', field).textContent = message || '';
}

function clearProfileErrors(form) {
  Object.keys(PROFILE_FIELDS).forEach(function (key) { setFieldError(PROFILE_FIELDS[key], ''); });
  setFormMessage(form, '');
}

function readProfileForm() {
  return {
    username: $('#pfUsername').value.trim(),
    fullName: $('#pfFullName').value.trim().replace(/\s+/g, ' '),
    phone: $('#pfPhone').value.trim(),
    dateOfBirth: $('#pfDob').value,
    gender: $('#pfGender').value,
    bloodGroup: $('#pfBlood').value,
    address: $('#pfAddress').value.trim().replace(/\s+/g, ' ')
  };
}

function validateProfile(values) {
  const errors = {};
  if (!USERNAME_PATTERN.test(values.username)) {
    errors.username = 'Username must be 3 to 30 characters: letters, numbers, . _ - (start with a letter or number).';
  }
  if (values.fullName && (values.fullName.length > 100 || !NAME_PATTERN.test(values.fullName))) {
    errors.fullName = 'Use letters, numbers, spaces and . \' _ - only (up to 100 characters).';
  }
  if (values.phone && !PHONE_PATTERN.test(values.phone)) {
    errors.phone = 'Enter a valid phone number (digits, spaces, + - and brackets only).';
  }
  if (values.dateOfBirth && (values.dateOfBirth < '1900-01-01' || values.dateOfBirth > todayIso())) {
    errors.dateOfBirth = 'Enter a valid date of birth.';
  }
  if (values.address.length > 200) {
    errors.address = 'Address must be at most 200 characters.';
  }
  return errors;
}

function profileField(id, fieldId, label, control) {
  return '<div class="field" id="' + fieldId + '"><label for="' + id + '">' + label + '</label>' + control + '<div class="error-text"></div></div>';
}

function renderProfileForm(wrap, user) {
  const genderOptions = GENDER_OPTIONS.map(function (option) {
    return '<option value="' + option[0] + '">' + option[1] + '</option>';
  }).join('');
  const bloodOptions = '<option value="">Not sure</option>' + BLOOD_GROUPS.map(function (group) {
    return '<option value="' + group + '">' + group + '</option>';
  }).join('');
  const chevron = '<svg viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  wrap.innerHTML =
    '<form class="profile-card" id="profileForm" novalidate>' +
      '<div class="profile-head">' +
        '<div class="profile-avatar"></div>' +
        '<div class="profile-head-text">' +
          '<h2 class="profile-name">Edit your profile</h2>' +
          '<div class="profile-email"></div>' +
        '</div>' +
      '</div>' +
      '<div class="profile-grid">' +
        profileField('pfUsername', PROFILE_FIELDS.username, 'Username', '<input type="text" class="text-input" id="pfUsername" maxlength="30" autocomplete="username">') +
        profileField('pfFullName', PROFILE_FIELDS.fullName, 'Full name', '<input type="text" class="text-input" id="pfFullName" maxlength="100" autocomplete="name" placeholder="e.g. Rahim Uddin">') +
        '<div class="field"><label for="pfEmail">Email</label><input type="email" class="text-input" id="pfEmail" disabled><p class="profile-note">Your email is used to sign in and for appointments, so it cannot be changed here.</p></div>' +
        profileField('pfPhone', PROFILE_FIELDS.phone, 'Phone', '<input type="tel" class="text-input" id="pfPhone" maxlength="20" autocomplete="tel" placeholder="+880 1XXX-XXXXXX">') +
        profileField('pfDob', PROFILE_FIELDS.dateOfBirth, 'Date of birth', '<input type="date" class="text-input" id="pfDob" min="1900-01-01" max="' + todayIso() + '">') +
        profileField('pfGender', PROFILE_FIELDS.gender, 'Gender', '<div class="select-wrap"><select id="pfGender">' + genderOptions + '</select>' + chevron + '</div>') +
        profileField('pfBlood', PROFILE_FIELDS.bloodGroup, 'Blood group', '<div class="select-wrap"><select id="pfBlood">' + bloodOptions + '</select>' + chevron + '</div>') +
        '<div class="profile-item--wide">' +
          profileField('pfAddress', PROFILE_FIELDS.address, 'Address', '<textarea id="pfAddress" maxlength="200" rows="3" autocomplete="street-address" placeholder="House, road, area, city"></textarea>') +
        '</div>' +
      '</div>' +
      '<div class="field has-error form-message" hidden><div class="error-text"></div></div>' +
      '<div class="profile-actions">' +
        '<button type="submit" class="btn btn-save-profile" id="saveProfileBtn"><span>Save changes</span></button>' +
        '<button type="button" class="btn btn-cancel-profile" id="cancelProfileBtn"><span>Cancel</span></button>' +
      '</div>' +
    '</form>';

  const form = $('#profileForm');
  $('.profile-avatar', wrap).textContent = profileInitials(user);
  $('.profile-email', wrap).textContent = user.email;
  $('#pfUsername').value = user.username;
  $('#pfFullName').value = user.fullName;
  $('#pfEmail').value = user.email;
  $('#pfPhone').value = user.phone;
  $('#pfDob').value = user.dateOfBirth;
  $('#pfGender').value = user.gender;
  $('#pfBlood').value = user.bloodGroup;
  $('#pfAddress').value = user.address;

  form.addEventListener('input', function (event) {
    const field = event.target.closest('.field');
    if (field) field.classList.remove('has-error');
  });
  form.addEventListener('change', function (event) {
    const field = event.target.closest('.field');
    if (field) field.classList.remove('has-error');
  });
  $('#cancelProfileBtn').addEventListener('click', function () {
    profileUi.editing = false;
    renderProfile();
  });
  form.addEventListener('submit', submitProfileForm);
}

async function submitProfileForm(event) {
  event.preventDefault();
  const form = event.target;
  clearProfileErrors(form);

  const values = readProfileForm();
  const errors = validateProfile(values);
  const failedKeys = Object.keys(errors);
  if (failedKeys.length) {
    failedKeys.forEach(function (key) { setFieldError(PROFILE_FIELDS[key], errors[key]); });
    return;
  }

  const button = $('#saveProfileBtn');
  button.disabled = true;
  try {
    const data = await Api.post('user-profile.php', values);
    state.user = sessionUser(data.user);
    saveSession(state.user);
    renderAuthArea();
    profileUi.editing = false;
    renderProfile();
    showToast('Profile updated');
  } catch (error) {
    if (error.code === 'not_logged_in') {
      clearSignedInUser();
      openSignIn();
      return;
    }
    const key = (error.code || '').replace(/^invalid_/, '');
    if (error.code === 'username_taken') setFieldError(PROFILE_FIELDS.username, error.message);
    else if (PROFILE_FIELDS[key]) setFieldError(PROFILE_FIELDS[key], error.message);
    else setFormMessage(form, error.message || 'Could not save your profile. Please try again.');
    button.disabled = false;
  }
}

async function openProfileView() {
  profileUi.editing = false;
  renderProfile();
  try {
    const data = await Api.get('user-profile.php');
    state.user = sessionUser(data.user);
    saveSession(state.user);
    renderAuthArea();
    if (state.view === 'profile' && !profileUi.editing) renderProfile();
  } catch (error) {
    if (error.code === 'not_logged_in') {
      clearSignedInUser();
      openSignIn();
    }
  }
}

document.addEventListener('keydown', function (event) {
  if (event.key !== 'Escape') return;
  if (isOpen('#bookingOverlay')) closeBooking();
  if (isOpen('#signInOverlay')) closeSignIn();
  if (isOpen('#queueOverlay')) closeQueueModal();
  if (isOpen('#mobilePanel')) closeMobilePanel();
});

$('#contactForm').addEventListener('submit', function (event) {
  event.preventDefault();

  const checks = [
    { field: $('#fieldName'), valid: $('#cName').value.trim().length > 1 },
    { field: $('#fieldEmail'), valid: isValidEmail($('#cEmail').value) },
    { field: $('#fieldMsg'), valid: $('#cMsg').value.trim().length > 4 }
  ];

  let allValid = true;
  checks.forEach(function (check) {
    check.field.classList.toggle('has-error', !check.valid);
    if (!check.valid) allValid = false;
  });
  if (!allValid) return;

  showToast('Message sent — we\'ll reply within one business day');
  $('#contactForm').reset();
});

$('#newsletterForm').addEventListener('submit', function (event) {
  event.preventDefault();
  const input = $('#newsletterEmail');
  if (!isValidEmail(input.value)) {
    showToast('Enter a valid email to subscribe');
    return;
  }
  showToast('Subscribed with ' + input.value.trim());
  input.value = '';
});

$all('[data-toast]').forEach(function (link) {
  link.addEventListener('click', function (event) {
    event.preventDefault();
    showToast(link.getAttribute('data-toast'));
  });
});

$all('[data-social]').forEach(function (button) {
  button.addEventListener('click', function () {
    showToast('Meridian on ' + button.getAttribute('data-social') + ' — coming soon');
  });
});

fillDoctorFilters();
fillHeroDropdowns();
renderDepartments();
renderHomeDoctors();
renderCarousel('homeCarousel', 'home');
renderCarousel('aboutCarousel', 'about');
renderAuthArea();
checkSignedInUser();
navigate(location.hash.replace('#', '') || 'home', { skipScroll: true });
})();
