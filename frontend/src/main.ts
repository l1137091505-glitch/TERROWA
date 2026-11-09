import './style.css'
import { BrowserProvider, Contract, JsonRpcProvider, formatEther, getAddress, isAddress, parseEther } from 'ethers'

const CHAIN_ID = 677
const CHAIN_HEX = '0x2a5'
const RPC_URL = 'https://rpc.botchain.ai'
const EXPLORER = 'https://scan.botchain.ai'
const RAW_ADDRESS = (import.meta.env.VITE_TERROWA_ADDRESS || '').trim()

const ABI = [
  'function owner() view returns (address)',
  'function assessor() view returns (address)',
  'function policyCount() view returns (uint256)',
  'function claimCount() view returns (uint256)',
  'function weatherReportCount() view returns (uint256)',
  'function totalStaked() view returns (uint256)',
  'function totalActiveLiability() view returns (uint256)',
  'function totalClaimsPaid() view returns (uint256)',
  'function rewardReserve() view returns (uint256)',
  'function availableReserve() view returns (uint256)',
  'function quotePremium(uint8,uint256,uint256) pure returns (uint256 premium,uint256 payoutCap)',
  'function policies(uint256) view returns (address farmer,uint8 coverageType,string crop,string region,uint128 cropValue,uint128 premium,uint128 payoutCap,uint64 startAt,uint64 endAt,uint8 status)',
  'function claims(uint256) view returns (uint256 policyId,address farmer,uint128 requestedAmount,uint64 filedAt,uint8 status,string lossRecord,string evidenceCid,string assessorNote)',
  'function stakes(address) view returns (uint256 amount,uint256 rewardDebt,uint256 pending,uint64 unlockAt)',
  'function pendingRewards(address) view returns (uint256)',
  'function weatherReports(uint256) view returns (uint8 coverageType,string region,uint8 severity,uint64 reportedAt,address reporter)',
  'function buyPolicy(uint8,string,string,uint128,uint64) payable returns (uint256)',
  'function expirePolicy(uint256)',
  'function fileClaim(uint256,uint128,string,string) returns (uint256)',
  'function reviewClaim(uint256,bool,string)',
  'function stake() payable',
  'function withdrawStake(uint256)',
  'function claimRewards()',
  'function reportWeather(uint8,string,uint8) returns (uint256)',
]

type RawProvider = {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>
  on?(event: string, listener: (...args: unknown[]) => void): void
  removeListener?(event: string, listener: (...args: unknown[]) => void): void
  isMetaMask?: boolean
}

type ProviderInfo = { uuid: string; name: string; icon?: string; rdns?: string }
type AnnouncedProvider = { info: ProviderInfo; provider: RawProvider }

declare global {
  interface Window {
    ethereum?: RawProvider & { providers?: RawProvider[]; isMetaMask?: boolean }
  }
}

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)
const text = (selector: string, value: string) => { const node = $(selector); if (node) node.textContent = value }
const formData = (form: HTMLFormElement) => Object.fromEntries(new FormData(form).entries()) as Record<string, string>
const coverageNames = ['Drought', 'Flood', 'Frost', 'Pest', 'Comprehensive']
const policyStates = ['Missing', 'Active', 'Claim filed', 'Paid', 'Expired']
const discovered = new Map<string, AnnouncedProvider>()

let rawProvider: RawProvider | null = null
let browserProvider: BrowserProvider | null = null
let account = ''
let chainId = 0
let publicContract: Contract | null = null
let previewMode = true

const rpc = new JsonRpcProvider(RPC_URL, { chainId: CHAIN_ID, name: 'BOT Chain' }, { staticNetwork: true })
const contractAddress = isAddress(RAW_ADDRESS) && RAW_ADDRESS !== '0x0000000000000000000000000000000000000000' ? getAddress(RAW_ADDRESS) : ''

function formatBot(value: bigint, digits = 3) {
  const n = Number(formatEther(value))
  return `${n.toLocaleString(undefined, { maximumFractionDigits: digits })} BOT`
}

function shortAddress(value: string) {
  return value ? `${value.slice(0, 6)}…${value.slice(-4)}` : 'Wallet not connected'
}

function friendlyError(error: unknown) {
  const e = error as { code?: number | string; shortMessage?: string; message?: string; reason?: string }
  if (e.code === 4001 || e.code === 'ACTION_REJECTED') return 'The wallet request was cancelled.'
  if (e.code === 4100) return 'The wallet has not authorised this site. Connect it and try again.'
  if (e.code === -32002) return 'The wallet request is already open. Finish it in the wallet.'
  if (e.code === 4902) return 'BOT Chain is not available in this wallet.'
  const message = e.shortMessage || e.reason || e.message || 'The transaction could not be completed.'
  if (/missing revert data/i.test(message)) return 'The contract rejected this call without a readable reason. Check the amount, lock and pool liquidity.'
  if (/insufficient funds/i.test(message)) return 'The wallet does not have enough BOT for this value and gas.'
  return message.replace(/^execution reverted:\s*/i, '').slice(0, 220)
}

