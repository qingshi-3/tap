/** 招募卡面只放一句短概括（≤10 字，两行内），完整描述点开卡牌看；新增卡牌必须在这里补一条。 */
export const CARD_SUMMARY: Record<string, string> = {
  l_shield:'施法给队首格挡',l_martyr:'复生，阵亡给身后格挡',l_vigil:'开战自带格挡',l_priest:'施法治疗残血友军',l_knight:'复生并获得格挡',l_mender:'施法群体治疗',l_banner:'格挡被破时强化',l_archon:'开战全队复生',
  s_wind:'连击',s_backstab:'狙击队尾',s_dancer:'让主力立即出手',s_dart:'施法打敌方队尾',s_ninja:'连击，击杀再出手',s_hunter:'狙击，击杀成长',s_choreo:'开战给邻军连击',s_master:'每段普攻追打队尾',
  a_seed:'阵亡召唤暗影',a_devour:'施法打敌方队首',a_graveguard:'反击',a_reaper:'友军阵亡时打队首',a_cult:'法强，施法打队首',a_brood:'法强',a_ritualist:'施法打全体敌人',a_matriarch:'反击，友军施法后追打',
  m_egg:'阵亡孵化幼兽',m_shaman:'施法点燃敌方队首',m_hide:'受击时加攻',m_rex:'溅射',m_mender:'普攻附加灼烧',m_incubator:'开战强化邻军攻击',m_bloodcaller:'每拍加深灼烧',m_titan:'溅射并附加灼烧',
  v_guard:'受击时冻攻击者',v_wall:'护甲',v_scout:'打有寒意者增伤',v_mage:'施法冻下一个出手者',v_shard:'普攻附加寒意',v_conduit:'邻军护甲提升',v_keeper:'队首时护甲更高',v_queen:'冻结时寒意扩散',
  d_sentry:'开战自带格挡',d_dune:'阵亡召唤沙兵',d_artificer:'施法强化队首',d_keeper:'护卫，承伤给易伤',d_obelisk:'每拍给队首易伤',d_dunecaster:'施法给队首格挡',d_sandblade:'溅射',d_pharaoh:'开战强化全体',
  n_merc:'普攻后加攻',n_bulwark:'护甲',n_medic:'施法治疗队首',n_obelisk:'法强',n_breaker:'溅射',n_echo:'施法强化邻军',n_marshal:'开战强化队首',n_colossus:'溅射',
  l_warden:'护卫，破盾时回血',l_lion:'格挡越多普攻越痛',l_cliff:'护卫，承伤得格挡',l_sunriser:'定期给友军格挡',
  s_fox:'普攻附加易伤',s_monk:'打易伤目标时成长',s_caster:'施法打高攻并易伤',s_lord:'开战给主力狙击连击',
  a_spine:'复生，复活打队首',a_jugg:'反击，友军阵亡加强',a_engulf:'施法打残血敌人',a_solus:'友军施法后加法强',
  m_raptor:'连击，普攻附加灼烧',m_kujata:'开战给主力溅射',m_vindicator:'连击，溅射',m_mankator:'开战全队溅射',
  v_chaser:'施法给队首寒意',v_sentinel:'护甲，邻军施法冻敌',v_drake:'施法全体寒意',v_wyvern:'敌人冻结时出手',
  d_howler:'施法给队首易伤',d_glass:'易伤敌受伤时成长',d_pyro:'施法打高血并易伤',d_onyx:'强化易伤伤害',
  n_archer:'狙击',n_thorn:'反击',n_alchemist:'施法灼烧并寒意',n_paragon:'开战强化两名主力',
};
