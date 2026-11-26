// Cloudflare Workers & Pages VLESS Proxy Script
// Enhanced Edition v2.5.0 with Dynamic Subscription Engine, Multi-ProxyIP Pool, and Modern Dashboard
// @ts-ignore
import { connect } from "cloudflare:sockets";

let userID = "86c50e3a-5b87-49dd-bd20-03c7f2735e40";

// Default fallback ProxyIP pool (IPv4 VPS & Reverse Proxies with SNI passthrough)
const defaultProxyIPs = [
  "proxyip.aliyun.fxxk.dedyn.io:443",
  "proxyip.oracle.fxxk.dedyn.io:443",
  "8.220.194.243:443",
  "64.181.227.82:443"
];

let CDNIP = "www.visa.com.sg";

// Default HTTP Clean IPs (Non-TLS, ports 80系)
let IP1 = "www.visa.com";
let IP2 = "cis.visa.com";
let IP3 = "africa.visa.com";
let IP4 = "www.visa.com.sg";
let IP5 = "www.visaeurope.at";
let IP6 = "www.visa.com.mt";
let IP7 = "qa.visamiddleeast.com";

// Default HTTPS Clean IPs (TLS, ports 443系)
let IP8 = "usa.visa.com";
let IP9 = "myanmar.visa.com";
let IP10 = "www.visa.com.tw";
let IP11 = "www.visaeurope.ch";
let IP12 = "www.visa.com.br";
let IP13 = "www.visasoutheast构建europe.com";

// Default Ports
let PT1 = "80";
let PT2 = "8080";
let PT3 = "8880";
let PT4 = "2052";
let PT5 = "2082";
let PT6 = "2086";
let PT7 = "2095";

let PT8 = "443";
let PT9 = "8443";
let PT10 = "2053";
let PT11 = "2083";
let PT12 = "2087";
let PT13 = "2096";

const dohURL = "https://cloudflare-dns.com/dns-query";

/**
 * Parse proxy IP string into an array of { host, port }
 * Supports comma, semicolon, space, or newline separated values
 * Example: "1.2.3.4:443, [2001:db8::1]:8443, proxy.example.com"
 */
function parseProxyIPList(input) {
  if (!input) return [];
  const entries = input.split(/[,;\s\n]+/).map((s) => s.trim()).filter(Boolean);
  const result = [];
  for (const entry of entries) {
    if (entry.includes("]:")) {
      const idx = entry.lastIndexOf(":");
      const port = parseInt(entry.slice(idx + 1), 10) || 443;
      const host = entry.slice(0, idx);
      result.push({ host, port });
    } else if (entry.startsWith("[") && entry.endsWith("]")) {
      result.push({ host: entry, port: 443 });
    } else if (entry.includes(":")) {
      const parts = entry.split(":");
      const port = parseInt(parts[1], 10) || 443;
      result.push({ host: parts[0], port });
    } else {
      result.push({ host: entry, port: 443 });
    }
  }
  return result;
}

export default {
  /**
   * @param {any} request
   * @param {any} env
   * @param {any} ctx
   * @returns {Promise<Response>}
   */
  async fetch(request, env, ctx) {
    try {
      userID = env.uuid || env.UUID || userID;
      CDNIP = env.cdnip || CDNIP;
      IP1 = env.ip1 || IP1;
      IP2 = env.ip2 || IP2;
      IP3 = env.ip3 || IP3;
      IP4 = env.ip4 || IP4;
      IP5 = env.ip5 || IP5;
      IP6 = env.ip6 || IP6;
      IP7 = env.ip7 || IP7;
      IP8 = env.ip8 || IP8;
      IP9 = env.ip9 || IP9;
      IP10 = env.ip10 || IP10;
      IP11 = env.ip11 || IP11;
      IP12 = env.ip12 || IP12;
      IP13 = env.ip13 || IP13;
      PT1 = env.pt1 || PT1;
      PT2 = env.pt2 || PT2;
      PT3 = env.pt3 || PT3;
      PT4 = env.pt4 || PT4;
      PT5 = env.pt5 || PT5;
      PT6 = env.pt6 || PT6;
      PT7 = env.pt7 || PT7;
      PT8 = env.pt8 || PT8;
      PT9 = env.pt9 || PT9;
      PT10 = env.pt10 || PT10;
      PT11 = env.pt11 || PT11;
      PT12 = env.pt12 || PT12;
      PT13 = env.pt13 || PT13;

      // Build ProxyIP pool
      let proxyPool = parseProxyIPList(env.proxyip || env.PROXYIP);
      if (proxyPool.length === 0) {
        proxyPool = parseProxyIPList(defaultProxyIPs.join(","));
      }

      const url = new URL(request.url);
      const hostName = request.headers.get("Host") || url.hostname;
      const upgradeHeader = request.headers.get("Upgrade");

      // Extract dynamic pyip override if specified in path or query
      let dynamicPyip = url.searchParams.get("pyip") || url.searchParams.get("proxyip");
      if (!dynamicPyip && url.pathname.includes("/pyip=")) {
        const match = url.pathname.match(/\/pyip=([^/?]+)/);
        if (match) dynamicPyip = match[1];
      }
      if (dynamicPyip) {
        const parsed = parseProxyIPList(dynamicPyip);
        if (parsed.length > 0) {
          proxyPool = parsed;
        }
      }

      // 1. WebSocket Proxy Handler
      if (upgradeHeader === "websocket") {
        return await vlessOverWSHandler(request, userID, proxyPool);
      }

      // 2. HTTP Request Routing
      const primaryUUID = userID.includes(",") ? userID.split(",")[0].trim() : userID;
      const isPages = !hostName.includes("workers.dev");

      // Normalize pathname
      const pathname = url.pathname.replace(/\/+$/, "") || "/";

      // Subscription & Dashboard routing
      const subPrefix = `/${primaryUUID}`;
      if (pathname === subPrefix) {
        // Dashboard HTML
        const html = getDashboardHTML(userID, hostName, proxyPool, request.cf);
        return new Response(html, {
          status: 200,
          headers: { "Content-Type": "text/html;charset=utf-8" },
        });
      }

      // Universal Dynamic Subscription endpoint: /:uuid/sub
      if (pathname === `${subPrefix}/sub`) {
        return handleDynamicSubscription(request, url, userID, hostName, isPages, proxyPool);
      }

      // Legacy subscription endpoints with dynamic parameter support
      if (pathname === `${subPrefix}/ty`) {
        url.searchParams.set("format", "base64");
        return handleDynamicSubscription(request, url, userID, hostName, false, proxyPool);
      }
      if (pathname === `${subPrefix}/pty`) {
        url.searchParams.set("format", "base64");
        url.searchParams.set("tls", "1");
        return handleDynamicSubscription(request, url, userID, hostName, true, proxyPool);
      }
      if (pathname === `${subPrefix}/cl`) {
        url.searchParams.set("format", "clash");
        return handleDynamicSubscription(request, url, userID, hostName, false, proxyPool);
      }
      if (pathname === `${subPrefix}/pcl`) {
        url.searchParams.set("format", "clash");
        url.searchParams.set("tls", "1");
        return handleDynamicSubscription(request, url, userID, hostName, true, proxyPool);
      }
      if (pathname === `${subPrefix}/sb`) {
        url.searchParams.set("format", "singbox");
        return handleDynamicSubscription(request, url, userID, hostName, false, proxyPool);
      }
      if (pathname === `${subPrefix}/psb`) {
        url.searchParams.set("format", "singbox");
        url.searchParams.set("tls", "1");
        return handleDynamicSubscription(request, url, userID, hostName, true, proxyPool);
      }

      // Default Disguise Response: Return CF metadata
      return new Response(JSON.stringify(request.cf || {}, null, 2), {
        status: 200,
        headers: { "Content-Type": "application/json;charset=utf-8" },
      });
    } catch (err) {
      return new Response(`Error: ${err.message || err.toString()}`, { status: 500 });
    }
  },
};

