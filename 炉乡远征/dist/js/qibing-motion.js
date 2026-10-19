/* Adapted from zhenlie-demo/source/src/ui/app.ts App.show (320ms in /
   260ms out), App.modal (200ms veil / 260ms content), showHowTo (220ms
   horizontal page), and source/src/style.css .res-card/popIn (.45s).
   No event interception, pointer capture, fake reward or persistence writes. */
const EXCLUDE = '.recruitment-dialog,.recruitment-presentation,.resource-rewards-dialog,.reward-presentation,.hand-zone,.game-card,.hand-card,.training-card-open,.spell-card-open,.expedition-codex-card,.squad-slot,.deck-card-detail,.portrait-frame,#bbs-button,#unit-inspect,.atlas-enemy-card-open,.card-dialog,.expedition-card-dialog';
const DIALOGS = '.atlas-enemy-card-dialog,.game-dialog,.hero-dialog,.hero-effect-dialog,.atlas-dialog,#audio-settings,#cloud-dialog,#objective-dialog,#game-result,#confirm-screen';
const FIGHT = '.menu-play,.prep-start,.atlas-start,#new-game,#play-again,#next-level';
const installations = new WeakMap();

export function installQibingMotion(doc = document) {
  if (installations.has(doc)) return installations.get(doc);
  const win = doc.defaultView;
  const media = win.matchMedia('(prefers-reduced-motion: reduce)');
  const animations = new Map();
  const dialogs = new Map();
  const roots = [...doc.querySelectorAll('#expedition-home,#lobby,#match')];
  const rootStates = new Map();
  let disposed = false;
  const permitted = () => !disposed && !doc.hidden && !media.matches;
  const visible = node => node.isConnected && !node.closest('[hidden],dialog:not([open])');
  function cancel(node) { animations.get(node)?.cancel(); animations.delete(node); }
  function animate(node, frames, options) {
    cancel(node);
    if (!permitted() || !visible(node) || !node.animate) return null;
    const animation = node.animate(frames, options);
    animations.set(node, animation);
    animation.onfinish = () => { if (animations.get(node) === animation) animations.delete(node); };
    return animation;
  }
  function screenIn(node) {
    return animate(node,[{opacity:0},{opacity:1}],{duration:320,easing:'ease-out'});
  }
  // Explicit integration seam for a caller which already owns an outgoing
  // screen. Never delay host hidden/remove or clone live controls to fake exit.
  function screenOut(node) {
    return animate(node,[{opacity:1},{opacity:0}],{duration:260,easing:'ease-in'});
  }
  function checkDialog(node) {
    const entry = dialogs.get(node);
    if (!entry) return;
    const open = visible(node);
    if (open === entry.open) return;
    entry.open = open;
    const target = node.querySelector(':scope > .result-panel,:scope > .confirm-panel') || node;
    cancel(node);
    cancel(target);
    node.classList.toggle('qibing-modal-open',open && node.id !== 'game-result');
    if (!open) {
      for (const animated of animations.keys()) if (node.contains(animated)) cancel(animated);
      return;
    }
    if (node.id === 'game-result') {
      animate(target,[{scale:'.7',opacity:0},{scale:'1',opacity:1}],{duration:450,easing:'cubic-bezier(.2,1.4,.4,1)'});
    } else {
      // Native dialogs expose their veil as ::backdrop (CSS below). Confirm
      // already has a separate overlay node, so its original 200ms fade can
      // be applied there without adding a wrapper or delaying real closure.
      if (target !== node) animate(node,[{opacity:0},{opacity:1}],{duration:200});
      animate(target,[{scale:'.92',translate:'0 10px'},{scale:'1',translate:'0 0'}],{duration:260,easing:'cubic-bezier(.2,.9,.3,1.2)'});
    }
  }
  function decorate(scope) {
    const buttons = [...(scope.matches?.('button') ? [scope] : []), ...scope.querySelectorAll('button')];
    for (const button of buttons) {
      if (button.closest(EXCLUDE)) continue;
      button.classList.add('qibing-command');
      if (button.matches(FIGHT)) button.classList.add('qibing-fight');
    }
    const surfaces = [...(scope.matches?.(DIALOGS) ? [scope] : []), ...scope.querySelectorAll(DIALOGS)];
    for (const node of surfaces) {
      if (dialogs.has(node) || node.closest(EXCLUDE)) continue;
      const observer = new win.MutationObserver(() => checkDialog(node));
      dialogs.set(node,{observer,open:false});
      observer.observe(node,{attributes:true,attributeFilter:['hidden','open','class']});
      checkDialog(node);
    }
  }
  decorate(doc);
  for (const root of roots) rootStates.set(root,{page:root.dataset.page,visible:visible(root)});
  const rootObserver = new win.MutationObserver(() => {
    for (const [root,state] of rootStates) {
      const next = {page:root.dataset.page,visible:visible(root)};
      if (next.visible && (!state.visible || next.page !== state.page)) screenIn(root);
      if (!next.visible) cancel(root);
      rootStates.set(root,next);
    }
  });
  for (const root of roots) rootObserver.observe(root,{attributes:true,attributeFilter:['hidden','data-page']});
  const rulesPanel = doc.getElementById('battle-rules-panel');
  const ruleTabs = [...doc.querySelectorAll('#rule-tabs [role="tab"]')];
  let rulePage = rulesPanel?.getAttribute('aria-labelledby');
  // Host renderRuleSection updates this semantic attribute for both real
  // clicks and keyboard navigation; no synthetic clicks or input listeners.
  const rulesObserver = new win.MutationObserver(() => {
    const next = rulesPanel.getAttribute('aria-labelledby');
    if (next === rulePage) return;
    const before = ruleTabs.findIndex(tab => tab.id === rulePage);
    const after = ruleTabs.findIndex(tab => tab.id === next);
    rulePage = next;
    if (before < 0 || after < 0 || !visible(rulesPanel)) return;
    const direction = after > before ? 1 : -1;
    animate(rulesPanel,[{opacity:0,translate:`${direction * 30}px 0`},{opacity:1,translate:'0 0'}],{duration:220,easing:'ease-out'});
  });
  if (rulesPanel) rulesObserver.observe(rulesPanel,{attributes:true,attributeFilter:['aria-labelledby']});
  const tree = new win.MutationObserver(records => {
    for (const record of records) for (const node of record.addedNodes) if (node.nodeType === 1) decorate(node);
    for (const [node,entry] of dialogs) if (!node.isConnected) { entry.observer.disconnect(); dialogs.delete(node); }
    for (const node of animations.keys()) if (!visible(node)) cancel(node);
  });
  tree.observe(doc.body,{childList:true,subtree:true});
  function syncMotion() {
    doc.documentElement.classList.toggle('qibing-motion-paused',doc.hidden);
    if (!permitted()) for (const node of animations.keys()) cancel(node);
  }
  const leave = () => { for (const node of animations.keys()) cancel(node); doc.documentElement.classList.add('qibing-motion-paused'); };
  doc.addEventListener('visibilitychange',syncMotion);
  media.addEventListener('change',syncMotion);
  win.addEventListener('pagehide',leave);
  win.addEventListener('pageshow',syncMotion);
  syncMotion();
  const dispose = () => {
    disposed = true; leave(); tree.disconnect(); rootObserver.disconnect(); rulesObserver.disconnect();
    for (const {observer} of dialogs.values()) observer.disconnect();
    dialogs.clear();
    doc.removeEventListener('visibilitychange',syncMotion);
    media.removeEventListener('change',syncMotion);
    win.removeEventListener('pagehide',leave);
    win.removeEventListener('pageshow',syncMotion);
    doc.querySelectorAll('.qibing-command,.qibing-fight').forEach(node => node.classList.remove('qibing-command','qibing-fight'));
    doc.querySelectorAll('.qibing-modal-open').forEach(node => node.classList.remove('qibing-modal-open'));
    doc.documentElement.classList.remove('qibing-motion-paused');
    installations.delete(doc);
  };
  const api = {dispose,screenIn,screenOut};
  installations.set(doc,api);
  return api;
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',() => installQibingMotion(),{once:true});
  else installQibingMotion();
}
