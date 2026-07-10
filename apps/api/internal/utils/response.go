package utils

import "net/http"

// JSONResponse envoie une réponse JSON avec un code HTTP donné.
func JSONResponse(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	// On utilise gin.H pour la sérialisation, mais ici on passe par encoding/json
	// pour rester indépendant du framework si besoin.
	writeJSON(w, data)
}

// ErrorResponse représente une erreur API standardisée.
type ErrorResponse struct {
	Error   string `json:"error"`
	Details string `json:"details,omitempty"`
}
