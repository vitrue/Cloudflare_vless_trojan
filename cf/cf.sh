#!/bin/bash
export LANG=en_US.UTF-8

# Cloudflare 官方优选 IP 智能测速脚本 (增强加速版)
# 支持多镜像源自适应下载、自定义测试端口、真实下载测速与一键生成订阅参数

case "$(uname -m)" in
	x86_64 | x64 | amd64 )
		cpu=amd64
		;;
	i386 | i686 )
		cpu=386
		;;
	armv8 | armv8l | arm64 | aarch64 )
		cpu=arm64
		;;
	armv7l )
		cpu=arm
		;;
	mips64le )
		cpu=mips64le
		;;
	mips64 )
		cpu=mips64
		;;
	mips )
		cpu=mipsle
		;;
	mipsle )
		cpu=mipsle
		;;
	* )
		echo "当前架构为 $(uname -m)，暂不支持"
		exit 1
		;;
esac

# 智能多源下载函数 (含镜像加速)
download_file() {
	local file=$1
	local target=$2
	if [ -e "$target" ]; then
		return 0
	fi
	echo "正在下载 $file ..."
	urls=(
		"https://raw.githubusercontent.com/vitrue/Cloudflare_vless_trojan/main/cf/$file"
		"https://ghproxy.net/https://raw.githubusercontent.com/vitrue/Cloudflare_vless_trojan/main/cf/$file"
		"https://fastly.jsdelivr.net/gh/vitrue/Cloudflare_vless_trojan@main/cf/$file"
		"https://raw.githubusercontent.com/yonggekkk/Cloudflare_vless_trojan/main/cf/$file"
	)
	for url in "${urls[@]}"; do
		if curl -sSL -m 10 --connect-timeout 5 -o "$target" "$url" 2>/dev/null && [ -s "$target" ]; then
			echo "✅ 成功下载 $file"
			return 0
		fi
	done
	echo "❌ 下载 $file 失败，请检查网络连接！"
	return 1
}

result() {
	awk -F ',' '$2 ~ /BGI|YCC|YVR|YWG|YHZ|YOW|YYZ|YUL|YXE|STI|SDQ|GUA|KIN|GDL|MEX|QRO|SJU|MGM|ANC|PHX|LAX|SMF|SAN|SFO|SJC|DEN|JAX|MIA|TLH|TPA|ATL|HNL|ORD|IND|BGR|BOS|DTW|MSP|MCI|STL|OMA|LAS|EWR|ABQ|BUF|CLT|RDU|CLE|CMH|OKC|PDX|PHL|PIT|FSD|MEM|BNA|AUS|DFW|IAH|MFE|SAT|SLC|IAD|ORF|RIC|SEA/ {print $0}' $ip.csv | sort -t ',' -k5,5n | head -n 3 > US-$ip.csv
	awk -F ',' '$2 ~ /CGP|DAC|JSR|PBH|BWN|PNH|GUM|HKG|AMD|BLR|BBI|IXC|MAA|HYD|CNN|KNU|COK|CCU|BOM|NAG|DEL|PAT|DPS|CGK|JOG|FUK|OKA|KIX|NRT|ALA|NQZ|ICN|VTE|MFM|JHB|KUL|KCH|MLE|ULN|MDL|RGN|KTM|ISB|KHI|LHE|CGY|CEB|MNL|CRK|KJA|SVX|SIN|CMB|KHH|TPE|BKK|CNX|URT|TAS|DAD|HAN|SGN/ {print $0}' $ip.csv | sort -t ',' -k5,5n | head -n 3 > AS-$ip.csv
	awk -F ',' '$2 ~ /TIA|VIE|MSQ|BRU|SOF|ZAG|LCA|PRG|CPH|TLL|HEL|BOD|LYS|MRS|CDG|TBS|TXL|DUS|FRA|HAM|MUC|STR|ATH|SKG|BUD|KEF|ORK|DUB|MXP|PMO|FCO|RIX|VNO|LUX|KIV|AMS|SKP|OSL|WAW|LIS|OTP|DME|LED|KLD|BEG|BTS|BCN|MAD|GOT|ARN|GVA|ZRH|IST|ADB|KBP|EDI|LHR|MAN/ {print $0}' $ip.csv | sort -t ',' -k5,5n | head -n 3 > EU-$ip.csv
}

