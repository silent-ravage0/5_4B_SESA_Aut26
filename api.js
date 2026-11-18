window.MeridianApi = (function () {
  "use strict";

  const API_FOLDER = 'api/';

  function makeError(message, status, code) {
    const error = new Error(message);
    error.status = status;
    error.code = code || '';
    return error;
  }

  async function request(file, options) {
    let response;
    try {
      response = await fetch(API_FOLDER + file, options);
    } catch (networkError) {
      throw makeError('Cannot reach the server. Is Apache running?', 0, 'network');
    }

    let data = null;
    try {
      data = await response.json();
    } catch (parseError) {
      data = null;
    }

    if (!response.ok) {
      const message = data && data.error ? data.error : 'Server error (' + response.status + ')';
      const error = makeError(message, response.status, data ? data.code : '');
      error.data = data;
      throw error;
    }
    return data;
  }

  function get(file, params) {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(file + query, { credentials: 'same-origin' });
  }

  function post(file, body) {
    return request(file, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    });
  }

  return { get: get, post: post };
})();
