import { useMemo, useState } from 'react';
import { Bike, LayoutDashboard, ShieldCheck, Store, UserRound } from 'lucide-react';
import './App.css';
import pideyaLogo from './assets/pideya-logo.png';
import { AdminPortal } from './components/AdminPortal';
import { ClientPortal } from './components/ClientPortal';
import { DeliveryPortal } from './components/DeliveryPortal';
import { StorePortal } from './components/StorePortal';
import {
  deliveries as initialDeliveries,
  orders as initialOrders,
  products as initialProducts,
  stores as initialStores,
  users,
} from './data/mockData';
import type { CartItem, Order, OrderStatus, PaymentMethod, Product, Role } from './types';

const roleNavigation: Array<{ id: Role; label: string; icon: typeof UserRound }> = [
  { id: 'client', label: 'Cliente', icon: UserRound },
  { id: 'store', label: 'Tienda', icon: Store },
  { id: 'delivery', label: 'Delivery', icon: Bike },
  { id: 'admin', label: 'Admin', icon: ShieldCheck },
];

function App() {
  const [activeRole, setActiveRole] = useState<Role>('client');
  const [stores, setStores] = useState(initialStores);
  const [products, setProducts] = useState(initialProducts);
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState(initialStores[0].id);
  const [managedStoreId, setManagedStoreId] = useState(initialStores[0].id);

  const activeOrdersCount = useMemo(
    () => orders.filter((order) => !['delivered', 'cancelled'].includes(order.status)).length,
    [orders],
  );

  const addToCart = (product: Product, option?: string) => {
    setSelectedStoreId(product.storeId);
    setCart((currentCart) => {
      const currentStoreId = currentCart[0]
        ? products.find((item) => item.id === currentCart[0].productId)?.storeId
        : product.storeId;

      if (currentStoreId && currentStoreId !== product.storeId) {
        return [{ productId: product.id, quantity: 1, option }];
      }

      const existing = currentCart.find((item) => item.productId === product.id);

      if (existing) {
        return currentCart.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1, option: option ?? item.option }
            : item,
        );
      }

      return [...currentCart, { productId: product.id, quantity: 1, option }];
    });
  };

  const updateCartItem = (productId: string, quantity: number) => {
    setCart((currentCart) => {
      if (quantity <= 0) {
        return currentCart.filter((item) => item.productId !== productId);
      }

      return currentCart.map((item) =>
        item.productId === productId ? { ...item, quantity } : item,
      );
    });
  };

  const removeCartItem = (productId: string) => {
    setCart((currentCart) => currentCart.filter((item) => item.productId !== productId));
  };

  const createOrder = (input: {
    customerName: string;
    customerPhone: string;
    customerRegistered: boolean;
    address: string;
    paymentMethod: PaymentMethod;
    notes?: string;
  }) => {
    const cartProducts = cart
      .map((cartItem) => {
        const product = products.find((item) => item.id === cartItem.productId);
        return product ? { ...cartItem, product } : undefined;
      })
      .filter(Boolean) as Array<CartItem & { product: Product }>;

    if (!cartProducts.length) {
      return undefined;
    }

    const store = stores.find((item) => item.id === cartProducts[0].product.storeId) ?? stores[0];
    const subtotal = cartProducts.reduce(
      (total, item) => total + item.quantity * item.product.price,
      0,
    );
    const nextId = `PY-${1055 + orders.length}`;

    const newOrder: Order = {
      id: nextId,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerRegistered: input.customerRegistered,
      address: input.address,
      storeId: store.id,
      status: 'pending',
      items: cartProducts.map((item) => ({
        productId: item.product.id,
        name: item.product.name,
        quantity: item.quantity,
        price: item.product.price,
        option: item.option,
      })),
      subtotal,
      deliveryFee: store.deliveryFee,
      courierReward: Math.max(2, Number((store.deliveryFee + 0.8).toFixed(2))),
      createdAt: new Date().toISOString(),
      distanceKm: Number((store.distanceKm + 0.8).toFixed(1)),
      paymentMethod: input.paymentMethod,
      notes: input.notes,
    };

    setOrders((currentOrders) => [newOrder, ...currentOrders]);
    setCart([]);
    return nextId;
  };

  const changeOrderStatus = (orderId: string, status: OrderStatus) => {
    setOrders((currentOrders) =>
      currentOrders.map((order) => (order.id === orderId ? { ...order, status } : order)),
    );
  };

  const acceptDelivery = (orderId: string, deliveryId: string) => {
    setOrders((currentOrders) =>
      currentOrders.map((order) => {
        if (order.id !== orderId || order.status !== 'ready' || order.assignedDeliveryId) {
          return order;
        }

        return {
          ...order,
          assignedDeliveryId: deliveryId,
          status: 'assigned',
        };
      }),
    );
  };

  const toggleProduct = (productId: string) => {
    setProducts((currentProducts) =>
      currentProducts.map((product) =>
        product.id === productId ? { ...product, available: !product.available } : product,
      ),
    );
  };

  const addProduct = (product: Omit<Product, 'id'>) => {
    setProducts((currentProducts) => [
      {
        ...product,
        id: `prd-custom-${Date.now()}`,
      },
      ...currentProducts,
    ]);
  };

  const toggleStoreOpen = (storeId: string) => {
    setStores((currentStores) =>
      currentStores.map((storefront) =>
        storefront.id === storeId ? { ...storefront, open: !storefront.open } : storefront,
      ),
    );
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <img src={pideyaLogo} alt="PideYa" />
          <div>
            <strong>PideYa</strong>
            <span>Prototipo operativo · Zona Norte</span>
          </div>
        </div>

        <nav className="role-nav" aria-label="Navegacion por roles">
          {roleNavigation.map(({ id, label, icon: Icon }) => (
            <button
              className={activeRole === id ? 'active' : ''}
              key={id}
              onClick={() => setActiveRole(id)}
              type="button"
            >
              <Icon aria-hidden="true" size={17} strokeWidth={2.2} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="prototype-status">
          <LayoutDashboard size={17} aria-hidden="true" />
          <span>{activeOrdersCount} pedidos activos</span>
        </div>
      </header>

      {activeRole === 'client' ? (
        <ClientPortal
          cart={cart}
          onAddToCart={addToCart}
          onCreateOrder={createOrder}
          onRemoveCartItem={removeCartItem}
          onSelectStore={setSelectedStoreId}
          onUpdateCartItem={updateCartItem}
          orders={orders}
          products={products}
          selectedStoreId={selectedStoreId}
          stores={stores}
          users={users}
        />
      ) : null}

      {activeRole === 'store' ? (
        <StorePortal
          managedStoreId={managedStoreId}
          onAddProduct={addProduct}
          onManagedStoreChange={setManagedStoreId}
          onOrderStatusChange={changeOrderStatus}
          onToggleProduct={toggleProduct}
          onToggleStoreOpen={toggleStoreOpen}
          orders={orders}
          products={products}
          stores={stores}
        />
      ) : null}

      {activeRole === 'delivery' ? (
        <DeliveryPortal
          deliveries={initialDeliveries}
          onAcceptDelivery={acceptDelivery}
          onOrderStatusChange={changeOrderStatus}
          orders={orders}
          stores={stores}
        />
      ) : null}

      {activeRole === 'admin' ? (
        <AdminPortal
          deliveries={initialDeliveries}
          orders={orders}
          products={products}
          stores={stores}
          users={users}
        />
      ) : null}
    </main>
  );
}

export default App;
