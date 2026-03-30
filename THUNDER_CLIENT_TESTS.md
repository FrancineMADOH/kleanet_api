# Thunder Client — Guide de test des routes Kleanet API

**Base URL** : `http://localhost:3000`
**Swagger UI** : `http://localhost:3000/docs`

> **Convention** : Toutes les routes protégées nécessitent un Bearer token.
> Dans Thunder Client : onglet **Auth** → **Bearer** → coller le `access_token` (champ Token Prefix : **laisser vide**).

---

## Étape préalable — Obtenir un token JWT

À faire une fois avant de tester les routes protégées.

### 1. Envoyer un OTP

**POST** `http://localhost:3000/api/v1/auth/phone/send`

- Auth : aucune
- Body (JSON) :
```json
{
  "phone": "+237612345678"
}
```
- Réponse attendue :
```json
{ "sent": true }
```
- Le code OTP s'affiche dans les **logs du terminal** (MockSmsProvider en dev).

---

### 2. Vérifier l'OTP et obtenir les tokens

**POST** `http://localhost:3000/api/v1/auth/phone/verify`

- Auth : aucune
- Body (JSON) :
```json
{
  "phone": "+237612345678",
  "code": "XXXXXX"
}
```
- Réponse attendue :
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiJ9...",
  "partner_id": 42,
  "is_new_user": true
}
```
> **Copier `access_token`** → à utiliser dans toutes les routes protégées.

---

### 3. Rafraîchir un token expiré

**POST** `http://localhost:3000/api/v1/auth/refresh`

- Auth : aucune
- Body (JSON) :
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiJ9..."
}
```
- Réponse : nouvel `access_token`

---

### 4. Logout

**POST** `http://localhost:3000/api/v1/auth/logout`

- Auth : **Bearer token** requis
- Body : aucun
- Réponse :
```json
{ "success": true }
```

---

## CATALOG — Routes publiques (pas de token)

### 5. Récupérer le catalogue (types de vêtements + tarifs)

**GET** `http://localhost:3000/api/v1/catalog/services`

- Auth : aucune
- Réponse :
```json
{
  "garment_types": [
    { "id": 1, "name": "Chemise", "is_special_item": false },
    { "id": 2, "name": "Costume", "is_special_item": true }
  ],
  "pricing_rules": [
    { "id": 1, "mode": "per_kg", "price": 1500, "currency": "XAF" },
    { "id": 2, "mode": "per_piece", "garment_type_name": "Costume", "price": 3500, "currency": "XAF" }
  ],
  "cached_at": "2026-03-30T10:00:00.000Z"
}
```
> Le 2ème appel est servi depuis Redis (log "cache hit" dans le terminal).

---

### 6. Récupérer les plans d'abonnement

**GET** `http://localhost:3000/api/v1/catalog/plans`

- Auth : aucune
- Réponse :
```json
[
  {
    "id": 1,
    "name": "Essentiel",
    "segment": "residential",
    "billing_cycle": "monthly",
    "included_weight_kg": 10,
    "included_pieces": 20,
    "included_pickups_per_week": 2,
    "recurring_fee": 15000,
    "overage_price_per_kg": 1800,
    "currency": "XAF",
    "is_recommended": true
  }
]
```

---

### 7. Invalider le cache catalogue

**DELETE** `http://localhost:3000/api/v1/catalog/cache`

- Auth : **Bearer token** requis
- Body : aucun
- Réponse :
```json
{ "message": "Cache invalidated" }
```
> Utile après avoir modifié des tarifs dans Odoo.

---

## ORDERS — Routes protégées

### 8. Créer une commande

**POST** `http://localhost:3000/api/v1/orders`

- Auth : **Bearer token** requis
- Body (JSON) :
```json
{
  "lines": [
    { "garment_type_id": 1, "quantity": 3 },
    { "garment_type_id": 2, "weight_kg": 2.5 }
  ],
  "notes": "Sonner à l'interphone SVP"
}
```
- Avec livraison GPS (optionnel) :
```json
{
  "lines": [
    { "garment_type_id": 1, "quantity": 5 }
  ],
  "delivery_location": {
    "latitude": 3.8480,
    "longitude": 11.5021
  }
}
```
- Réponse : `OrderDetail` complet avec `id`, `reference`, `status: "pending"`, `lines[]`, `tracking_url`