print_summary() {
	local ip_type=$1
	local csv_file="${ip_type}.csv"
	if [ -e "$csv_file" ]; then
		echo "=========================================================="
		echo "           🎯 IPV${ip_type} 优选结果与订阅参数"
		echo "=========================================================="
		echo "【亚洲 AS 优选 IP 前三名】:"
		cat "AS-${ip_type}.csv" 2>/dev/null
		echo
		echo "【美国 US 优选 IP 前三名】:"
		cat "US-${ip_type}.csv" 2>/dev/null
		echo
		echo "【欧洲 EU 优选 IP 前三名】:"
		cat "EU-${ip_type}.csv" 2>/dev/null
		echo

		# 提取前三名 IP 构建订阅参数
		top_ips=$(awk -F ',' '{print $1}' "AS-${ip_type}.csv" "US-${ip_type}.csv" 2>/dev/null | head -n 3 | paste -sd, -)
		if [ -n "$top_ips" ]; then
			echo "💡 一键订阅自定义参数 (可直接追加在订阅链接后):"
			echo "   ?ip=${top_ips}&pt=${test_port}"
			echo
		fi
	fi
}

echo "=========================================================="
echo "    Cloudflare Workers/Pages 官方 IP 智能优选测速工具"
echo "=========================================================="

if timeout 3 ping -c 2 2400:3200::1 &> /dev/null; then
	echo "🌐 本地网络支持: IPV4 + IPV6 双栈"
else
	echo "🌐 本地网络支持: 仅 IPV4"
fi

rm -rf 6.csv 4.csv US-*.csv AS-*.csv EU-*.csv

echo
echo "请选择测速类型:"
echo "1、仅 IPV4 延迟优选 (最快)"
echo "2、仅 IPV6 延迟优选"
echo "3、IPV4 + IPV6 双栈优选"
echo "4、IPV4 深度下载带宽测速 (测试实际网速)"
echo "5、清理缓存并重置配置"
echo "6、退出"
read -p "请输入序号 [1-6, 默认 1]: " menu
menu=${menu:-1}

if [ "$menu" = "6" ]; then
	exit 0
elif [ "$menu" = "5" ]; then
	rm -rf 6.csv 4.csv US-*.csv AS-*.csv EU-*.csv locations.json ips-v4.txt ips-v6.txt cf
	echo "✅ 已成功重置清理所有临时文件与二进制缓存"
	exit 0
fi

# 端口选择
echo
echo "请选择测速端口:"
echo "1、443 (默认 HTTPS 端口)"
echo "2、8443 (备用 HTTPS 端口)"
echo "3、2053 (备用 HTTPS 端口)"
echo "4、80 (非 TLS HTTP 端口)"
echo "5、自定义端口"
read -p "请输入端口序号 [1-5, 默认 1]: " port_choice
port_choice=${port_choice:-1}

case "$port_choice" in
	1 ) test_port=443 ;;
	2 ) test_port=8443 ;;
	3 ) test_port=2053 ;;
	4 ) test_port=80 ;;
	5 ) read -p "请输入自定义端口号: " test_port ;;
	* ) test_port=443 ;;
esac

# 检查并下载依赖文件
download_file "$cpu" "cf" || exit 1
chmod +x cf
download_file "locations.json" "locations.json" || exit 1
download_file "ips-v4.txt" "ips-v4.txt" || exit 1
download_file "ips-v6.txt" "ips-v6.txt" || exit 1

echo
echo "🚀 开始测速 (测试端口: $test_port)..."

if [ "$menu" = "1" ]; then
	ip=4
	./cf -ips 4 -port "$test_port" -outfile 4.csv
	result
elif [ "$menu" = "2" ]; then
	ip=6
	./cf -ips 6 -port "$test_port" -outfile 6.csv
	result
elif [ "$menu" = "3" ]; then
	ip=4
	./cf -ips 4 -port "$test_port" -outfile 4.csv
	result
	ip=6
	./cf -ips 6 -port "$test_port" -outfile 6.csv
	result
elif [ "$menu" = "4" ]; then
	ip=4
	echo "⏳ 正在执行 IPV4 真实下载速度测试 (需要少量流量)..."
	./cf -ips 4 -port "$test_port" -tp "$test_port" -dn 3 -outfile 4.csv
	result
fi

clear
print_summary 4
print_summary 6

if [ ! -e 4.csv ] && [ ! -e 6.csv ]; then
	echo "❌ 测速运行未生成有效数据，请检查网络权限或尝试关闭当前代理重试。"
fi