/**
 * Handle dynamic subscription generation based on query parameters & User-Agent
 */
function handleDynamicSubscription(request, url, userID, hostName, isPages, proxyPool) {
  const primaryUUID = userID.includes(",") ? userID.split(",")[0].trim() : userID;
  const userAgent = (request.headers.get("User-Agent") || "").toLowerCase();

  // Parse nodes from query or default
  const nodes = buildNodeList(url, hostName, isPages);

  // Format determination: query param -> User-Agent -> Base64
  let format = (url.searchParams.get("format") || url.searchParams.get("target") || "").toLowerCase();
  if (!format) {
    if (userAgent.includes("clash") || userAgent.includes("mihomo") || userAgent.includes("meta") || userAgent.includes("stash")) {
      format = "clash";
    } else if (userAgent.includes("sing-box") || userAgent.includes("singbox") || userAgent.includes("sfi") || userAgent.includes("sfa")) {
      format = "singbox";
    } else {
      format = "base64";
    }
  }

  const type = (url.searchParams.get("type") || "").toLowerCase();

  if (format === "clash" || format === "meta") {
    const yaml = generateClashConfig(nodes, primaryUUID, hostName, type === "provider");
    return new Response(yaml, {
      status: 200,
      headers: {
        "Content-Type": "text/yaml;charset=utf-8",
        "Subscription-Userinfo": "upload=0; download=0; total=1073741824000; expire=0",
        "Profile-Update-Interval": "24",
      },
    });
  }

  if (format === "singbox" || format === "sb") {
    const json = generateSingboxConfig(nodes, primaryUUID, hostName, type === "outbounds");
    return new Response(json, {
      status: 200,
      headers: {
        "Content-Type": "application/json;charset=utf-8",
        "Subscription-Userinfo": "upload=0; download=0; total=1073741824000; expire=0",
        "Profile-Update-Interval": "24",
      },
    });
  }

  // Base64 universal subscription
  const b64 = generateBase64Subscription(nodes, primaryUUID, hostName);
  return new Response(b64, {
    status: 200,
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
      "Subscription-Userinfo": "upload=0; download=0; total=1073741824000; expire=0",
      "Profile-Update-Interval": "24",
    },
  });
}

/**
 * Build dynamic node definitions from request URL parameters or defaults
 */
function buildNodeList(url, hostName, isPages) {
  const customIPs = url.searchParams.get("ip");
  const customPorts = url.searchParams.get("pt") || url.searchParams.get("port");
  const tlsParam = url.searchParams.get("tls"); // "1", "0", "all"
  const customHost = url.searchParams.get("host") || hostName;
  const customPyip = url.searchParams.get("pyip") || "";
  const namePrefix = url.searchParams.get("name") || "CF_VLESS";

  const pathBase = customPyip ? `/?ed=2560&pyip=${customPyip}` : `/?ed=2560`;

  // If user provided ?ip=...
  if (customIPs) {
    const ipList = customIPs.split(/[,;\s\n]+/).map((s) => s.trim()).filter(Boolean);
    const portList = customPorts ? customPorts.split(/[,;\s\n]+/).map((s) => s.trim()).filter(Boolean) : [];
    const nodes = [];

    ipList.forEach((ip, idx) => {
      let isTLS = true;
      if (tlsParam === "0" || tlsParam === "false") {
        isTLS = false;
      } else if (tlsParam === "1" || tlsParam === "true") {
        isTLS = true;
      } else {
        isTLS = !isPages;
      }

      let port = portList[idx] || (isTLS ? "443" : "80");
      if (ip.includes(":")) {
        const parts = ip.split(":");
        ip = parts[0];
        port = parts[1];
      }

      nodes.push({
        name: `${namePrefix}_${idx + 1}_${ip}_${port}`,
        ip,
        port: parseInt(port, 10),
        tls: isTLS,
        host: customHost,
        path: pathBase,
      });
    });
    return nodes;
  }

  // Use configured default nodes
  const nodes = [];
  const tlsFilter = tlsParam !== null ? (tlsParam === "1" || tlsParam === "true") : null;

  // Non-TLS nodes (ports 80系) - only if not Pages and not filtered to TLS only
  if (!isPages && (tlsFilter === null || tlsFilter === false)) {
    const nonTlsConfigs = [
      { ip: IP1, port: PT1 },
      { ip: IP2, port: PT2 },
      { ip: IP3, port: PT3 },
      { ip: IP4, port: PT4 },
      { ip: IP5, port: PT5 },
      { ip: IP6, port: PT6 },
      { ip: IP7, port: PT7 },
    ];
    nonTlsConfigs.forEach((c, idx) => {
      nodes.push({
        name: `${namePrefix}_HTTP_${idx + 1}_${c.ip}_${c.port}`,
        ip: c.ip,
        port: parseInt(c.port, 10),
        tls: false,
        host: customHost,
        path: pathBase,
      });
    });
  }

  // TLS nodes (ports 443系) - if not filtered to non-TLS only
  if (tlsFilter === null || tlsFilter === true) {
    const tlsConfigs = [
      { ip: IP8, port: PT8 },
      { ip: IP9, port: PT9 },
      { ip: IP10, port: PT10 },
      { ip: IP11, port: PT11 },
      { ip: IP12, port: PT12 },
      { ip: IP13, port: PT13 },
    ];
    tlsConfigs.forEach((c, idx) => {
      nodes.push({
        name: `${namePrefix}_TLS_${idx + 8}_${c.ip}_${c.port}`,
        ip: c.ip,
        port: parseInt(c.port, 10),
        tls: true,
        host: customHost,
        path: pathBase,
      });
    });
  }

  return nodes;
}

