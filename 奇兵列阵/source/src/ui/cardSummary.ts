/** 招募预览只列相关时机与机制，不解释关系；完整技能和数值由详情呈现。
 * 以「/」分隔独立词条；治疗、成长、强化、伤害、削弱、复活为没有正式机制名的朴素标签。
 * 新增招募卡须补齐此表，选词对应一星能力，不能把高星新增效果提前显示。
 */
export const CARD_SUMMARY: Record<string, string> = {
  l_shield:'轮换/成为队首时/格挡', l_martyr:'复生/亡语/格挡', l_vigil:'备战结束/永久成长',
  l_warden:'嘲讽/格挡/护甲', l_windblade:'轮换/成为队首时/强化', l_priest:'施法/治疗',
  l_knight:'复生/格挡', l_lion:'普攻/格挡', l_archer:'轮换/在队尾时/伤害',
  l_mender:'培养/永久成长', l_banner:'格挡/强化', l_cliff:'嘲讽/格挡',
  l_storm:'轮换/成为队首时/成长', l_archon:'开战/复生', l_sunriser:'开战/格挡/升星', l_caliber:'轮换/强化',

  s_wind:'升星/永久成长/连击', s_backstab:'决斗/击败对手/成长', s_dancer:'施法/追击',
  s_fox:'决斗/削弱', s_step:'轮换/连击', s_dart:'施法/狙击/限次',
  s_ninja:'升星/永久成长/连击', s_monk:'决斗/伤害', s_viper:'决斗/阵亡/追击',
  s_hunter:'狙击', s_choreo:'购买/永久成长/连击', s_caster:'施法/法强/削弱',
  s_xyle:'决斗/连击/击败对手', s_master:'连击/伤害', s_lord:'决斗/击败对手/追击', s_panda:'击败对手/强化',

  a_seed:'亡语/召唤/格挡', a_devour:'施法/伤害', a_graveguard:'嘲讽/亡语/复生',
  a_spine:'复生/亡语/伤害', a_imp:'出售/永久成长/亡语', a_reaper:'阵亡/伤害',
  a_cult:'出售/永久成长/亡语', a_brood:'备战结束/永久成长/亡语', a_chanter:'法强/蓄力',
  a_ritualist:'施法/复活', a_jugg:'阵亡/强化', a_engulf:'施法/击杀/召唤',
  a_nightmare:'嘲讽/亡语/召唤', a_matriarch:'亡语', a_solus:'备战结束/永久成长/施法', a_void:'献祭/成长',

  m_egg:'不行动/节拍/召唤', m_shaman:'施法/灼烧', m_hide:'受击/成长',
  m_raptor:'连击/灼烧', m_whelp:'溅射/灼烧', m_rex:'蓄力/溅射',
  m_mender:'护甲/受击/灼烧', m_kujata:'培养/永久成长', m_harvester:'灼烧/召唤',
  m_incubator:'召唤/强化', m_bloodcaller:'每次交锋/灼烧', m_vindicator:'连击/溅射',
  m_rager:'溅射/成长', m_titan:'蓄力/溅射/灼烧', m_mankator:'出售/永久成长/溅射', m_heart:'每次交锋/灼烧',

  v_guard:'受击/寒意', v_wall:'嘲讽/护甲', v_scout:'冻结/成长',
  v_chaser:'施法/寒意/法强', v_snowman:'蓄力/冻结', v_mage:'施法/寒意',
  v_shard:'普攻/寒意', v_sentinel:'护甲/施法/寒意', v_rhyno:'护甲/蓄力',
  v_conduit:'购买/永久成长/寒意', v_keeper:'护甲/冻结/格挡', v_drake:'冻结/伤害',
  v_bear:'嘲讽/反击/治疗', v_queen:'开战/冻结/寒意', v_wyvern:'冻结/成长/追击', v_stag:'蓄力/寒意/格挡',

  d_sentry:'嘲讽/开战/格挡', d_dune:'亡语', d_artificer:'友军阵亡/召唤/轮换',
  d_howler:'狙击/蓄力', d_goldob:'不行动/备战结束/永久成长', d_keeper:'嘲讽/召唤/格挡',
  d_obelisk:'不行动/节拍/格挡/升星', d_glass:'召唤/成长', d_shriek:'蓄力/伤害',
  d_dunecaster:'购买/永久成长/施法/嘲讽', d_sandblade:'蓄力/追击', d_pyro:'购买/永久法强',
  d_hourglass:'成为队首/治疗/格挡', d_pharaoh:'开战/强化/召唤', d_onyx:'蓄力/成长/追击', d_worm:'召唤/成长',

  n_merc:'购买/出售/永久成长', n_bulwark:'出售/永久成长', n_medic:'购买/永久成长/亡语/治疗', n_archer:'出售/永久成长/狙击',
  n_gladiator:'培养/永久成长/决斗', n_obelisk:'出售/永久成长/施法', n_breaker:'溅射/破甲', n_thorn:'反击',
  n_envoy:'施法/行动次数', n_tether:'施法/轮换', n_ritualist:'施法/献祭/强化', n_echo:'升星/永久成长',
  n_marshal:'开战/强化/行动次数', n_alchemist:'亡语/寒意', n_colossus:'溅射/嘲讽', n_paragon:'升星/永久成长',
};