function setStatus(selector: string, value: string, isError = false) {
  const node = $(selector)
  if (!node) return
  node.textContent = value
  node.dataset.state = isError ? 'error' : 'ok'
}

function renderWallets() {
  const host = $('#wallet-options')
  if (!host) return
  host.innerHTML = ''
  if (!discovered.size) {
    const note = document.createElement('span')
    note.textContent = 'No browser wallet detected'
    host.append(note)
    return
  }
  for (const item of discovered.values()) {
    const button = document.createElement('button')
    button.className = 'wallet-option'
    button.type = 'button'
    button.textContent = item.info.name
    button.addEventListener('click', () => connect(item.provider))
    host.append(button)
  }
}

function addProvider(detail: AnnouncedProvider) {
  if (!detail?.provider || !detail?.info?.uuid) return
  discovered.set(detail.info.uuid, detail)
  renderWallets()
}

window.addEventListener('eip6963:announceProvider', ((event: CustomEvent<AnnouncedProvider>) => addProvider(event.detail)) as EventListener)
window.dispatchEvent(new Event('eip6963:requestProvider'))

function addLegacyProviders() {
  const ethereum = window.ethereum
  if (!ethereum) return
  const providers = ethereum.providers?.length ? ethereum.providers : [ethereum]
  providers.forEach((provider, index) => addProvider({
    info: { uuid: `legacy-${index}`, name: provider.isMetaMask ? 'MetaMask' : providers.length > 1 ? `Browser wallet ${index + 1}` : 'Browser wallet' },
    provider,
  }))
}
addLegacyProviders()

async function switchToBotChain(provider: RawProvider) {
  const current = await provider.request({ method: 'eth_chainId' }) as string
  if (Number.parseInt(current, 16) === CHAIN_ID) return
  try {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_HEX }] })
  } catch (error) {
    const code = (error as { code?: number }).code
    if (code !== 4902) throw error
    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: CHAIN_HEX,
        chainName: 'BOT Chain',
        nativeCurrency: { name: 'BOT', symbol: 'BOT', decimals: 18 },
        rpcUrls: [RPC_URL],
        blockExplorerUrls: [EXPLORER],
      }],
    })
  }
}

async function connect(provider: RawProvider) {
  try {
    await switchToBotChain(provider)
    const accounts = await provider.request({ method: 'eth_requestAccounts' }) as string[]
    if (!accounts?.[0]) throw new Error('The wallet did not return an account.')
    rawProvider = provider
    browserProvider = new BrowserProvider(provider, 'any')
    account = getAddress(accounts[0])
    chainId = CHAIN_ID
    provider.on?.('accountsChanged', onAccountsChanged)
    provider.on?.('chainChanged', onChainChanged)
    provider.on?.('disconnect', onDisconnect)
    $('#wallet-panel')?.setAttribute('hidden', '')
    updateWalletUi()
    await refreshAll()
  } catch (error) {
    setStatus('#cover-status', friendlyError(error), true)
  }
}

function onAccountsChanged(value: unknown) {
  const accounts = value as string[]
  account = accounts?.[0] && isAddress(accounts[0]) ? getAddress(accounts[0]) : ''
  updateWalletUi()
  void refreshAll()
}

function onChainChanged(value: unknown) {
  chainId = Number.parseInt(String(value), 16)
  updateWalletUi()
  if (chainId !== CHAIN_ID) setStatus('#cover-status', 'Switch the wallet to BOT Chain.', true)
  else void refreshAll()
}

function onDisconnect() {
  account = ''
  browserProvider = null
  rawProvider = null
  updateWalletUi()
}

function updateWalletUi() {
  text('#wallet-short', shortAddress(account))
  text('#connect-wallet', account ? shortAddress(account) : 'Connect wallet')
  text('#network-status', chainId && chainId !== CHAIN_ID ? `Wrong network · ${chainId}` : 'Network 677')
}

async function initContract() {
  if (!contractAddress) {
    previewMode = true
    setStatus('#contract-status', 'Preview mode: deploy the contract and add VITE_TERROWA_ADDRESS.')
    return
  }
  try {
    const code = await rpc.getCode(contractAddress)
    if (code === '0x') throw new Error('Contract code was not found at this address.')
    publicContract = new Contract(contractAddress, ABI, rpc)
    previewMode = false
    setStatus('#contract-status', `Contract ${shortAddress(contractAddress)} · BOT Chain`)
  } catch (error) {
    previewMode = true
    publicContract = null
    setStatus('#contract-status', friendlyError(error), true)
  }
}

