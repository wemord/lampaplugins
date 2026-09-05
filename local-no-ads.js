(function () {
  'use strict';

  var TAG = '[LOCAL-NO-ADS]';
  var installed = false;
  var active = [];

  function log() {
    try {
      var args = [TAG];
      for (var i = 0; i < arguments.length; i++) args.push(arguments[i]);
      console.log.apply(console, args);
    } catch (e) {}
  }

  function warn() {
    try {
      var args = [TAG];
      for (var i = 0; i < arguments.length; i++) args.push(arguments[i]);
      console.warn.apply(console, args);
    } catch (e) {}
  }

  function str(v) {
    return String(v == null ? '' : v);
  }

  function lower(v) {
    return str(v).toLowerCase();
  }

  function stripCredentials(url) {
    return str(url).replace(/^(https?:\/\/)[^\/@]+@/i, '$1');
  }

  function normalizeUrl(url) {
    var s = stripCredentials(url).replace(/\/+$/, '');
    try {
      s = decodeURIComponent(s);
    } catch (e) {}
    return lower(s);
  }

  function isJellyfin(data) {
    if (!data || !data.url) return false;
    var url = normalizeUrl(data.url);

    if (url.indexOf('/videos/') === -1) return false;

    return (
      url.indexOf('/stream') !== -1 ||
      url.indexOf('/master.m3u8') !== -1 ||
      url.indexOf('/universal') !== -1
    );
  }

  function safeStorageField(key) {
    try {
      if (window.Lampa && Lampa.Storage && typeof Lampa.Storage.field === 'function') {
        return Lampa.Storage.field(key);
      }
    } catch (e) {}
    return null;
  }

  function collectWebdavBasesFromLampaStorage() {
    var bases = [];
    var candidates = [
      'lmetorrentqBittorentWebdavUrl',
      'lmetorrentqBittorrentWebdavUrl',
      'lmetorrentTransmissionWebdavUrl',
      'lmetorrentSynologyWebdavUrl',
      'lmetorrentWebdavUrl'
    ];

    for (var i = 0; i < candidates.length; i++) {
      var v = safeStorageField(candidates[i]);
      if (v) bases.push(v);
    }

    return bases;
  }

  function collectWebdavBasesFromLocalStorage() {
    var bases = [];

    try {
      if (!window.localStorage) return bases;

      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (!key) continue;

        var keyLower = lower(key);
        if (keyLower.indexOf('webdav') === -1) continue;
        if (
          keyLower.indexOf('torrent') === -1 &&
          keyLower.indexOf('qbitt') === -1 &&
          keyLower.indexOf('transmission') === -1 &&
          keyLower.indexOf('synology') === -1
        ) continue;

        var raw = localStorage.getItem(key);
        if (!raw) continue;

        var values = [raw];

        try {
          var parsed = JSON.parse(raw);
          if (typeof parsed === 'string') values.push(parsed);
          else if (parsed && typeof parsed === 'object') {
            for (var p in parsed) {
              if (Object.prototype.hasOwnProperty.call(parsed, p) && typeof parsed[p] === 'string') {
                values.push(parsed[p]);
              }
            }
          }
        } catch (e) {}

        for (var j = 0; j < values.length; j++) {
          var v = str(values[j]);
          if (/^https?:\/\//i.test(v)) bases.push(v);
        }
      }
    } catch (e) {}

    return bases;
  }

  function uniqueNormalized(values) {
    var out = [];
    var seen = {};

    for (var i = 0; i < values.length; i++) {
      var n = normalizeUrl(values[i]);
      if (!n || seen[n]) continue;
      seen[n] = true;
      out.push(n);
    }

    return out;
  }

  function getTorrentManagerWebdavBases() {
    return uniqueNormalized(
      collectWebdavBasesFromLampaStorage().concat(
        collectWebdavBasesFromLocalStorage()
      )
    );
  }

  function urlMatchesBase(url, base) {
    if (!url || !base) return false;

    var u = normalizeUrl(url);
    var b = normalizeUrl(base);

    if (!u || !b) return false;

    if (u.indexOf(b) === 0) return true;

    // Fallback for URLs with credentials inserted after protocol.
    var uNoProto = u.replace(/^https?:\/\//, '');
    var bNoProto = b.replace(/^https?:\/\//, '');

    return uNoProto.indexOf(bNoProto) === 0;
  }

  function isTorrentManager(data) {
    if (!data || !data.url) return false;

    var bases = getTorrentManagerWebdavBases();

    for (var i = 0; i < bases.length; i++) {
      if (urlMatchesBase(data.url, bases[i])) return true;
    }

    return false;
  }

  function detectSource(data) {
    if (isJellyfin(data)) return 'jellyfin';
    if (isTorrentManager(data)) return 'torrent-manager';
    return '';
  }

  function findActive(data) {
    for (var i = 0; i < active.length; i++) {
      if (active[i].data === data) return i;
    }
    return -1;
  }

  function mark(data, source) {
    if (!data || findActive(data) !== -1) return;

    var hadIptv = Object.prototype.hasOwnProperty.call(data, 'iptv');
    var originalIptv = data.iptv;

    active.push({
      data: data,
      source: source,
      hadIptv: hadIptv,
      originalIptv: originalIptv
    });

    data.iptv = true;

    log('source=' + source, 'preroll skip armed', data.url);
  }

  function restore(data) {
    var idx = findActive(data);
    if (idx === -1) return;

    var item = active[idx];
    active.splice(idx, 1);

    if (item.hadIptv) {
      data.iptv = item.originalIptv;
    } else {
      try {
        delete data.iptv;
      } catch (e) {
        data.iptv = false;
      }
    }

    log('source=' + item.source, 'temporary flag restored');
  }

  function install() {
    if (installed) return true;

    if (
      !window.Lampa ||
      !Lampa.Player ||
      !Lampa.Player.listener ||
      typeof Lampa.Player.listener.send !== 'function'
    ) {
      return false;
    }

    if (Lampa.Player.listener.send.__localNoAdsWrapped) {
      installed = true;
      return true;
    }

    var originalSend = Lampa.Player.listener.send;

    function wrappedSend(type, payload) {
      // Before all normal "start" listeners run, remove our temporary flag.
      if (type === 'start' && payload) {
        restore(payload);
      }

      var result = originalSend.apply(this, arguments);

      // Player.play emits "create" synchronously before Preroll.show().
      // Modify only after all regular create listeners have already run,
      // so we do not interfere with their logic.
      if (type === 'create' && payload && payload.data) {
        var source = detectSource(payload.data);
        if (source) mark(payload.data, source);
      }

      // Safety cleanup for aborted/destroyed playback.
      if (type === 'destroy' && active.length) {
        while (active.length) {
          restore(active[0].data);
        }
      }

      return result;
    }

    wrappedSend.__localNoAdsWrapped = true;
    wrappedSend.__localNoAdsOriginal = originalSend;

    Lampa.Player.listener.send = wrappedSend;
    installed = true;

    var webdavBases = getTorrentManagerWebdavBases();

    log('installed');
    log('Jellyfin detection: enabled');
    log('Torrent Manager WebDAV bases:', webdavBases.length ? webdavBases : 'not found yet');

    return true;
  }

  function start() {
    if (install()) return;

    var tries = 0;
    var timer = setInterval(function () {
      tries++;

      if (install()) {
        clearInterval(timer);
        return;
      }

      if (tries >= 60) {
        clearInterval(timer);
        warn('could not install Player listener hook');
      }
    }, 500);
  }

  if (window.__LOCAL_NO_ADS_PLUGIN__) {
    log('already loaded');
    return;
  }

  window.__LOCAL_NO_ADS_PLUGIN__ = true;

  if (window.appready) {
    start();
  } else if (
    window.Lampa &&
    Lampa.Listener &&
    typeof Lampa.Listener.follow === 'function'
  ) {
    Lampa.Listener.follow('app', function (e) {
      if (e && e.type === 'ready') start();
    });

    setTimeout(start, 1500);
  } else {
    setTimeout(start, 1500);
  }
})();
