/* The keys the ? panel shows. Press ? (Shift + /) in the game, or tap the round ? button.
   The panel and the freeze live in the shared kit: kit/help.js (Kit.help). */
Kit.help.setup({
  title: KART.TITLE, // the name lives in js/title.js
  cols: ['Player 1', 'Player 2'],
  keys: [
    ['steer', 'A D', '← →'],
    ['gas · brake (on 🐣 Easy the gas is always on)', 'W · S', '↑ · ↓'],
    ['hop (hold it and steer in a bend: drift, let go: boost)', 'F or Space', 'K'],
    ['use your item', 'G', 'L'],
    ['call your brother', 'T', 'Enter'],
    ['pause · sound', 'P or Esc · M', ''],
    ['title: 1 player · 2 players · time trial · easy', '1 2 3 E', ''],
  ],
  note: 'In 1 player both sets of keys work, and T or Enter calls your brother as often as you like. Hop on a ramp in the air for a trick.',
  touch: 'Hold ◀ or ▶ on the bar to steer (the gas is always on). 🎁 uses your item, 🦘 hops and drifts, 🛑 brakes, and your brother\'s face calls him. Two players: each half of the screen has its own buttons.',
});
