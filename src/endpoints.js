// Matches forkplan_api openapi.json. `live:false` = planned in .tasks (TASK-032/035) but not in the API yet;
// the UI disables those actions. Flip to true once the backend ships the route.
const live = (method, path) => ({ method, path, live: true });
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
  recipes: {
    list: live('GET', '/v1/catalog/recipes'),
    get: live('GET', '/v1/catalog/recipes/{id}'),
    create: live('POST', '/v1/admin/recipes'),
    presign: live('POST', '/v1/admin/recipes/{id}/image/presign'),
    update: planned('PATCH', '/v1/admin/catalog/recipes/{id}', 'TASK-032'),
    remove: planned('DELETE', '/v1/admin/catalog/recipes/{id}', 'TASK-032'),
    publish: planned('POST', '/v1/admin/catalog/recipes/{id}/publish', 'TASK-032'),
    retire: planned('POST', '/v1/admin/catalog/recipes/{id}/retire', 'TASK-032'),
  },
  ingredients: {
    list: live('GET', '/v1/catalog/ingredients'),
    get: live('GET', '/v1/catalog/ingredients/{id}'),
    create: live('POST', '/v1/admin/ingredients'),
    presign: live('POST', '/v1/admin/ingredients/{id}/image/presign'),
    update: planned('PATCH', '/v1/admin/catalog/ingredients/{id}', 'TASK-032'),
    remove: planned('DELETE', '/v1/admin/catalog/ingredients/{id}', 'TASK-032'),
    publish: planned('POST', '/v1/admin/catalog/ingredients/{id}/publish', 'TASK-032'),
    retire: planned('POST', '/v1/admin/catalog/ingredients/{id}/retire', 'TASK-032'),
  },
  refs: {
    allergens: live('GET', '/v1/allergens'),
    ingredientTags: live('GET', '/v1/ingredient-tags'),
  },
  accounts: {
    search: planned('POST', '/v1/admin/accounts/search', 'TASK-035'),
    get: planned('GET', '/v1/admin/accounts/{id}', 'TASK-035'),
    suspend: planned('POST', '/v1/admin/accounts/{id}/suspend', 'TASK-035'),
    restore: planned('POST', '/v1/admin/accounts/{id}/restore', 'TASK-035'),
    entitlements: planned('GET', '/v1/admin/plan-entitlements', 'TASK-035'),
    updateEntitlement: planned('PATCH', '/v1/admin/plan-entitlements/{tier}', 'TASK-035'),
  },
};

export const ENUMS = {
  mealCategory: ['breakfast', 'lunch', 'dinner', 'snack', 'dessert'],
  unit: ['g', 'kg', 'oz', 'lb', 'ml', 'l', 'tsp', 'tbsp', 'cup', 'fl oz', 'each', 'slice', 'rasher'],
  ingredientCategory: ['MEAT','SEAFOOD','DAIRY','EGGS','VEGETABLE','FRUIT','BREAD_BAKERY','PASTA','RICE_GRAINS','CEREAL','BEANS_LEGUMES','PLANT_PROTEIN','NUT_SEED','HERB_SPICE','OIL_FAT','SAUCE','CONDIMENT','BAKING_COOKING','SWEETS_SNACKS','BEVERAGE','OTHER'],
  dietaryAttribute: ['VEGETARIAN','VEGAN','PESCATARIAN','KETO','PALEO','LOW_CARB','GLUTEN_FREE','DAIRY_FREE','HALAL','KOSHER'],
};
