// 2020/11/22
// Javascript

const Group = $persistentStore.read('BiliArea_Policy') || '📺 DomesticMedia'; //Your blibli policy group name.
const CN = $persistentStore.read('BiliArea_CN') || 'DIRECT'; //Your China sub-policy name.
const TW = $persistentStore.read('BiliArea_TW') || '🇹🇼 sub-policy'; //Your Taiwan sub-policy name.
const HK = $persistentStore.read('BiliArea_HK') || '🇭🇰 sub-policy'; //Your HongKong sub-policy name.

var obj = JSON.parse($response.body).result || {};
obj = obj.title ? obj.title : obj.media && obj.media.title ? obj.media.title : ''


 const conf = JSON.parse($config.getConfig());
  groups = conf.all_policy_groups;

const current = groups[Group] || 'Policy error ⚠️'
const str = (() => {
	if (obj.match(/\u50c5[\u4e00-\u9fa5]+\u6e2f/)) {
		if (current != HK) return HK;
	} else if (obj.match(/\u50c5[\u4e00-\u9fa5]+\u53f0/)) {
		if (current != TW) return TW;
	} else if (current != CN) return CN;
})()

if (str && obj) {
	const change = $config.setSelectPolicy(Group, str);
	const notify = $persistentStore.read('BiliAreaNotify') === 'true';
	if (!notify) $notification.post(obj, ``, `${current}  =>  ${str}  =>  ${change?`🟢`:`🔴`}`);
	if (change) {
		$done(); //Kill the connection. Due to the characteristics of Surge, it will auto reconnect with the new policy.
	} else {
		$done({});
	}
} else {
	$done({});
}
