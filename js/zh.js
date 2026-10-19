/* 中文 for TT Kart: every word on the page, the race messages and the ? panel (Kit.lang, from kit/lang.js). Page text
   translates by itself; js/game.js asks Kit.lang.t() for the few words it builds into tables and the GO! count.
   Stays in English on purpose: the game's name (Alan names his games), the racers' names (TEDDY, TOMMY, ZOOM...),
   key labels (T, ENTER) and the name painted on the start arch. */
(function () {
  'use strict';
  const L = Kit.lang;

  const NAMES = ['TEDDY', 'TOMMY', 'ZOOM', 'LUNA', 'BOLT', 'BRUNO', 'ZOMBIE'];
  L.keep([KART.TITLE, KART.TITLE.toUpperCase(), 'Claude Code', ...NAMES, 'Teddy', 'Tommy', 'T', 'ENTER', 'Esc', 'TT']);
  const NAME_ZH = (n) => n; // names stay as they are

  const TRACKS = {
    BACKYARD: '后院', SUBWAY: '地铁', BEACH: '海滩', 'SNOWY HILL': '雪山', 'COOKIE LAND': '饼干乐园', 'NIGHT CITY': '夜晚城市',
  };
  const CUPS = { 'SUNNY CUP': '太阳杯', 'MOON CUP': '月亮杯' };
  L.add(TRACKS);
  L.add(CUPS);

  L.add({
    // title
    "Teddy & Tommy's go-kart races": 'Teddy 和 Tommy 的卡丁车比赛',
    '🏆 1 PLAYER': '🏆 单人', 'race the gang, win a cup': '和大家比赛，赢奖杯',
    '👫 2 PLAYERS': '👫 双人', 'Teddy & Tommy, split screen': 'Teddy 和 Tommy，上下分屏',
    '⏱️ TIME TRIAL': '⏱️ 计时赛', 'just you and 3 cookies': '只有你和 3 块饼干',
    LEVEL: '难度', Difficulty: '难度',
    'the gas is on · steering helps · slow CPU': '自动加油 · 帮你转弯 · 电脑慢',
    'you drive · quick CPU · drift for boosts': '自己开 · 电脑快 · 漂移加速',
    'PLAYER 1': '玩家 1', 'PLAYER 2': '玩家 2',
    'steer · gas · brake': '转弯 · 加油 · 刹车', 'hop (hold + steer: drift)': '跳一下（按住再转弯：漂移）', 'use your item': '用道具',
    "Hold ◀ or ▶ to steer: the gas is always on. 🎁 uses your item, 🦘 hops (hold it in a bend to drift), 🛑 brakes. Tap your brother's face to call him!":
      '按住 ◀ 或 ▶ 转弯，油门一直开着。🎁 用道具，🦘 跳一下（转弯时按住就是漂移），🛑 刹车。点兄弟的头像叫他来！',
    'LOADING…': '加载中…', '↻ Turn sideways for a bigger track!': '↻ 横过来，赛道更大！',
    // pick
    'PICK YOUR DRIVER': '选你的车手', 'PICK YOUR DRIVERS': '选你们的车手', Drivers: '车手', Races: '比赛',
    'PICK A CUP OR A TRACK': '选一个杯赛或一条赛道', 'PICK A TRACK': '选一条赛道',
    'boxing and hoops': '拳击和篮球', 'peace and love': '和平与爱', 'super quick': '超级快', 'starry hoodie': '星星卫衣',
    'beep boop': '哔哔啵啵', 'big bear hugs': '大熊抱抱', 'BOO!': '哇呜！',
    '◀ BACK': '◀ 返回', 'GO! 🏁': '出发！🏁', 'Enter: go · Esc: back': '回车：出发 · Esc：返回',
    // the race
    CALL: '叫来', '↩ WRONG WAY': '↩ 方向反了', 'FINISH!': '到终点啦！', 'Pause (P)': '暂停 (P)', 'Sound (M)': '声音 (M)',
    'Sound on / off (M)': '声音 开 / 关 (M)', 'Sound on or off': '声音开关', HOP: '跳',
    'PEACE SHIELD! ✌️': '比耶护盾！✌️', 'TURBO COOKIE! 🍪': '加速饼干！🍪', 'BUBBLED! 🫧': '被泡泡包住啦！🫧',
    'SLIPPY BANANA! 🍌': '踩到香蕉皮！🍌', 'BONK! 🏀': '咚！🏀', 'BOING!': '嘣！', "GOT 'EM! 🎯": '打中啦！🎯', 'BLOCKED! ✌️': '挡住了！✌️',
    'TOW BOOST! 💨': '拖着你加速！💨', 'FINAL LAP!': '最后一圈！', 'FINISH! 🏁': '到终点啦！🏁', 'TRICK! ⭐': '空中特技！⭐',
    'SHORTCUT! 🤫': '抄近路！🤫', 'UP YOU GO! 🎈': '气球带你回来！🎈',
    // pause
    'P · Esc · Space to resume · Q for the menu · M sound': 'P · Esc · 空格 继续 · Q 回菜单 · M 声音',
    // results and the cup
    'GREAT RACE!': '比得真棒！', 'NEW BEST TIME!': '新纪录！', TIME: '时间', POINTS: '积分', TOTAL: '总分', 'BEST LAP': '最快一圈',
    'NEXT RACE ▶': '下一场 ▶', 'THE TROPHY! 🏆': '领奖杯！🏆', 'PICK ANOTHER ▶': '再选一场 ▶', '↻ RACE AGAIN': '↻ 再比一次',
    'Enter: next · Esc: menu': '回车：下一步 · Esc：菜单',
    'YOU WIN THE CUP!': '你赢得了奖杯！', 'CUP WINNER!': '奖杯冠军！', 'GREAT DRIVING!': '开得真棒！', '↻ PLAY THE CUP AGAIN': '↻ 再比一次杯赛',
    // the ? panel
    steer: '转弯', 'gas · brake (on 🐣 Easy the gas is always on)': '加油 · 刹车（🐣 简单模式油门一直开着）',
    'hop (hold it and steer in a bend: drift, let go: boost)': '跳一下（转弯时按住就是漂移，松开就加速）',
    'title: 1 player · 2 players · time trial · easy': '标题页：单人 · 双人 · 计时赛 · 简单',
    'In 1 player both sets of keys work, and T or Enter calls your brother as often as you like. Hop on a ramp in the air for a trick.':
      '单人时两套按键都能用，T 或回车想叫兄弟几次就叫几次。从跳台飞起来时按跳，可以做空中特技。',
    "Hold ◀ or ▶ on the bar to steer (the gas is always on). 🎁 uses your item, 🦘 hops and drifts, 🛑 brakes, and your brother's face calls him. Two players: each half of the screen has its own buttons.":
      '按住横条上的 ◀ 或 ▶ 转弯（油门一直开着）。🎁 用道具，🦘 跳和漂移，🛑 刹车，点兄弟的头像叫他来。双人：上下两半屏幕各有自己的按钮。',
    '1 2 3 E': '1 2 3 E',
  });

  // places: 1st, 2nd... and the sentences with places, names, laps and cups in them
  const place = (n) => `第${n}名`;
  L.rule(/^(\d+)(st|nd|rd|th)$/, (m, n) => place(n));
  L.rule(/^(\d+)(st|nd|rd|th)! 🏁$/, (m, n) => `${place(n)}！🏁`);
  L.rule(/^(\d+)(st|nd|rd|th) PLACE!$/, (m, n) => `${place(n)}！`);
  L.rule(/^(\d+)(st|nd|rd|th) IN THE CUP!$/, (m, n) => `杯赛${place(n)}！`);
  L.rule(/^LAP (\d+)\/(\d+)$/, '第 $1/$2 圈');
  L.rule(/^LAP (\d+)!$/, '第 $1 圈！');
  L.rule(/^(\S+) SAVED YOU!$/, (m, who) => `${NAME_ZH(who)} 救了你！`);
  L.rule(/^(\S+) IS COMING!$/, (m, who) => `${NAME_ZH(who)} 来啦！`);
  L.rule(/^(\S+) WINS THE CUP!$/, (m, who) => `${NAME_ZH(who)} 赢得了奖杯！`);
  L.rule(/^(\S+) WINS!$/, (m, who) => `${NAME_ZH(who)} 赢了！`);
  L.rule(/^(\S+) YUM!$/, (m, e) => `${e} 好吃！`);
  L.rule(/^(\S+) (SUNNY CUP|MOON CUP)$/, (m, e, c) => `${e} ${CUPS[c]}`);
  L.rule(/^(\S+) (SUNNY CUP|MOON CUP) · RACE (\d+) OF (\d+)$/, (m, e, c, a, b) => `${e} ${CUPS[c]} · 第 ${a} 场，共 ${b} 场`);
  L.rule(/^([\d:.–]+) · best lap ([\d:.–]+)$/, '$1 · 最快一圈 $2');
})();
