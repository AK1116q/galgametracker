// Curated route facts, with independently checked sources in each pack.
// Run explicitly after reviewing sources; not a network scraper or game simulator.
import { mkdirSync, writeFileSync } from 'node:fs';
const root = new URL('../data/catalog/', import.meta.url);
mkdirSync(root, { recursive: true });
const D = (locator, prompt, options, extra = {}) => ({ locator, prompt, options, ...extra });
const S = (key, selection) => [key, selection];
const permission = '仅整理分支、前置和结局事实；中文提示自行概述，不转载攻略正文、图片或剧情。';
function build(id, title, aliases, sources, definitions, routes, notes = [], prerequisites = {}) {
  const pack = { schemaVersion:'0.1', id:`${id}-pc`, revision:1, synthetic:false, status:'source_checked',
    game:{id,title,aliases}, release:{id:`${id}-pc`,label:'PC / Steam 主线 · 中文含义提示',locale:'zh-CN'},
    notes:['从新游戏开始按目标路径连续选择；不覆盖 AFTER、差分 CG 或全成就。',
      '提示为中文概述，不是汉化补丁逐字原文；未核实选项排列顺序的节点不显示第几项。',
      '已按所列来源核对分支与前置，未实机通关；偏离路径后的结果不作推断。',...notes],
    sources:sources.map((reference,i)=>({id:`source-${i+1}`,kind:'public_reference',reference,permission})),
    routes:[],choices:[],endings:[],reviews:[] };
  for (const [key,label] of Object.entries(prerequisites)) pack.endings.push({id:key,safeLabel:label,hiddenTitle:label,spoilerLevel:1});
  for (const route of routes) {
    const [rid,label,steps,required=[]] = route;
    pack.routes.push({id:rid,safeLabel:label,entryChoiceId:`${rid}-01`,requiredEndingIds:required});
    pack.endings.push({id:`${rid}-end`,safeLabel:label,hiddenTitle:label,spoilerLevel:1});
    steps.forEach(([key,selected],i)=>{
      const def=definitions[key], cid=`${rid}-${String(i+1).padStart(2,'0')}`;
      const next=i+1===steps.length?{kind:'ending',id:`${rid}-end`}:{kind:'choice',id:`${rid}-${String(i+2).padStart(2,'0')}`};
      const node={id:cid,locator:def.locator,prompt:def.prompt,orderKnown:false,
        ...(def.kind?{kind:def.kind}:{}), ...(def.options.length===1&&def.kind!=='instruction'?{optionsComplete:false}:{}),
        options:def.options.map((text,j)=>({id:`option-${j+1}`,text,next:j===selected?next:{kind:'unknown',id:'off-path'}})),
        rules:[{routeId:rid,when:{all:[]},recommendedOptionIds:[`option-${selected+1}`],sourceId:'source-1',sourceLocator:`${label} / ${def.locator} / ${key}；与来源 2 对照`}]};
      if (def.optional && selected === 1) node.skipTo=next;
      pack.choices.push(node);
    });
  }
  pack.reviews.push({reviewer:'资料交叉核对（非实机）',date:'2026-09-18',routeIds:pack.routes.map(r=>r.id),method:'source_crosscheck',evidence:'逐项对照所列资料的主线选法、条件节点及解锁前置。差异处理见 notes 与 docs/catalog-research.md。'});
  writeFileSync(new URL(`${id}.route.json`,root),JSON.stringify(pack,null,2)+'\n');
}
const senren = {
  truth:D('共通线 · 回答问题','如何回答',['如实说明','含糊带过']),
  city:D('共通线 · 城市与乡村','对居住环境的看法',['暂时说不准','更喜欢城市']),
  cute:D('共通线 · 对穿着的评价','如何评价',['觉得很可爱','并不奇怪']),
  trip:D('共通线 · 外出安排','选择活动',['钓鱼','采野菜','独自行动']),
  fish:D('钓鱼分支','是否同意提议',['还是不行','这样的话可以']),
  thanks:D('共通线 · 致谢','表达感谢',['口头道谢','摸摸头']),
  trust:D('共通线 · 小春的话','如何回应',['相信小春','有些担心']),
  reassure:D('共通线 · 朝武','是否安慰她',['让朝武放心','避免多说奇怪的话']),
  sub:D('配角共通线','想起谁的笑容',['小春','芦花'])
};
const prefix=[S('truth',0),S('city',0),S('cute',0)];
const fish=[...prefix,S('trip',0),S('fish',0),S('thanks',0)];
build('senren-banka','千恋＊万花',['千恋万花','Senren Banka'],[
  'https://seiya-saiga.com/game/yuzu-soft/senrenbanka.html',
  'https://steamcommunity.com/sharedfiles/filedetails/?id=1997093244'
],senren,[
  ['yoshino','朝武芳乃',[...fish,S('trust',0),S('reassure',0)]],
  ['mako','常陆茉子',[...prefix,S('trip',1),S('thanks',0),S('trust',1),S('reassure',1)]],
  ['murasame','丛雨',[...prefix,S('trip',2),S('thanks',1),S('trust',1),S('reassure',1)]],
  ['lena','蕾娜',[...prefix,S('trip',0),S('fish',1),S('thanks',0),S('trust',1),S('reassure',1)]],
  ['koharu','鞍马小春',[...fish,S('trust',0),S('reassure',1),S('sub',0)],['main-completed']],
  ['roka','马庭芦花',[...fish,S('trust',0),S('reassure',1),S('sub',1)],['main-completed']],
  ['normal','通常结局',[...fish,S('trust',1),S('reassure',1)]]
],['小春、芦花需先完成任意一位主角路线；采野菜或独自行动后没有钓鱼分支选项。'],{'main-completed':'芳乃、茉子、丛雨、蕾娜中任意一条路线已通关'});

