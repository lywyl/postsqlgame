<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { Level } from '../types'

const props = defineProps<{
  level: Level
  currentTaskIndex: number
  hintsUsed: number
  taskCompleted: boolean[]
  showSuccessStory: boolean
}>()

const emit = defineEmits<{
  hint: [index: number]
  continue: []
}>()

const showHints = ref(false)
const revealedHints = ref<number[]>([])

const currentTask = computed(() => props.level.tasks[props.currentTaskIndex])

function revealHint(index: number) {
  if (!revealedHints.value.includes(index)) {
    revealedHints.value.push(index)
    emit('hint', index)
  }
}

watch(() => props.currentTaskIndex, () => {
  showHints.value = false
  revealedHints.value = []
})

const talker = computed(() => {
  const desc = props.level.description || ''
  if (desc.startsWith('Alice:')) return 'ALICE'
  if (desc.startsWith('ZERO:')) return 'ZERO'
  return 'SYSTEM'
})

const storyContent = computed(() => {
  const desc = props.level.description || ''
  return desc.replace(/^(Alice:|ZERO:|System\.Out:)\s*"?/i, '').replace(/"$/, '').trim()
})

const successTalker = computed(() => {
  const story = currentTask.value?.successStory || ''
  if (story.startsWith('Alice:') || story.startsWith('Alice ')) return 'ALICE'
  if (story.startsWith('ZERO:')) return 'ZERO'
  return 'SYSTEM'
})

const successContent = computed(() => {
  const story = currentTask.value?.successStory || '指令执行完毕。'
  return story.replace(/^(Alice:|ZERO:|Alice \(后台广播\):)\s*"?/i, '').replace(/"$/, '').trim()
})

const displayedStoryContent = ref('')
const displayedSuccessContent = ref('')
let storyTimer: number | null = null
let successTimer: number | null = null

function runTypewriter(source: string, isSuccess: boolean) {
  const targetRef = isSuccess ? displayedSuccessContent : displayedStoryContent
  targetRef.value = ''
  let i = 0
  const speed = 25 // ms per character
  
  if (isSuccess && successTimer) clearInterval(successTimer)
  if (!isSuccess && storyTimer) clearInterval(storyTimer)
  
  const timer = setInterval(() => {
    if (i < source.length) {
      targetRef.value += source.charAt(i)
      i++
    } else {
      clearInterval(timer)
    }
  }, speed) as unknown as number
  
  if (isSuccess) successTimer = timer
  else storyTimer = timer
}

watch(storyContent, (newVal) => {
  runTypewriter(newVal, false)
}, { immediate: true })

watch(() => props.showSuccessStory, (newVal) => {
  if (newVal) {
    runTypewriter(successContent.value, true)
  } else {
    displayedSuccessContent.value = ''
  }
})
</script>

<template>
  <div class="task-panel">
    <h2 class="task-title"><span class="mission-icon">❖</span> {{ level.title }}</h2>

    <div class="dialogue-container">
      <div class="avatar-box">
        <img v-if="talker === 'ALICE'" src="/images/alice.png" class="avatar-img" alt="Alice" />
        <img v-else-if="talker === 'ZERO'" src="/images/zero.png" class="avatar-img" alt="ZERO" />
        <div v-else class="avatar-placeholder">SYS</div>
      </div>
      <div class="story-text">
        <div class="talker-name" :class="talker.toLowerCase()">{{ talker }}</div>
        <div class="story-content">
          {{ displayedStoryContent }}<span class="typewriter-cursor">_</span>
        </div>
      </div>
    </div>

    <!-- 任务进度条 -->
    <div class="task-progress">
      <div
        v-for="(_, i) in level.tasks"
        :key="i"
        class="task-dot"
        :class="{
          completed: taskCompleted[i],
          current: i === currentTaskIndex && !taskCompleted[i],
          locked: i > currentTaskIndex && !taskCompleted[i],
        }"
      >
        <span v-if="taskCompleted[i]" class="dot-check">✓</span>
        <span v-else class="dot-num">{{ i + 1 }}</span>
      </div>
      <span class="task-counter">任务 {{ currentTaskIndex + 1 }} / {{ level.tasks.length }}</span>
    </div>

    <Transition name="fade" mode="out-in">
      <div class="task-goal" v-if="!showSuccessStory">
        <div class="goal-label">CURRENT_OBJECTIVE //</div>
        <div class="goal-text">{{ currentTask.prompt }}</div>
      </div>

      <div class="success-story glow-box" v-else>
        <div class="goal-label decode-label">DECODE_SUCCESS // SIGNAL_INTERCEPTED</div>
        
        <div class="dialogue-container success-dialogue">
          <div class="avatar-box">
            <img v-if="successTalker === 'ALICE'" src="/images/alice.png" class="avatar-img" alt="Alice" />
            <img v-else-if="successTalker === 'ZERO'" src="/images/zero.png" class="avatar-img" alt="ZERO" />
            <div v-else class="avatar-placeholder">SYS</div>
          </div>
          <div class="story-text success-text">
            <div class="talker-name" :class="successTalker.toLowerCase()">{{ successTalker }}</div>
            <div class="story-content">
              {{ displayedSuccessContent }}<span class="typewriter-cursor">_</span>
            </div>
          </div>
        </div>
        <button class="neon-btn continue-btn" @click="emit('continue')">
          > 确认接驳，进入下一节点
        </button>
      </div>
    </Transition>

    <div class="hint-section" v-if="!showSuccessStory">
      <button class="btn-hint" @click="showHints = !showHints">
        💡 {{ showHints ? '隐藏提示' : '查看提示' }}
        <span v-if="hintsUsed > 0"> (已用 {{ hintsUsed }} 个)</span>
      </button>

      <div v-if="showHints" class="hints-list">
        <div
          v-for="(hint, i) in currentTask.hints"
          :key="i"
          class="hint-item"
        >
          <template v-if="revealedHints.includes(i)">
            <span class="hint-level">提示 {{ i + 1 }}</span>
            {{ hint }}
          </template>
          <button v-else class="btn-reveal" @click="revealHint(i)">
            揭示提示 {{ i + 1 }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.task-panel {
  padding: 20px;
}

.task-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--accent);
  margin: 0 0 16px;
  text-transform: uppercase;
  letter-spacing: 1px;
  text-shadow: 0 0 10px rgba(16, 185, 129, 0.3);
}