/**
 * Generate Base64 universal subscription string
 */
function generateBase64Subscription(nodes, userID, hostName) {
  const links = nodes.map((n) => {
    const security = n.tls ? "tls" : "none";
    const sni = n.tls ? `&sni=${n.host}` : "";
    const fp = n.tls ? `&fp=chrome` : "";
    return `vless://${userID}@${n.ip}:${n.port}?encryption=none&security=${security}${sni}${fp}&type=ws&host=${n.host}&path=${encodeURIComponent(n.path)}#${encodeURIComponent(n.name)}`;
  });
  return btoa(unescape(encodeURIComponent(links.join("\n"))));
}

/**
 * Generate Clash Meta / Mihomo configuration (YAML)
 */
function generateClashConfig(nodes, userID, hostName, providerOnly = false) {
  const proxiesYaml = nodes.map((n) => {
    return `  - name: "${n.name}"
    type: vless
    server: "${n.ip}"
    port: ${n.port}
    uuid: "${userID}"
    udp: true
    tls: ${n.tls}
    servername: "${n.host}"
    client-fingerprint: chrome
    skip-cert-verify: true
    network: ws
    ws-opts:
      path: "${n.path}"
      headers:
        Host: "${n.host}"`;
  }).join("\n\n");

  if (providerOnly) {
    return `proxies:\n${proxiesYaml}`;
  }

  const proxyNames = nodes.map((n) => `      - "${n.name}"`).join("\n");

  return `port: 7890
socks-port: 7891
mixed-port: 7892
allow-lan: true
mode: rule
log-level: info
unified-delay: true
global-client-fingerprint: chrome
dns:
  enable: true
  listen: :53
  ipv6: true
  enhanced-mode: fake-ip
  fake-ip-range: 198.18.0.1/16
  default-nameserver:
    - 223.5.5.5
    - 114.114.114.114
    - 8.8.8.8
  nameserver:
    - https://dns.alidns.com/dns-query
    - https://doh.pub/dns-query
  fallback:
    - https://1.0.0.1/dns-query
    - tls://dns.google

proxies:
${proxiesYaml}

proxy-groups:
  - name: 🚀 节点选择
    type: select
    proxies:
      - ⚡ 自动选择
      - 🔄 负载均衡
      - 🛡️ 故障转移
      - DIRECT
${proxyNames}

  - name: ⚡ 自动选择
    type: url-test
    url: https://www.gstatic.com/generate_204
    interval: 300
    tolerance: 50
    proxies:
${proxyNames}

  - name: 🔄 负载均衡
    type: load-balance
    url: https://www.gstatic.com/generate_204
    interval: 300
    proxies:
${proxyNames}

  - name: 🛡️ 故障转移
    type: fallback
    url: https://www.gstatic.com/generate_204
    interval: 300
    proxies:
${proxyNames}

rules:
  - GEOIP,LAN,DIRECT,no-resolve
  - GEOIP,CN,DIRECT
  - MATCH,🚀 节点选择
`;
}

/**
 * Generate Sing-box configuration (JSON)
 */
