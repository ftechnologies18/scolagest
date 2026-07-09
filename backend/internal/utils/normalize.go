package utils

import (
	"strings"
	"unicode"
)

// Normalize supprime les accents/diacritiques d'une chaîne et passe en minuscules.
// Utilisé pour la recherche insensible aux accents (ex. "traore" trouve "Traoré").
//
// Implémentation : on itère rune par rune, on passe en minuscule, et on ne
// conserve que les caractères ASCII alphanumériques + espace + tiret.
// Les accents combinants (diacritiques) sont éliminés car leur catégorie
// unicode n'est pas lettre/chiffre.
//
// Exemples :
//
//	Normalize("Traoré") → "traore"
//	Normalize("Kouassi") → "kouassi"
//	Normalize("Élève Affecté") → "eleve affecte"
func Normalize(s string) string {
	var b strings.Builder
	b.Grow(len(s))
	for _, r := range s {
		// Cas particulier : lettres accentuées courantes (précomposées)
		// unicode.ToLower conserve le caractère accentué ; on le décompose manuellement
		// pour les lettres latines accentuées les plus fréquentes en français.
		r = unicode.ToLower(r)
		switch r {
		case 'à', 'â', 'ä':
			b.WriteByte('a')
			continue
		case 'é', 'è', 'ê', 'ë':
			b.WriteByte('e')
			continue
		case 'î', 'ï':
			b.WriteByte('i')
			continue
		case 'ô', 'ö':
			b.WriteByte('o')
			continue
		case 'û', 'ü', 'ù':
			b.WriteByte('u')
			continue
		case 'ç':
			b.WriteByte('c')
			continue
		case 'ñ':
			b.WriteByte('n')
			continue
		}
		// Caractère ASCII imprimable (lettre, chiffre, espace, tiret, underscore)
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == ' ' || r == '-' || r == '_' {
			b.WriteRune(r)
		}
		// Les autres (ponctuation, symboles, diacritiques combinants) sont ignorés
	}
	return b.String()
}

// BuildSearchVector construit un vecteur de recherche normalisé à partir de
// plusieurs champs (nom, prénoms, matricule, identifiant).
func BuildSearchVector(fields ...string) string {
	var parts []string
	for _, f := range fields {
		n := Normalize(f)
		if n != "" {
			parts = append(parts, n)
		}
	}
	return strings.Join(parts, " ")
}
