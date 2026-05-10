import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  BadgePercent,
  Beef,
  Bike,
  CheckCircle2,
  ChevronRight,
  ChevronUp,
  Clock,
  Coffee,
  CupSoda,
  GlassWater,
  Grid2x2,
  Heart,
  IceCreamBowl,
  LogIn,
  LockKeyhole,
  MapPin,
  Minus,
  Pill,
  Plus,
  Search,
  ShoppingBag,
  ShoppingCart,
  Soup,
  Star,
  Store as StoreIcon,
  Trash2,
  UserRound,
  Utensils,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';
import pideyaLogo from '../assets/pideya-logo.png';
import { ActionButton, EmptyState, SafeImage } from './Shared';
import type { AppUser, CartItem, Order, PaymentMethod, Product, Storefront } from '../types';
import { formatCurrency } from '../utils/format';

type CategoryKey = 'all' | 'restaurants' | 'drinks' | 'pharmacy' | 'shops';
type ClientView = 'home' | 'restaurants';

interface ClientPortalProps {
  stores: Storefront[];
  products: Product[];
  orders: Order[];
  currentUser: AppUser | null;
  cart: CartItem[];
  selectedStoreId: string;
  onSelectStore: (storeId: string) => void;
  onAddToCart: (product: Product, option?: string) => void;
  onUpdateCartItem: (productId: string, quantity: number) => void;
  onRemoveCartItem: (productId: string) => void;
  onOpenLogin: () => void;
  onOpenRegister: () => void;
  onCreateOrder: (input: {
    customerName: string;
    customerPhone: string;
    customerRegistered: boolean;
    address: string;
    paymentMethod: PaymentMethod;
    notes?: string;
  }) => string | undefined;
}

interface FoodFilter {
  value: string;
  label: string;
  icon: LucideIcon;
  tone: string;
}

const categoryCards = [
  { key: 'restaurants', label: 'Restaurantes', icon: Utensils },
  { key: 'drinks', label: 'Bebidas', icon: GlassWater },
  { key: 'pharmacy', label: 'Farmacias', icon: Pill },
  { key: 'shops', label: 'Tiendas', icon: ShoppingBag },
] as const;

const primaryFoodFilters: FoodFilter[] = [
  { value: 'Todas', label: 'Todos', icon: Grid2x2, tone: 'blue' },
  { value: 'Burgers', label: 'Hamburguesas', icon: Beef, tone: 'amber' },
  { value: 'Arepas', label: 'Arepas', icon: Utensils, tone: 'green' },
  { value: 'Sushi', label: 'Asiatica', icon: Soup, tone: 'coral' },
  { value: 'Bebidas', label: 'Bebidas', icon: CupSoda, tone: 'mint' },
  { value: 'Postres', label: 'Postres', icon: IceCreamBowl, tone: 'violet' },
];

const nonRestaurantTypes = ['Farmacia', 'Minimarket'];

const isFoodStore = (store: Storefront) => !nonRestaurantTypes.includes(store.type);

const matchesFoodFilter = (product: Product, foodType: string) =>
  foodType === 'Todas' || product.category === foodType;

const getFoodFilterIcon = (category: string) => {
  if (category === 'Cafe') {
    return Coffee;
  }

  if (category === 'Combos') {
    return BadgePercent;
  }

  if (category === 'Bebidas') {
    return CupSoda;
  }

  return Utensils;
};

const getFoodFilterTone = (index: number) =>
  ['blue', 'amber', 'coral', 'mint', 'violet', 'green'][index % 6];