async function writableContract() {
  if (previewMode || !contractAddress) throw new Error('Deploy the contract and configure VITE_TERROWA_ADDRESS first.')
  if (!rawProvider || !browserProvider || !account) throw new Error('Connect a wallet to continue.')
  await switchToBotChain(rawProvider)
  const network = await browserProvider.getNetwork()
  if (Number(network.chainId) !== CHAIN_ID) throw new Error('Switch the wallet to BOT Chain.')
  const code = await browserProvider.getCode(contractAddress)
  if (code === '0x') throw new Error('Contract code was not found at this address.')
  const signer = await browserProvider.getSigner()
  const signerAddress = await signer.getAddress()
  if (signerAddress.toLowerCase() !== account.toLowerCase()) throw new Error('The selected wallet account changed. Reconnect it and try again.')
  return new Contract(contractAddress, ABI, signer)
}

async function submitTransaction(selector: string, label: string, action: () => Promise<{ hash: string; wait(): Promise<unknown> }>) {
  try {
    setStatus(selector, `${label}: confirm the request in your wallet.`)
    const transaction = await action()
    setStatus(selector, `Transaction submitted: ${transaction.hash.slice(0, 10)}… Waiting for BOT Chain confirmation.`)
    await transaction.wait()
    setStatus(selector, 'Transaction confirmed on BOT Chain.')
    await refreshAll()
  } catch (error) {
    setStatus(selector, friendlyError(error), true)
  }
}

async function refreshQuote() {
  const form = $('#cover-form') as HTMLFormElement | null
  if (!form) return
  const data = formData(form)
  try {
    const value = parseEther(data.cropValue || '0')
    const seconds = BigInt(Math.round(Number(data.duration || 0) * 86400))
    let premium: bigint
    let cap: bigint
    if (publicContract) [premium, cap] = await publicContract.quotePremium(Number(data.coverage), value, seconds)
    else {
      const rates = [300n, 250n, 200n, 150n, 600n]
      premium = value * rates[Number(data.coverage)] * seconds / (365n * 86400n * 10000n)
      if (premium === 0n && value > 0n) premium = 1n
      cap = value * 8000n / 10000n
    }
    text('#quote-premium', formatBot(premium))
    text('#quote-cap', formatBot(cap))
  } catch {
    text('#quote-premium', '—')
    text('#quote-cap', '—')
  }
}

async function refreshAll() {
  await refreshQuote()
  if (!publicContract) return
  try {
    const [policyCount, claimCount, reserve, staked, liability, reportCount] = await Promise.all([
      publicContract.policyCount(), publicContract.claimCount(), publicContract.availableReserve(), publicContract.totalStaked(), publicContract.totalActiveLiability(), publicContract.weatherReportCount(),
    ]) as bigint[]
    text('#policy-count', policyCount.toString())
    text('#claim-count', claimCount.toString())
    text('#reserve-mini', formatBot(reserve))
    text('#quote-reserve', formatBot(reserve))
    text('#reserve-total', formatBot(reserve))
    text('#liability-total', formatBot(liability))
    await Promise.all([loadPolicies(policyCount), loadWeather(reportCount), loadStake()])
    void staked
  } catch (error) {
    setStatus('#contract-status', friendlyError(error), true)
  }
}

async function loadPolicies(count: bigint) {
  const ledger = $('#policy-ledger')
  if (!ledger || !publicContract) return
  const head = '<div class="ledger__head"><span>ID</span><span>Crop and region</span><span>Term</span><span>Payout cap</span><span>Status</span></div>'
  const rows: string[] = []
  const start = Number(count > 20n ? count - 19n : 1n)
  for (let id = Number(count); id >= start; id--) {
    const p = await publicContract.policies(id)
    if (account && String(p.farmer).toLowerCase() !== account.toLowerCase()) continue
    const days = Math.max(0, Math.round((Number(p.endAt) - Number(p.startAt)) / 86400))
    rows.push(`<div class="ledger__row"><strong>#${id.toString().padStart(4, '0')}</strong><span>${escapeHtml(p.crop)}<small>${escapeHtml(p.region)} · ${coverageNames[Number(p.coverageType)]}</small></span><span>${days} days</span><span>${formatBot(p.payoutCap)}</span><span class="state">${policyStates[Number(p.status)]}</span></div>`)
  }
  ledger.innerHTML = head + (rows.join('') || '<div class="empty-row">No policies found for this wallet.</div>')
}

