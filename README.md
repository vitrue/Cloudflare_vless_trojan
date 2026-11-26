# Cloudflare-workers/pages 代理脚本 (Enhanced v2.5.0)

> 基于 Cloudflare Workers & Pages 的轻量、高可用 VLESS 与 Trojan 原生代理脚本。
> 集成 **智能多 ProxyIP 容灾池**、**全功能动态订阅引擎 (支持 URL 参数实时优选)**、**现代化交互控制台** 与 **双协议合一架构**。

---

## 🌟 核心特色与重大功能升级 (v2.5)

1. **🛡️ 智能多 ProxyIP 容灾池 (告别 1101 报错)**:
   - 支持同时配置多个 ProxyIP / 域名 / IPv6 地址（逗号/分号/换行分隔）。
   - 自动轮询与负载均衡；当单个 ProxyIP 节点离线或目标受阻时，**自动毫秒级故障转移与重试**，全面解决 Cloudflare 网站与 ChatGPT 等服务的出口限制。
2. **📦 全功能动态订阅引擎 (URL 实时定制)**:
   - **智能 User-Agent 识别**: 访问 `/:uuid/sub` 单个链接即可根据客户端（Clash / Sing-box / V2Ray / 小火箭 / Karing）自动返回对应格式配置。
   - **免改环境变量动态定制**: 支持直接在订阅链接后追加参数：
     - `?ip=104.16.0.0,104.17.0.0,visa.cn`：指定自定义优选 IP 或测速结果。
     - `?pt=443,8443`：指定自定义端口。
     - `?tls=1` / `?tls=0`：过滤 TLS 或非 TLS 节点。
     - `?pyip=xxx:443`：指定特定节点中转 ProxyIP。
     - `?type=provider`：生成专供 Clash Proxy Provider 引用的纯节点列表。
     - `?type=outbounds`：生成专供 Sing-box 嵌入的 Outbounds JSON 数组。
3. **⚡ 双协议合一 Worker (Unified Dual-Protocol)**:
   - 新增 `Unified_workers_pages/` 模块，单个 Worker 代码内同时监听与自动识别 VLESS 和 Trojan 数据包，客户端自由选择。
4. **🖥️ 现代化交互式 Web 控制台**:
   - 炫酷深色 Glassmorphism 控制台，显示 CF 边缘节点（Colo）、客户端地区与 IP。
   - 内置 **动态优选参数计算器**，输入优选 IP 即可实时预览节点、复制定制订阅并 **一键生成离线纯 SVG 二维码** 供移动端扫码导入。
5. **🛠️ 本地极速编译与混淆工具**:
   - 提供 `npm run build`，秒级将源码编译为体积仅 70KB 左右的防扫描混淆脚本。
6. **🚀 优选 IP 测速脚本升级 (`cf/cf.sh`)**:
   - 内置多个国内外镜像加速源下载依赖，避免 GitHub raw 被墙导致下载失败。
   - 支持自定义测速端口、延迟优选与真实带宽下载测速，并直接生成可直接粘贴的 `?ip=...` 订阅参数。

---

## 一、部署方案选择

| 目录 | 协议模式 | 适用场景 | 部署代码 |
| :--- | :--- | :--- | :--- |
| **`Vless_workers_pages/`** | 纯 VLESS 协议 | 经典主流，性能卓越 | `_worker.js` (直接粘贴) 或 `vless源码.js` (DIY) |
| **`Trojan_workers_pages/`** | 纯 Trojan 协议 | 原生 Trojan 协议客户端兼容 | `_worker.js` (直接粘贴) 或 `trojan源码.js` (DIY) |
| **`Unified_workers_pages/`** | **VLESS + Trojan 双协议** | 单 Worker 同时支持两种协议 | `_worker.js` (直接粘贴) 或 `unified源码.js` (DIY) |

---

## 二、环境变量配置说明 (Cloudflare后台 Variables)

在 Cloudflare Workers 或 Pages 后台的 **设置 (Settings) -> 变量 (Variables)** 中添加：

### 1. 通用核心变量

| 变量名称 | 作用 | 格式要求 | 默认值 / 示例 |
| :--- | :--- | :--- | :--- |
| **`uuid`** | VLESS 认证用户 ID | 标准 UUID 格式（支持多个以英文逗号分隔） | `86c50e3a-5b87-49dd-bd20-03c7f2735e40` |
| **`pswd`** | Trojan 认证密码 | 字符串（支持多个以英文逗号分隔） | `trojan` |
| **`proxyip`** | **ProxyIP 容灾池 (核心)** | 支持多个 IPv4、IPv6、域名及自定义端口（以逗号 `,` 分隔） | `proxyip.aliyun.fxxk.dedyn.io:443, proxyip.oracle.fxxk.dedyn.io:443` |
| **`cdnip`** | 默认单节点优选域名 | 域名或 IP | `www.visa.com.sg` |

> [!TIP]
> **多 ProxyIP 容灾池格式**:
> `proxyip` 现已支持配置多个以逗号分隔，如：`8.220.194.243:443, [2001:db8::1]:443, my-proxy.example.com`。当其中一个故障时，脚本会自动尝试下一个，确保连接不中断。

### 2. 默认优选节点变量 (可选，支持 13 个预设端口)

