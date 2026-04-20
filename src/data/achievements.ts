import type { Achievement } from '../types'

export const achievements: Achievement[] = [
  // ========== 可解锁成就（有代码触发） ==========
  {
    id: 'tree_planter',
    icon: '🌳',
    title: '树木种植者',
    description: '创建第一个索引',
  },
  {
    id: 'index_scan',
    icon: '🎯',
    title: '全表扫描终结者',
    description: '首次使用索引扫描',
  },
  {
    id: 'mvcc_viewer',
    icon: '🔬',
    title: 'MVCC 考古学家',
    description: '首次查看 MVCC 可视化',
  },

  // ========== 游戏进度 ==========
  {
    id: 'chapter_1_complete',
    icon: '📗',
    title: '初出茅庐',
    description: '完成第 1 章：城市档案馆',
  },
  {
    id: 'chapter_2_complete',
    icon: '📘',
    title: '联结神经',
    description: '完成第 2 章：人口普查',
  },
  {
    id: 'chapter_3_complete',
    icon: '📙',
    title: '分析大师',
    description: '完成第 3 章：腐败铁证',
  },
  {
    id: 'chapter_4_complete',
    icon: '🏗️',
    title: '城市设计师',
    description: '完成第 4 章：灾后重建',
  },
  {
    id: 'chapter_5_complete',
    icon: '🔥',
    title: '数据操控者',
    description: '完成第 5 章：数据修复',
  },
  {
    id: 'chapter_6_complete',
    icon: '⚡',
    title: '优化咒语',
    description: '完成第 6 章：透视之眼',
  },
  {
    id: 'chapter_7_complete',
    icon: '⏳',
    title: '时空管理者',
    description: '完成第 7 章：时间裂缝',
  },
  {
    id: 'chapter_8_complete',
    icon: '🛡️',
    title: '自动化大师',
    description: '完成第 8 章：自动化防线',
  },

  // ========== 极致挑战 ==========
  {
    id: 'three_stars',
    icon: '⭐',
    title: '三连星',
    description: '任意关卡获得 3 星',
  },
  {
    id: 'perfect_chapter',
    icon: '💎',
    title: '完美主义者',
    description: '一个章节所有关卡 3 星',
  },
  {
    id: 'no_hints',
    icon: '💪',
    title: '百折不挠',
    description: '不使用提示通关',
  },
  {
    id: 'pure_brain',
    icon: '🧠',
    title: '纯脑力模式',
    description: '连续 5 关不使用任何提示',
  },

  // ========== 等级成就 ==========
  {
    id: 'level_5',
    icon: '📈',
    title: '升级之路',
    description: '达到等级 5',
  },
  {
    id: 'level_10',
    icon: '🚀',
    title: '高速成长',
    description: '达到等级 10',
  },
  {
    id: 'level_20',
    icon: '👑',
    title: '数据王者',
    description: '达到等级 20',
  },

  // ========== 终极成就 ==========
  {
    id: 'all_complete',
    icon: '🏙️',
    title: '数据之城',
    description: '完成所有关卡',
  },
  {
    id: 'true_master',
    icon: '🏆',
    title: '真正的数据库大师',
    description: '完成所有关卡且全部 3 星',
  },
]
