
let config = {
  global_direct: "DIRECT",
  global_proxy: "HK-LoadBalance",
  silence: true, // 是否静默运行，默认false
  cellular: "RULE", // 蜂窝数据下的模式，RULE代表规则模式，PROXY代表全局代理，DIRECT代表全局直连
  wifi: "RULE", // wifi下默认的模式
  all_direct: ["Frost","Frost_2.4G"], // 指定全局直连å的wifi名字
  all_proxy: [], // 指定全局代理的wifi名字
  whitelist: ["Adblock"],
};

const isLoon = typeof $loon !== "undefined";
const isSurge = typeof $httpClient !== "undefined" && !isLoon;

// load user prefs from box
const boxConfig = $persistentStore.read("surge_auto_policy");
if (boxConfig) {
  config = JSON.parse(boxConfig);
  config.silence = JSON.parse(config.silence);
  config.all_direct = listify(config.all_direct);
  config.all_proxy = listify(config.all_proxy);
  config.whitelist = listify(config.whitelist);
}

// get current decisions
let groups, ssid;
if (isSurge) {
  groups = Object.keys($surge.selectGroupDetails().groups);
  ssid = $network.wifi.ssid;
} else if (isLoon) {
  const conf = JSON.parse($config.getConfig());
  groups = conf.all_policy_groups;
  ssid = conf.ssid;
}

manager()
  .catch((err) => {
    notify.post("🤖️ SSID 自动策略", `❌ 出现错误`, err);
    console.log("ERROR: " + err);
  })
  .finally(() => {
    $done();
  });

async function manager() {
  // get current outbound mode
  const previousMode =
    $persistentStore.read("surge_auto_policy_mode") || "RULE";

  console.log(`Previous outbound mode: ${previousMode}`);

  // no network connection
  if (isSurge) {
    const v4_ip = $network.v4.primaryAddress;
    if (!config.silence && !v4_ip) {
      notify.post("🤖️ SSID 自动策略", "❌ 当前无网络", "");
      return;
    }
  }

  const targetMode = ssid ? getSSIDMode(ssid) : config.cellular;

  console.log(`Switch from mode ${previousMode} to ${targetMode}`);

  if (previousMode === "RULE" && targetMode !== "RULE") {
    // save decisions before executing switch
    saveDecisions();
    // execute policy switch
    for (let group of groups) {
      if (config.whitelist.indexOf(group) !== -1) continue;
      const decision =
        targetMode === "PROXY" ? config.global_proxy : config.global_direct;
      if (isSurge) {
        $surge.setSelectGroupPolicy(group, decision);
      } else if (isLoon) {
        $config.setSelectPolicy(group, decision);
      }
      console.log(`Switch Policy: ${group} ==> ${decision}`);
    }
  }
  if (previousMode !== "RULE" && targetMode === "RULE") {
    // load decisions
    restoreDecisions();
  }

  $persistentStore.write(targetMode, "surge_auto_policy_mode");
  if (!config.silence) {
    notify(
      "自动策略",
      `当前网络：${ssid ? ssid : "蜂窝数据"}`,
      `${isSurge ? "Surge" : "Loon"}已切换至${lookupOutbound(targetMode)}`
    );
  }
}

function saveDecisions() {
  // get current policy groups
  let decisions;
  if (isSurge) {
    decisions = $surge.selectGroupDetails().decisions;
  } else if (isLoon) {
    const conf = JSON.parse($config.getConfig());
    decisions = conf.policy_select;
  }
  for (let d of Object.keys(decisions)) {
    if (groups.indexOf(d) === -1) delete decisions[d];
  }
  $persistentStore.write(
    JSON.stringify(decisions),
    "surge_auto_policy_decisions"
  );
}

function restoreDecisions() {
  const decisions = JSON.parse(
    $persistentStore.read("surge_auto_policy_decisions")
  );
  for (let group of groups) {
    if (isSurge) {
      $surge.setSelectGroupPolicy(group, decisions[group]);
    } else if (isLoon) {
      $config.setSelectPolicy(group, decisions[group]);
    }
    console.log(`Restore Policy: ${group} ==> ${decisions[group]}`);
  }
}

function getSSIDMode(ssid) {
  const map = {};
  config.all_direct.forEach((id) => (map[id] = "DIRECT"));
  config.all_proxy.forEach((id) => (map[id] = "PROXY"));

  const matched = map[ssid];
  return matched ? matched : config.wifi;
}

function lookupOutbound(mode) {
  return {
    RULE: "RULE MODE",
    PROXY: "GOBAL MODE",
    DIRECT: "DIRECT MODE",
  }[mode];
}

function listify(str, sperator = ",") {
  return str.split(sperator).map((i) => i.trim());
}

function notify(title, subtitle, content) {
  const TIMESTAMP_KEY = "auto_policy_notified_time";
  const THROTTLE_TIME = 1 * 1000;
  const lastNotifiedTime = $persistentStore.read(TIMESTAMP_KEY);
  if (
    !lastNotifiedTime ||
    new Date().getTime() - lastNotifiedTime > THROTTLE_TIME
  ) {
    $persistentStore.write(new Date().getTime().toString(), TIMESTAMP_KEY);
    $notification.post(title, subtitle, content);
  }
}
