package utils

import (
	"encoding/json"
	"net/http"
)

// writeJSON sérialise data en JSON et l'écrit dans la réponse.
func writeJSON(w http.ResponseWriter, data interface{}) {
	enc := json.NewEncoder(w)
	enc.SetEscapeHTML(false)
	_ = enc.Encode(data)
}
