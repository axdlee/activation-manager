#!/usr/bin/env bash

set -euo pipefail

RUN_ID="${RUN_ID:-$(date +%s%N)}"
BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-123456}"
COOKIE_FILE="${COOKIE_FILE:-/tmp/activation-manager-cookie.txt}"
PROJECT_KEY="${PROJECT_KEY:-browser-plugin-${RUN_ID}}"
PROJECT_NAME="${PROJECT_NAME:-浏览器插件联调}"
MACHINE_ID="${MACHINE_ID:-machine-smoke-001}"
REQUEST_ID_1="${REQUEST_ID_1:-req-${RUN_ID}-001}"
REQUEST_ID_2="${REQUEST_ID_2:-req-${RUN_ID}-002}"

json_get() {
  local expression="$1"
  python3 -c "import json,sys; data=json.load(sys.stdin); print($expression)"
}

assert_json() {
  local json="$1"
  local expression="$2"
  local expected="$3"
  local actual
  actual="$(printf '%s' "$json" | json_get "$expression")"
  if [[ "$actual" != "$expected" ]]; then
    echo "断言失败: ${expression}，期望=${expected}，实际=${actual}" >&2
    exit 1
  fi
}

assert_json_expr() {
  local json="$1"
  local expression="$2"
  local expected="$3"
  local actual
  actual="$(printf '%s' "$json" | json_get "$expression")"
  if [[ "$actual" != "$expected" ]]; then
    echo "断言失败: ${expression}，期望=${expected}，实际=${actual}" >&2
    exit 1
  fi
}

echo "== 1. 管理员登录 =="
LOGIN_RESPONSE="$(curl -s -c "$COOKIE_FILE" -H "Content-Type: application/json" \
  -d "{\"username\":\"$ADMIN_USERNAME\",\"password\":\"$ADMIN_PASSWORD\"}" \
  "$BASE_URL/api/admin/login")"
echo "$LOGIN_RESPONSE"
assert_json "$LOGIN_RESPONSE" "data['success']" "True"

echo
echo "== 2. 创建项目 =="
PROJECT_RESPONSE="$(curl -s -b "$COOKIE_FILE" -H "Content-Type: application/json" \
  -d "{\"name\":\"$PROJECT_NAME\",\"projectKey\":\"$PROJECT_KEY\",\"description\":\"正式接口自动化联调项目\"}" \
  "$BASE_URL/api/admin/projects")"
echo "$PROJECT_RESPONSE"
assert_json "$PROJECT_RESPONSE" "data['success']" "True"

echo
echo "== 3. 生成次数型激活码 =="
GENERATE_RESPONSE="$(curl -s -b "$COOKIE_FILE" -H "Content-Type: application/json" \
  -d "{\"projectKey\":\"$PROJECT_KEY\",\"amount\":1,\"licenseMode\":\"COUNT\",\"totalCount\":2}" \
  "$BASE_URL/api/admin/codes/generate")"
echo "$GENERATE_RESPONSE"
assert_json "$GENERATE_RESPONSE" "data['success']" "True"
CODE="$(printf '%s' "$GENERATE_RESPONSE" | json_get "data['codes'][0]['code']")"
echo "生成的激活码: $CODE"

echo
echo "== 4. activate（绑定设备，不扣次） =="
ACTIVATE_RESPONSE="$(curl -s -H "Content-Type: application/json" \
  -d "{\"projectKey\":\"$PROJECT_KEY\",\"code\":\"$CODE\",\"machineId\":\"$MACHINE_ID\"}" \
  "$BASE_URL/api/license/activate")"
echo "$ACTIVATE_RESPONSE"
assert_json "$ACTIVATE_RESPONSE" "data['success']" "True"
assert_json "$ACTIVATE_RESPONSE" "data['remainingCount']" "2"

echo
echo "== 5. status（确认已激活且仍剩 2 次） =="
STATUS_RESPONSE="$(curl -s -H "Content-Type: application/json" \
  -d "{\"projectKey\":\"$PROJECT_KEY\",\"code\":\"$CODE\",\"machineId\":\"$MACHINE_ID\"}" \
  "$BASE_URL/api/license/status")"
echo "$STATUS_RESPONSE"
assert_json "$STATUS_RESPONSE" "data['success']" "True"
assert_json "$STATUS_RESPONSE" "data['isActivated']" "True"
assert_json "$STATUS_RESPONSE" "data['remainingCount']" "2"

echo
echo "== 6. consume req-001（第一次扣次） =="
CONSUME_RESPONSE_1="$(curl -s -H "Content-Type: application/json" \
  -d "{\"projectKey\":\"$PROJECT_KEY\",\"code\":\"$CODE\",\"machineId\":\"$MACHINE_ID\",\"requestId\":\"$REQUEST_ID_1\"}" \
  "$BASE_URL/api/license/consume")"
