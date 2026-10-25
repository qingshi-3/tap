// 独立开发页，通过可见按钮选择验证阵容；不进入正式构建入口。
import '../src/main';
import { newRun, type Owned } from '../src/core/run';
import type { App } from '../src/ui/app';

const toolbar = document.createElement('nav');
toolbar.setAttribute('aria-label', '本地验证用例');
toolbar.style.cssText = 'position:fixed;left:8px;top:4px;z-index:999;display:flex;gap:4px;font:12px sans-serif';
const make = (def: string, oid: number, copies = 3, bonus = 8): Owned => ({ def, oid, copies, atkBonus: bonus, hpBonus: bonus });
for (const [key, label] of [['stats', '统计阵容'], ['supply', '补给与成长'], ['morph', '变形预览'], ['loss', '失败战报']] as const) {
  const button = document.createElement('button'); button.textContent = label;
  button.style.cssText = 'padding:6px 10px;color:#fff;background:#25344c;border:1px solid #8d9cb2';
  button.onclick = () => {
    const r = newRun(890123); r.turn = 12; r.wins = 9; r.nextId = 200; r.relics = ['r_share', 'r_volley'];
    r.branch = null; r.event = null; r.pendingFx = []; r.relicPick = null; r.chest = null;
    r.queue = [make('l_warden', 101), make('a_imp', 102, 3, 0), make('l_storm', 103), make('m_heart', 104), make('a_matriarch', 105)];
    r.queue[0]!.ench = 'p_inferno'; r.queue[0]!.tfx = ['thunder'];
    r.enemy = { boss: 'forge', units: [
      { def: 'l_vigil', lvl: 2, atk: 16, hp: 38, ench: 'iron' }, { def: 'l_warden', lvl: 2, atk: 12, hp: 35 },
      { def: 'a_imp', lvl: 2, atk: 10, hp: 28 }, { def: 'l_storm', lvl: 2, atk: 12, hp: 26 }, { def: 'a_matriarch', lvl: 2, atk: 10, hp: 24 },
    ] };
    if (key === 'supply' || key === 'morph') {
      r.queue = [make('v_guard', 101), make('v_keeper', 102), make('v_mage', 103), make('d_hourglass', 104), make('d_pharaoh', 105)];
      r.queue[0]!.foodHistory = [{ id: 'f_roast', atk: 5, hp: 5, sourceId: 190 }];
      r.queue[1]!.foodHistory = [{ id: 'f_bread', atk: 1, hp: 1, sourceId: 191 }];
      if (key === 'morph') r.event = 'morph';
    }
    if (key === 'loss') r.queue = [make('d_artificer', 101, 1, 0), null, null, null, null];
    r.shop = [
      { sid: 201, kind: 'unit', def: r.queue[0]!.def, locked: false, free: false },
      { sid: 202, kind: 'unit', def: 'd_hourglass', locked: false, free: false },
      { sid: 203, kind: 'unit', def: 'n_tether', locked: false, free: false },
      { sid: 204, kind: 'food', def: 'f_dragon', locked: false, free: false },
      { sid: 205, kind: 'food', def: 'f_bread', locked: false, free: false },
    ]; r.nextId = 206;
    (window as unknown as { __app: App }).__app.startRun(r);
  };
  toolbar.append(button);
}
const hideTools = document.createElement('button');
hideTools.textContent = '隐藏验证工具';
hideTools.style.cssText = 'padding:6px 10px;color:#fff;background:#25344c;border:1px solid #8d9cb2';
hideTools.onclick = () => toolbar.remove();
toolbar.append(hideTools);
document.body.append(toolbar);
