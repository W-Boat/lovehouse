# 小游戏文案稳定ID批次

本批新增 content/game-copy.ts，共115条人工语义默认文案。getGameCopy读取personal.texts['game-ui.'+id]，formatGameCopy负责动态数值，不改变数字状态。源文件src/minigames.ts和letter-game.ts的标题/规则/按钮/提示/状态/canvas字样已接入。letter-puzzle.ts没有用户可见文字，保持原算法。

动态占位符包括level、index、angle、line、label、steps、control、player、caught、combo、seconds、hits、count、horizontal、vertical。替换时保留相应占位符；canvas.fillText和DOM.textContent承载文字，不将文案放入innerHTML或eval。

## 不是自由替换文案的内容

- 便签排序的三组答案仍保留原序列：起床/出门/看日落/说晚安；烧水/泡茶/晾一晾/一起喝；折信/装信封/贴邮票/投进邮筒。它们兼作答案标识，不能在只改线索后假称新谜题仍可玩。
- notes.clue.morning、notes.clue.tea、notes.clue.post虽可替换说明文字，语义必须匹配上述答案顺序。若改谜题，需要独立关卡配置和新的通关验证。
- 钥匙扣短句继续来源birthday-config/keychainLines及原keychain.<index>替换ID；改变短句会改变切分词片，是内容配置，不冒充独立说明文字。
- A/S/D、R、方向键、canvas数字、角度和关卡总数是操作/规则要求，不可用文案替换来修改实际规则。
- 整个玩法、gift id、存档状态、棋盘坐标/答案、监听事件未调整。

## 验证及边界

TypeScript通过。game-copy与letter-puzzle共4项纯测试通过：精确默认按钮、数值模板、自定义文案读取，以及既有不规则信笺几何/吸附规则。未本地部署或运行浏览器，新面板长文案布局和完整12玩法仍需CI。

本批未修改tools/export-content.ts，由主代理导出gameCopyDefaults并使用getGameCopy保留已填内容。尚有main/庆祝/原始HTML等文本继续由主代理处理，本批不宣称全站文案已全量。
