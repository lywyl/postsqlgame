<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  isPlaying: boolean
  currentStep: number
  totalSteps: number
  speed: number
}>()

const emit = defineEmits<{
  (e: 'play'): void
  (e: 'pause'): void
  (e: 'stepForward'): void
  (e: 'stepBackward'): void
  (e: 'update:speed', val: number): void
  (e: 'skipToEnd'): void
}>()

const progressPercentage = computed(() => {
  if (props.totalSteps === 0) return 0
  return (props.currentStep / props.totalSteps) * 100
})
</script>

<template>
  <div class="animation-controls">
    <div class="controls-row">
      <button class="btn-icon" @click="emit('stepBackward')" :disabled="currentStep === 0" title="上一步">⏮</button>
      <button class="btn-icon play-btn" @click="isPlaying ? emit('pause') : emit('play')">
        {{ isPlaying ? '⏸' : '▶️' }}
      </button>
      <button class="btn-icon" @click="emit('stepForward')" :disabled="currentStep >= totalSteps" title="下一步">⏭</button>
      
      <div class="speed-control">
        <select :value="speed" @change="e => emit('update:speed', Number((e.target as HTMLSelectElement).value))">
          <option :value="0.5">0.5x</option>
          <option :value="1">1.0x</option>
          <option :value="2">2.0x</option>
          <option :value="5">5.0x</option>
          <option :value="10">10x</option>
        </select>
      </div>
      
      <button 
        class="btn-skip" 
        @click="emit('skipToEnd')" 
        :disabled="currentStep >= totalSteps"
        title="跳到结果（已理解原理时使用）"
      >
        ⏩ 跳到结果
      </button>
    </div>
    
    <div class="progress-container">
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: `${progressPercentage}%` }"></div>
      </div>
      <div class="step-text">{{ currentStep }} / {{ totalSteps }}步</div>
    </div>
  </div>
</template>

<style scoped>
.animation-controls {
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: var(--code-bg);
  padding: 12px;
  border-radius: 8px;
  border: 1px solid var(--border);
  margin-top: 16px;
}

.controls-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.btn-icon {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: background 0.2s;
  color: var(--text);
}

.btn-icon:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
}

.btn-icon:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.play-btn {
  font-size: 24px;
}

.speed-control select {
  background: var(--bg);
  color: var(--text);
  border: 1px solid var(--border);
  padding: 4px 8px;
  border-radius: 4px;
  outline: none;
  cursor: pointer;
}

.progress-container {
  display: flex;
  align-items: center;
  gap: 12px;
}

.progress-bar {
  flex: 1;
  height: 6px;
  background: var(--bg);
  border-radius: 3px;
  overflow: hidden;
  position: relative;
}

.progress-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: var(--accent);
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.step-text {
  font-size: 12px;
  color: var(--text-h);
  min-width: 60px;
  text-align: right;
}

.btn-skip {
  background: rgba(234, 179, 8, 0.2);
  color: #eab308;
  border: 1px solid rgba(234, 179, 8, 0.4);
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  margin-left: 8px;
}

.btn-skip:hover:not(:disabled) {
  background: rgba(234, 179, 8, 0.3);
  border-color: rgba(234, 179, 8, 0.6);
}

.btn-skip:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
</style>
