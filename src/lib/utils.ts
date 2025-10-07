import { SharedClient } from "@/hooks/use-rpc2"
import { NezhaServer, NezhaWebsocketResponse } from "@/types/nezha-api"
import { type ClassValue, clsx } from "clsx"
import dayjs from "dayjs"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNezhaInfo(now: number, serverInfo: NezhaServer) {
  const lastActiveTime = serverInfo.last_active.startsWith("000") ? 0 : parseISOTimestamp(serverInfo.last_active)
  return {
    ...serverInfo,
    cpu: serverInfo.state.cpu || 0,
    gpu: serverInfo.state.gpu || [],
    process: serverInfo.state.process_count || 0,
    up: serverInfo.state.net_out_speed / 1024 / 1024 || 0,
    down: serverInfo.state.net_in_speed / 1024 / 1024 || 0,
    last_active_time_string: lastActiveTime ? dayjs(lastActiveTime).format("YYYY-MM-DD HH:mm:ss") : "",
    online: now - lastActiveTime <= 30000,
    uptime: serverInfo.state.uptime || 0,
    version: serverInfo.host.version || null,
    tcp: serverInfo.state.tcp_conn_count || 0,
    udp: serverInfo.state.udp_conn_count || 0,
    mem: (serverInfo.state.mem_used / serverInfo.host.mem_total) * 100 || 0,
    swap: (serverInfo.state.swap_used / serverInfo.host.swap_total) * 100 || 0,
    disk: (serverInfo.state.disk_used / serverInfo.host.disk_total) * 100 || 0,
    stg: (serverInfo.state.disk_used / serverInfo.host.disk_total) * 100 || 0,
    country_code: serverInfo.country_code,
    platform: serverInfo.host.platform || "",
    net_out_transfer: serverInfo.state.net_out_transfer || 0,
    net_in_transfer: serverInfo.state.net_in_transfer || 0,
    arch: serverInfo.host.arch || "",
    mem_total: serverInfo.host.mem_total || 0,
    swap_total: serverInfo.host.swap_total || 0,
    disk_total: serverInfo.host.disk_total || 0,
    boot_time: serverInfo.host.boot_time || 0,
    boot_time_string: serverInfo.host.boot_time ? dayjs(serverInfo.host.boot_time * 1000).format("YYYY-MM-DD HH:mm:ss") : "",
    platform_version: serverInfo.host.platform_version || "",
    cpu_info: serverInfo.host.cpu || [],
    gpu_info: serverInfo.host.gpu || [],
    load_1: serverInfo.state.load_1?.toFixed(2) || 0.0,
    load_5: serverInfo.state.load_5?.toFixed(2) || 0.0,
    load_15: serverInfo.state.load_15?.toFixed(2) || 0.0,
    public_note: handlePublicNote(serverInfo.id, serverInfo.public_note || ""),
  }
}

export function getDaysBetweenDatesWithAutoRenewal({ autoRenewal, cycle, startDate, endDate }: BillingData): {
  days: number
  cycleLabel: string
  remainingPercentage: number
} {
  let months = 1
  // 套餐资费
  let cycleLabel = cycle

  switch (cycle.toLowerCase()) {
    case "月":
    case "m":
    case "mo":
    case "month":
    case "monthly":
      cycleLabel = "月"
      months = 1
      break
    case "年":
    case "y":
    case "yr":
    case "year":
    case "annual":
      cycleLabel = "年"
      months = 12
      break
    case "季":
    case "q":
    case "qr":
    case "quarterly":
      cycleLabel = "季"
      months = 3
      break
    case "半":
    case "半年":
    case "h":
    case "half":
    case "semi-annually":
      cycleLabel = "半年"
      months = 6
      break
    default:
      cycleLabel = cycle
      break
  }

  const nowTime = new Date().getTime()
  const endTime = dayjs(endDate).valueOf()

  if (autoRenewal !== "1") {
    return {
      days: getDaysBetweenDates(endDate, new Date(nowTime).toISOString()),
      cycleLabel: cycleLabel,
      remainingPercentage:
        getDaysBetweenDates(endDate, new Date(nowTime).toISOString()) / dayjs(endDate).diff(startDate, "day") > 1
          ? 1
          : getDaysBetweenDates(endDate, new Date(nowTime).toISOString()) / dayjs(endDate).diff(startDate, "day"),
    }
  }

  if (nowTime < endTime) {
    return {
      days: getDaysBetweenDates(endDate, new Date(nowTime).toISOString()),
      cycleLabel: cycleLabel,
      remainingPercentage:
        getDaysBetweenDates(endDate, new Date(nowTime).toISOString()) / (30 * months) > 1
          ? 1
          : getDaysBetweenDates(endDate, new Date(nowTime).toISOString()) / (30 * months),
    }
  }

  const nextTime = getNextCycleTime(endTime, months, nowTime)
  const diff = dayjs(nextTime).diff(dayjs(), "day") + 1
  const remainingPercentage = diff / (30 * months) > 1 ? 1 : diff / (30 * months)

  return {
    days: diff,
    cycleLabel: cycleLabel,
    remainingPercentage: remainingPercentage,
  }
}

