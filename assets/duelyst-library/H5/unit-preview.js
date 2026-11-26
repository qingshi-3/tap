(() => {
  const lib = DuelystLibrary;
  const el = id => document.getElementById(id);
  const unit = lib.get('unit', new URLSearchParams(location.search).get('id'));
  if (!unit) {
    el('asset-id').textContent = '找不到该单位。可以从阅览台的单位卡片打开演出。';
    return;
  }

  const label = {
    UnitAttackedFX:'普攻',
    UnitPrimaryAttackedFX:'普攻附加',
    SpellCastFX:'施法',
    SpellAppliedFX:'生效格'
  };
  const eventKey = row => JSON.stringify([row.type, row.id, row.card, row.event]);
  const coverage = CompositeCoverage;
  const rowsByKey = new Map(DuelystOriginalEvents.map(row => [eventKey(row), row]));
  const ownEvents = coverage.filter(row => row.type === 'unit' && row.id === unit.id);
  const spellEvents = coverage.filter(row => row.type === 'icon');
  const player = el('player');
  const status = el('status');
  let currentButton;
  let firstChoice;

  function make(tag, text, className) {
    const element = document.createElement(tag);
    if (text) element.textContent = text;
    if (className) element.className = className;
    return element;
  }

  function originalSample(row) {
    return lib.original.find(sample => sample.event === row.event && sample.fxKey === row.fxKey &&
      sample.assets.some(asset => asset.type === row.type && asset.id === row.id));
  }

  function fxLinks(row) {
    const reference = rowsByKey.get(eventKey(row));
    const assets = reference?.layers || originalSample(row)?.assets.filter(asset => asset.type === 'fx') || [];
    const ids = [...new Set(assets.map(asset => asset.id))];
    el('effects').hidden = !ids.length;
    el('effect-links').replaceChildren(...ids.map(id => {
      const link = make('a', lib.get('fx', id)?.name || id);
      link.href = 'index.html?' + new URLSearchParams({assetType:'fx', assetId:id});
      link.target = '_blank';
      link.rel = 'noopener';
      return link;
    }));
  }

  function play(row, owner, button) {
    currentButton?.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-pressed', 'true');
    currentButton = button;
    const {type, id, card, event} = row;
    const query = new URLSearchParams({type, id, card, event, embed:'unit'});
    if (owner) {
      query.set('owner', owner.id);
      query.set('ownerCard', owner.card);
    }
    status.hidden = true;
    player.hidden = false;
    player.title = button.textContent.trim() + ' · 原作合成预览';
    player.src = '合成预览.html?' + query;
    fxLinks(row);
  }

  function addChoice(parent, row, title, owner, icon) {
    const button = make('button');
    button.type = 'button';
    button.setAttribute('aria-pressed', 'false');
    addIcon(button, icon);
    const text = make('span', title);
    text.append(make('small', row.status === 'partial' ? '部分合成' : '完整合成'));
    button.append(text);
    button.onclick = () => play(row, owner, button);
    parent.append(button);
    firstChoice ||= button;
  }

  function addIcon(parent, icon) {
    if (!icon?.preview) return;
    const thumb = make('img');
    thumb.alt = '';
    thumb.src = lib.assetURL('icon',icon.preview);
    parent.append(thumb);
  }

  function cardSection(title) {
    const section = make('section', '', 'section');
    const choices = make('div', '', 'choices');
    section.append(make('h2',title), choices);
    el('events').append(section);
    return choices;
  }

  el('title').textContent = unit.name;
  document.title = unit.name + ' · 单位演出';
  el('asset-id').textContent = unit.id === unit.name ? '' : unit.id;
  el('comparison').hidden = unit.id !== 'boss_skyfalltyrant';
  el('content').hidden = false;
  const idle = unit.actions.idle || !unit.actions.loop ? 'idle' : 'loop';
  const motions = [[idle, idle === 'idle' ? '待机 · Idle' : '原作循环 · Loop'], ['attack','攻击 · Attack']];
  const previews = [];
  for (const [action,title] of motions) {
    const tile = make('figure');
    const preview = lib.createPreview('unit',unit.id,action,1);
    if (preview) previews.push(preview);
    tile.append(preview?.element || make('small','暂无动作素材'), make('figcaption',title));
    el('motions').append(tile);
  }
  addEventListener('pagehide', event => {
    if (!event.persisted) previews.forEach(preview => preview.dispose());
  });
  addEventListener('message', event => {
    const height = event.data?.duelystUnitPlayerHeight;
    if (event.source === player.contentWindow && Number.isInteger(height) && height > 0 && height < 5000) {
      player.style.height = height + 'px';
    }
  });

  const directAttacks = ownEvents.filter(row => row.event === 'UnitAttackedFX' || row.event === 'UnitPrimaryAttackedFX');
  const cardRefs = new Map((unit.cardRefs || []).map(ref => [ref.card, ref]));
  const groups = new Map();
  for (const row of directAttacks) {
    if (!groups.has(row.card)) groups.set(row.card, {attacks:[], spells:[]});
    groups.get(row.card).attacks.push(row);
  }
  for (const [spell,owners] of Object.entries(CompositeCasters)) {
    for (const owner of owners.filter(candidate => candidate.id === unit.id)) {
      if (!groups.has(owner.card)) groups.set(owner.card, {attacks:[], spells:[]});
      groups.get(owner.card).spells.push({spell, owner});
    }
  }
  for (const [card,group] of groups) {
    const cardName = cardRefs.get(card)?.names?.en;
    const choices = cardSection(cardName && cardName !== unit.name ? cardName + ' · ' + card : card);
    for (const row of group.attacks) addChoice(choices,row,label[row.event] || row.event);
    for (const {spell,owner} of group.spells) {
      const rows = spellEvents.filter(row => row.card === spell);
      if (!rows.length) {
        const icon = lib.list('icon').find(asset => asset.note?.includes('工厂分支：' + spell + '（'));
        const unavailable = make('div','','skill');
        addIcon(unavailable,icon);
        unavailable.append(make('small',(icon?.name || spell) + ' · 暂无合成预览'));
        choices.append(unavailable);
      }
      for (const row of rows) {
        const icon = lib.get('icon',row.id);
        const name = spell === 'Cards.BossSpell.LaceratingFrost' ? '撕裂寒霜' : icon?.name || spell;
        addChoice(choices,row,name + ' · ' + label[row.event],owner,icon);
      }
    }
  }
  const unitSkills = ownEvents.filter(row => !directAttacks.includes(row));
  if (unitSkills.length) {
    const choices = cardSection('单位技能');
    for (const row of unitSkills) {
      const title = originalSample(row)?.title;
      addChoice(choices,row,title || row.card + ' · ' + label[row.event]);
    }
  }
  if (firstChoice) firstChoice.click();
  else status.textContent = '暂无已核实的普攻或技能合成预览。';
})();