> Remplacer `garment_type_id` par un vrai id obtenu depuis `GET /catalog/services`.

---

### 9. Lister mes commandes

**GET** `http://localhost:3000/api/v1/orders`

- Auth : **Bearer token** requis
- Query params optionnels :
  - `?page=1&limit=10`
  - `?status=pending`
  - `?status=delivered&page=2&limit=5`

Valeurs possibles pour `status` : `pending` `received` `processing` `ready_for_pickup` `delivered` `cancelled`

- Réponse :
```json
[
  {
    "id": 1,
    "reference": "KLA/2026/00001",
    "status": "pending",
    "amount_total": 4500,
    "currency": "XAF",
    "total_pieces": 3
  }
]
```

---

### 10. Détail d'une commande

**GET** `http://localhost:3000/api/v1/orders/1`

- Auth : **Bearer token** requis
- Remplacer `1` par l'id retourné lors de la création
- Réponse : `OrderDetail` avec `lines[]` et `tracking_url`

**Tests de sécurité à faire :**
| Test | Résultat attendu |
|------|-----------------|
| `GET /orders/abc` | `400 INVALID_ORDER_ID` |
| `GET /orders/99999` (id inexistant) | `404 ORDER_NOT_FOUND` |
| Sans token | `401 UNAUTHORIZED` |

---

## APPOINTMENTS — Routes protégées

### 11. Créer un rendez-vous pickup

**POST** `http://localhost:3000/api/v1/appointments`

- Auth : **Bearer token** requis
- Body (JSON) :
```json
{
  "type": "pickup",
  "scheduled_from": "2026-03-31T09:00:00Z",
  "scheduled_to": "2026-03-31T11:00:00Z",
  "notes": "Immeuble Hilton, porte 4B"
}
```
- Avec commandes liées (optionnel) :
```json
{
  "type": "pickup",
  "scheduled_from": "2026-03-31T09:00:00Z",
  "order_ids": [1, 2]
}
```
- Réponse :
```json
{
  "id": 1,
  "reference": "APT/2026/00001",
  "type": "pickup",
  "status": "requested",
  "scheduled_from": "2026-03-31T09:00:00.000Z",
  "scheduled_to": "2026-03-31T11:00:00.000Z"
}
```

**Tests de validation à faire :**
| Test | Résultat attendu |
|------|-----------------|
| `scheduled_from` dans 30 minutes | `400 TOO_SOON` |
| `scheduled_from` = "not-a-date" | `400 INVALID_DATE` |
| `order_ids` contenant une commande d'un autre client | `403 FORBIDDEN` |
| Sans token | `401 UNAUTHORIZED` |

---

### 12. Lister mes rendez-vous

**GET** `http://localhost:3000/api/v1/appointments`

- Auth : **Bearer token** requis
- Body : aucun
- Réponse : tableau d'`AppointmentSummary`, trié par date décroissante

---

## SUBSCRIPTION — Routes protégées

### 15. Consulter mon abonnement actif

**GET** `http://localhost:3000/api/v1/subscription`

- Auth : **Bearer token** requis
- Body : aucun
- Réponse sans abonnement :
```json
{ "subscription": null }
```
- Réponse avec abonnement :
```json
{
  "subscription": {
    "id": 1,
    "reference": "SUB/2026/00001",
    "plan_name": "Essentiel",
    "billing_cycle": "monthly",
    "included_weight_kg": 10,
    "included_pieces": 20,
    "included_pickups_per_week": 2,
    "recurring_fee": 15000,
    "overage_price_per_kg": 1800,
    "currency": "XAF",
    "start_date": "2026-03-30",
    "state": "active",
    "usage": {
      "orders_this_period": 2,
      "weight_used_kg": 3.5,
      "remaining_weight_kg": 6.5
    }
  }
}
```

---

### 16. Souscrire à un plan

**POST** `http://localhost:3000/api/v1/subscription`

- Auth : **Bearer token** requis
- Body (JSON) :
```json
{
  "plan_id": 1
}
```
- Réponse : `ActiveSubscription` complet (même structure que GET)

**Tests d'erreur à faire :**
| Test | Résultat attendu |
|------|-----------------|
| `plan_id` inexistant ou inactif | `404 PLAN_NOT_FOUND` |
| Appeler POST une 2ème fois (abonnement déjà actif) | `409 ALREADY_SUBSCRIBED` |
| Sans token | `401 UNAUTHORIZED` |

