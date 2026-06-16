// Meta Pixel + Conversions API (CAPI) browser helper.
//
// Fires the browser Pixel event and mirrors it to the server-side CAPI
// endpoint (/api/capi) using a shared event_id so Meta deduplicates the two.
// There are NO secrets in this file — it is served publicly.

(function () {
  function getCookie(name) {
    var match = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
    return match ? match.pop() : undefined;
  }

  function setCookie(name, value, days) {
    document.cookie =
      name + '=' + value + ';path=/;max-age=' + days * 24 * 60 * 60 + ';SameSite=Lax';
  }

  function getParam(name) {
    var m = window.location.search.match(new RegExp('[?&]' + name + '=([^&]+)'));
    return m ? decodeURIComponent(m[1]) : undefined;
  }

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // The Meta Pixel sets _fbp / _fbc asynchronously (fbevents.js loads async),
  // so the first events would otherwise be sent to CAPI without them. We create
  // the cookies synchronously here, BEFORE any event fires. fbevents reuses an
  // existing _fbp, so the browser Pixel and server CAPI share identical
  // parameters from the very first event (format: fb.<subdomain>.<ts>.<id>).
  function ensureFbCookies() {
    if (!getCookie('_fbp')) {
      var rand =
        '' +
        Math.floor(Math.random() * 1e10) +
        Math.floor(Math.random() * 1e10);
      setCookie('_fbp', 'fb.1.' + Date.now() + '.' + rand, 90);
    }
    // _fbc is derived from the fbclid click id when present.
    var fbclid = getParam('fbclid');
    if (fbclid && !getCookie('_fbc')) {
      setCookie('_fbc', 'fb.1.' + Date.now() + '.' + fbclid, 90);
    }
  }

  // Fires an event on both the browser Pixel and the server-side CAPI,
  // deduplicated via a shared event_id. Exposed as window.unboundTrack so
  // buttons/links can report conversions (e.g. Lead, Contact).
  function track(eventName, customData) {
    var eventId = uuid();
    customData = customData || {};

    if (window.fbq) {
      fbq('track', eventName, customData, { eventID: eventId });
    }

    try {
      fetch('/api/capi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          event_name: eventName,
          event_id: eventId,
          event_source_url: window.location.href,
          custom_data: customData,
          fbp: getCookie('_fbp'),
          fbc: getCookie('_fbc'),
        }),
      }).catch(function () {});
    } catch (e) {}
  }

  window.unboundTrack = track;

  // Guarantee matching parameters exist before the first event is sent.
  ensureFbCookies();

  // Conversion events declared on elements via data-track-event.
  // Optional data-track-content sets custom_data.content_name.
  document.addEventListener(
    'click',
    function (e) {
      var el =
        e.target && e.target.closest ? e.target.closest('[data-track-event]') : null;
      if (!el) return;
      var eventName = el.getAttribute('data-track-event');
      if (!eventName) return;
      var customData = {};
      var contentName = el.getAttribute('data-track-content');
      if (contentName) customData.content_name = contentName;
      track(eventName, customData);
    },
    true
  );

  // Fire PageView on every page load.
  track('PageView');

  // The menu is the key content page — also report ViewContent.
  if (/\/menu(\.html)?$/.test(window.location.pathname)) {
    track('ViewContent', { content_name: 'Menu', content_category: 'Menu' });
  }
})();
