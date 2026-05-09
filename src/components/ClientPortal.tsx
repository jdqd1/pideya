import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Filter,
  History,
  MapPin,
  Minus,
  Plus,
  Search,
  ShoppingCart,
  Star,
  Trash2,
  UserRound,
  WalletCards,
} from 'lucide-react';
import { ActionButton, EmptyState, MetricCard, Panel, SafeImage, StatusPill } from './Shared';
import type { AppUser, CartItem, Order, PaymentMethod, Product, Storefront } from '../types';
import { formatCurrency, formatTime } from '../utils/format';

interface ClientPortalProps {
  stores: Storefront[];
  products: Product[];
  orders: Order[];
  users: AppUser[];
  cart: CartItem[];
  selectedStoreId: string;
  onSelectStore: (storeId: string) => void;
  onAddToCart: (product: Product, option?: string) => void;
  onUpdateCartItem: (productId: string, quantity: number) => void;
  onRemoveCartItem: (productId: string) => void;
  onCreateOrder: (input: {
    customerName: string;
    customerPhone: string;
    customerRegistered: boolean;
    address: string;
    paymentMethod: PaymentMethod;
    notes?: string;
  }) => string | undefined;
}

export function ClientPortal({
  stores,
  products,
  orders,
  users,
  cart,
  selectedStoreId,
  onSelectStore,
  onAddToCart,
  onUpdateCartItem,
  onRemoveCartItem,
  onCreateOrder,
}: ClientPortalProps) {
  const [query, setQuery] = useState('');
  const [storeType, setStoreType] = useState('Todas');
  const [category, setCategory] = useState('Todas');
  const [customerMode, setCustomerMode] = useState<'registered' | 'guest'>('registered');
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestAddress, setGuestAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Pago simulado');
  const [checkoutError, setCheckoutError] = useState('');
  const [lastOrderId, setLastOrderId] = useState('');

  const selectedStore = stores.find((store) => store.id === selectedStoreId) ?? stores[0];
  const registeredClient = users.find((user) => user.role === 'client');

  const storeTypes = useMemo(
    () => ['Todas', ...Array.from(new Set(stores.map((store) => store.type)))],
    [stores],
  );

  const visibleStores = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return stores
      .filter((store) => storeType === 'Todas' || store.type === storeType)
      .filter((store) => {
        if (!normalizedQuery) {
          return true;
        }

        const storeProductNames = products
          .filter((product) => product.storeId === store.id)
          .map((product) => product.name)
          .join(' ');

        return [store.name, store.type, store.tags.join(' '), storeProductNames]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery);
      })
      .sort((left, right) => Number(right.open) - Number(left.open) || left.distanceKm - right.distanceKm);
  }, [products, query, storeType, stores]);

  const categories = useMemo(() => {
    const selectedProducts = products.filter((product) => product.storeId === selectedStore.id);
    return ['Todas', ...Array.from(new Set(selectedProducts.map((product) => product.category)))];
  }, [products, selectedStore.id]);

  const menuProducts = products
    .filter((product) => product.storeId === selectedStore.id)
    .filter((product) => category === 'Todas' || product.category === category);

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
  const clientHistory = orders.filter((order) => order.customerRegistered).slice(0, 3);

  const submitOrder = () => {
    setCheckoutError('');
    setLastOrderId('');

    if (!cartProducts.length) {
      setCheckoutError('Agrega productos al carrito antes de confirmar.');
      return;
    }

    const customerName = customerMode === 'registered' ? registeredClient?.name ?? 'Cliente' : guestName;
    const customerPhone =
      customerMode === 'registered' ? registeredClient?.phone ?? '+58 000-000-0000' : guestPhone;
    const address =
      customerMode === 'registered'
        ? registeredClient?.savedAddresses?.[0] ?? 'Direccion guardada'
        : guestAddress;

    if (!customerName.trim() || !customerPhone.trim() || !address.trim()) {
      setCheckoutError('Completa nombre, telefono y direccion para el pedido invitado.');
      return;
    }

    const orderId = onCreateOrder({
      customerName,
      customerPhone,
      customerRegistered: customerMode === 'registered',
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
    }
  };

  return (
    <div className="role-grid client-grid">
      <Panel className="customer-panel">
        <div className="client-hero">
          <div>
            <span className="zone-label">
              <MapPin size={15} aria-hidden="true" /> Zona Norte, Valencia
            </span>
            <h1>Pide comida, cafe y mercado sin salir de tu zona.</h1>
            <p>
              Explora tiendas cercanas, arma el carrito y confirma un pago simulado para probar el
              flujo completo.
            </p>
          </div>
          <div className="client-metrics">
            <MetricCard
              detail="Tiendas activas"
              icon={CheckCircle2}
              label="Abiertas"
              tone="green"
              value={String(stores.filter((store) => store.open).length)}
            />
            <MetricCard
              detail="Promedio visible"
              icon={Clock}
              label="Entrega"
              tone="amber"
              value="24 min"
            />
          </div>
        </div>

        <div className="search-row">
          <label className="input-shell search-shell">
            <Search size={18} aria-hidden="true" />
            <input
              aria-label="Buscar tiendas o productos"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar arepas, sushi, cafe..."
              value={query}
            />
          </label>
          <label className="input-shell select-shell">
            <Filter size={17} aria-hidden="true" />
            <select
              aria-label="Filtrar por tipo de tienda"
              onChange={(event) => setStoreType(event.target.value)}
              value={storeType}
            >
              {storeTypes.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="store-list" aria-label="Tiendas disponibles">
          {visibleStores.map((store) => (
            <button
              className={`store-card ${store.id === selectedStore.id ? 'selected' : ''}`}
              key={store.id}
              onClick={() => {
                onSelectStore(store.id);
                setCategory('Todas');
              }}
              type="button"
            >
              <SafeImage src={store.imageUrl} alt="" />
              <span className={`store-state ${store.open ? 'open' : 'closed'}`}>
                {store.open ? 'Abierto' : 'Cerrado'}
              </span>
              <strong>{store.name}</strong>
              <small>{store.type}</small>
              <span className="store-meta">
                <Star size={14} aria-hidden="true" /> {store.rating} · {store.distanceKm} km ·{' '}
                {store.deliveryMinutes}
              </span>
            </button>
          ))}
        </div>
      </Panel>

      <Panel
        className="menu-panel"
        title={selectedStore.name}
        action={<span className="subtle-label">{selectedStore.schedule}</span>}
      >
        <div className="store-detail-strip">
          <span>
            <MapPin size={15} aria-hidden="true" /> {selectedStore.address}
          </span>
          <span>
            <WalletCards size={15} aria-hidden="true" /> Delivery{' '}
            {formatCurrency(selectedStore.deliveryFee)}
          </span>
        </div>

        <div className="category-tabs" aria-label="Categorias del menu">
          {categories.map((item) => (
            <button
              className={item === category ? 'active' : ''}
              key={item}
              onClick={() => setCategory(item)}
              type="button"
            >
              {item}
            </button>
          ))}
        </div>

        <div className="product-list">
          {menuProducts.map((product) => (
            <article className={!product.available ? 'product-card unavailable' : 'product-card'} key={product.id}>
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
                    onClick={() => onAddToCart(product, selectedOptions[product.id] ?? product.options[0])}
                    variant="primary"
                  >
                    Agregar
                  </ActionButton>
                </div>
              </div>
            </article>
          ))}
        </div>
      </Panel>

      <aside className="side-stack">
        <Panel title="Cliente">
          <div className="mode-toggle" role="group" aria-label="Tipo de cliente">
            <button
              className={customerMode === 'registered' ? 'active' : ''}
              onClick={() => setCustomerMode('registered')}
              type="button"
            >
              Registrado
            </button>
            <button
              className={customerMode === 'guest' ? 'active' : ''}
              onClick={() => setCustomerMode('guest')}
              type="button"
            >
              Invitado
            </button>
          </div>

          {customerMode === 'registered' ? (
            <div className="profile-card">
              <UserRound size={20} aria-hidden="true" />
              <div>
                <strong>{registeredClient?.name}</strong>
                <span>{registeredClient?.savedAddresses?.[0]}</span>
              </div>
            </div>
          ) : (
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
          )}
        </Panel>

        <Panel
          title="Carrito"
          action={
            <span className="cart-count">
              <ShoppingCart size={15} aria-hidden="true" /> {cartProducts.length}
            </span>
          }
        >
          {lastOrderId ? (
            <p className="form-success">Pedido {lastOrderId} creado y enviado a tienda.</p>
          ) : null}

          {cartProducts.length ? (
            <div className="cart-list">
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

              <textarea
                aria-label="Notas del pedido"
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Notas para la tienda o delivery"
                value={notes}
              />

              <label className="payment-select">
                <CreditCopy />
                <select
                  aria-label="Metodo de pago"
                  onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
                  value={paymentMethod}
                >
                  <option>Pago simulado</option>
                  <option>Pago contra entrega</option>
                </select>
              </label>

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

              {checkoutError ? <p className="form-error">{checkoutError}</p> : null}
              <ActionButton icon={CheckCircle2} onClick={submitOrder} variant="success">
                Confirmar pedido
              </ActionButton>
            </div>
          ) : (
            <EmptyState
              body="El carrito se llena desde el menu de la tienda seleccionada."
              title="Aun no hay productos"
            />
          )}
        </Panel>

        <Panel title="Historial">
          <div className="history-list">
            {clientHistory.map((order) => (
              <div className="history-row" key={order.id}>
                <History size={15} aria-hidden="true" />
                <div>
                  <strong>{order.id}</strong>
                  <span>{formatTime(order.createdAt)}</span>
                </div>
                <StatusPill status={order.status} />
              </div>
            ))}
          </div>
        </Panel>
      </aside>
    </div>
  );
}

function CreditCopy() {
  return <WalletCards aria-hidden="true" size={17} strokeWidth={2.1} />;
}
