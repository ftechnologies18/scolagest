package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// RateLimiter implémente un rate limiter in-memory par clé (typiquement IP).
//
// Utilise un sliding window simplifié : on compte les tentatives dans une fenêtre
// fixe de `window` durée, avec un maximum de `maxAttempts`. Les entrées expirées
// sont nettoyées paresseusement à chaque appel.
//
// Limitation : in-memory → non partagé entre instances. Pour Render (1 instance
// par service), c'est suffisant. Pour du multi-instance, utiliser Redis.
//
// Thread-safe via sync.Mutex.
type RateLimiter struct {
	mu         sync.Mutex
	attempts   map[string][]time.Time // clé → timestamps des tentatives
	maxAttempts int                   // nb max de tentatives par fenêtre
	window      time.Duration         // durée de la fenêtre
	blockDur    time.Duration         // durée de blocage après dépassement
}

// NewRateLimiter crée un RateLimiter.
//   - maxAttempts : nombre max de tentatives par fenêtre
//   - window      : durée de la fenêtre glissante (ex: 15 * time.Minute)
//   - blockDur    : durée de blocage après dépassement (ex: 15 * time.Minute)
func NewRateLimiter(maxAttempts int, window, blockDur time.Duration) *RateLimiter {
	return &RateLimiter{
		attempts:    make(map[string][]time.Time),
		maxAttempts: maxAttempts,
		window:      window,
		blockDur:    blockDur,
	}
}

// Allow vérifie si la clé peut effectuer une tentative. Retourne (allowed, retryAfter).
// Si allowed, enregistre la tentative. Sinon, indique quand réessayer.
func (rl *RateLimiter) Allow(key string) (bool, time.Duration) {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-rl.window)

	// Filtrer les tentatives dans la fenêtre courante
	var recent []time.Time
	for _, t := range rl.attempts[key] {
		if t.After(cutoff) {
			recent = append(recent, t)
		}
	}

	// Si trop de tentatives → bloquer
	if len(recent) >= rl.maxAttempts {
		// Calculer quand la plus ancienne tentative sortira de la fenêtre
		oldest := recent[0]
		retryAfter := oldest.Add(rl.window).Sub(now)
		if retryAfter < 0 {
			retryAfter = 0
		}
		rl.attempts[key] = recent // nettoyer
		return false, retryAfter
	}

	// Enregistrer la tentative
	recent = append(recent, now)
	rl.attempts[key] = recent

	return true, 0
}

// Reset réinitialise le compteur pour une clé (appelé après login réussi).
func (rl *RateLimiter) Reset(key string) {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	delete(rl.attempts, key)
}

// LoginRateLimit middleware pour les endpoints de login.
// Limite à 5 tentatives par 15 minutes par IP. Après 5 échecs, bloque 15 min.
// Headers de réponse standards : Retry-After, X-RateLimit-*.
//
// Usage :
//   r.POST("/api/auth/login", middleware.LoginRateLimit(rl), h.Login)
func LoginRateLimit(rl *RateLimiter) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Clé = IP client (fallback sur RemoteAddr)
		key := c.ClientIP()
		if key == "" {
			key = c.Request.RemoteAddr
		}

		allowed, retryAfter := rl.Allow(key)
		if !allowed {
			c.Header("Retry-After", formatDuration(retryAfter))
			c.Header("X-RateLimit-Limit", "5")
			c.Header("X-RateLimit-Remaining", "0")
			c.Header("X-RateLimit-Reset", formatDuration(retryAfter))
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error": "Trop de tentatives de connexion. Réessayez dans " + formatDurationHuman(retryAfter) + ".",
				"retry_after_seconds": int(retryAfter.Seconds()),
			})
			return
		}

		// Si login réussi (status < 400), reset le compteur
		c.Next()
		if c.Writer.Status() < 400 {
			rl.Reset(key)
		}
	}
}

func formatDuration(d time.Duration) string {
	seconds := int(d.Seconds())
	if seconds < 1 {
		seconds = 1
	}
	return formatInt(seconds)
}

func formatInt(i int) string {
	if i == 0 {
		return "0"
	}
	var buf []byte
	if i < 0 {
		buf = append(buf, '-')
		i = -i
	}
	var digits []byte
	for i > 0 {
		digits = append([]byte{byte('0' + i%10)}, digits...)
		i /= 10
	}
	return string(append(buf, digits...))
}

func formatDurationHuman(d time.Duration) string {
	minutes := int(d.Minutes())
	if minutes >= 1 {
		return formatInt(minutes) + " minute(s)"
	}
	return formatInt(int(d.Seconds())) + " seconde(s)"
}
