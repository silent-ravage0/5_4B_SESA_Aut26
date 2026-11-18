window.MeridianStore = (function () {
  "use strict";

  const D = window.MeridianData;
  const Api = window.MeridianApi;

  const cache = {
    myAppointments: [],
    todayByDoctor: {},
    queueByDoctor: {},
    takenByDoctor: {}
  };

  let patientEmail = null;
  let focusDoctorIds = [];
  const listeners = [];
  let lastSnapshot = '';

  function todayKey() {
    return D.dateKey(D.DAYS[0]);
  }

  function onChange(listener) {
    listeners.push(listener);
  }

  function notifyIfChanged() {
    const snapshot = JSON.stringify(cache);
    if (snapshot === lastSnapshot) return;
    lastSnapshot = snapshot;
    listeners.forEach(function (listener) { listener(); });
  }

  function setPatientEmail(email) {
    patientEmail = email ? email.trim().toLowerCase() : null;
    if (!patientEmail) {
      cache.myAppointments = [];
      notifyIfChanged();
    }
  }

  function applyDoctorStates(doctors) {
    Object.keys(doctors).forEach(function (doctorId) {
      const state = doctors[doctorId];
      cache.takenByDoctor[doctorId] = state.taken || {};
      cache.todayByDoctor[doctorId] = state.today || [];
      cache.queueByDoctor[doctorId] = state.queue || { serving: null, completed: [], updatedAt: null };
    });
  }

  async function loadDoctorStates(doctorIds) {
    for (let start = 0; start < doctorIds.length; start += 10) {
      const group = doctorIds.slice(start, start + 10);
      const data = await Api.get('doctor-state.php', { doctor_ids: group.join(','), today: todayKey() });
      applyDoctorStates(data.doctors);
    }
  }

  async function watchDoctor(doctorId) {
    focusDoctorIds = focusDoctorIds.filter(function (id) { return id !== doctorId; });
    focusDoctorIds.push(doctorId);
    if (focusDoctorIds.length > 3) focusDoctorIds.shift();

    await loadDoctorStates([doctorId]);
    notifyIfChanged();
  }

  async function refreshPatient() {
    const doctorIds = focusDoctorIds.slice();

    if (patientEmail) {
      const data = await Api.get('my-appointments.php');
      cache.myAppointments = data.appointments;
      cache.myAppointments.forEach(function (appt) {
        if (doctorIds.indexOf(appt.doctorId) === -1) doctorIds.push(appt.doctorId);
      });
    }

    await loadDoctorStates(doctorIds);
    notifyIfChanged();
  }

  async function refreshAdmin() {
    const data = await Api.get('admin-state.php', { today: todayKey() });

    const byDoctor = {};
    data.appointments.forEach(function (appt) {
      if (!byDoctor[appt.doctorId]) byDoctor[appt.doctorId] = [];
      byDoctor[appt.doctorId].push(appt);
    });

    cache.todayByDoctor = byDoctor;
    cache.queueByDoctor = data.queues;
    notifyIfChanged();
  }

  function getMyAppointments() {
    return cache.myAppointments.slice();
  }

  function getAppointment(id) {
    return cache.myAppointments.find(function (appt) { return appt.id === id; }) || null;
  }

  function isSlotTaken(doctorId, dateKey, time, ignoreId) {
    const doctor = D.doctorById(doctorId);
    if (doctor && doctor.emergency) return false;

    const takenTimes = (cache.takenByDoctor[doctorId] || {})[dateKey] || [];
    if (takenTimes.indexOf(time) === -1) return false;

    const own = ignoreId ? getAppointment(ignoreId) : null;
    const isOwnSlot = own && own.status !== 'cancelled' &&
      own.doctorId === doctorId && own.dateKey === dateKey && own.time === time;
    return !isOwnSlot;
  }

  async function addAppointment(details) {
    const data = await Api.post('book.php', details);
    await watchDoctor(data.appointment.doctorId);
    return data.appointment;
  }

  async function cancelAppointment(id) {
    await Api.post('appointment-update.php', { action: 'cancel', id: id });
    await refreshPatient();
  }

  async function rescheduleAppointment(id, details) {
    const body = Object.assign({ action: 'reschedule', id: id }, details);
    const data = await Api.post('appointment-update.php', body);
    await refreshPatient();
    return data.appointment;
  }

  function getQueueInfo(doctorId, dateKey) {
    dateKey = dateKey || todayKey();
    const appointments = (cache.todayByDoctor[doctorId] || []).slice().sort(function (a, b) {
      return a.serial - b.serial;
    });
    const serials = appointments.map(function (appt) { return appt.serial; });
    const raw = cache.queueByDoctor[doctorId] || { serving: null, completed: [], updatedAt: null };

    const completed = (raw.completed || []).filter(function (serial) { return serials.indexOf(serial) !== -1; });
    const completedSet = {};
    completed.forEach(function (serial) { completedSet[serial] = true; });

    const serving = serials.indexOf(raw.serving) !== -1 ? raw.serving : null;

    const waitingSerials = serials.filter(function (serial) {
      return !completedSet[serial] && serial !== serving;
    });

    let status = 'not-started';
    if (appointments.length === 0) status = 'empty';
    else if (serving !== null) status = 'serving';
    else if (waitingSerials.length === 0) status = 'finished';

    return {
      doc: D.doctorById(doctorId),
      dateKey: dateKey,
      appointments: appointments,
      total: appointments.length,
      serving: serving,
      completed: completed,
      completedSet: completedSet,
      waitingSerials: waitingSerials,
      nextSerial: waitingSerials.length ? waitingSerials[0] : null,
      status: status,
      updatedAt: raw.updatedAt
    };
  }

  function getDoctorStatus(doctorId) {
    const raw = cache.queueByDoctor[doctorId];
    const arrived = !!raw && (raw.serving !== null || (raw.completed || []).length > 0);
    return { arrived: arrived, message: null };
  }

  async function adminLogin(username, password) {
    await Api.post('admin-login.php', { username: username, password: password });
  }

  async function adminLogout() {
    await Api.post('admin-logout.php', {});
  }

  async function callNextPatient(doctorId) {
    await Api.post('admin-queue.php', { action: 'call', doctorId: doctorId, dateKey: todayKey() });
    await refreshAdmin();
    return getQueueInfo(doctorId);
  }

  async function resetQueue(doctorId) {
    await Api.post('admin-queue.php', { action: 'reset', doctorId: doctorId, dateKey: todayKey() });
    await refreshAdmin();
    return getQueueInfo(doctorId);
  }

  return {
    onChange: onChange,
    setPatientEmail: setPatientEmail,
    watchDoctor: watchDoctor,
    refreshPatient: refreshPatient,
    refreshAdmin: refreshAdmin,
    getMyAppointments: getMyAppointments,
    getAppointment: getAppointment,
    isSlotTaken: isSlotTaken,
    addAppointment: addAppointment,
    cancelAppointment: cancelAppointment,
    rescheduleAppointment: rescheduleAppointment,
    getQueueInfo: getQueueInfo,
    getDoctorStatus: getDoctorStatus,
    adminLogin: adminLogin,
    adminLogout: adminLogout,
    callNextPatient: callNextPatient,
    resetQueue: resetQueue
  };
})();