// Thanks to hi2shark for the code
// https://github.com/hi2shark/nazhua/blob/main/src/utils/date.js#L86
export function getNextCycleTime(startDate: number, months: number, specifiedDate: number): number {
  const start = dayjs(startDate)
  const checkDate = dayjs(specifiedDate)

  if (!start.isValid() || months <= 0) {
    throw new Error("参数无效：请检查起始日期、周期月份数和指定日期。")
  }

  let nextDate = start

  // 循环增加周期直到大于当前日期
  let whileStatus = true
  while (whileStatus) {
    nextDate = nextDate.add(months, "month")
    whileStatus = nextDate.valueOf() <= checkDate.valueOf()
  }

  return nextDate.valueOf() // 返回时间毫秒数
}

export function getDaysBetweenDates(date1: string, date2: string): number {
  const oneDay = 24 * 60 * 60 * 1000 // 一天的毫秒数
  const firstDate = new Date(date1)
  const secondDate = new Date(date2)

  // 计算两个日期之间的天数差异
  return Math.round((firstDate.getTime() - secondDate.getTime()) / oneDay)
}

export const fetcher = (url: string) =>
  fetch(url)
    .then((res) => {
      if (!res.ok) {
        throw new Error(res.statusText)
      }
      return res.json()
    })
    .then((data) => data.data)
    .catch((err) => {
      console.error(err)
      throw err
    })

export const nezhaFetcher = async (url: string) => {
  const res = await fetch(url)

  if (!res.ok) {
    const error = new Error("An error occurred while fetching the data.")
    // @ts-expect-error - res.json() returns a Promise<any>
    error.info = await res.json()
    // @ts-expect-error - res.status is a number
    error.status = res.status
    throw error
  }

  return res.json()
}

export function parseISOTimestamp(isoString: string): number {
  return new Date(isoString).getTime()
}

export function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diff % (1000 * 60)) / 1000)

  if (hours > 24) {
    const days = Math.floor(hours / 24)
    return `${days}d`
  } else if (hours > 0) {
    return `${hours}h`
  } else if (minutes > 0) {
    return `${minutes}m`
  } else if (seconds >= 0) {
    return `${seconds}s`
  }
  return "0s"
}

export function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hours = date.getHours().toString().padStart(2, "0")
  const minutes = date.getMinutes().toString().padStart(2, "0")
  const seconds = date.getSeconds().toString().padStart(2, "0")
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

interface BillingData {
  startDate: string
  endDate: string
  autoRenewal: string
  cycle: string
  amount: string
}

interface PlanData {
  bandwidth: string
  trafficVol: string
  trafficType: string
  IPv4: string
  IPv6: string
  networkRoute: string
  extra: string
}

export interface PublicNoteData {
  billingDataMod?: BillingData
  planDataMod?: PlanData
}

