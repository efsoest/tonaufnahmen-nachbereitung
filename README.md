# Tonaufnahmen Nachbereitung

Ein automatisiertes Skript zum Taggen und Verschieben von Tonaufnahmen (z.B. aus Cubase exportierten Predigten) in der Kirchengemeinde.

## 1. Projekt-Überblick

Das Skript fragt interaktiv die nötigen Metadaten ab, benennt die MP3-Datei entsprechend einheitlich um, fügt alle nötigen ID3-Tags inklusive Cover-Bild hinzu und kopiert die Datei schließlich in den korrekten Google Drive Unterordner.

---

## 2. Benutzung

Der Assistent führt schrittweise durch den Prozess:

1. **Skript starten:** Das Programm öffnet sich und liest die verfügbaren Veranstaltungs-Ordner (Format: `JJJJ_MM_TT (Name)`) aus dem Hauptordner in `Tonaufnahmen`.
2. **Veranstaltung wählen:** Aus der Liste wird die passende Veranstaltung ausgewählt. Das Skript sucht im zugehörigen Unterordner `Mixdown` nach exportierten `.mp3` Dateien.
3. **Metadaten eingeben:** Für jede gefundene Datei wird nach dem Titel, dem Export-Typ (Botschaft, Lied, Moderation, etc.) und dem Prediger gefragt. 
4. **Abschluss:** Die MP3-Dateien werden direkt mit den korrekten ID3-Tags versehen, lokal umbenannt und anschließend automatisch in den konfigurierten Google Drive Ordner kopiert (ein neuer Unterordner wird dafür strukturiert erstellt).

---

## 3. Einrichtung

Zur initialen Einrichtung müssen die Pfade im Skript an die lokale Umgebung angepasst werden.

1. **Konfiguration anpassen:** 
   Das Tool liest beim Start eine `config.yml` Datei ein, die im gleichen Ordner **neben** der ausführbaren Datei (`.exe` bzw. Verknüpfung) liegen muss. In dieser Datei können wichtige Pfade (wie der Pfad zum Google Drive oder Cubase-Exportordner) angepasst werden, ohne das Programm neu kompilieren zu müssen.
2. **Systemvoraussetzungen:**
   - Auf dem Zielrechner ist **keine Installation** von Node.js oder Web-Technologien nötig. Das Programm wird als einzelne, portable `.exe`-Datei (Windows) ausgeliefert.

---

## 4. Entwicklung & Technische Details

Für Wartung und Weiterentwicklung sind folgende Details relevant:

* **Sprache:** TypeScript, ausgeführt und gebündelt mit **[Bun](https://bun.sh/)**.
* **Aufbau:** Das Projekt ist modular aufgebaut (`src/**/*.ts`).

```bash
# Abhängigkeiten installieren
bun install

# Projekt lokal ausführen (zum Testen)
bun run start

# Code formatieren (Prettier)
bun run format:write

# TypeScript Typecheck
bun run typecheck

# Tests (Unit & End-to-End) ausführen
bun test
```

### Lokales Testen (ohne Produktiv-Dateien)

Für die lokale Entwicklung auf macOS steht ein virtuelles Test-Setup mit Fake-MP3-Dateien zur Verfügung:

```bash
# 1. Lokale Test-Umgebung in ./test-env/ aufbauen/zurücksetzen (generiert Fake-MP3s & config.test.yml)
bun run test:setup

# 2. Skript interaktiv im Test-Modus starten (nutzt config.test.yml)
bun run test:dev
```

### Build & Deploy

Um das Programm für den Rechner der Gemeinde final zu exportieren, wird folgender Befehl genutzt:
```bash
bun run export
```
Dies erzeugt die Datei `Tonaufnahmen-Nachbereitung.exe`. Diese `.exe` wird gemeinsam mit einer angepassten `config.yml` auf den Windows-Rechner kopiert.

Alternativ kann das Deployment für das Synology Drive auch vollständig automatisiert werden (baut die `.exe` und verschiebt sie samt Konfigurationsdatei in den richtigen Zielordner):
```bash
bun run deploy
```
