<template>
  <div class="trend-chart">
    <svg
      class="chart-svg"
      :viewBox="`0 0 ${W} ${H}`"
      preserveAspectRatio="none"
      @mousemove="onMove"
      @mouseleave="hover = null"
    >
      <defs>
        <linearGradient :id="gradientId" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" :stop-color="color" stop-opacity="0.28" />
          <stop offset="100%" :stop-color="color" stop-opacity="0.02" />
        </linearGradient>
      </defs>
      <path v-if="areaPath" :d="areaPath" :fill="`url(#${gradientId})`" />
      <path
        v-if="linePath"
        :d="linePath"
        fill="none"
        :stroke="color"
        stroke-width="1.6"
        stroke-linejoin="round"
        stroke-linecap="round"
        vector-effect="non-scaling-stroke"
      />
      <line
        v-if="hover"
        :x1="hover.x"
        :x2="hover.x"
        y1="0"
        :y2="H"
        stroke="#c0c4cc"
        stroke-width="1"
        stroke-dasharray="3 3"
        vector-effect="non-scaling-stroke"
      />
      <circle
        v-if="hover"
        :cx="hover.x"
        :cy="hover.y"
        r="2.6"
        :fill="color"
        vector-effect="non-scaling-stroke"
      />
    </svg>

    <div
      v-if="hover"
      class="chart-tip"
      :style="{ left: `${(hover.x / W) * 100}%`, top: `${(hover.y / H) * 100}%` }"
    >
      <div class="tip-value">{{ formatValue(hover.v) }}</div>
      <div class="tip-time">{{ formatTime(hover.t) }}</div>
    </div>

    <div v-if="!points.length" class="chart-empty">{{ emptyText }}</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { ref } from 'vue'
import { formatBytes } from '../composables/useFormat'

const props = defineProps({
  points: { type: Array, default: () => [] },
  color: { type: String, default: '#409eff' },
  // percent: 固定 0-100；speed: 按数据峰值自适应
  mode: { type: String, default: 'percent' },
  emptyText: { type: String, default: '数据积累中' }
})

const W = 600
const H = 120
const PAD = 4

const hover = ref(null)
const gradientId = `trend-${Math.random().toString(36).slice(2, 9)}`

const maxValue = computed(() => {
  if (props.mode === 'percent') return 100
  const max = props.points.reduce((acc, p) => Math.max(acc, Number(p.v) || 0), 0)
  return Math.max(1024, max * 1.1)
})

const coords = computed(() => {
  const list = props.points || []
  const n = list.length
  return list.map((p, i) => {
    const x = n <= 1 ? W / 2 : (i / (n - 1)) * W
    const v = Number(p.v) || 0
    const y = H - PAD - (Math.min(v, maxValue.value) / maxValue.value) * (H - PAD * 2)
    return { x, y, t: p.t, v }
  })
})

const linePath = computed(() => {
  const c = coords.value
  if (c.length === 0) return ''
  if (c.length === 1) return `M0 ${c[0].y.toFixed(1)} L${W} ${c[0].y.toFixed(1)}`
  return c.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
})

const areaPath = computed(() => {
  if (!linePath.value || props.points.length === 0) return ''
  return `${linePath.value} L${W} ${H} L0 ${H} Z`
})

function onMove(event) {
  const c = coords.value
  if (c.length === 0) return
  const rect = event.currentTarget.getBoundingClientRect()
  if (rect.width === 0) return
  const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
  const index = Math.round(ratio * (c.length - 1))
  hover.value = c[index]
}

function formatValue(v) {
  if (props.mode === 'percent') return `${Number(v).toFixed(1)}%`
  return `${formatBytes(v)}/s`
}

function formatTime(ts) {
  if (!ts) return '--'
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return '--'
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
</script>

<style scoped>
.trend-chart {
  position: relative;
  width: 100%;
  height: 120px;
}
.chart-svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}
.chart-tip {
  position: absolute;
  transform: translate(-50%, calc(-100% - 8px));
  background: rgba(48, 49, 51, 0.92);
  color: #fff;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 12px;
  line-height: 1.4;
  white-space: nowrap;
  pointer-events: none;
  z-index: 2;
}
.tip-value {
  font-weight: 600;
}
.tip-time {
  color: #d0d3d9;
  font-size: 11px;
}
.chart-empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #909399;
  pointer-events: none;
}
</style>
