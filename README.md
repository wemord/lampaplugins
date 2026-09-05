# Lampa Local No Ads

Плагин для **Lampa**, который отключает CUB preroll-рекламу при воспроизведении локального контента через:

- Jellyfin
- Torrent Manager / WebDAV

При этом плагин не отключает CUB целиком, не блокирует DNS и не вмешивается в TorrServer.

## Как работает

Плагин использует события штатного плеера Lampa.

Перед запуском рекламы он временно помечает поток Jellyfin или Torrent Manager как исключение для preroll, а сразу после старта воспроизведения восстанавливает исходные данные.

Это позволяет сохранить работу:

- CUB-аккаунта
- синхронизации
- истории просмотров
- стандартного плеера Lampa
- TorrServer
- остальных плагинов

## Установка

1. Разместите `local-no-ads.js` в этом репозитории.
2. Включите GitHub Pages:
   - `Settings`
   - `Pages`
   - `Deploy from a branch`
   - Branch: `main`
   - Folder: `/(root)`
3. После публикации адрес плагина будет иметь вид:

```text
https://USERNAME.github.io/REPOSITORY/local-no-ads.js
```

4. В Lampa откройте:

```text
Настройки → Расширения → Добавить плагин
```

5. Вставьте URL `local-no-ads.js`.
6. Перезапустите Lampa.

## Проверка работы

При успешной загрузке в консоли Lampa появится:

```text
[LOCAL-NO-ADS] installed
```

При запуске Jellyfin:

```text
[LOCAL-NO-ADS] source=jellyfin preroll skip armed
[LOCAL-NO-ADS] source=jellyfin temporary flag restored
```

При запуске Torrent Manager:

```text
[LOCAL-NO-ADS] source=torrent-manager preroll skip armed
[LOCAL-NO-ADS] source=torrent-manager temporary flag restored
```

## Что плагин не изменяет

Плагин не:

- блокирует `ad.cub.red`
- подменяет DNS
- отключает CUB
- изменяет Jellyfin
- изменяет Torrent Manager
- изменяет TorrServer
- удаляет рекламу из сторонних онлайн-парсеров

## Совместимость

Плагин написан без современных JavaScript-конструкций, требующих нового браузерного движка, поэтому подходит для старых WebView на телевизорах LG webOS.

## Файлы

```text
lampa-plugins/
├── README.md
└── local-no-ads.js
```

## Обновление

Для обновления плагина достаточно заменить содержимое `local-no-ads.js` в репозитории.

URL GitHub Pages останется прежним, поэтому повторно добавлять плагин в Lampa не потребуется.

## Важно

Плагин зависит от внутреннего поведения плеера Lampa. После крупных обновлений Lampa механизм preroll может измениться, поэтому при появлении рекламы или проблем с воспроизведением стоит проверить актуальность плагина.
