// Cloudflare Workers & Pages Dual-Protocol (VLESS + Trojan) Unified Proxy Script
// Enhanced Edition v2.5.0 with Dynamic Subscription Engine, Multi-ProxyIP Pool, and Modern Dashboard
// @ts-ignore
import { connect } from "cloudflare:sockets";

let userID = "86c50e3a-5b87-49dd-bd20-03c7f2735e40";
let Pswd = "trojan";

// Default fallback ProxyIP pool (IPv4 VPS & Reverse Proxies with SNI passthrough)
const defaultProxyIPs = [
  "proxyip.aliyun.fxxk.dedyn.io:443",
  "proxyip.oracle.fxxk.dedyn.io:443",
  "8.220.194.243:443",
  "64.181.227.82:443"
];

let CDNIP = "www.visa.com.sg";

// Default Clean IPs
let IP1 = "www.visa.com";
let IP2 = "cis.visa.com";
let IP3 = "africa.visa.com";
let IP4 = "www.visa.com.sg";
let IP5 = "www.visaeurope.at";
let IP6 = "www.visa.com.mt";
let IP7 = "qa.visamiddleeast.com";

let IP8 = "usa.visa.com";
let IP9 = "myanmar.visa.com";
let IP10 = "www.visa.com.tw";
let IP11 = "www.visaeurope.ch";
let IP12 = "www.visa.com.br";
let IP13 = "www.visasoutheast构建europe.com";

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

let validSha224Passwords = [];
const dohURL = "https://cloudflare-dns.com/dns-query";

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
  async fetch(request, env, ctx) {
    try {
      userID = env.uuid || env.UUID || userID;
      Pswd = env.pswd || env.PASSWORD || env.psw || Pswd;
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

      const passwords = Pswd.split(",").map((p) => p.trim()).filter(Boolean);
      validSha224Passwords = passwords.map((p) => sha256.sha224(p));

      let proxyPool = parseProxyIPList(env.proxyip || env.PROXYIP);
      if (proxyPool.length === 0) {
        proxyPool = parseProxyIPList(defaultProxyIPs.join(","));
      }

      const url = new URL(request.url);
      const hostName = request.headers.get("Host") || url.hostname;
      const upgradeHeader = request.headers.get("Upgrade");

      let dynamicPyip = url.searchParams.get("pyip") || url.searchParams.get("proxyip");
      if (!dynamicPyip && url.pathname.includes("/pyip=")) {
        const match = url.pathname.match(/\/pyip=([^/?]+)/);
        if (match) dynamicPyip = match[1];
      }
      if (dynamicPyip) {
        const parsed = parseProxyIPList(dynamicPyip);
        if (parsed.length > 0) proxyPool = parsed;
      }

      if (upgradeHeader === "websocket") {
        return await dualProtocolOverWSHandler(request, userID, proxyPool);
      }

      const primaryUUID = userID.includes(",") ? userID.split(",")[0].trim() : userID;
      const primaryPswd = passwords[0] || "trojan";
      const isPages = !hostName.includes("workers.dev");
      const pathname = url.pathname.replace(/\/+$/, "") || "/";

      // Match VLESS or Trojan path
      const isVlessPath = pathname.startsWith(`/${primaryUUID}`);
      const isTrojanPath = pathname.startsWith(`/${primaryPswd}`);

      if (pathname === `/${primaryUUID}` || pathname === `/${primaryPswd}` || pathname === "/dashboard") {
        const html = getUnifiedDashboardHTML(primaryUUID, primaryPswd, hostName, proxyPool, request.cf);
        return new Response(html, {
          status: 200,
          headers: { "Content-Type": "text/html;charset=utf-8" },
        });
      }

      if (isVlessPath || isTrojanPath) {
        const proto = isTrojanPath ? "trojan" : "vless";
        const authKey = isTrojanPath ? primaryPswd : primaryUUID;
        if (pathname.endsWith("/cl") || pathname.endsWith("/pcl")) url.searchParams.set("format", "clash");
        if (pathname.endsWith("/sb") || pathname.endsWith("/psb")) url.searchParams.set("format", "singbox");
        if (pathname.endsWith("/ty") || pathname.endsWith("/pty")) url.searchParams.set("format", "base64");
        if (pathname.endsWith("/pcl") || pathname.endsWith("/psb") || pathname.endsWith("/pty")) url.searchParams.set("tls", "1");
        return handleUnifiedSubscription(request, url, proto, authKey, hostName, isPages, proxyPool);
      }

      return new Response(JSON.stringify(request.cf || {}, null, 2), {
        status: 200,
        headers: { "Content-Type": "application/json;charset=utf-8" },
      });
    } catch (err) {
      return new Response(`Error: ${err.message || err.toString()}`, { status: 500 });
    }
  },
};

