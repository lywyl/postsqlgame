import { defineStore } from 'pinia'
import type { GameProgress, LevelProgress } from '../types'
import { chapters } from '../data/chapters'
import { achievements } from '../data/achievements'

const STORAGE_KEY = 'pg-quest-progress'
const CURRENT_PROGRESS_VERSION = 2 // 章节合并后的新版本号

// 成就解锁回调（由 UI 层注册，用于 toast 通知）
type AchievementCallback = (achievement: { id: string; icon: string; title: string }) => void
let onAchievementUnlocked: AchievementCallback | null = null
export function setAchievementCallback(cb: AchievementCallback) {
  onAchievementUnlocked = cb
}

function loadProgress(): GameProgress {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw) {
    try {
      const parsed = JSON.parse(raw)
      // 版本检测：如果版本号不匹配，清空旧存档防止崩溃
      if (parsed.progressVersion !== CURRENT_PROGRESS_VERSION) {
        console.log(`[游戏] 检测到旧版本存档 (${parsed.progressVersion ?? 1} -> ${CURRENT_PROGRESS_VERSION})，自动重置进度`)
        localStorage.removeItem(STORAGE_KEY)
        return { exp: 0, level: 1, completedLevels: [], achievements: [], progressVersion: CURRENT_PROGRESS_VERSION }
      }
      parsed.achievements ??= []
      return parsed
    } catch {
      // JSON 解析失败，清空损坏的存档
      console.log('[游戏] 存档数据损坏，自动重置进度')
      localStorage.removeItem(STORAGE_KEY)
    }
  }
  return { exp: 0, level: 1, completedLevels: [], achievements: [], progressVersion: CURRENT_PROGRESS_VERSION }
}

function saveProgress(progress: GameProgress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
}

