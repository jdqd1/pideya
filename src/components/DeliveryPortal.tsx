import { useMemo, useState } from 'react';
import {
  Bike,
  CheckCircle2,
  Clock,
  MapPin,
  Navigation,
  PackageCheck,
  Star,
  Truck,
  WalletCards,
} from 'lucide-react';
import { ActionButton, EmptyState, MetricCard, Panel, SafeImage, StatusPill } from './Shared';
import type { DeliveryAgent, Order, OrderStatus, Storefront } from '../types';
import { formatCurrency, formatTime } from '../utils/format';

interface DeliveryPortalProps {
  deliveries: DeliveryAgent[];
  stores: Storefront[];
  orders: Order[];
  onAcceptDelivery: (orderId: string, deliveryId: string) => void;
  onOrderStatusChange: (orderId: string, status: OrderStatus) => void;
}

export function DeliveryPortal({
  deliveries,
  stores,
  orders,
  onAcceptDelivery,
  onOrderStatusChange,
}: DeliveryPortalProps) {
  const [activeDeliveryId, setActiveDeliveryId] = useState(deliveries[0]?.id ?? '');
  const activeDelivery = deliveries.find((delivery) => delivery.id === activeDeliveryId) ?? deliveries[0];

  const availableOrders = useMemo(
    () => orders.filter((order) => order.status === 'ready' && !order.assignedDeliveryId),
    [orders],
  );
  const activeJobs = orders.filter(
    (order) =>
      order.assignedDeliveryId === activeDelivery?.id &&
      !['delivered', 'cancelled'].includes(order.status),
  );
  const finishedJobs = orders.filter(
    (order) => order.assignedDeliveryId === activeDelivery?.id && order.status === 'delivered',
  );

  const projectedAvailable = availableOrders.reduce((total, order) => total + order.courierReward, 0);

  return (
    <div className="role-grid delivery-grid">
      <Panel className="delivery-command">
        <div className="workspace-title">
          <div>
            <span className="zone-label">
              <Bike size={15} aria-hidden="true" /> Portal delivery
            </span>
            <h1>Acepta pedidos disponibles antes que otros repartidores.</h1>
            <p>
              Cada pedido listo muestra origen, destino, distancia y ganancia estimada para decidir
              rapido.
            </p>
          </div>
          <label className="input-shell select-shell">
            <Bike size={17} aria-hidden="true" />
            <select
              aria-label="Seleccionar delivery"
              onChange={(event) => setActiveDeliveryId(event.target.value)}
              value={activeDelivery?.id}
            >
              {deliveries.map((delivery) => (
                <option key={delivery.id} value={delivery.id}>
                  {delivery.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="metrics-grid">
          <MetricCard
            detail="Pedidos libres"
            icon={PackageCheck}
            label="Disponibles"
            tone="green"
            value={String(availableOrders.length)}
          />
          <MetricCard
            detail="Ganancia posible"
            icon={WalletCards}
            label="Bolsa"
            tone="amber"
            value={formatCurrency(projectedAvailable)}
          />
          <MetricCard
            detail="Activos ahora"
            icon={Truck}
            label="Mis rutas"
            tone="blue"
            value={String(activeJobs.length)}
          />
          <MetricCard
            detail="Completados"
            icon={CheckCircle2}
            label="Hoy"
            tone="ink"
            value={String(activeDelivery?.completedToday ?? 0)}
          />
        </div>
      </Panel>

      <Panel title="Pedidos disponibles">
        {availableOrders.length ? (
          <div className="delivery-offers">
            {availableOrders.map((order) => {
              const store = stores.find((item) => item.id === order.storeId);

              return (
                <article className="delivery-card" key={order.id}>
                  <div className="delivery-card-main">
                    <SafeImage src={store?.imageUrl} alt="" />
                    <div>
                      <strong>{order.id}</strong>
                      <span>{store?.name}</span>
                      <small>{formatTime(order.createdAt)} · {order.items.length} items</small>
                    </div>
                  </div>
                  <div className="route-stack">
                    <span>
                      <MapPin size={15} aria-hidden="true" /> Retiro: {store?.address}
                    </span>
                    <span>
                      <Navigation size={15} aria-hidden="true" /> Entrega: {order.address}
                    </span>
                  </div>
                  <div className="delivery-card-footer">
                    <span>{order.distanceKm} km</span>
                    <strong>{formatCurrency(order.courierReward)}</strong>
                    <ActionButton
                      icon={CheckCircle2}
                      onClick={() => onAcceptDelivery(order.id, activeDelivery.id)}
                      variant="success"
                    >
                      Tomar pedido
                    </ActionButton>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState
            body="Cuando una tienda marque un pedido como listo aparecera en esta lista."
            title="Sin pedidos libres"
          />
        )}
      </Panel>

      <aside className="side-stack">
        <Panel title="Mi perfil">
          <div className="driver-card">
            <div className="avatar-circle">{activeDelivery?.name.slice(0, 1)}</div>
            <strong>{activeDelivery?.name}</strong>
            <span>{activeDelivery?.vehicle}</span>
            <span>
              <Star size={15} aria-hidden="true" /> {activeDelivery?.rating} ·{' '}
              {formatCurrency(activeDelivery?.earningsToday ?? 0)} hoy
            </span>
          </div>
        </Panel>

        <Panel title="Historial">
          <div className="history-list">
            {finishedJobs.length ? (
              finishedJobs.map((order) => (
                <div className="history-row" key={order.id}>
                  <CheckCircle2 size={15} aria-hidden="true" />
                  <div>
                    <strong>{order.id}</strong>
                    <span>{formatCurrency(order.courierReward)}</span>
                  </div>
                  <StatusPill status={order.status} />
                </div>
              ))
            ) : (
              <EmptyState body="Las entregas completadas apareceran aqui." title="Sin historial" />
            )}
          </div>
        </Panel>
      </aside>

      <Panel title="Mis rutas activas">
        {activeJobs.length ? (
          <div className="order-list">
            {activeJobs.map((order) => {
              const store = stores.find((item) => item.id === order.storeId);

              return (
                <article className="order-card" key={order.id}>
                  <div className="order-card-header">
                    <div>
                      <strong>{order.id}</strong>
                      <span>{store?.name} · {order.address}</span>
                    </div>
                    <StatusPill status={order.status} />
                  </div>
                  <div className="route-stack">
                    <span>
                      <MapPin size={15} aria-hidden="true" /> {store?.address}
                    </span>
                    <span>
                      <Clock size={15} aria-hidden="true" /> {order.distanceKm} km ·{' '}
                      {formatCurrency(order.courierReward)}
                    </span>
                  </div>
                  <div className="button-row">
                    {order.status === 'assigned' ? (
                      <ActionButton
                        icon={PackageCheck}
                        onClick={() => onOrderStatusChange(order.id, 'picked_up')}
                        variant="primary"
                      >
                        Retirado
                      </ActionButton>
                    ) : null}
                    {order.status === 'picked_up' ? (
                      <ActionButton
                        icon={Truck}
                        onClick={() => onOrderStatusChange(order.id, 'in_transit')}
                        variant="primary"
                      >
                        En camino
                      </ActionButton>
                    ) : null}
                    {order.status === 'in_transit' ? (
                      <ActionButton
                        icon={CheckCircle2}
                        onClick={() => onOrderStatusChange(order.id, 'delivered')}
                        variant="success"
                      >
                        Entregado
                      </ActionButton>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState body="Toma un pedido disponible para iniciar una ruta." title="Sin rutas activas" />
        )}
      </Panel>
    </div>
  );
}