export function ClientPortal({
  stores,
  products,
  orders,
  currentUser,
  cart,
  selectedStoreId,
  onSelectStore,
  onAddToCart,
  onUpdateCartItem,
  onRemoveCartItem,
  onOpenLogin,
  onOpenRegister,
  onCreateOrder,
}: ClientPortalProps) {
  const [clientView, setClientView] = useState<ClientView>('home');
  const [query, setQuery] = useState('');
  const [foodType, setFoodType] = useState('Todas');
  const [categoryKey, setCategoryKey] = useState<CategoryKey>('all');
  const [showMoreFoodTypes, setShowMoreFoodTypes] = useState(false);
  const [activeRestaurantStoreId, setActiveRestaurantStoreId] = useState<string | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestAddress, setGuestAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Pago simulado');
  const [checkoutError, setCheckoutError] = useState('');
  const [lastOrderId, setLastOrderId] = useState('');

  const activeRestaurantStore = activeRestaurantStoreId
    ? stores.find((store) => store.id === activeRestaurantStoreId) ?? null
    : null;
  const selectedStore = activeRestaurantStore ?? stores.find((store) => store.id === selectedStoreId) ?? stores[0];
  const restaurantStores = useMemo(() => stores.filter(isFoodStore), [stores]);
  const storeById = useMemo(
    () => new Map(stores.map((store) => [store.id, store])),
    [stores],
  );
  const restaurantStoreIds = useMemo(
    () => new Set(restaurantStores.map((store) => store.id)),
    [restaurantStores],
  );

  const extraFoodFilters = useMemo(() => {
    const primaryValues = new Set(primaryFoodFilters.map((filter) => filter.value));
    const categories = Array.from(
      new Set(
        products
          .filter((product) => restaurantStoreIds.has(product.storeId))
          .map((product) => product.category),
      ),
    ).filter((category) => !primaryValues.has(category));

    return categories.slice(0, 6).map((category, index) => ({
      value: category,
      label: category === 'Acompanantes' ? 'Snacks' : category,
      icon: getFoodFilterIcon(category),
      tone: getFoodFilterTone(index + primaryFoodFilters.length),
    }));
  }, [products, restaurantStoreIds]);

  const foodFilters = showMoreFoodTypes
    ? [...primaryFoodFilters, ...extraFoodFilters]
    : primaryFoodFilters;

  const visibleStores = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    const filteredStores = stores.filter((store) => {
      const storeProducts = products.filter((product) => product.storeId === store.id);

      if (categoryKey === 'restaurants' && !isFoodStore(store)) {
        return false;
      }

      if (categoryKey === 'drinks' && !storeProducts.some((product) => product.category === 'Bebidas')) {
        return false;
      }

      if (categoryKey === 'pharmacy' && store.type !== 'Farmacia') {
        return false;
      }

      if (categoryKey === 'shops' && store.type !== 'Minimarket') {
        return false;
      }

      if (foodType !== 'Todas' && !storeProducts.some((product) => matchesFoodFilter(product, foodType))) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return [store.name, store.type, store.tags.join(' '), storeProducts.map((product) => product.name).join(' ')]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery);
    });

    return filteredStores.sort(
      (left, right) => Number(right.open) - Number(left.open) || left.distanceKm - right.distanceKm,
    );
  }, [categoryKey, foodType, products, query, stores]);

  const exploreProducts = useMemo(() => {
    const storeIds = new Set(visibleStores.map((store) => store.id));

    return products.filter(
      (product) => storeIds.has(product.storeId) && matchesFoodFilter(product, foodType),
    );
  }, [foodType, products, visibleStores]);

  const promotedProduct =
    exploreProducts.find((product) => product.category === 'Combos') ??
    exploreProducts.find((product) => product.category === 'Burgers') ??
    exploreProducts[0] ??
    products[0];
  const promotedStore = stores.find((store) => store.id === promotedProduct?.storeId) ?? selectedStore;
  const selectedFoodLabel =
    foodFilters.find((filter) => filter.value === foodType)?.label ?? foodType;

  const cheapestProducts = useMemo(
    () =>
      [...exploreProducts].sort((left, right) => {
        const leftStore = storeById.get(left.storeId);
        const rightStore = storeById.get(right.storeId);

        return (
          left.price - right.price ||
          (leftStore?.distanceKm ?? Number.MAX_SAFE_INTEGER) -
            (rightStore?.distanceKm ?? Number.MAX_SAFE_INTEGER)
        );
      }),
    [exploreProducts, storeById],
  );

  const nearestProducts = useMemo(
    () =>
      [...exploreProducts].sort((left, right) => {
        const leftStore = storeById.get(left.storeId);
        const rightStore = storeById.get(right.storeId);

        return (
          (leftStore?.distanceKm ?? Number.MAX_SAFE_INTEGER) -
            (rightStore?.distanceKm ?? Number.MAX_SAFE_INTEGER) ||
          left.price - right.price
        );
      }),
    [exploreProducts, storeById],
  );

  const productRails = [
    {
      id: 'cheap',
      title: 'Mas economicos',
      products: cheapestProducts,
    },
    {
      id: 'near',
      title: 'Mas cerca',
      products: nearestProducts,
    },
  ];

  const homePreviewProducts = useMemo(() => {
    const preferredIds = ['prd-burger-combo', 'prd-sushi', 'prd-arepa-reina', 'prd-cheesecake'];
    const preferredProducts = preferredIds
      .map((id) => products.find((product) => product.id === id))
      .filter(Boolean) as Product[];
    const fallbackProducts = products.filter((product) => restaurantStoreIds.has(product.storeId));

    return [...preferredProducts, ...fallbackProducts]
      .filter((product, index, list) => list.findIndex((item) => item.id === product.id) === index)
      .slice(0, 4);
  }, [products, restaurantStoreIds]);

  const menuProducts = useMemo(() => {
    if (!activeRestaurantStore) {
      return [];
    }

    return products
      .filter((product) => product.storeId === activeRestaurantStore.id)
      .filter((product) => matchesFoodFilter(product, foodType));
  }, [activeRestaurantStore, foodType, products]);

  const groupedProducts = useMemo(() => {
    return menuProducts.reduce<Record<string, Product[]>>((groups, product) => {
      const next = { ...groups };
      next[product.category] = [...(next[product.category] ?? []), product];
      return next;
    }, {});
  }, [menuProducts]);

  const cartProducts = cart
    .map((cartItem) => {
      const product = products.find((item) => item.id === cartItem.productId);
      return product ? { ...cartItem, product } : undefined;
    })
    .filter(Boolean) as Array<CartItem & { product: Product }>;

  const cartStore = cartProducts[0]
    ? stores.find((store) => store.id === cartProducts[0].product.storeId)
    : selectedStore;
  const subtotal = cartProducts.reduce(
    (total, item) => total + item.product.price * item.quantity,
    0,
  );
  const deliveryFee = cartProducts.length ? cartStore?.deliveryFee ?? 0 : 0;
  const total = subtotal + deliveryFee;
  const cartItemsCount = cartProducts.reduce((sum, item) => sum + item.quantity, 0);
  const getProductCartQuantity = (productId: string) =>
    cart.find((item) => item.productId === productId)?.quantity ?? 0;

  const exploreTitle =
    categoryKey === 'drinks'
      ? 'Bebidas'
      : categoryKey === 'pharmacy'
        ? 'Farmacias'
        : categoryKey === 'shops'
          ? 'Tiendas'
          : 'Restaurantes';

  const selectCategory = (key: CategoryKey) => {
    setClientView('restaurants');
    setCategoryKey(key);
    setActiveRestaurantStoreId(null);
    setFoodType(key === 'drinks' ? 'Bebidas' : 'Todas');
    window.setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0);
  };

  const returnHome = () => {
    setClientView('home');
    setCategoryKey('all');
    setFoodType('Todas');
    setActiveRestaurantStoreId(null);
    window.setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0);
  };

  const selectStore = (storeId: string) => {
    setActiveRestaurantStoreId(storeId);
    onSelectStore(storeId);
    window.setTimeout(() => {
      document.getElementById('restaurant-focus')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  };

  const addProductToCart = (product: Product) => {
    onAddToCart(product, selectedOptions[product.id] ?? product.options[0]);
    setLastOrderId('');
  };

  const scrollToRestaurantResults = () => {
    document.getElementById('restaurant-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const submitOrder = () => {
    setCheckoutError('');
    setLastOrderId('');

    if (!cartProducts.length) {
      setCheckoutError('Agrega productos al carrito antes de confirmar.');
      return;
    }

    const customerName = currentUser ? currentUser.name : guestName;
    const customerPhone = currentUser ? currentUser.phone : guestPhone;
    const address = currentUser ? currentUser.savedAddresses?.[0] ?? '' : guestAddress;

    if (!customerName.trim() || !customerPhone.trim() || !address.trim()) {
      setCheckoutError('Completa nombre, telefono y direccion para reportar el pedido a la tienda.');
      return;
    }

    const orderId = onCreateOrder({
      customerName,
      customerPhone,
      customerRegistered: Boolean(currentUser),
      address,
      paymentMethod,
      notes,
    });

    if (orderId) {
      setLastOrderId(orderId);
      setGuestName('');
      setGuestPhone('');
      setGuestAddress('');
      setNotes('');
      setCheckoutOpen(false);
    }
  };

  const renderProductQuantityControl = (product: Product, disabled: boolean, className = '') => {
    const quantity = getProductCartQuantity(product.id);

    if (!quantity) {
      return (
        <button
          aria-label={`Agregar ${product.name}`}
          className={`product-add-button ${className}`.trim()}
          disabled={disabled}
          onClick={() => addProductToCart(product)}
          type="button"
        >
          <Plus size={25} aria-hidden="true" />
        </button>
      );
    }

    return (
      <div className={`product-quantity-control ${className}`.trim()}>
        <button
          className={quantity === 1 ? 'danger-stepper-button' : ''}
          aria-label={quantity === 1 ? `Eliminar ${product.name}` : `Restar ${product.name}`}
          onClick={() =>
            quantity === 1
              ? onRemoveCartItem(product.id)
              : onUpdateCartItem(product.id, quantity - 1)
          }
          type="button"
        >
          {quantity === 1 ? (
            <Trash2 size={17} aria-hidden="true" />
          ) : (
            <Minus size={18} aria-hidden="true" />
          )}
        </button>
        <span>{quantity}</span>
        <button
          aria-label={`Sumar ${product.name}`}
          disabled={disabled}
          onClick={() => addProductToCart(product)}
          type="button"
        >
          <Plus size={18} aria-hidden="true" />
        </button>
      </div>
    );
  };

  const renderDishCard = (product: Product, compact = false) => {
    const productStore = stores.find((store) => store.id === product.storeId);
    const isUnavailable = !product.available || productStore?.open === false;
    const badgeText = product.category === 'Combos' ? 'Mas vendido' : product.category;
    const renderBadge = () => (
      <span className="dish-badge">
        <Star size={14} aria-hidden="true" fill="currentColor" />
        {isUnavailable ? 'No disponible' : badgeText}
      </span>
    );

    return (
      <article
        className={`dish-card ${compact ? 'compact' : ''} ${isUnavailable ? 'unavailable' : ''}`.trim()}
        key={product.id}
      >
        <SafeImage src={product.imageUrl} alt="" />
        <div className="dish-card-body">
          <div>
            <div className={`dish-title-row ${compact ? 'compact-title' : ''}`.trim()}>
              <strong>{product.name}</strong>
              {compact ? (
                renderBadge()
              ) : (
                <button aria-label={`Guardar ${product.name}`} className="dish-favorite" type="button">
                  <Heart size={22} aria-hidden="true" />
                </button>
              )}
            </div>
            <p>{product.description}</p>
          </div>
          {!compact ? (
            <div className="dish-meta-row">
              {renderBadge()}
              {product.options.length > 1 ? (
                <label className="dish-option">
                  <span className="sr-only">Opcion para {product.name}</span>
                  <select
                    disabled={isUnavailable}
                    onChange={(event) =>
                      setSelectedOptions((current) => ({
                        ...current,
                        [product.id]: event.target.value,
                      }))
                    }
                    value={selectedOptions[product.id] ?? product.options[0] ?? ''}
                  >
                    {product.options.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
          ) : null}
          <div className="dish-footer">
            <span>{formatCurrency(product.price)}</span>
            {renderProductQuantityControl(product, isUnavailable, 'dish-add-button')}
          </div>
        </div>
      </article>
    );
  };

  const renderStoreCard = (store: Storefront, index: number) => (
    <article className="local-card restaurant-store-card" key={store.id}>
      <button className="local-card-main" onClick={() => selectStore(store.id)} type="button">
        <SafeImage src={store.imageUrl} alt="" />
        <div className="local-info">
          <div className="local-title-row">
            <h3>{store.name}</h3>
            {index === 0 ? <span>Destacado</span> : null}
          </div>
          <p>{store.type} | {store.tags.slice(0, 2).join(' | ')}</p>
          <div className="local-meta">
            <span>
              <Star size={17} aria-hidden="true" fill="currentColor" /> {store.rating}
            </span>
            <span>
              <MapPin size={17} aria-hidden="true" /> {store.distanceKm} km
            </span>
          </div>
          <div className="local-delivery-row">
            <span>
              <Clock size={21} aria-hidden="true" />
              <strong>{store.deliveryMinutes}</strong>
              Entrega estimada
            </span>
            <span>
              <Bike size={21} aria-hidden="true" />
              <strong>{formatCurrency(store.deliveryFee)}</strong>
              Envio
            </span>
          </div>
        </div>
      </button>
    </article>
  );

  const renderRailProductCard = (product: Product, rank: number) => {
    const productStore = storeById.get(product.storeId);
    const isUnavailable = !product.available || productStore?.open === false;

    return (
      <article className={`rail-product-card ${isUnavailable ? 'unavailable' : ''}`.trim()} key={product.id}>
        <button
          aria-label={`Ver ${product.name} en ${productStore?.name ?? 'local cercano'}`}
          className="rail-product-main"
          onClick={() => productStore && selectStore(productStore.id)}
          type="button"
        >
          <SafeImage src={product.imageUrl} alt="" />
          <div className="rail-product-image-meta">
            <span className="rail-product-rank">#{rank + 1}</span>
            <span className="rail-product-rating">
              <Star size={13} aria-hidden="true" fill="currentColor" />
              {productStore?.rating ?? '4.8'}
            </span>
          </div>
        </button>
        <div className="rail-product-body">
          <strong>{product.name}</strong>
          <span>{productStore?.name ?? 'Local cercano'}</span>
          <div className="rail-product-footer">
            <b>{formatCurrency(product.price)}</b>
            {renderProductQuantityControl(product, isUnavailable, 'rail-add-button')}
          </div>
        </div>
      </article>
    );
  };

  const renderRailSeeAllCard = (railTitle: string) => (
    <button className="rail-see-all-card" key={`${railTitle}-see-all`} onClick={scrollToRestaurantResults} type="button">
      <span>
        <StoreIcon size={24} aria-hidden="true" />
      </span>
      <strong>Ver todos</strong>
      <small>{railTitle}</small>
      <ChevronRight size={24} aria-hidden="true" />
    </button>
  );

  return (
    <>
      <div className="mobile-home-frame">
        {clientView === 'home' ? (
          <>
            <section className="reference-hero">
              <div className="reference-hero-top">
                <div className="hero-brand">
                  <img src={pideyaLogo} alt="PideYa" />
                  <strong>Pide<span>Ya</span></strong>
                </div>
                <div className="hero-auth-actions">
                  <button className="hero-auth ghost" onClick={onOpenLogin} type="button">
                    <UserRound size={20} aria-hidden="true" />
                    <span>Iniciar sesion</span>
                  </button>
                  <button className="hero-auth primary" onClick={onOpenRegister} type="button">
                    <Plus size={20} aria-hidden="true" />
                    <span>Registrarse</span>
                  </button>
                </div>
              </div>
              <div className="hero-content">
                <div>
                  <h1>Todo lo que necesitas, cuando lo necesitas.</h1>
                  <p>Pedidos rapidos en tu zona con tiendas, restaurantes y delivery cerca.</p>
                </div>
              </div>
            </section>

            <label className="reference-search">
              <Search size={34} aria-hidden="true" />
              <input
                aria-label="Buscar tiendas o productos"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Busca restaurantes o productos..."
                value={query}
              />
            </label>

            <section className="reference-categories" aria-label="Categorias principales">
              {categoryCards.map(({ key, label, icon: Icon }) => (
                <button
                  className={categoryKey === key ? 'active' : ''}
                  key={key}
                  onClick={() => selectCategory(key)}
                  type="button"
                >
                  <span className={`category-icon category-${key}`}>
                    <Icon size={42} aria-hidden="true" strokeWidth={2.1} />
                  </span>
                  <strong>{label}</strong>
                </button>
              ))}
            </section>

            <section className="reference-section home-products-section">
              <div className="reference-section-heading">
                <h2>Productos populares</h2>
                <button onClick={() => selectCategory('restaurants')} type="button">
                  Ver restaurantes
                  <ChevronRight size={18} aria-hidden="true" />
                </button>
              </div>
              <div className="home-product-preview-list">
                {homePreviewProducts.map((product) => renderDishCard(product, true))}
              </div>
            </section>
          </>
        ) : (
          <section className="restaurant-app-page" aria-labelledby="restaurant-page-title">
            <div className="restaurant-topbar">
              <button aria-label="Volver al inicio" className="restaurant-back-button" onClick={returnHome} type="button">
                <ArrowLeft size={28} aria-hidden="true" />
              </button>
              <label className="restaurant-search">
                <Search size={28} aria-hidden="true" />
                <input
                  aria-label={`Buscar en ${exploreTitle}`}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Busca productos..."
                  value={query}
                />
              </label>
            </div>

            <nav className="food-type-scroll" aria-label="Tipos de comida">
              {foodFilters.map(({ value, label, icon: Icon, tone }) => (
                <button
                  className={foodType === value ? `food-type-button active tone-${tone}` : `food-type-button tone-${tone}`}
                  key={value}
                  onClick={() => setFoodType(value)}
                  type="button"
                >
                  <span>
                    <Icon size={30} aria-hidden="true" strokeWidth={2.1} />
                  </span>
                  <strong>{label}</strong>
                </button>
              ))}
              {extraFoodFilters.length ? (
                <button
                  className={showMoreFoodTypes ? 'food-type-button more active' : 'food-type-button more'}
                  onClick={() => setShowMoreFoodTypes((current) => !current)}
                  type="button"
                >
                  <span>
                    <Grid2x2 size={30} aria-hidden="true" strokeWidth={2.1} />
                  </span>
                  <strong>Mas</strong>
                </button>
              ) : null}
            </nav>

            <div id="restaurant-focus" />

            {activeRestaurantStore ? (
              <article className="store-spotlight-card">
                <SafeImage src={activeRestaurantStore.imageUrl} alt="" />
                <div className="store-spotlight-content">
                  <span className="spotlight-kicker">
                    <StoreIcon size={17} aria-hidden="true" />
                    {activeRestaurantStore.open ? 'Abierto ahora' : 'Cerrado'}
                  </span>
                  <h2 id="restaurant-page-title">{activeRestaurantStore.name}</h2>
                  <p>{activeRestaurantStore.type} | {activeRestaurantStore.tags.join(' | ')}</p>
                  <div className="spotlight-meta">
                    <span>
                      <Star size={16} aria-hidden="true" fill="currentColor" /> {activeRestaurantStore.rating}
                    </span>
                    <span>
                      <Clock size={16} aria-hidden="true" /> {activeRestaurantStore.deliveryMinutes}
                    </span>
                    <span>
                      <Bike size={16} aria-hidden="true" /> {formatCurrency(activeRestaurantStore.deliveryFee)}
                    </span>
                  </div>
                  <div className="store-address-line">
                    <MapPin size={16} aria-hidden="true" />
                    <span>{activeRestaurantStore.address}</span>
                  </div>
                  <button className="clear-store-button" onClick={() => setActiveRestaurantStoreId(null)} type="button">
                    Ver otros locales
                  </button>
                </div>
              </article>
            ) : promotedProduct ? (
              <article className="featured-deal-card">
                <div className="featured-deal-copy">
                  <span>
                    <BadgePercent size={17} aria-hidden="true" />
                    Oferta especial
                  </span>
                  <h2 id="restaurant-page-title">{promotedProduct.name}</h2>
                  <p>{promotedProduct.description}</p>
                  <div className="featured-price-row">
                    <strong>{formatCurrency(promotedProduct.price)}</strong>
                    <s>{formatCurrency(Number((promotedProduct.price * 1.35).toFixed(2)))}</s>
                  </div>
                  {renderProductQuantityControl(
                    promotedProduct,
                    !promotedProduct.available || !promotedStore.open,
                    'featured-quantity-control',
                  )}
                </div>
                <SafeImage src={promotedProduct.imageUrl} alt="" />
                <b>25%<small>OFF</small></b>
              </article>
            ) : null}

            <section className="restaurant-content-section">
              {activeRestaurantStore ? (
                <>
                  <div className="restaurant-section-heading">
                    <div>
                      <h2>{`Productos de ${activeRestaurantStore.name}`}</h2>
                      <span>{`${menuProducts.length} productos disponibles`}</span>
                    </div>
                  </div>

                  {Object.entries(groupedProducts).length ? (
                    <div className="menu-product-list">
                      {Object.entries(groupedProducts).map(([group, groupProducts]) => (
                        <section className="restaurant-product-group" key={group}>
                          <div className="menu-section-heading">
                            <h3>{group}</h3>
                            <span>{groupProducts.length} productos</span>
                          </div>
                          <div className="dish-list">
                            {groupProducts.map((product) => renderDishCard(product))}
                          </div>
                        </section>
                      ))}
                    </div>
                  ) : (
                    <EmptyState body="Prueba otro tipo de comida o selecciona otro local." title="Sin productos" />
                  )}
                </>
              ) : (
                <>
                  {exploreProducts.length ? (
                    <div className="product-rail-stack">
                      {productRails.map((rail) => (
                        <section className="product-rail-section" key={`${foodType}-${rail.id}`}>
                          <div className="product-rail-heading">
                            <h3>{rail.title}</h3>
                            <small>{rail.products.length}</small>
                          </div>
                          <div className="product-rail-scroll" key={`${foodType}-${rail.id}-scroll`}>
                            {rail.products.map((product, index) => renderRailProductCard(product, index))}
                            {rail.products.length > 2 ? renderRailSeeAllCard(rail.title) : null}
                          </div>
                        </section>
                      ))}
                    </div>
                  ) : (
                    <EmptyState body="Prueba otro tipo de comida o ajusta la busqueda." title="Sin productos" />
                  )}

                  <div id="restaurant-results" className="restaurant-section-heading restaurant-results-heading">
                    <div>
                      <h2>
                        {foodType === 'Todas'
                          ? `${exploreTitle} cerca de vos`
                          : `Restaurantes que venden ${selectedFoodLabel}`}
                      </h2>
                      <span>{`${visibleStores.length} locales disponibles`}</span>
                    </div>
                  </div>

                  {visibleStores.length ? (
                    <div className="local-list restaurant-local-list">
                      {visibleStores.map((store, index) => renderStoreCard(store, index))}
                    </div>
                  ) : (
                    <EmptyState body="Prueba otro tipo de comida o ajusta la busqueda." title="Sin locales" />
                  )}
                </>
              )}
            </section>
          </section>
        )}
      </div>

      {cartItemsCount ? (
        <button className="cart-launcher" onClick={() => setCartOpen(true)} type="button">
          <ShoppingCart size={18} aria-hidden="true" />
          <span>Ver carrito</span>
          <strong>{cartItemsCount} | {formatCurrency(total)}</strong>
          <ChevronUp size={17} aria-hidden="true" />
        </button>
      ) : null}

      {cartOpen ? (
        <div className="cart-sheet-backdrop" role="presentation" onClick={() => setCartOpen(false)}>
          <section
            aria-labelledby="cart-sheet-title"
            className="cart-sheet"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="cart-sheet-hero">
              <div className="cart-title-row">
                <button aria-label="Cerrar carrito" className="cart-back-button" onClick={() => setCartOpen(false)} type="button">
                  <ArrowLeft size={28} aria-hidden="true" />
                </button>
                <div className="cart-sheet-heading">
                  <h2 id="cart-sheet-title">Mi carrito</h2>
                  <span>{cartItemsCount} productos</span>
                </div>
              </div>
            </div>

            {lastOrderId ? (
              <p className="form-success">Pedido {lastOrderId} reportado a la tienda.</p>
            ) : null}

            {cartProducts.length ? (
              <>
                <div className="cart-items-panel">
                  {cartProducts.map((item) => (
                    <article className="cart-line" key={item.productId}>
                      <SafeImage src={item.product.imageUrl} alt="" />
                      <div className="cart-line-info">
                        <strong>{item.product.name}</strong>
                        <b>{formatCurrency(item.product.price)}</b>
                      </div>
                      <div className="quantity-stepper">
                        <button
                          className={item.quantity === 1 ? 'danger-stepper-button' : ''}
                          aria-label={item.quantity === 1 ? `Eliminar ${item.product.name}` : `Restar ${item.product.name}`}
                          onClick={() =>
                            item.quantity === 1
                              ? onRemoveCartItem(item.productId)
                              : onUpdateCartItem(item.productId, item.quantity - 1)
                          }
                          type="button"
                        >
                          {item.quantity === 1 ? (
                            <Trash2 size={17} aria-hidden="true" />
                          ) : (
                            <Minus size={18} aria-hidden="true" />
                          )}
                        </button>
                        <span>{item.quantity}</span>
                        <button
                          aria-label={`Sumar ${item.product.name}`}
                          onClick={() => onUpdateCartItem(item.productId, item.quantity + 1)}
                          type="button"
                        >
                          <Plus size={18} aria-hidden="true" />
                        </button>
                      </div>
                    </article>
                  ))}
                </div>

                {checkoutOpen ? (
                  <div className="checkout-section">
                    {currentUser ? (
                      <div className="profile-card">
                        <UserRound size={20} aria-hidden="true" />
                        <div>
                          <strong>{currentUser.name}</strong>
                          <span>{currentUser.savedAddresses?.[0]}</span>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="login-nudge">
                          <span>Compra como invitado o inicia sesion para guardar tu direccion.</span>
                          <button onClick={onOpenLogin} type="button">
                            <LogIn size={15} aria-hidden="true" /> Entrar
                          </button>
                        </div>
                        <div className="checkout-fields">
                          <input
                            aria-label="Nombre del cliente invitado"
                            onChange={(event) => setGuestName(event.target.value)}
                            placeholder="Nombre"
                            value={guestName}
                          />
                          <input
                            aria-label="Telefono del cliente invitado"
                            onChange={(event) => setGuestPhone(event.target.value)}
                            placeholder="Telefono"
                            value={guestPhone}
                          />
                          <textarea
                            aria-label="Direccion de entrega"
                            onChange={(event) => setGuestAddress(event.target.value)}
                            placeholder="Direccion de entrega"
                            value={guestAddress}
                          />
                        </div>
                      </>
                    )}

                    <textarea
                      aria-label="Notas del pedido"
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Notas para la tienda o delivery"
                      value={notes}
                    />

                    <label className="payment-select">
                      <WalletCards aria-hidden="true" size={17} strokeWidth={2.1} />
                      <select
                        aria-label="Metodo de pago"
                        onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
                        value={paymentMethod}
                      >
                        <option>Pago simulado</option>
                        <option>Pago contra entrega</option>
                      </select>
                    </label>

                    {checkoutError ? <p className="form-error">{checkoutError}</p> : null}

                    <ActionButton icon={CheckCircle2} onClick={submitOrder} variant="success">
                      Reportar a tienda
                    </ActionButton>
                  </div>
                ) : (
                  <div className="cart-summary-panel">
                    <div className="totals">
                      <span>
                        Subtotal <strong>{formatCurrency(subtotal)}</strong>
                      </span>
                      <span>
                        Envio <strong>{formatCurrency(deliveryFee)}</strong>
                      </span>
                      <span className="total-line">
                        Total <strong>{formatCurrency(total)}</strong>
                      </span>
                    </div>
                    <button className="cart-continue-button" onClick={() => setCheckoutOpen(true)} type="button">
                      <span>Continuar</span>
                      <strong>{formatCurrency(total)}</strong>
                      <ChevronRight size={28} aria-hidden="true" />
                    </button>
                    <span className="secure-payment-note">
                      <LockKeyhole size={16} aria-hidden="true" />
                      Pago seguro
                    </span>
                  </div>
                )}
              </>
            ) : (
              <EmptyState
                body="Agrega productos desde el menu para continuar."
                title="Tu carrito esta vacio"
              />
            )}

          </section>
        </div>
      ) : null}
    </>
  );
}