echo "$CONSUME_RESPONSE_1"
assert_json "$CONSUME_RESPONSE_1" "data['success']" "True"
assert_json "$CONSUME_RESPONSE_1" "data['remainingCount']" "1"
assert_json "$CONSUME_RESPONSE_1" "data['idempotent']" "False"

echo
echo "== 7. consume req-001（幂等重放，不重复扣次） =="
CONSUME_RESPONSE_2="$(curl -s -H "Content-Type: application/json" \
  -d "{\"projectKey\":\"$PROJECT_KEY\",\"code\":\"$CODE\",\"machineId\":\"$MACHINE_ID\",\"requestId\":\"$REQUEST_ID_1\"}" \
  "$BASE_URL/api/license/consume")"
echo "$CONSUME_RESPONSE_2"
assert_json "$CONSUME_RESPONSE_2" "data['success']" "True"
assert_json "$CONSUME_RESPONSE_2" "data['remainingCount']" "1"
assert_json "$CONSUME_RESPONSE_2" "data['idempotent']" "True"

echo
echo "== 8. consume req-002（第二次真实扣次） =="
CONSUME_RESPONSE_3="$(curl -s -H "Content-Type: application/json" \
  -d "{\"projectKey\":\"$PROJECT_KEY\",\"code\":\"$CODE\",\"machineId\":\"$MACHINE_ID\",\"requestId\":\"$REQUEST_ID_2\"}" \
  "$BASE_URL/api/license/consume")"
echo "$CONSUME_RESPONSE_3"
assert_json "$CONSUME_RESPONSE_3" "data['success']" "True"
assert_json "$CONSUME_RESPONSE_3" "data['remainingCount']" "0"
assert_json "$CONSUME_RESPONSE_3" "data['valid']" "False"

echo
echo "== 9. admin consumptions（验证后台消费日志） =="
CONSUMPTION_LOGS_RESPONSE="$(curl -s -b "$COOKIE_FILE" \
  "$BASE_URL/api/admin/consumptions?projectKey=$PROJECT_KEY")"
echo "$CONSUMPTION_LOGS_RESPONSE"
assert_json "$CONSUMPTION_LOGS_RESPONSE" "data['success']" "True"
assert_json "$CONSUMPTION_LOGS_RESPONSE" "len(data['logs'])" "2"
assert_json "$CONSUMPTION_LOGS_RESPONSE" "data['logs'][0]['requestId']" "$REQUEST_ID_2"
assert_json "$CONSUMPTION_LOGS_RESPONSE" "data['logs'][1]['requestId']" "$REQUEST_ID_1"

echo
echo "== 9.1 admin consumptions future range（验证时间范围筛选） =="
CONSUMPTION_RANGE_EMPTY_RESPONSE="$(curl -s -b "$COOKIE_FILE" \
  "$BASE_URL/api/admin/consumptions?projectKey=$PROJECT_KEY&createdFrom=2100-01-01T00:00:00.000Z")"
echo "$CONSUMPTION_RANGE_EMPTY_RESPONSE"
assert_json "$CONSUMPTION_RANGE_EMPTY_RESPONSE" "data['success']" "True"
assert_json "$CONSUMPTION_RANGE_EMPTY_RESPONSE" "len(data['logs'])" "0"

echo
echo "== 10. admin stats（验证项目级统计） =="
STATS_RESPONSE="$(curl -s -b "$COOKIE_FILE" \
  "$BASE_URL/api/admin/codes/stats")"
echo "$STATS_RESPONSE"
assert_json "$STATS_RESPONSE" "data['success']" "True"
assert_json_expr "$STATS_RESPONSE" "[item['projectKey'] for item in data['projectStats'] if item['projectKey'] == '$PROJECT_KEY'][0]" "$PROJECT_KEY"
assert_json_expr "$STATS_RESPONSE" "[item['countConsumedTotal'] for item in data['projectStats'] if item['projectKey'] == '$PROJECT_KEY'][0]" "2"
assert_json_expr "$STATS_RESPONSE" "[item['countRemainingTotal'] for item in data['projectStats'] if item['projectKey'] == '$PROJECT_KEY'][0]" "0"

echo
echo "== 11. admin consumptions export（验证 CSV 导出） =="
CONSUMPTION_EXPORT_RESPONSE="$(curl -s -b "$COOKIE_FILE" \
  "$BASE_URL/api/admin/consumptions/export?projectKey=$PROJECT_KEY&keyword=$REQUEST_ID_2&createdFrom=2000-01-01T00:00:00.000Z&createdTo=2100-01-01T00:00:00.000Z")"
echo "$CONSUMPTION_EXPORT_RESPONSE"
printf '%s' "$CONSUMPTION_EXPORT_RESPONSE" | grep -q "$PROJECT_KEY"
printf '%s' "$CONSUMPTION_EXPORT_RESPONSE" | grep -q "$REQUEST_ID_2"

echo
echo "✅ 联调通过"
echo "BASE_URL=$BASE_URL"
echo "PROJECT_KEY=$PROJECT_KEY"
echo "CODE=$CODE"
