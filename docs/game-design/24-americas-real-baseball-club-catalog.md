# Americas Real Baseball Club Catalog — 86 Clubs

更新日: 2026-09-20  
状態: **初期Club Seed Catalog v1。Americasは実在Baseball Clubを使用。**

関連:
- `docs/game-design/10-world-league-catalog.md`
- `docs/game-design/16-club-economy-rivalry-design.md`
- `docs/game-design/18-club-state-lifecycle.md`
- `docs/game-design/20-simple-surface-deep-simulation.md`
- `docs/game-design/21-world-club-source-policy.md`

---

# 1. 方針

Americas 6 Full Leaguesは、既存のBaseball Club Cultureをそのまま使う。

対象:

- North America Major League — 30
- Mexico League — 20
- Dominican League — 6
- Venezuela League — 8
- Puerto Rico League — 6
- Cuba League — 16

Total = **86 clubs**

Economic Bandは初期Game Seed。

現実の企業価値ランキングそのものではなく:

- market
- supporter base
- payroll / acquisition capacity
- ownership capacity
- stadium / commercial scale
- historical institutional strength

をまとめたゲーム開始時の相対値。

Career開始後はSave内の経済で再計算する。

---

# 2. North America Major League — 30 Clubs

## American East

| Club | Home Market | Initial Economic Seed |
| --- | --- | --- |
| New York Yankees | New York | MEGA |
| Boston Red Sox | Boston | ELITE |
| Toronto Blue Jays | Toronto | ELITE |
| Baltimore Orioles | Baltimore | HIGH |
| Tampa Bay Rays | Tampa Bay | MID |

## American Central

| Club | Home Market | Initial Economic Seed |
| --- | --- | --- |
| Detroit Tigers | Detroit | HIGH |
| Minnesota Twins | Minneapolis-St. Paul | HIGH |
| Kansas City Royals | Kansas City | UPPER |
| Cleveland Guardians | Cleveland | UPPER |
| Chicago White Sox | Chicago | HIGH |

## American West

| Club | Home Market | Initial Economic Seed |
| --- | --- | --- |
| Houston Astros | Houston | ELITE |
| Texas Rangers | Dallas-Fort Worth | ELITE |
| Seattle Mariners | Seattle | HIGH |
| Los Angeles Angels | Greater Los Angeles | ELITE |
| Athletics | Northern California transition market | UPPER |

## National East

| Club | Home Market | Initial Economic Seed |
| --- | --- | --- |
| New York Mets | New York | MEGA |
| Philadelphia Phillies | Philadelphia | ELITE |
| Atlanta Braves | Atlanta / Southeast | ELITE |
| Washington Nationals | Washington, D.C. | HIGH |
| Miami Marlins | Miami | MID |

## National Central

| Club | Home Market | Initial Economic Seed |
| --- | --- | --- |
| Chicago Cubs | Chicago | ELITE |
| St. Louis Cardinals | St. Louis | ELITE |
| Milwaukee Brewers | Milwaukee | UPPER |
| Cincinnati Reds | Cincinnati | UPPER |
| Pittsburgh Pirates | Pittsburgh | UPPER |

## National West

| Club | Home Market | Initial Economic Seed |
| --- | --- | --- |
| Los Angeles Dodgers | Los Angeles | MEGA |
| San Francisco Giants | San Francisco Bay Area | ELITE |
| San Diego Padres | San Diego | ELITE |
| Arizona Diamondbacks | Phoenix | HIGH |
| Colorado Rockies | Denver | HIGH |

### North America note

`MEGA / ELITE` は勝率補正ではない。

例えばYankees / Dodgers / Metsが持つ初期資金差は:

```text
budget
 -> player acquisition / retention
 -> actual roster
 -> Match Core
```

を通す。

---

# 3. North America Initial Rivalry Seeds

```text
Yankees <-> Red Sox             very high
Yankees <-> Mets                high
Dodgers <-> Giants             very high
Cubs <-> Cardinals             very high
Mets <-> Phillies              high
Astros <-> Rangers             high
Angels -> Dodgers              medium
Athletics -> Giants            medium-high
Padres -> Dodgers              high
Orioles -> Yankees             high
```

全てdirected relationなので左右の強度は別々に保存する。

---

# 4. Mexico League — 20 Clubs

2026 LMBの20 plazasを使用。

## North / Central side

| Club | Home Identity | Initial Economic Seed |
| --- | --- | --- |
| Sultanes de Monterrey | Monterrey | ELITE |
| Toros de Tijuana | Tijuana | ELITE |
| Charros de Jalisco | Guadalajara | HIGH |
| Algodoneros de Unión Laguna | Torreón | UPPER |
| Tecos de los Dos Laredos | Laredos border region | UPPER |
| Acereros de Monclova | Monclova | UPPER |
| Saraperos de Saltillo | Saltillo | UPPER |
| Rieleros de Aguascalientes | Aguascalientes | MID |
| Caliente de Durango | Durango | UPPER |
| Dorados de Chihuahua | Chihuahua | UPPER |

## South / Central side

| Club | Home Identity | Initial Economic Seed |
| --- | --- | --- |
| Diablos Rojos del México | Mexico City | ELITE |
| El Águila de Veracruz | Veracruz | UPPER |
| Guerreros de Oaxaca | Oaxaca | UPPER |
| Leones de Yucatán | Mérida | HIGH |
| Pericos de Puebla | Puebla | HIGH |
| Piratas de Campeche | Campeche | MID |
| Tigres de Quintana Roo | Cancún / Quintana Roo | HIGH |
| Bravos de León | León | UPPER |
| Olmecas de Tabasco | Villahermosa | UPPER |
| Conspiradores de Querétaro | Querétaro | UPPER |

