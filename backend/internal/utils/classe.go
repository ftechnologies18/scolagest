package utils

import (
	"strconv"
	"strings"
)

// NextClasseLibelle génère le libellé de la prochaine section d'une classe
// lorsque le quota d'effectif est atteint et qu'une nouvelle section doit être
// créée automatiquement.
//
// Convention de nommage ScolaGest (depuis la réforme dénomination 2026-07) :
//
//   - Premier cycle (ex-Collège) : "<niveau> <numéro>"
//     Exemples : "6e 1", "6e 2", "5e 1", "3e 1"
//   - Second cycle (ex-Lycée)    : "<niveau> <série> <numéro>"
//     Séries : A, C, D (enseignement général ivoirien)
//     Exemples : "2nde A 1", "Première C 1", "Terminale D 3"
//   - Primaire / Préscolaire     : libellé simple sans numéro de section
//     Exemples : "CP1", "CP2", "CE1", "CM2", "Petite Section (PS)"
//
// Règle d'incrémentation :
//
//   - Si le libellé se termine par " <nombre>" (un espace suivi d'un entier),
//     on incrémente ce nombre. Exemples :
//       "6e 1"          → "6e 2"
//       "Terminale D 1" → "Terminale D 2"
//       "Terminale D 9" → "Terminale D 10"
//   - Sinon (libellé sans suffixe numérique, ex: "CP1", "CM2", "Petite Section (PS)"),
//     on ajoute " <N>" où N = siblingCount + 1 (la première section créée porte
//     le numéro 2 puisque la classe d'origine est implicitement la "1").
//     Exemples (siblingCount=1) :
//       "CP1"           → "CP1 2"
//       "CM2"           → "CM2 2"
//
// Le paramètre siblingCount est le nombre de classes existantes du même
// (cycle, niveau), en comptant la classe courante. Il n'est utilisé que pour
// le fallback (libellé sans suffixe numérique).
func NextClasseLibelle(current string, siblingCount int) string {
	// Cas 1 : le libellé finit par " <nombre>" → incrémenter ce nombre.
	if idx := strings.LastIndex(current, " "); idx >= 0 {
		suffix := current[idx+1:]
		if n, err := strconv.Atoi(suffix); err == nil && n > 0 {
			return current[:idx+1] + strconv.Itoa(n+1)
		}
	}
	// Cas 2 : pas de suffixe numérique → ajouter " <N>".
	next := siblingCount + 1
	if next < 2 {
		next = 2
	}
	return current + " " + strconv.Itoa(next)
}
