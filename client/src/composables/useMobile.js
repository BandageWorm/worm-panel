import { ref, onMounted, onUnmounted } from 'vue'

export function useMobile() {
  const isMobile = ref(window.innerWidth < 768)

  function onResize() {
    isMobile.value = window.innerWidth < 768
  }

  onMounted(() => window.addEventListener('resize', onResize))
  onUnmounted(() => window.removeEventListener('resize', onResize))

  return { isMobile }
}
