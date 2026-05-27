# Daily Gaps

Comble les trous dans vos notes quotidiennes quand vous sautez des jours de journal.

## Le problème

Le plugin **Daily notes** d'Obsidian ouvre surtout la note du jour. Si vous avez des entrées le 20 mai et le 23 mai, mais rien pour le 21 et 22, il est pénible de recréer ces dates une par une, surtout « entre » deux notes existantes.

## La solution

**Daily Gaps** s'appuie sur la configuration du plugin core **Daily notes** (dossier, format, modèle) et ajoute des commandes pour :

- ouvrir ou créer une note pour une date précise ;
- remplir automatiquement les jours manquants jusqu'à la prochaine note existante ;
- remplir les jours manquants depuis la note précédente ;
- remplir une plage de dates ;
- lister les jours manquants sur une période, puis les créer en lot ;
- naviguer vers la note quotidienne existante précédente ou suivante, en sautant les trous.

## Commandes

| Commande | Action |
|----------|--------|
| **Open daily note for date** | Choisir une date, ouvrir la note ou la créer depuis votre modèle |
| **Fill missing daily notes until next entry** | Crée toutes les notes manquantes entre la note courante et la suivante |
| **Fill missing daily notes since previous entry** | Crée les notes manquantes entre la note précédente et la courante |
| **Fill missing daily notes in date range** | Choisir début et fin, créer tous les jours manquants |
| **Show missing daily notes** | Voir la liste des jours manquants, ouvrir ou tout créer |
| **Open next existing daily note** | Saute les jours sans note |
| **Open previous existing daily note** | Idem vers le passé |

## Exemple

Notes existantes : `2026-05-20`, `2026-05-23`.

1. Ouvrez `2026-05-20.md`
2. Lancez **Fill missing daily notes until next entry**
3. Le plugin crée `2026-05-21.md` et `2026-05-22.md` avec le modèle `Modèles/Daily`, puis ouvre la première créée

## Prérequis

- Plugin core **Daily notes** activé
- Dossier et modèle configurés dans Obsidian

## Installation manuelle

1. Téléchargez `main.js`, `manifest.json` et `styles.css` depuis la [dernière release](https://github.com/AntoineArt/obsidian-daily-gaps/releases/latest)
2. Copiez-les dans `.obsidian/plugins/daily-gaps/`
3. Activez le plugin dans **Paramètres → Plugins communautaires**

## Publication

Les releases sont créées automatiquement à chaque tag GitHub.

```bash
git tag 1.0.1
git push origin 1.0.1
```

## Licence

MIT