.mission-icon {
  margin-right: 6px;
  font-size: 16px;
  vertical-align: middle;
}

.dialogue-container {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
}

.avatar-box {
  flex-shrink: 0;
  width: 50px;
  height: 50px;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid var(--border);
  background: var(--code-bg);
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--mono);
  font-size: 14px;
  color: var(--accent);
  font-weight: bold;
}

.talker-name {
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 700;
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 1px;
}
.talker-name.alice { color: #3b82f6; text-shadow: 0 0 5px rgba(59, 130, 246, 0.5); }
.talker-name.zero { color: #8b5cf6; text-shadow: 0 0 5px rgba(139, 92, 246, 0.5); }
.talker-name.system { color: var(--accent); }

.story-text {
  flex: 1;
  font-family: var(--mono);
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-h);
  padding: 10px 12px;
  background: rgba(15, 23, 42, 0.5);
  border-radius: 4px;
  border-left: 2px solid var(--accent-cyan);
}

.story-content {
  display: inline;
}

.typewriter-cursor {
  color: var(--accent-cyan);
  animation: blink 1s step-end infinite;
}

@keyframes blink { 50% { opacity: 0; } }

.task-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.task-dot {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  font-family: var(--mono);
  border: 2px solid var(--border);
  color: var(--text);
  transition: all 0.3s;
}

.task-dot.completed {
  background: var(--accent);
  border-color: var(--accent);
  color: #000;
  box-shadow: 0 0 8px rgba(16, 185, 129, 0.4);
}

.task-dot.current {
  border-color: var(--accent-cyan);
  color: var(--accent-cyan);
  animation: pulse 1.5s ease-in-out infinite;
}

.task-dot.locked {
  opacity: 0.3;
}

@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(6, 182, 212, 0.4); }
  50% { box-shadow: 0 0 0 6px rgba(6, 182, 212, 0); }
}

.dot-check, .dot-num {
  line-height: 1;
}

.task-counter {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--text);
  opacity: 0.6;
  letter-spacing: 1px;
  margin-left: 4px;
}

.task-goal {
  margin-bottom: 24px;
}

.goal-label {
  font-family: var(--mono);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 2px;
  color: var(--accent-cyan);
  font-weight: 600;
  margin-bottom: 8px;
}

.goal-text {
  font-size: 15px;
  color: #fff;
  font-weight: 500;
}

.hint-section {
  margin-top: 12px;
}

.btn-hint {
  background: transparent;
  color: var(--accent-purple);
  border: 1px solid var(--accent-purple);
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  font-family: var(--mono);
  text-transform: uppercase;
  transition: all 0.2s;
}

.btn-hint:hover {
  background: var(--accent-purple);
  color: #000;
  box-shadow: 0 0 10px rgba(139, 92, 246, 0.5);
}

.hints-list {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.hint-item {
  padding: 10px 12px;
  background: rgba(139, 92, 246, 0.1);
  border-radius: 4px;
  font-size: 13px;
  font-family: var(--mono);
  border-left: 2px solid var(--accent-purple);
}

.hint-level {
  font-weight: 600;
  color: var(--accent-purple);
  margin-right: 6px;
}

.btn-reveal {
  background: none;
  border: 1px dashed rgba(139, 92, 246, 0.4);
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  color: var(--text);
  font-size: 12px;
  width: 100%;
  text-align: left;
  font-family: var(--mono);
}

.btn-reveal:hover {
  border-color: var(--accent-purple);
  color: var(--accent-purple);
}

.success-story {
  margin-top: 16px;
  animation: fadeIn 0.5s ease-out;
}

.glow-box {
  padding: 16px;
  background: rgba(16, 185, 129, 0.05);
  border: 1px solid var(--accent);
  box-shadow: 0 0 15px rgba(16, 185, 129, 0.15);
  border-radius: 4px;
}

.decode-label {
  color: var(--accent) !important;
  text-shadow: 0 0 5px var(--accent);
  margin-bottom: 12px;
}

.success-dialogue {
  margin-bottom: 20px;
}

.success-text {
  border-left-color: var(--accent) !important;
  color: #fff !important;
  background: rgba(16, 185, 129, 0.1) !important;
  margin-bottom: 0px !important;
}

.continue-btn {
  width: 100%;
  text-align: center;
  box-sizing: border-box;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