const riddle = {
  test:D('共通线 · 实验','接下来的实验',['继续与茉优实验','邀请七海']),
  swim:D('共通线 · 泳装','关注谁',['二条院','七海']),
  ask:D('追加选项 · 七海分支','是否追问话题',['询问下去','不提这个话题'],{optional:true}),
  praise:D('共通线 · 回应','是否重新表达',['不再多说','认真重新称赞']),
  advice:D('共通线 · 求助','去哪里询问',['学生会室找绫濑','研究室找茉优']),
  dorm:D('学生会室分支','选择宿舍',['照往常一样','换一个宿舍']),
  who:D('共通线 · 人选','想到谁',['茉优','二条院','壬生'])
};
const rbase=[S('test',0),S('swim',0),S('praise',0)];
const rchi=[S('test',0),S('swim',1),S('ask',0),S('praise',0)];
build('riddle-joker','RIDDLE JOKER',['RJ','谜语小丑'],[
  'https://seiya-saiga.com/game/yuzu-soft/riddlejoker.html',
  'https://steamcommunity.com/sharedfiles/filedetails/?id=2323376164'
],riddle,[
  ['ayase','三司绫濑',[...rbase,S('advice',0),S('dorm',0),S('who',0)]],
  ['nanami','在原七海',[S('test',1),S('swim',1),S('ask',1),S('praise',1),S('advice',0),S('dorm',1),S('who',0)]],
  ['hazuki','二条院羽月',[...rbase,S('advice',0),S('dorm',0),S('who',1)]],
  ['mayu','式部茉优',[...rbase,S('advice',1),S('who',0)]],
  ['chisaki','壬生千咲',[...rchi,S('advice',1),S('who',2)],['main-completed']],
  ['normal','通常结局（二周目选法）',[...rchi,S('advice',0),S('dorm',1),S('who',1)],['main-completed']]
],['七海路径中的追加问题在一周目不出现，直接继续下一步；二周目出现时选择不追问。',
  '千咲与此处通常结局选法需要先通关任意一条主角路线。通常结局保留资料中含追加选项的二周目路径，不推测一周目替代选法。',
  '部分转载称千咲需四线全通；原日文攻略和 Steam Chuee 均明确为任意一线，采用后者一致的条件。'],{'main-completed':'绫濑、七海、羽月、茉优中任意一条路线已通关'});

