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

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
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
