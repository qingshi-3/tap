export function createAdventureGift({ progress, canShow, onPlay }) {
  const dialog = document.getElementById('adventure-gift');
  let opener = null, scheduled = false;
  function close() {
    progress.dismissAdventureGiftNotice();
    dialog.close();
    if (opener?.isConnected) opener.focus({ preventScroll: true });
  }
  function check() {
    if (dialog.open || !canShow() || document.querySelector('dialog[open]') || !progress.adventureAccessStatus().pendingNotice) return;
    opener = document.activeElement;
    dialog.showModal();
    dialog.querySelector('.gift-play').focus({ preventScroll: true });
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => { scheduled = false; check(); }, 0);
  }
  dialog.querySelector('.gift-close').addEventListener('click', close);
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.querySelector('.gift-play').addEventListener('click', () => { close(); onPlay(); });
  dialog.querySelector('.gift-review').addEventListener('click', close);
  progress.subscribe(schedule);
  // Existing modals and scene transitions finish before the first invitation.
  document.addEventListener('close', schedule, true);
  window.addEventListener('pageshow', schedule);
  return { check: schedule };
}