function generateSingboxConfig(nodes, userID, hostName, outboundsOnly = false) {
  const nodeOutbounds = nodes.map((n) => {
    const item = {
      tag: n.name,
      type: "vless",
      server: n.ip,
      server_port: n.port,
      uuid: userID,
      packet_encoding: "packetaddr",
      transport: {
        type: "ws",
        path: n.path,
        headers: {
          Host: [n.host],
        },
      },
    };
    if (n.tls) {
      item.tls = {
        enabled: true,
        server_name: n.host,
        insecure: true,
        utls: {
          enabled: true,
          fingerprint: "chrome",
        },
      };
    } else {
      item.tls = { enabled: false };
    }
    return item;
  });

  if (outboundsOnly) {
    return JSON.stringify(nodeOutbounds, null, 2);
  }

  const nodeTags = nodes.map((n) => n.name);

  const fullConfig = {
    log: {
      disabled: false,
      level: "info",
      timestamp: true,
    },
    dns: {
      servers: [
        { tag: "proxydns", address: "tls://8.8.8.8", detour: "select" },
        { tag: "localdns", address: "h3://223.5.5.5/dns-query", detour: "direct" },
        { tag: "dns_fakeip", address: "fakeip" },
      ],
      rules: [
        { outbound: "any", server: "localdns", disable_cache: true },
        { clash_mode: "Global", server: "proxydns" },
        { clash_mode: "Direct", server: "localdns" },
        { rule_set: "geosite-cn", server: "localdns" },
        { rule_set: "geosite-geolocation-!cn", server: "proxydns" },
        { rule_set: "geosite-geolocation-!cn", query_type: ["A", "AAAA"], server: "dns_fakeip" },
      ],
      fakeip: {
        enabled: true,
        inet4_range: "198.18.0.0/15",
        inet6_range: "fc00::/18",
      },
      independent_cache: true,
      final: "proxydns",
    },
    inbounds: [
      {
        type: "tun",
        tag: "tun-in",
        address: ["172.19.0.1/30", "fd00::1/126"],
        auto_route: true,
        strict_route: true,
        sniff: true,
        sniff_override_destination: true,
        domain_strategy: "prefer_ipv4",
      },
    ],
    outbounds: [
      {
        tag: "select",
        type: "selector",
        default: "auto",
        outbounds: ["auto", ...nodeTags, "direct"],
      },
      {
        tag: "auto",
        type: "urltest",
        outbounds: nodeTags,
        url: "https://www.gstatic.com/generate_204",
        interval: "1m",
        tolerance: 50,
      },
      ...nodeOutbounds,
      { tag: "direct", type: "direct" },
      { tag: "block", type: "block" },
      { tag: "dns-out", type: "dns" },
    ],
    route: {
      rule_set: [
        {
          tag: "geosite-geolocation-!cn",
          type: "remote",
          format: "binary",
          url: "https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@sing/geo/geosite/geolocation-!cn.srs",
          download_detour: "select",
          update_interval: "1d",
        },
        {
          tag: "geosite-cn",
          type: "remote",
          format: "binary",
          url: "https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@sing/geo/geosite/geolocation-cn.srs",
          download_detour: "select",
          update_interval: "1d",
        },
        {
          tag: "geoip-cn",
          type: "remote",
          format: "binary",
          url: "https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@sing/geo/geoip/cn.srs",
          download_detour: "select",
          update_interval: "1d",
        },
      ],
      auto_detect_interface: true,
      final: "select",
      rules: [
        { inbound: "tun-in", action: "sniff" },
        { protocol: "dns", action: "hijack-dns" },
        { port: 443, network: "udp", action: "reject" },
        { clash_mode: "Direct", outbound: "direct" },
        { clash_mode: "Global", outbound: "select" },
        { rule_set: "geoip-cn", outbound: "direct" },
        { rule_set: "geosite-cn", outbound: "direct" },
        { ip_is_private: true, outbound: "direct" },
        { rule_set: "geosite-geolocation-!cn", outbound: "select" },
      ],
    },
    ntp: {
      enabled: true,
      server: "time.apple.com",
      server_port: 123,
      interval: "30m",
      detour: "direct",
    },
  };

  return JSON.stringify(fullConfig, null, 2);
}

/**
 * WebSocket VLESS handler
 */
async function vlessOverWSHandler(request, userID, proxyPool) {
  const webSocketPair = new WebSocketPair();
  const [client, webSocket] = Object.values(webSocketPair);

  webSocket.accept();

  let address = "";
  let portWithRandomLog = "";
  const log = (info, event) => {
    console.log(`[${address}:${portWithRandomLog}] ${info}`, event || "");
  };

  const earlyDataHeader = request.headers.get("sec-websocket-protocol") || "";
  const readableWebSocketStream = makeReadableWebSocketStream(webSocket, earlyDataHeader, log);

  let remoteSocketWrapper = { value: null };
  let isDns = false;

  readableWebSocketStream
    .pipeTo(
      new WritableStream({
        async write(chunk, controller) {
          if (isDns) {
            return;
          }
          if (remoteSocketWrapper.value) {
            const writer = remoteSocketWrapper.value.writable.getWriter();
            await writer.write(chunk);
            writer.releaseLock();
            return;
          }

          const {
            hasError,
            message,
            portRemote = 443,
            addressRemote = "",
            rawDataIndex,
            vlessVersion = new Uint8Array([0, 0]),
            isUDP,
          } = await processVlessHeader(chunk, userID);

          address = addressRemote;
          portWithRandomLog = `${portRemote}--${Math.random()} ${isUDP ? "udp " : "tcp "} `;

          if (hasError) {
            log(`vless header error: ${message}`);
            safeCloseWebSocket(webSocket);
            controller.error(`vless header error: ${message}`);
            return;
          }

          if (isUDP) {
            if (portRemote === 53) {
              isDns = true;
            } else {
              controller.error("UDP proxy only enabled for DNS (port 53)");
              return;
            }
          }

          const vlessResponseHeader = new Uint8Array([vlessVersion[0], 0]);
          const rawClientData = chunk.slice(rawDataIndex);

          if (isDns) {
            return handleUDPOutBound(webSocket, vlessResponseHeader, log);
          }

          handleTCPOutBound(
            remoteSocketWrapper,
            addressRemote,
            portRemote,
            rawClientData,
            webSocket,
            vlessResponseHeader,
            log,
            proxyPool
          );
        },
        close() {
          log("readableWebSocketStream closed");
        },
        abort(reason) {
          log("readableWebSocketStream aborted", JSON.stringify(reason));
        },
      })
    )
    .catch((err) => {
      log("readableWebSocketStream pipe error", err);
    });

  return new Response(null, {
    status: 101,
    webSocket: client,
  });
}

/**
 * Handle TCP outbound with ProxyIP pool failover
 */
async function handleTCPOutBound(
  remoteSocket,
  addressRemote,
  portRemote,
  rawClientData,
  webSocket,
  vlessResponseHeader,
  log,
  proxyPool
) {
  async function connectAndWrite(address, port) {
    if (/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(address)) {
      address = `www.${address}.sslip.io`;
    }
    const tcpSocket = connect({
      hostname: address,
      port: port,
    });
    remoteSocket.value = tcpSocket;
    log(`connected to ${address}:${port}`);
    const writer = tcpSocket.writable.getWriter();
    await writer.write(rawClientData);
    writer.releaseLock();
    return tcpSocket;
  }

  async function retry() {
    if (!proxyPool || proxyPool.length === 0) {
      safeCloseWebSocket(webSocket);
      return;
    }
    const startIndex = Math.floor(Math.random() * proxyPool.length);
    let success = false;
    for (let i = 0; i < proxyPool.length; i++) {
      const idx = (startIndex + i) % proxyPool.length;
      const target = proxyPool[idx];
      try {
        log(`retrying via proxyIP [${idx + 1}/${proxyPool.length}]: ${target.host}:${target.port}`);
        const tcpSocket = await connectAndWrite(target.host, target.port);
        tcpSocket.closed
          .catch((error) => {
            log(`retry tcpSocket closed error: ${error.message || error}`);
          })
          .finally(() => {
            safeCloseWebSocket(webSocket);
          });
        remoteSocketToWS(tcpSocket, webSocket, vlessResponseHeader, null, log);
        success = true;
        break;
      } catch (err) {
        log(`retry failed for ${target.host}:${target.port}: ${err.message || err}`);
      }
    }
    if (!success) {
      log("all proxyIPs in pool failed");
      safeCloseWebSocket(webSocket);
    }
  }

  try {
    const tcpSocket = await connectAndWrite(addressRemote, portRemote);
    remoteSocketToWS(tcpSocket, webSocket, vlessResponseHeader, retry, log);
  } catch (err) {
    log(`initial connection failed: ${err.message || err}, triggering retry`);
    await retry();
  }
}

