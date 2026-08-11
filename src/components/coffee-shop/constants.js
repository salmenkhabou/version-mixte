export const TABLE_NUMBER_REGEX = /^[0-9]{1,3}$/;
export const PHONE_REGEX = /^\+?[0-9]{8,15}$/;

export const FAVORITES_STORAGE_KEY = 'coffeeFavorites';
export const CART_ITEMS_STORAGE_KEY = 'brew_cart_items';
export const LAST_ORDER_STORAGE_KEY = 'brew_last_order';

export const ORDER_STATUS_LABEL = {
  pending: 'En attente',
  preparing: 'En preparation',
  served: 'Servie',
  cancelled: 'Annulee',
};