export function parsePublicNote(publicNote: string): PublicNoteData | null {
  try {
    if (!publicNote) {
      return null
    }
    const data = JSON.parse(publicNote)
    if (!data.billingDataMod && !data.planDataMod) {
      return null
    }
    if (data.billingDataMod && !data.planDataMod) {
      return {
        billingDataMod: {
          startDate: data.billingDataMod.startDate || "",
          endDate: data.billingDataMod.endDate,
          autoRenewal: data.billingDataMod.autoRenewal || "",
          cycle: data.billingDataMod.cycle || "",
          amount: data.billingDataMod.amount || "",
        },
      }
    }
    if (!data.billingDataMod && data.planDataMod) {
      return {
        planDataMod: {
          bandwidth: data.planDataMod.bandwidth || "",
          trafficVol: data.planDataMod.trafficVol || "",
          trafficType: data.planDataMod.trafficType || "",
          IPv4: data.planDataMod.IPv4 || "",
          IPv6: data.planDataMod.IPv6 || "",
          networkRoute: data.planDataMod.networkRoute || "",
          extra: data.planDataMod.extra || "",
        },
      }
    }

    return {
      billingDataMod: {
        startDate: data.billingDataMod.startDate || "",
        endDate: data.billingDataMod.endDate,
        autoRenewal: data.billingDataMod.autoRenewal || "",
        cycle: data.billingDataMod.cycle || "",
        amount: data.billingDataMod.amount || "",
      },
      planDataMod: {
        bandwidth: data.planDataMod.bandwidth || "",
        trafficVol: data.planDataMod.trafficVol || "",
        trafficType: data.planDataMod.trafficType || "",
        IPv4: data.planDataMod.IPv4 || "",
        IPv6: data.planDataMod.IPv6 || "",
        networkRoute: data.planDataMod.networkRoute || "",
        extra: data.planDataMod.extra || "",
      },
    }
  } catch (error) {
    console.error("Error parsing public note:", error)
    return null
  }
}

// Function to handle public_note with sessionStorage
export function handlePublicNote(serverId: number, publicNote: string): string {
  const storageKey = `server_${serverId}_public_note`
  const storedNote = sessionStorage.getItem(storageKey)

  if (!publicNote && storedNote) {
    return storedNote
  }

  if (publicNote) {
    sessionStorage.setItem(storageKey, publicNote)
    return publicNote
  }

  return ""
}

export const uuidToNumber = (uuid: string): number => {
  let hash = 0
  for (let i = 0; i < uuid.length; i++) {
    const charCode = uuid.charCodeAt(i)
    hash = charCode + ((hash << 5) - hash)
  }
  return hash >>> 0
}

let km_servers_cache: any[] = []

const countryFlagToCode = (flag: string): string => {
  return [...flag].map((c) => String.fromCharCode(c.codePointAt(0)! - 127397 + 32)).join("")
}