> Utiliser l'id du plan retourné par `GET /catalog/plans` pour avoir un `plan_id` valide.

---

## PROFILE — Routes protégées

### 17. Consulter mon profil

**GET** `http://localhost:3000/api/v1/profile`

- Auth : **Bearer token** requis
- Body : aucun
- Réponse :
```json
{
  "id": 42,
  "name": "Jean Dupont",
  "phone": "+237612345678",
  "delivery_location": null
}
```
> `delivery_location` vaut `null` tant que `PATCH /profile/location` n'a pas été appelé.

---

### 18. Mettre à jour mon profil

**PATCH** `http://localhost:3000/api/v1/profile`

- Auth : **Bearer token** requis
- Body (JSON) — au moins un champ requis :
```json
{ "name": "Jean Dupont" }
```
ou :
```json
{ "email": "jean@example.com" }
```
ou les deux :
```json
{ "name": "Jean Dupont", "email": "jean@example.com" }
```
- Réponse : `Profile` mis à jour

**Tests d'erreur à faire :**
| Test | Résultat attendu |
|------|-----------------|
| Body vide `{}` | `400 NOTHING_TO_UPDATE` |
| Email déjà utilisé par un autre compte | `409 DUPLICATE_ACCOUNT` |
| Email invalide `"pas-un-email"` | `400` (validation schéma) |
| Sans token | `401 UNAUTHORIZED` |

---

### 19. Enregistrer ma position GPS

**PATCH** `http://localhost:3000/api/v1/profile/location`

- Auth : **Bearer token** requis
- Body (JSON) :
```json
{
  "latitude": 3.8480,
  "longitude": 11.5021
}
```
- Réponse : `Profile` avec `delivery_location` rempli :
```json
{
  "id": 42,
  "name": "Jean Dupont",
  "delivery_location": {
    "latitude": 3.848,
    "longitude": 11.5021
  }
}
```

**Tests d'erreur à faire :**
| Test | Résultat attendu |
|------|-----------------|
| `{ "latitude": 0, "longitude": 0 }` | `400 INVALID_COORDINATES` |
| `{ "latitude": 999, "longitude": 0 }` | `400` (validation schéma — hors plage) |
| Sans token | `401 UNAUTHORIZED` |

> Après ce PATCH, vérifier dans Odoo (res.partner) que `partner_latitude` et `partner_longitude` ont bien été mis à jour.

---

## Health Check

**GET** `http://localhost:3000/ping`

- Auth : aucune
- Réponse : `{ "pong": true }`

---

## Récapitulatif des routes

| # | Méthode | Route | Auth | Module |
|---|---------|-------|------|--------|
| 1 | POST | `/api/v1/auth/phone/send` | ❌ | Auth |
| 2 | POST | `/api/v1/auth/phone/verify` | ❌ | Auth |
| 3 | POST | `/api/v1/auth/google` | ❌ | Auth |
| 4 | POST | `/api/v1/auth/facebook` | ❌ | Auth |
| 5 | POST | `/api/v1/auth/refresh` | ❌ | Auth |
| 6 | POST | `/api/v1/auth/logout` | ✅ | Auth |
| 7 | GET | `/api/v1/catalog/services` | ❌ | Catalog |
| 8 | GET | `/api/v1/catalog/plans` | ❌ | Catalog |
| 9 | DELETE | `/api/v1/catalog/cache` | ✅ | Catalog |
| 10 | POST | `/api/v1/orders` | ✅ | Orders |
| 11 | GET | `/api/v1/orders` | ✅ | Orders |
| 12 | GET | `/api/v1/orders/:id` | ✅ | Orders |
| 13 | POST | `/api/v1/appointments` | ✅ | Appointments |
| 14 | GET | `/api/v1/appointments` | ✅ | Appointments |
| 15 | GET | `/api/v1/subscription` | ✅ | Subscription |
| 16 | POST | `/api/v1/subscription` | ✅ | Subscription |
| 17 | GET | `/api/v1/profile` | ✅ | Profile |
| 18 | PATCH | `/api/v1/profile` | ✅ | Profile |
| 19 | PATCH | `/api/v1/profile/location` | ✅ | Profile |