export const useGameStore = defineStore('game', {
  state: () => ({
    ...loadProgress(),
    progressVersion: CURRENT_PROGRESS_VERSION,
  }),

  getters: {
    expToNextLevel(state): number {
      return state.level * 100
    },
    expProgress(state): number {
      const needed = this.expToNextLevel
      return Math.round((state.exp / needed) * 100)
    },

    isLevelUnlocked: (state) => (chapterId: string, levelId: string): boolean => {
      const ch = chapters.find((c) => c.id === chapterId)
      if (!ch) return false
      const idx = ch.levels.findIndex((l) => l.id === levelId)
      if (idx <= 0) return true // 第一关始终解锁
      const prevLevel = ch.levels[idx - 1]
      return state.completedLevels.some(
        (p) => p.chapterId === chapterId && p.levelId === prevLevel.id && p.completed
      )
    },

    getFirstUnlockedLevel: (state) => (chapterId: string): string | null => {
      const ch = chapters.find((c) => c.id === chapterId)
      if (!ch) return null
      for (const lvl of ch.levels) {
        const idx = ch.levels.indexOf(lvl)
        // 检查当前关卡是否已完成
        const isCompleted = state.completedLevels.some(
          (p) => p.chapterId === chapterId && p.levelId === lvl.id && p.completed
        )
        if (isCompleted) continue // 跳过已完成的关卡
        // 第一关或前一关已完成 → 这就是要找的关卡
        if (idx === 0) return lvl.id
        const prevLevel = ch.levels[idx - 1]
        const prevDone = state.completedLevels.some(
          (p) => p.chapterId === chapterId && p.levelId === prevLevel.id && p.completed
        )
        if (prevDone) return lvl.id
      }
      // 所有关卡都已完成 → 返回最后一关供重玩
      return ch.levels[ch.levels.length - 1].id
    },

    isChapterUnlocked: (state) => (chapterId: string): boolean => {
      const chIdx = chapters.findIndex((c) => c.id === chapterId)
      if (chIdx <= 0) return true // 第一章始终解锁
      const prevCh = chapters[chIdx - 1]
      return prevCh.levels.every((lvl) =>
        state.completedLevels.some(
          (p) => p.chapterId === prevCh.id && p.levelId === lvl.id && p.completed
        )
      )
    },
  },

  actions: {
    completeLevel(chapterId: string, levelId: string, stars: number, hintsUsed: number) {
      const existing = this.completedLevels.find(
        (p) => p.chapterId === chapterId && p.levelId === levelId
      )

      if (existing) {
        if (stars > existing.stars) {
          // 星级提升：只补星级差额对应的经验
          const bonus = (stars - existing.stars) * 25
          existing.stars = stars
          existing.hintsUsed = hintsUsed
          this.exp += bonus
        }
        // 星级未提升则不给经验，防止刷取
      } else {
        const progress: LevelProgress = {
          chapterId,
          levelId,
          completed: true,
          stars,
          hintsUsed,
        }
        this.completedLevels.push(progress)

        // 首次通关：基础 50 + 星级奖励
        const expGain = 50 + stars * 25 - hintsUsed * 10
        this.exp += Math.max(expGain, 10)
      }

      // 升级检查
      while (this.exp >= this.expToNextLevel) {
        this.exp -= this.expToNextLevel
        this.level++
      }

      // 成就检查
      this.checkAndUnlockAchievements(chapterId, levelId, stars, hintsUsed)

      saveProgress(this.$state)
    },

    isLevelCompleted(chapterId: string, levelId: string): boolean {
      return this.completedLevels.some(
        (p) => p.chapterId === chapterId && p.levelId === levelId && p.completed
      )
    },

    getLevelStars(chapterId: string, levelId: string): number {
      const p = this.completedLevels.find(
        (lp) => lp.chapterId === chapterId && lp.levelId === levelId
      )
      return p?.stars ?? 0
    },

    resetProgress() {
      this.exp = 0
      this.level = 1
      this.completedLevels = []
      this.achievements = []
      this.progressVersion = CURRENT_PROGRESS_VERSION
      saveProgress(this.$state)
    },

    unlockAchievement(id: string) {
      if (this.achievements.includes(id)) return
      this.achievements.push(id)
      saveProgress(this.$state)
      const def = achievements.find((a) => a.id === id)
      if (def && onAchievementUnlocked) {
        onAchievementUnlocked({ id: def.id, icon: def.icon, title: def.title })
      }
    },

    checkAndUnlockAchievements(chapterId: string, _levelId: string, stars: number, hintsUsed: number) {
      // 三连星
      if (stars === 3) this.unlockAchievement('three_stars')

      // 百折不挠
      if (hintsUsed === 0) this.unlockAchievement('no_hints')

      // 纯脑力模式：连续5关不使用提示（简化检测：累计5关不使用提示）
      if (hintsUsed === 0) {
        const recentNoHints = this.completedLevels.slice(-5).filter(p => p.hintsUsed === 0).length
        if (recentNoHints >= 5) this.unlockAchievement('pure_brain')
      }

      // 升级之路
      if (this.level >= 5) this.unlockAchievement('level_5')
      if (this.level >= 10) this.unlockAchievement('level_10')
      if (this.level >= 20) this.unlockAchievement('level_20')

      // 完美主义者：检查当前章节是否全 3 星
      const ch = chapters.find((c) => c.id === chapterId)
      if (ch) {
        const allThreeStars = ch.levels.every((lvl) => {
          const p = this.completedLevels.find(
            (p) => p.chapterId === chapterId && p.levelId === lvl.id
          )
          return p && p.stars === 3
        })
        if (allThreeStars) this.unlockAchievement('perfect_chapter')

        // 章节完成成就
        const chapterComplete = ch.levels.every((lvl) =>
          this.completedLevels.some(p => p.chapterId === chapterId && p.levelId === lvl.id && p.completed)
        )
        if (chapterComplete) {
          this.unlockAchievement(`chapter_${chapterId.replace('ch', '')}_complete`)
        }
      }

      // 数据之城：所有关卡完成
      const totalLevels = chapters.reduce((sum, c) => sum + c.levels.length, 0)
      if (this.completedLevels.length >= totalLevels) {
        this.unlockAchievement('all_complete')

        // 真正的数据库大师：所有关卡都3星
        const allThreeStarsGlobal = chapters.every(c =>
          c.levels.every(lvl =>
            this.completedLevels.some(p =>
              p.chapterId === c.id && p.levelId === lvl.id && p.stars === 3
            )
          )
        )
        if (allThreeStarsGlobal) this.unlockAchievement('true_master')
      }
    },
  },
})
