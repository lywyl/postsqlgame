<script setup lang="ts">
import { ref } from 'vue'

interface ToastItem {
  id: number
  icon: string
  title: string
}

const toasts = ref<ToastItem[]>([])
let nextId = 0

function show(icon: string, title: string) {
  const id = nextId++
  toasts.value.push({ id, icon, title })
  setTimeout(() => {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }, 3000)
}

defineExpose({ show })
</script>

<template>
  <div class="toast-container">
    <TransitionGroup name="toast">
      <div v-for="t in toasts" :key="t.id" class="toast-item">
        <span class="toast-icon">{{ t.icon }}</span>
        <div class="toast-text">
          <div class="toast-label">成就解锁！</div>
          <div class="toast-title">{{ t.title }}</div>
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-container {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.toast-item {
  display: flex;
  align-items: center;
  gap: 12px;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.9), rgba(6, 182, 212, 0.9));
  color: #fff;
  padding: 12px 20px;
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(16, 185, 129, 0.3), 0 0 20px rgba(6, 182, 212, 0.2);
  min-width: 220px;
  border: 1px solid rgba(16, 185, 129, 0.5);
  backdrop-filter: blur(8px);
}

.toast-icon {
  font-size: 28px;
}

.toast-label {
  font-size: 11px;
  opacity: 0.85;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.toast-title {
  font-size: 15px;
  font-weight: 600;
}

.toast-enter-active {
  transition: all 0.3s ease-out;
}

.toast-leave-active {
  transition: all 0.3s ease-in;
}

.toast-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.toast-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}
</style>