/**
 * Stream remote TCP socket data to WebSocket
 */
async function remoteSocketToWS(remoteSocket, webSocket, vlessResponseHeader, retry, log) {
  let vlessHeader = vlessResponseHeader;
  let hasIncomingData = false;

  await remoteSocket.readable
    .pipeTo(
      new WritableStream({
        async write(chunk, controller) {
          hasIncomingData = true;
          if (webSocket.readyState !== 1) {
            controller.error("webSocket is not open");
            return;
          }
          if (vlessHeader) {
            webSocket.send(await new Blob([vlessHeader, chunk]).arrayBuffer());
            vlessHeader = null;
          } else {
            webSocket.send(chunk);
          }
        },
        close() {
          log(`remote connection closed (hasData: ${hasIncomingData})`);
        },
        abort(reason) {
          log("remote connection aborted", reason);
        },
      })
    )
    .catch((error) => {
      log("remoteSocketToWS exception", error.stack || error);
      safeCloseWebSocket(webSocket);
    });

  if (hasIncomingData === false && retry) {
    log("no data received from remote socket, initiating proxy retry");
    retry().catch((err) => {
      log(`retry error: ${err.message || err}`);
      safeCloseWebSocket(webSocket);
    });
  }
}

/**
 * Handle UDP (DNS over HTTPS)
 */
async function handleUDPOutBound(webSocket, vlessResponseHeader, log) {
  let isHeaderSent = false;
  const transformStream = new TransformStream({
    async transform(chunk, controller) {
      for (let index = 0; index < chunk.byteLength; ) {
        const lengthBuffer = chunk.slice(index, index + 2);
        const udpPakcetLength = new DataView(lengthBuffer).getUint16(0);
        const udpData = new Uint8Array(chunk.slice(index + 2, index + 2 + udpPakcetLength));
        index = index + 2 + udpPakcetLength;
        controller.enqueue(udpData);
      }
    },
  });

  transformStream.readable
    .pipeTo(
      new WritableStream({
        async write(chunk) {
          const resp = await fetch(dohURL, {
            method: "POST",
            headers: { "content-type": "application/dns-message" },
            body: chunk,
          });
          const dnsQueryResult = await resp.arrayBuffer();
          const udpSize = dnsQueryResult.byteLength;
          const udpSizeBuffer = new Uint8Array([(udpSize >> 8) & 0xff, udpSize & 0xff]);
          if (webSocket.readyState === 1) {
            if (isHeaderSent) {
              webSocket.send(await new Blob([udpSizeBuffer, dnsQueryResult]).arrayBuffer());
            } else {
              webSocket.send(await new Blob([vlessResponseHeader, udpSizeBuffer, dnsQueryResult]).arrayBuffer());
              isHeaderSent = true;
            }
          }
        },
      })
    )
    .catch((error) => {
      log("dns udp error: " + error);
    });

  const writer = transformStream.writable.getWriter();
  return {
    write(chunk) {
      writer.write(chunk);
    },
  };
}

/**
 * Process and validate VLESS header
 */
async function processVlessHeader(vlessBuffer, userID) {
  if (vlessBuffer.byteLength < 24) {
    return { hasError: true, message: "invalid data length" };
  }
  const version = new Uint8Array(vlessBuffer.slice(0, 1));
  const slicedBuffer = new Uint8Array(vlessBuffer.slice(1, 17));
  const clientUUID = stringify(slicedBuffer);

  const allowedUUIDs = userID.split(",").map((u) => u.trim().toLowerCase());
  const isValidUser = allowedUUIDs.includes(clientUUID.toLowerCase());

  if (!isValidUser) {
    return { hasError: true, message: "invalid user" };
  }

  const optLength = new Uint8Array(vlessBuffer.slice(17, 18))[0];
  const command = new Uint8Array(vlessBuffer.slice(18 + optLength, 18 + optLength + 1))[0];

  let isUDP = false;
  if (command === 1) {
    // TCP
  } else if (command === 2) {
    isUDP = true;
  } else {
    return { hasError: true, message: `command ${command} not supported` };
  }

  const portIndex = 18 + optLength + 1;
  const portBuffer = vlessBuffer.slice(portIndex, portIndex + 2);
  const portRemote = new DataView(portBuffer).getUint16(0);

  let addressIndex = portIndex + 2;
  const addressBuffer = new Uint8Array(vlessBuffer.slice(addressIndex, addressIndex + 1));
  const addressType = addressBuffer[0];
  let addressLength = 0;
  let addressValueIndex = addressIndex + 1;
  let addressValue = "";

  switch (addressType) {
    case 1:
      addressLength = 4;
      addressValue = new Uint8Array(vlessBuffer.slice(addressValueIndex, addressValueIndex + addressLength)).join(".");
      break;
    case 2:
      addressLength = new Uint8Array(vlessBuffer.slice(addressValueIndex, addressValueIndex + 1))[0];
      addressValueIndex += 1;
      addressValue = new TextDecoder().decode(vlessBuffer.slice(addressValueIndex, addressValueIndex + addressLength));
      break;
    case 3:
      addressLength = 16;
      const dataView = new DataView(vlessBuffer.slice(addressValueIndex, addressValueIndex + addressLength));
      const ipv6 = [];
      for (let i = 0; i < 8; i++) {
        ipv6.push(dataView.getUint16(i * 2).toString(16));
      }
      addressValue = ipv6.join(":");
      break;
    default:
      return { hasError: true, message: `invalid addressType: ${addressType}` };
  }

  return {
    hasError: false,
    addressRemote: addressValue,
    addressType,
    portRemote,
    rawDataIndex: addressValueIndex + addressLength,
    vlessVersion: version,
    isUDP,
  };
}