function handleUnifiedSubscription(request, url, protocol, authKey, hostName, isPages, proxyPool) {
  const userAgent = (request.headers.get("User-Agent") || "").toLowerCase();
  const nodes = buildNodeList(url, hostName, isPages, protocol);

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
    const yaml = generateClashConfig(nodes, protocol, authKey, hostName, type === "provider");
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
    const json = generateSingboxConfig(nodes, protocol, authKey, hostName, type === "outbounds");
    return new Response(json, {
      status: 200,
      headers: {
        "Content-Type": "application/json;charset=utf-8",
        "Subscription-Userinfo": "upload=0; download=0; total=1073741824000; expire=0",
        "Profile-Update-Interval": "24",
      },
    });
  }

  const b64 = generateBase64Subscription(nodes, protocol, authKey, hostName);
  return new Response(b64, {
    status: 200,
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
      "Subscription-Userinfo": "upload=0; download=0; total=1073741824000; expire=0",
      "Profile-Update-Interval": "24",
    },
  });
}

function buildNodeList(url, hostName, isPages, protocol) {
  const customIPs = url.searchParams.get("ip");
  const customPorts = url.searchParams.get("pt") || url.searchParams.get("port");
  const tlsParam = url.searchParams.get("tls");
  const customHost = url.searchParams.get("host") || hostName;
  const customPyip = url.searchParams.get("pyip") || "";
  const namePrefix = url.searchParams.get("name") || (protocol === "trojan" ? "CF_TROJAN" : "CF_VLESS");

  const pathBase = customPyip ? `/?ed=2560&pyip=${customPyip}` : `/?ed=2560`;

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

  const nodes = [];
  const tlsFilter = tlsParam !== null ? (tlsParam === "1" || tlsParam === "true") : null;

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

function generateBase64Subscription(nodes, protocol, authKey, hostName) {
  const links = nodes.map((n) => {
    const security = n.tls ? "tls" : "none";
    const sni = n.tls ? `&sni=${n.host}` : "";
    if (protocol === "trojan") {
      return `trojan://${authKey}@${n.ip}:${n.port}?security=${security}${sni}&type=ws&host=${n.host}&path=${encodeURIComponent(n.path)}#${encodeURIComponent(n.name)}`;
    }
    const fp = n.tls ? `&fp=chrome` : "";
    return `vless://${authKey}@${n.ip}:${n.port}?encryption=none&security=${security}${sni}${fp}&type=ws&host=${n.host}&path=${encodeURIComponent(n.path)}#${encodeURIComponent(n.name)}`;
  });
  return btoa(unescape(encodeURIComponent(links.join("\n"))));
}

function generateClashConfig(nodes, protocol, authKey, hostName, providerOnly = false) {
  const proxiesYaml = nodes.map((n) => {
    if (protocol === "trojan") {
      return `  - name: "${n.name}"
    type: trojan
    server: "${n.ip}"
    port: ${n.port}
    password: "${authKey}"
    udp: true
    sni: "${n.host}"
    skip-cert-verify: true
    network: ws
    ws-opts:
      path: "${n.path}"
      headers:
        Host: "${n.host}"`;
    }
    return `  - name: "${n.name}"
    type: vless
    server: "${n.ip}"
    port: ${n.port}
    uuid: "${authKey}"
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

  if (providerOnly) return `proxies:\n${proxiesYaml}`;

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

function generateSingboxConfig(nodes, protocol, authKey, hostName, outboundsOnly = false) {
  const nodeOutbounds = nodes.map((n) => {
    const item = {
      tag: n.name,
      type: protocol,
      server: n.ip,
      server_port: n.port,
      transport: {
        type: "ws",
        path: n.path,
        headers: { Host: [n.host] },
      },
    };
    if (protocol === "trojan") {
      item.password = authKey;
    } else {
      item.uuid = authKey;
      item.packet_encoding = "packetaddr";
    }
    if (n.tls) {
      item.tls = {
        enabled: true,
        server_name: n.host,
        insecure: true,
        utls: { enabled: true, fingerprint: "chrome" },
      };
    } else {
      item.tls = { enabled: false };
    }
    return item;
  });

  if (outboundsOnly) return JSON.stringify(nodeOutbounds, null, 2);

  const nodeTags = nodes.map((n) => n.name);

  const fullConfig = {
    log: { disabled: false, level: "info", timestamp: true },
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
      fakeip: { enabled: true, inet4_range: "198.18.0.0/15", inet6_range: "fc00::/18" },
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
      { tag: "select", type: "selector", default: "auto", outbounds: ["auto", ...nodeTags, "direct"] },
      { tag: "auto", type: "urltest", outbounds: nodeTags, url: "https://www.gstatic.com/generate_204", interval: "1m", tolerance: 50 },
      ...nodeOutbounds,
      { tag: "direct", type: "direct" },
      { tag: "block", type: "block" },
      { tag: "dns-out", type: "dns" },
    ],
    route: {
      rule_set: [
        { tag: "geosite-geolocation-!cn", type: "remote", format: "binary", url: "https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@sing/geo/geosite/geolocation-!cn.srs", download_detour: "select", update_interval: "1d" },
        { tag: "geosite-cn", type: "remote", format: "binary", url: "https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@sing/geo/geosite/geolocation-cn.srs", download_detour: "select", update_interval: "1d" },
        { tag: "geoip-cn", type: "remote", format: "binary", url: "https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@sing/geo/geoip/cn.srs", download_detour: "select", update_interval: "1d" },
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
    ntp: { enabled: true, server: "time.apple.com", server_port: 123, interval: "30m", detour: "direct" },
  };

  return JSON.stringify(fullConfig, null, 2);
}

/**
 * Dual-Protocol WebSocket handler: automatically detects VLESS or Trojan packet
 */
async function dualProtocolOverWSHandler(request, userID, proxyPool) {
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
  let detectedProtocol = null;
  let isDns = false;

  readableWebSocketStream
    .pipeTo(
      new WritableStream({
        async write(chunk, controller) {
          if (isDns) return;
          if (remoteSocketWrapper.value) {
            const writer = remoteSocketWrapper.value.writable.getWriter();
            await writer.write(chunk);
            writer.releaseLock();
            return;
          }

          // Inspect first chunk to determine if Trojan or VLESS
          const view8 = new Uint8Array(chunk);
          if (chunk.byteLength >= 58 && view8[56] === 0x0d && view8[57] === 0x0a) {
            detectedProtocol = "trojan";
          } else {
            detectedProtocol = "vless";
          }

          if (detectedProtocol === "trojan") {
            const { hasError, message, portRemote = 443, addressRemote = "", rawClientData } = await parseTrojanHeader(chunk);
            address = addressRemote;
            portWithRandomLog = `${portRemote}--${Math.random()}`;
            if (hasError) {
              log(`trojan error: ${message}`);
              safeCloseWebSocket(webSocket);
              controller.error(message);
              return;
            }
            handleOutBound(remoteSocketWrapper, addressRemote, portRemote, rawClientData, webSocket, null, log, proxyPool, false);
          } else {
            const { hasError, message, portRemote = 443, addressRemote = "", rawDataIndex, vlessVersion = new Uint8Array([0, 0]), isUDP } = await processVlessHeader(chunk, userID);
            address = addressRemote;
            portWithRandomLog = `${portRemote}--${Math.random()} ${isUDP ? "udp " : "tcp "}`;
            if (hasError) {
              log(`vless error: ${message}`);
              safeCloseWebSocket(webSocket);
              controller.error(message);
              return;
            }
            if (isUDP) {
              if (portRemote === 53) {
                isDns = true;
                return handleUDPOutBound(webSocket, new Uint8Array([vlessVersion[0], 0]), log);
              }
              controller.error("UDP proxy only enabled for DNS");
              return;
            }
            const rawClientData = chunk.slice(rawDataIndex);
            handleOutBound(remoteSocketWrapper, addressRemote, portRemote, rawClientData, webSocket, new Uint8Array([vlessVersion[0], 0]), log, proxyPool, true);
          }
        },
        close() { log("readableWebSocketStream closed"); },
        abort(reason) { log("readableWebSocketStream aborted", reason); },
      })
    )
    .catch((err) => { log("pipe error", err); });

  return new Response(null, { status: 101, webSocket: client });
}

async function handleOutBound(remoteSocket, addressRemote, portRemote, rawClientData, webSocket, header, log, proxyPool, isVless) {
  async function connectAndWrite(address, port) {
    if (/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(address)) {
      address = `www.${address}.sslip.io`;
    }
    const tcpSocket = connect({ hostname: address, port });
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
        tcpSocket.closed.catch(() => {}).finally(() => safeCloseWebSocket(webSocket));
        pipeSocketToWS(tcpSocket, webSocket, header, null, log, isVless);
        success = true;
        break;
      } catch (err) {
        log(`retry failed for ${target.host}:${target.port}: ${err.message || err}`);
      }
    }
    if (!success) safeCloseWebSocket(webSocket);
  }

  try {
    const tcpSocket = await connectAndWrite(addressRemote, portRemote);
    pipeSocketToWS(tcpSocket, webSocket, header, retry, log, isVless);
  } catch (err) {
    log(`initial connect failed, retrying: ${err.message || err}`);
    await retry();
  }
}

async function pipeSocketToWS(remoteSocket, webSocket, initialHeader, retry, log, isVless) {
  let header = initialHeader;
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
          if (isVless && header) {
            webSocket.send(await new Blob([header, chunk]).arrayBuffer());
            header = null;
          } else {
            webSocket.send(chunk);
          }
        },
        close() { log(`remote connection closed`); },
        abort(reason) { log("remote connection aborted", reason); },
      })
    )
    .catch((error) => {
      log("pipeSocketToWS error", error.stack || error);
      safeCloseWebSocket(webSocket);
    });

  if (!hasIncomingData && retry) {
    log("no incoming data, triggering proxy retry");
    retry().catch(() => safeCloseWebSocket(webSocket));
  }
}

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
    .catch((error) => log("dns udp error: " + error));

  const writer = transformStream.writable.getWriter();
  return { write(chunk) { writer.write(chunk); } };
}

async function processVlessHeader(vlessBuffer, userID) {
  if (vlessBuffer.byteLength < 24) return { hasError: true, message: "invalid length" };
  const version = new Uint8Array(vlessBuffer.slice(0, 1));
  const slicedBuffer = new Uint8Array(vlessBuffer.slice(1, 17));
  const clientUUID = stringify(slicedBuffer);
  const allowedUUIDs = userID.split(",").map((u) => u.trim().toLowerCase());
  if (!allowedUUIDs.includes(clientUUID.toLowerCase())) {
    return { hasError: true, message: "invalid user" };
  }
  const optLength = new Uint8Array(vlessBuffer.slice(17, 18))[0];
  const command = new Uint8Array(vlessBuffer.slice(18 + optLength, 18 + optLength + 1))[0];
  let isUDP = command === 2;
  const portIndex = 18 + optLength + 1;
  const portBuffer = vlessBuffer.slice(portIndex, portIndex + 2);
  const portRemote = new DataView(portBuffer).getUint16(0);
  let addressIndex = portIndex + 2;
  const addressType = new Uint8Array(vlessBuffer.slice(addressIndex, addressIndex + 1))[0];
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
      for (let i = 0; i < 8; i++) ipv6.push(dataView.getUint16(i * 2).toString(16));
      addressValue = ipv6.join(":");
      break;
    default:
      return { hasError: true, message: `invalid addressType: ${addressType}` };
  }

  return {
    hasError: false,
    addressRemote: addressValue,
    portRemote,
    rawDataIndex: addressValueIndex + addressLength,
    vlessVersion: version,
    isUDP,
  };
}

async function parseTrojanHeader(buffer) {
  if (buffer.byteLength < 56) return { hasError: true, message: "invalid data" };
  const crLfIndex = 56;
  const view8 = new Uint8Array(buffer);
  if (view8[56] !== 0x0d || view8[57] !== 0x0a) {
    return { hasError: true, message: "missing CR LF" };
  }
  const passwordHex = new TextDecoder().decode(buffer.slice(0, crLfIndex));
  if (!validSha224Passwords.includes(passwordHex.toLowerCase())) {
    return { hasError: true, message: "invalid password" };
  }
  const socks5DataBuffer = buffer.slice(crLfIndex + 2);
  if (socks5DataBuffer.byteLength < 6) return { hasError: true, message: "invalid socks5" };
  const view = new DataView(socks5DataBuffer);
  if (view.getUint8(0) !== 1) return { hasError: true, message: "only TCP CONNECT" };
  const atype = view.getUint8(1);
  let addressLength = 0, addressIndex = 2, address = "";
  switch (atype) {
    case 1:
      addressLength = 4;
      address = new Uint8Array(socks5DataBuffer.slice(addressIndex, addressIndex + addressLength)).join(".");
      break;
    case 3:
      addressLength = new Uint8Array(socks5DataBuffer.slice(addressIndex, addressIndex + 1))[0];
      addressIndex += 1;
      address = new TextDecoder().decode(socks5DataBuffer.slice(addressIndex, addressIndex + addressLength));
      break;
    case 4:
      addressLength = 16;
      const dataView = new DataView(socks5DataBuffer.slice(addressIndex, addressIndex + addressLength));
      const ipv6 = [];
      for (let i = 0; i < 8; i++) ipv6.push(dataView.getUint16(i * 2).toString(16));
      address = ipv6.join(":");
      break;
    default:
      return { hasError: true, message: `invalid atype: ${atype}` };
  }
  const portIndex = addressIndex + addressLength;
  const port = new DataView(socks5DataBuffer.slice(portIndex, portIndex + 2)).getUint16(0);
  const rawClientData = socks5DataBuffer.slice(portIndex + 4);
  return { hasError: false, addressRemote: address, portRemote: port, rawClientData };
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
    if (socket.readyState === 1 || socket.readyState === 2) socket.close();
  } catch (error) {}
}

const byteToHex = [];
for (let i = 0; i < 256; ++i) byteToHex.push((i + 256).toString(16).slice(1));
function stringify(arr, offset = 0) {
  return (
    byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + "-" +
    byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + "-" +
    byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + "-" +
    byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + "-" +
    byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]
  ).toLowerCase();
}

function getUnifiedDashboardHTML(uuid, password, hostName, proxyPool, cfInfo = {}) {
  const proxyPoolStr = proxyPool.map((p) => `${p.host}:${p.port}`).join(", ");
  const colo = cfInfo.colo || "Unknown";
  const country = cfInfo.country || "Unknown";
  const clientIP = cfInfo.clientIP || "";

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cloudflare 双协议 (VLESS + Trojan) 控制台</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>
    :root {
      --bg-color: #0f172a;
      --card-bg: rgba(30, 41, 59, 0.7);
      --card-border: rgba(255, 255, 255, 0.1);
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --accent: #38bdf8;
    }
    body {
      background: radial-gradient(circle at 50% 0%, #1e293b 0%, #0f172a 100%);
      color: var(--text-main);
      min-height: 100vh;
      font-family: system-ui, -apple-system, sans-serif;
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
    }
    .badge-colo {
      background: linear-gradient(135deg, #0ea5e9, #8b5cf6);
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
    }
    .btn-gradient:hover { color: #fff; opacity: 0.95; }
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
    .form-control {
      background: rgba(15, 23, 42, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #f8fafc;
      border-radius: 8px;
    }
  </style>
</head>
<body>
<div class="container py-4">
  <div class="d-flex flex-wrap justify-content-between align-items-center mb-4">
    <div>
      <h2 class="fw-bold mb-1">⚡ Cloudflare 双协议 (VLESS + Trojan) 控制台</h2>
      <p class="text-secondary mb-0">单 Worker 同时支持 VLESS 与 Trojan 双客户端接入 · 智能 ProxyIP 容灾池</p>
    </div>
    <div class="d-flex gap-2 mt-3 mt-md-0">
      <span class="badge-colo">CF 边缘数据中心: ${colo}</span>
      <span class="badge bg-secondary p-2">客户端: ${country} ${clientIP}</span>
    </div>
  </div>

  <div class="glass-card">
    <div class="row g-3">
      <div class="col-md-3">
        <label class="text-secondary small">当前节点域名 (Host)</label>
        <div class="code-box mt-1">${hostName}</div>
      </div>
      <div class="col-md-3">
        <label class="text-secondary small">VLESS 用户 ID (UUID)</label>
        <div class="code-box mt-1">${uuid}</div>
      </div>
      <div class="col-md-3">
        <label class="text-secondary small">Trojan 密码 (Password)</label>
        <div class="code-box mt-1">${password}</div>
      </div>
      <div class="col-md-3">
        <label class="text-secondary small">ProxyIP 容灾池</label>
        <div class="code-box mt-1 text-truncate" title="${proxyPoolStr}">${proxyPoolStr}</div>
      </div>
    </div>
  </div>

  <div class="glass-card">
    <h4 class="fw-bold mb-3">🛠️ 动态优选 IP 与端口实时自定义</h4>
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
      <button class="btn btn-gradient btn-sm" onclick="applyCustomization()">⚡ 更新所有订阅与节点</button>
      <button class="btn btn-outline-secondary btn-sm" onclick="setPreset('cf-official')">官方 IP (美国)</button>
      <button class="btn btn-outline-secondary btn-sm" onclick="setPreset('asia-cdn')">亚洲优选域名</button>
      <button class="btn btn-outline-secondary btn-sm" onclick="resetCustomization()">重置默认</button>
    </div>
  </div>

  <div class="glass-card">
    <h4 class="fw-bold mb-3">📦 双协议一键订阅中心</h4>
    <div class="row g-3">
      <div class="col-md-6">
        <div class="p-3 rounded border border-secondary border-opacity-25 h-100">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <span class="fw-bold text-info">🚀 VLESS 智能订阅 (Clash / Sing-box / 通用)</span>
            <span class="badge bg-primary">VLESS</span>
          </div>
          <div class="code-box mb-2" id="subVless">https://${hostName}/${uuid}/sub</div>
          <div class="d-flex gap-2">
            <button class="btn btn-sm btn-gradient" onclick="copyText('subVless')">复制链接</button>
            <button class="btn btn-sm btn-outline-light" onclick="showQR('subVless', 'VLESS 订阅')">二维码</button>
          </div>
        </div>
      </div>
      <div class="col-md-6">
        <div class="p-3 rounded border border-secondary border-opacity-25 h-100">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <span class="fw-bold text-warning">🛡️ Trojan 智能订阅 (Clash / Sing-box / 通用)</span>
            <span class="badge bg-warning text-dark">Trojan</span>
          </div>
          <div class="code-box mb-2" id="subTrojan">https://${hostName}/${password}/sub</div>
          <div class="d-flex gap-2">
            <button class="btn btn-sm btn-gradient" onclick="copyText('subTrojan')">复制链接</button>
            <button class="btn btn-sm btn-outline-light" onclick="showQR('subTrojan', 'Trojan 订阅')">二维码</button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="glass-card">
    <h4 class="fw-bold mb-3">🔗 极速单节点链接</h4>
    <div class="row g-3">
      <div class="col-md-6">
        <label class="text-secondary small">VLESS + WS + TLS 节点</label>
        <div class="code-box mt-1 mb-2" id="nodeVless">vless://${uuid}@${CDNIP}:443?encryption=none&security=tls&sni=${hostName}&fp=chrome&type=ws&host=${hostName}&path=%2F%3Fed%3D2560#CF_VLESS_TLS_${hostName}</div>
        <button class="btn btn-sm btn-gradient" onclick="copyText('nodeVless')">复制 VLESS 节点</button>
      </div>
      <div class="col-md-6">
        <label class="text-secondary small">Trojan + WS + TLS 节点</label>
        <div class="code-box mt-1 mb-2" id="nodeTrojan">trojan://${password}@${CDNIP}:443?security=tls&sni=${hostName}&type=ws&host=${hostName}&path=%2F%3Fed%3D2560#CF_TROJAN_TLS_${hostName}</div>
        <button class="btn btn-sm btn-gradient" onclick="copyText('nodeTrojan')">复制 Trojan 节点</button>
      </div>
    </div>
  </div>
</div>

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
const uuid = "${uuid}";
const pswd = "${password}";

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
  document.getElementById('subVless').innerText = 'https://' + baseHost + '/' + uuid + '/sub' + qs;
  document.getElementById('subTrojan').innerText = 'https://' + baseHost + '/' + pswd + '/sub' + qs;

  const ip = document.getElementById('customIP').value.trim().split(/[,;\\s]+/)[0] || '${CDNIP}';
  const pt = document.getElementById('customPort').value.trim().split(/[,;\\s]+/)[0] || '443';
  const pyip = document.getElementById('customPyip').value.trim();
  const path = pyip ? '/?ed=2560&pyip=' + encodeURIComponent(pyip) : '/?ed=2560';

  document.getElementById('nodeVless').innerText = 'vless://' + uuid + '@' + ip + ':' + pt + '?encryption=none&security=tls&sni=' + baseHost + '&fp=chrome&type=ws&host=' + baseHost + '&path=' + encodeURIComponent(path) + '#CF_VLESS_CUSTOM_' + ip;
  document.getElementById('nodeTrojan').innerText = 'trojan://' + pswd + '@' + ip + ':' + pt + '?security=tls&sni=' + baseHost + '&type=ws&host=' + baseHost + '&path=' + encodeURIComponent(path) + '#CF_TROJAN_CUSTOM_' + ip;
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

function showQR(id, title) {
  const text = document.getElementById(id).innerText;
  document.getElementById('qrModalTitle').innerText = title;
  document.getElementById('qrContentText').innerText = text.length > 60 ? text.substring(0, 60) + '...' : text;
  const container = document.getElementById('qrCodeContainer');
  container.innerHTML = '';
  if (window.QRCode) {
    new QRCode(container, { text: text, width: 240, height: 240, colorDark: '#0f172a', colorLight: '#ffffff' });
  } else {
    container.innerHTML = '<img src=\"https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=' + encodeURIComponent(text) + '\" style=\"width:240px;height:240px;\" />';
  }
  new bootstrap.Modal(document.getElementById('qrModal')).show();
}
</script>
</body>
</html>`;
}

var sha256 = (function () {
  "use strict";
  var HEX_CHARS = "0123456789abcdef".split("");
  var EXTRA = [-2147483648, 8388608, 32768, 128];
  var SHIFT = [24, 16, 8, 0];
  var K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98,
    0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8,
    0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819,
    0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
    0xc67178f2,
  ];

  function Sha256(is224) { this.init(is224); }

  Sha256.prototype.init = function (is224) {
    if (is224) {
      this.h0 = 0xc1059ed8; this.h1 = 0x367cd507; this.h2 = 0x3070dd17; this.h3 = 0xf70e5939;
      this.h4 = 0xffc00b31; this.h5 = 0x68581511; this.h6 = 0x64f98fa7; this.h7 = 0xbefa4fa4;
    } else {
      this.h0 = 0x6a09e667; this.h1 = 0xbb67ae85; this.h2 = 0x3c6ef372; this.h3 = 0xa54ff53a;
      this.h4 = 0x510e527f; this.h5 = 0x9b05688c; this.h6 = 0x1f83d9ab; this.h7 = 0x5be0cd19;
    }
    this.block = this.start = this.bytes = this.hBytes = 0;
    this.finalized = this.hashed = false;
    this.is224 = is224;
    this.blocks = [];
  };

  Sha256.prototype.update = function (message) {
    if (this.finalized) return this;
    var notString = typeof message !== "string";
    if (notString && message.constructor === ArrayBuffer) message = new Uint8Array(message);
    var msgLength = message.length, blocks = this.blocks, byteNo = 0;
    while (byteNo < msgLength) {
      if (this.hashed) {
        this.hashed = false;
        blocks[0] = this.block;
        blocks[16] = blocks[1] = blocks[2] = blocks[3] = blocks[4] = blocks[5] = blocks[6] = blocks[7] = blocks[8] = blocks[9] = blocks[10] = blocks[11] = blocks[12] = blocks[13] = blocks[14] = blocks[15] = 0;
      }
      if (notString) {
        for (var i = this.start; byteNo < msgLength && i < 64; ++byteNo) blocks[i >> 2] |= message[byteNo] << SHIFT[i++ & 3];
      } else {
        for (var i = this.start; byteNo < msgLength && i < 64; ++byteNo) {
          var code = message.charCodeAt(byteNo);
          if (code < 0x80) blocks[i >> 2] |= code << SHIFT[i++ & 3];
          else if (code < 0x800) {
            blocks[i >> 2] |= (0xc0 | (code >> 6)) << SHIFT[i++ & 3];
            blocks[i >> 2] |= (0x80 | (code & 0x3f)) << SHIFT[i++ & 3];
          } else if (code < 0xd800 || code >= 0xe000) {
            blocks[i >> 2] |= (0xe0 | (code >> 12)) << SHIFT[i++ & 3];
            blocks[i >> 2] |= (0x80 | ((code >> 6) & 0x3f)) << SHIFT[i++ & 3];
            blocks[i >> 2] |= (0x80 | (code & 0x3f)) << SHIFT[i++ & 3];
          } else {
            code = 0x10000 + (((code & 0x3ff) << 10) | (message.charCodeAt(++byteNo) & 0x3ff));
            blocks[i >> 2] |= (0xf0 | (code >> 18)) << SHIFT[i++ & 3];
            blocks[i >> 2] |= (0x80 | ((code >> 12) & 0x3f)) << SHIFT[i++ & 3];
            blocks[i >> 2] |= (0x80 | ((code >> 6) & 0x3f)) << SHIFT[i++ & 3];
            blocks[i >> 2] |= (0x80 | (code & 0x3f)) << SHIFT[i++ & 3];
          }
        }
      }
      this.lastByteIndex = i;
      this.bytes += i - this.start;
      if (i >= 64) {
        this.block = blocks[16];
        this.start = i - 64;
        this.hash();
        this.hashed = true;
      } else {
        this.start = i;
      }
    }
    if (this.bytes > 4294967295) {
      this.hBytes += (this.bytes / 4294967296) << 0;
      this.bytes = this.bytes % 4294967296;
    }
    return this;
  };

  Sha256.prototype.finalize = function () {
    if (this.finalized) return;
    this.finalized = true;
    var blocks = this.blocks, i = this.lastByteIndex;
    blocks[16] = this.block;
    blocks[i >> 2] |= EXTRA[i & 3];
    this.block = blocks[16];
    if (i >= 56) {
      if (!this.hashed) this.hash();
      blocks[0] = this.block;
      blocks[16] = blocks[1] = blocks[2] = blocks[3] = blocks[4] = blocks[5] = blocks[6] = blocks[7] = blocks[8] = blocks[9] = blocks[10] = blocks[11] = blocks[12] = blocks[13] = blocks[14] = blocks[15] = 0;
    }
    blocks[14] = (this.hBytes << 3) | (this.bytes >>> 29);
    blocks[15] = this.bytes << 3;
    this.hash();
  };

  Sha256.prototype.hash = function () {
    var a = this.h0, b = this.h1, c = this.h2, d = this.h3, e = this.h4, f = this.h5, g = this.h6, h = this.h7;
    var w = this.blocks, j, s0, s1, maj, t1, t2, ch;
    for (j = 16; j < 64; ++j) {
      var v = w[j - 15];
      s0 = ((v >>> 7) | (v << 25)) ^ ((v >>> 18) | (v << 14)) ^ (v >>> 3);
      v = w[j - 2];
      s1 = ((v >>> 17) | (v << 15)) ^ ((v >>> 19) | (v << 13)) ^ (v >>> 10);
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) << 0;
    }
    for (j = 0; j < 64; j += 4) {
      for (var k = 0; k < 4; ++k) {
        var idx = j + k;
        s1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        ch = (e & f) ^ (~e & g);
        t1 = h + s1 + ch + K[idx] + w[idx];
        s0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        maj = (a & b) ^ (a & c) ^ (b & c);
        t2 = s0 + maj;
        h = g; g = f; f = e; e = (d + t1) << 0;
        d = c; c = b; b = a; a = (t1 + t2) << 0;
      }
    }
    this.h0 = (this.h0 + a) << 0; this.h1 = (this.h1 + b) << 0; this.h2 = (this.h2 + c) << 0; this.h3 = (this.h3 + d) << 0;
    this.h4 = (this.h4 + e) << 0; this.h5 = (this.h5 + f) << 0; this.h6 = (this.h6 + g) << 0; this.h7 = (this.h7 + h) << 0;
  };

  Sha256.prototype.hex = function () {
    this.finalize();
    var h0 = this.h0, h1 = this.h1, h2 = this.h2, h3 = this.h3, h4 = this.h4, h5 = this.h5, h6 = this.h6, h7 = this.h7;
    var hex = HEX_CHARS[(h0 >> 28) & 0x0f] + HEX_CHARS[(h0 >> 24) & 0x0f] + HEX_CHARS[(h0 >> 20) & 0x0f] + HEX_CHARS[(h0 >> 16) & 0x0f] +
              HEX_CHARS[(h0 >> 12) & 0x0f] + HEX_CHARS[(h0 >> 8) & 0x0f] + HEX_CHARS[(h0 >> 4) & 0x0f] + HEX_CHARS[h0 & 0x0f] +
              HEX_CHARS[(h1 >> 28) & 0x0f] + HEX_CHARS[(h1 >> 24) & 0x0f] + HEX_CHARS[(h1 >> 20) & 0x0f] + HEX_CHARS[(h1 >> 16) & 0x0f] +
              HEX_CHARS[(h1 >> 12) & 0x0f] + HEX_CHARS[(h1 >> 8) & 0x0f] + HEX_CHARS[(h1 >> 4) & 0x0f] + HEX_CHARS[h1 & 0x0f] +
              HEX_CHARS[(h2 >> 28) & 0x0f] + HEX_CHARS[(h2 >> 24) & 0x0f] + HEX_CHARS[(h2 >> 20) & 0x0f] + HEX_CHARS[(h2 >> 16) & 0x0f] +
              HEX_CHARS[(h2 >> 12) & 0x0f] + HEX_CHARS[(h2 >> 8) & 0x0f] + HEX_CHARS[(h2 >> 4) & 0x0f] + HEX_CHARS[h2 & 0x0f] +
              HEX_CHARS[(h3 >> 28) & 0x0f] + HEX_CHARS[(h3 >> 24) & 0x0f] + HEX_CHARS[(h3 >> 20) & 0x0f] + HEX_CHARS[(h3 >> 16) & 0x0f] +
              HEX_CHARS[(h3 >> 12) & 0x0f] + HEX_CHARS[(h3 >> 8) & 0x0f] + HEX_CHARS[(h3 >> 4) & 0x0f] + HEX_CHARS[h3 & 0x0f] +
              HEX_CHARS[(h4 >> 28) & 0x0f] + HEX_CHARS[(h4 >> 24) & 0x0f] + HEX_CHARS[(h4 >> 20) & 0x0f] + HEX_CHARS[(h4 >> 16) & 0x0f] +
              HEX_CHARS[(h4 >> 12) & 0x0f] + HEX_CHARS[(h4 >> 8) & 0x0f] + HEX_CHARS[(h4 >> 4) & 0x0f] + HEX_CHARS[h4 & 0x0f] +
              HEX_CHARS[(h5 >> 28) & 0x0f] + HEX_CHARS[(h5 >> 24) & 0x0f] + HEX_CHARS[(h5 >> 20) & 0x0f] + HEX_CHARS[(h5 >> 16) & 0x0f] +
              HEX_CHARS[(h5 >> 12) & 0x0f] + HEX_CHARS[(h5 >> 8) & 0x0f] + HEX_CHARS[(h5 >> 4) & 0x0f] + HEX_CHARS[h5 & 0x0f] +
              HEX_CHARS[(h6 >> 28) & 0x0f] + HEX_CHARS[(h6 >> 24) & 0x0f] + HEX_CHARS[(h6 >> 20) & 0x0f] + HEX_CHARS[(h6 >> 16) & 0x0f] +
              HEX_CHARS[(h6 >> 12) & 0x0f] + HEX_CHARS[(h6 >> 8) & 0x0f] + HEX_CHARS[(h6 >> 4) & 0x0f] + HEX_CHARS[h6 & 0x0f];
    if (!this.is224) {
      hex += HEX_CHARS[(h7 >> 28) & 0x0f] + HEX_CHARS[(h7 >> 24) & 0x0f] + HEX_CHARS[(h7 >> 20) & 0x0f] + HEX_CHARS[(h7 >> 16) & 0x0f] +
             HEX_CHARS[(h7 >> 12) & 0x0f] + HEX_CHARS[(h7 >> 8) & 0x0f] + HEX_CHARS[(h7 >> 4) & 0x0f] + HEX_CHARS[h7 & 0x0f];
    }
    return hex;
  };

  return {
    sha256: function (message) { return new Sha256(false).update(message).hex(); },
    sha224: function (message) { return new Sha256(true).update(message).hex(); },
  };
})();
