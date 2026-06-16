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

    if (window.fbq) {
      fbq('track', eventName, customData || {}, { eventID: eventId });
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
          fbp: getCookie('_fbp'),
          fbc: getCookie('_fbc'),
        }),
      }).catch(function () {});
    } catch (e) {}
  }

  window.unboundTrack = track;

  // Fire PageView on every page load.
  track('PageView');
})();
