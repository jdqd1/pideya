import { useMemo, useState } from 'react';
import {
  Bike,
  CheckCircle2,
  ChevronRight,
  ChevronUp,
  Clock,
  Filter,
  Gift,
  GlassWater,
  Heart,
  LogIn,
  MapPin,
  Minus,
  Pill,
  Plus,
  Search,
  ShoppingBag,
  ShoppingCart,
  Star,
  Trash2,
  UserRound,
  Utensils,
  WalletCards,
  X,
} from 'lucide-react';
import pideyaLogo from '../assets/pideya-logo.png';
import { ActionButton, EmptyState, Panel, SafeImage, StatusPill } from './Shared';
import type { AppUser, CartItem, Order, PaymentMethod, Product, Storefront } from '../types';
import { formatCurrency, formatTime } from '../utils/format';

type CategoryKey = 'all' | 'restaurants' | 'drinks' | 'pharmacy' | 'shops';

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

const categoryCards = [
  { key: 'restaurants', label: 'Restaurantes', icon: Utensils },
  { key: 'drinks', label: 'Bebidas', icon: GlassWater },
  { key: 'pharmacy', label: 'Farmacias', icon: Pill },
  { key: 'shops', label: 'Tiendas', icon: ShoppingBag },
] as const;

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
  const [query, setQuery] = useState('');
  const [storeType, setStoreType] = useState('Todas');
  const [foodType, setFoodType] = useState('Todas');
  const [sortMode, setSortMode] = useState('Cercania');
  const [categoryKey, setCategoryKey] = useState<CategoryKey>('all');
  const [freeDeliveryOnly, setFreeDeliveryOnly] = useState(false);
  const [activePromo, setActivePromo] = useState(0);
  const [showAllPromos, setShowAllPromos] = useState(false);
  const [favoriteStoreIds, setFavoriteStoreIds] = useState<string[]>([]);
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

  const selectedStore = stores.find((store) => store.id === selectedStoreId) ?? stores[0];
  const heroStore = stores.find((store) => store.type === 'Hamburguesas') ?? selectedStore;

  const storeTypes = useMemo(
    () => ['Todas', ...Array.from(new Set(stores.map((store) => store.type)))],
    [stores],
  );

  const foodTypes = useMemo(
    () => ['Todas', ...Array.from(new Set(products.map((product) => product.category)))],
    [products],
  );

  const promos = useMemo(
    () => [
      {
        title: '20% OFF',
        text: 'en tu primer pedido',
        code: 'Codigo: PIDEYA20',
        className: 'promo-blue',
        imageUrl: heroStore.imageUrl,
      },
      {
        title: 'Envio gratis',
        text: 'en locales seleccionados',
        code: 'Desde hoy',
        className: 'promo-cyan',
        imageUrl: stores.find((store) => store.type === 'Farmacia')?.imageUrl ?? selectedStore.imageUrl,
      },
      {
        title: '15% OFF',
        text: 'en productos de farmacia',
        code: 'Salud y belleza',
        className: 'promo-indigo',
        imageUrl: stores.find((store) => store.type === 'Farmacia')?.imageUrl ?? selectedStore.imageUrl,
      },
      {
        title: 'Combos',
        text: 'para almuerzos rapidos',
        code: 'Locales cerca de vos',
        className: 'promo-violet',
        imageUrl: stores.find((store) => store.type === 'Asiatica')?.imageUrl ?? selectedStore.imageUrl,
      },
    ],
    [heroStore.imageUrl, selectedStore.imageUrl, stores],
  );

  const visibleStores = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    const filteredStores = stores
      .filter((store) => storeType === 'Todas' || store.type === storeType)
      .filter((store) => {
        const storeProducts = products.filter((product) => product.storeId === store.id);

        if (categoryKey === 'restaurants' && ['Farmacia', 'Minimarket'].includes(store.type)) {
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

        if (foodType !== 'Todas' && !storeProducts.some((product) => product.category === foodType)) {
          return false;
        }

        if (freeDeliveryOnly && store.deliveryFee > 1.6) {
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

    return filteredStores.sort((left, right) => {
      if (sortMode === 'Mejor valoracion') {
        return right.rating - left.rating;
      }

      if (sortMode === 'Entrega rapida') {
        return Number(left.deliveryMinutes.split('-')[0]) - Number(right.deliveryMinutes.split('-')[0]);
      }

      return Number(right.open) - Number(left.open) || left.distanceKm - right.distanceKm;
    });
  }, [categoryKey, foodType, freeDeliveryOnly, products, query, sortMode, storeType, stores]);

  const menuProducts = products
    .filter((product) => product.storeId === selectedStore.id)
    .filter((product) => foodType === 'Todas' || product.category === foodType);

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
  const clientHistory = orders.filter((order) => order.customerRegistered).slice(0, 3);

  const selectCategory = (key: CategoryKey) => {
    setCategoryKey(key);
    setStoreType('Todas');
    setFoodType(key === 'drinks' ? 'Bebidas' : 'Todas');
  };

  const selectStore = (storeId: string) => {
    onSelectStore(storeId);
    window.setTimeout(() => {
      document.getElementById('selected-menu')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  };

  const addProductToCart = (product: Product) => {
    onAddToCart(product, selectedOptions[product.id] ?? product.options[0]);
    setCartOpen(true);
    setLastOrderId('');
  };

  const toggleFavorite = (storeId: string) => {
    setFavoriteStoreIds((current) =>
      current.includes(storeId) ? current.filter((id) => id !== storeId) : [...current, storeId],
    );
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

  return (
    <>
      <div className="mobile-home-frame">
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
            <div className="hero-food-stage">
              <SafeImage src={heroStore.imageUrl} alt="" />
              <span>Entrega estimada {heroStore.deliveryMinutes}</span>
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

        <section className="reference-section">
          <div className="reference-section-heading">
            <h2>Promociones y descuentos</h2>
            <button onClick={() => setShowAllPromos((current) => !current)} type="button">
              {showAllPromos ? 'Ver menos' : 'Ver todas'}
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>
          <div className={`promo-row ${showAllPromos ? 'expanded' : ''}`}>
            {promos.map((promo, index) => (
              <button
                className={`promo-card ${promo.className} ${activePromo === index ? 'active' : ''}`}
                key={promo.title}
                onClick={() => setActivePromo(index)}
                type="button"
              >
                <div>
                  <strong>{promo.title}</strong>
                  <span>{promo.text}</span>
                  <small>{promo.code}</small>
                </div>
                <SafeImage src={promo.imageUrl} alt="" />
              </button>
            ))}
          </div>
          <div className="promo-dots" aria-label="Seleccionar promocion">
            {promos.map((promo, index) => (
              <button
                aria-label={promo.title}
                className={activePromo === index ? 'active' : ''}
                key={promo.title}
                onClick={() => setActivePromo(index)}
                type="button"
              />
            ))}
          </div>
        </section>

        <section className="home-filter-chips" aria-label="Filtros rapidos">
          <button
            className={sortMode === 'Cercania' ? 'active' : ''}
            onClick={() => setSortMode('Cercania')}
            type="button"
          >
            <MapPin size={25} aria-hidden="true" />
            <span>Mas cercanos</span>
          </button>
          <button
            className={freeDeliveryOnly ? 'active' : ''}
            onClick={() => setFreeDeliveryOnly((current) => !current)}
            type="button"
          >
            <Bike size={25} aria-hidden="true" />
            <span>Envio economico</span>
          </button>
          <button
            className={sortMode === 'Mejor valoracion' ? 'active' : ''}
            onClick={() => setSortMode('Mejor valoracion')}
            type="button"
          >
            <Star size={25} aria-hidden="true" />
            <span>Mejores restaurantes</span>
          </button>
        </section>

        <section className="reference-section">
          <div className="reference-section-heading">
            <h2>Locales cerca de vos</h2>
            <div className="inline-filters">
              <label>
                <Filter size={16} aria-hidden="true" />
                <select
                  aria-label="Filtrar por tipo de restaurante"
                  onChange={(event) => {
                    setCategoryKey('all');
                    setStoreType(event.target.value);
                  }}
                  value={storeType}
                >
                  {storeTypes.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </label>
              <label>
                <ShoppingCart size={16} aria-hidden="true" />
                <select
                  aria-label="Filtrar por tipo de comida"
                  onChange={(event) => {
                    setCategoryKey('all');
                    setFoodType(event.target.value);
                  }}
                  value={foodType}
                >
                  {foodTypes.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="local-list">
            {visibleStores.map((store, index) => (
              <article className="local-card" key={store.id}>
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
                <button
                  aria-label={`Favorito ${store.name}`}
                  className={`favorite-button ${favoriteStoreIds.includes(store.id) ? 'active' : ''}`}
                  onClick={() => toggleFavorite(store.id)}
                  type="button"
                >
                  <Heart size={27} aria-hidden="true" fill="currentColor" />
                </button>
              </article>
            ))}
          </div>
        </section>

        <Panel
          className="menu-panel menu-home-panel"
          title={`Menu de ${selectedStore.name}`}
          action={<span className="subtle-label">{selectedStore.schedule}</span>}
        >
          <div id="selected-menu" className="store-detail-strip">
            <span>
              <MapPin size={15} aria-hidden="true" /> {selectedStore.address}
            </span>
            <span>
              <WalletCards size={15} aria-hidden="true" /> Delivery{' '}
              {formatCurrency(selectedStore.deliveryFee)}
            </span>
          </div>

          {Object.entries(groupedProducts).length ? (
            <div className="menu-sections">
              {Object.entries(groupedProducts).map(([group, groupProducts]) => (
                <section className="menu-section" key={group}>
                  <div className="menu-section-heading">
                    <h3>{group}</h3>
                    <span>{groupProducts.length} productos</span>
                  </div>
                  <div className="product-grid">
                    {groupProducts.map((product) => (
                      <article
                        className={!product.available ? 'product-card product-tile unavailable' : 'product-card product-tile'}
                        key={product.id}
                      >
                        <SafeImage src={product.imageUrl} alt="" />
                        <div className="product-body">
                          <div>
                            <strong>{product.name}</strong>
                            <p>{product.description}</p>
                          </div>
                          <div className="product-footer">
                            <span>{formatCurrency(product.price)}</span>
                            <label>
                              <span className="sr-only">Opcion para {product.name}</span>
                              <select
                                disabled={!product.available}
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
                            <ActionButton
                              disabled={!product.available || !selectedStore.open}
                              icon={Plus}
                              onClick={() => addProductToCart(product)}
                              variant="primary"
                            >
                              Agregar
                            </ActionButton>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <EmptyState body="Prueba otro tipo de comida o selecciona otra tienda." title="Sin productos" />
          )}
        </Panel>
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
            <div className="cart-sheet-handle" />
            <div className="cart-sheet-heading">
              <div>
                <h2 id="cart-sheet-title">Carrito</h2>
                <span>{cartStore?.name ?? 'Tienda seleccionada'}</span>
              </div>
              <button aria-label="Cerrar carrito" className="icon-button" onClick={() => setCartOpen(false)} type="button">
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            {lastOrderId ? (
              <p className="form-success">Pedido {lastOrderId} reportado a la tienda.</p>
            ) : null}

            {cartProducts.length ? (
              <div className="cart-list sheet-cart-list">
                {cartProducts.map((item) => (
                  <div className="cart-line" key={item.productId}>
                    <div>
                      <strong>{item.product.name}</strong>
                      <span>{item.option}</span>
                      <small>{formatCurrency(item.product.price)}</small>
                    </div>
                    <div className="quantity-stepper">
                      <button
                        aria-label={`Restar ${item.product.name}`}
                        onClick={() => onUpdateCartItem(item.productId, item.quantity - 1)}
                        type="button"
                      >
                        <Minus size={14} aria-hidden="true" />
                      </button>
                      <span>{item.quantity}</span>
                      <button
                        aria-label={`Sumar ${item.product.name}`}
                        onClick={() => onUpdateCartItem(item.productId, item.quantity + 1)}
                        type="button"
                      >
                        <Plus size={14} aria-hidden="true" />
                      </button>
                      <button
                        aria-label={`Eliminar ${item.product.name}`}
                        onClick={() => onRemoveCartItem(item.productId)}
                        type="button"
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ))}

                <div className="totals">
                  <span>
                    Subtotal <strong>{formatCurrency(subtotal)}</strong>
                  </span>
                  <span>
                    Delivery <strong>{formatCurrency(deliveryFee)}</strong>
                  </span>
                  <span className="total-line">
                    Total <strong>{formatCurrency(total)}</strong>
                  </span>
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
                  <ActionButton icon={WalletCards} onClick={() => setCheckoutOpen(true)} variant="primary">
                    Proceder al pago
                  </ActionButton>
                )}
              </div>
            ) : (
              <EmptyState
                body="Agrega productos desde el menu para continuar."
                title="Tu carrito esta vacio"
              />
            )}

            {currentUser ? (
              <div className="compact-history">
                <strong>Historial reciente</strong>
                {clientHistory.map((order) => (
                  <div className="history-row" key={order.id}>
                    <span>{formatTime(order.createdAt)}</span>
                    <div>
                      <strong>{order.id}</strong>
                      <small>{order.customerName}</small>
                    </div>
                    <StatusPill status={order.status} />
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </>
  );
}
