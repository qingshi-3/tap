// This classic script runs before the module graph, so resource and syntax errors stay visible.
(function () {
  var panel = document.getElementById('boot');
  var message = document.getElementById('boot-message');
  var retry = document.getElementById('boot-retry');
  var ready = false;
  var timer;
  function cleanup() {
    clearTimeout(timer);
    window.removeEventListener('error', onError, true);
    window.removeEventListener('unhandledrejection', onRejection);
  }
  function fail(code) {
    if (ready) return;
    clearTimeout(timer);
    window.mmdpBoot.failure = code;
    message.textContent = code === 'resource'
      ? '游戏资源未能加载，请重试。'
      : code === 'timeout'
        ? '开门时间有些久，请重新加载。'
        : '游戏启动未完成，请重新加载。';
    retry.hidden = false;
  }
  function onError(event) {
    if (event.target && event.target.tagName === 'SCRIPT') fail('resource');
    else if (event.error || event.message) fail('startup');
  }
  function onRejection() { fail('startup'); }
  window.mmdpBoot = {
    failure: null,
    ready: function () {
      ready = true;
      cleanup();
      panel.hidden = true;
    }
  };
  retry.addEventListener('click', function () { window.location.reload(); });
  window.addEventListener('error', onError, true);
  window.addEventListener('unhandledrejection', onRejection);
  timer = setTimeout(function () { fail('timeout'); }, 12000);
}());
