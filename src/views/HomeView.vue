<script setup lang="ts">
import { chapters } from '../data/chapters'
import { achievements as allAchievements } from '../data/achievements'
import { useGameStore } from '../stores/game'

const game = useGameStore()

function getCompletedCount(chapterId: string): number {
  return game.completedLevels.filter((p) => p.chapterId === chapterId && p.completed).length
}

function handleReset() {
  if (confirm('确定要重置所有进度吗？此操作不可撤销。')) {
    game.resetProgress()
  }
}
</script>

<template>
  <div class="home">
    <header class="home-header">
      <img src="/images/logo.png" alt="Neo-Postgres Logo" class="main-logo" />
      <h1>Neo-Postgres: Unit 73</h1>
      <p class="subtitle">通过真实 SQL 操作，探索数据库的内部世界</p>
      <div class="player-info">
        <span>Lv.{{ game.level }}</span>
        <div class="exp-bar">
          <div class="exp-fill" :style="{ width: game.expProgress + '%' }"></div>
        </div>
        <span>{{ game.exp }}/{{ game.expToNextLevel }} EXP</span>
      </div>
    </header>

    <section class="chapters">
      <h2>章节选择</h2>
      <div class="chapter-grid">
        <template v-for="ch in chapters" :key="ch.id">
          <router-link
            v-if="game.isChapterUnlocked(ch.id)"
            :to="`/level/${ch.id}/${game.getFirstUnlockedLevel(ch.id)}`"
            class="chapter-card"
          >
            <div class="chapter-icon">{{ ch.icon }}</div>
            <div class="chapter-info">
              <div class="chapter-title">{{ ch.title }}</div>
              <div class="chapter-desc">{{ ch.description }}</div>
              <div class="chapter-progress">
                {{ getCompletedCount(ch.id) }}/{{ ch.levels.length }} 关卡完成
              </div>
            </div>
          </router-link>
          <div v-else class="chapter-card locked">
            <div class="chapter-icon">{{ ch.icon }}</div>
            <div class="chapter-info">
              <div class="chapter-title">{{ ch.title }} 🔒</div>
              <div class="chapter-desc">完成上一章节解锁</div>
            </div>
          </div>
        </template>
      </div>
    </section>

    <section class="achievements">
      <h2>成就</h2>
      <div class="achievement-grid">
        <div
          v-for="a in allAchievements"
          :key="a.id"
          class="achievement-card"
          :class="{ unlocked: game.achievements.includes(a.id) }"
        >
          <div class="achievement-icon">{{ game.achievements.includes(a.id) ? a.icon : '❓' }}</div>
          <div class="achievement-info">
            <div class="achievement-title">{{ game.achievements.includes(a.id) ? a.title : '???' }}</div>
            <div class="achievement-desc">{{ game.achievements.includes(a.id) ? a.description : '未解锁' }}</div>
          </div>
        </div>
      </div>
    </section>

    <footer class="home-footer">
      <button class="reset-btn" @click="handleReset">重置进度</button>
    </footer>
  </div>
</template>

<style scoped>
.home {
  max-width: 800px;
  margin: 0 auto;
  padding: 40px 20px;
}

.home-header {
  text-align: center;
  margin-bottom: 48px;
}

.home-header h1 {
  font-size: 36px;
  margin: 0 0 8px;
  color: var(--text-h);
}

.main-logo {
  width: 140px;
  height: 140px;
  margin-bottom: 20px;
  border-radius: 20px;
  border: 2px solid var(--accent);
  box-shadow: 0 0 25px rgba(16, 185, 129, 0.3);
}

.subtitle {
  color: var(--text);
  font-size: 16px;
  margin-bottom: 24px;
}

.player-info {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  color: var(--text);
}

.exp-bar {
  width: 120px;
  height: 8px;
  background: var(--code-bg);
  border-radius: 4px;
  overflow: hidden;
}

.exp-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 4px;
  transition: width 0.3s;
}

.chapters h2 {
  font-size: 20px;
  color: var(--text-h);
  margin: 0 0 16px;
}

.chapter-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.chapter-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  text-decoration: none;
  color: inherit;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s ease, border-color 0.3s ease;
  position: relative;
  overflow: hidden;
}

.chapter-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(45deg, transparent, rgba(16, 185, 129, 0.05), transparent);
  transform: translateX(-100%);
  transition: transform 0.6s ease;
}

.chapter-card:hover {
  border-color: var(--accent);
  box-shadow: 0 0 20px rgba(16, 185, 129, 0.15), inset 0 0 10px rgba(16, 185, 129, 0.05);
  transform: translateY(-4px) scale(1.02);
}

.chapter-card:hover::before {
  transform: translateX(100%);
}

.chapter-card.locked {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

.chapter-icon {
  font-size: 36px;
}

.chapter-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-h);
}

.chapter-desc {
  font-size: 14px;
  color: var(--text);
  margin-top: 2px;
}

.chapter-progress {
  font-size: 12px;
  color: var(--accent);
  margin-top: 4px;
}

.achievements {
  margin-top: 48px;
}

.achievements h2 {
  font-size: 20px;
  color: var(--text-h);
  margin: 0 0 16px;
}

.achievement-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.achievement-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  opacity: 0.4;
  transition: opacity 0.2s;
}

.achievement-card.unlocked {
  opacity: 1;
  border-color: #f59e0b;
  background: rgba(245, 158, 11, 0.06);
}

.achievement-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.achievement-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-h);
}

.achievement-desc {
  font-size: 11px;
  color: var(--text);
  margin-top: 1px;
}

.home-footer {
  text-align: center;
  margin-top: 48px;
}

.reset-btn {
  background: none;
  border: none;
  color: var(--text);
  font-size: 12px;
  cursor: pointer;
  opacity: 0.4;
  transition: opacity 0.2s;
}

.reset-btn:hover {
  opacity: 0.8;
  color: #ef4444;
}
</style>
