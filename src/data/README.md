# Football Challenge Game - Questions JSON

Ce fichier contient les questions très difficiles pour le mode "أسئلة صعبة جداً" du jeu Football Challenge.

## 📋 Structure des Questions

Chaque question suit cette structure :

```json
{
  "id": 1,
  "question": "السؤال بالعربية؟",
  "answers": ["الإجابة 1", "الإجابة 2", "الإجابة 3", "الإجابة 4"],
  "correctAnswer": "الإجابة الصحيحة",
  "difficulty": "very hard",
  "category": "الفئة"
}
```

## 🏷️ Catégories Disponibles

Les questions sont classées dans les catégories suivantes :

- **تاريخ** (Histoire) - Événements historiques du football
- **أرقام** (Chiffres) - Statistiques et records
- **جوائز** (Récompenses) - Prix et distinctions
- **كأس العالم** (Coupe du Monde) - Événements de la Coupe du Monde
- **أندية عربية** (Clubs Arabes) - Clubs du Moyen-Orient et d'Afrique du Nord
- **كأس أمم أفريقيا** (CAN) - Coupe d'Afrique des Nations
- **قوانين** (Règles) - Règles du jeu

## ➕ Comment Ajouter de Nouvelles Questions

1. Ouvrez le fichier `src/data/footballQuestions.json`
2. Dans le tableau `veryHardQuestions`, ajoutez votre nouvelle question
3. Assurez-vous que l'`id` est unique et séquentiel
4. Vérifiez que la `correctAnswer` correspond exactement à l'une des `answers`
5. Sauvegardez le fichier

### Exemple d'ajout :

```json
{
  "id": 51,
  "question": "من هو أول لاعب عربي يفوز بدوري أبطال أوروبا؟",
  "answers": ["ربيع ماجر", "محمد صلاح", "رياض محرز", "سعد سمير"],
  "correctAnswer": "ربيع ماجر",
  "difficulty": "very hard",
  "category": "تاريخ"
}
```

## 🎵 Effets Sonores

Le jeu inclut des effets sonores automatiques :

- **Tick Sound** 🔊 - Joué toutes les secondes quand il reste moins de 10 secondes
- **Urgent Sound** ⚠️ - Joué quand il reste moins de 5 secondes (plus aigu)
- **Correct Answer** ✅ - Son de succès pour les bonnes réponses
- **Wrong Answer** ❌ - Son d'erreur pour les mauvaises réponses

### Contrôle du Son

Un bouton 🔊/🔇 dans l'en-tête permet d'activer/désactiver les sons.

## 📊 Statistiques Actuelles

- **Nombre total de questions** : 50
- **Points par bonne réponse** : 10
- **Temps par question** : 20 secondes
- **Mode de jeu** : Deux joueurs alternent

## 💡 Conseils pour Créer de Bonnes Questions

1. **Variez la difficulté** : Même dans "très difficile", équilibrez entre impossible et faisable
2. **Sources vérifiables** : Assurez-vous que les réponses sont exactes
3. **Évitez l'ambiguïté** : Les questions doivent avoir une seule bonne réponse claire
4. **Réponses crédibles** : Les mauvaises réponses doivent sembler plausibles
5. **Catégories équilibrées** : Essayez de maintenir un bon équilibre entre les catégories

## 🌟 Idées de Questions

Voici quelques thèmes à explorer :

- Records du monde du football
- Premières fois historiques
- Transferts records
- Joueurs légendaires peu connus
- Finales mémorables
- Joueurs avec des carrières uniques
- Entraîneurs légendaires
- Stades historiques
- Rivalités classiques

## 🔧 Maintenance

Pensez à :
- Mettre à jour les questions avec des événements récents
- Vérifier l'exactitude des informations régulièrement
- Supprimer ou modifier les questions obsolètes
- Ajouter de nouvelles catégories si nécessaire

---

**Fichier** : `src/data/footballQuestions.json`
**Utilisé par** : `src/components/game/FootballChallengeGame.jsx`
