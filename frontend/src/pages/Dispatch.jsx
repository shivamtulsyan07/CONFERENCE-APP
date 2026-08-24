import { useEffect, useState } from "react";
import { api, errMsg } from "../lib/api";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { toast } from "sonner";

export default function Dispatch() {
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [dispatches, setDispatches] = useState([]);
  const [active, setActive] = useState(null);
  const [qty, setQty] = useState({});
  const [transport, setTransport] = useState("");

  const load = () => {
    api.orders().then(setOrders).catch((e) => toast.error(errMsg(e)));
    api.products().then(setProducts);
    api.dispatches().then(setDispatches);
  };
  useEffect(() => { load(); }, []);

  const stockOf = (id) => products.find((p) => p.id === id)?.shop_stock ?? 0;

  const openDispatch = (o) => {
    setActive(o);
    setTransport("");
    setQty(Object.fromEntries(o.items.map((i) => [i.product_id, String(Math.min(i.qty - i.dispatched_qty, stockOf(i.product_id)))])));
  };

  const confirm = async () => {
    const items = active.items
      .map((i) => ({ product_id: i.product_id, name: i.name, qty: Number(qty[i.product_id]) || 0 }))
      .filter((i) => i.qty > 0);
    if (!items.length) return toast.error("Enter dispatch quantity");
    try {
      await api.createDispatch({ order_id: active.id, items, transport });
      toast.success("Dispatched, shop stock deducted");
      setActive(null); load();
    } catch (e) { toast.error(errMsg(e)); }
  };

  const pending = orders.filter((o) => o.status !== "dispatched");

  return (
    <div>
      <PageHeader
        testId="dispatch-page"
        title="Party-wise Dispatch"
        subtitle="Dispatch received goods to each party; shop stock is deducted automatically"
      />

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending" data-testid="tab-pending">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">Dispatch history</TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <div className="grid-panel overflow-x-auto" data-testid="dispatch-pending-table">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Party</TableHead>
                  <TableHead>Pending items</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-muted-foreground">Nothing pending for dispatch.</TableCell></TableRow>
                )}
                {pending.map((o) => (
                  <TableRow key={o.id} className="row-hover" data-testid={`dispatch-row-${o.id}`}>
                    <TableCell className="mono text-xs">{o.order_no}</TableCell>
                    <TableCell className="font-medium">{o.party_name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {o.items.map((i) => `${i.name} ${i.qty - i.dispatched_qty} left`).join(", ")}
                    </TableCell>
                    <TableCell><StatusBadge status={o.status} /></TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" data-testid={`dispatch-btn-${o.id}`} onClick={() => openDispatch(o)}>
                        Dispatch
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="history">
          <div className="grid-panel overflow-x-auto" data-testid="dispatch-history-table">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dispatch #</TableHead>
                  <TableHead>Party</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Transport</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dispatches.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-muted-foreground">No dispatches yet.</TableCell></TableRow>
                )}
                {dispatches.map((d) => (
                  <TableRow key={d.id} className="row-hover" data-testid={`dispatch-history-${d.id}`}>
                    <TableCell className="mono text-xs">{d.dispatch_no}</TableCell>
                    <TableCell className="font-medium">{d.party_name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {d.items.map((i) => `${i.name} × ${i.qty}`).join(", ")}
                    </TableCell>
                    <TableCell>{d.transport || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent data-testid="dispatch-dialog">
          <DialogHeader>
            <DialogTitle>Dispatch {active?.order_no} — {active?.party_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {active?.items.map((i) => (
              <div key={i.product_id} className="flex items-center justify-between gap-3">
                <div className="text-sm">
                  {i.name}
                  <div className="text-xs text-muted-foreground">
                    pending {i.qty - i.dispatched_qty} · shop stock {stockOf(i.product_id)}
                  </div>
                </div>
                <Input className="w-24" data-testid={`dispatch-qty-${i.product_id}`}
                  value={qty[i.product_id] ?? ""}
                  onChange={(e) => setQty({ ...qty, [i.product_id]: e.target.value })} />
              </div>
            ))}
            <div className="space-y-1.5">
              <Label>Transport / LR details</Label>
              <Input data-testid="dispatch-transport-input" value={transport} onChange={(e) => setTransport(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button data-testid="confirm-dispatch-btn" onClick={confirm}>Confirm dispatch</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
