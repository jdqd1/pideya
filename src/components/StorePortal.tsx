import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  PackageCheck,
  Phone,
  Plus,
  Power,
  Store,
  Tags,
  XCircle,
} from 'lucide-react';
import { ActionButton, EmptyState, MetricCard, Panel, SafeImage, StatusPill } from './Shared';
import type { Order, OrderStatus, Product, Storefront } from '../types';
import { formatCurrency, formatTime } from '../utils/format';

interface StorePortalProps {
  stores: Storefront[];
  products: Product[];
  orders: Order[];
  managedStoreId: string;
  onManagedStoreChange: (storeId: string) => void;
  onOrderStatusChange: (orderId: string, status: OrderStatus) => void;
  onToggleProduct: (productId: string) => void;
  onAddProduct: (product: Omit<Product, 'id'>) => void;
  onToggleStoreOpen: (storeId: string) => void;
}

const productImageFallback =
  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=700&q=80';

export function StorePortal({
  stores,
  products,
  orders,
  managedStoreId,
  onManagedStoreChange,
  onOrderStatusChange,
  onToggleProduct,
  onAddProduct,
  onToggleStoreOpen,
}: StorePortalProps) {
  const [draftName, setDraftName] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftPrice, setDraftPrice] = useState('5.00');
  const [draftCategory, setDraftCategory] = useState('Especiales');
  const [draftStock, setDraftStock] = useState('10');
  const [draftOptions, setDraftOptions] = useState('Extra salsa, Sin cebolla');

  const store = stores.find((item) => item.id === managedStoreId) ?? stores[0];
  const storeProducts = products.filter((product) => product.storeId === store.id);
  const storeOrders = orders.filter((order) => order.storeId === store.id);

  const dashboard = useMemo(
    () => ({
      newOrders: storeOrders.filter((order) => order.status === 'pending').length,
      preparing: storeOrders.filter((order) =>
        ['accepted', 'preparing'].includes(order.status),
      ).length,
      ready: storeOrders.filter((order) => order.status === 'ready').length,
      completed: storeOrders.filter((order) => order.status === 'delivered').length,
    }),
    [storeOrders],
  );

  const submitProduct = () => {
    const price = Number(draftPrice);
    const stock = Number(draftStock);

    if (!draftName.trim() || !draftDescription.trim() || Number.isNaN(price) || Number.isNaN(stock)) {
      return;
    }

    onAddProduct({
      storeId: store.id,
      name: draftName.trim(),
      description: draftDescription.trim(),
      price,
      category: draftCategory.trim() || 'Especiales',
      imageUrl: productImageFallback,
      available: true,
      stock,
      options: draftOptions
        .split(',')
        .map((option) => option.trim())
        .filter(Boolean),
    });

    setDraftName('');
    setDraftDescription('');
    setDraftPrice('5.00');
    setDraftCategory('Especiales');
    setDraftStock('10');
  };

  return (
    <div className="role-grid store-grid">
      <Panel className="store-command">
        <div className="workspace-title">
          <div>
            <span className="zone-label">
              <Store size={15} aria-hidden="true" /> Portal de tienda
            </span>
            <h1>Gestiona pedidos, productos y disponibilidad.</h1>
            <p>
              Esta vista simula el flujo de operacion diaria para que una tienda pueda vender sin
              tocar configuraciones tecnicas.
            </p>
          </div>
          <label className="input-shell select-shell">
            <Store size={17} aria-hidden="true" />
            <select
              aria-label="Seleccionar tienda administrada"
              onChange={(event) => onManagedStoreChange(event.target.value)}
              value={store.id}
            >
              {stores.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="metrics-grid">
          <MetricCard detail="Sin aceptar" icon={Clock} label="Nuevos" tone="coral" value={String(dashboard.newOrders)} />
          <MetricCard detail="Cocina activa" icon={PackageCheck} label="Preparando" tone="amber" value={String(dashboard.preparing)} />
          <MetricCard detail="Para delivery" icon={CheckCircle2} label="Listos" tone="green" value={String(dashboard.ready)} />
          <MetricCard detail="Hoy" icon={Tags} label="Productos" tone="blue" value={String(storeProducts.length)} />
        </div>
      </Panel>

      <Panel
        className="orders-panel"
        title="Pedidos de la tienda"
        action={<span className={store.open ? 'store-state open' : 'store-state closed'}>{store.open ? 'Abierta' : 'Cerrada'}</span>}
      >
        {storeOrders.length ? (
          <div className="order-list">
            {storeOrders.map((order) => (
              <article className="order-card" key={order.id}>
                <div className="order-card-header">
                  <div>
                    <strong>{order.id}</strong>
                    <span>{order.customerName} · {formatTime(order.createdAt)}</span>
                  </div>
                  <StatusPill status={order.status} />
                </div>
                <div className="order-items">
                  {order.items.map((item) => (
                    <span key={`${order.id}-${item.productId}`}>
                      {item.quantity}x {item.name}
                    </span>
                  ))}
                </div>
                <div className="order-card-footer">
                  <span>{formatCurrency(order.subtotal + order.deliveryFee)}</span>
                  <div className="button-row">
                    {order.status === 'pending' ? (
                      <>
                        <ActionButton
                          icon={CheckCircle2}
                          onClick={() => onOrderStatusChange(order.id, 'accepted')}
                          variant="success"
                        >
                          Aceptar
                        </ActionButton>
                        <ActionButton
                          icon={XCircle}
                          onClick={() => onOrderStatusChange(order.id, 'cancelled')}
                          variant="danger"
                        >
                          Rechazar
                        </ActionButton>
                      </>
                    ) : null}
                    {order.status === 'accepted' ? (
                      <ActionButton
                        icon={PackageCheck}
                        onClick={() => onOrderStatusChange(order.id, 'preparing')}
                        variant="primary"
                      >
                        Preparar
                      </ActionButton>
                    ) : null}
                    {order.status === 'preparing' ? (
                      <ActionButton
                        icon={CheckCircle2}
                        onClick={() => onOrderStatusChange(order.id, 'ready')}
                        variant="primary"
                      >
                        Marcar listo
                      </ActionButton>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState body="Cuando entren pedidos nuevos apareceran aqui." title="Sin pedidos" />
        )}
      </Panel>

      <aside className="side-stack">
        <Panel title="Informacion">
          <div className="store-info">
            <SafeImage src={store.imageUrl} alt="" />
            <strong>{store.name}</strong>
            <span>{store.address}</span>
            <span>
              <Phone size={15} aria-hidden="true" /> {store.phone}
            </span>
            <span>{store.schedule}</span>
            <ActionButton icon={Power} onClick={() => onToggleStoreOpen(store.id)} variant={store.open ? 'danger' : 'success'}>
              {store.open ? 'Cerrar tienda' : 'Abrir tienda'}
            </ActionButton>
          </div>
        </Panel>

        <Panel title="Nuevo producto">
          <div className="product-form">
            <input
              aria-label="Nombre del producto"
              onChange={(event) => setDraftName(event.target.value)}
              placeholder="Nombre"
              value={draftName}
            />
            <textarea
              aria-label="Descripcion del producto"
              onChange={(event) => setDraftDescription(event.target.value)}
              placeholder="Descripcion"
              value={draftDescription}
            />
            <div className="form-grid">
              <input
                aria-label="Precio del producto"
                onChange={(event) => setDraftPrice(event.target.value)}
                placeholder="Precio"
                type="number"
                value={draftPrice}
              />
              <input
                aria-label="Cantidad disponible"
                onChange={(event) => setDraftStock(event.target.value)}
                placeholder="Stock"
                type="number"
                value={draftStock}
              />
            </div>
            <input
              aria-label="Categoria"
              onChange={(event) => setDraftCategory(event.target.value)}
              placeholder="Categoria"
              value={draftCategory}
            />
            <input
              aria-label="Opciones adicionales"
              onChange={(event) => setDraftOptions(event.target.value)}
              placeholder="Opciones separadas por coma"
              value={draftOptions}
            />
            <ActionButton icon={Plus} onClick={submitProduct} variant="primary">
              Agregar producto
            </ActionButton>
          </div>
        </Panel>
      </aside>

      <Panel className="products-panel" title="Inventario visible">
        <div className="inventory-table">
          {storeProducts.map((product) => (
            <div className="inventory-row" key={product.id}>
              <SafeImage src={product.imageUrl} alt="" />
              <div>
                <strong>{product.name}</strong>
                <span>{product.category} · {formatCurrency(product.price)}</span>
              </div>
              <span>{product.stock} und.</span>
              <ActionButton
                icon={product.available ? XCircle : CheckCircle2}
                onClick={() => onToggleProduct(product.id)}
                variant={product.available ? 'ghost' : 'success'}
              >
                {product.available ? 'Ocultar' : 'Activar'}
              </ActionButton>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