const sabbat = {
  praise:D('共通线 · 称赞','是否再说一次',['再次认真称赞','不再重复']),
  partner:D('共通线 · 练习搭档','选择搭档',['请宁宁帮忙','继续与爱瑠练习']),
  time:D('共通线 · 时间安排','如何安排',['调整时间','仍有些犹豫']),
  move:D('宁宁搭档分支 · 外出','接下来的安排',['与大家一起走','先去吃饭']),
  rehearse:D('爱瑠搭档分支 · 外出','回应这次安排',['当作一次排练']),
  maybe:D('共通线 · 回应猜测','如何回应',['也许是吧','并不是']),
  say:D('共通线 · 说法','如何表达',['直接说明','开个小玩笑']),
  honest:D('共通线 · 说明情况','是否坦白',['如实说出','含糊带过']),
  help:D('共通线 · 学习','是否请教',['先放下，换换心情','趁机会请教']),
  hand:D('共通线 · 握手','是否再请求一次',['请她再握一次','不好意思说出口']),
  look:D('共通线 · 目光','如何回应',['移开视线','称赞她']),
  final:D('共通线 · 最后选择','此时想到的人或事',['宁宁','爱瑠','憧子学姐','乐队']),
  restart:D('标题菜单 · RESTART','宁宁前篇通关后，返回标题菜单',['选择 RESTART，阅读至后半篇结局'],{kind:'instruction'})
};
const nene=[S('praise',0),S('partner',0),S('time',0),S('move',0),S('maybe',0),S('say',0),S('honest',0),S('help',0),S('hand',0),S('look',0)];
const meguru=[S('praise',0),S('partner',1),S('time',1),S('rehearse',0),S('maybe',1),S('say',0),S('honest',1),S('help',1),S('hand',1),S('look',1)];
build('sabbat-of-the-witch','魔女的夜宴',['Sabbat of the Witch','サノバウィッチ','魔宴'],[
  'https://seiya-saiga.com/game/yuzu-soft/sothewitch.html',
  'https://steamcommunity.com/sharedfiles/filedetails/?id=1546374480'
],sabbat,[
  ['nene','绫地宁宁 · 前篇',[...nene,S('final',0)]],
  ['nene-restart','绫地宁宁 · 后半篇',[S('restart',0)],['nene-end']],
  ['meguru','因幡爱瑠',[...meguru,S('final',1)]],
  ['tsumugi','椎叶䌷',[...nene,S('final',3)]],
  ['touko','户隐憧子',[...meguru,S('final',2)]],
  ['wakana','假屋和奏',[...nene.slice(0,3),S('move',1),S('maybe',0),S('say',1),S('honest',1),S('help',1)],['main-completed']],
  ['normal','通常结局',[...meguru,S('final',3)]]
],['以 PC / Steam 原版主线分歧为范围，不承诺 FHD 版成就流程。',
  '宁宁前篇后新增标题菜单 RESTART；后半篇的差分选择不改变主线结局，可自行选择。',
  '和奏需任意主角路线通关；若先攻略宁宁，需要读完 RESTART 后半篇。'],{'main-completed':'爱瑠、䌷、憧子或宁宁后半篇中任意一条已通关'});

const atri={
  keep:D('7月18日 · 市场','凯瑟琳提出带走亚托莉',['交给凯瑟琳','让亚托莉留在自己这里']),
  kiss:D('8月15日 · 夜晚','面对亚托莉',['静静看着她','亲吻她']),
  shoe:D('8月26日 · 前往学校','是否取回鞋子',['捡起鞋子','留在原处']),
  true:D('标题菜单 · TRUE END','完成前两个结局后返回标题菜单',['选择 TRUE END，阅读真结局'],{kind:'instruction'})
};
build('atri','ATRI -My Dear Moments-',['亚托莉','ATRI'],[
  'https://gameline.jp/atri/',
  'https://steamcommunity.com/sharedfiles/filedetails/?id=2134692491'
],atri,[
  ['good','Good / Normal Ending',[S('keep',1),S('kiss',1),S('shoe',0)]],
  ['bad','Bad Ending',[S('keep',1),S('kiss',1),S('shoe',1)]],
  ['true','True Ending',[S('true',0)],['good-end','bad-end']]
],['资料对正向结局分别称 HE / Good 和 Normal，此处合并为同一个结局，并非两个不同结局。',
  '前两次选择也影响最后是否能够捡鞋，不能只照最后一项操作。建议在第三次选择前存档，分别取得前两个结局，再从标题菜单进入 TRUE END。']);

build('saya-no-uta','沙耶之歌',['The Song of Saya','沙耶の唄'],[
  'https://hamumamire.blog105.fc2.com/blog-entry-517.html',
  'https://www.bilibili.com/opus/1014191282114789378'
],{
  senses:D('第一个分支 · 感官','是否希望恢复正常感官',['希望恢复','不再需要']),
  phone:D('第二个分支 · 电话','联系谁',['给凉子打电话','给郁纪打电话'])
},[
  ['ending-one','结局一 · 恢复感官',[S('senses',0)]],
  ['ending-two','结局二 · 联系凉子',[S('senses',1),S('phone',0)]],
  ['ending-three','结局三 · 联系郁纪',[S('senses',1),S('phone',1)]]
],['只展示两处分支和三种到达方式，不展开结局剧情。结局编号为本站对照用，不代表游戏官方命名。']);
