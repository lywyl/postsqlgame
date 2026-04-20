<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AchievementToast from './components/AchievementToast.vue'
import { setAchievementCallback } from './stores/game'

const toastRef = ref<InstanceType<typeof AchievementToast> | null>(null)

onMounted(() => {
  setAchievementCallback(({ icon, title }) => {
    toastRef.value?.show(icon, title)
  })
})
</script>

<template>
  <RouterView />
  <AchievementToast ref="toastRef" />
</template>

<style scoped>
</style>
