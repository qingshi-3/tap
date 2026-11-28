// Original pixelfx transitions/burn-away, 91 frames at three-times playback.
const SHEET = new URL('../assets/transitions/burn-away.png', import.meta.url).href;
const DURATION = 1000;
const COVER = 450;

export function createSceneTransitions(doc, permitted) {
  const win = doc.defaultView;
  const sheet = new win.Image();
  sheet.src = SHEET;
  const popover = typeof doc.createElement('div').showPopover === 'function';
  const veil = doc.createElement(popover ? 'div' : 'dialog');
  veil.className = 'qibing-scene-veil';
  veil.setAttribute('aria-hidden', 'true');
  if (popover) {
    veil.setAttribute('popover', 'manual');
  } else {
    veil.addEventListener('cancel', event => {
      event.preventDefault();
      cancel();
    });
  }
  veil.hidden = true;
  doc.body.append(veil);
  let current;

  function clear(job) {
    if (current !== job) return;
    win.clearTimeout(job.cover);
    win.clearTimeout(job.end);
    job.animation?.cancel();
    if (popover && veil.matches?.(':popover-open')) veil.hidePopover();
    if (!popover && veil.open) veil.close();
    veil.hidden = true;
    current = null;
    const focus = job.focus;
    if (!popover && focus !== veil && focus?.isConnected && !focus.closest('[hidden],dialog:not([open])')) {
      focus.focus({ preventScroll: true });
    }
  }

  function commit(job) {
    if (job.committed) return;
    job.committed = true;
    for (const [node, inert] of job.frozen) node.inert = inert;
    try {
      job.resolve(job.callback());
    } catch (error) {
      job.reject(error);
      clear(job);
    }
    // A newly opened objective dialog must remain below the decorative layer.
    if (current === job) {
      job.focus = doc.activeElement;
      try {
        if (popover && veil.matches?.(':popover-open')) {
          veil.hidePopover();
          veil.showPopover();
        } else if (!popover && veil.open) {
          veil.close();
          veil.showModal();
        }
      } catch {
        clear(job);
      }
    }
  }

  function cancel() {
    if (!current) return;
    const job = current;
    // Cancellation skips only the visual; an accepted host operation is never lost.
    commit(job);
    clear(job);
  }

  function change(callback) {
    cancel();
    if (!permitted() || !veil.animate || !sheet.complete || !sheet.naturalWidth || (!popover && !veil.showModal)) {
      try {
        return Promise.resolve(callback());
      } catch (error) {
        return Promise.reject(error);
      }
    }
    return new Promise((resolve, reject) => {
      const frozen = [...doc.querySelectorAll('#expedition-home,#lobby,#match,dialog[open]')]
        .map(node => [node, node.inert]);
      for (const [node] of frozen) node.inert = true;
      const job = current = { callback, resolve, reject, frozen, committed: false };
      veil.hidden = false;
      veil.style.backgroundImage = `url("${SHEET}")`;
      try {
        if (popover) veil.showPopover();
        else veil.showModal();
      } catch {
        commit(job);
        clear(job);
        return;
      }
      const frames = Array.from({ length: 91 }, (_, i) => ({
        backgroundPosition: `${i % 8 * 100 / 7}% ${Math.floor(i / 8) * 100 / 11}%`,
        offset: i / 90,
        easing: 'steps(1,end)',
      }));
      try {
        job.animation = veil.animate(frames, { duration: DURATION, easing: 'linear', fill: 'forwards' });
      } catch {
        commit(job);
        clear(job);
        return;
      }
      job.cover = win.setTimeout(() => commit(job), COVER);
      job.animation.onfinish = () => {
        commit(job);
        clear(job);
      };
      job.end = win.setTimeout(() => {
        commit(job);
        clear(job);
      }, DURATION + 150);
    });
  }

  return {
    change,
    cancel,
    dispose() {
      cancel();
      veil.remove();
    },
  };
}
