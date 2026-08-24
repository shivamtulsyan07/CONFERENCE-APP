import { useEffect, useState } from "react";
import { api, errMsg } from "../lib/api";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Checkbox } from "../components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "../components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";

export default function CompanyOrders() {
  const [pos, setPos] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [open, setOpen] = useState(false);
  const [supplier, setSupplier] = useState("");
  const [lines, setLines] = useState([{ product_id: "", qty: "1" }]);
  const [linkIds, setLinkIds] = useState([]);
  const [receiving, setReceiving] = useState(null);
  const [recvQty, setRecvQty] = useState({});

  const load = () => {
    api.companyOrders().then(setPos).catch((e) => toast.error(errMsg(e)));
    api.products().then(setProducts);
    api.orders().then(setOrders);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!supplier.trim()) return toast.error("Enter company / supplier name");
    const items = lines
      .filter((l) => l.product_id && Number(l.qty) > 0)
      .map((l) => ({
        product_id: l.product_id,
        name: products.find((p) => p.id === l.product_id)?.name || "",
        qty: Number(l.qty),
      }));
    if (!items.length) return toast.error("Add at least one item");
    try {
      await api.createCompanyOrder({ supplier, items, order_ids: linkIds });
      toast.success("Order placed with company");
      setOpen(false); setSupplier(""); setLines([{ product_id: "", qty: "1" }]); setLinkIds([]);
      load();
    } catch (e) { toast.error(errMsg(e)); }
  };

  const openReceive = (po) => {
    setReceiving(po);
    setRecvQty(Object.fromEntries(po.items.map((i) => [i.product_id, String(i.qty - i.received_qty)])));
  };

  const confirmReceive = async () => {
    try {
      await api.receiveCompanyOrder(receiving.id, {
        items: Object.entries(recvQty)
          .map(([product_id, q]) => ({ product_id, qty: Number(q) || 0 }))
          .filter((i) => i.qty > 0),
      });
      toast.success("Goods received, shop stock updated");
      setReceiving(null); load();
    } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div>
      <PageHeader
        testId="company-orders-page"
        title="Company Orders"
        subtitle="Place orders with the company and receive goods into shop stock"
        action={<Button data-testid="new-po-btn" onClick={() => setOpen(true)}>Place company order</Button>}
      />

      <div className="grid-panel overflow-x-auto" data-testid="po-table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>PO #</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pos.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-muted-foreground">No company orders yet.</TableCell></TableRow>
            )}
            {pos.map((po) => (
              <TableRow key={po.id} className="row-hover" data-testid={`po-row-${po.id}`}>
                <TableCell className="mono text-xs">{po.po_no}</TableCell>
                <TableCell className="font-medium">{po.supplier}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {po.items.map((i) => `${i.name} ${i.received_qty}/${i.qty}`).join(", ")}
                </TableCell>
                <TableCell><StatusBadge status={po.status} testId={`po-status-${po.id}`} /></TableCell>
                <TableCell className="text-right">
                  {po.status !== "received" && (
                    <Button variant="outline" size="sm" data-testid={`receive-btn-${po.id}`} onClick={() => openReceive(po)}>
                      Receive goods
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl" data-testid="po-dialog">
          <DialogHeader><DialogTitle>Place order with company</DialogTitle></DialogHeader>
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            <div className="space-y-1.5">
              <Label>Company / supplier</Label>
              <Input data-testid="po-supplier-input" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
            </div>
            <div className="space-y-3">
              <Label>Items</Label>
              {lines.map((l, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-8">
                    <Select value={l.product_id}
                      onValueChange={(v) => setLines(lines.map((x, idx) => (idx === i ? { ...x, product_id: v } : x)))}>
                      <SelectTrigger data-testid={`po-line-product-${i}`}><SelectValue placeholder="Product" /></SelectTrigger>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id} data-testid={`po-product-option-${i}-${p.id}`}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-3">
                    <Input data-testid={`po-line-qty-${i}`} value={l.qty}
                      onChange={(e) => setLines(lines.map((x, idx) => (idx === i ? { ...x, qty: e.target.value } : x)))} />
                  </div>
                  <div className="col-span-1">
                    {lines.length > 1 && (
                      <Button variant="ghost" size="icon" onClick={() => setLines(lines.filter((_, idx) => idx !== i))}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" data-testid="po-add-line-btn"
                onClick={() => setLines([...lines, { product_id: "", qty: "1" }])}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add item
              </Button>
            </div>
            <div className="space-y-2">
              <Label>Link pending customer orders (optional)</Label>
              {orders.filter((o) => o.status === "pending").length === 0 && (
                <p className="text-xs text-muted-foreground">No pending customer orders.</p>
              )}
              {orders.filter((o) => o.status === "pending").map((o) => (
                <label key={o.id} className="flex items-center gap-2 text-sm" data-testid={`link-order-${o.id}`}>
                  <Checkbox
                    checked={linkIds.includes(o.id)}
                    onCheckedChange={(c) =>
                      setLinkIds(c ? [...linkIds, o.id] : linkIds.filter((x) => x !== o.id))
                    }
                  />
                  <span className="mono text-xs">{o.order_no}</span> — {o.party_name}
                </label>
              ))}
            </div>
          </div>
          <DialogFooter><Button data-testid="save-po-btn" onClick={save}>Place order</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!receiving} onOpenChange={(o) => !o && setReceiving(null)}>
        <DialogContent data-testid="receive-dialog">
          <DialogHeader><DialogTitle>Receive goods {receiving?.po_no}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {receiving?.items.map((i) => (
              <div key={i.product_id} className="flex items-center justify-between gap-3">
                <div className="text-sm">
                  {i.name}
                  <div className="text-xs text-muted-foreground">pending {i.qty - i.received_qty}</div>
                </div>
                <Input className="w-24" data-testid={`receive-qty-${i.product_id}`}
                  value={recvQty[i.product_id] ?? ""}
                  onChange={(e) => setRecvQty({ ...recvQty, [i.product_id]: e.target.value })} />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button data-testid="confirm-receive-btn" onClick={confirmReceive}>Add to shop stock</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