function makeReadableWebSocketStream(webSocketServer, earlyDataHeader, log) {
  let readableStreamCancel = false;
  return new ReadableStream({
    start(controller) {
      webSocketServer.addEventListener("message", (event) => {
        if (readableStreamCancel) return;
        controller.enqueue(event.data);
      });
      webSocketServer.addEventListener("close", () => {
        safeCloseWebSocket(webSocketServer);
        if (readableStreamCancel) return;
        controller.close();
      });
      webSocketServer.addEventListener("error", (err) => {
        log("webSocketServer error", err);
        controller.error(err);
      });
      const { earlyData, error } = base64ToArrayBuffer(earlyDataHeader);
      if (error) {
        controller.error(error);
      } else if (earlyData) {
        controller.enqueue(earlyData);
      }
    },
    pull(controller) {},
    cancel(reason) {
      if (readableStreamCancel) return;
      log(`ReadableStream canceled: ${reason}`);
      readableStreamCancel = true;
      safeCloseWebSocket(webSocketServer);
    },
  });
}

function base64ToArrayBuffer(base64Str) {
  if (!base64Str) return { earlyData: null, error: null };
  try {
    base64Str = base64Str.replace(/-/g, "+").replace(/_/g, "/");
    const decode = atob(base64Str);
    const arbuf = Uint8Array.from(decode, (c) => c.charCodeAt(0));
    return { earlyData: arbuf.buffer, error: null };
  } catch (error) {
    return { earlyData: null, error };
  }
}

function safeCloseWebSocket(socket) {
  try {
    if (socket.readyState === 1 || socket.readyState === 2) {
      socket.close();
    }
  } catch (error) {
    console.error("safeCloseWebSocket error", error);
  }
}

const byteToHex = [];
for (let i = 0; i < 256; ++i) {
  byteToHex.push((i + 256).toString(16).slice(1));
}

function stringify(arr, offset = 0) {
  return (
    byteToHex[arr[offset + 0]] +
    byteToHex[arr[offset + 1]] +
    byteToHex[arr[offset + 2]] +
    byteToHex[arr[offset + 3]] +
    "-" +
    byteToHex[arr[offset + 4]] +
    byteToHex[arr[offset + 5]] +
    "-" +
    byteToHex[arr[offset + 6]] +
    byteToHex[arr[offset + 7]] +
    "-" +
    byteToHex[arr[offset + 8]] +
    byteToHex[arr[offset + 9]] +
    "-" +
    byteToHex[arr[offset + 10]] +
    byteToHex[arr[offset + 11]] +
    byteToHex[arr[offset + 12]] +
    byteToHex[arr[offset + 13]] +
    byteToHex[arr[offset + 14]] +
    byteToHex[arr[offset + 15]]
  ).toLowerCase();
}

/**
 * Modern Interactive Web Dashboard
 */