async function loadWeather(count: bigint) {
  const host = $('#weather-ledger')
  if (!host || !publicContract) return
  let html = '<div><span>Report</span><span>Hazard</span><span>Region</span><span>Severity</span></div>'
  const start = Number(count > 6n ? count - 5n : 1n)
  const rows: string[] = []
  for (let id = Number(count); id >= start; id--) {
    const w = await publicContract.weatherReports(id)
    rows.push(`<div class="weather-row"><span>#${id}</span><span>${coverageNames[Number(w.coverageType)]}</span><span>${escapeHtml(w.region)}</span><span>${Number(w.severity)} / 100</span></div>`)
  }
  host.innerHTML = html + (rows.join('') || '<p>No weather reports have been loaded.</p>')
}

async function loadStake() {
  if (!account || !publicContract) {
    text('#stake-total', '0 BOT'); text('#reward-total', '0 BOT'); text('#unlock-time', '—'); return
  }
  const [position, pending] = await Promise.all([publicContract.stakes(account), publicContract.pendingRewards(account)])
  text('#stake-total', formatBot(position.amount))
  text('#reward-total', formatBot(pending))
  text('#unlock-time', Number(position.unlockAt) ? new Date(Number(position.unlockAt) * 1000).toLocaleString() : '—')
}

function escapeHtml(value: unknown) {
  return String(value).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c] || c))
}

$('#connect-wallet')?.addEventListener('click', () => {
  if (account) return
  const panel = $('#wallet-panel')
  if (!panel) return
  panel.toggleAttribute('hidden')
  window.dispatchEvent(new Event('eip6963:requestProvider'))
  addLegacyProviders()
})

const mobileLink = $('#mobile-wallet') as HTMLAnchorElement | null
if (mobileLink) mobileLink.href = `https://metamask.app.link/dapp/${location.host}${location.pathname}`

$('#cover-form')?.addEventListener('input', () => void refreshQuote())
$('#cover-form')?.addEventListener('submit', event => {
  event.preventDefault()
  const form = event.currentTarget as HTMLFormElement
  const data = formData(form)
  void submitTransaction('#cover-status', 'Buy crop cover', async () => {
    const contract = await writableContract()
    const cropValue = parseEther(data.cropValue)
    const seconds = BigInt(Math.round(Number(data.duration) * 86400))
    const [premium] = await contract.quotePremium(Number(data.coverage), cropValue, seconds)
    return contract.buyPolicy(Number(data.coverage), data.crop.trim(), data.region.trim(), cropValue, seconds, { value: premium })
  })
})

$('#expire-form')?.addEventListener('submit', event => {
  event.preventDefault(); const data = formData(event.currentTarget as HTMLFormElement)
  void submitTransaction('#expire-status', 'Sync expired policy', async () => (await writableContract()).expirePolicy(BigInt(data.policyId)))
})

$('#claim-form')?.addEventListener('submit', event => {
  event.preventDefault(); const data = formData(event.currentTarget as HTMLFormElement)
  void submitTransaction('#claim-status', 'File a claim', async () => (await writableContract()).fileClaim(BigInt(data.policyId), parseEther(data.amount), data.loss.trim(), data.cid.trim()))
})

$('#review-form')?.addEventListener('submit', event => {
  event.preventDefault(); const data = formData(event.currentTarget as HTMLFormElement)
  void submitTransaction('#review-status', 'Review claim', async () => (await writableContract()).reviewClaim(BigInt(data.claimId), data.approve === 'true', data.note.trim()))
})

$('#stake-form')?.addEventListener('submit', event => {
  event.preventDefault(); const data = formData(event.currentTarget as HTMLFormElement)
  void submitTransaction('#pool-status', 'Add pool stake', async () => (await writableContract()).stake({ value: parseEther(data.amount) }))
})

$('#withdraw-form')?.addEventListener('submit', event => {
  event.preventDefault(); const data = formData(event.currentTarget as HTMLFormElement)
  void submitTransaction('#pool-status', 'Withdraw pool stake', async () => (await writableContract()).withdrawStake(parseEther(data.amount)))
})

$('#claim-rewards')?.addEventListener('click', () => void submitTransaction('#pool-status', 'Claim premium share', async () => (await writableContract()).claimRewards()))

$('#weather-form')?.addEventListener('submit', event => {
  event.preventDefault(); const data = formData(event.currentTarget as HTMLFormElement)
  void submitTransaction('#weather-status', 'Add weather report', async () => (await writableContract()).reportWeather(Number(data.coverage), data.region.trim(), Number(data.severity)))
})

void initContract().then(refreshAll)
updateWalletUi()