### Rivalry seeds

```text
Diablos Rojos -> Tigres        very high
Tigres -> Diablos Rojos        very high

Sultanes -> Toros              high
Toros -> Sultanes              high

Leones -> Pericos              medium-high
Pericos -> Leones              medium

Charros -> Sultanes            medium-high
```

---

# 5. Dominican League — LIDOM 6 Clubs

| Club | Home Identity | Initial Economic Seed |
| --- | --- | --- |
| Tigres del Licey | Santo Domingo | ELITE |
| Leones del Escogido | Santo Domingo | ELITE |
| Águilas Cibaeñas | Santiago | ELITE |
| Gigantes del Cibao | San Francisco de Macorís | HIGH |
| Estrellas Orientales | San Pedro de Macorís | HIGH |
| Toros del Este | La Romana | HIGH |

### Rivalry seeds

```text
Licey <-> Escogido             very high
Licey <-> Águilas              very high
Águilas -> Gigantes            high
Estrellas -> Toros             high
```

---

# 6. Venezuela League — LVBP 8 Clubs

| Club | Home Identity | Initial Economic Seed |
| --- | --- | --- |
| Leones del Caracas | Caracas | ELITE |
| Navegantes del Magallanes | Valencia | ELITE |
| Cardenales de Lara | Barquisimeto | HIGH |
| Tiburones de La Guaira | La Guaira / Caracas market | HIGH |
| Tigres de Aragua | Maracay | HIGH |
| Águilas del Zulia | Maracaibo | HIGH |
| Caribes de Anzoátegui | Puerto La Cruz | UPPER |
| Bravos de Margarita | Margarita | UPPER |

### Rivalry seeds

```text
Caracas <-> Magallanes         very high
Lara -> Magallanes             high
Aragua -> Caracas              high
Zulia -> Lara                  medium-high
```

---

# 7. Puerto Rico League — 6 Clubs

2025-26 / 2026-27の6Club構成を使用。

| Club | Home Identity | Initial Economic Seed |
| --- | --- | --- |
| Cangrejeros de Santurce | San Juan | ELITE |
| Criollos de Caguas | Caguas | ELITE |
| Indios de Mayagüez | Mayagüez | HIGH |
| Leones de Ponce | Ponce | HIGH |
| Gigantes de Carolina | Carolina | UPPER |
| Senadores de San Juan | San Juan | UPPER |

### Rivalry seeds

```text
Santurce <-> Caguas            very high
Mayagüez -> Santurce           high
Ponce -> Caguas                medium-high
Senadores -> Santurce          high
```

---

# 8. Cuba League — 16 Provincial Clubs

Cubaは2026 Serie Nacionalの16Team構成を使用。

経済の扱いはNorth America型企業フランチャイズと同じにしない。

`Economic Seed` は:

- regional resource base
- stadium / infrastructure
- player-pool depth
- institutional history

をまとめたGame World上のresource scaleとして扱う。

## Occidental

| Club | Province / Identity | Initial Resource Seed |
| --- | --- | --- |
| Industriales | Havana | HIGH |
| Pinar del Río | Pinar del Río | HIGH |
| Artemisa | Artemisa | MID |
| Isla de la Juventud | Isla de la Juventud | LOW |
| Mayabeque | Mayabeque | MID |
| Matanzas | Matanzas | HIGH |
| Cienfuegos | Cienfuegos | MID |
| Villa Clara | Villa Clara | HIGH |

## Oriental

| Club | Province / Identity | Initial Resource Seed |
| --- | --- | --- |
| Sancti Spíritus | Sancti Spíritus | UPPER |
| Ciego de Ávila | Ciego de Ávila | UPPER |
| Camagüey | Camagüey | MID |
| Las Tunas | Las Tunas | HIGH |
| Holguín | Holguín | UPPER |
| Granma | Granma | HIGH |
| Santiago de Cuba | Santiago de Cuba | HIGH |
| Guantánamo | Guantánamo | MID |

### Rivalry seeds

```text
Industriales <-> Santiago de Cuba      very high
Industriales -> Pinar del Río          high
Pinar del Río -> Industriales          very high
Villa Clara -> Industriales            high
Las Tunas -> Granma                    high
Matanzas -> Industriales               medium-high
```

---

# 9. Winter League Long-season Conversion

現実のDominican / Venezuela / Puerto Ricoは短期冬季Leagueだが、本ゲームでは年間成績の読みやすさを優先して100試合以上へ拡張済み。

Club identityは実在そのまま。

```text
real club identity
+
game-world long pennant schedule
```

とする。

現実日程の完全再現ではない。

---

# 10. Simple Surface

ユーザーが通常見るのは:

```text
Club
資金力
人気
育成
スカウト
補強余力
財政状態
```

詳細な企業価値・所有構造・収益源は背景Simulation。

---

# 11. Source Snapshot Notes

2026確認:

- MLB: 30 current Major League clubs
- LMB: 20 current plazas / clubs
- LIDOM: Licey, Escogido, Águilas, Gigantes, Estrellas, Toros
- LVBP: 8 associated clubs
- Puerto Rico LBPRC: 6 clubs
- Cuba Serie Nacional: 16 current provincial teams

未確認のexact financial valuesは捏造しない。

Economic / Resource Seedはゲーム初期相対値として保持する。
