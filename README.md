# NEON HOCKEY

Air hockey multijoueur en ligne, en temps réel, avec un rendu néon futuriste. Duel 1v1 et Double 2v2, matchmaking public ou salons privés par code, 5 arènes, physique et score gérés de façon autoritaire par le serveur.

## Architecture

Monorepo npm workspaces :

- **`packages/shared`** — types, constantes de la table et moteur physique (collisions, murs, buts, anti-tunneling par sous-pas). Utilisé tel quel par le client *et* le serveur, pour qu'il n'y ait jamais de divergence entre ce que le joueur voit et ce que le serveur calcule.
- **`packages/server`** — serveur Node.js + Socket.IO. Boucle de simulation à 60 Hz, autoritaire sur les positions, collisions, buts et score. Gère les salons, le matchmaking, les comptes à rebours, la reconnexion (token privé par joueur) et le forfait en cas de déconnexion prolongée ou de départ volontaire.
- **`packages/client`** — React + TypeScript + Vite. Rendu Canvas 2D de la table, contrôles souris/tactile, interpolation réseau côté client, effets (particules, traînée, flash de but, tremblement), audio synthétisé (Web Audio API, aucun fichier son à charger), menu et écrans premium.

## Lancer en local

```bash
npm install
```

Dans deux terminaux séparés :

```bash
npm run dev:server   # serveur sur http://localhost:8787
npm run dev:client   # client sur http://localhost:5173
```

Ouvre `http://localhost:5173` dans deux onglets (ou deux appareils sur le même réseau Wi-Fi via l'URL réseau affichée par Vite) pour jouer à deux.

## Variables d'environnement

- `VITE_SERVER_URL` (client) — URL du serveur Socket.IO. Par défaut, déduite de l'hôte courant sur le port 8787 (pratique pour tester depuis un téléphone sur le même Wi-Fi sans rien configurer).
- `PORT` (serveur) — port d'écoute, 8787 par défaut.
- `CLIENT_ORIGIN` (serveur) — origine autorisée pour CORS/Socket.IO. `*` par défaut (développement uniquement).

## Déploiement sur Railway

C'est un monorepo npm workspaces : le serveur (`packages/server`) et le client (`packages/client`) se déploient comme **deux services Railway séparés**, dans le **même projet**, tous les deux pointant vers ce dépôt GitHub. Railway déploie à chaque push sur `main`.

Je ne peux pas créer les services ni cliquer dans le dashboard Railway à ta place — voici exactement quoi faire.

### 1. Service serveur (Socket.IO)

Dans le dashboard Railway : **New → GitHub Repo → NeonHockey**, puis dans les Settings de ce service :

- **Root Directory** : laisse vide (racine du repo — nécessaire pour que `npm install` résolve les workspaces).
- **Build Command** : `npm install && npm run build -w packages/shared && npm run build -w packages/server`
- **Start Command** : `npm start -w packages/server`
- **Networking → Generate Domain** pour obtenir une URL publique (ex: `neonhockey-server-production.up.railway.app`).
- **Variables** :
  - `CLIENT_ORIGIN` = l'URL publique du service client (à ajouter une fois le client déployé, étape 2).

### 2. Service client (interface web)

Dans le même projet Railway : **New → GitHub Repo → NeonHockey** (un deuxième service, même dépôt), puis dans ses Settings :

- **Root Directory** : laisse vide, pour la même raison.
- **Build Command** : `npm install && npm run build -w packages/shared && npm run build -w packages/client`
- **Start Command** : `npm start -w packages/client`
- **Networking → Generate Domain** pour obtenir l'URL publique du jeu.
- **Variables** :
  - `VITE_SERVER_URL` = l'URL publique du service **serveur** de l'étape 1 (avec `https://`, ex: `https://neonhockey-server-production.up.railway.app`). **Attention** : c'est une variable injectée au moment du build (Vite), donc il faut redéployer le service client si tu la changes après coup.

### 3. Boucler

Une fois le client déployé, reviens sur le service **serveur** et mets `CLIENT_ORIGIN` à l'URL publique du client (ex: `https://neonhockey-client-production.up.railway.app`), puis redéploie le serveur. Sans ça, le navigateur bloquera la connexion Socket.IO par CORS.

### À savoir

- Le serveur garde tout l'état des parties en mémoire (pas de base de données) — un redémarrage ou un redéploiement du serveur met fin aux parties en cours. Suffisant pour ce projet.
- Les deux services doivent rester démarrés en continu (ce ne sont pas des fonctions serverless) — Railway facture au temps d'exécution, vérifie ton forfait si tu comptes le laisser tourner longtemps.

## Ce qui a été testé réellement (pas simulé)

- Matchmaking et salons privés avec deux connexions Socket.IO indépendantes (deux onglets réels, deux sockets réels).
- Physique serveur : collisions palet/maillet, rebonds sur les bandes, détection de but.
- Synchronisation du score entre deux clients indépendants.
- Fin de match à 7 buts, écran victoire/défaite personnalisé par joueur.
- Revanche avec vote des deux joueurs et redémarrage réel de la partie.
- Départ volontaire en cours de partie → forfait immédiat pour l'adversaire, retour propre au menu pour celui qui quitte.
- Salon privé : création avec choix d'arène, code à 5 caractères, rejoindre par code, bouton "prêt", démarrage automatique une fois tous prêts.
- Les 5 arènes (sélection et changement visuel réel des couleurs/thème).
- Double 2v2 : matchmaking réel avec 4 connexions Socket.IO indépendantes (4 vrais onglets), formation correcte des deux équipes, affichage des deux coéquipiers par équipe. La physique du mode (zones par équipe, collision entre coéquipiers, score d'équipe, fin de match à 7 buts) a été vérifiée de façon déterministe en pilotant directement le moteur du salon côté serveur.
