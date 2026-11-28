// Matches forkplan_api openapi.json. `live:false` = planned but not in the API yet; ActionButton disables
// those actions. Flip to `live` once the backend ships the route.
const live = (method, path) => ({ method, path, live: true });
// eslint-disable-next-line no-unused-vars
const planned = (method, path, task) => ({ method, path, live: false, task });

export const E = {
  dietTags: {
    list: live('GET', '/v1/diet-tags'),
    create: live('POST', '/v1/admin/diet-tags'),
    update: live('PATCH', '/v1/admin/diet-tags/{id}'),
    deactivate: live('DELETE', '/v1/admin/diet-tags/{id}'),
    getRule: live('GET', '/v1/diet-tags/{id}/rule'),
    putRule: live('PUT', '/v1/admin/diet-tags/{id}/rule'),
    deleteRule: live('DELETE', '/v1/admin/diet-tags/{id}/rule'),
  },
  // Admin catalog routes see every status (DRAFT / PUBLISHED / RETIRED). Writes need If-Match.
  recipes: {
    list: live('GET', '/v1/admin/recipes'),
    get: live('GET', '/v1/admin/recipes/{id}'),
    create: live('POST', '/v1/admin/recipes'),
    presign: live('POST', '/v1/admin/recipes/{id}/image/presign'),
    update: live('PATCH', '/v1/admin/recipes/{id}'),
    remove: live('DELETE', '/v1/admin/recipes/{id}'),
    publish: live('POST', '/v1/admin/recipes/{id}/publish'),
    retire: live('POST', '/v1/admin/recipes/{id}/retire'),
  },
  ingredients: {
    list: live('GET', '/v1/admin/ingredients'),
    get: live('GET', '/v1/admin/ingredients/{id}'),
    create: live('POST', '/v1/admin/ingredients'),
    presign: live('POST', '/v1/admin/ingredients/{id}/image/presign'),
    update: live('PATCH', '/v1/admin/ingredients/{id}'),
    remove: live('DELETE', '/v1/admin/ingredients/{id}'),
    publish: live('POST', '/v1/admin/ingredients/{id}/publish'),
    retire: live('POST', '/v1/admin/ingredients/{id}/retire'),
  },
  refs: {
    allergens: live('GET', '/v1/allergens'),
    ingredientTags: live('GET', '/v1/ingredient-tags'),
  },
  accounts: {
    search: live('POST', '/v1/admin/accounts/search'),
    get: live('GET', '/v1/admin/accounts/{id}'),
    purge: live('DELETE', '/v1/admin/accounts/{id}'),
    suspend: live('POST', '/v1/admin/accounts/{id}/suspend'),
    restore: live('POST', '/v1/admin/accounts/{id}/restore'),
    restoreDeleted: live('POST', '/v1/admin/accounts/{id}/restore-deleted'),
    subscription: live('GET', '/v1/admin/accounts/{id}/subscription'),
    setOverride: live('PUT', '/v1/admin/accounts/{id}/subscription/override'),
    clearOverride: live('POST', '/v1/admin/accounts/{id}/subscription/override/clear'),
    quotaOverride: live('GET', '/v1/admin/accounts/{id}/quota-overrides'),
    putQuotaOverride: live('PUT', '/v1/admin/accounts/{id}/quota-overrides'),
    deleteQuotaOverride: live('DELETE', '/v1/admin/accounts/{id}/quota-overrides'),
  },
  plans: {
    list: live('GET', '/v1/admin/plan-entitlements'),
    get: live('GET', '/v1/admin/plan-entitlements/{tier}'),
    update: live('PATCH', '/v1/admin/plan-entitlements/{tier}'),
  },
};

export const ENUMS = {
  mealCategory: ['breakfast', 'lunch', 'dinner', 'snack', 'dessert'],
  unit: ['g', 'kg', 'oz', 'lb', 'ml', 'l', 'tsp', 'tbsp', 'cup', 'fl oz', 'each', 'slice', 'rasher'],
  ingredientCategory: ['MEAT','SEAFOOD','DAIRY','EGGS','VEGETABLE','FRUIT','BREAD_BAKERY','PASTA','RICE_GRAINS','CEREAL','BEANS_LEGUMES','PLANT_PROTEIN','NUT_SEED','HERB_SPICE','OIL_FAT','SAUCE','CONDIMENT','BAKING_COOKING','SWEETS_SNACKS','BEVERAGE','OTHER'],
  dietaryAttribute: ['VEGETARIAN','VEGAN','PESCATARIAN','KETO','PALEO','LOW_CARB','GLUTEN_FREE','DAIRY_FREE','HALAL','KOSHER'],
  accountStatus: ['ACTIVE', 'SUSPENDED', 'DELETED'],
  tier: ['FREE', 'PRO', 'ULTRA'],
  subscriptionStatus: ['ACTIVE', 'GRACE_PERIOD', 'EXPIRED', 'CANCELLED'],
};

// Limits shared by plan entitlements and per-account quota overrides: [key, label, 'int' | 'bool'].
export const ENTITLEMENTS = [
  ['max_recipes', 'Recipes', 'int'],
  ['max_favourite_recipes', 'Favourite recipes', 'int'],
  ['max_meal_plans', 'Meal plans', 'int'],
  ['max_shopping_lists', 'Shopping lists', 'int'],
  ['max_pantry_items', 'Pantry items', 'int'],
  ['meal_plan_generation_enabled', 'Meal plan generation', 'bool'],
  ['max_generations_per_month', 'Generations per month', 'int'],
  ['ai_enabled', 'AI features', 'bool'],
];
