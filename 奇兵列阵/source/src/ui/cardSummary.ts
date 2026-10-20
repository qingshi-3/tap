/** 招募预览只列相关时机与机制，不解释关系；完整技能和数值由详情呈现。
 * 以「/」分隔独立词条；治疗、成长、强化、伤害为没有正式机制名的朴素标签。
 * 新增招募卡须补齐此表，选词对应一星能力，不能把高星新增效果提前显示。
 */
export const CARD_SUMMARY: Record<string, string> = {
  l_shield:'施法/格挡', l_martyr:'阵亡/格挡/复生', l_vigil:'开战/格挡',
  l_warden:'护卫/格挡/护甲', l_priest:'施法/治疗', l_knight:'复生/格挡',
  l_lion:'普攻/格挡', l_mender:'施法/治疗', l_banner:'格挡/强化',
  l_cliff:'护卫/格挡', l_archon:'开战/复生', l_sunriser:'开战/周期/格挡',

  s_wind:'连击', s_backstab:'狙击', s_dancer:'施法/立即攻击',
  s_fox:'普攻/易伤', s_dart:'施法/伤害', s_ninja:'连击/击杀/立即攻击',
  s_monk:'易伤/成长', s_hunter:'狙击/击杀/成长', s_choreo:'开战/连击',
  s_caster:'施法/易伤/法强', s_master:'普攻/连击/伤害', s_lord:'开战/狙击/连击',

  a_seed:'阵亡/召唤', a_devour:'施法/伤害', a_graveguard:'反击',
  a_spine:'复生/伤害', a_reaper:'阵亡/伤害', a_cult:'施法/法强',
  a_brood:'法强', a_ritualist:'施法/伤害', a_jugg:'阵亡/反击',
  a_engulf:'施法/击杀/法强', a_matriarch:'施法/反击', a_solus:'施法/法强',

  m_egg:'阵亡/召唤', m_shaman:'施法/灼烧', m_hide:'受击/成长',
  m_raptor:'连击/灼烧', m_rex:'溅射', m_mender:'普攻/灼烧',
  m_kujata:'开战/溅射', m_incubator:'开战/强化', m_bloodcaller:'每拍/灼烧',
  m_vindicator:'连击/溅射', m_titan:'溅射/灼烧', m_mankator:'开战/溅射',

  v_guard:'受击/寒意', v_wall:'护甲', v_scout:'普攻/寒意',
  v_chaser:'施法/寒意/法强', v_mage:'施法/寒意', v_shard:'普攻/寒意',
  v_sentinel:'施法/护甲/寒意', v_conduit:'护甲', v_keeper:'护甲',
  v_drake:'施法/寒意/法强', v_queen:'开战/冻结/寒意', v_wyvern:'冻结/成长/立即攻击',

  d_sentry:'开战/格挡/护卫', d_dune:'阵亡/召唤', d_artificer:'施法/强化',
  d_howler:'施法/易伤', d_keeper:'护卫/易伤', d_obelisk:'每拍/易伤',
  d_glass:'易伤/成长', d_dunecaster:'施法/格挡', d_sandblade:'溅射/易伤',
  d_pyro:'施法/易伤/法强', d_pharaoh:'开战/护卫/格挡', d_onyx:'普攻/易伤',

  n_envoy:'施法/行动', n_ritualist:'施法/献祭/强化',
  n_merc:'普攻/成长', n_bulwark:'护甲', n_medic:'施法/治疗',
  n_archer:'狙击', n_obelisk:'法强', n_breaker:'溅射',
  n_thorn:'反击', n_echo:'施法/强化', n_marshal:'开战/强化/行动',
  n_alchemist:'施法/灼烧/寒意', n_colossus:'溅射', n_paragon:'开战/强化',
};
