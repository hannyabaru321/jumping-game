このフォルダに画像を配置してください。

■共通
assets/
  player.png

■テーマごとの画像
100 スコアごとに 1 テーマ進みます。
0〜99 点: theme_00
100〜199 点: theme_01
...
1000 点以上: theme_10

各テーマフォルダに、以下 8 ファイルを置いてください。

assets/themes/theme_00/
  background.png
  tile.png
  tile_warning.png
  tile_falling.png
  tile_highscore_marker.png
  tile_obstacle_01.png
  tile_obstacle_02.png
  tile_obstacle_03.png

同じ構成で theme_01 ～ theme_10 まで作ってください。

■補足
- 背景は 100 点ごとにゆっくり切り替わります
- すでに表示中の床は前テーマのままです
- 新しく生成される床から新テーマ画像になります
- 障害床は各テーマ 3 種固定です
