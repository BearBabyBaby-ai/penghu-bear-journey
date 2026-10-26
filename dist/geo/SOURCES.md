陸域輪廓來源：內政部國土測繪中心「村里界圖(TWD97經緯度)」，版本 2026-04-07。
官方資料集：https://data.gov.tw/dataset/7438
授權：政府資料開放授權條款第1版 https://data.gov.tw/license
GeoJSON轉換與分縣鏡像：Finjon Kiang / taiwan_basecode，MIT。
https://github.com/kiang/taiwan_basecode/blob/gh-pages/cunli/geo/city/20260407/澎湖縣.json
鏡像原始 Git blob：9e68875c2f6cb6d626371a23d2612a856cbf9261
鏡像資料提交：1bb75f9ba7a81f201c3c5356c486f30bae961d1a

本遊戲將106個澎湖村里多邊形聯集，去除村里內部邊界，取外部輪廓供遊戲陸海判定。
此為行政圖資衍生的陸域輪廓，非即時潮線或獨立海岸測量成果；不推定道路、橋梁、潮間帶實際可通行性。
原始坐標未經手繪、平移或擴張；地標坐標保留試算表原值。
底圖圖磚另由臺灣通用電子地圖或OpenStreetMap即時提供，不包入離線檔案。

道路資料：© OpenStreetMap contributors，ODbL 1.0。
https://www.openstreetmap.org/copyright
https://opendatacommons.org/licenses/odbl/1-0/
快照鏡像：https://github.com/typebrook/mapstew/tree/gh-pages/tiles
鏡像timestamp：2021-12-17T05:28+08:00（非即時道路資料）。
取得121張z14道路向量圖磚，個別來源路徑與Git blob SHA見penghu-roads-20211217.json的source.tiles。
依MVT原始節點建立道路圖；不平滑、不人工新增相鄰道路連線。排除禁行和非陸域線段。
鏡像未保留bridge標籤，僅明確有橋名的來源way/60878925、60879113、60879110、294281818、294281819允許在陸海輪廓之外行走。
衍生資料檔penghu-roads-20211217.json亦依ODbL 1.0提供，從部署網站geo/路徑可直接取得；重建工具位於原始碼tools/。
