import { Observation, ObservationType } from 'src/modules/users/entities/observation.entity';

export interface CompatibilityResult {
  isCompatible: boolean;
  conflicts: Observation[];
}

export class CompatibilityUtil {
  /**
   * Evaluates if a menu item is compatible with a user's dietary observations.
   * 
   * @param userObservations - The dietary restrictions/preferences of the user.
   * @param itemObservations - The aggregated observations of the menu item (including ingredients).
   */
  static evaluate(
    userObservations: Observation[],
    itemObservations: Observation[],
  ): CompatibilityResult {
    const conflicts: Observation[] = [];
    
    // 1. Check Allergens: User has allergen X + Item has allergen X = Conflict (Avoidance)
    const userAllergens = userObservations.filter(o => o.type === ObservationType.ALLERGEN);
    const itemObservationIds = new Set(itemObservations.map(o => o.id));

    for (const allergen of userAllergens) {
      if (itemObservationIds.has(allergen.id)) {
        conflicts.push(allergen);
      }
    }

    // 2. Check Preferences: User has preference Y + Item LACKS preference Y = Conflict (Requirement)
    const userPreferences = userObservations.filter(o => o.type === ObservationType.PREFERENCE);
    
    for (const preference of userPreferences) {
      if (!itemObservationIds.has(preference.id)) {
        conflicts.push(preference);
      }
    }

    return {
      isCompatible: conflicts.length === 0,
      conflicts,
    };
  }
}