function getDashboardHTML(userID, hostName, proxyPool, cfInfo = {}) {
  const primaryUUID = userID.includes(",") ? userID.split(",")[0].trim() : userID;
  const proxyPoolStr = proxyPool.map((p) => `${p.host}:${p.port}`).join(", ");
  const colo = cfInfo.colo || "Unknown";
  const country = cfInfo.country || "Unknown";
  const clientIP = cfInfo.clientIP || "";

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cloudflare VLESS 控制台 | 极速聚合订阅</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>
    :root {
      --bg-color: #0f172a;
      --card-bg: rgba(30, 41, 59, 0.7);
      --card-border: rgba(255, 255, 255, 0.1);
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --accent: #38bdf8;
      --accent-hover: #0ea5e9;
    }
    body {
      background: radial-gradient(circle at 50% 0%, #1e293b 0%, #0f172a 100%);
      color: var(--text-main);
      min-height: 100vh;
      font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
      padding-bottom: 50px;
    }
    .glass-card {
      background: var(--card-bg);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid var(--card-border);
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 24px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
    }
    .badge-colo {
      background: linear-gradient(135deg, #0ea5e9, #6366f1);
      padding: 6px 12px;
      border-radius: 8px;
      font-weight: 600;
    }
    .btn-gradient {
      background: linear-gradient(135deg, #0284c7, #2563eb);
      color: #fff;
      border: none;
      font-weight: 500;
      border-radius: 8px;
      transition: all 0.2s;
    }
    .btn-gradient:hover {
      background: linear-gradient(135deg, #0369a1, #1d4ed8);
      color: #fff;
      transform: translateY(-1px);
    }
    .code-box {
      background: rgba(15, 23, 42, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.08);
      padding: 12px 16px;
      border-radius: 8px;
      font-family: monospace;
      color: #38bdf8;
      word-break: break-all;
      font-size: 0.9rem;
    }
    .form-control, .form-select {
      background: rgba(15, 23, 42, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #f8fafc;
      border-radius: 8px;
    }
    .form-control:focus, .form-select:focus {
      background: rgba(15, 23, 42, 0.95);
      border-color: #38bdf8;
      color: #f8fafc;
      box-shadow: 0 0 0 0.25rem rgba(56, 189, 248, 0.25);
    }
    .nav-tabs .nav-link {
      color: var(--text-muted);
      border: none;
      border-bottom: 2px solid transparent;
      padding: 10px 20px;
    }
    .nav-tabs .nav-link.active {
      color: var(--accent);
      background: transparent;
      border-color: var(--accent);
      font-weight: 600;
    }
  </style>
</head>
<body>
<div class="container py-4">
  <!-- Header -->
  <div class="d-flex flex-wrap justify-content-between align-items-center mb-4">
    <div>
      <h2 class="fw-bold mb-1">🚀 Cloudflare VLESS 节点控制台</h2>
      <p class="text-secondary mb-0">原生 WebSocket 代理 · 智能多 ProxyIP 容灾池 · 动态优选订阅</p>
    </div>
    <div class="d-flex gap-2 mt-3 mt-md-0">
      <span class="badge-colo">CF 边缘数据中心: ${colo}</span>
      <span class="badge bg-secondary p-2">客户端: ${country} ${clientIP}</span>
    </div>
  </div>

  <!-- Server Info Card -->
  <div class="glass-card">
    <div class="row g-3">
      <div class="col-md-4">
        <label class="text-secondary small">当前节点域名 (Host)</label>
        <div class="code-box mt-1">${hostName}</div>
      </div>
      <div class="col-md-4">
        <label class="text-secondary small">用户 ID (UUID)</label>
        <div class="code-box mt-1">${primaryUUID}</div>
      </div>
      <div class="col-md-4">
        <label class="text-secondary small">ProxyIP 负载均衡容灾池</label>
        <div class="code-box mt-1 text-truncate" title="${proxyPoolStr}">${proxyPoolStr}</div>
      </div>
    </div>
  </div>

  <!-- Clean IP Customizer (Interactive) -->
  <div class="glass-card">
    <h4 class="fw-bold mb-3">🛠️ 动态优选 IP 与端口实时自定义</h4>
    <p class="text-secondary small">无需修改 Cloudflare 环境变量，直接在此输入优选 IP / 域名或自定义端口，一键动态生成客户端订阅与节点！</p>
    <div class="row g-3">
      <div class="col-md-5">
        <label class="form-label small text-secondary">自定义优选 IP / 域名 (逗号分隔)</label>
        <input type="text" id="customIP" class="form-control" placeholder="例: 104.16.0.0, 104.17.0.0, visa.cn" value="">
      </div>
      <div class="col-md-3">
        <label class="form-label small text-secondary">端口 (留空默认 443)</label>
        <input type="text" id="customPort" class="form-control" placeholder="例: 443, 8443, 2053" value="">
      </div>
      <div class="col-md-4">
        <label class="form-label small text-secondary">指定 ProxyIP (可选)</label>
        <input type="text" id="customPyip" class="form-control" placeholder="例: proxyip.oracle.fxxk.dedyn.io:443" value="">
      </div>
    </div>
    <div class="d-flex flex-wrap gap-2 mt-3">
      <button class="btn btn-gradient btn-sm" onclick="applyCustomization()">⚡ 更新订阅链接与节点</button>
      <button class="btn btn-outline-secondary btn-sm" onclick="setPreset('cf-official')">官方 IP (美国)</button>
      <button class="btn btn-outline-secondary btn-sm" onclick="setPreset('asia-cdn')">亚洲优选域名</button>
      <button class="btn btn-outline-secondary btn-sm" onclick="resetCustomization()">重置默认</button>
    </div>
  </div>

  <!-- Subscription Center -->
  <div class="glass-card">
    <h4 class="fw-bold mb-3">📦 一键订阅中心</h4>
    <div class="row g-3">
      <div class="col-md-6">
        <div class="p-3 rounded border border-secondary border-opacity-25 h-100">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <span class="fw-bold text-info">⚡ 聚合通用智能订阅 (推荐)</span>
            <span class="badge bg-primary">自动识别客户端</span>
          </div>
          <p class="text-secondary small mb-2">自动根据客户端 User-Agent 返回 Clash、Sing-box 或通用 Base64 配置。</p>
          <div class="code-box mb-2" id="subAuto">https://${hostName}/${primaryUUID}/sub</div>
          <div class="d-flex gap-2">
            <button class="btn btn-sm btn-gradient" onclick="copyText('subAuto')">复制链接</button>
            <button class="btn btn-sm btn-outline-light" onclick="showQR('subAuto', '聚合通用智能订阅')">二维码</button>
          </div>
        </div>
      </div>
      <div class="col-md-6">
        <div class="p-3 rounded border border-secondary border-opacity-25 h-100">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <span class="fw-bold text-warning">🐱 Clash Meta / Mihomo 订阅</span>
            <span class="badge bg-warning text-dark">YAML 配置</span>
          </div>
          <p class="text-secondary small mb-2">专为 Clash Verge Rev、Mihomo Party、Flclash 设计的高性能配置。</p>
          <div class="code-box mb-2" id="subClash">https://${hostName}/${primaryUUID}/cl</div>
          <div class="d-flex gap-2">
            <button class="btn btn-sm btn-gradient" onclick="copyText('subClash')">复制链接</button>
            <button class="btn btn-sm btn-outline-light" onclick="importClash()">导入 Clash</button>
            <button class="btn btn-sm btn-outline-light" onclick="showQR('subClash', 'Clash 订阅')">二维码</button>
          </div>
        </div>
      </div>
      <div class="col-md-6">
        <div class="p-3 rounded border border-secondary border-opacity-25 h-100">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <span class="fw-bold text-success">📦 Sing-box 订阅</span>
            <span class="badge bg-success">JSON 配置</span>
          </div>
          <p class="text-secondary small mb-2">兼容 Sing-box 1.8+ / 1.10+，含出站规则与分流规则集。</p>
          <div class="code-box mb-2" id="subSingbox">https://${hostName}/${primaryUUID}/sb</div>
          <div class="d-flex gap-2">
            <button class="btn btn-sm btn-gradient" onclick="copyText('subSingbox')">复制链接</button>
            <button class="btn btn-sm btn-outline-light" onclick="showQR('subSingbox', 'Sing-box 订阅')">二维码</button>
          </div>
        </div>
      </div>
      <div class="col-md-6">
        <div class="p-3 rounded border border-secondary border-opacity-25 h-100">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <span class="fw-bold text-primary">🌐 Base64 通用订阅</span>
            <span class="badge bg-secondary">V2Ray / 小火箭</span>
          </div>
          <p class="text-secondary small mb-2">适用于 v2rayN、v2rayNG、Shadowrocket、Karing、NekoBox 等客户端。</p>
          <div class="code-box mb-2" id="subBase64">https://${hostName}/${primaryUUID}/ty</div>
          <div class="d-flex gap-2">
            <button class="btn btn-sm btn-gradient" onclick="copyText('subBase64')">复制链接</button>
            <button class="btn btn-sm btn-outline-light" onclick="showQR('subBase64', '通用 Base64 订阅')">二维码</button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Single Node Quick Import -->
  <div class="glass-card">
    <h4 class="fw-bold mb-3">🔗 极速单节点链接</h4>
    <div class="row g-3">
      <div class="col-md-6">
        <label class="text-secondary small">VLESS + WS + TLS 节点 (安全加密，推荐)</label>
        <div class="code-box mt-1 mb-2" id="nodeTls">vless://${primaryUUID}@${CDNIP}:443?encryption=none&security=tls&sni=${hostName}&fp=chrome&type=ws&host=${hostName}&path=%2F%3Fed%3D2560#CF_VLESS_TLS_${hostName}</div>
        <div class="d-flex gap-2">
          <button class="btn btn-sm btn-gradient" onclick="copyText('nodeTls')">复制节点</button>
          <button class="btn btn-sm btn-outline-light" onclick="showQR('nodeTls', 'VLESS TLS 节点')">二维码</button>
        </div>
      </div>
      <div class="col-md-6">
        <label class="text-secondary small">VLESS + WS (80系非TLS，无视域名阻断)</label>
        <div class="code-box mt-1 mb-2" id="nodeHttp">vless://${primaryUUID}@${CDNIP}:8880?encryption=none&security=none&type=ws&host=${hostName}&path=%2F%3Fed%3D2560#CF_VLESS_HTTP_${hostName}</div>
        <div class="d-flex gap-2">
          <button class="btn btn-sm btn-gradient" onclick="copyText('nodeHttp')">复制节点</button>
          <button class="btn btn-sm btn-outline-light" onclick="showQR('nodeHttp', 'VLESS 非TLS 节点')">二维码</button>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- QR Code Modal -->
<div class="modal fade" id="qrModal" tabindex="-1">
  <div class="modal-dialog modal-dialog-centered">
    <div class="modal-content glass-card text-center">
      <div class="modal-header border-0 pb-0">
        <h5 class="modal-title fw-bold" id="qrModalTitle">二维码</h5>
        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
      </div>
      <div class="modal-body py-4">
        <div id="qrCodeContainer" class="d-flex justify-content-center p-3 bg-white rounded-3 mx-auto" style="width: 260px; height: 260px;"></div>
        <div class="small text-secondary mt-3" id="qrContentText"></div>
      </div>
    </div>
  </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>
<script>
const baseHost = "${hostName}";
const uuid = "${primaryUUID}";

function getQueryString() {
  const ip = document.getElementById('customIP').value.trim();
  const pt = document.getElementById('customPort').value.trim();
  const pyip = document.getElementById('customPyip').value.trim();
  const params = [];
  if (ip) params.push('ip=' + encodeURIComponent(ip));
  if (pt) params.push('pt=' + encodeURIComponent(pt));
  if (pyip) params.push('pyip=' + encodeURIComponent(pyip));
  return params.length ? '?' + params.join('&') : '';
}

function applyCustomization() {
  const qs = getQueryString();
  document.getElementById('subAuto').innerText = 'https://' + baseHost + '/' + uuid + '/sub' + qs;
  document.getElementById('subClash').innerText = 'https://' + baseHost + '/' + uuid + '/cl' + qs;
  document.getElementById('subSingbox').innerText = 'https://' + baseHost + '/' + uuid + '/sb' + qs;
  document.getElementById('subBase64').innerText = 'https://' + baseHost + '/' + uuid + '/ty' + qs;

  const ip = document.getElementById('customIP').value.trim().split(/[,;\\s]+/)[0] || '${CDNIP}';
  const pt = document.getElementById('customPort').value.trim().split(/[,;\\s]+/)[0] || '443';
  const pyip = document.getElementById('customPyip').value.trim();
  const path = pyip ? '/?ed=2560&pyip=' + encodeURIComponent(pyip) : '/?ed=2560';

  document.getElementById('nodeTls').innerText = 'vless://' + uuid + '@' + ip + ':' + pt + '?encryption=none&security=tls&sni=' + baseHost + '&fp=chrome&type=ws&host=' + baseHost + '&path=' + encodeURIComponent(path) + '#CF_VLESS_CUSTOM_' + ip;
  alert('已成功生成自定义参数订阅与节点！');
}

function setPreset(type) {
  if (type === 'cf-official') {
    document.getElementById('customIP').value = '104.16.0.0, 104.17.0.0, 104.18.0.0';
    document.getElementById('customPort').value = '443';
  } else if (type === 'asia-cdn') {
    document.getElementById('customIP').value = 'www.visa.com.sg, www.visa.com.tw, myanmar.visa.com';
    document.getElementById('customPort').value = '443';
  }
  applyCustomization();
}

function resetCustomization() {
  document.getElementById('customIP').value = '';
  document.getElementById('customPort').value = '';
  document.getElementById('customPyip').value = '';
  applyCustomization();
}

function copyText(id) {
  const text = document.getElementById(id).innerText;
  navigator.clipboard.writeText(text).then(() => {
    alert('已复制到剪贴板！');
  }).catch(() => {
    prompt('请手动复制链接：', text);
  });
}

function importClash() {
  const subUrl = document.getElementById('subClash').innerText;
  window.location.href = 'clash://install-config?url=' + encodeURIComponent(subUrl);
}

let qrInstance = null;
function showQR(id, title) {
  const text = document.getElementById(id).innerText;
  document.getElementById('qrModalTitle').innerText = title;
  document.getElementById('qrContentText').innerText = text.length > 60 ? text.substring(0, 60) + '...' : text;
  const container = document.getElementById('qrCodeContainer');
  container.innerHTML = '';

  if (window.QRCode) {
    qrInstance = new QRCode(container, {
      text: text,
      width: 240,
      height: 240,
      colorDark: '#0f172a',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M
    });
  } else {
    container.innerHTML = '<img src=\"https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=' + encodeURIComponent(text) + '\" style=\"width:240px;height:240px;\" />';
  }
  new bootstrap.Modal(document.getElementById('qrModal')).show();
}
</script>
</body>
</html>`;
}
