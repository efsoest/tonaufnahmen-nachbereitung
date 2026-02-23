# Tonaufnahmen-Nachbereitung

Ein automatisiertes Skript zum Taggen und Verschieben von Tonaufnahmen (z.B. aus Cubase exportierten Predigten) in der Kirchengemeinde.
Das Skript fragt interaktiv die nötigen Metadaten ab, benennt die MP3-Datei entsprechend einheitlich um, fügt alle nötigen ID3-Tags inklusive Cover-Bild hinzu und kopiert die Datei schließlich in den korrekten Google Drive Unterordner.

## Systemvoraussetzungen
- Auf dem Rechner ist **keine Installation** von Node.js oder Web-Technologien nötig, da das Programm als einzelne, portable `.exe`-Datei (Windows) ausgeliefert wird.
- Wenn du den Code weiterentwickeln möchtest, benötigst du **[Bun](https://bun.sh/)**.

## Konfiguration (`config.yml`)
Das Tool liest beim Start eine `config.yml` Datei ein, die im gleichen Ordner **neben** der `.exe` liegen muss.
In dieser Datei können wichtige Pfade angepasst werden, ohne das Programm neu kompilieren zu müssen.
Beispielsweise kannst du dort eintragen, wo Google Drive bei dir lokal liegt und wie der Ordner heißt, in dem Cubase speichert.

## Funktionsweise
Wenn du das Programm startest, liest es die verfügbaren Veranstaltungs-Ordner (Format: `JJJJ_MM_TT (Name)`) aus dem Hauptordner `Tonaufnahmen`.
Du wählst eine Veranstaltung aus und das Skript sucht im zugehörigen Unterordner `Mixdown` nach exportierten `.mp3` Dateien.

Für jede gefundene Datei wirst du nach dem Titel, dem Export-Typ (Botschaft, Lied, Moderation, etc.) und dem Prediger gefragt. Die MP3s werden dann direkt mit den korrekten ID3-Tags versehen, lokal umbenannt und anschließend automatisch in deinen konfigurierten Google Drive Ordner kopiert (ein neuer Unterordner wird dafür automatisch erstellt).

## Entwicklung & Build

Das Projekt nutzt TypeScript und ist modular aufgebaut (`src/**/*.ts`).

```bash
# Abhängigkeiten installieren
bun install

# Projekt lokal ausführen (zum Testen)
bun run start

# Code formatieren (Prettier)
bun run format:write

# TypeScript Typecheck
bun run typecheck
```

Um das Programm für den Gemeinder-Rechner final zu exportieren, nutze diesen Befehl:
```bash
bun run export
```
Dies erzeugt die Datei `Tonaufnahmen-Nachbereitung.exe`. Kopiere diese `.exe` gemeinsam mit deiner angepassten `config.yml` auf den Windows-Rechner der Gemeinde.

Alternativ kannst du das Deployment für das Synology Drive auch vollständig automatisieren (baut die .exe und verschiebt sie samt config in den richtigen Zielordner):
```bash
bun run deploy
```
