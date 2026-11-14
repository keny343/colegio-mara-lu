"""Validação de equivalência e qualidade entre destinos."""

from .equivalence import validate_destinations, compute_fingerprint, quality_rules

__all__ = ["validate_destinations", "compute_fingerprint", "quality_rules"]
