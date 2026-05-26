<template>
  <div class="terminal-page">
    <Terminal />
  </div>
</template>

<script setup>
import Terminal from '../components/Terminal.vue'
</script>

<style scoped>
.terminal-page {
  max-width: 1200px;
}

@media (max-width: 768px) {
  .terminal-page {
    max-width: 100%;
  }
}
</style>
