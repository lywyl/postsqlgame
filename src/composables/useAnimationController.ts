import { ref } from 'vue'

export function useAnimationController() {
  const isPlaying = ref(false)
  const currentStep = ref(0)
  const totalSteps = ref(0)
  const speed = ref(1)

  function play() {
    if (currentStep.value >= totalSteps.value) {
      currentStep.value = 0
    }
    isPlaying.value = true
  }

  function pause() {
    isPlaying.value = false
  }

  function stepForward() {
    if (currentStep.value < totalSteps.value) {
      currentStep.value++
    }
  }

  function stepBackward() {
    if (currentStep.value > 0) {
      currentStep.value--
    }
  }

  function reset() {
    isPlaying.value = false
    currentStep.value = 0
  }

  return {
    isPlaying,
    currentStep,
    totalSteps,
    speed,
    play,
    pause,
    stepForward,
    stepBackward,
    reset
  }
}
