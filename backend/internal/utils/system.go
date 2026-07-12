package utils

import "github.com/google/uuid"

// GetSystemUserID retourne un UUID fixe représentant l'utilisateur système
// (pour les opérations automatiques comme le seed ou les écritures auto).
func GetSystemUserID() uuid.UUID {
	return uuid.MustParse("00000000-0000-0000-0000-000000000001")
}