- `ip1` ~ `ip7`：HTTP 80 系列非 TLS 节点的默认地址（`pt1` ~ `pt7` 为对应端口，默认 80、8080、8880、2052、2082、2086、2095）。
- `ip8` ~ `ip13`：HTTPS 443 系列 TLS 节点的默认地址（`pt8` ~ `pt13` 为对应端口，默认 443、8443、2053、2083、2087、2096）。

---

## 三、动态订阅与链接使用指南

部署完成后，在浏览器访问你的域名控制台：
- **VLESS 控制台**: `https://你的域名/你的UUID`
- **Trojan 控制台**: `https://你的域名/你的密码`

### 1. 订阅链接接口

| 接口地址 | 说明 | 兼容客户端 |
| :--- | :--- | :--- |
| **`/:auth/sub`** | **🔥 智能动态聚合订阅 (推荐)** | 自动识别 Clash / Sing-box / V2Ray / 小火箭 / Karing |
| **`/:auth/cl`** | Clash Meta / Mihomo 专用订阅 | Clash Verge Rev, Mihomo Party, Flclash |
| **`/:auth/sb`** | Sing-box 专用 JSON 订阅 | Sing-box 1.8+, GUI.for.SingBox, SFI, SFA |
| **`/:auth/ty`** | 通用 Base64 分享订阅 | Shadowrocket, v2rayN, v2rayNG, NekoBox |
| **`/:auth/pcl`** | Pages 专用 TLS Clash 订阅 | 仅保留 6 个 443 系 TLS 节点 |
| **`/:auth/psb`** | Pages 专用 TLS Sing-box 订阅 | 仅保留 6 个 443 系 TLS 节点 |
| **`/:auth/pty`** | Pages 专用 TLS Base64 订阅 | 仅保留 6 个 443 系 TLS 节点 |

### 2. URL 动态查询参数 (无需修改 CF 变量即可换节点)

任何订阅链接均可在末尾追加以下参数自定义生成内容：

```text
# 示例 1: 指定测速得到的 3 个最佳 IP，使用 443 端口
https://xxx.workers.dev/你的UUID/sub?ip=104.16.1.1,104.17.2.2,visa.cn&pt=443

# 示例 2: 强制输出 Clash 格式，且只保留 TLS 节点
https://xxx.workers.dev/你的UUID/sub?format=clash&tls=1

# 示例 3: 生成纯 Clash 节点列表 (Proxy Provider 模式)
https://xxx.workers.dev/你的UUID/cl?type=provider

# 示例 4: 单独为某个订阅指定专属 ProxyIP
https://xxx.workers.dev/你的UUID/sub?pyip=my-vps.com:443
```

---

## 四、本地 IP 优选测速工具 (`cf/cf.sh`)

在本地终端（Linux / macOS / Android Termux / iOS iSH）中运行智能测速脚本：

```bash
# 智能测速与优选 IP 一键脚本
curl -sSL https://raw.githubusercontent.com/vitrue/Cloudflare_vless_trojan/main/cf/cf.sh -o cf.sh && chmod +x cf.sh && bash cf.sh
```

**功能特色**:
- 自动适配 Linux 架构（amd64, arm64, 386, arm, mips 等）。
- 内置国内加速镜像源，避免下载二进制文件失败。
- 支持 **443、8443、2053、80** 等任意指定端口测试。
- 测速完成后直接在屏幕输出形如 `?ip=104.x.x.x,104.y.y.y&pt=443` 的参数，直接复制粘贴到你的订阅链接后即可使用！

---

## 五、开发者编译与混淆 (`npm run build`)

本项目源码已做模块化解耦，若你自行修改了 `vless源码.js`、`trojan源码.js` 或 `unified源码.js`，可以使用内置构建脚本快速生成部署文件：

```bash
# 安装依赖
bun install # 或 npm install

# 一键编译并混淆所有 Worker (生成 _worker.js)
bun run build # 或 npm run build
```

构建脚本会自动将源码优化并混淆为标准 Cloudflare Workers 部署包，防止部署时被关键词规则拦截。

---

## 六、推荐客户端支持

- **Windows**: [Clash Verge Rev](https://github.com/clash-verge-rev/clash-verge-rev)、[v2rayN](https://github.com/2dust/v2rayN)、[Mihomo Party](https://github.com/mihomo-party-org/mihomo-party)
- **Android**: [v2rayNG](https://github.com/2dust/v2rayNG)、[NekoBox](https://github.com/MatsuriDayo/NekoBoxForAndroid)、[Karing](https://github.com/KaringX/karing)
- **iOS / iPadOS**: [Shadowrocket (小火箭)](https://apps.apple.com/app/shadowrocket/id932747118)、[Sing-box](https://github.com/SagerNet/sing-box)、[Karing](https://github.com/KaringX/karing)
- **macOS**: [Clash Verge Rev](https://github.com/clash-verge-rev/clash-verge-rev)、[Mihomo Party](https://github.com/mihomo-party-org/mihomo-party)

---

### 致谢与开源协议
- 原作者与社区灵感来源：[yonggekkk](https://github.com/yonggekkk)、[ca110us](https://github.com/ca110us/epeius)、[emn178](https://github.com/emn178/js-sha256)、[3Kmfi6HP](https://github.com/3Kmfi6HP/EDtunnel)、[XIU2](https://github.com/XIU2/CloudflareSpeedTest)。
- 本项目遵循 MIT 协议开源。
