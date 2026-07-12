Running-Back-Risning


# Running Back Rising Structure

This project is organized as a contract-driven JavaScript game with a flat `/js` code root, a separate `assets/` tree, and a single HTML entrypoint that bootstraps everything in load order. The goal is to keep rendering, timing, UI, and page glue separated so the game stays debuggable on a low-end phone.

## Root layout

```text
/
├── index.html
├── README.md
├── manifest.json
├── sw.js
├── assets/
└── js/
```

`index.html` is the browser entrypoint and only contains the canvas shell, HUD, buttons, and script tags. `assets/` stores all images, icons, sheets, and UI art. `js/` stores every runtime file in the contract system 

## Asset layout

```text
assets/
├── backdrops/
├── endzones/
├── grass/
├── icons/
├── ui/
│   ├── gear/
│   ├── icons/
│   └── skilltrees/
└── sprites/
    ├── defenders/
    │   └── bears/
    │       ├── 1.png
    │       ├── 2.png
    │       ├── 3.png
    │       └── 4.png
    ├── items/
    │   └── sheet.png
    ├── player/
    │   └── running/
    │       ├── 1.png
    │       └── ...
    └── powerups/
        └── sheet.png
```

`assets/backdrops/`, `assets/endzones/`, and `assets/grass/` are world/backdrop art. `assets/ui/gear/`, `assets/ui/icons/`, and `assets/ui/skilltrees/` are interface art. `assets/sprites/...` holds animated or sheet-based gameplay art like defenders, player frames, items, and powerups 

## JavaScript layout

```text
js/
├── contract.js
├── consts.js
├── lists.js
├── lut.js
├── functions.js
├── array.js
├── ux.js
├── android.js
├── chrome.js
├── clock.js
├── chronometer.js
├── game-state.js
├── canvas-layer-manager.js
├── render-accumulator.js
├── render-composer.js
├── render-orchestrator.js
├── render-scene.js
├── render-defenders.js
├── render-player.js
├── asset-manifest.js
├── sprite-loader.js
├── ui-backdrops.js
├── audio.js
├── logic-gates.js
├── trie.js
├── gear.js
├── unlockables.js
├── rewards.js
├── save.js
├── smart-play.js
├── overlay-ui.js
├── abilities.js
├── collision-resolution.js
├── skill-tree.js
├── ai-coach.js
├── menus.js
├── spawner.js
├── physics.js
├── career-progression.js
├── story.js
├── nonmodule.js
├── master-contract.js
└── pwa-lifecycle.js
```

The lowest-level files should load first, and the page bootstrap should load last. The idea is that utilities and shared data come first, then time/state, then render infrastructure, then gameplay systems, then page glue 

## Recommended order

Here is the order I would use in `index.html`:

1. `contract.js`
2. `consts.js`
3. `lists.js`
4. `lut.js`
5. `functions.js`
6. `array.js`
7. `ux.js`
8. `android.js`
9. `chrome.js`
10. `clock.js`
11. `chronometer.js`
12. `game-state.js`
13. `canvas-layer-manager.js`
14. `render-accumulator.js`
15. `render-composer.js`
16. `render-orchestrator.js`
17. `asset-manifest.js`
18. `sprite-loader.js`
19. `ui-backdrops.js`
20. `audio.js`
21. `logic-gates.js`
22. `trie.js`
23. `gear.js`
24. `unlockables.js`
25. `rewards.js`
26. `save.js`
27. `smart-play.js`
28. `overlay-ui.js`
29. `abilities.js`
30. `collision-resolution.js`
31. `skill-tree.js`
32. `ai-coach.js`
33. `menus.js`
34. `spawner.js`
35. `physics.js`
36. `career-progression.js`
37. `story.js`
38. `render-scene.js`
39. `render-defenders.js`
40. `render-player.js`
41. `nonmodule.js`
42. `master-contract.js`
43. `pwa-lifecycle.js`

That order matches the contract approach: every module declares what it depends on, and the HTML script order ensures those dependencies already exist when the module loads 

## Responsibility map

- `contract.js` handles module registration and dependency verification.
- `consts.js`, `lists.js`, `lut.js`, `functions.js`, and `array.js` handle shared low-level data and helpers.
- `ux.js` handles shared user-experience helpers.
- `android.js` and `chrome.js` only exist if you truly need platform-specific branches.
- `clock.js` handles the gameplay clock.
- `chronometer.js` handles render-time/fixed-step timing across render paths.
- `game-state.js` handles the top-level state machine.
- `canvas-layer-manager.js` owns offscreen layers and dirty redraws.
- `render-accumulator.js`, `render-orchestrator.js`, and `render-composer.js` split timing, sequencing, and visible composition.
- `render-scene.js`, `render-defenders.js`, and `render-player.js` are the render agents.
- `nonmodule.js` is the bootstrap glue outside the module graph.

## Asset-to-code wiring

- `asset-manifest.js` should be the single source of truth for all asset paths.
- `sprite-loader.js` should load images from `asset-manifest.js`.
- `render-scene.js` should use backdrops, endzones, and grass.
- `render-defenders.js` should use defender sprites under `assets/sprites/defenders/`.
- `render-player.js` should use player animation frames.
- `overlay-ui.js` and `menus.js` should use `assets/ui/...` and `assets/icons/`.
- `ui-backdrops.js` can centralize reusable background art for menus and overlays 

## Module style rules

Each `.js` file should:
- call `defineModule(...)` at the top,
- answer what/how/when/why/where/who,
- declare explicit `exports`,
- and list only the dependencies it truly needs 

That keeps the repo readable and makes the verifier useful instead of noisy [10][2].

## Notes on naming

`lets.js` is optional and only makes sense if it has a specific responsibility. I would not create files just to mirror JavaScript keywords unless they hold a real architectural role 

`nonmodule.js` is the right place for DOM bootstrap, pointer handlers, resize hooks, service worker registration, and other glue that should not live inside gameplay code 

## In short

This should be a flat `/js` source tree with strict load order, a clear `assets/` tree by content type, and a single bootstrap file that wires the page to the contract modules. The payoff is that the game stays modular enough to debug on real hardware without turning into a bundler-heavy mess