export const komariToNezhaWebsocketResponse = (data: any): NezhaWebsocketResponse => {
  if (km_servers_cache.length === 0) {
    SharedClient()
      .call("common:getNodes")
      .then((res) => {
        km_servers_cache = Object.values(res || {})
      })
  }

  // 如果还没有缓存，先按 data 渲染，避免首次为空
  if (!km_servers_cache || km_servers_cache.length === 0) {
    const servers: any[] = Object.entries(data || {}).reduce((acc: any[], [uuid, status]: [string, any]) => {
      const host = {
        platform: status.os || "",
        platform_version: status.kernel_version || "",
        cpu: status.cpu_name ? [status.cpu_name] : [],
        gpu: status.gpu_name ? [status.gpu_name] : [],
        mem_total: status.ram_total || 0,
        disk_total: status.disk_total || 0,
        swap_total: status.swap_total || 0,
        arch: status.arch || "",
        boot_time: new Date(status.time).getTime() / 1000 - (status.uptime || 0),
        version: "",
      }

      const state = {
        cpu: status.cpu || 0,
        mem_used: status.ram || 0,
        swap_used: status.swap || 0,
        disk_used: status.disk || 0,
        net_in_transfer: status.net_total_down || 0,
        net_out_transfer: status.net_total_up || 0,
        net_in_speed: status.net_in || 0,
        net_out_speed: status.net_out || 0,
        uptime: status.uptime || 0,
        load_1: status.load || 0,
        load_5: status.load5 || 0,
        load_15: status.load15 || 0,
        tcp_conn_count: status.connections || 0,
        udp_conn_count: status.connections_udp || 0,
        process_count: status.process || 0,
        temperatures: status.temp > 0 ? [{ Name: "CPU", Temperature: status.temp }] : [],
        gpu: typeof status.gpu === "number" ? [status.gpu] : [],
      }

      acc.push({
        id: uuidToNumber(uuid),
        name: status.name || uuid,
        public_note: "",
        last_active: status.time,
        country_code: status.region ? countryFlagToCode(status.region) : "",
        display_index: 0,
        host,
        state,
      })
      return acc
    }, [])

    return {
      now: Date.now(),
      servers,
    }
  }

  // 按缓存列表展示；如果 data 中没有该 uuid，则视为离线
  const statusMap = new Map<string, any>(Object.entries(data || {}))
  const servers: any[] = km_servers_cache.map((server: any) => {
    const uuid = server.uuid
    const status = statusMap.get(uuid)
    // 已处理的 uuid 从映射中移除，避免后续增补阶段重复添加
    if (statusMap.has(uuid)) {
      statusMap.delete(uuid)
    }

    const bootTime = status ? new Date(status.time).getTime() / 1000 - (status.uptime || 0) : 0

    const host = {
      platform: server.os,
      platform_version: server.kernel_version,
      cpu: [server.cpu_name],
      gpu: server.gpu_name ? [server.gpu_name] : [],
      mem_total: server.mem_total,
      disk_total: server.disk_total,
      swap_total: server.swap_total,
      arch: server.arch,
      boot_time: bootTime,
      version: "",
    }

    const state = status
      ? {
          cpu: status.cpu || 0,
          mem_used: status.ram || 0,
          swap_used: status.swap || 0,
          disk_used: status.disk || 0,
          net_in_transfer: status.net_total_down || 0,
          net_out_transfer: status.net_total_up || 0,
          net_in_speed: status.net_in || 0,
          net_out_speed: status.net_out || 0,
          uptime: status.uptime || 0,
          load_1: status.load || 0,
          load_5: status.load5 || 0,
          load_15: status.load15 || 0,
          tcp_conn_count: status.connections || 0,
          udp_conn_count: status.connections_udp || 0,
          process_count: status.process || 0,
          temperatures: status.temp > 0 ? [{ Name: "CPU", Temperature: status.temp }] : [],
          gpu: server.gpu_name && typeof status.gpu === "number" ? [status.gpu] : [],
        }
      : {
          cpu: 0,
          mem_used: 0,
          swap_used: 0,
          disk_used: 0,
          net_in_transfer: 0,
          net_out_transfer: 0,
          net_in_speed: 0,
          net_out_speed: 0,
          uptime: 0,
          load_1: 0,
          load_5: 0,
          load_15: 0,
          tcp_conn_count: 0,
          udp_conn_count: 0,
          process_count: 0,
          temperatures: [],
          gpu: [],
        }

    return {
      id: uuidToNumber(uuid),
      name: server.name,
      public_note: server.public_note || "",
      last_active: status ? status.time : "0000-00-00T00:00:00Z",
      country_code: countryFlagToCode(server.region),
      display_index: -server.weight || 0,
      host,
      state,
    }
  })

  // 追加那些仅在 data 里出现但缓存里没有的新服务器（保证“出现过的都显示”）
  for (const [uuid, status] of statusMap.entries()) {
    const host = {
      platform: status.os || "",
      platform_version: status.kernel_version || "",
      cpu: status.cpu_name ? [status.cpu_name] : [],
      gpu: status.gpu_name ? [status.gpu_name] : [],
      mem_total: status.ram_total || 0,
      disk_total: status.disk_total || 0,
      swap_total: status.swap_total || 0,
      arch: status.arch || "",
      boot_time: new Date(status.time).getTime() / 1000 - (status.uptime || 0),
      version: "",
    }

    const state = {
      cpu: status.cpu || 0,
      mem_used: status.ram || 0,
      swap_used: status.swap || 0,
      disk_used: status.disk || 0,
      net_in_transfer: status.net_total_down || 0,
      net_out_transfer: status.net_total_up || 0,
      net_in_speed: status.net_in || 0,
      net_out_speed: status.net_out || 0,
      uptime: status.uptime || 0,
      load_1: status.load || 0,
      load_5: status.load5 || 0,
      load_15: status.load15 || 0,
      tcp_conn_count: status.connections || 0,
      udp_conn_count: status.connections_udp || 0,
      process_count: status.process || 0,
      temperatures: status.temp > 0 ? [{ Name: "CPU", Temperature: status.temp }] : [],
      gpu: typeof status.gpu === "number" ? [status.gpu] : [],
    }

    servers.push({
      id: uuidToNumber(uuid),
      name: status.name || uuid,
      public_note: "",
      last_active: status.time,
      country_code: status.region ? countryFlagToCode(status.region) : "",
      display_index: 0,
      host,
      state,
    })
  }

  return {
    now: Date.now(),
    servers,
  }
}
