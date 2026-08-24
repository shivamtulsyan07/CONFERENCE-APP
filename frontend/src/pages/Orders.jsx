import { useEffect, useState } from "react";
import { api, errMsg, money } from "../lib/api";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "../components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { toast } from "sonner";
import { Plus, Trash2, X } from "lucide-react";
import { useRole } from "../context/RoleContext";

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [parties, setParties] = useState([]);
  const [products, setProducts] = useState([]);
  const [open, setOpen] = useState(false);
  const [partyId, setPartyId] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState([{ product_id: "", qty: "1", rate: "", source: "company" }]);
  const { isAdmin } = useRole();

  const load = () => {
    api.orders().then(setOrders).catch((e) => toast.error(errMsg(e)));
    api.parties().then(setParties);
    api.products().then(setProducts);
  };
  useEffect(() => { load(); }, []);

  const setLine = (i, patch) =>
    setLines(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const total = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.rate) || 0), 0);

  const save = async () => {
    if (!partyId) return toast.error("Select a party");
    const items = lines
      .filter((l) => l.product_id && Number(l.qty) > 0)
      .map((l) => {
        const p = products.find((x) => x.id === l.product_id);
        return {
          product_id: l.product_id,
          name: p?.name || "",
          qty: Number(l.qty),
          rate: Number(l.rate) || 0,
          source: l.source,
        };
      });
    if (!items.length) return toast.error("Add at least one item with quantity");
    try {
      await api.createOrder({ party_id: partyId, items, notes });
      toast.success("Order created");
      setOpen(false); setPartyId(""); setNotes("");
      setLines([{ product_id: "", qty: "1", rate: "", source: "company" }]);
      load();
    } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div>
      <PageHeader
        testId="orders-page"
        title="Customer Orders"
        subtitle="Take orders from parties, then procure from company and dispatch"
        action={<Button data-testid="new-order-btn" onClick={() => setOpen(true)}>New order</Button>}
      />

      <div className="grid-panel overflow-x-auto" data-testid="orders-table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order #</TableHead>
              <TableHead>Party</TableHead>
              <TableHead>Items</TableHead>
              <TableHead className="text-right">Value</TableHead>
              <TableHead>Status</TableHead>
              {isAdmin && <TableHead className="text-right">Delete</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-muted-foreground">No orders yet.</TableCell></TableRow>
            )}
            {orders.map((o) => (
              <TableRow key={o.id} className="row-hover" data-testid={`order-row-${o.id}`}>
                <TableCell className="mono text-xs">{o.order_no}</TableCell>
                <TableCell className="font-medium">{o.party_name}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {o.items.map((i) => `${i.name} × ${i.qty}`).join(", ")}
                </TableCell>
                <TableCell className="text-right mono">{money(o.total)}</TableCell>
                <TableCell><StatusBadge status={o.status} testId={`order-status-${o.id}`} /></TableCell>
                {isAdmin && (
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" data-testid={`delete-order-${o.id}`}
                      onClick={async () => { await api.deleteOrder(o.id); toast.success("Deleted"); load(); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl" data-testid="order-dialog">
          <DialogHeader><DialogTitle>New customer order</DialogTitle></DialogHeader>
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            <div className="space-y-1.5">
              <Label>Party</Label>
              <Select value={partyId} onValueChange={setPartyId}>
                <SelectTrigger data-testid="order-party-select"><SelectValue placeholder="Select party" /></SelectTrigger>
                <SelectContent>
                  {parties.map((p) => (
                    <SelectItem key={p.id} value={p.id} data-testid={`party-option-${p.id}`}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label>Items</Label>
              {lines.map((l, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end" data-testid={`order-line-${i}`}>
                  <div className="col-span-12 sm:col-span-5">
                    <Select
                      value={l.product_id}
                      onValueChange={(v) => {
                        const p = products.find((x) => x.id === v);
                        setLine(i, { product_id: v, rate: l.rate || String(p?.rate ?? "") });
                      }}
                    >
                      <SelectTrigger data-testid={`line-product-${i}`}><SelectValue placeholder="Product" /></SelectTrigger>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id} data-testid={`product-option-${i}-${p.id}`}>
                            {p.name} (stock {p.shop_stock})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <Input data-testid={`line-qty-${i}`} placeholder="Qty" value={l.qty}
                      onChange={(e) => setLine(i, { qty: e.target.value })} />
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <Input data-testid={`line-rate-${i}`} placeholder="Rate" value={l.rate}
                      onChange={(e) => setLine(i, { rate: e.target.value })} />
                  </div>
                  <div className="col-span-3 sm:col-span-2">
                    <Select value={l.source} onValueChange={(v) => setLine(i, { source: v })}>
                      <SelectTrigger data-testid={`line-source-${i}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="company">Company</SelectItem>
                        <SelectItem value="shop">Shop</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-1">
                    {lines.length > 1 && (
                      <Button variant="ghost" size="icon" data-testid={`remove-line-${i}`}
                        onClick={() => setLines(lines.filter((_, idx) => idx !== i))}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" data-testid="add-line-btn"
                onClick={() => setLines([...lines, { product_id: "", qty: "1", rate: "", source: "company" }])}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add item
              </Button>
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea data-testid="order-notes-input" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="items-center justify-between sm:justify-between">
            <span className="text-sm">Total <b className="mono" data-testid="order-total">{money(total)}</b></span>
            <Button data-testid="save-order-btn" onClick={save}>Create order</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
