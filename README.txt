この ZIP には、整理後のゲームソースを入れています。

主な変更点:
- JS / CSS / HTML を整形
- 不要な重複 CSS を削除
- 設定値を js/config.js に集約
- キャラクターID / 画像名を bear_XX → chara_XX に変更
- コメントを追加
- 処理順を整理

注意:
- 画像ファイルも実際に使う場合は、assets/chara 配下を以下のようにリネームしてください。
  bear_01.png → chara_01.png
  bear_02.png → chara_02.png
  ...
  bear_07.png → chara_07.png

配置想定:
- index.html
- style.css
- js/config.js
- js/Game.js
- js/GameRenderer.js
- js/StepManager.js
- js/main.js
