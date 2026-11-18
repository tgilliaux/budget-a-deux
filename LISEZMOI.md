# Budget à deux

Web app installable (PWA) pour gérer le budget du couple sur iPad.
Elle fonctionne hors ligne, et **toutes les données restent sur l'iPad** : rien n'est envoyé sur un serveur.

## Fonctionnalités

| Écran | Contenu |
|---|---|
| **Accueil** | Revenus, charges, épargne, argent de poche, dépenses courantes et « non affecté » du mois. Liste des virements du mois pour chacun, compte par compte (compte commun pour les charges et dépenses, puis un compte par objectif d’épargne), avec une case à cocher par virement. Cocher un virement d’épargne met à jour le solde de l’objectif. Par défaut, les virements sont calculés pour qu’il reste la même somme à chacun. Échéances des 3 prochains mois. |
| **Revenus** | Salaires, primes / 13e mois, pécule de vacances, allocations… Chaque revenu est rattaché à une personne ou au compte commun, avec sa fréquence (mensuelle, trimestrielle, annuelle…). |
| **Charges** | Charges fixes mensuelles et non mensuelles (assurances, taxes, précompte…), par catégorie, payées en commun ou en perso. Calendrier sur 12 mois et **provision mensuelle** à mettre de côté. |
| **Dépenses** | Enveloppes mensuelles (courses, carburant, sorties…) et journal des dépenses du mois. |
| **Épargne** | Objectifs (chacun lié à son compte d’épargne) avec montant cible, versement mensuel et date estimée d'atteinte. Versements et retraits ponctuels, ou enregistrement en un clic des versements programmés du mois. |
| **Poche** | Argent de poche mensuel de chacun, ce qui a été dépensé et ce qui reste. |
| **Réglages** | Prénoms, nom ou IBAN du compte commun, mode de partage (même reste pour chacun, au prorata des revenus, 50/50 ou pourcentage personnalisé), export / import de sauvegarde. |

## Installer sur l'iPad

Pour s'installer et fonctionner hors ligne, l'app doit être servie une fois en **HTTPS**.
Le plus simple est un hébergement statique gratuit. Seul le code de l'app est en ligne ; vos chiffres restent sur l'iPad.

### Option A : GitHub Pages (recommandé, permanent)
1. Créez un dépôt sur github.com (par ex. `budget-a-deux`) et déposez-y le **contenu** du dossier `budget-couple` (bouton *Add file → Upload files*).
2. Ouvrez *Settings → Pages*, choisissez *Branch : main / root*, puis *Save*.
3. Après environ 1 minute, l'app est disponible sur `https://<votre-compte>.github.io/budget-a-deux/`.

### Option B : Netlify Drop
1. Allez sur app.netlify.com/drop et glissez-y le dossier `budget-couple`.
2. Créez un compte gratuit pour conserver le site (sinon il expire).

### Ensuite, sur l'iPad
1. Ouvrez l'adresse dans **Safari**.
2. Touchez **Partager** (carré avec une flèche) puis **Sur l'écran d'accueil**.
3. Lancez l'app depuis son icône. Elle s'ouvre en plein écran et fonctionne sans connexion.

> Utilisez toujours l'icône de l'écran d'accueil, et non l'onglet Safari : les deux ont des espaces de stockage séparés.

## Sauvegardes

- *Réglages → Exporter une sauvegarde* crée un fichier `.json`, à enregistrer dans Fichiers ou iCloud Drive.
- Pensez-y régulièrement : si l'app est supprimée de l'écran d'accueil, ses données le sont aussi.
- Pour passer sur un autre iPad, exportez sur le premier puis importez sur le second.

## Mettre à jour l'app

Après avoir modifié les fichiers, changez `VERSION` dans `sw.js` (par ex. `budget-a-deux-v2`) puis redéployez.
L'iPad récupère la nouvelle version à la prochaine ouverture avec connexion.

## Fichiers

```
index.html            page principale
styles.css            mise en page (clair / sombre, iPad portrait et paysage)
app.js                logique et calculs
manifest.webmanifest  nom et icônes de l'app installée
sw.js                 fonctionnement hors ligne
icons/                icônes de l'app
```
