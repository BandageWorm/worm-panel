<template>
  <div class="alerts-page">
    <LoadingBlock v-if="loading" />
    <template v-else>
      <!-- 通道配置 -->
      <el-card shadow="never" class="alerts-card">
        <template #header>
          <div class="card-header">
            <el-icon><Bell /></el-icon>
            <span>通知通道</span>
            <el-tag v-if="!enabledChannels.length" type="warning" size="small" effect="light">
              未配置通知通道
            </el-tag>
          </div>
        </template>

        <el-collapse v-model="activeChannels">
          <!-- Telegram -->
          <el-collapse-item name="telegram">
            <template #title>
              <div class="collapse-title">
                <span>Telegram</span>
                <el-tag size="small" :type="channelTagType('telegram')" effect="plain">
                  {{ channelTagText('telegram') }}
                </el-tag>
              </div>
            </template>
            <el-form label-position="top" class="channel-form">
              <el-form-item>
                <template #label><span class="label-with-tip">启用</span></template>
                <el-switch v-model="form.telegram.enabled" />
                <div class="form-tip">境内服务器直连可能不通，可填写反代地址</div>
              </el-form-item>
              <el-form-item label="Bot Token">
                <el-input
                  v-model="form.telegram.botToken"
                  type="password"
                  show-password
                  :placeholder="configured.telegram ? '已配置，留空表示不修改' : '123456:ABC-DEF...'"
                />
              </el-form-item>
              <el-form-item label="Chat ID">
                <el-input v-model="form.telegram.chatId" placeholder="123456789" />
              </el-form-item>
              <el-form-item label="API 地址（可选）">
                <el-input v-model="form.telegram.apiBase" placeholder="https://api.telegram.org" />
              </el-form-item>
              <el-button size="small" :loading="testing === 'telegram'" @click="testChannel('telegram')">
                发送测试
              </el-button>
            </el-form>
          </el-collapse-item>

          <!-- 邮件 -->
          <el-collapse-item name="email">
            <template #title>
              <div class="collapse-title">
                <span>邮件（SMTP）</span>
                <el-tag size="small" :type="channelTagType('email')" effect="plain">
                  {{ channelTagText('email') }}
                </el-tag>
              </div>
            </template>
            <el-form label-position="top" class="channel-form">
              <el-form-item>
                <template #label><span class="label-with-tip">启用</span></template>
                <el-switch v-model="form.email.enabled" />
              </el-form-item>
              <el-form-item label="SMTP 服务器">
                <el-input v-model="form.email.host" placeholder="smtp.qq.com" />
              </el-form-item>
              <el-form-item>
                <template #label>
                  <span class="label-with-tip">端口 <span class="form-tip-inline">（只支持 465 / 587，25 端口通常被云厂商封禁）</span></span>
                </template>
                <el-radio-group v-model="form.email.port">
                  <el-radio-button :value="465">465（SSL）</el-radio-button>
                  <el-radio-button :value="587">587（STARTTLS）</el-radio-button>
                </el-radio-group>
              </el-form-item>
              <el-form-item label="用户名">
                <el-input v-model="form.email.user" placeholder="通常是完整邮箱地址" />
              </el-form-item>
              <el-form-item label="密码 / 授权码">
                <el-input
                  v-model="form.email.pass"
                  type="password"
                  show-password
                  :placeholder="configured.email ? '已配置，留空表示不修改' : '邮箱授权码'"
                />
              </el-form-item>
              <el-form-item label="发件人">
                <el-input v-model="form.email.from" placeholder="panel@example.com" />
              </el-form-item>
              <el-form-item>
                <template #label>
                  <span class="label-with-tip">收件人 <span class="form-tip-inline">（多个用逗号或换行分隔）</span></span>
                </template>
                <el-input v-model="emailToText" type="textarea" :rows="2" placeholder="me@example.com" />
              </el-form-item>
              <el-form-item>
                <template #label><span class="label-with-tip">允许不安全证书</span></template>
                <el-switch v-model="form.email.allowInsecure" />
                <div class="form-tip">仅用于自签证书的 SMTP 服务器，开启后无法校验服务器身份</div>
              </el-form-item>
              <el-button size="small" :loading="testing === 'email'" @click="testChannel('email')">
                发送测试
              </el-button>
            </el-form>
          </el-collapse-item>

          <!-- Webhook -->
          <el-collapse-item name="webhook">
            <template #title>
              <div class="collapse-title">
                <span>Webhook</span>
                <el-tag size="small" :type="channelTagType('webhook')" effect="plain">
                  {{ channelTagText('webhook') }}
                </el-tag>
              </div>
            </template>
            <el-form label-position="top" class="channel-form">
              <el-form-item>
                <template #label><span class="label-with-tip">启用</span></template>
                <el-switch v-model="form.webhook.enabled" />
              </el-form-item>
              <el-form-item label="预设">
                <el-select v-model="preset" placeholder="选择后自动填充" clearable style="width:220px" @change="applyPreset">
                  <el-option v-for="p in presets" :key="p.id" :label="p.label" :value="p.id" />
                </el-select>
                <div class="form-tip" v-pre>预设中的 {{key}} 需要替换为你的密钥</div>
              </el-form-item>
              <el-form-item label="地址">
                <el-input v-model="form.webhook.url" placeholder="https://example.com/hook" />
                <div class="form-tip" v-if="configured.webhook">当前已配置：{{ data.channels?.webhook?.urlHint || '已配置' }}</div>
              </el-form-item>
              <el-form-item label="请求方法">
                <el-radio-group v-model="form.webhook.method">
                  <el-radio-button value="POST">POST</el-radio-button>
                  <el-radio-button value="GET">GET</el-radio-button>
                  <el-radio-button value="PUT">PUT</el-radio-button>
                </el-radio-group>
              </el-form-item>
              <el-form-item label="内容类型">
                <el-radio-group v-model="form.webhook.contentType">
                  <el-radio-button value="json">JSON</el-radio-button>
                  <el-radio-button value="form">表单</el-radio-button>
                  <el-radio-button value="text">纯文本</el-radio-button>
                </el-radio-group>
              </el-form-item>
              <el-form-item label="请求体模板">
                <el-input v-model="form.webhook.body" type="textarea" :rows="4" placeholder='{"title":"{{title}}","content":"{{message}}"}' />
                <div class="form-tip">可用变量：title、message、level、rule、target、value、time</div>
              </el-form-item>
              <el-button size="small" :loading="testing === 'webhook'" @click="testChannel('webhook')">
                发送测试
              </el-button>
            </el-form>
          </el-collapse-item>
        </el-collapse>

        <div class="actions-bar">
          <el-button type="primary" :loading="savingChannels" @click="saveChannels">保存通道配置</el-button>
        </div>
      </el-card>

      <!-- 规则 -->
      <el-card shadow="never" class="alerts-card">
        <template #header>
          <div class="card-header">
            <el-icon><Aim /></el-icon>
            <span>告警规则</span>
            <span class="header-hint">当前告警中：{{ firing.length }} 项</span>
          </div>
        </template>

        <el-table :data="rules" size="small" class="rules-table">
          <el-table-column prop="label" label="规则" min-width="120" />
          <el-table-column label="启用" width="80">
            <template #default="{ row }">
              <el-switch v-model="row.enabled" size="small" />
            </template>
          </el-table-column>
          <el-table-column label="阈值" width="150">
            <template #default="{ row }">
              <template v-if="row.threshold !== null">
                <el-input-number v-model="row.threshold" :min="0" :step="1" size="small" controls-position="right" style="width:100px" />
                <span class="unit">{{ row.unit }}</span>
              </template>
              <span v-else class="unit">—</span>
            </template>
          </el-table-column>
          <el-table-column label="冷却（分钟）" width="150">
            <template #default="{ row }">
              <el-input-number v-model="row.cooldownMinutes" :min="1" :max="10080" :step="10" size="small" controls-position="right" style="width:110px" />
            </template>
          </el-table-column>
          <el-table-column prop="description" label="说明" min-width="220" show-overflow-tooltip />
        </el-table>

        <div class="actions-bar">
          <el-button type="primary" :loading="savingRules" @click="saveRules">保存规则</el-button>
          <el-button :loading="checking" @click="checkNow">立即评估一次</el-button>
        </div>
      </el-card>

      <!-- 历史 -->
      <el-card shadow="never" class="alerts-card">
        <template #header>
          <div class="card-header">
            <el-icon><Document /></el-icon>
            <span>告警历史</span>
            <span class="header-hint">待补发 {{ data.status?.pending || 0 }} 条</span>
          </div>
        </template>

        <el-table :data="history" size="small" class="history-table">
          <el-table-column type="expand">
            <template #default="{ row }">
              <div class="history-detail">
                <div v-if="row.skipped" class="detail-line">未配置通知通道，本条仅记录</div>
                <div v-for="c in row.channels" :key="c.channel" class="detail-line">
                  <el-tag size="small" :type="c.ok ? 'success' : 'danger'" effect="plain">{{ c.channel }}</el-tag>
                  <span class="detail-ms">{{ c.ms }} ms</span>
                  <span v-if="!c.ok" class="detail-error">{{ c.error }}</span>
                  <span v-else-if="c.delayed" class="detail-ms">延迟补发</span>
                </div>
                <div v-if="!row.channels || !row.channels.length" class="detail-line">无投递记录</div>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="时间" width="160">
            <template #default="{ row }">{{ formatTime(row.time, { locale: true }) }}</template>
          </el-table-column>
          <el-table-column label="级别" width="90">
            <template #default="{ row }">
              <el-tag size="small" :type="levelType(row.level)" effect="light">{{ levelText(row.level) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="rule" label="规则" width="110" />
          <el-table-column prop="target" label="目标" width="140" show-overflow-tooltip />
          <el-table-column prop="message" label="内容" min-width="220" show-overflow-tooltip />
        </el-table>
        <div v-if="!history.length" class="empty-hint">暂无告警记录</div>
      </el-card>
    </template>
  </div>
</template>

<script setup>
import LoadingBlock from '../components/LoadingBlock.vue'
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { get, put, post } from '../api'
import { formatTime } from '../composables/useFormat'

const loading = ref(true)
const savingChannels = ref(false)
const savingRules = ref(false)
const checking = ref(false)
const testing = ref('')
const preset = ref('')
const activeChannels = ref(['telegram'])
const emailToText = ref('')

const data = ref({ channels: {}, rules: [], status: {}, history: [] })
const rules = ref([])
const history = ref([])

const form = reactive({
  telegram: { enabled: false, botToken: '', chatId: '', apiBase: '' },
  email: { enabled: false, host: '', port: 465, user: '', pass: '', from: '', allowInsecure: false },
  webhook: { enabled: false, url: '', method: 'POST', contentType: 'json', body: '' }
})

const configured = computed(() => ({
  telegram: !!data.value.channels?.telegram?.configured,
  email: !!data.value.channels?.email?.configured,
  webhook: !!data.value.channels?.webhook?.configured
}))
const presets = computed(() => data.value.channels?.presets || [])
const enabledChannels = computed(() => data.value.enabledChannels || [])
const firing = computed(() => data.value.status?.firing || [])

function channelTagType(name) {
  if (enabledChannels.value.includes(name)) return 'success'
  const cfg = form[name]
  return cfg && cfg.enabled ? 'warning' : 'info'
}

function channelTagText(name) {
  if (enabledChannels.value.includes(name)) return '已启用'
  const cfg = form[name]
  return cfg && cfg.enabled ? '待完善' : '未启用'
}

function levelType(level) {
  if (level === 'error') return 'danger'
  if (level === 'warn') return 'warning'
  if (level === 'info') return 'success'
  return 'info'
}

function levelText(level) {
  if (level === 'error') return '严重'
  if (level === 'warn') return '警告'
  if (level === 'info') return '通知'
  return level || '--'
}

function applyPreset(id) {
  const p = presets.value.find(item => item.id === id)
  if (!p) return
  form.webhook.method = p.method
  form.webhook.contentType = p.contentType
  form.webhook.body = p.body
  if (!form.webhook.url) form.webhook.url = p.url
}

async function load() {
  try {
    const res = await get('/alerts')
    data.value = res
    rules.value = (res.rules || []).map(r => ({ ...r }))

    const c = res.channels || {}
    form.telegram.enabled = !!c.telegram?.enabled
    form.telegram.chatId = c.telegram?.chatId || ''
    form.telegram.apiBase = c.telegram?.apiBase || ''
    form.telegram.botToken = ''

    form.email.enabled = !!c.email?.enabled
    form.email.host = c.email?.host || ''
    form.email.port = c.email?.port || 465
    form.email.user = c.email?.user || ''
    form.email.from = c.email?.from || ''
    form.email.allowInsecure = !!c.email?.allowInsecure
    form.email.pass = ''
    emailToText.value = (c.email?.to || []).join(', ')

    form.webhook.enabled = !!c.webhook?.enabled
    form.webhook.method = c.webhook?.method || 'POST'
    form.webhook.contentType = c.webhook?.contentType || 'json'
    form.webhook.body = c.webhook?.body || ''
    form.webhook.url = ''

    history.value = res.history || []
  } catch (e) {
    ElMessage.error('加载告警配置失败: ' + e.message)
  }
  loading.value = false
}

async function saveChannels() {
  savingChannels.value = true
  try {
    const payload = {
      telegram: { ...form.telegram },
      email: { ...form.email, to: emailToText.value },
      webhook: { ...form.webhook }
    }
    const res = await put('/alerts/channels', payload)
    data.value.channels = res.channels
    ElMessage.success('通道配置已保存')
    await load()
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    savingChannels.value = false
  }
}

async function saveRules() {
  savingRules.value = true
  try {
    const payload = {}
    for (const r of rules.value) {
      payload[r.id] = {
        enabled: r.enabled,
        cooldownMinutes: r.cooldownMinutes,
        ...(r.threshold !== null ? { threshold: r.threshold } : {})
      }
    }
    const res = await put('/alerts/rules', payload)
    rules.value = (res.rules || []).map(r => ({ ...r }))
    data.value.rules = res.rules
    ElMessage.success('规则已保存，立即生效')
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    savingRules.value = false
  }
}

async function testChannel(channel) {
  testing.value = channel
  try {
    const res = await post('/alerts/test', { channel })
    ElMessage.success(`测试消息已发送（${res.ms} ms）`)
  } catch (e) {
    ElMessage.error('测试失败：' + e.message)
  } finally {
    testing.value = ''
  }
}

async function checkNow() {
  checking.value = true
  try {
    const res = await post('/alerts/check', {})
    data.value.status = res.status
    ElMessage.success('已评估一次')
    history.value = (await get('/alerts/history?limit=100')).history || []
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    checking.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.alerts-page {
  max-width: 1080px;
}
.alerts-card {
  margin-bottom: 20px;
  border-radius: 10px;
}
.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
}
.header-hint {
  font-size: 12px;
  font-weight: 400;
  color: #909399;
  margin-left: auto;
}
.collapse-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
}
.channel-form {
  max-width: 480px;
  padding: 4px 0 8px;
}
.label-with-tip {
  font-size: 14px;
  font-weight: 600;
}
.form-tip-inline {
  font-size: 12px;
  font-weight: 400;
  color: #909399;
  margin-left: 6px;
}
.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 6px;
  line-height: 1.5;
}
.actions-bar {
  display: flex;
  gap: 12px;
  margin-top: 16px;
  flex-wrap: wrap;
}
.unit {
  margin-left: 6px;
  font-size: 12px;
  color: #909399;
}
.empty-hint {
  padding: 16px 0;
  font-size: 13px;
  color: #909399;
}
.history-detail {
  padding: 8px 16px;
  background: #fafafa;
  border-radius: 6px;
}
.detail-line {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: #606266;
  padding: 3px 0;
}
.detail-ms {
  color: #909399;
}
.detail-error {
  color: #f56c6c;
  word-break: break-all;
}

@media (max-width: 768px) {
  .alerts-page {
    max-width: 100%;
  }
  .channel-form {
    max-width: 100%;
  }
  .channel-form :deep(.el-input),
  .channel-form :deep(.el-select) {
    width: 100% !important;
  }
  .rules-table,
  .history-table {
    font-size: 12px;
  }
  .actions-bar .el-button {
    flex: 1;
    margin-left: 0 !important;
  }
}
</style>
